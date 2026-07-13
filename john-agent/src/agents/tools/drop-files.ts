import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { validatePoint } from './coordinates.js';
import { fixtureFilenameSchema, resolveFixtureFiles } from './file-fixtures.js';

export function createDropFilesTool(page: Page) {
  return tool({
    description: [
      '根据截图坐标将测试文件拖放到页面区域。',
      '文件名来自录制步骤，实际文件必须预先放在 FILE_FIXTURES_ROOT 中。',
    ].join(''),
    inputSchema: z.object({
      x: z.number().int().nonnegative().describe('文件拖放目标横坐标'),
      y: z.number().int().nonnegative().describe('文件拖放目标纵坐标'),
      filenames: z.array(fixtureFilenameSchema).min(1).max(10).describe('要拖放的文件名'),
    }),
    execute: async ({ x, y, filenames }) => {
      const point = validatePoint(page, x, y);
      if (!point.success) return point;

      try {
        const files = await resolveFixtureFiles(filenames);
        const result = await page.evaluate(({ x: pointX, y: pointY, files: encodedFiles }) => {
          const target = document.elementFromPoint(pointX, pointY);
          if (!target) return { success: false as const, error: '该坐标没有可拖放元素' };
          const dataTransfer = new DataTransfer();
          for (const encoded of encodedFiles) {
            const binary = atob(encoded.base64);
            const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
            dataTransfer.items.add(new File([bytes], encoded.name, { type: 'application/octet-stream' }));
          }
          for (const type of ['dragenter', 'dragover', 'drop']) {
            target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
          }
          return { success: true as const };
        }, {
          x,
          y,
          files: files.map(file => ({ name: file.name, base64: file.data.toString('base64') })),
        });
        await page.waitForTimeout(500);
        return { ...result, filenames: files.map(file => file.name) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
}
