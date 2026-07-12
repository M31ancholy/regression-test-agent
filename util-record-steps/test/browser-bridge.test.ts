import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { installOperationBridge } from '../src/recorder.js';

test('operation bridge reports ready and click events in a browser page', async t => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`Chromium is unavailable in this environment: ${String(error)}`);
    return;
  }

  try {
    const context = await browser.newContext();
    const operations: string[] = [];
    await installOperationBridge(context, (_page, operation) => {
      operations.push(operation.action);
    });
    const page = await context.newPage();
    await page.goto('data:text/html,<button>record</button>');
    await page.locator('button').click();
    await page.waitForTimeout(50);
    assert.ok(operations.includes('ready'));
    assert.equal(operations.at(-1), 'click');
  } finally {
    await browser.close();
  }
});
