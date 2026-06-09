/**
 * Smithers — End-to-End Auth & Navigation Tests
 *
 * Prerequisites:
 *   - Frontend running : http://localhost:5173  (npm run dev)
 *   - Backend running  : http://localhost:5088  (dotnet run)
 *
 * Test accounts — set via env vars (fallbacks are the local dev seed accounts):
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD   (role: user)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (role: admin)
 *
 * Run:  npx playwright test auth-e2e --headed
 */

import { test, expect } from '@playwright/test';
import { CREDS } from './full-e2e/helpers';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function login(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

async function loginAsTestUser(page: any) {
  await login(page, CREDS.user.email, CREDS.user.password);
  await page.waitForURL('**/clients', { timeout: 10_000 });
}

async function loginAsAdmin(page: any) {
  await login(page, CREDS.admin.email, CREDS.admin.password);
  await page.waitForURL('**/clients', { timeout: 10_000 });
}

// ─── T1: Unauthenticated access ───────────────────────────────────────────────

test.describe('T1 – Unauthenticated access', () => {
  test('T1-A: visiting /clients without a session redirects to /login', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login/);
  });

  test('T1-B: visiting / without a session redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('T1-C: visiting /debtors directly redirects to /login', async ({ page }) => {
    await page.goto('/debtors');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── T2: Login page UI ────────────────────────────────────────────────────────

test.describe('T2 – Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('T2-A: renders email field, password field, Login button, and Request Access link', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Login');
    await expect(page.locator('text=Request Access')).toBeVisible();
  });

  test('T2-B: submitting blank form does not navigate away', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test('T2-C: wrong password shows error message, button resets', async ({ page }) => {
    await page.fill('#email', CREDS.user.email);
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');

    // Button enters loading state then returns
    await expect(page.locator('button[type="submit"]')).not.toContainText('Logging in...', { timeout: 8_000 });
    await expect(page.locator('button[type="submit"]')).toContainText('Login');

    // Error message visible
    const errorBox = page.locator('[class*="destructive"]').first();
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(/invalid|credentials/i);
  });

  test('T2-D: Request Access link navigates to /request-access', async ({ page }) => {
    await page.click('text=Request Access');
    await expect(page).toHaveURL(/\/request-access/);
  });
});

// ─── T3: Successful login — test user ─────────────────────────────────────────

test.describe('T3 – Login as test user', () => {
  test('T3-A: valid credentials redirect to /clients', async ({ page }) => {
    await login(page, CREDS.user.email, CREDS.user.password);
    await expect(page).toHaveURL(/\/clients/, { timeout: 10_000 });
  });

  test('T3-B: button shows loading state during sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', CREDS.user.email);
    await page.fill('#password', CREDS.user.password);

    const btn = page.locator('button[type="submit"]');
    await btn.click();
    // Briefly loading...
    await expect(btn).toContainText(/Logging in/);
    await page.waitForURL('**/clients', { timeout: 10_000 });
  });

  test('T3-C: TopNav is visible with correct nav items after login', async ({ page }) => {
    await loginAsTestUser(page);
    const nav = page.locator('header nav');
    await expect(nav.locator('text=Clients')).toBeVisible();
    await expect(nav.locator('text=Debtors')).toBeVisible();
    await expect(nav.locator('text=Scan Invoice')).toBeVisible();
    await expect(nav.locator('text=Import Queue')).toBeVisible();
    await expect(nav.locator('text=Aging Report')).toBeVisible();
    await expect(nav.locator('text=NS Queue')).toBeVisible();
  });

  test('T3-D: Admin nav item is NOT visible for role=user', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page.locator('header nav').locator('text=Admin')).not.toBeVisible();
  });

  test('T3-E: user avatar button shows first letter of email', async ({ page }) => {
    await loginAsTestUser(page);
    const avatar = page.locator('header button').filter({ hasText: CREDS.user.email[0].toUpperCase() });
    await expect(avatar).toBeVisible();
  });

  test('T3-F: user dropdown shows email and Log out option', async ({ page }) => {
    await loginAsTestUser(page);
    await page.locator('header button').filter({ hasText: CREDS.user.email[0].toUpperCase() }).click();
    await expect(page.locator(`text=${CREDS.user.email}`)).toBeVisible();
    await expect(page.locator('text=Log out')).toBeVisible();
  });
});

// ─── T4: Session persistence ──────────────────────────────────────────────────

test.describe('T4 – Session persistence', () => {
  test('T4-A: refreshing the page after login keeps session (no bounce to /login)', async ({ page }) => {
    await loginAsTestUser(page);
    await page.reload();
    // Loading state shows briefly, then stays on /clients
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/clients/);
  });
});

// ─── T5: Navigation ───────────────────────────────────────────────────────────

test.describe('T5 – Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('T5-A: clicking Clients nav link goes to /clients', async ({ page }) => {
    await page.goto('/debtors');
    await page.locator('header nav').locator('text=Clients').click();
    await expect(page).toHaveURL(/\/clients/);
  });

  test('T5-B: clicking Debtors nav link goes to /debtors', async ({ page }) => {
    await page.locator('header nav').locator('text=Debtors').click();
    await expect(page).toHaveURL(/\/debtors/);
  });

  test('T5-C: clicking Import Queue nav link goes to /queue', async ({ page }) => {
    await page.locator('header nav').locator('text=Import Queue').click();
    await expect(page).toHaveURL(/\/queue/);
  });

  test('T5-D: clicking Aging Report nav link goes to /aging', async ({ page }) => {
    await page.locator('header nav').locator('text=Aging Report').click();
    await expect(page).toHaveURL(/\/aging/);
  });

  test('T5-E: clicking Smithers logo navigates to / then redirects to /clients', async ({ page }) => {
    await page.goto('/debtors');
    await page.locator('text=Smithers').first().click();
    await expect(page).toHaveURL(/\/clients/);
  });
});

// ─── T6: API auth enforcement ─────────────────────────────────────────────────

test.describe('T6 – API auth enforcement', () => {
  test('T6-A: unauthenticated request to /api/clients returns 401', async ({ request }) => {
    const res = await request.get('http://localhost:5088/api/clients');
    expect(res.status()).toBe(401);
  });

  test('T6-B: unauthenticated request to /api/debtors returns 401', async ({ request }) => {
    const res = await request.get('http://localhost:5088/api/debtors');
    expect(res.status()).toBe(401);
  });

  test('T6-C: authenticated request to /api/clients returns 200 with empty array', async ({ page }) => {
    await loginAsTestUser(page);

    // Extract the real Supabase token from the browser storage
    const token = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const sessionKey = keys.find(k => k.includes('auth-token') || k.includes('supabase'));
      if (!sessionKey) return null;
      try {
        const parsed = JSON.parse(localStorage.getItem(sessionKey) || '{}');
        return parsed?.access_token ?? parsed?.session?.access_token ?? null;
      } catch { return null; }
    });

    expect(token).not.toBeNull();

    const res = await page.request.get('http://localhost:5088/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── T7: Admin login ──────────────────────────────────────────────────────────

test.describe('T7 – Admin login', () => {
  test('T7-A: admin credentials redirect to /clients', async ({ page }) => {
    await login(page, CREDS.admin.email, CREDS.admin.password);
    await expect(page).toHaveURL(/\/clients/, { timeout: 10_000 });
  });

  test('T7-B: Admin nav item IS visible for role=admin', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('header nav').locator('text=Admin')).toBeVisible();
  });

  test('T7-C: Admin page loads without redirect', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('header nav').locator('text=Admin').click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('T7-D: non-admin cannot access /admin (no Admin nav item)', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/admin');
    // Admin page either redirects away or renders nothing meaningful
    // — Admin nav item must still be absent
    await expect(page.locator('header nav').locator('text=Admin')).not.toBeVisible();
  });
});

// ─── T8: Logout ───────────────────────────────────────────────────────────────

test.describe('T8 – Logout', () => {
  test('T8-A: clicking Log out redirects to /login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.locator('header button').filter({ hasText: CREDS.user.email[0].toUpperCase() }).click();
    await page.locator('text=Log out').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test('T8-B: after logout, visiting /clients bounces back to /login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.locator('header button').filter({ hasText: CREDS.user.email[0].toUpperCase() }).click();
    await page.locator('text=Log out').click();
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login/);
  });
});
