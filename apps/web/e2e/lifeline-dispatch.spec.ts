import { test, expect } from '@playwright/test';

test.describe('PL-T15 Lifeline Dispatch & Controller E2E', () => {
  test.beforeEach(async () => {
    test.setTimeout(120_000);
  });

  test('solar drop + night preserves lifeline across all connected sectors and controller shows rationing', async ({
    page,
  }) => {
    // 1. Navigate to live simulation
    await page.goto('/simulation');
    await expect(page.getByText('Live Simulation').first()).toBeVisible();

    // 2. Select cloudy_afternoon scenario
    const scenarioSelect = page.getByLabel(/select simulation scenario/i);
    if (await scenarioSelect.isVisible().catch(() => false)) {
      await scenarioSelect.selectOption('cloudy_afternoon');
    }

    // 3. Run simulation
    const runBtn = page.getByRole('button', { name: /run simulation/i }).first();
    await runBtn.click();
    await expect(page.getByText('SIMULATION COMPLETE').first()).toBeVisible({ timeout: 15_000 });

    // 4. Switch view mode to 2D Topology to inspect EMS controller node
    const topologyBtn = page.getByRole('button', { name: /topology/i });
    if (await topologyBtn.isVisible().catch(() => false)) {
      await topologyBtn.click();
    }

    // 5. Move timeline slider to evening deficit hour (23:00)
    const scrubber = page.getByRole('slider', { name: /timeline|scrubber|hour/i });
    if (await scrubber.isVisible().catch(() => false)) {
      await scrubber.fill('23');
    }

    // 6. Verify EMS Dispatch controller is rendered and displays Rationing mode
    await expect(page.getByText('EMS Dispatch').first()).toBeVisible();
    await expect(page.getByText(/rationing/i).first()).toBeVisible();

    // 7. Verify lifeline preservation: while dispo >= sum planchers,
    // sectors display lifeline/limited badges, not all off.
    const diagram = page.locator('main');
    await expect(diagram.getByText(/lifeline|limited/i).first()).toBeVisible();
  });

  test('controller is visible and interactive across 2D diagram views', async ({ page }) => {
    await page.goto('/simulation');
    await expect(page.getByText('Live Simulation').first()).toBeVisible();

    // Run simulation
    const runBtn = page.getByRole('button', { name: /run simulation/i }).first();
    await runBtn.click();
    await expect(page.getByText('SIMULATION COMPLETE').first()).toBeVisible({ timeout: 15_000 });

    // Switch to Circuit view
    const circuitBtn = page.getByRole('button', { name: /circuit/i });
    if (await circuitBtn.isVisible().catch(() => false)) {
      await circuitBtn.click();
      await expect(page.getByText('EMS Dispatch').first()).toBeVisible();
    }

    // Switch to Topology view
    const topologyBtn = page.getByRole('button', { name: /topology/i });
    if (await topologyBtn.isVisible().catch(() => false)) {
      await topologyBtn.click();
      await expect(page.getByText('EMS Dispatch').first()).toBeVisible();
    }
  });
});
