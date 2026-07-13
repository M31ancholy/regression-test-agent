import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';

export function createSelectOptionTool(page: Page) {
  return tool({
    description: '根据截图坐标找到 select，按 option 的 value、label 或显示文本选择。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('select 的横坐标'),
      y: z.number().int().nonnegative().describe('select 的纵坐标'),
      value: z.string().trim().min(1).max(500).describe('录制步骤中的选项值或显示文本'),
    }),
    execute: async ({ x, y, value }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;

      const result = await page.evaluate(({ x: pointX, y: pointY, value: requestedValue }) => {
        const hit = document.elementFromPoint(pointX, pointY);
        const select = hit instanceof HTMLSelectElement ? hit : hit?.closest('select');
        if (!(select instanceof HTMLSelectElement)) {
          return { success: false as const, error: '该坐标没有 select 元素' };
        }
        const normalized = requestedValue.trim();
        const option = [...select.options].find(candidate =>
          candidate.value === normalized ||
          candidate.label.trim() === normalized ||
          candidate.text.trim() === normalized,
        );
        if (!option) {
          return {
            success: false as const,
            error: `找不到选项“${normalized}”`,
            options: [...select.options].map(candidate => ({ value: candidate.value, label: candidate.label })),
          };
        }
        select.value = option.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true as const, value: option.value, label: option.label || option.text };
      }, { x, y, value });

      await page.waitForTimeout(300);
      return result;
    },
  });
}
