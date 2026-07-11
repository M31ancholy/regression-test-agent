import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createFillTool(page: Page) {
  return tool({
    description: '清空并填写一个可编辑的 input 或 textarea。',
    inputSchema: z.object({
      selector: z.string().trim().min(1).max(500).describe('Playwright selector'),
      value: z.string().max(10_000).describe('要填写的内容'),
    }),
    execute: async ({ selector, value }) => {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count !== 1) {
        return { success: false, error: `selector 匹配到 ${count} 个元素，必须唯一匹配` };
      }
      if (!(await locator.isVisible())) {
        return { success: false, error: 'selector 匹配的元素不可见' };
      }
      await locator.fill(value);
      const isPassword = (await locator.getAttribute('type')) === 'password';
      return {
        success: true,
        selector,
        value: isPassword ? '[REDACTED]' : value,
      };
    },
  });
}
