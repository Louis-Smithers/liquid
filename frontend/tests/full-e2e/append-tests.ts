
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
    await expect(page.getByText(/Import Review Queue/i)).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('11.1 Aging loads', async ({ page }) => {
    await page.goto('/aging');
    await expect(page.getByText(/Aging Report/i)).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });
});

// ─── Section 12: Admin ──────────────────────────────────────────────────────────
test.describe('S12 — Admin', () => {
  test('12.1-12.2 admin tools load', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await expect(page.getByText(/Admin Panel/i)).toBeVisible();
    
    const usersTab = page.getByRole('tab', { name: /Users/i });
    if (await usersTab.count() > 0) {
      await usersTab.click();
      await expect(usersTab).toHaveAttribute('data-state', 'active');
    }
  });
});
