import { openai } from '@ai-sdk/openai';
import { stepCountIs, ToolLoopAgent } from 'ai';
import type { Page } from 'playwright';
import { createBrowserTools } from './tools/index.js';

export function createCheckAgent(page: Page, runId: string) {
  return new ToolLoopAgent({
    model: openai('gpt-4.1-mini'),
    instructions: [
      '你是一个自动化回归测试 Agent，负责在已经打开的网页中完成用户指定的测试目标。',
      '执行操作前必须先调用 inspectPage 获取当前页面状态。',
      '点击或输入后要再次检查页面。',
      '完成后简洁总结执行过的操作、观察结果以及是否达到测试目标。',
    ].join('\n'),
    tools: createBrowserTools(page, runId),
    stopWhen: stepCountIs(10),
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls.length > 0) {
        console.log(`[${runId}] tool calls:`, toolCalls.map(call => call.toolName).join(', '));
      }
    },
  });
}
