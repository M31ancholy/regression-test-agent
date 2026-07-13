# Vercel AI SDK + Fastify Tool Loop Agent

一个使用 Playwright 操作网页的自动化回归测试 Agent。它可以读取 `util-record-steps` 产生的录制目录，按顺序回放 Todo，并对照每一步的录制参考图验证实际页面。

## 运行

```bash
npm install
npx playwright install chromium
cp .env.example .env
# 编辑 .env，填入 LLM_BASE_URL 和 LLM_API_KEY
# RECORDINGS_ROOT 默认指向相邻的 ../util-record-steps
npm run dev
```

服务默认监听 `http://localhost:3000`。

## CLI 直接运行 Agent

如果只想本地观察 Agent 操作页面，可以绕过 HTTP 服务直接执行录制：

```bash
npm run agent -- \
  --recording 2026-07-13T08-03-36-919Z \
  --prompt "验证录制流程"
```

CLI 默认显示 Chromium 窗口。待测网页需要提前启动，例如：

```bash
cd ../webpage-for-testing
npm run dev
```

可用参数：

```text
--recording <path>         录制目录，相对于 RECORDINGS_ROOT（必填）
--prompt <text>            可选的整体测试说明
--url <url>                旧版录制缺少 targetUrl 时使用
--recordings-root <path>   覆盖 RECORDINGS_ROOT
--headless                 使用无界面浏览器
--help                     显示帮助
```

执行完成后会输出 Run ID、PASS/FAIL、Todo 结果和截图目录。退出码为 `0=PASS`、`1=FAIL`、`2=参数或执行错误`。

## API

健康检查：

```bash
curl http://localhost:3000/health
```

使用录制目录调用 Agent（`recordingPath` 相对于 `RECORDINGS_ROOT`）：

```bash
curl -X POST http://localhost:3000/agent \
  -H 'content-type: application/json' \
  -d '{"recordingPath":"recordings/2026-07-13T04-12-07-598Z","prompt":"验证登录流程"}'
```

`prompt` 可选。新版录制会从 `steps.json` 读取 `targetUrl` 和 viewport。旧版数组格式需要额外提供 URL：

```json
{
  "recordingPath": "2026-07-13T04-12-07-598Z",
  "readyToTestURL": "https://github.com/M31ancholy/regression-test-agent"
}
```

也可继续直接传入 `steps`。此时每个 `screenshotPath` 同样相对于 `RECORDINGS_ROOT`，URL 未传时默认为 `http://localhost:5173`：

```json
{
  "steps": [
    {
      "desc": "点击登录按钮",
      "screenshotPath": "recordings/login/screenshots/001.png"
    }
  ]
}
```

响应示例：

```json
{
  "runId": "d9eec188-ef1f-4f12-a29d-319e56967f07",
  "steps": 5,
  "result": {
    "status": "PASS",
    "summary": "登录按钮点击后成功进入控制台",
    "evidence": [
      "点击前截图中存在登录按钮",
      "点击后截图显示控制台页面"
    ]
  },
  "todos": [
    {
      "index": 0,
      "desc": "点击登录按钮",
      "referenceScreenshotPath": "recordings/login-button.png",
      "status": "passed",
      "summary": "登录按钮点击成功"
    }
  ]
}
```

录制路径越界、`steps.json` 无效或参考图缺失时返回 HTTP 400，且不启动浏览器。正常完成的测试只会返回 `PASS` 或 `FAIL`。主页无法访问、模型调用失败或无法生成合法结构化结论时，接口返回非 2xx 执行错误，而不是测试 `FAIL`。

## 代码结构

- `src/agents/check-agent.ts`：Agent 配置、instructions 和循环停止条件
- `src/agents/tools/`：每个 Playwright 工具独立一个文件，`index.ts` 负责组装
- `src/common/recording-loader.ts`：录制文档解析、截图预检和路径边界校验
- `src/browser.ts`：Chromium 浏览器生命周期管理
- `src/api.ts`：Fastify 路由、请求级浏览器上下文和错误处理
- `src/server.ts`：服务启动入口

截图保存在 `artifacts/<runId>/`。每次请求结束后会关闭对应的浏览器上下文，不会跨请求共享 Cookie 或页面状态。
