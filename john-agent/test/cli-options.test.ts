import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CliUsageError,
  exitCodeForStatus,
  formatCliSummary,
  parseCliOptions,
} from '../src/cli-options.js';

test('parses recording CLI flags and defaults to a visible browser', () => {
  assert.deepEqual(parseCliOptions([
    '--recording', 'recordings/demo',
    '--prompt', 'verify demo',
    '--url', 'https://example.com',
    '--recordings-root', '/tmp/recordings',
  ]), {
    help: false,
    recordingPath: 'recordings/demo',
    prompt: 'verify demo',
    readyToTestURL: 'https://example.com',
    recordingsRoot: '/tmp/recordings',
    headless: false,
  });
});

test('supports headless and help flags', () => {
  assert.equal(parseCliOptions(['--recording', 'demo', '--headless']).headless, true);
  assert.deepEqual(parseCliOptions(['--help']), { help: true });
  assert.deepEqual(parseCliOptions(['-h']), { help: true });
});

test('rejects missing recording, empty values and unknown flags', () => {
  assert.throws(() => parseCliOptions([]), CliUsageError);
  assert.throws(() => parseCliOptions(['--recording', '   ']), CliUsageError);
  assert.throws(() => parseCliOptions(['--recording', 'demo', '--unknown']), CliUsageError);
});

test('formats a readable summary with todos and artifact location', () => {
  const summary = formatCliSummary({
    runId: 'run-123',
    steps: 8,
    result: { status: 'PASS', summary: 'all passed' },
    todos: [{
      index: 0,
      desc: 'open page',
      referenceScreenshotPath: 'screenshots/001.png',
      status: 'passed',
      summary: 'page is visible',
    }],
  });

  assert.match(summary, /Run ID: run-123/);
  assert.match(summary, /Status: PASS/);
  assert.match(summary, /\[passed\] #0 open page — page is visible/);
  assert.match(summary, /artifacts\/run-123/);
});

test('maps PASS and FAIL to automation-friendly exit codes', () => {
  assert.equal(exitCodeForStatus('PASS'), 0);
  assert.equal(exitCodeForStatus('FAIL'), 1);
});
