import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';

export function createFillTool(page: Page) {
  return tool({
    description: '根据截图坐标点击输入区域，使用键盘全选原内容并输入新内容。',
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('输入区域相对于 viewport 左侧的横坐标'),
      y: z.number().int().nonnegative().describe('输入区域相对于 viewport 顶部的纵坐标'),
      value: z.string().max(10_000).describe('要填写的内容'),
    }),
    execute: async ({ x, y, value }) => {
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
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await page.keyboard.type(value);
      return { success: true, x, y, charactersEntered: value.length };
    },
  });
}
