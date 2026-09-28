import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { test, mock } from "node:test";
import AdmZip from "adm-zip";
import { parse } from "yaml";

// 所有写入与重置均在临时项目中完成，不接触用户工作区及提交记录。
const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "shishan-regression-"));
const meta = JSON.parse(await fs.readFile(path.join(root, "problems/SHISHAN003/meta.json"), "utf8"));
const pngSpec = parse(await fs.readFile(path.join(root, "problems/SHISHAN003/tests.yaml"), "utf8"));
process.chdir(temp);
const { downloadProblem, resetProblem } = await import("../lib/workspace");
const { saveRun, getRecord, clearRecord } = await import("../lib/state");
const { sendRequest, evaluateExpect } = await import("../lib/runner/request");
const { TestSpecSchema } = await import("../lib/types");
const { runStore } = await import("../lib/runner/store");
const { GET: problemGET } = await import("../app/api/problems/[id]/route");
const { GET: runGET } = await import("../app/api/runs/[runId]/route");
const { GET: streamGET } = await import("../app/api/runs/[runId]/stream/route");
const { startRun } = await import("../lib/runner");

await test("平台回归", async (t) => {
  t.after(async () => {
    process.chdir(root);
    await fs.rm(temp, { recursive: true, force: true });
  });

  const id = "SHISHAN003";
  const target = path.join(temp, "workspace", id);
  const dist = path.join(temp, "problems", id, "dist", `${id}.zip`);
  const entry = (verdict: "AC" | "FAIL" | "heartbeat_failed") => ({
    runId: `run-${verdict}`, verdict, at: Date.now(), passed: verdict === "AC" ? 1 : 0, total: 1, durationMs: 1,
  });

  await t.test("AC 保留、旧记录迁移与显式重置", async () => {
    await saveRun(id, entry("AC"));
    await saveRun(id, entry("FAIL"));
    await saveRun(id, entry("heartbeat_failed"));
    assert.equal((await getRecord(id))?.ac, true);
    assert.equal((await getRecord(id))?.verdict, "heartbeat_failed");
    const stateFile = path.join(temp, "workspace/.state.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    state[id].ac = false;
    await fs.writeFile(stateFile, JSON.stringify(state));
    assert.equal((await getRecord(id))?.ac, true, "兼容旧版本丢失 ac 标记的记录");
    await clearRecord(id);
    assert.equal(await getRecord(id), null);
    await Promise.all([saveRun(id, entry("AC")), saveRun(id, entry("FAIL")), saveRun("OTHER", entry("AC"))]);
    assert.equal((await getRecord(id))?.ac, true);
    assert.equal((await getRecord(id))?.history.length, 2);
    assert.equal((await getRecord("OTHER"))?.ac, true);
    await clearRecord(id);
  });

  await t.test("缺失、损坏及 CRC 错误的 ZIP 保留原文件和 AC", async () => {
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "edited.java"), "user changes");
    await saveRun(id, entry("AC"));
    await assert.rejects(resetProblem(id), /题目包不存在/);
    await fs.mkdir(path.dirname(dist), { recursive: true });
    await fs.writeFile(dist, "broken zip");
    await assert.rejects(resetProblem(id), /无法解压/);
    const zip = new AdmZip();
    zip.addFile("new.java", Buffer.from("replacement"));
    const buffer = zip.toBuffer();
    const central = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buffer.writeUInt32LE(0, central + 16);
    buffer.writeUInt32LE(0, 14);
    await fs.writeFile(dist, buffer);
    await assert.rejects(resetProblem(id), /无法解压/);
    assert.equal(await fs.readFile(path.join(target, "edited.java"), "utf8"), "user changes");
    assert.equal((await getRecord(id))?.ac, true);
  });

  await t.test("目录占用及替换失败可恢复，成功重置清理旧文件与状态", async () => {
    const zip = new AdmZip();
    zip.addFile("new.java", Buffer.from("replacement"));
    await fs.writeFile(dist, zip.toBuffer());
    const originalRename = fs.rename.bind(fs);
    // 第三次 rename 是状态文件原子提交；失败时也必须还原代码和 AC。
    for (const failAt of [1, 2, 3]) {
      let calls = 0;
      const mocked = mock.method(fs, "rename", async (...args: Parameters<typeof fs.rename>) => {
        if (++calls === failAt) throw Object.assign(new Error("file busy"), { code: "EPERM" });
        return originalRename(...args);
      });
      try {
        await assert.rejects(resetProblem(id), /原文件已保留/);
        assert.equal(await fs.readFile(path.join(target, "edited.java"), "utf8"), "user changes");
        assert.equal((await getRecord(id))?.ac, true);
      } finally {
        mocked.mock.restore();
      }
    }
    assert.equal((await downloadProblem(id)).alreadyExisted, true);
    assert.equal((await resetProblem(id)).reset, true);
    assert.equal(await fs.readFile(path.join(target, "new.java"), "utf8"), "replacement");
    await assert.rejects(fs.stat(path.join(target, "edited.java")), { code: "ENOENT" });
    assert.equal(await getRecord(id), null);
  });

  await t.test("题目 API 按最近一次通过的测试点解锁", async () => {
    const dir = path.join(temp, "problems", id);
    await fs.mkdir(path.join(dir, "starter"), { recursive: true });
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
    await fs.writeFile(path.join(dir, "tests.yaml"), JSON.stringify({
      version: 1, baseUrl: "http://127.0.0.1:18082", vars: { secret: "PRIVATE_SPEC" },
      tests: [{ id: "PRIVATE_ID", name: "PRIVATE_NAME", type: "http", description: "PRIVATE_DESCRIPTION",
        request: { url: "http://127.0.0.1:18082/PRIVATE_REQUEST" }, expect: { contains: ["PRIVATE_ASSERTION"] } }],
    }));
    const request = new Request("http://localhost/");
    const params = { params: Promise.resolve({ id }) };
    assert.doesNotMatch(await (await problemGET(request, params)).text(), /PRIVATE_/);
    await saveRun(id, entry("FAIL"), ["PRIVATE_ID"]);
    assert.match(await (await problemGET(request, params)).text(), /PRIVATE_ASSERTION/);
    await saveRun(id, entry("AC"));
    assert.doesNotMatch(await (await problemGET(request, params)).text(), /PRIVATE_/, "历史 AC 不能代替单点通过记录");
    await clearRecord(id);
  });

  await t.test("逐点通过即回放日志；失败点在 FAIL、重连及历史 AC 后仍隐藏", async () => {
    await saveRun(id, entry("AC"));
    const run = runStore.createRun(id, "文件题", [
      { id: "PASS_ID", name: "PASS_NAME", description: "PASS_DESCRIPTION", type: "http", status: "pending" },
      { id: "PRIVATE_ID", name: "PRIVATE_NAME", description: "PRIVATE_DESCRIPTION", type: "http", status: "pending" },
    ]);
    runStore.appendLog(run.id, "PASS_ID", "debug", "PASS_REQUEST");
    runStore.appendLog(run.id, "PRIVATE_ID", "debug", "PRIVATE_REQUEST");
    const request = new Request("http://localhost/");
    const params = { params: Promise.resolve({ runId: run.id }) };
    assert.doesNotMatch(await (await runGET(request, params)).text(), /PRIVATE_|PASS_/);
    const response = await streamGET(request, params);
    const reader = response.body!.getReader();
    const read = async () => new TextDecoder().decode((await reader.read()).value);
    const initial = await read();
    assert.doesNotMatch(initial, /PRIVATE_|PASS_/);
    assert.match(initial, /test-1/);
    runStore.updateTest(run.id, "PASS_ID", { status: "passed", metrics: { value: "PASS_METRIC" } });
    const unlocked = await read();
    assert.match(unlocked, /event: snapshot/);
    assert.match(unlocked, /PASS_REQUEST/);
    assert.match(unlocked, /PASS_NAME/);
    assert.match(unlocked, /PASS_DESCRIPTION/);
    assert.match(unlocked, /PASS_METRIC/);
    assert.match(unlocked, /test-1/);
    assert.doesNotMatch(unlocked, /PRIVATE_/);
    runStore.updateTest(run.id, "PRIVATE_ID", { status: "failed", reason: "PRIVATE_ASSERTION", metrics: { secret: "PRIVATE_METRIC" } });
    assert.doesNotMatch(await read(), /PRIVATE_/);
    runStore.setProgress(run.id, { done: 2, total: 2, current: "PRIVATE_NAME" });
    assert.doesNotMatch(await read(), /PRIVATE_/);
    runStore.appendLog(run.id, "PRIVATE_ID", "error", "PRIVATE_FAILURE");
    assert.doesNotMatch(await read(), /PRIVATE_/);
    runStore.appendLog(run.id, null, "error", "PRIVATE_INTERNAL_ERROR");
    assert.doesNotMatch(await read(), /PRIVATE_/);
    await reader.cancel();
    const reconnect = await streamGET(request, params);
    const reReader = reconnect.body!.getReader();
    const snapshot = new TextDecoder().decode((await reReader.read()).value);
    assert.match(snapshot, /PASS_REQUEST/);
    assert.doesNotMatch(snapshot, /PRIVATE_/);
    runStore.finish(run.id, "FAIL");
    assert.match(new TextDecoder().decode((await reReader.read()).value), /event: done/);
    assert.equal((await reReader.read()).done, true);
    for (const result of [await runGET(request, params), await streamGET(request, params)]) {
      const content = await result.text();
      assert.match(content, /PASS_REQUEST/);
      assert.doesNotMatch(content, /PRIVATE_/);
    }
    await clearRecord(id);
  });

  await t.test("PNG 原始字节通过；文本转码损坏和截断均失败", async () => {
    const spec = TestSpecSchema.parse(pngSpec);
    const imageTest = spec.tests.find((item) => item.id === "image-binary-magic-header");
    assert.equal(imageTest?.type, "workflow");
    if (imageTest?.type !== "workflow") throw new Error("missing image test");
    const expected = imageTest.steps[1].expect!;
    const original = Buffer.from((imageTest.steps[0].request.json as { content: string }).content, "base64");
    const corrupted = Buffer.from(original.toString("utf8"), "utf8");
    for (const fragment of ["PNG", "IHDR", "IEND"]) assert.ok(corrupted.includes(fragment));
    const server = createServer((req, res) => {
      res.end(req.url === "/good" ? original : req.url === "/bad" ? corrupted : original.subarray(0, 20));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address() as { port: number };
      for (const url of ["good", "bad", "truncated"]) {
        const result = await sendRequest({ method: "GET", url: `http://127.0.0.1:${address.port}/${url}` }, {});
        const failures = evaluateExpect(expected, result);
        if (url === "good") assert.deepEqual(failures, []);
        else assert.ok(failures.some((item) => item.includes("SHA-256")));
      }
      assert.equal(expected.bodySha256, createHash("sha256").update(original).digest("hex"));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await t.test("Runner 发出 AC 事件之前已保存首次通过状态", async () => {
    const server = createServer((_req, res) => res.end('{"status":"ok"}'));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const { port } = server.address() as { port: number };
      const runId = await startRun({
        problemId: id, problemTitle: "测试", baseUrl: `http://127.0.0.1:${port}`,
        heartbeat: { port, path: "/hello" }, startCommand: "", workspacePath: target,
        logFile: path.join(target, "app.log"), logBaseDir: target,
        tests: [{ id: "one", name: "one", type: "http", request: { method: "GET", url: "${baseUrl}/hello" }, expect: { status: 200 } }],
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { unsubscribe(); reject(new Error("runner timed out")); }, 5000);
        const unsubscribe = runStore.subscribe(runId, (event) => {
          if (event.kind !== "done") return;
          clearTimeout(timer);
          unsubscribe();
          void getRecord(id).then((record) => {
            assert.equal(event.verdict, "AC");
            assert.equal(record?.ac, true);
            assert.deepEqual(record?.passedTestIds, ["one"]);
            resolve();
          }).catch(reject);
        });
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

});
