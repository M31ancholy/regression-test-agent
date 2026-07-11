import Fastify from 'fastify';
import { z } from 'zod';
import { agent } from './agent.js';

const agentRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
});

export function buildServer() {
  const app = Fastify({ logger: true });

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

    const result = await agent.generate({ prompt: parsed.data.prompt });
    return { text: result.text, steps: result.steps.length };
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({ error: 'Agent 执行失败' });
  });

  return app;
}
