import assert from 'node:assert/strict';
import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Page } from 'playwright';
import { createBrowserTools } from '../src/agents/tools/index.js';
import { resolveFixtureFiles } from '../src/agents/tools/file-fixtures.js';

const executeOptions = { toolCallId: 'test-call', messages: [] };

function createFakePage(actions: string[]): Page {
  return {
    viewportSize: () => ({ width: 1440, height: 900 }),
    url: () => 'https://example.com/',
    waitForTimeout: async () => undefined,
    mouse: {
      click: async (x: number, y: number) => { actions.push(`click:${x},${y}`); },
      move: async (x: number, y: number) => { actions.push(`move:${x},${y}`); },
      down: async () => { actions.push('down'); },
      up: async () => { actions.push('up'); },
    },
    keyboard: {
      press: async (key: string) => { actions.push(`key:${key}`); },
    },
    evaluate: async (_fn: unknown, argument: { x: number; y: number }) => ({ x: argument.x, y: argument.y }),
  } as unknown as Page;
}

test('registers tools for every replayable recorder operation', () => {
  const tools = createBrowserTools(
    createFakePage([]),
    'run-id',
    [{ index: 0, desc: 'step', referenceScreenshotPath: '001.png', status: 'running' }],
    new Map([[0, new Uint8Array([1])]]),
  );

  assert.deepEqual(Object.keys(tools).sort(), [
    'click',
    'drag',
    'dropFiles',
    'fill',
    'getCurrentTodo',
    'pressKey',
    'screenshot',
    'scrollPage',
    'selectOption',
    'setChecked',
    'setFiles',
    'submitForm',
    'updateTodo',
  ].sort());
});

test('pressKey focuses the coordinate before sending the recorded key', async () => {
  const actions: string[] = [];
  const tools = createBrowserTools(createFakePage(actions), 'run-id', [], new Map());
  assert.ok(tools.pressKey.execute);
  const result = await tools.pressKey.execute({ x: 120, y: 80, key: 'Enter' }, executeOptions);
  assert.equal(result.success, true);
  assert.deepEqual(actions, ['click:120,80', 'key:Enter']);
});

test('drag performs a mouse drag sequence and validates both points', async () => {
  const actions: string[] = [];
  const tools = createBrowserTools(createFakePage(actions), 'run-id', [], new Map());
  assert.ok(tools.drag.execute);
  const result = await tools.drag.execute({ fromX: 10, fromY: 20, toX: 300, toY: 400 }, executeOptions);
  assert.equal(result.success, true);
  assert.deepEqual(actions, ['move:10,20', 'down', 'move:300,400', 'up']);

  const invalid = await tools.drag.execute({ fromX: 10, fromY: 20, toX: 2000, toY: 400 }, executeOptions);
  assert.equal(invalid.success, false);
});

test('scrollPage requests the absolute recorded window position', async () => {
  const tools = createBrowserTools(createFakePage([]), 'run-id', [], new Map());
  assert.ok(tools.scrollPage.execute);
  const result = await tools.scrollPage.execute({ x: 0, y: 997 }, executeOptions);
  assert.deepEqual(result.actual, { x: 0, y: 997 });
});

test('file fixtures are restricted to FILE_FIXTURES_ROOT', async () => {
  const previousRoot = process.env.FILE_FIXTURES_ROOT;
  const root = await mkdtemp(join(tmpdir(), 'john-agent-fixtures-'));
  const outside = await mkdtemp(join(tmpdir(), 'john-agent-outside-fixtures-'));
  await writeFile(join(root, 'report.txt'), 'fixture');
  await writeFile(join(outside, 'secret.txt'), 'secret');
  await symlink(join(outside, 'secret.txt'), join(root, 'escaped.txt'));
  process.env.FILE_FIXTURES_ROOT = root;

  try {
    const files = await resolveFixtureFiles(['report.txt']);
    assert.equal(files[0].name, 'report.txt');
    assert.equal(files[0].data.toString(), 'fixture');
    await assert.rejects(resolveFixtureFiles(['../secret.txt']), /非法/);
    await assert.rejects(resolveFixtureFiles(['escaped.txt']), /超出/);
  } finally {
    if (previousRoot === undefined) delete process.env.FILE_FIXTURES_ROOT;
    else process.env.FILE_FIXTURES_ROOT = previousRoot;
  }
});
