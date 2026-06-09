import { expect } from '@playwright/test';
import { test, injectMockSession, corsHeaders } from './ns-queue/fixtures';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/requests', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'req-1', email: 'user@example.com', firstName: 'User', lastName: 'Test', usernameWanted: 'user1', status: 'Pending' }]
      });
    });
  });

  test('B1: Admin nav link is visible only when role is admin', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    await page.goto('/clients');
    await expect(page.locator('text=Admin')).toBeVisible();
  });

  test('B2: Non-admin visiting /admin directly is denied', async ({ page }) => {
    await injectMockSession(page, { role: 'user' });
    await page.goto('/admin');
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });

  test('B3: Admin sees list of pending access requests', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    await page.goto('/admin');
    await expect(page.locator('text=user@example.com')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  test('B4: Admin clicks Approve opens Dialog', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    await page.goto('/admin');
    await page.click('button:has-text("Approve")');
    await expect(page.locator('h2:has-text("Approve Request")')).toBeVisible();
  });

  test('B5: Admin approves with temp password updates status', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    
    await page.route('**/api/admin/requests/*/approve', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, status: 200 });
    });
    
    await page.goto('/admin');
    await page.click('button:has-text("Approve")');
    await page.fill('input[placeholder="Temporary Password"]', 'newPass123');
    
    // Setup reload mock
    await page.route('**/api/admin/requests', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'req-1', email: 'user@example.com', firstName: 'User', lastName: 'Test', usernameWanted: 'user1', status: 'Approved' }]
      });
    });

    await page.click('button:has-text("Approve")');
    await expect(page.locator('text=Notification')).toBeVisible(); // Shadcn alert modal
    await expect(page.locator('text=newPass123')).toBeVisible();
  });

  test('B6: Admin clicks Deny opens Dialog and denys', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    
    await page.route('**/api/admin/requests/*/deny', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, status: 200 });
    });
    
    await page.goto('/admin');
    await page.click('button:has-text("Deny")');
    await expect(page.locator('h2:has-text("Deny Request")')).toBeVisible();
    
    await page.route('**/api/admin/requests', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'req-1', email: 'user@example.com', firstName: 'User', lastName: 'Test', usernameWanted: 'user1', status: 'Denied' }]
      });
    });

    // We have multiple Deny buttons (one in row, one in modal). 
    // The modal one should be inside dialog
    await page.click('div[role="dialog"] button:has-text("Deny")');
    await expect(page.locator('text=Denied')).toBeVisible();
  });

  test('B8: No pending requests shows empty state', async ({ page }) => {
    await injectMockSession(page, { role: 'admin' });
    await page.route('**/api/admin/requests', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: [] });
    });
    await page.goto('/admin');
    await expect(page.locator('text=No pending requests')).toBeVisible();
  });
});
