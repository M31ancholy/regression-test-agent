import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';

export function createPressKeyTool(page: Page) {
  return tool({
    description: '根据截图坐标聚焦页面元素，然后按下 Enter 或 Escape。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('目标元素的横坐标'),
      y: z.number().int().nonnegative().describe('目标元素的纵坐标'),
      key: z.enum(['Enter', 'Escape']).describe('要按下的按键'),
    }),
    execute: async ({ x, y, key }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;
      await page.mouse.click(x, y);
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      return { success: true, x, y, key, url: page.url() };
    },
  });
}
