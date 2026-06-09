import { test, expect } from './fixtures';

test.describe('NS Queue - Panel', () => {
  test('T4: Panel opens with ClientDrawer + main content shifts', async ({ page, mockState }) => {
    mockState.sheets = [
      { id: 'ns-1', displayName: 'ACME - Draft', clientShortcode: 'ACME', itemCount: 2, totalAmount: 1500, status: 'Draft', isShared: true, items: [
        { id: 'it-1', invoiceId: 'inv-1', invoiceNumber: 'INV-001', debtorName: 'Mock', includedAmount: 1000 }
      ] }
    ];
    // Go to clients page
    await page.goto('/clients');

    // Click a client row to open drawer
    // The test mock gives us an ACME and GLOBEX client
    await page.getByText('ACME Corp').click();

    // Assert panel is visible
    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });
    await expect(panel).toBeVisible();
    // Assuming panel has translate-x-0 or similar, Playwright's toBeVisible covers the basic visible check.
    // Assert client shortcode badge is visible in the panel
    await expect(panel.getByText('ACME', { exact: true })).toBeVisible();

    // Assert <main> gains left margin
    const main = page.locator('main');
    await expect(main).toHaveClass(/ml-80/);

    // Close drawer
    await page.getByRole('button', { name: /Close/i }).click();

    // The drawer might close, panel might stay or close depending on implementation.
    // The test plan says "panel state per spec (activeQueue clears; panel may stay open if toggled)".
  });

  test('T5: Standalone panel toggle (no drawer)', async ({ page, mockState }) => {
    await page.goto('/clients');

    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });

    // Assuming initially closed or hidden
    // Click header Queue button (ShoppingCart icon)
    const queueToggle = page.getByRole('button', { name: /Queue/i }).first();
    await queueToggle.click();

    await expect(panel).toBeVisible();

    // Click again to close
    await queueToggle.click();
    await expect(panel).toHaveClass(/-translate-x-full/);
  });

  test('T8: Remove item from panel', async ({ page, mockState }) => {
    // With >= 1 item in active queue
    mockState.sheets = [
      {
        id: 'ns-1',
        clientShortcode: 'ACME',
        status: 'Draft',
        isShared: true,
        displayName: 'ACME - Draft',
        totalAmount: 1000,
        itemCount: 1,
        items: [
          {
            id: 'it-1',
            notificationSheetId: 'ns-1',
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            debtorName: 'Mock Debtor',
            date: '2026-06-05',
            includedAmount: 1000
          }
        ],
        createdBy: 'test'
      }
    ];

    await page.goto('/clients');
    
    // Open panel manually or via drawer
    const queueToggle = page.getByRole('button', { name: /Queue/i }).first();
    await queueToggle.click();

    // The active queue might need a client selected, let's open the drawer to be sure
    await page.getByText('ACME Corp').click();

    // Assert item is in panel
    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });
    await expect(panel.getByText('INV-001')).toBeVisible();

    // Hover panel item, click trash icon
    // It might be a trash icon inside the item row
    const itemRow = panel.locator('.group').filter({ hasText: 'INV-001' });
    const deleteBtn = itemRow.getByRole('button', { name: /remove|delete|trash/i });
    
    // We might need to hover if it's hidden behind group-hover
    await itemRow.hover();
    await deleteBtn.dispatchEvent('click');

    // Assert item disappears
    await expect(panel.getByText('INV-001')).not.toBeVisible();

    // Assert TopNav badge decrements (since mock decrements automatically)
    // The top nav link should now be empty or 0 if badge hides, or just not 1
    const navLink = page.locator('nav').getByRole('link', { name: /NS Queue/i });
    await expect(navLink).not.toContainText('1');
  });

  test('T12: Empty states', async ({ page, mockState }) => {
    // 1. Active queue with 0 items -> panel shows "No items in queue."
    mockState.sheets = [
      {
        id: 'ns-1',
        clientShortcode: 'ACME',
        status: 'Draft',
        isShared: true,
        displayName: 'ACME - Draft',
        totalAmount: 0,
        itemCount: 0,
        items: [],
        createdBy: 'test'
      }
    ];

    await page.goto('/clients');
    await page.getByText('ACME Corp').click();
    
    const panel = page.locator('aside').filter({ hasText: 'NS Queue' });
    await expect(panel.getByText(/No items in queue/i)).toBeVisible();

    // 2. Builder with a client that has 0 eligible invoices -> "No eligible invoices found for this client."
    mockState.invoices = []; // Clear invoices

    await page.goto('/ns-queue');
    await page.getByRole('button', { name: /New NS/i }).click();
    
    // Select ACME
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /ACME/i }).click();

    await expect(page.getByText(/No eligible invoices found for this client/i)).toBeVisible();
  });
});
