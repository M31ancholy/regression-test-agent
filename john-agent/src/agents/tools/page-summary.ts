import type { Page } from 'playwright';

const MAX_PAGE_TEXT_LENGTH = 8_000;
const MAX_INTERACTIVE_ELEMENTS = 50;

type PageSummary = {
  url: string;
  title: string;
  text: string;
  interactiveElements: Array<{
    tag: string;
    role: string | null;
    text: string;
    type: string | null;
    id: string | null;
    name: string | null;
    placeholder: string | null;
    ariaLabel: string | null;
    testId: string | null;
    selectorHint: string | null;
  }>;
};

export async function summarizePage(page: Page): Promise<PageSummary> {
  const text = (await page.locator('body').innerText()).slice(0, MAX_PAGE_TEXT_LENGTH);
  const interactiveElements = await page
    .locator('a, button, input, textarea, select, [role], [contenteditable="true"]')
    .evaluateAll((elements, maxElements) => {
      const quoteAttribute = (value: string) => JSON.stringify(value);

      return elements
        .filter(element => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        })
        .slice(0, maxElements)
        .map(element => {
          const htmlElement = element as HTMLElement;
          const inputElement = element as HTMLInputElement;
          const tag = element.tagName.toLowerCase();
          const id = element.id || null;
          const testId = element.getAttribute('data-testid');
          const name = element.getAttribute('name');
          const placeholder = element.getAttribute('placeholder');
          const visibleText = (htmlElement.innerText || inputElement.value || '').trim().slice(0, 200);

          let selectorHint: string | null = null;
          if (testId) selectorHint = `[data-testid=${quoteAttribute(testId)}]`;
          else if (id) selectorHint = `#${CSS.escape(id)}`;
          else if (name) selectorHint = `${tag}[name=${quoteAttribute(name)}]`;
          else if (placeholder) selectorHint = `${tag}[placeholder=${quoteAttribute(placeholder)}]`;
          else if (visibleText) selectorHint = `text=${visibleText}`;

          return {
            tag,
            role: element.getAttribute('role'),
            text: visibleText,
            type: element.getAttribute('type'),
            id,
            name,
            placeholder,
            ariaLabel: element.getAttribute('aria-label'),
            testId,
            selectorHint,
          };
        });
    }, MAX_INTERACTIVE_ELEMENTS);

  return {
    url: page.url(),
    title: await page.title(),
    text,
    interactiveElements,
  };
}

export async function waitForPageToSettle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}
