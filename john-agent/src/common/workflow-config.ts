import type { PreparedTestStep, RecordingViewport } from './types.js';

export type workFlowOptions = {
  // agent 需要测试的网址
  readyToTestURL: string;
  // 录制时的 viewport，用于保持截图和坐标一致
  viewport?: RecordingViewport;
  // 已验证并读入参考图的录制步骤
  steps: PreparedTestStep[];
  // 可选的整体验收目标
  prompt?: string;
};
