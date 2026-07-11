import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { summarizePage, waitForPageToSettle } from './page-summary.js';

export function createClickTool(page: Page) {
  return tool({
    description: '使用 Playwright selector 点击一个可见且唯一匹配的页面元素。',
    inputSchema: z.object({
      selector: z.string().trim().min(1).max(500).describe('Playwright selector，例如 #submit 或 text=登录'),
    }),
    execute: async ({ selector }) => {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count !== 1) {
        return { success: false, error: `selector 匹配到 ${count} 个元素，必须唯一匹配` };
      }
      if (!(await locator.isVisible())) {
        return { success: false, error: 'selector 匹配的元素不可见' };
      }
      await locator.click();
      await waitForPageToSettle(page);
      return { success: true, page: await summarizePage(page) };
    },
  });
}
