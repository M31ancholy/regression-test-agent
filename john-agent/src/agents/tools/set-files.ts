import { tool } from 'ai';
import type { ElementHandle, Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';
import { fixtureFilenameSchema, resolveFixtureFiles } from './file-fixtures.js';

export function createSetFilesTool(page: Page) {
  return tool({
    description: [
      '根据截图坐标向 input[type=file] 选择测试文件。',
      '文件名来自录制步骤，实际文件必须预先放在 FILE_FIXTURES_ROOT 中。',
    ].join(''),
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('文件输入框或其 label 的横坐标'),
      y: z.number().int().nonnegative().describe('文件输入框或其 label 的纵坐标'),
      filenames: z.array(fixtureFilenameSchema).min(1).max(10).describe('要选择的文件名'),
    }),
    execute: async ({ x, y, filenames }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;

      try {
        const files = await resolveFixtureFiles(filenames);
        const handle = await page.evaluateHandle(({ x: pointX, y: pointY }) => {
          const hit = document.elementFromPoint(pointX, pointY);
          if (hit instanceof HTMLInputElement && hit.type === 'file') return hit;
          const label = hit instanceof HTMLLabelElement ? hit : hit?.closest('label');
          if (label?.control instanceof HTMLInputElement && label.control.type === 'file') return label.control;
          const nested = label?.querySelector('input[type=file]');
          return nested instanceof HTMLInputElement ? nested : null;
        }, { x, y });
        const element = handle.asElement() as ElementHandle<HTMLInputElement> | null;
        if (!element) {
          await handle.dispose();
          return { success: false, error: '该坐标没有 input[type=file]' };
        }
        try {
          await element.setInputFiles(files.map(file => file.path));
        } finally {
          await handle.dispose();
        }
        await page.waitForTimeout(500);
        return { success: true, filenames: files.map(file => file.name) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
}
