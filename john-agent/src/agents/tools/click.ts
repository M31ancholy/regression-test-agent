import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createClickTool(page: Page) {
  return tool({
    description: '根据页面截图中的像素坐标点击页面。坐标原点位于截图左上角。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('相对于 viewport 左侧的横坐标，单位为像素'),
      y: z.number().int().nonnegative().describe('相对于 viewport 顶部的纵坐标，单位为像素'),
    }),
    execute: async ({ x, y }) => {
      const viewport = page.viewportSize();
      if (!viewport) {
        return { success: false, error: '当前页面没有可用的 viewport' };
      }
      if (x >= viewport.width || y >= viewport.height) {
        return {
          success: false,
          error: `坐标 (${x}, ${y}) 超出 viewport ${viewport.width}x${viewport.height}`,
        };
      }

      await page.mouse.click(x, y);
      await page.waitForTimeout(300);
      return { success: true, x, y, url: page.url(), viewport };
    },
  });
}
