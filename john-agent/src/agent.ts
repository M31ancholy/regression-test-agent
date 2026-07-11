import { openai } from '@ai-sdk/openai';
import { stepCountIs, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';

const todos = new Map<number, { id: number; title: string; done: boolean }>();
let nextId = 1;

export const agent = new ToolLoopAgent({
  model: openai('gpt-4.1-mini'),
  instructions: [
    '你是一个简洁的待办事项助手。',
    '用户提出目标后，先拆成明确的待办，再读取列表并总结结果。',
    '需要操作待办时必须调用工具，不要假装已经执行。',
  ].join('\n'),
  tools: {
    addTodo: tool({
      description: '添加一条待办事项',
      inputSchema: z.object({
        title: z.string().min(1).describe('待办事项内容'),
      }),
      execute: async ({ title }) => {
        const todo = { id: nextId++, title, done: false };
        todos.set(todo.id, todo);
        return todo;
      },
    }),
    listTodos: tool({
      description: '读取当前所有待办事项',
      inputSchema: z.object({}),
      execute: async () => Array.from(todos.values()),
    }),
    completeTodo: tool({
      description: '根据 id 完成一条待办事项',
      inputSchema: z.object({
        id: z.number().int().positive().describe('待办事项 id'),
      }),
      execute: async ({ id }) => {
        const todo = todos.get(id);
        if (!todo) return { success: false, error: `todo ${id} 不存在` };
        todo.done = true;
        return { success: true, todo };
      },
    }),
  },
  stopWhen: stepCountIs(10),
  onStepFinish: ({ toolCalls }) => {
    if (toolCalls.length > 0) {
      console.log('tool calls:', toolCalls.map(call => call.toolName).join(', '));
    }
  },
});
