import { recordSteps } from './recorder.js';

const url = process.argv[2];
if (!url) {
  console.error('用法: npm run dev -- <目标网页 URL> [输出目录]');
  process.exit(1);
}

try {
  new URL(url);
} catch {
  console.error(`无效的目标网页 URL: ${url}`);
  process.exit(1);
}

await recordSteps({
  url,
  outputDirectory: process.argv[3],
});
