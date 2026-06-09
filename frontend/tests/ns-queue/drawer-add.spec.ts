import { test, expect } from './fixtures';

test.describe('NS Queue - Drawer Add', () => {
  test('T6: Add invoice from ClientDrawer (auto-creates draft)', async ({ page, mockState }) => {
    // Start with 0 drafts
    mockState.sheets = [];
    // We already have some invoices for ACME in the mock state

    await page.goto('/clients');
    
    // Open client drawer
    await page.getByText('ACME Corp').click();

    // Go to Invoices tab
    await page.getByRole('tab', { name: /Invoices/i }).click();

    // Click + (Add to NS Queue) on a row
    // The button might have title "Add to NS Queue" or text "+"
    const addButton = page.getByRole('button', { name: /Add to NS Queue/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Assert a draft was created
    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });
    await expect(panel.getByText('INV-001')).toBeVisible();

    // Row button flips to Check (disabled, In Queue)
    // The button might change to title "In Queue" or visually change
    await expect(page.getByRole('button', { name: /In Queue/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /In Queue/i }).first()).toBeDisabled();

    // TopNav badge increments
    const navLink = page.locator('nav').getByRole('link', { name: /NS Queue/i });
    await expect(navLink).toContainText('1');
  });

  test('T7: DebtorDrawer cross-client add (RISK CASE)', async ({ page, mockState }) => {
    // Mock a debtor whose invoices are from TWO clients
    mockState.sheets = [];
    mockState.invoices = [
      { id: 'inv-1', invoiceId: 'inv-1', invoiceNumber: 'INV-001', originalInvoice: 'INV-001', liquidClient: 'ACME', debtorName: 'Cross Debtor', amount: 1000, date: '2026-06-05', status: 'Pre-Verified' },
      { id: 'inv-2', invoiceId: 'inv-2', invoiceNumber: 'INV-002', originalInvoice: 'INV-002', liquidClient: 'GLOBEX', debtorName: 'Cross Debtor', amount: 500, date: '2026-06-05', status: 'Pre-Verified' },
    ];

    await page.goto('/debtors');

    // Open debtor drawer
    await page.getByText('Cross Debtor').first().click();

    // Wait for the invoices tab or just the list of invoices
    // Assume activeClient is set to the first invoice's client (ACME)
    // Click + on the invoice from GLOBEX (inv-2)
    const globexRow = page.locator('tr').filter({ hasText: 'GLOBEX' });
    const globexAddButton = globexRow.getByRole('button', { name: /Add to NS Queue/i });
    await globexAddButton.click();

    // Let's also add the ACME one to test both just in case, but let's stick to the GLOBEX one.
    
    // Assert the item lands in the correct client's queue (GLOBEX)
    // Verify the state explicitly shows 1 item in the GLOBEX sheet
    await expect.poll(() => mockState.sheets.find(s => s.clientShortcode === 'GLOBEX')?.items.length).toBe(1);
    await expect.poll(() => mockState.sheets.find(s => s.clientShortcode === 'GLOBEX')?.items[0]?.invoiceId).toBe('inv-2');
    
    // This expects the UI to update with GLOBEX
    // or the state.sheets to have a sheet for GLOBEX
    
    // We can directly assert the UI:
    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });
    await expect(panel).toBeVisible();
    
    await expect(panel.getByText('GLOBEX', { exact: true })).toBeVisible();
    await expect(panel.getByText('INV-002')).toBeVisible();

    // If it lands in the wrong queue, it would say ACME and show INV-002, which is the bug described.
  });

  test('T11: ClientDrawer 4-tab redesign', async ({ page, mockState }) => {
    await page.goto('/clients');
    
    // Open client drawer
    await page.getByText('ACME Corp').click();

    // Assert exactly 4 tabs
    await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Debtors/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Invoices/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Client Details/i })).toBeVisible();

    // Overview metric cards
    await page.getByRole('tab', { name: /Overview/i }).click();
    await expect(page.getByText(/Total Open Invoices/i)).toBeVisible();
    await expect(page.getByText(/Total Amount/i)).toBeVisible();

    // Client Details edit
    await page.getByRole('tab', { name: /Client Details/i }).click();
    
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('updated@acme.com');
    
    // The plan required asserting PUT /api/clients/{shortcode} fires.
    const savePromise = page.waitForResponse(r => r.url().includes('/api/clients/ACME') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /Save Details/i }).click();
    
    const response = await savePromise;
    expect(response.ok()).toBeTruthy();
  });
});
