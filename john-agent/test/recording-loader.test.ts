import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  loadRecordingDirectory,
  prepareInlineSteps,
  RecordingValidationError,
} from '../src/common/recording-loader.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

async function createRecordingRoot() {
  const root = await mkdtemp(join(tmpdir(), 'john-agent-recordings-'));
  const recordingDirectory = join(root, 'login');
  await mkdir(join(recordingDirectory, 'screenshots'), { recursive: true });
  await writeFile(join(recordingDirectory, 'screenshots', '001.png'), PNG);
  return { root, recordingDirectory };
}

test('loads a version 1 recording with URL, viewport, steps and PNG data', async () => {
  const { root, recordingDirectory } = await createRecordingRoot();
  await writeFile(join(recordingDirectory, 'steps.json'), JSON.stringify({
    version: 1,
    targetUrl: 'http://localhost:5173/login',
    viewport: { width: 1440, height: 900 },
    steps: [{ desc: '打开登录页', screenshotPath: 'screenshots/001.png' }],
  }));

  const recording = await loadRecordingDirectory({ recordingPath: 'login', recordingsRoot: root });
  assert.equal(recording.readyToTestURL, 'http://localhost:5173/login');
  assert.deepEqual(recording.viewport, { width: 1440, height: 900 });
  assert.equal(recording.steps[0].desc, '打开登录页');
  assert.deepEqual(Buffer.from(recording.steps[0].referenceScreenshotData), PNG);
});

test('loads a legacy steps array only when readyToTestURL is supplied', async () => {
  const { root, recordingDirectory } = await createRecordingRoot();
  await writeFile(join(recordingDirectory, 'steps.json'), JSON.stringify([
    { desc: '旧版步骤', screenshotPath: 'screenshots/001.png' },
  ]));

  await assert.rejects(
    loadRecordingDirectory({ recordingPath: 'login', recordingsRoot: root }),
    (error: unknown) => error instanceof RecordingValidationError && error.message.includes('readyToTestURL'),
  );

  const recording = await loadRecordingDirectory({
    recordingPath: 'login',
    readyToTestURL: 'https://example.com',
    recordingsRoot: root,
  });
  assert.equal(recording.readyToTestURL, 'https://example.com/');
  assert.equal(recording.viewport, undefined);
});

test('resolves inline screenshot paths relative to the recordings root', async () => {
  const { root } = await createRecordingRoot();
  const recording = await prepareInlineSteps({
    recordingsRoot: root,
    readyToTestURL: 'https://example.com/test',
    steps: [{ desc: '内联步骤', screenshotPath: 'login/screenshots/001.png' }],
  });

  assert.equal(recording.steps[0].screenshotPath, 'login/screenshots/001.png');
  assert.deepEqual(Buffer.from(recording.steps[0].referenceScreenshotData), PNG);
});

test('rejects invalid PNG files and paths outside the recordings root', async () => {
  const { root, recordingDirectory } = await createRecordingRoot();
  await writeFile(join(recordingDirectory, 'screenshots', 'invalid.png'), 'not png');

  await assert.rejects(
    prepareInlineSteps({
      recordingsRoot: root,
      readyToTestURL: 'https://example.com',
      steps: [{ desc: '非图片', screenshotPath: 'login/screenshots/invalid.png' }],
    }),
    /PNG/,
  );

  await assert.rejects(
    loadRecordingDirectory({ recordingPath: '../outside', recordingsRoot: root }),
    RecordingValidationError,
  );
});

test('rejects invalid JSON, unknown versions, empty steps and missing screenshots', async () => {
  const invalidJson = await createRecordingRoot();
  await writeFile(join(invalidJson.recordingDirectory, 'steps.json'), '{bad json');
  await assert.rejects(
    loadRecordingDirectory({ recordingPath: 'login', recordingsRoot: invalidJson.root }),
    /steps\.json/,
  );

  const unknownVersion = await createRecordingRoot();
  await writeFile(join(unknownVersion.recordingDirectory, 'steps.json'), JSON.stringify({
    version: 2,
    targetUrl: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    steps: [{ desc: 'step', screenshotPath: 'screenshots/001.png' }],
  }));
  await assert.rejects(
    loadRecordingDirectory({ recordingPath: 'login', recordingsRoot: unknownVersion.root }),
    /version=1/,
  );

  const empty = await createRecordingRoot();
  await writeFile(join(empty.recordingDirectory, 'steps.json'), JSON.stringify({
    version: 1,
    targetUrl: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    steps: [],
  }));
  await assert.rejects(
    loadRecordingDirectory({ recordingPath: 'login', recordingsRoot: empty.root }),
    /version=1/,
  );

  await assert.rejects(
    prepareInlineSteps({
      recordingsRoot: empty.root,
      readyToTestURL: 'https://example.com',
      steps: [{ desc: '缺失截图', screenshotPath: 'missing.png' }],
    }),
    /不存在/,
  );
});

test('rejects a screenshot symlink that escapes the recordings root', async () => {
  const { root, recordingDirectory } = await createRecordingRoot();
  const outside = await mkdtemp(join(tmpdir(), 'john-agent-outside-'));
  const outsideImage = join(outside, 'outside.png');
  await writeFile(outsideImage, PNG);
  await symlink(outsideImage, join(recordingDirectory, 'screenshots', 'outside.png'));

  await assert.rejects(
    prepareInlineSteps({
      recordingsRoot: root,
      readyToTestURL: 'https://example.com',
      steps: [{ desc: '越界链接', screenshotPath: 'login/screenshots/outside.png' }],
    }),
    /\u8d85出/,
  );
});
