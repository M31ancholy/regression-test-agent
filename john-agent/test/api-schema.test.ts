import assert from 'node:assert/strict';
import test from 'node:test';
import { agentRequestSchema } from '../src/api.js';

const step = { desc: '点击登录按钮', screenshotPath: 'recordings/login/screenshots/001.png' };

test('accepts recordingPath or inline steps without requiring prompt', () => {
  assert.equal(agentRequestSchema.safeParse({ recordingPath: 'recordings/login' }).success, true);
  assert.equal(agentRequestSchema.safeParse({ steps: [step] }).success, true);
});

test('rejects requests that provide both or neither recording source', () => {
  assert.equal(agentRequestSchema.safeParse({}).success, false);
  assert.equal(agentRequestSchema.safeParse({ recordingPath: 'recordings/login', steps: [step] }).success, false);
});
