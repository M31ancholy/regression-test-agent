import { openai } from '@ai-sdk/openai';
import { Output, stepCountIs, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { createBrowserTools } from './tools/index.js';
import type { johnAgentOptions } from '../common/agent-config.js';

const testResultSchema = z.object({
  status: z.enum(['PASS', 'FAIL']).describe('测试是否满足用户 prompt 中描述的预期'),
  summary: z.string().min(1).describe('测试结论的简洁说明'),
  evidence: z.array(z.string().min(1)).min(1).describe('从截图和实际操作中观察到的证据'),
});

export function createCheckAgent(agentOpt: johnAgentOptions) {
  return new ToolLoopAgent({
    model: openai('gpt-5.6-sol'),
    instructions: [
      '你是一个自动化回归测试 Agent，负责在已经打开的网页中完成用户指定的测试目标。',
      '你的页面观察来源只有 screenshot 工具返回的图片，不要使用或猜测 DOM selector。',
      '执行操作前必须先调用 screenshot 获取当前页面图片和 viewport 尺寸。',
      '根据截图中的像素坐标调用 click 或 fill；点击或输入后必须再次截图确认页面状态。',
      '最终一次操作后必须再次调用 screenshot，并只根据截图中的真实视觉证据判断结果。',
      '只有截图明确证明用户 prompt 中的预期成立时才能返回 PASS。',
      '预期未满足、出现错误页面或实际行为与预期不符时返回 FAIL。',
      'click 或 fill 工具执行成功只表示操作已发送，不能单独作为 PASS 的依据。',
      `你必须严格按 index 顺序执行以下 todo：${JSON.stringify(agentOpt.todos)}`,
      '开始每个 running todo 时，必须先调用 getCurrentTodo 查看该步骤描述和操作完成后的录制参考图。',
      '录制参考图只表示预期的步骤结果；必须再用 screenshot 观察当前实际页面。',
      '每个 running todo 完成验证后，必须调用 updateTodo 标记为 passed 或 failed，然后才能继续。',
      'updateTodo 返回 success=false 时应根据 error 修正调用，不能跳过当前 todo。',
      '最终必须返回符合指定 schema 的测试结论、简洁总结和至少一条证据。',
    ].join('\n'),
    tools: createBrowserTools(
      agentOpt.page,
      agentOpt.runId,
      agentOpt.todos,
      agentOpt.referenceScreenshots,
    ),
    output: Output.object({
      schema: testResultSchema,
      name: 'regression_test_result',
      description: '自动化回归测试的最终 PASS 或 FAIL 结论及其视觉证据',
    }),
    stopWhen: stepCountIs(20),
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls.length > 0) {
        console.log(`[${agentOpt.runId}] tool calls:`, toolCalls.map(call => call.toolName).join(', '));
      }
    },
  });
}
