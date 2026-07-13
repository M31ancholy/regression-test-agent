# Vercel AI SDK + Fastify Tool Loop Agent

一个使用 Playwright 操作网页的自动化回归测试 Agent。它可以读取 `util-record-steps` 产生的录制目录，按顺序回放 Todo，并对照每一步的录制参考图验证实际页面。

## 运行

```bash
npm install
npx playwright install chromium
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY
# RECORDINGS_ROOT 默认指向相邻的 ../util-record-steps
npm run dev
```

服务默认监听 `http://localhost:3000`。

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
