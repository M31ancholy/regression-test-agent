export type SingleStepDesc = {
  desc: string;
  screenshotPath: string;
};

export type OverallStepDesc = SingleStepDesc[];

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

export type BrowserOperation = {
  action: 'ready' | 'click' | 'change' | 'keydown' | 'submit' | 'drop' | 'scroll';
  target: string;
  value?: string;
  key?: string;
};
