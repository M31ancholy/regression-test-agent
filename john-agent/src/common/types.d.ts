// 回归测试记录流程
export type OverallStepDesc = SingleStepDesc[];

export type SingleStepDesc = {
  desc: string;
  screenshotPath: string;
};

export type RecordingViewport = {
  width: number;
  height: number;
};

export type RecordingDocument = {
  version: 1;
  targetUrl: string;
  viewport: RecordingViewport;
  steps: OverallStepDesc;
};

// 经过路径校验并读入参考图后，workflow 内部使用的步骤。
export type PreparedTestStep = SingleStepDesc & {
  referenceScreenshotData: Uint8Array;
};

export type TodoStatus = 'pending' | 'running' | 'passed' | 'failed';

export type TodoTestItem = {
  // 第几步骤
  index: number;
  // 操作动作描述
  desc: string;
  // 操作后参考图片路径
  referenceScreenshotPath: string;
  // 该步骤目前状态
  status: TodoStatus;
  // ai 给出的总结
  summary?: string;
  // 步骤结束后的截屏路径
  evidenceScreenshotPath?: string;
};
