export type SingleStepDesc = {
  desc: string;
  screenshotPath: string;
};

export type OverallStepDesc = SingleStepDesc[];

export type BrowserOperation = {
  action: 'click' | 'change' | 'keydown';
  target: string;
  value?: string;
  key?: string;
};
