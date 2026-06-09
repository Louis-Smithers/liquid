import { test, expect } from './fixtures';

test.describe('NS Queue - Builder', () => {
  test('T9: Builder happy path (end-to-end create)', async ({ page, mockState }) => {
    mockState.sheets = []; // Start fresh
    mockState.nextId = 1;

    await page.goto('/ns-queue');
    await page.getByRole('button', { name: /New NS/i }).click();

    // Select ACME
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /ACME/i }).click();

    // Invoices load. We have 2 Pre-Verified for ACME in the mock.
    // Let's assert they are there.
    await expect(page.getByText('INV-001')).toBeVisible();
    await expect(page.getByText('INV-002')).toBeVisible();

    // Select both via checkboxes
    // The exact label/role might differ, we can just use the first/last or click the checkboxes
    const checkboxes = page.getByRole('checkbox');
    // The first checkbox is 'select all'
    await checkboxes.first().click();

    // Total Amount = sum = 1500
    // Initial Fee % = 5% (0.05 from ACME discountRate)
    // Reserve Fee % = 10% (0.10 from ACME reserveRate)
    
    // Total Fee = 1500 * 0.05 = 75
    // Reserves = 1500 * 0.10 = 150
    // Advance = 1500 - 75 - 150 = 1275

    // Check these values exist on the page
    await expect(page.getByText('$1,500.00')).toBeVisible(); // Total
    await expect(page.getByText('$1,275.00')).toBeVisible(); // Advance, optional exact check

    // Click Save Draft
    await page.getByRole('button', { name: /Save Draft/i }).click();

    // Assert returns to list view
    await expect(page).toHaveURL(/.*\/ns-queue$/);

    // New Draft present with correct item count (2) and total
    const row = page.locator('tr').filter({ hasText: 'ACME' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: '2', exact: true })).toBeVisible(); // Item count
    await expect(row.getByText('$1,500.00')).toBeVisible(); // Total amount
  });

  test('T10: Privacy toggle (default shared)', async ({ page, mockState }) => {
    mockState.sheets = [];
    
    await page.goto('/ns-queue');
    await page.getByRole('button', { name: /New NS/i }).click();

    // Select ACME
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /ACME/i }).click();

    // Select 1 invoice
    await page.getByRole('checkbox').first().click();

    // The toggle defaults to Shared (Unlock icon). Click -> Private (Lock)
    // The test plan says button name might be Shared/Private/Make Private
    const privacyButton = page.getByRole('button', { name: /Shared|Make Private/i });
    await expect(privacyButton).toBeVisible();
    await privacyButton.click();
    // After click it should say Private or Make Shared
    await expect(page.getByRole('button', { name: /Private|Make Shared/i })).toBeVisible();

    await page.getByRole('button', { name: /Save Draft/i }).click();

    // Wait for save and navigate back
    await expect(page).toHaveURL(/.*\/ns-queue$/);

    // Assert created sheet isShared: false
    const sheet = mockState.sheets.find(s => s.clientShortcode === 'ACME');
    expect(sheet).toBeDefined();
    expect(sheet?.isShared).toBe(false);

    // Panel variant: toggle from panel
    await page.goto('/clients');
    await page.getByText('ACME Corp').click(); // Opens drawer -> opens panel
    
    const panelPrivacyBtn = page.locator('aside').filter({ hasText: 'NS Queue' }).getByRole('button', { name: /Private|Make Shared/i });
    await panelPrivacyBtn.dispatchEvent('click');
    await page.waitForTimeout(500);
    
    // Expect state updated
    await expect.poll(() => mockState.sheets.find(s => s.clientShortcode === 'ACME')?.isShared).toBe(true);
  });

  test('T13: Delete draft from list', async ({ page, mockState }) => {
    mockState.invoices = [
      { id: 'inv-1', invoiceId: 'inv-1', invoiceNumber: 'INV-001', originalInvoice: 'INV-001', liquidClient: 'ACME', amount: 1000, date: '2026-06-05', status: 'Pre-Verified' },
      { id: 'inv-2', invoiceId: 'inv-2', invoiceNumber: 'INV-002', originalInvoice: 'INV-002', liquidClient: 'ACME', amount: 500, date: '2026-06-05', status: 'Pre-Verified' },
    ];
    mockState.sheets = [
      {
        id: 'ns-1',
        clientShortcode: 'ACME',
        status: 'Draft',
        isShared: true,
        displayName: 'ACME - Draft',
        totalAmount: 1000,
        itemCount: 1,
        items: [],
        createdBy: 'test'
      }
    ];

    await page.goto('/ns-queue');

    // Find row and click delete
    const row = page.locator('tr').filter({ hasText: 'ACME - Draft' });
    const deleteBtn = row.getByRole('button', { name: /Delete|Remove|Trash/i });
    // Confirm dialog might pop up
    // Setup dialog handler if window.confirm
    page.once('dialog', dialog => dialog.accept());
    await deleteBtn.click();

    // Row removed
    await expect(row).not.toBeVisible();
    expect(mockState.sheets.length).toBe(0);
  });
});
