# SHISHAN003 · 题解与技术复盘

## 现象回顾

1. 用户上传文件后，API 返回了成功响应并提供了哈希指纹，但随后调用元信息或下载接口按此指纹查询时，服务端返回 404 文件不存在。
2. 用户上传包含图片的附件，下载后本地图片查看器提示“文件损坏，无法解析图像头信息”。
3. 某些包含特定编码符号的文件，解码后出现数据截断与长度不符。

---

## 根因分析

### 1. 指纹哈希格式失配与大小写敏感
在文件上传时，服务端计算了文件的 SHA-256 哈希作为唯一索引存储到内存映射表中：
* 生成 Hex 字符串时采用了小写形式（或转换字节时未格式化补足两位前导零）；
* 在查询元信息接口中，内部索引查询或比较时，使用了区分大小写的 `Map.get(hash)` 或大小写格式不一致，导致查询落空抛出 404。

### 2. 字符流写入导致二进制文件破坏
服务端在将 Base64 解码后的文件内容写入磁盘时，误用了纯文本字符流：
```java
// 错误示范：
String content = new String(fileBytes, StandardCharsets.UTF_8);
try (FileWriter writer = new FileWriter(destFile)) {
    writer.write(content);
}
```
PNG/JPEG 等图片格式包含大量非 UTF-8 编码的不可打印二进制字节。在 `new String(bytes, UTF_8)` 过程中，非合法编码的字节会被替换成 Unicode 替代字符 `\uFFFD`（三字节 `0xEF 0xBF 0xBD`），导致原始二进制文件结构破坏，图片魔数头（`0x89 0x50 0x4E 0x47`）失效。

### 3. Base64 中特殊符号丢失
在传输过程中，Base64 中的合法字符 `+` 容易被 HTTP 请求或某些容器当做 URL 空格误解析为 `' '`。在直接送入 `Base64.getDecoder().decode()` 之前，若未将空格还原为 `+`，会导致字节解码丢失。

---

## 修复方案

1. **统一哈希算法与大小写**：
   在 `HashUtils.java` 中，统一生成标准 64 位小写十六进制字符串（`String.format("%02x", b)`），并在检索时忽略大小写或统一转为小写。
2. **使用二进制字节流保存文件**：
   直接使用 `Files.write(targetPath, fileBytes)` 或 `FileOutputStream` 写出原始字节，禁止中途转成字符串。
3. **清洗 Base64 编码字符**：
   在解码前进行规范化替换：`content = content.trim().replace(' ', '+')`。
