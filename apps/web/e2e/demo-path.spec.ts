import { test, expect } from '@playwright/test';

test.describe('P8-T1 Demo Path E2E', () => {
  test('executes canonical demo path: load → cloudy_afternoon → run → compare → ask copilot → evidence visible', async ({
    page,
  }) => {
    // 1. Load: navigate to application overview
    await page.goto('/overview');
    await expect(page).toHaveTitle(/Mitsinjo Grid/);
    await expect(page.getByText('SIMULATED DATA').first()).toBeVisible();
    await expect(page.getByText('Mitsinjo Grid').first()).toBeVisible();

    // 2. Select cloudy_afternoon scenario
    await page.getByRole('link', { name: /scenarios/i }).click();
    await expect(page).toHaveURL(/.*\/scenarios/);
    await expect(page.locator('main').getByText('Cloudy Afternoon (-40%)').first()).toBeVisible();

    // Click Cloudy Afternoon scenario card
    await page
      .locator('main')
      .getByRole('button', { name: /Cloudy Afternoon/i })
      .first()
      .click();

    // Open in simulation
    await page.getByRole('button', { name: /Open scenario Cloudy Afternoon/i }).click();

    await expect(page).toHaveURL(/.*\/simulation/);
    await expect(page.getByText('Live Simulation').first()).toBeVisible();

    // 3. Run simulation
    const runBtn = page.getByRole('button', { name: /run simulation/i }).first();
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Verify simulation completed and metrics are visible
    await expect(page.getByText('SIMULATION COMPLETE').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Peak Solar PV')).toBeVisible();
    await expect(page.getByText('Battery End SoC')).toBeVisible();
    await expect(page.getByText('Essential Services')).toBeVisible();

    // 4. Compare strategies in Strategy Lab
    await page.getByRole('link', { name: /strategy lab/i }).click();
    await expect(page).toHaveURL(/.*\/strategies/);
    await expect(page.getByText('Proportional Allocation').first()).toBeVisible();
    await expect(page.getByText('Essential-First Priority').first()).toBeVisible();
    await expect(page.getByText('Balanced Distribution').first()).toBeVisible();

    const compareBtn = page.getByRole('button', { name: /compare strategies/i }).first();
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Verify decision summary appears
    await expect(
      page.getByText(/critical lifeline protection under deficit|decision summary/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // Verify strategy columns show computed numbers
    await expect(page.getByText('Delivered Energy').first()).toBeVisible();
    await expect(page.getByText('Essential Coverage').first()).toBeVisible();

    // 5. Ask copilot (mock)
    await page.getByRole('link', { name: /ai copilot/i }).click();
    await expect(page).toHaveURL(/.*\/copilot/);
    await expect(page.getByText('AI EXPLANATION').first()).toBeVisible();
    await expect(page.getByText('Mitsinjo Copilot').first()).toBeVisible();

    // Send question using suggested prompt or direct input
    const suggestedPrompt = page
      .getByRole('button', {
        name: /why is the clinic receiving less energy\?|why did the health clinic lose power|compare the two allocation strategies/i,
      })
      .first();

    if (await suggestedPrompt.isVisible().catch(() => false)) {
      await suggestedPrompt.click();
    } else {
      const input = page.getByRole('textbox', { name: /ask copilot a question/i });
      await input.fill('Why is the health clinic receiving less energy?');
      await page.getByRole('button', { name: /send/i }).click();
    }

    // 6. Evidence visible: verify 4-section structured answer and computed evidence
    await expect(page.getByText('What happened').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Computed evidence').first()).toBeVisible();
    await expect(page.getByText('Why it matters').first()).toBeVisible();
    await expect(page.getByText('Explore next').first()).toBeVisible();

    // Verify computed evidence contains Result ID / telemetry
    const chatContainer = page.locator('main');
    await expect(chatContainer).toContainText(/SIM-|kWh|%/);
  });

  test('runs 3 consecutive demo path iterations without intervention', async ({ page }) => {
    test.setTimeout(90_000);

    for (let iteration = 1; iteration <= 3; iteration++) {
      // Load
      await page.goto('/simulation');
      await expect(page.getByText('Live Simulation').first()).toBeVisible();

      // Select cloudy_afternoon via select dropdown
      const scenarioSelect = page.getByLabel(/select simulation scenario/i);
      if (await scenarioSelect.isVisible().catch(() => false)) {
        await scenarioSelect.selectOption('cloudy_afternoon');
      }

      // Run
      const runBtn = page.getByRole('button', { name: /run simulation/i }).first();
      await runBtn.click();
      await expect(page.getByText('SIMULATION COMPLETE').first()).toBeVisible({ timeout: 15_000 });

      // Compare
      await page.getByRole('link', { name: /strategy lab/i }).click();
      const compareBtn = page.getByRole('button', { name: /compare strategies/i }).first();
      await compareBtn.click();
      await expect(page.getByText('Essential-First Priority').first()).toBeVisible({
        timeout: 15_000,
      });

      // Copilot
      await page.getByRole('link', { name: /ai copilot/i }).click();
      await expect(page.getByText('Mitsinjo Copilot').first()).toBeVisible();

      const input = page.getByRole('textbox', { name: /ask copilot a question/i });
      await input.fill('Compare the two allocation strategies');
      await page.getByRole('button', { name: /send/i }).click();

      // Evidence visible
      await expect(page.getByText('What happened').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Computed evidence').first()).toBeVisible({ timeout: 20_000 });
    }
  });
});

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
        test(`renders ${route} fluidly without layout breaks at ${vp.width}px`, async ({
          page,
        }) => {
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
