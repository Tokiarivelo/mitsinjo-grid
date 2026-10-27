import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Desktop (1440px)', width: 1440, height: 900 },
  { name: 'Tablet (1024px)', width: 1024, height: 768 },
  { name: 'Mobile (390px)', width: 390, height: 844 },
];

const ROUTES = ['/overview', '/simulation', '/strategies', '/scenarios', '/copilot'];

test.describe('P8-T5 Responsive Viewport Audits (1440 / 1024 / 390 px)', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES) {
        test(`renders ${route} fluidly without layout breaks at ${vp.width}px`, async ({ page }) => {
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');

          // Check for simulated data badge
          await expect(page.getByText('SIMULATED DATA').first()).toBeVisible();

          // Ensure no body horizontal overflow
          const hasHorizontalOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
          });
          expect(hasHorizontalOverflow).toBe(false);

          if (vp.width < 1280) {
            // Mobile / tablet: Menu hamburger button should be present
            const menuBtn = page.getByRole('button', { name: /open navigation menu/i });
            await expect(menuBtn).toBeVisible();

            // Test drawer interaction once on overview
            if (route === '/overview') {
              await menuBtn.click();
              await expect(page.getByRole('link', { name: /overview/i }).first()).toBeVisible();
              const backdrop = page.locator('.fixed.inset-0.z-40');
              if (await backdrop.isVisible().catch(() => false)) {
                await backdrop.click({ force: true });
              }
            }
          } else {
            // Desktop: Sidebar navigation is directly visible
            await expect(page.getByRole('link', { name: /overview/i }).first()).toBeVisible();
          }
        });
      }
    });
  }
});
