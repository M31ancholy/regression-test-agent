import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createScrollPageTool(page: Page) {
  return tool({
    description: '将页面窗口滚动到录制步骤指定的绝对位置。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('目标 window.scrollX'),
      y: z.number().int().nonnegative().describe('目标 window.scrollY'),
    }),
    execute: async ({ x, y }) => {
      const position = await page.evaluate(({ x: targetX, y: targetY }) => {
        window.scrollTo(targetX, targetY);
        return { x: window.scrollX, y: window.scrollY };
      }, { x, y });
      await page.waitForTimeout(500);
      return { success: true, requested: { x, y }, actual: position, url: page.url() };
    },
  });
}
