import { expect } from '@playwright/test';
import { test, injectMockSession, corsHeaders } from './ns-queue/fixtures';

test.describe('Auth Flow', () => {
  test('A1: Unauthenticated user visiting /clients is redirected to /login', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/.*login/);
  });

  test('A2: Login page renders email + password fields and a Request Access link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Request Access')).toBeVisible();
  });

  test('A3: Valid credentials redirect to /clients', async ({ page }) => {
    await page.route('**/auth/v1/token?grant_type=password', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({
        headers: corsHeaders,
        json: {
          access_token: 'fake-token',
          user: { id: '123', email: 'test@example.com', app_metadata: { role: 'user' } }
        }
      });
    });
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*clients/);
  });

  test('A4: Invalid credentials show error', async ({ page }) => {
    await page.route('**/auth/v1/token?grant_type=password', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({
        headers: corsHeaders,
        status: 400,
        json: { error: 'invalid_grant', error_description: 'Invalid login credentials' }
      });
    });
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid login credentials')).toBeVisible();
  });

  test('A5: First-login user forced to /change-password', async ({ page }) => {
    await injectMockSession(page, { mustChangePassword: true });
    await page.goto('/clients');
    await expect(page).toHaveURL(/.*change-password/);
  });

  test('A6: On /change-password, attempting to navigate away blocks and shows change-password', async ({ page }) => {
    await injectMockSession(page, { mustChangePassword: true });
    await page.goto('/clients');
    await expect(page).toHaveURL(/.*change-password/);
    await page.goto('/clients');
    await expect(page).toHaveURL(/.*change-password/);
  });

  test('A7: Submitting mismatched passwords on /change-password', async ({ page }) => {
    await injectMockSession(page, { mustChangePassword: true });
    await page.goto('/change-password');
    await page.fill('input[placeholder="New Password"]', 'pass123');
    await page.fill('input[placeholder="Confirm New Password"]', 'pass456');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('A8: Successful password change', async ({ page }) => {
    await injectMockSession(page, { mustChangePassword: true });
    
    await page.route('**/api/users/me/clear-must-change-password', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, status: 200 });
    });
    await page.route('**/auth/v1/user', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, status: 200, json: { id: '123' } });
    });

    await page.goto('/change-password');
    await page.fill('input[placeholder="New Password"]', 'pass123');
    await page.fill('input[placeholder="Confirm New Password"]', 'pass123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*clients/);
  });

  test('A9: Logout clears session', async ({ page }) => {
    await injectMockSession(page);
    await page.route('**/auth/v1/logout', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      route.fulfill({ headers: corsHeaders, status: 204 })
    });
    await page.goto('/clients');
    await page.click('button:has-text("Logout")').catch(() => page.click('text=Logout'));
    await expect(page).toHaveURL(/.*login/);
  });

  test('A10: Request Access form validation', async ({ page }) => {
    await page.goto('/request-access');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*request-access/);
  });

  test('A11: Valid access request form', async ({ page }) => {
    await page.route('**/api/users/requests', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, status: 200 });
    });
    await page.goto('/request-access');
    await page.fill('#firstName', 'John');
    await page.fill('#lastName', 'Doe');
    await page.fill('#email', 'john@example.com');
    await page.fill('#usernameWanted', 'johndoe');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Request Submitted')).toBeVisible();
  });
});
