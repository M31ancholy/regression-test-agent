import Fastify from 'fastify';
import { z } from 'zod';
import { BrowserManager } from './browser.js';
import { startWorkFlow, WorkFlowNavigationError } from './modules/john-work/workflow.js';
import {
  loadRecordingDirectory,
  prepareInlineSteps,
  RecordingValidationError,
} from './common/recording-loader.js';

const TARGET_URL = 'http://localhost:5173';

export const agentRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000).optional(),
  readyToTestURL: z.string().url().optional(),
  recordingPath: z.string().trim().min(1).max(1_000).optional(),
  steps: z.array(z.object({
    desc: z.string().trim().min(1).max(2_000),
    screenshotPath: z.string().trim().min(1),
  })).min(1).optional(),
}).superRefine((value, context) => {
  if ((value.recordingPath === undefined) === (value.steps === undefined)) {
    context.addIssue({
      code: 'custom',
      message: 'recordingPath 和 steps 必须且只能提供一个',
      path: ['recordingPath'],
    });
  }
});

export function buildServer() {
  const app = Fastify({ logger: true });
  const browserManager = new BrowserManager();

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

    try {
      const preparedRecording = parsed.data.recordingPath !== undefined
        ? await loadRecordingDirectory({
            recordingPath: parsed.data.recordingPath,
            readyToTestURL: parsed.data.readyToTestURL,
          })
        : await prepareInlineSteps({
            steps: parsed.data.steps!,
            readyToTestURL: parsed.data.readyToTestURL ?? TARGET_URL,
          });

      if (!process.env.LLM_API_KEY) {
        return reply.code(503).send({ error: '服务端未配置 LLM_API_KEY' });
      }

      const browser = await browserManager.start();
      return await startWorkFlow({
        readyToTestURL: preparedRecording.readyToTestURL,
        viewport: preparedRecording.viewport,
        steps: preparedRecording.steps,
        prompt: parsed.data.prompt,
      }, browser);
    } catch (error) {
      if (error instanceof RecordingValidationError) {
        request.log.warn({ err: error }, 'recording validation failed');
        return reply.code(400).send({
          error: '录制内容无效',
          details: error.message,
        });
      }
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
