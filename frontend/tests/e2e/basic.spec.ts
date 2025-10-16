import { test, expect } from '@playwright/test';

test.describe('Landing page smoke test', () => {
  test('shows headline and controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('KI Verkaufssimulation');
    await expect(page.getByRole('button', { name: 'Starte Simulation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simulation beenden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transkript speichern' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transkript anzeigen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Score berechnen' })).toBeVisible();
  });
});
