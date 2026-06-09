import { test as base, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

// In-memory fake store so add/remove/create behave realistically
export type MockState = {
  sheets: any[];
  nextId: number;
  clients: any[];
  invoices: any[];
};

export const injectMockSession = async (page: any, { mustChangePassword = false, role = 'authenticated' } = {}) => {
  const SECRET = 'super-secret-key-that-is-at-least-32-characters-long';
  const SUB = '12345-abcde';
  
  const access_token = jwt.sign(
    { 
      sub: SUB, 
      aud: 'authenticated', 
      role: role,
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role: role, must_change_password: mustChangePassword }
    }, 
    SECRET, 
    { algorithm: 'HS256' }
  );

  await page.addInitScript(([token, sub, r, mcp]) => {
    const now = Math.floor(Date.now() / 1000);
    const sessionObj = {
      access_token: token, 
      token_type: 'bearer', 
      expires_at: now + 3600,
      expires_in: 3600, 
      refresh_token: 'test-refresh',
      user: { 
        id: sub, 
        aud: 'authenticated', 
        role: 'authenticated', 
        email: 'test@example.com',
        app_metadata: { role: r, must_change_password: mcp } 
      }
    };
    // Attempt standard Supabase keys
    localStorage.setItem('sb-mock-auth-token', JSON.stringify(sessionObj));
    localStorage.setItem('sb-your-project-ref-auth-token', JSON.stringify(sessionObj));
    // For localhost dev setups
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(sessionObj));
    localStorage.setItem('sb-127-auth-token', JSON.stringify(sessionObj));
  }, [access_token, SUB, role, mustChangePassword]);
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export const test = base.extend<{
  mockState: MockState;
}>({
  mockState: async ({ page }, use) => {
    await injectMockSession(page);
    const state: MockState = {
      sheets: [],
      nextId: 1,
      clients: [
        { shortcode: 'ACME', cadenceName: 'ACME Corp', active: true, discountRate: 0.05, reserveRate: 0.1 },
        { shortcode: 'GLOBEX', cadenceName: 'Globex Inc', active: true, discountRate: 0.03, reserveRate: 0.15 },
      ],
      invoices: [
        { id: 'inv-1', invoiceId: 'inv-1', invoiceNumber: 'INV-001', originalInvoice: 'INV-001', liquidClient: 'ACME', debtorName: 'Mock Debtor', amount: 1000, date: '2026-06-05', status: 'Pre-Verified' },
        { id: 'inv-2', invoiceId: 'inv-2', invoiceNumber: 'INV-002', originalInvoice: 'INV-002', liquidClient: 'ACME', debtorName: 'Mock Debtor', amount: 500, date: '2026-06-05', status: 'Pre-Verified' },
        { id: 'inv-3', invoiceId: 'inv-3', invoiceNumber: 'INV-003', originalInvoice: 'INV-003', liquidClient: 'GLOBEX', debtorName: 'Another Debtor', amount: 2000, date: '2026-06-05', status: 'Unverified' },
      ],
    };

    await page.route('**/api/**', async (r) => {
      if (r.request().method() === 'OPTIONS') {
        return r.fulfill({ headers: corsHeaders, status: 204 });
      }
      await r.fallback();
    });

    // Consolidated handler for all /api/notificationsheets requests
    await page.route(/\/api\/notificationsheets/, async r => {
      const method = r.request().method();
      const urlObj = new URL(r.request().url());
      const path = urlObj.pathname;

      if (method === 'OPTIONS') return r.fallback(); // Let the global OPTIONS handle it

      if (path.endsWith('/draft-count')) {
        if (method !== 'GET') return r.fallback();
        return r.fulfill({
          headers: corsHeaders,
          json: state.sheets
            .filter(s => s.status === 'Draft')
            .reduce((n, s) => n + s.items.length, 0),
        });
      }

      if (path.includes('/active/')) {
        if (method !== 'GET') return r.fallback();
        const shortcode = path.split('/active/')[1];
        const s = state.sheets.find(x => x.clientShortcode === shortcode && x.status === 'Draft');
        return s ? r.fulfill({ headers: corsHeaders, json: s }) : r.fulfill({ headers: corsHeaders, status: 404, json: {} });
      }

      // /api/notificationsheets/:id/items/:itemId
      const itemMatch = path.match(/notificationsheets\/([^/]+)\/items\/([^/]+)$/);
      if (itemMatch) {
        if (method === 'DELETE') {
          const sheetId = itemMatch[1];
          const itemId = itemMatch[2];
          const sheet = state.sheets.find(s => s.id === sheetId);
          if (sheet) {
            const idx = sheet.items.findIndex(i => i.id === itemId);
            if (idx !== -1) {
              const item = sheet.items[idx];
              sheet.items.splice(idx, 1);
              sheet.totalAmount -= item.includedAmount;
              sheet.itemCount = sheet.items.length;
            }
          }
          return r.fulfill({ headers: corsHeaders, status: 204 });
        }
        return r.fallback();
      }

      // /api/notificationsheets/:id/items
      const itemsMatch = path.match(/notificationsheets\/([^/]+)\/items$/);
      if (itemsMatch) {
        if (method === 'POST') {
          const id = itemsMatch[1];
          const s = state.sheets.find(x => x.id === id);
          if (!s) return r.fulfill({ headers: corsHeaders, status: 404 });
          
          const b = r.request().postDataJSON();
          const inv = state.invoices.find(i => i.invoiceId === b.invoiceId);
          const item = {
            id: `it-${state.nextId++}`,
            notificationSheetId: id,
            invoiceId: b.invoiceId,
            invoiceNumber: inv ? inv.originalInvoice : b.invoiceId,
            debtorName: inv ? inv.debtorName : 'Mock Debtor',
            date: inv ? inv.date : '2026-06-05',
            includedAmount: b.includedAmount,
          };
          s.items.push(item);
          s.totalAmount += item.includedAmount;
          s.itemCount = s.items.length;
          return r.fulfill({ headers: corsHeaders, json: s });
        }
        return r.fallback();
      }

      // /api/notificationsheets/:id
      const sheetMatch = path.match(/notificationsheets\/([^/]+)$/);
      if (sheetMatch) {
        const id = sheetMatch[1];
        if (method === 'PATCH') {
          let s = state.sheets.find(x => x.id === id);
          if (!s) {
             // Fallback to first sheet if id somehow doesn't match for robust testing
             s = state.sheets[0];
          }
          if (s) {
            const body = r.request().postDataJSON();
            if (body.isShared !== undefined) s.isShared = body.isShared;
            return r.fulfill({ headers: corsHeaders, json: s });
          }
          return r.fulfill({ headers: corsHeaders, status: 404 });
        }
        if (method === 'DELETE') {
          const idx = state.sheets.findIndex(x => x.id === id);
          if (idx !== -1) {
            state.sheets.splice(idx, 1);
            return r.fulfill({ headers: corsHeaders, status: 204 });
          }
          return r.fulfill({ headers: corsHeaders, status: 404 });
        }
        return r.fallback();
      }

      // /api/notificationsheets
      if (path.endsWith('/notificationsheets')) {
        if (method === 'GET') {
          return r.fulfill({ headers: corsHeaders, json: state.sheets });
        }
        if (method === 'POST') {
          const body = r.request().postDataJSON();
          const s = {
            id: `ns-${state.nextId++}`,
            clientShortcode: body.clientShortcode,
            status: 'Draft',
            isShared: body.isShared ?? true,
            displayName: `${body.clientShortcode} - 2026-06-05 - $0 - ns-${state.nextId}`,
            totalAmount: 0,
            itemCount: 0,
            items: [],
            createdBy: 'test-user',
          };
          state.sheets.push(s);
          return r.fulfill({ headers: corsHeaders, json: s });
        }
      }

      return r.fallback();
    });

    await page.route('**/api/clients', async r => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({ headers: corsHeaders, json: state.clients });
    });

    await page.route('**/api/clients/*/summary', async r => {
      if (r.request().method() !== 'GET') return r.fallback();
      const match = r.request().url().match(/clients\/([^/]+)\/summary/);
      const shortcode = match ? match[1] : null;
      return r.fulfill({ 
        headers: corsHeaders, json: { 
          clientShortcode: shortcode,
          totalOpenInvoices: 5,
          totalAmount: 10000,
          verifiedPercentage: 80 
        } 
      });
    });
    
    await page.route('**/api/clients/*', async r => {
       if (r.request().method() === 'PUT') {
          return r.fulfill({ headers: corsHeaders, status: 200, json: {} });
       }
       return r.fallback();
    });

    await page.route('**/api/invoices/client/*', async r => {
      if (r.request().method() !== 'GET') return r.fallback();
      const match = r.request().url().match(/invoices\/client\/([^/?]+)/);
      const shortcode = match ? match[1] : null;
      return r.fulfill({
        headers: corsHeaders, json: state.invoices.filter(i => i.liquidClient === shortcode)
      });
    });

    await page.route('**/api/debtors', async r => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({
        headers: corsHeaders, json: Array.from(new Set(state.invoices.map(i => i.debtorName))).map((name, i) => ({
          id: `debtor-${i}`,
          name: name,
          totalOpenAmount: 1000
        }))
      });
    });

    await page.route('**/api/invoices/debtor/*', async r => {
      if (r.request().method() !== 'GET') return r.fallback();
      const match = r.request().url().match(/invoices\/debtor\/([^/?]+)/);
      const debtorId = match ? match[1] : null;
      // Just return all invoices for the mocked debtor drawer tests
      return r.fulfill({
        headers: corsHeaders, json: state.invoices
      });
    });

    await use(state);
  },
});

export { expect };
