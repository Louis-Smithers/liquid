import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

// Note: This test requires the backend to be running in Staging mode.
// cd backend && $env:ASPNETCORE_ENVIRONMENT="Staging"; dotnet run

const SECRET = 'super-secret-key-that-is-at-least-32-characters-long'; // Default from appsettings.json
const SUB = '00000000-0000-0000-0000-000000000001';

test.describe('NS Queue - Real E2E (Approach B)', () => {
  // We will run this to verify the JWT auth pattern works against the real backend.
  test('T9 & T10: Builder happy path with Real Backend', async ({ page }) => {
    
    // Mint a JWT
    const access_token = jwt.sign(
      { 
        sub: SUB, 
        aud: 'authenticated', 
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600 
      }, 
      SECRET, 
      { algorithm: 'HS256' }
    );

    // Inject into localStorage before page load
    await page.addInitScript(([token, sub]) => {
      const now = Math.floor(Date.now() / 1000);
      // The exact key based on frontend/.env VITE_SUPABASE_URL=https://your-project-ref.supabase.co
      localStorage.setItem('sb-your-project-ref-auth-token', JSON.stringify({
        access_token: token, 
        token_type: 'bearer', 
        expires_at: now + 3600,
        expires_in: 3600, 
        refresh_token: 'test-refresh',
        user: { id: sub, aud: 'authenticated', role: 'authenticated' }
      }));
    }, [access_token, SUB]);

    await page.goto('/ns-queue');

    // Proceed with test T9
    await page.getByRole('button', { name: /New NS/i }).click();

    // Select first client
    await page.getByRole('combobox').click();
    await page.getByRole('option').first().click();

    // Select first invoice
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.first().click();

    // T10 Privacy Toggle
    const privacyButton = page.getByRole('button', { name: /Shared|Make Private/i });
    if (await privacyButton.isVisible()) {
      await privacyButton.click();
    }

    // Save Draft
    await page.getByRole('button', { name: /Save Draft/i }).click();

    // Wait for save and navigate back
    await expect(page).toHaveURL(/.*\/ns-queue$/);

    // Assert row appears in list
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
  });
});
