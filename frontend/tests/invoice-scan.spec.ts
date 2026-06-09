import { expect } from '@playwright/test';
import { test, injectMockSession, corsHeaders } from './ns-queue/fixtures';

test.describe('Invoice OCR Scan', () => {
  const mockScanResult = {
    rawDocumentPath: 'invoices-raw/test-uuid.pdf',
    fields: [
      { fieldName: 'invoiceNumber', extractedValue: 'INV-2024-001', confidence: 0.97 },
      { fieldName: 'invoiceDate',   extractedValue: '2024-03-15',   confidence: 0.91 },
      { fieldName: 'amount',        extractedValue: '4250.00',      confidence: 0.55 }, // low confidence
      { fieldName: 'vendorName',    extractedValue: 'ACME Corp',    confidence: 0.88 },
      { fieldName: 'customerName',  extractedValue: 'Wayne Ent',    confidence: 0.76 },
    ]
  };

  test.beforeEach(async ({ page }) => {
    await injectMockSession(page);
    await page.route('**/api/clients', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: [{ id: '1', shortcode: 'ACME', cadenceName: 'Acme Corp' }] });
    });
    await page.route('**/api/debtors', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: [{ id: 'd-1', name: 'Existing Debtor' }] });
    });
  });

  test('S1: /scan renders drop zone initially', async ({ page }) => {
    await page.goto('/scan');
    await expect(page.locator('text=Upload an invoice')).toBeVisible();
  });

  test('S2: Uploading valid PDF calls api/ocr/scan', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    await expect(page.locator('text=Review Extracted Data')).toBeVisible();
  });

  test('S5, S6: Extracted fields rendered; Low-confidence visually flagged', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    await expect(page.locator('input#amount')).toHaveClass(/border-amber-400/);
    await expect(page.locator('input#invoiceNumber')).toHaveValue('INV-2024-001');
  });

  test('S7: User can edit field value', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    await page.fill('input#amount', '5000.00');
    await expect(page.locator('input#amount')).toHaveValue('5000.00');
  });

  test('S8: Dropdowns populate', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    
    // Client dropdown
    await expect(page.locator('button[role="combobox"]').nth(1)).toBeVisible();
    
    // Debtor dropdown
    await expect(page.locator('button[role="combobox"]').nth(0)).toBeVisible();
  });

  test('S10: Confirm calls api/ocr/confirm', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.route('**/api/ocr/confirm', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: { invoiceId: 'OCR-123', notificationSheetId: null } });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    
    // Fill client
    await page.click('button[role="combobox"]:has-text("Select a client")');
    await page.click('text=Acme Corp (ACME)');
    
    await page.click('button:has-text("Confirm Invoice")');
    await expect(page.locator('text=Invoice Confirmed!')).toBeVisible();
    await expect(page.locator('text=OCR-123')).toBeVisible();
  });

  test('S11: Scan Another resets flow', async ({ page }) => {
    await page.route('**/api/ocr/scan', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: mockScanResult });
    });
    await page.route('**/api/ocr/confirm', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: corsHeaders, status: 204 });
      await route.fulfill({ headers: corsHeaders, json: { invoiceId: 'OCR-123' } });
    });
    await page.goto('/scan');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
    });
    
    await page.click('button[role="combobox"]:has-text("Select a client")');
    await page.click('text=Acme Corp (ACME)');
    await page.click('button:has-text("Confirm Invoice")');
    
    await page.click('button:has-text("Scan Another")');
    await expect(page.locator('text=Upload an invoice')).toBeVisible();
  });
});
