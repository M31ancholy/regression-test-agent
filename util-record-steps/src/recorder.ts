import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { BrowserOperation, OverallStepDesc } from './types.js';

const SETTLE_TIME_MS = 350;
const BRIDGE_READY_TIMEOUT_MS = 5_000;

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
  let acceptingOperations = true;
  let bridgeReadyResolve: (() => void) | undefined;
  const bridgeReady = new Promise<void>(resolvePromise => {
    bridgeReadyResolve = resolvePromise;
  });

  context.on('page', observedPage => {
    observedPage.on('console', message => {
      if (message.type() === 'error' && message.text().startsWith('[record-steps]')) {
        console.error(`页面录制错误: ${message.text()}`);
      }
    });
    observedPage.on('pageerror', error => {
      console.error('页面脚本异常（可能影响录制）:', error.message);
    });
  });

  const save = async (sourcePage: Page, desc: string) => {
    await sourcePage.waitForTimeout(SETTLE_TIME_MS).catch(() => undefined);
    const page = sourcePage.isClosed() ? latestOpenPage(context) : latestRelevantPage(context, sourcePage);
    if (!page) throw new Error('没有可截图的浏览器页面');

    await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
    stepNumber += 1;
    const filename = `${String(stepNumber).padStart(3, '0')}.png`;
    const absoluteScreenshotPath = resolve(screenshotDirectory, filename);

    try {
      await page.screenshot({ path: absoluteScreenshotPath });
    } catch (error) {
      stepNumber -= 1;
      throw error;
    }

    steps.push({
      desc,
      screenshotPath: relative(outputDirectory, absoluteScreenshotPath),
    });
    await writeSteps(outputDirectory, steps);
    console.log(`[${stepNumber}] ${desc} -> ${absoluteScreenshotPath}`);
  };

  await installOperationBridge(context, (sourcePage, operation) => {
    if (operation.action === 'ready') {
      bridgeReadyResolve?.();
      bridgeReadyResolve = undefined;
      return;
    }
    if (!acceptingOperations) return;

    operationQueue = operationQueue
      .then(() => save(sourcePage, describeOperation(operation)))
      .catch(error => console.error(`记录“${describeOperation(operation)}”失败:`, error));
  });

  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });

  await Promise.race([
    bridgeReady,
    page.waitForTimeout(BRIDGE_READY_TIMEOUT_MS).then(() => {
      throw new Error('页面录制桥接初始化超时，请检查页面脚本或终端错误信息');
    }),
  ]);
  await save(page, `打开网页 ${page.url()}`);

  console.log(`\n记录已开始：${options.url}`);
  console.log('请在浏览器中操作。关闭初始浏览器窗口或按 Ctrl+C 后结束记录。\n');

  await waitUntilStopped(context, page);
  await flushPendingPageOperations(context);
  acceptingOperations = false;
  await operationQueue;
  await writeSteps(outputDirectory, steps);
  await browser.close().catch(() => undefined);
  console.log(`记录完成：${resolve(outputDirectory, 'steps.json')}`);
  return steps;
}

export async function installOperationBridge(
  context: BrowserContext,
  onOperation: (page: Page, operation: BrowserOperation) => void,
) {
  await context.exposeBinding('__recordBrowserOperation', ({ page }, operation: BrowserOperation) => {
    onOperation(page, operation);
  });

  // tsx/esbuild adds calls to its __name helper when this function is serialized.
  // Playwright executes it in the page, where that build-time helper does not exist.
  await context.addInitScript({
    content: 'globalThis.__name ??= (target) => target;',
  });

  await context.addInitScript(() => {
    type RecorderWindow = Window & {
      __recordBrowserOperation?: (operation: BrowserOperation) => Promise<void>;
      __recordStepsInstalled?: boolean;
    };
    const recorderWindow = window as unknown as RecorderWindow;
    if (recorderWindow.__recordStepsInstalled) return;
    recorderWindow.__recordStepsInstalled = true;

    const report = (operation: BrowserOperation) => {
      const bridge = recorderWindow.__recordBrowserOperation;
      if (!bridge) {
        console.error('[record-steps] 页面桥接不存在，操作未被记录', operation);
        return;
      }
      void bridge(operation).catch(error => {
        console.error('[record-steps] 操作发送失败', error);
      });
    };

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

    const hasDedicatedEvent = (element: Element | null): boolean => {
      if (!element) return false;
      const control = element.closest('input, select, option, button');
      if (control instanceof HTMLSelectElement || control instanceof HTMLOptionElement) return true;
      if (control instanceof HTMLInputElement) {
        return ['checkbox', 'radio', 'file'].includes(control.type) || (control.type === 'submit' && control.form !== null);
      }
      return control instanceof HTMLButtonElement && control.type === 'submit' && control.form !== null;
    };

    const inputTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
    const reportValue = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
      const existingTimer = inputTimers.get(element);
      if (existingTimer) clearTimeout(existingTimer);
      inputTimers.delete(element);

      let value: string;
      if (element instanceof HTMLInputElement && element.type === 'password') {
        value = '[已隐藏]';
      } else if (element instanceof HTMLInputElement && element.type === 'file') {
        value = [...(element.files ?? [])].map(file => file.name).join(', ');
      } else if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
        value = element.checked ? '已选中' : '未选中';
      } else {
        value = element.value.slice(0, 200);
      }

      report({ action: 'change', target: identify(element), value });
    };

    document.addEventListener(
      'click',
      event => {
        const element = event.target as Element;
        if (!hasDedicatedEvent(element)) report({ action: 'click', target: identify(element) });
      },
      true,
    );

    document.addEventListener(
      'input',
      event => {
        const element = event.target;
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
        const existingTimer = inputTimers.get(element);
        if (existingTimer) clearTimeout(existingTimer);
        inputTimers.set(element, setTimeout(() => reportValue(element), 500));
      },
      true,
    );

    document.addEventListener(
      'change',
      event => {
        const element = event.target;
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          reportValue(element);
        }
      },
      true,
    );

    document.addEventListener(
      'keydown',
      event => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        report({ action: 'keydown', target: identify(event.target as Element), key: event.key });
      },
      true,
    );

    document.addEventListener(
      'submit',
      event => report({ action: 'submit', target: identify(event.target as Element) }),
      true,
    );

    document.addEventListener(
      'drop',
      event => {
        const filenames = [...(event.dataTransfer?.files ?? [])].map(file => file.name).join(', ');
        report({ action: 'drop', target: identify(event.target as Element), value: filenames });
      },
      true,
    );

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener(
      'scroll',
      event => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const target = event.target instanceof Element ? identify(event.target) : '页面';
          report({ action: 'scroll', target, value: `${Math.round(window.scrollX)},${Math.round(window.scrollY)}` });
        }, 500);
      },
      true,
    );

    report({ action: 'ready', target: location.href });
  });
}

export function describeOperation(operation: BrowserOperation): string {
  if (operation.action === 'click') return `点击 ${operation.target}`;
  if (operation.action === 'change') return `在 ${operation.target} 中输入/选择「${operation.value ?? ''}」`;
  if (operation.action === 'keydown') return `在 ${operation.target} 按下 ${operation.key}`;
  if (operation.action === 'submit') return `提交 ${operation.target}`;
  if (operation.action === 'drop') {
    return operation.value ? `拖放「${operation.value}」到 ${operation.target}` : `拖放到 ${operation.target}`;
  }
  if (operation.action === 'scroll') return `滚动 ${operation.target} 到 ${operation.value}`;
  return `录制器已就绪 ${operation.target}`;
}

function latestRelevantPage(context: BrowserContext, sourcePage: Page): Page {
  const pages = context.pages().filter(candidate => !candidate.isClosed());
  return pages.at(-1) ?? sourcePage;
}

function latestOpenPage(context: BrowserContext): Page | undefined {
  return [...context.pages()].reverse().find(page => !page.isClosed());
}

async function flushPendingPageOperations(context: BrowserContext) {
  await Promise.all(context.pages().map(page => page.waitForTimeout(600).catch(() => undefined)));
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
