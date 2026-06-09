/**
 * Smithers — Full browser E2E (sections 1–7 of .claude/full-browser-test-plan.md)
 *
 * Real app + real backend. Run:
 *   npx playwright test full-e2e --headed
 *
 * Data-dependent tests skip gracefully when the DB has no clients/invoices, so an
 * empty environment reports "skipped" rather than a false failure. Selectors are
 * taken from the live components (TopNav, NSQueuePage, NSQueueUploadPage).
 *
 * Known-placeholder areas (asserted loosely on purpose — NOT failures):
 *   - /scan and /gate are mocked UIs.
 *   - The upload "Verify" step renders a placeholder PDF pane and its Confirm button
 *     posts hardcoded data, so this suite validates upload→OCR→Ready→verify-panel
 *     only; it does not assert field editing or PDF rendering there.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { CREDS, login, loginAsUser, loginAsAdmin, DEMO_INVOICE } from './helpers';

// ─── Section 1: Authentication & access control ────────────────────────────────
test.describe('S1 — Auth & access control', () => {
  test('1.1 unauthenticated /clients redirects to /login', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login/);
  });

  test('1.2 wrong password shows error, stays on /login', async ({ page }) => {
    await login(page, CREDS.user.email, 'definitely-wrong-pw');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[class*="destructive"]').first()).toBeVisible();
  });

  test('1.3 valid login lands in app with TopNav', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.locator('header nav')).toBeVisible();
  });

  test('1.4 session persists across reload', async ({ page }) => {
    await loginAsUser(page);
    await page.reload();
    await expect(page).toHaveURL(/\/clients/);
  });

  test('1.6/1.7 admin nav visibility by role', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('header nav').getByText('Admin')).toBeVisible();
  });

  test('1.x API rejects unauthenticated request (401)', async ({ request }) => {
    const res = await request.get('http://localhost:5088/api/clients');
    expect(res.status()).toBe(401);
  });
});

// ─── Section 2: Navigation ──────────────────────────────────────────────────────
test.describe('S2 — Navigation', () => {
  test.beforeEach(async ({ page }) => loginAsUser(page));

  for (const [label, url] of [
    ['Debtors', /\/debtors/],
    ['Import Queue', /\/queue/],
    ['Aging Report', /\/aging/],
    ['NS Queue', /\/ns-queue/],
  ] as const) {
    test(`2.1 nav → ${label}`, async ({ page }) => {
      await page.locator('header nav').getByText(label, { exact: false }).first().click();
      await expect(page).toHaveURL(url);
    });
  }
});

// ─── Section 3: Clients + Client Drawer ─────────────────────────────────────────
test.describe('S3 — Clients', () => {
  test.beforeEach(async ({ page }) => loginAsUser(page));

  test('3.1 client list loads', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('3.3–3.6 open drawer and walk the 4 tabs', async ({ page }) => {
    await page.goto('/clients');
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() === 0) test.skip(true, 'No clients in DB');
    await firstRow.click();

    for (const tab of ['Overview', 'Debtors', 'Invoices', 'Client Details']) {
      const t = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      if (await t.count()) {
        await t.click();
        await expect(t).toHaveAttribute('data-state', 'active');
      }
    }
  });
});

// ─── Section 4: Debtors ─────────────────────────────────────────────────────────
test.describe('S4 — Debtors', () => {
  test('4.1 debtor list loads', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/debtors');
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Section 5 & 6: NS Queue list, builder, submit, PDF ─────────────────────────
test.describe('S6 — NS Queue list / builder / submit / PDF', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/ns-queue');
  });

  test('6.1 list + filters render', async ({ page }) => {
    await expect(page.getByText('Notification Sheets Queue')).toBeVisible();
    for (const f of ['DRAFT', 'SUBMITTED', 'ALL']) {
      await page.getByRole('button', { name: f, exact: true }).click();
    }
  });

  test('6.3–6.6 build a draft (initial fee 3%, reserve 20%, other 25)', async ({ page }) => {
    await page.getByRole('button', { name: /New NS/i }).click();

    const combo = page.getByRole('combobox').first();
    await combo.click();
    const opt = page.getByRole('option').first();
    if (await opt.count() === 0) test.skip(true, 'No clients to build a sheet');
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/invoices/client/'));
    await opt.click();
    await responsePromise;

    // The first checkbox is the 'Select All' in the header. The row checkboxes follow.
    const rowCheckboxes = page.locator('tbody input[type="checkbox"], tbody [role="checkbox"]');
    if (await rowCheckboxes.count() === 0) test.skip(true, 'No eligible invoices for this client');
    
    // Click Select All
    await page.getByRole('checkbox').first().click();

    // Calculator inputs (live-recompute the Advance Amount).
    await page.getByLabel(/Initial Fee/i).fill('3');
    await page.getByLabel(/Reserve Fee/i).fill('20');
    await page.getByLabel(/Other Fee/i).fill('25');

    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page).toHaveURL(/\/ns-queue$/);
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('6.8–6.9 submit a draft, then download its PDF', async ({ page }) => {
    // Find a Draft row with a Submit button; skip if none exist.
    const submitBtn = page.getByRole('button', { name: /^Submit$/ }).first();
    if (await submitBtn.count() === 0) test.skip(true, 'No Draft sheet to submit');
    await submitBtn.click();

    // After submit, a Download PDF button should be available somewhere in the list.
    const dl = page.getByRole('button', { name: /Download PDF/i }).first();
    await expect(dl).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await dl.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});

// ─── Section 7: NS Queue Upload flow (upload → OCR → Ready → verify panel) ───────
test.describe('S7 — OCR upload flow', () => {
  test('7.1–7.4 upload a PDF, poll to Ready, reach the verify step', async ({ page }) => {
    const pdfPath = path.resolve(process.cwd(), DEMO_INVOICE);
    if (!fs.existsSync(pdfPath)) test.skip(true, `Demo invoice missing at ${pdfPath}`);

    await loginAsUser(page);
    await page.goto('/ns-queue/upload');

    // FileDropZone exposes a (possibly hidden) file input.
    await page.locator('input[type="file"]').setInputFiles(pdfPath);
    await expect(page.getByText(/Selected Files/i)).toBeVisible();

    await page.getByRole('button', { name: /Start Upload & OCR/i }).click();

    // Step 2 (processing) → Step 3 (verify). Tesseract can take several seconds.
    await expect(page.getByText(/Verify Data/i)).toBeVisible({ timeout: 60_000 });

    // At least one extracted field rendered (amount is the reliable one today).
    await expect(page.locator('input').first()).toBeVisible();

    // NOTE: Confirm is intentionally not asserted here — the verify form is a
    // placeholder that posts hardcoded data and depends on a "TEST" client existing.
    // Wire real field→payload binding before adding a confirm assertion.
  });
});

// ─── Section 8: Invoice Scan (legacy) ───────────────────────────────────────────
test.describe('S8 — Invoice Scan (legacy)', () => {
  test('8.1–8.3 upload, review, confirm, and scan another', async ({ page }) => {
    const pdfPath = path.resolve(process.cwd(), DEMO_INVOICE);
    if (!fs.existsSync(pdfPath)) test.skip(true, `Demo invoice missing at ${pdfPath}`);

    await loginAsUser(page);
    await page.goto('/scan');

    await page.locator('input[type="file"]').setInputFiles(pdfPath);
    await expect(page.getByText(/Review Extracted Data/i)).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /Confirm/i }).click();

    await expect(page.getByText(/Invoice Confirmed!/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Scan Another/i }).click();
    await expect(page.getByText(/Upload an invoice to extract data automatically/i)).toBeVisible();
  });
});

// ─── Section 9: The Gate ────────────────────────────────────────────────────────
test.describe('S9 — The Gate', () => {
  test('9.1–9.3 load gate, click invoice, verify UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/gate/ACME_INV-2023-001');

    await expect(page.getByText('Document Viewer')).toBeVisible();
    await expect(page.getByText('Extracted Data')).toBeVisible();

    await page.getByText('INV-402').click();
    await expect(page).toHaveURL(/\/gate\/GLOBEX_INV-402/);

    await expect(page.getByRole('button', { name: /Verify & Save/i })).toBeVisible();
  });
});

// ─── Section 10 & 11: Import Queue and Aging ────────────────────────────────────
test.describe('S10 & S11 — Import Queue & Aging', () => {
  test.beforeEach(async ({ page }) => loginAsUser(page));

  test('10.1 Import Queue loads', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { name: /Import Review Queue/i }).first()).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('11.1 Aging loads', async ({ page }) => {
    await page.goto('/aging');
    await expect(page.getByRole('heading', { name: /Aging Report/i }).first()).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });
});

// ─── Section 12: Admin ──────────────────────────────────────────────────────────
test.describe('S12 — Admin', () => {
  test('12.1-12.2 admin tools load', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Admin Panel/i }).first()).toBeVisible();
    
    const usersTab = page.getByRole('tab', { name: /Users/i });
    if (await usersTab.count() > 0) {
      await usersTab.click();
      await expect(usersTab).toHaveAttribute('data-state', 'active');
    }
  });
});
