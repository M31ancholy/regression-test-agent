import { openai } from '@ai-sdk/openai';
import { stepCountIs, ToolLoopAgent } from 'ai';
import type { Page } from 'playwright';
import { createBrowserTools } from './tools/index.js';

export function createCheckAgent(page: Page, runId: string) {
  return new ToolLoopAgent({
    model: openai('gpt-5.6-sol'),
    instructions: [
      '你是一个自动化回归测试 Agent，负责在已经打开的网页中完成用户指定的测试目标。',
      '你的页面观察来源只有 screenshot 工具返回的图片，不要使用或猜测 DOM selector。',
      '执行操作前必须先调用 screenshot 获取当前页面图片和 viewport 尺寸。',
      '根据截图中的像素坐标调用 click 或 fill；点击或输入后必须再次截图确认页面状态。',
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
