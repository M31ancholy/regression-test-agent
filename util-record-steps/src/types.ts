export type SingleStepDesc = {
  desc: string;
  screenshotPath: string;
};

export type OverallStepDesc = SingleStepDesc[];

export type BrowserOperation = {
  action: 'ready' | 'click' | 'change' | 'keydown' | 'submit' | 'drop' | 'scroll';
  target: string;
  value?: string;
  key?: string;
};
