# SHISHAN005 · 消息接收重复问题（参考实现）

## 服务运行说明

服务使用 Spring Boot 3 构建，运行在端口 `18084`。

编译并启动本地服务：

```bash
mvn spring-boot:run
```

探活检查：

```bash
curl http://127.0.0.1:18084/hello
```

返回 `{"status":"ok"}` 即代表服务已就绪。
