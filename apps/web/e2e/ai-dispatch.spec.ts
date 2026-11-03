import { test, expect } from '@playwright/test';

test.describe('PA-T7 Autonomous AI Dispatch & Chat Scenario E2E', () => {
  test('autonomous dispatch demo path: incident → auto isolation → event log → why? → take back control', async ({
    page,
  }) => {
    test.setTimeout(120_000);

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

    // 4. Run simulation
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
        .locator('main')
        .getByText(/market|marché|fire/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // 7. Check Event Log (Journal des événements)
    const logTab = page.getByRole('tab', { name: /event log|journal/i });
    await expect(logTab).toBeVisible();
    await logTab.click();

    // Verify event log entries exist
    const logPanel = page.locator('#panel-log');
    await expect(logPanel).toBeVisible();
    await expect(logPanel.getByText(/market|marché/i).first()).toBeVisible({ timeout: 10_000 });

    // Verify numbers before/after or incident details
    await expect(
      logPanel.getByText(/before|avant|unserved|non servi|14:00|14 h/i).first()
    ).toBeVisible();

    // 8. Click "Why?" / "Pourquoi ?" on the isolation entry
    const whyButton = logPanel.getByRole('button', { name: /why|pourquoi/i }).first();
    await expect(whyButton).toBeVisible();
    await whyButton.click();

    // Verify tab automatically switched to Copilot and input is pre-filled with the why prompt
    const copilotInput = page.getByRole('textbox', { name: /ask copilot a question/i });
    await expect(copilotInput).toBeVisible();
    await expect(copilotInput).toHaveValue(/why.*market|pourquoi.*marché/i);

    // Send the explanation question
    await page.getByRole('button', { name: /^send$/i }).click();

    // Verify copilot provides an answer referencing the incident / isolation
    await expect(page.getByText(/what happened|ce qui s'est passé/i).first()).toBeVisible({
      timeout: 25_000,
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

    // 3. Draft card appears with missing slots detected (e.g. fire start hour)
    await expect(
      page.getByText(/scenario draft|3-day simulation|brouillon de scénario/i).first()
    ).toBeVisible({ timeout: 25_000 });

    // Missing slot pill for fire hour appears (e.g. 14h, 12h, 8h, 16h)
    const hourOption = page.getByRole('button', { name: /14h|12h|16h|8h|14:00|12:00/i }).first();
    await expect(hourOption).toBeVisible({ timeout: 15_000 });
    await hourOption.click();

    // 4. Draft is complete: engine preview appears
    await expect(
      page
        .getByText(
          /engine simulation preview|aperçu de la simulation|total.*deficit|déficit total/i
        )
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
