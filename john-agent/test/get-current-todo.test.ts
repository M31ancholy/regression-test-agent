import assert from 'node:assert/strict';
import test from 'node:test';
import { createGetCurrentTodoTool } from '../src/agents/tools/get-current-todo.js';
import type { TodoTestItem } from '../src/common/types.js';

const executeOptions = { toolCallId: 'test-call', messages: [] };

test('returns only the current running todo and its reference image', async () => {
  const todos: TodoTestItem[] = [
    { index: 0, desc: 'first', referenceScreenshotPath: '001.png', status: 'running' },
    { index: 1, desc: 'second', referenceScreenshotPath: '002.png', status: 'pending' },
  ];
  const firstImage = new Uint8Array([1, 2, 3]);
  const tool = createGetCurrentTodoTool(todos, new Map([
    [0, firstImage],
    [1, new Uint8Array([4, 5, 6])],
  ]));

  assert.ok(tool.execute);
  const output = await tool.execute({}, executeOptions);
  assert.equal(output.success, true);
  if (!output.success) return;
  assert.equal(output.index, 0);
  assert.equal(output.desc, 'first');
  assert.deepEqual(output.image, firstImage);
});

test('follows todo progression and rejects terminal state', async () => {
  const todos: TodoTestItem[] = [
    { index: 0, desc: 'first', referenceScreenshotPath: '001.png', status: 'passed' },
    { index: 1, desc: 'second', referenceScreenshotPath: '002.png', status: 'running' },
  ];
  const tool = createGetCurrentTodoTool(todos, new Map([[1, new Uint8Array([4])] ]));

  assert.ok(tool.execute);
  const running = await tool.execute({}, executeOptions);
  assert.equal(running.success, true);
  if (running.success) assert.equal(running.index, 1);

  todos[1].status = 'passed';
  const terminal = await tool.execute({}, executeOptions);
  assert.deepEqual(terminal, {
    success: false,
    error: '当前没有 running 状态的 todo，流程可能已经结束',
  });
});
