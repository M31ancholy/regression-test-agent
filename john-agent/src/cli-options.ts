import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import type { TodoTestItem } from './common/types.js';

export type CliOptions =
  | { help: true }
  | {
      help: false;
      recordingPath: string;
      prompt?: string;
      readyToTestURL?: string;
      recordingsRoot?: string;
      headless: boolean;
    };

export type CliWorkflowResult = {
  runId: string;
  steps: number;
  result: {
    status: 'PASS' | 'FAIL';
    summary: string;
  };
  todos: TodoTestItem[];
};

export class CliUsageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CliUsageError';
  }
}

export const CLI_HELP = `
用法:
  npm run agent -- --recording <录制目录> [选项]

选项:
  --recording <path>         录制目录，相对于 RECORDINGS_ROOT（必填）
  --prompt <text>            可选的整体测试说明
  --url <url>                旧版录制缺少 targetUrl 时使用
  --recordings-root <path>   覆盖 RECORDINGS_ROOT
  --headless                 使用无界面浏览器（默认显示窗口）
  --help                     显示帮助

示例:
  npm run agent -- --recording 2026-07-13T08-03-36-919Z --prompt "验证录制流程"
`.trim();

const CLI_ARGUMENT_OPTIONS = {
  recording: { type: 'string' },
  prompt: { type: 'string' },
  url: { type: 'string' },
  'recordings-root': { type: 'string' },
  headless: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

type ParsedCliValues = {
  recording?: string;
  prompt?: string;
  url?: string;
  'recordings-root'?: string;
  headless?: boolean;
  help?: boolean;
};

export function parseCliOptions(argv: string[]): CliOptions {
  let values: ParsedCliValues;
  try {
    ({ values } = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: CLI_ARGUMENT_OPTIONS,
    }));
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : '无法解析 CLI 参数', { cause: error });
  }

  if (values.help) return { help: true };

  const recordingPath = nonEmpty(values.recording, '--recording 是必填参数');
  return {
    help: false,
    recordingPath,
    prompt: optionalNonEmpty(values.prompt, '--prompt 不能是空字符串'),
    readyToTestURL: optionalNonEmpty(values.url, '--url 不能是空字符串'),
    recordingsRoot: optionalNonEmpty(values['recordings-root'], '--recordings-root 不能是空字符串'),
    headless: values.headless ?? false,
  };
}

export function formatCliSummary(result: CliWorkflowResult): string {
  const todoLines = result.todos.map(todo => {
    const summary = todo.summary ? ` — ${todo.summary}` : '';
    return `  [${todo.status}] #${todo.index} ${todo.desc}${summary}`;
  });

  return [
    '',
    '回归测试完成',
    `Run ID: ${result.runId}`,
    `Status: ${result.result.status}`,
    `Summary: ${result.result.summary}`,
    `Agent steps: ${result.steps}`,
    'Todos:',
    ...todoLines,
    `Screenshots: ${resolve('artifacts', result.runId)}`,
  ].join('\n');
}

export function exitCodeForStatus(status: 'PASS' | 'FAIL'): 0 | 1 {
  return status === 'PASS' ? 0 : 1;
}

function nonEmpty(value: string | undefined, errorMessage: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new CliUsageError(errorMessage);
  return normalized;
}

function optionalNonEmpty(value: string | undefined, errorMessage: string): string | undefined {
  if (value === undefined) return undefined;
  return nonEmpty(value, errorMessage);
}
