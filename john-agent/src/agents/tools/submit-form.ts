import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';

export function createSubmitFormTool(page: Page) {
  return tool({
    description: '根据截图坐标找到 form 或表单内元素，执行真实的 requestSubmit。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('form 或表单内元素的横坐标'),
      y: z.number().int().nonnegative().describe('form 或表单内元素的纵坐标'),
    }),
    execute: async ({ x, y }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;

      const result = await page.evaluate(({ x: pointX, y: pointY }) => {
        const hit = document.elementFromPoint(pointX, pointY);
        const form = hit instanceof HTMLFormElement ? hit : hit?.closest('form');
        if (!(form instanceof HTMLFormElement)) {
          return { success: false as const, error: '该坐标不在 form 内' };
        }
        form.requestSubmit();
        return { success: true as const };
      }, { x, y });

      await page.waitForTimeout(500);
      return { ...result, url: page.url() };
    },
  });
}
