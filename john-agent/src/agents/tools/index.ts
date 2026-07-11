import type { Page } from 'playwright';
import { createClickTool } from './click.js';
import { createFillTool } from './fill.js';
import { createInspectPageTool } from './inspect-page.js';
import { createScreenshotTool } from './screenshot.js';
import { createWaitTool } from './wait.js';

export function createBrowserTools(page: Page, runId: string) {
  return {
    inspectPage: createInspectPageTool(page),
    click: createClickTool(page),
    fill: createFillTool(page),
    wait: createWaitTool(page),
    screenshot: createScreenshotTool(page, runId),
  };
}
