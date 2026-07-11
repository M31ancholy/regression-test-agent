import { tool } from 'ai';
import type { Page } from 'playwright';
import { z } from 'zod';
import { summarizePage } from './page-summary.js';

export function createInspectPageTool(page: Page) {
  return tool({
    description: '读取当前页面的 URL、标题、可见文本和可交互元素。操作页面前应先调用此工具。',
    inputSchema: z.object({}),
    execute: async () => summarizePage(page),
  });
}
