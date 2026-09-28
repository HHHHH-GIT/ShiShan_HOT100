# SHISHAN004 · 时空错位的文件服务

## 情景

一个文件上传与资源访问服务。客户端提交附件后，会立即使用接口返回的 URL 展示或下载该附件。

## 现象

> **工单 #5021 · 刚上传的附件无法访问**
>
> 上传返回成功，响应里也有 /api/files/ 开头的地址。我们马上访问这个地址，却收到 404。换一个新文件名再传，还是遇到同样的问题。
>
> —— 前端研发 小胡

一次客户端记录：

```text
POST /api/upload
{"filename":"receipt.txt","content":"cmVjZWlwdA=="}
→ HTTP 200，code=0，data.url="/api/files/receipt.txt"

GET /api/files/receipt.txt
→ HTTP 404，code=404，msg="file not found"
```

## 怎么运行

在工程目录执行：

```bash
mvn spring-boot:run
```

- 服务地址：`http://127.0.0.1:18083`；心跳为 `GET /hello`，正常返回 `{"status":"ok"}`。
- 日志位置：`logs/app.log`，路径相对工程运行目录。


## 边界与验收

- 保持既有上传和访问接口、请求字段及响应结构。
- 上传成功后，返回的地址应立即可用，获取的内容应与上传附件一致。
- 每份附件应独立可读，不存在的文件仍应返回 HTTP 404。
- 客户端只执行上传与访问，不承担服务端维护操作。
