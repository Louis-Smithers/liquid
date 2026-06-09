import { Page } from '@playwright/test';

/**
 * Shared helpers for the full browser E2E suite (see full-flow.spec.ts).
 *
 * These tests hit the REAL app at http://localhost:5173 (baseURL in
 * playwright.config.ts) with the REAL backend on :5088 — no request mocking.
 * Prereqs: `npm run dev` (frontend) + `dotnet run` (backend) + reachable DB.
 *
 * Credentials come from env so nothing secret is committed. Fallbacks are the
 * known local test accounts; rotate them and prefer env in any shared setting:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD   (role: user)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (role: admin)
 */
export const CREDS = {
  user: {
    email: process.env.E2E_USER_EMAIL ?? 'testuser@smithers.local',
    password: process.env.E2E_USER_PASSWORD ?? 'Test1234!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@smithers.local',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!',
  },
};

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

export async function loginAsUser(page: Page) {
  await login(page, CREDS.user.email, CREDS.user.password);
  await page.waitForURL('**/clients', { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
  await login(page, CREDS.admin.email, CREDS.admin.password);
  await page.waitForURL('**/clients', { timeout: 15_000 });
}

/** A representative Pane Vita demo invoice for the OCR upload flow. */
export const DEMO_INVOICE = '../invoices/invoices-demo/206266 Elizabeth PO# 1003218749.pdf';
