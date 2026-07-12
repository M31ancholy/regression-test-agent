import type { Browser } from 'playwright';
import { createCheckAgent } from '../../agents/check-agent.js';
import { createRunId, type johnAgentOptions } from '../../common/agent-config.js';
import type { workFlowOptions } from '../../common/workflow-config.js';

const NAVIGATION_TIMEOUT_MS = 15_000;

export class WorkFlowNavigationError extends Error {
  constructor(
    public readonly runId: string,
    public readonly targetUrl: string,
    options?: ErrorOptions,
  ) {
    super(`无法打开测试主页: ${targetUrl}`, options);
    this.name = 'WorkFlowNavigationError';
  }
}

// 一次待启动的测试叫做 workflow。
// Agent 必须从这个函数启动，以确保每次运行都有独立的浏览器上下文和 runId。
export async function startWorkFlow(option: workFlowOptions, browser: Browser) {
  const runId = createRunId();
  const context = await browser.newContext();

  try {
    // 准备playwright page 对象
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    try {
      await page.goto(option.readyToTestURL, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      throw new WorkFlowNavigationError(runId, option.readyToTestURL, { cause: error });
    }



    const agentOpt: johnAgentOptions = {
      readyToTestURL: option.readyToTestURL,
      page,
      runId,
    };
    const agent = createCheckAgent(agentOpt);
    const result = await agent.generate({ prompt: option.prompt });

    return {
      runId,
      steps: result.steps.length,
      result: result.output,
    };
  } finally {
    await context.close();
  }
}
