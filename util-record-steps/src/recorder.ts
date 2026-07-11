import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { BrowserOperation, OverallStepDesc } from './types.js';

const SETTLE_TIME_MS = 350;

export type RecorderOptions = {
  url: string;
  outputDirectory?: string;
  headless?: boolean;
};

export async function recordSteps(options: RecorderOptions): Promise<OverallStepDesc> {
  const outputDirectory = resolve(options.outputDirectory ?? 'recordings', createRunId());
  const screenshotDirectory = resolve(outputDirectory, 'screenshots');
  await mkdir(screenshotDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: options.headless ?? false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const steps: OverallStepDesc = [];
  let operationQueue = Promise.resolve();
  let stepNumber = 0;

  const save = async (page: Page, desc: string) => {
    stepNumber += 1;
    const filename = `${String(stepNumber).padStart(3, '0')}.png`;
    const absoluteScreenshotPath = resolve(screenshotDirectory, filename);

    await page.waitForTimeout(SETTLE_TIME_MS).catch(() => undefined);
    await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
    await page.screenshot({ path: absoluteScreenshotPath });

    steps.push({
      desc,
      screenshotPath: relative(outputDirectory, absoluteScreenshotPath),
    });
    await writeSteps(outputDirectory, steps);
    console.log(`[${stepNumber}] ${desc} -> ${absoluteScreenshotPath}`);
  };

  await installOperationBridge(context, (sourcePage, operation) => {
    operationQueue = operationQueue
      .then(async () => {
        const page = sourcePage.isClosed() ? latestOpenPage(context) : sourcePage;
        if (page) await save(page, describeOperation(operation));
      })
      .catch(error => console.error('记录操作失败:', error));
  });

  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await save(page, `打开网页 ${page.url()}`);

  console.log(`\n记录已开始：${options.url}`);
  console.log('请在浏览器中操作。关闭浏览器窗口或按 Ctrl+C 后生成最终 steps.json。\n');

  await waitUntilStopped(context, page);
  await operationQueue;
  await writeSteps(outputDirectory, steps);
  await browser.close().catch(() => undefined);
  console.log(`记录完成：${resolve(outputDirectory, 'steps.json')}`);
  return steps;
}

async function installOperationBridge(
  context: BrowserContext,
  onOperation: (page: Page, operation: BrowserOperation) => void,
) {
  await context.exposeBinding('__recordBrowserOperation', ({ page }, operation: BrowserOperation) => {
    onOperation(page, operation);
  });

  await context.addInitScript(() => {
    type RecorderWindow = Window & {
      __recordBrowserOperation: (operation: BrowserOperation) => Promise<void>;
    };
    const recorderWindow = window as unknown as RecorderWindow;

    const identify = (element: Element | null): string => {
      if (!element) return '未知元素';
      const htmlElement = element as HTMLElement;
      const text = htmlElement.innerText?.trim().replace(/\s+/g, ' ').slice(0, 80);
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') ||
        element.getAttribute('name') ||
        element.getAttribute('title') ||
        text;
      return label ? `${element.tagName.toLowerCase()}「${label}」` : element.tagName.toLowerCase();
    };

    document.addEventListener(
      'click',
      event => {
        void recorderWindow.__recordBrowserOperation({
          action: 'click',
          target: identify(event.target as Element),
        });
      },
      true,
    );

    document.addEventListener(
      'change',
      event => {
        const element = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const value = element.type === 'password' ? '[已隐藏]' : element.value.slice(0, 200);
        void recorderWindow.__recordBrowserOperation({
          action: 'change',
          target: identify(element),
          value,
        });
      },
      true,
    );

    document.addEventListener(
      'keydown',
      event => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        void recorderWindow.__recordBrowserOperation({
          action: 'keydown',
          target: identify(event.target as Element),
          key: event.key,
        });
      },
      true,
    );
  });
}

function describeOperation(operation: BrowserOperation): string {
  if (operation.action === 'click') return `点击 ${operation.target}`;
  if (operation.action === 'change') return `在 ${operation.target} 中输入/选择「${operation.value ?? ''}」`;
  return `在 ${operation.target} 按下 ${operation.key}`;
}

function latestOpenPage(context: BrowserContext): Page | undefined {
  return [...context.pages()].reverse().find(page => !page.isClosed());
}

async function writeSteps(outputDirectory: string, steps: OverallStepDesc) {
  await writeFile(resolve(outputDirectory, 'steps.json'), `${JSON.stringify(steps, null, 2)}\n`, 'utf8');
}

function createRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function waitUntilStopped(context: BrowserContext, initialPage: Page): Promise<void> {
  return new Promise(resolvePromise => {
    const stop = () => resolvePromise();
    context.on('close', stop);
    initialPage.on('close', stop);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
