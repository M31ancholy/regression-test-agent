import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';

export function createDragTool(page: Page) {
  return tool({
    description: '根据截图坐标将页面元素从起点拖拽到终点。',
    inputSchema: z.object({
      fromX: z.number().int().nonnegative().describe('拖拽起点横坐标'),
      fromY: z.number().int().nonnegative().describe('拖拽起点纵坐标'),
      toX: z.number().int().nonnegative().describe('放置终点横坐标'),
      toY: z.number().int().nonnegative().describe('放置终点纵坐标'),
    }),
    execute: async ({ fromX, fromY, toX, toY }) => {
      const start = validatePoint(page, fromX, fromY);
      if (!start.success) return start;
      const end = validatePoint(page, toX, toY);
      if (!end.success) return end;

      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      await page.mouse.move(toX, toY, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      return { success: true, from: { x: fromX, y: fromY }, to: { x: toX, y: toY } };
    },
  });
}
