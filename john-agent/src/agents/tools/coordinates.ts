import type { Page } from 'playwright';

export function validatePoint(page: Page, x: number, y: number) {
  const viewport = page.viewportSize();
  if (!viewport) {
    return { success: false as const, error: '当前页面没有可用的 viewport' };
  }
  if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) {
    return {
      success: false as const,
      error: `坐标 (${x}, ${y}) 超出 viewport ${viewport.width}x${viewport.height}`,
    };
  }
  return { success: true as const, viewport };
}
