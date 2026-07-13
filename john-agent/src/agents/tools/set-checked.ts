import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';

export function createSetCheckedTool(page: Page) {
  return tool({
    description: '根据截图坐标将 checkbox 或 radio 设置为指定选中状态，避免重复点击导致反向切换。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('复选框、单选框或其 label 的横坐标'),
      y: z.number().int().nonnegative().describe('复选框、单选框或其 label 的纵坐标'),
      checked: z.boolean().describe('期望的选中状态'),
    }),
    execute: async ({ x, y, checked }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;

      const result = await page.evaluate(({ x: pointX, y: pointY, checked: expected }) => {
        const hit = document.elementFromPoint(pointX, pointY);
        let input = hit instanceof HTMLInputElement ? hit : null;
        if (!input && hit instanceof HTMLLabelElement) {
          input = hit.control instanceof HTMLInputElement ? hit.control : hit.querySelector('input');
        }
        if (!input) {
          const label = hit?.closest('label');
          input = label?.control instanceof HTMLInputElement ? label.control : label?.querySelector('input') ?? null;
        }
        if (!(input instanceof HTMLInputElement) || !['checkbox', 'radio'].includes(input.type)) {
          return { success: false as const, error: '该坐标没有 checkbox 或 radio' };
        }
        if (input.type === 'radio' && !expected && input.checked) {
          return { success: false as const, error: '已选中的 radio 不能通过用户操作直接取消' };
        }
        if (input.checked !== expected) input.click();
        return { success: input.checked === expected, checked: input.checked, type: input.type };
      }, { x, y, checked });

      await page.waitForTimeout(300);
      return result;
    },
  });
}
