import { test, expect } from '@playwright/test';

test.describe('M6-T2 Copilot flows E2E (mock LLM)', () => {
  test('chat → proposal → approval applies the cut', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/copilot');
    await expect(page.getByText('Mitsinjo Copilot').first()).toBeVisible();

    const input = page.getByRole('textbox', { name: /ask copilot a question/i });
    await input.fill('Cut the market tonight');
    await page.getByRole('button', { name: /^send$/i }).click();

    // Proposal card with the diff, then approval.
    const approve = page.getByRole('button', { name: /approve & apply scenario/i });
    await expect(approve).toBeVisible({ timeout: 20_000 });
    await approve.click();

    // Decision recorded, card locked.
    await expect(
      page.getByText('Change approved and applied to the simulation').first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Approved').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /approve & apply scenario/i })).toHaveCount(0);
  });

  test('fire report → banner + copilot explains the cut', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/copilot');
    await expect(page.getByText('Mitsinjo Copilot').first()).toBeVisible();

    // Report from the chat header: one click per sector, applies at once.
    await page.getByRole('button', { name: 'Report a fire' }).click();
    const fireGroup = page.getByRole('group', { name: 'Which sector is on fire?' });
    await expect(fireGroup).toBeVisible();
    await fireGroup.getByRole('button', { name: 'Primary School' }).click();

    // Shell banner names the cut sector.
    const banner = page.getByRole('alert').filter({ hasText: /FIRE:/i });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Primary School');

    // The copilot explains the automatic cut from the engine incident.
    const input = page.getByRole('textbox', { name: /ask copilot a question/i });
    await input.fill('The school is burning, what happens?');
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText('A fire cut power automatically (safety)').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/school: cut \d+:\d+ → \d+:\d+/).first()).toBeVisible();
  });
});
