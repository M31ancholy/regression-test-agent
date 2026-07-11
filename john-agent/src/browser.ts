import { chromium, type Browser } from 'playwright';

export class BrowserManager {
  private browser: Browser | undefined;

  async start(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    const browser = await chromium.launch({ headless: true });
    browser.on('disconnected', () => {
      if (this.browser === browser) this.browser = undefined;
    });
    this.browser = browser;
    return browser;
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = undefined;
    await browser?.close();
  }
}
