import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createScreenshotTool(page: Page, runId: string) {
  return tool({
    description: '保存当前页面的全页截图作为回归测试产物。',
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
      await page.screenshot({ path, fullPage: true });
      return { success: true, path };
    },
  });
}
