import { tool } from 'ai';
import { z } from 'zod';
import type { TodoTestItem } from '../../common/types.js';

export function createUpdateTodoTool(todos: TodoTestItem[]) {
  return tool({
    description: [
      '提交当前测试步骤的执行结果。',
      '只能更新当前 status 为 running 的步骤；passed 后会自动开始下一步，failed 后会终止 todo 流程。',
    ].join(''),
    inputSchema: z.object({
      index: z.number().int().nonnegative().describe('当前 running 步骤的 index'),
      status: z.enum(['passed', 'failed']).describe('当前步骤的最终执行结果'),
      summary: z.string().trim().min(1).max(2_000).describe('基于实际页面结果给出的简短总结'),
    }),
    execute: async ({ index, status, summary }) => {
      const currentPosition = todos.findIndex(todo => todo.status === 'running');
      if (currentPosition === -1) {
        return {
          success: false,
          error: '当前没有 running 状态的 todo，流程可能已经结束或尚未开始',
        };
      }

      const currentTodo = todos[currentPosition];
      if (currentTodo.index !== index) {
        return {
          success: false,
          error: `当前只能更新 index=${currentTodo.index} 的 running todo，不能更新 index=${index}`,
          currentTodo,
        };
      }

      currentTodo.status = status;
      currentTodo.summary = summary;

      let nextTodo: TodoTestItem | undefined;
      if (status === 'passed') {
        nextTodo = todos[currentPosition + 1];
        if (nextTodo?.status === 'pending') {
          nextTodo.status = 'running';
        } else {
          nextTodo = undefined;
        }
      }

      return {
        success: true,
        updatedTodo: currentTodo,
        nextTodo: nextTodo ?? null,
        terminal: status === 'failed' || nextTodo === undefined,
      };
    },
  });
}
