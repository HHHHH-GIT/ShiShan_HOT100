# SHISHAN005 · 消息接收重复问题：题解与验证说明

本题所有缺陷都只表现为消息重复。普通单次收发、连续重试和鉴权应正常；需要结合数据边界与操作序列定位。新版不再依靠空的防重索引或非线程安全列表制造显眼失败。

## 1. 交错标识使重试生成新消息

RecentMessageIndex 是容量 64 的访问顺序热索引，以 Java String.hashCode() 作为槽位。

mobile-session-Aa 与 mobile-session-BB 是不同且合法的客户端标识，但具有相同的哈希值。依次发送 A、B、A：B 替换了热索引槽位，第三次查询得到 B；完整字符串检查拒绝误用 B，看起来像一道正确的防护，却把“不匹配”当成“不存在”，于是重新保存 A。

表现：相同 clientMsgId 出现不同 msgId，历史和收件箱增加一条。两个独立标识的正文可以完全相同，不能靠正文去重。

参考修复：索引只能加速查找；未命中或完整标识不匹配时回查保留的消息，再刷新热索引。发送查重和保存继续处在同一同步边界内。

## 2. 热索引淘汰变成业务失忆

发送 A 后经过 65 条不同消息，A 的热索引被淘汰；历史记录仍在。再发送 A，starter 只看热索引，再次落入新增分支。

这是和碰撞不同的触发条件：修复碰撞、改成完整字符串键，仍然不能解决淘汰后的重试。

参考实现保留有限热索引，回查消息历史。真实系统可使用持久化唯一键和事务；无限扩容缓存不是必要条件。测试不读取内部容量或集合，只通过公开接口验证原消息编号、历史总数和收件箱数量。

## 3. 投递键在入表后发生变化

InboxRepository 已使用 Map.put，并有同步保护，普通重复投递不会增加元素。问题藏在 DeliveryKey：它持有可变 Message，equals/hashCode 随 content 和 acked 变化。

发送 → ACK → 撤回 → 发布原消息更新。第一次入表使用旧散列值；ACK 和撤回改变对象状态，但原桶没有搬迁。新 DeliveryKey 查找另一个桶，再插入相同 msgId。此时两个值甚至指向同一个 Message，两个气泡都显示撤回后的正文。

重复撤回也不能新增气泡；第二条无关消息必须保留。

参考修复：DeliveryKey 构造时只捕获不可变的消息编号，equals/hashCode 只依赖编号。不能禁用撤回投递，或清空整个收件箱来掩盖问题。

## 4. 分页的两层边界

第一层是旧的包含游标错误：找到 before 后从同一位置返回，前一页最后一条在后一页重现。

第二层更隐蔽：只将位置改成 i + 1，普通翻页正常；但 before 可来自全局收信进度，其对应消息可能在另一会话。当前会话找不到该编号时，startIndex 留在 0，整页被重放。

参考修复：将 before 作为数值上界，跳过所有 id >= before 的记录；不要求游标对应一条仍在结果集中的记录。会话历史 total 不因分页改变。

## 5. 补偿在途消息

starter 立即重投所有未确认消息，未区分正常在途与超时。参考实现仅补偿创建时间距今至少 3000ms 的未确认消息。

用例除了检查收件箱数量，还检查立即补偿的 compensatedCount 为 0，避免仅靠收件箱防重掩盖错误重投。

## 6. 时间线合流

starter 将历史与收件箱直接拼接，同一 msgId 出现两次。参考实现按消息编号合并并排序。按正文去重会误删合法的同文消息；只能在 timeline 去重也无法解决历史库与 inbox 本身的重复。

## 回归清单

| 用例 | 应验证的行为 |
| --- | --- |
| 基础收发、顺序重试、认证流程 | 常见路径正常，不能靠禁用功能通过 |
| identity-interleaving | A/B/A 仍是两条消息，重试返回原编号 |
| retained-message-retry | 长序列后重试仍返回原编号，总数不增加 |
| message-update-redelivery | ACK 与重复撤回更新原气泡，其他消息保留 |
| cursor-pagination-boundary | 正常翻页边界不重叠 |
| filtered-history-boundary | 跨会话检查点不会重新返回较新的消息 |
| in-flight-compensation-dedup | 在途不重投，确认后收信数量正常 |
| timeline-sync-reconnect | 两个出口合流后消息唯一 |
| load-chat-chaos | 混合交互无异常，耗时符合预算 |

验证命令：先在相应实现目录运行 mvn spring-boot:run，再执行：

```bash
npm run verify:problem -- --problem SHISHAN005 --dir problems/SHISHAN005/reference
npm run verify:problem -- --problem SHISHAN005 --dir problems/SHISHAN005/starter
```

两个实现共用 18084，必须分别启动。参考实现应全部 AC；starter 应稳定失败于两项分页、在途补偿、时间线合流，以及三项标识/投递边界。新用例不依赖竞态抢占、Thread.sleep 或随机碰撞，日志标记由实际重复状态派生，删除日志不会通过行为断言。

## 本次验证记录（2026-09-28）

- starter 与 reference 的 Maven 构建均通过；reference 全部 13 个测试点 AC。
- starter 在同一服务进程中连续运行三次，均稳定失败于上述 7 个测试点，基础认证、普通收发、短序列重试和混合负载通过。
- 在独立临时工程中，从 reference 分别恢复单个缺陷并运行完整测试：碰撞分支不回查仅失败 identity-interleaving；热索引未命中不回查仅失败 retained-message-retry；可变投递键仅失败 message-update-redelivery；仅采用精确查找后 i + 1 的分页修法仅失败 filtered-history-boundary。
- 题面规范检查为 0 error、0 warn，starter ZIP 已重新打包。

这些结果验证了用例的区分能力与复现稳定性；模型实际通过率仍需另外评测。
