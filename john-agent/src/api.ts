import Fastify from 'fastify';
import { z } from 'zod';
import { BrowserManager } from './browser.js';
import { startWorkFlow, WorkFlowNavigationError } from './modules/john-work/workflow.js';
import { NIL } from 'uuid';
import { OverallStepDesc } from './common/types.js';

const TARGET_URL = 'http://localhost:5173';

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

    const browser = await browserManager.start();

    try {
      // TODO Hack一下
      const steps = {} as OverallStepDesc;

      return await startWorkFlow({
        readyToTestURL: TARGET_URL,
        steps: steps, 
        prompt: parsed.data.prompt,
      }, browser);
    } catch (error) {
      if (error instanceof WorkFlowNavigationError) {
        request.log.warn(
          { err: error.cause, runId: error.runId, targetUrl: error.targetUrl },
          'target page navigation failed',
        );
        return reply.code(502).send({
          error: '无法打开测试主页',
          targetUrl: error.targetUrl,
          runId: error.runId,
        });
      }
      throw error;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({ error: 'Agent 执行失败' });
  });

  return app;
}
