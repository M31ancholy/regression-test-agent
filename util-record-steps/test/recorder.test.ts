import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingDocument, describeOperation } from '../src/recorder.js';

test('formats meaningful browser operations as Chinese step descriptions', () => {
  assert.equal(describeOperation({ action: 'click', target: 'button「登录」' }), '点击 button「登录」');
  assert.equal(
    describeOperation({ action: 'change', target: 'input「密码」', value: '[已隐藏]' }),
    '在 input「密码」 中输入/选择「[已隐藏]」',
  );
  assert.equal(
    describeOperation({ action: 'keydown', target: 'input「搜索」', key: 'Enter' }),
    '在 input「搜索」 按下 Enter',
  );
  assert.equal(describeOperation({ action: 'submit', target: 'form「注册」' }), '提交 form「注册」');
  assert.equal(
    describeOperation({ action: 'drop', target: 'div「上传」', value: 'report.pdf' }),
    '拖放「report.pdf」到 div「上传」',
  );
  assert.equal(
    describeOperation({ action: 'scroll', target: '页面', value: '0,640' }),
    '滚动 页面 到 0,640',
  );
});

test('creates a versioned recording document with URL, viewport and copied steps', () => {
  const steps = [{ desc: '点击登录按钮', screenshotPath: 'screenshots/001.png' }];
  const document = createRecordingDocument(
    'http://localhost:5173/login',
    { width: 1440, height: 900 },
    steps,
  );

  assert.deepEqual(document, {
    version: 1,
    targetUrl: 'http://localhost:5173/login',
    viewport: { width: 1440, height: 900 },
    steps,
  });
  assert.notEqual(document.steps, steps);
  assert.notEqual(document.steps[0], steps[0]);
});
