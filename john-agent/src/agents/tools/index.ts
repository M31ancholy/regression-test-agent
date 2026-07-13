import type { Page } from 'playwright';
import { createClickTool } from './click.js';
import { createFillTool } from './fill.js';
import { createScreenshotTool } from './screenshot.js';
import { createUpdateTodoTool } from './update-todo.js';
import { createGetCurrentTodoTool } from './get-current-todo.js';
import { createPressKeyTool } from './press-key.js';
import { createScrollPageTool } from './scroll-page.js';
import { createSelectOptionTool } from './select-option.js';
import { createSetCheckedTool } from './set-checked.js';
import { createSubmitFormTool } from './submit-form.js';
import { createDragTool } from './drag.js';
import { createSetFilesTool } from './set-files.js';
import { createDropFilesTool } from './drop-files.js';
import type { TodoTestItem } from '../../common/types.js';

// 工具创建汇总区域
export function createBrowserTools(
  page: Page,
  runId: string,
  todos: TodoTestItem[],
  referenceScreenshots: ReadonlyMap<number, Uint8Array>,
) {
  return {
    screenshot: createScreenshotTool(page, runId),
    click: createClickTool(page),
    fill: createFillTool(page),
    selectOption: createSelectOptionTool(page),
    setChecked: createSetCheckedTool(page),
    pressKey: createPressKeyTool(page),
    submitForm: createSubmitFormTool(page),
    scrollPage: createScrollPageTool(page),
    drag: createDragTool(page),
    setFiles: createSetFilesTool(page),
    dropFiles: createDropFilesTool(page),
    getCurrentTodo: createGetCurrentTodoTool(todos, referenceScreenshots),
    updateTodo: createUpdateTodoTool(todos),
  };
}
