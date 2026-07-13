import 'dotenv/config';
import { BrowserManager } from './browser.js';
import { loadRecordingDirectory, RecordingValidationError } from './common/recording-loader.js';
import { startWorkFlow, WorkFlowNavigationError } from './modules/john-work/workflow.js';
import {
  CLI_HELP,
  CliUsageError,
  exitCodeForStatus,
  formatCliSummary,
  parseCliOptions,
} from './cli-options.js';

const SIGNAL_EXIT_CODES: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

async function main(): Promise<number> {
  let options;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    printError(error);
    console.error('\n' + CLI_HELP);
    return 2;
  }

  if (options.help) {
    console.log(CLI_HELP);
    return 0;
  }

  const missingEnvironmentVariables = ['LLM_BASE_URL', 'LLM_API_KEY']
    .filter(name => !process.env[name]);
  if (missingEnvironmentVariables.length > 0) {
    console.error(`配置错误：缺少 ${missingEnvironmentVariables.join(', ')}`);
    return 2;
  }

  const browserManager = new BrowserManager({ headless: options.headless });
  let signalExitCode: number | undefined;
  const handleSignal = (signal: NodeJS.Signals) => {
    if (signalExitCode !== undefined) return;
    signalExitCode = SIGNAL_EXIT_CODES[signal] ?? 2;
    console.error(`\n收到 ${signal}，正在关闭浏览器…`);
    void browserManager.close().finally(() => process.exit(signalExitCode));
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  try {
    const recording = await loadRecordingDirectory({
      recordingPath: options.recordingPath,
      readyToTestURL: options.readyToTestURL,
      recordingsRoot: options.recordingsRoot,
    });
    const browser = await browserManager.start();
    const result = await startWorkFlow({
      readyToTestURL: recording.readyToTestURL,
      viewport: recording.viewport,
      steps: recording.steps,
      prompt: options.prompt,
    }, browser);

    if (signalExitCode !== undefined) return signalExitCode;
    console.log(formatCliSummary(result));
    return exitCodeForStatus(result.result.status);
  } catch (error) {
    if (signalExitCode !== undefined) return signalExitCode;
    printError(error);
    return 2;
  } finally {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
    await browserManager.close();
  }
}

function printError(error: unknown): void {
  if (error instanceof CliUsageError) {
    console.error(`参数错误：${error.message}`);
    return;
  }
  if (error instanceof RecordingValidationError) {
    console.error(`录制内容无效：${error.message}`);
    return;
  }
  if (error instanceof WorkFlowNavigationError) {
    console.error(`无法打开待测页面：${error.targetUrl} (runId=${error.runId})`);
    return;
  }
  console.error(`Agent 执行失败：${error instanceof Error ? error.message : String(error)}`);
}

process.exitCode = await main();
