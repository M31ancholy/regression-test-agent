import type { Page } from 'playwright';
import { createClickTool } from './click.js';
import { createFillTool } from './fill.js';
import { createScreenshotTool } from './screenshot.js';

// 工具创建汇总区域
export function createBrowserTools(page: Page, runId: string) {
  return {
    screenshot: createScreenshotTool(page, runId),
    click: createClickTool(page),
    fill: createFillTool(page),
  };
}
