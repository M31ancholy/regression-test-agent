import type { Page } from 'playwright';
import { createClickTool } from './click.js';
import { createFillTool } from './fill.js';
import { createScreenshotTool } from './screenshot.js';
import { createUpdateTodoTool } from './update-todo.js';
import type { TodoTestItem } from '../../common/types.js';

// 工具创建汇总区域
 export function createBrowserTools(
    page: Page,
    runId: string,
    todos?: TodoTestItem[],
  ) {
    const browserTools = {
      screenshot: createScreenshotTool(page, runId),
      click: createClickTool(page),
      fill: createFillTool(page),
    };

    if (!todos?.length) {
      return browserTools;
    }

    return {
      ...browserTools,
      updateTodo: createUpdateTodoTool(todos),
    };
  }
