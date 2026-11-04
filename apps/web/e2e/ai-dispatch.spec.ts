import { test, expect } from '@playwright/test';

test.describe('PA-T7 Autonomous AI Dispatch & Chat Scenario E2E', () => {
  test('autonomous dispatch demo path: incident → auto isolation → event log → why? → take back control', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // 1. Navigate to /simulation
    await page.goto('/simulation');
    await expect(page.getByText('Live Simulation').first()).toBeVisible();
    await expect(page.getByText('SIMULATED DATA').first()).toBeVisible();

    // 2. Select scenario: village_fire (market catches fire at 14h, water at 15h)
    const scenarioSelect = page.getByLabel(/select simulation scenario/i);
    await expect(scenarioSelect).toBeVisible();
    await scenarioSelect.selectOption('village_fire');

    // 3. Switch to Autonomous AI dispatch mode
    const autoRadio = page.getByRole('radio', { name: /autonomous ai|ia autonome/i }).first();
    await expect(autoRadio).toBeVisible();
    await autoRadio.click();

    // Verify AI in Control badge appears
    await expect(page.getByText(/ai in control|ia aux commandes/i).first()).toBeVisible();

    // 4. Run simulation if button visible
    const runBtn = page
      .getByRole('button', { name: /run simulation|lancer la simulation/i })
      .first();
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await expect(page.getByText('SIMULATION COMPLETE').first()).toBeVisible({ timeout: 15_000 });
    }

    // 5. Advance time scrubber to hour 14 (when market catches fire)
    const scrubber = page.getByRole('slider', { name: /hour of day scrubber/i });
    await expect(scrubber).toBeVisible();
    await scrubber.fill('14');

    // 6. Autonomous engine detects fire and isolates market automatically
    // Red fire alert appears without human confirmation
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /market|marché/i })
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // 7. Check Event Log (Journal des événements)
    const logTab = page.getByRole('tab', { name: /event log|journal/i });
    await expect(logTab).toBeVisible();
    await logTab.click();

    // Verify event log entries exist
    const logPanel = page.locator('#panel-log');
    await expect(logPanel).toBeVisible();

    // Find the Market isolation action entry in the log
    const marketIsolateEntry = logPanel
      .locator('[data-testid^="dispatch-entry-"]')
      .filter({ hasText: /isolate.*market|isoler.*marché|isolate sector/i })
      .first();
    await expect(marketIsolateEntry).toBeVisible({ timeout: 10_000 });

    // 8. Click "Why?" / "Pourquoi ?" on the market isolation entry
    const whyButton = marketIsolateEntry.getByRole('button', { name: /why\?|pourquoi \?/i });
    await expect(whyButton).toBeVisible();
    await whyButton.click();

    // Verify tab automatically switched to Copilot and input is pre-filled with the why prompt
    const copilotInput = page.getByRole('textbox', { name: /ask copilot a question/i });
    await expect(copilotInput).toBeVisible();
    await expect(copilotInput).not.toHaveValue('');

    // Send the explanation question with Enter (the fire snackbar can sit over the Send button)
    await copilotInput.press('Enter');

    // Verify copilot provides an answer referencing the incident / isolation
    await expect(page.getByText(/what happened|ce qui s'est passé/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('main')).toContainText(/market|marché/i);

    // 9. Take back control (Reprendre la main)
    const takeBackBtn = page
      .getByRole('button', { name: /take back control|reprendre la main/i })
      .first();
    await expect(takeBackBtn).toBeVisible();
    await takeBackBtn.click();

    // Verify immediate return to manual dispatch mode
    await expect(page.getByText(/ai in control|ia aux commandes/i)).toHaveCount(0);
    const manualRadio = page.getByRole('radio', { name: /manual|manuel/i }).first();
    await expect(manualRadio).toBeChecked();
  });

  test('chat scenario path: natural language 3-day scenario → missing slot question → launch in autonomous mode', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // 1. Navigate to /copilot
    await page.goto('/copilot');
    await expect(page.getByText('Mitsinjo Copilot').first()).toBeVisible();

    // 2. Describe multi-day scenario in chat
    const input = page.getByRole('textbox', { name: /ask copilot a question/i });
    await input.fill('day 1: cloudy, day 2: rainy, day 3: sunny + school on fire');
    await page.getByRole('button', { name: /^send$/i }).click();

    // 3. Draft card appears with missing slots detected (fire start hour)
    await expect(
      page.getByText(/scenario \(3 days\)|scenario draft|brouillon de scénario/i).first()
    ).toBeVisible({ timeout: 25_000 });

    // Missing slot pill for fire hour appears (e.g. 14:00, 12:00, 08:00, 16:00)
    const hourOption = page
      .getByRole('button', { name: /14:00|12:00|08:00|16:00|14h|12h|16h|8h/i })
      .first();
    await expect(hourOption).toBeVisible({ timeout: 15_000 });
    await hourOption.click();

    // 4. Draft is complete: engine preview appears (Total Deficit, Critical Unserved, Worst Day)
    await expect(
      page
        .getByText(/engine simulation preview|total period deficit|déficit total|preview/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // 5. Launch in autonomous AI mode
    const launchAutoBtn = page
      .getByRole('button', { name: /launch in autonomous ai mode|lancer en mode ia autonome/i })
      .first();
    await expect(launchAutoBtn).toBeVisible();
    await launchAutoBtn.click();

    // 6. Navigates to /simulation with custom scenario active in autonomous mode
    await expect(page).toHaveURL(/.*\/simulation/);
    await expect(page.getByText('Live Simulation').first()).toBeVisible();
    await expect(page.getByText(/ai in control|ia aux commandes/i).first()).toBeVisible();
  });
});
