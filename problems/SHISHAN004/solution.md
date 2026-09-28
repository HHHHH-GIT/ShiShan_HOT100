# SHISHAN004 · 题解与技术复盘

## 现象回顾

用户通过上传接口上传文件，接口返回 HTTP 200 成功，并且在工程目录的 `src/main/resources/static/uploads/` 下能够看到新文件生成。
但是紧接着请求该文件的访问接口时，服务端却返回 HTTP 404 Not Found。
若随后重新执行 Maven 构建，资源复制步骤可能让之前的文件变得可读。需要将构建与进程重启分开观察。

---

## 根因分析

该缺陷源于**源码目录（Source Tree）与构建运行目录（Classpath / Target）的混淆**：

1. **写入侧误用源码目录**：
   在文件上传逻辑中，开发者使用了相对源码根路径：
   ```java
   private final String uploadDir = "src/main/resources/static/uploads";
   ```
   文件被保存在了磁盘上的 `src/...` 源码树下。

2. **读取侧基于类路径（Classpath）**：
   在文件获取逻辑中，使用了 Spring 的 `ClassPathResource`：
   ```java
   Resource resource = new ClassPathResource("static/uploads/" + filename);
   ```
   Java 进程在运行时加载的是构建产物目录 `target/classes/static/uploads/` 中的资源。Maven 在项目构建阶段仅将当时的静态文件拷贝入 `target`，运行时动态上传写入 `src` 的新文件无法被 `ClassPathResource` 动态感知，因此抛出 404。

3. **重启或重新编译“诈尸”现象**：
   重新执行 `mvn compile` 时，Maven 触发资源拷贝插件（resources plugin），把 `src` 中的新增文件拷贝进了 `target/classes`。再次执行 `mvn spring-boot:run` 也可能伴随前置构建；单纯重启 JVM 或已打包 Jar 不会自动将源码目录的新增文件复制进类路径。但任何真正的生产环境运行在打包后的 Jar 包内，绝对不存在动态写入 `src` 且能在 Classpath 立即生效的可能。

---

## 修复方案

动态产生的文件属于**业务数据**，绝不能保存在代码仓库或类路径中。应当：
1. 统一配置一个独立的文件存储目录（如 `./uploads` 或工作区指定路径）；
2. 写入时使用 `Files.write` 直接保存到该物理目录；
3. 读取时直接通过文件系统（`FileSystemResource` 或文件流）从同一个目录读取，保证读写单一数据源。
