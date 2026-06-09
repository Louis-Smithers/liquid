import { test, expect } from './fixtures';

test.describe('NS Queue - List and Navigation', () => {
  test('T1: Nav link + route renders', async ({ page, mockState }) => {
    // Go to home page
    await page.goto('/');

    // Click NS Queue nav link
    const navLink = page.locator('nav').getByRole('link', { name: /NS Queue/i });
    await navLink.click();

    // Assert URL
    await expect(page).toHaveURL(/.*\/ns-queue/);

    // Assert heading
    await expect(page.getByRole('heading', { name: /Notification Sheets Queue/i })).toBeVisible();

    // Assert filter chips
    await expect(page.getByRole('button', { name: /ALL/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /DRAFT/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /SUBMITTED/i })).toBeVisible();

    // Assert New NS button
    await expect(page.getByRole('button', { name: /New NS/i })).toBeVisible();
  });

  test('T2: Draft count badge reflects backend', async ({ page, mockState }) => {
    // Modify mock state to have 3 items in a draft sheet
    mockState.sheets = [
      {
        id: 'ns-draft',
        clientShortcode: 'ACME',
        status: 'Draft',
        isShared: true,
        displayName: 'ACME - Draft',
        totalAmount: 100,
        itemCount: 3,
        items: [{ id: 'it-1' }, { id: 'it-2' }, { id: 'it-3' }],
        createdBy: 'test'
      }
    ];

    // Reload page
    await page.goto('/');

    // Assert TopNav badge shows 3
    const navLink = page.locator('nav').getByRole('link', { name: /NS Queue/i });
    await expect(navLink).toContainText('3');

    // Go to clients page
    await page.goto('/clients');
    
    // Assert Queue button on ClientsPage header shows 3
    const queueButton = page.getByRole('button', { name: /Queue/i });
    await expect(queueButton).toContainText('3');
  });

  test('T3: Queue list renders + status filter', async ({ page, mockState }) => {
    // Seed mock with 2 Draft + 1 Submitted
    mockState.sheets = [
      {
        id: 'ns-draft-1',
        clientShortcode: 'ACME',
        status: 'Draft',
        isShared: true,
        displayName: 'ACME - Draft 1',
        totalAmount: 1000,
        itemCount: 2,
        items: [],
        createdBy: 'test'
      },
      {
        id: 'ns-draft-2',
        clientShortcode: 'GLOBEX',
        status: 'Draft',
        isShared: true,
        displayName: 'GLOBEX - Draft 2',
        totalAmount: 500,
        itemCount: 1,
        items: [],
        createdBy: 'test'
      },
      {
        id: 'ns-sub-1',
        clientShortcode: 'ACME',
        status: 'Submitted',
        isShared: true,
        displayName: 'ACME - Submitted 1',
        totalAmount: 2000,
        itemCount: 5,
        items: [],
        createdBy: 'test'
      }
    ];

    await page.goto('/ns-queue');

    // ALL should show 3 rows (in table)
    // First, let's assume ALL is selected by default, or we click it
    await page.getByRole('button', { name: /ALL/i }).click();
    await expect(page.getByRole('row')).toHaveCount(4); // 1 header + 3 data rows

    // Verify some cell contents
    await expect(page.getByText('ACME - Draft 1')).toBeVisible();
    await expect(page.getByText('GLOBEX - Draft 2')).toBeVisible();
    await expect(page.getByText('ACME - Submitted 1')).toBeVisible();

    // Click DRAFT
    await page.getByRole('button', { name: /DRAFT/i }).click();
    await expect(page.getByRole('row')).toHaveCount(3); // 1 header + 2 data rows
    await expect(page.getByText('ACME - Submitted 1')).not.toBeVisible();

    // Click SUBMITTED
    await page.getByRole('button', { name: /SUBMITTED/i }).click();
    await expect(page.getByRole('row')).toHaveCount(2); // 1 header + 1 data row
    await expect(page.getByText('ACME - Submitted 1')).toBeVisible();
    await expect(page.getByText('ACME - Draft 1')).not.toBeVisible();
  });
});
