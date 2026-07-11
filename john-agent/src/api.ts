import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createCheckAgent } from './agents/check-agent.js';
import { BrowserManager } from './browser.js';

const TARGET_URL = 'http://localhost:5173';
const NAVIGATION_TIMEOUT_MS = 15_000;

const agentRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
});

export function buildServer() {
  const app = Fastify({ logger: true });
  const browserManager = new BrowserManager();

  app.addHook('onReady', async () => {
    await browserManager.start();
  });

  app.addHook('onClose', async () => {
    await browserManager.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/agent', async (request, reply) => {
    const parsed = agentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: '请求参数错误',
        details: z.flattenError(parsed.error),
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: '服务端未配置 OPENAI_API_KEY' });
    }

    const runId = randomUUID();
    const browser = await browserManager.start();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);

      try {
        await page.goto(TARGET_URL, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT_MS,
        });
      } catch (error) {
        request.log.warn({ err: error, runId, targetUrl: TARGET_URL }, 'target page navigation failed');
        return reply.code(502).send({
          error: '无法打开测试主页',
          targetUrl: TARGET_URL,
          runId,
        });
      }

      const agent = createCheckAgent(page, runId);
      const result = await agent.generate({ prompt: parsed.data.prompt });
      return {
        runId,
        steps: result.steps.length,
        result: result.output,
      };
    } finally {
      await context.close();
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({ error: 'Agent 执行失败' });
  });

  return app;
}
