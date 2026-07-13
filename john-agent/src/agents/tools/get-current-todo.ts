import { tool } from 'ai';
import { z } from 'zod';
import type { TodoTestItem } from '../../common/types.js';

export function createGetCurrentTodoTool(
  todos: TodoTestItem[],
  referenceScreenshots: ReadonlyMap<number, Uint8Array>,
) {
  return tool({
    description: '读取当前 running 测试步骤的描述和录制参考图。每个步骤开始时必须先调用。',
    inputSchema: z.object({}),
    execute: async () => {
      const currentTodo = todos.find(todo => todo.status === 'running');
      if (!currentTodo) {
        return {
          success: false as const,
          error: '当前没有 running 状态的 todo，流程可能已经结束',
        };
      }

      const image = referenceScreenshots.get(currentTodo.index);
      if (!image) {
        return {
          success: false as const,
          error: `找不到 index=${currentTodo.index} 的录制参考图`,
        };
      }

      return {
        success: true as const,
        index: currentTodo.index,
        desc: currentTodo.desc,
        referenceScreenshotPath: currentTodo.referenceScreenshotPath,
        image,
      };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) {
        return {
          type: 'text',
          value: output.error,
        };
      }

      return {
        type: 'content',
        value: [
          {
            type: 'text',
            text: `当前 todo index=${output.index}：${output.desc}\n下图是该操作完成后的录制参考状态。`,
          },
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data', data: output.image },
            filename: `reference-${output.index}.png`,
          },
        ],
      };
    },
  });
}
