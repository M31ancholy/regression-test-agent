import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createScreenshotTool(page: Page, runId: string) {
  return tool({
    description: '截取当前 viewport，将图片返回给模型，同时保存为回归测试产物。',
    inputSchema: z.object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[a-zA-Z0-9_-]+$/, 'name 只能包含字母、数字、下划线和连字符'),
    }),
    execute: async ({ name }) => {
      const directory = resolve('artifacts', runId);
      await mkdir(directory, { recursive: true });
      const path = resolve(directory, `${name}.png`);
      const image = await page.screenshot({ path });
      return { success: true, path, image, viewport: page.viewportSize(), url: page.url() };
    },
    toModelOutput: ({ output }) => ({
      type: 'content',
      value: [
        {
          type: 'text',
          text: `当前页面截图。viewport=${output.viewport?.width ?? 'unknown'}x${output.viewport?.height ?? 'unknown'}，url=${output.url}`,
        },
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: output.image },
          filename: 'page.png',
        },
      ],
    }),
  });
}
