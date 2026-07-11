# Vercel AI SDK + Fastify Tool Loop Agent

一个最小的 HTTP Agent 服务。`ToolLoopAgent` 会根据用户目标循环调用待办工具，直到给出最终答案或达到最多 10 步。

## 运行

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY
npm run dev
```

服务默认监听 `http://localhost:3000`。

## API

健康检查：

```bash
curl http://localhost:3000/health
```

调用 Agent：

```bash
curl -X POST http://localhost:3000/checkAgent \
  -H 'content-type: application/json' \
  -d '{"prompt":"帮我把上线一个小网站拆成 3 条待办"}'
```

响应示例：

```json
{
  "text": "已经为你创建了 3 条待办……",
  "steps": 5
}
```

## 代码结构

- `src/check-agent.ts`：Agent、工具以及循环停止条件
- `src/server.ts`：Fastify 路由、参数校验和错误处理
- `src/index.ts`：服务启动入口

待办数据只保存在内存中，进程退出后会清空。
