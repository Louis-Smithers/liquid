# Review Plan — Smithers / Liquid

Mapping your 13 review notes to the actual codebase, with a recommended order. Stack: React + Vite + shadcn/ui frontend, .NET (`Smithers.API`) backend, Supabase/Postgres.

Two big themes run through the notes: (A) the **Client drawer** needs a cleanup pass, and (B) the **Invoices** concept needs to be split into Unprocessed vs Processed with notes. Plus standalone **Loans** bugs.

---

## Open decisions (need your call before I build the bigger pieces)

1. **Items 5–10 — where do invoices live?** Right now invoices only exist as a *tab inside* `ClientDrawer.tsx`. There is **no standalone staff Invoices page** (no `/invoices` route in `App.tsx`). Your notes 9–10 say "the invoices page should have two sections." So: do you want a **new top-level `/invoices` page**, or should the two-section Unprocessed/Processed layout live **inside the client drawer's Invoices tab**? My recommendation: build a new `/invoices` page (matches the old Retool layout in `RetoolUI/`), and keep the drawer tab as a per-client filtered view of the same component.

2. **Item 1 — what is the "4000/5000 number"?** Example `SAF / 5545`. `SAF` = `client.shortcode`. I need to know which field the numeric code maps to (a client account number from the old DB?). It isn't on the `Client` model yet — may be part of the item-2 migration.

3. **Item 7 — "this doesn't render anything."** I couldn't tell from text alone *which* view. Most likely the Loans page/table or an empty invoices section. Confirm which screen and I'll pin it down.

---

## A. Client drawer cleanup (`frontend/src/components/clients/ClientDrawer.tsx`)

**Note 3 — header is cluttered.** Header is lines ~464–508.
- Remove the **Fee** and **Reserve** badges (lines 478–485).
- Remove the "floating 5000 number on the right" (the shortcode chip next to the title, lines 469–471 — confirm this is the one you mean).
- Improve `@ / # / Lang` row (lines 473–477) — use proper icons/labels instead of `@`, `#`.
- Make the title (line 467) not bold — drop `font-semibold`.

**Note 2 — Client Details fields are empty + old-DB migration.** Details tab is lines 786–841; fields bind to `client.email/phone/address/city/...`. They render empty because the data was never migrated. This is a **backend/data task**, not UI:
- Source data is in `Import list/` (`Import-list-final.json`, `DebAging (1).xlsm`) and the old Retool DB.
- Plan: write a one-time migration/seed that backfills `Clients` (email, phone, address, city, province, postal, language, contact, rates, **and the numeric code from note 1**). Confirm whether to pull from the JSON exports or connect to the old DB directly.

**Note 4 — Debtors tab needs a "Go to" button, columns stay aligned.** Debtors table is lines 591–695 (aging columns + expandable rows).
- Add a right-most action column with a **"Go to"** button → navigate to the debtor (drawer or `/debtors`). Add the matching empty `<TableHead/>` and bump the `colSpan` (currently 9) so alignment holds.

## B. Invoice list inside the drawer (Invoices tab, lines 697–783)

**Note 5 — amounts in aging-bucket columns.** Today the invoice table is flat (Invoice, Date, Age, Amount, Debtor, Status, Flag, NS). You want it to mirror the **Debtors** table's aging layout: columns `Invoice ID · Date · Age · Total · 0–30 · 31–60 · 61–90 · 91–120 · 120+`, where the invoice's amount drops into the bucket matching its age. The ID/Date/Age block must not overflow into the Total column — fixed widths so Total and the bucket columns line up with the Debtors tab.

**Note 6 — invoice Preview modal.** Currently the invoice ID is a `<Link to={/gate/:id}>` (lines 742–743, 666–668). Replace the click with a **preview modal** that shows the source file (PDF/image) with a **Download** button — no navigation to the extractor for now. Needs a backend endpoint to fetch the invoice's stored document (check Google Cloud Storage wiring already in backend).

**Note 8 — remove NS from this list.** These invoices are already processed and will never be on an NS. Remove the **NS column** (line 724) and the per-row **Add-to-NS-Queue** button (lines 760–776), plus the related `selectedInvoices`/`addItem` plumbing in this view.

## C. New Invoices page — two sections (Notes 9 & 10)

Recommended new page `frontend/src/pages/InvoicesPage.tsx` + `/invoices` route, modeled on `RetoolUI/...invoices...png`.

**Note 9 — Unprocessed section.** Collapsed container showing a quick stat ("N invoices unprocessed"). These are OCR'd-but-not-yet-on-an-NS (or in queue). Actions here: **Add to NS queue** and **Go to NS Builder** (`/ns-queue`). This is the *only* place NS actions belong (ties back to note 8).

**Note 10 — Processed section + notes.** This is where notes matter most:
- Per-invoice notes, viewable individually (the `Invoice` model already has a `notes` field).
- A way to **post a note to multiple invoices at once** (multi-select + bulk-note action).
- Backend: add/extend endpoints to save a note per invoice and a bulk-note endpoint. The old Retool screenshot is the functional reference, not a pixel target.

## D. Loans (`pages/LoansPage.tsx`, `components/loans/LoanDrawer.tsx`, `backend/.../LoanService.cs`)

**Note 12 — "Add Payment" crashes the app.** *(Highest priority — it's a hard crash.)* The dialog and `POST /api/loans/{id}/payments` look wired correctly, so the crash is likely either (a) the React re-render after `load()` when the recomputed table hits an unexpected value, or (b) a backend exception in `AddPaymentAsync`/`ComputeRows`. First step is to reproduce and capture the actual console/network error, then fix. I have a couple of concrete hypotheses to check once I can repro.

**Note 11 — generate the full loan table.** The amortization logic exists (`LoanService.ComputeRows`, rendered in `LoanDrawer`), but it produces an empty table until payments exist. "Generate the full table" most likely means **seed real loan data** (the `loan_table_demo/9512-3220 Quebec Inc Loan Table.pdf` is the reference) so the table renders fully — then we iterate on making it editable/regenerating (which the inline-edit cells already partly support).

---

## Recommended order

1. **Loans "Add Payment" crash (12)** — it's a crash, fast to fix once reproduced.
2. **Client drawer cleanup (3, 4)** — pure frontend, low risk, quick wins.
3. **Drawer invoice list (5, 6, 8)** — frontend + one file-preview endpoint.
4. **Data migration (2, 1)** — backfill client fields + numeric code from old DB/exports.
5. **New Invoices page w/ Unprocessed + Processed + notes (9, 10)** — biggest piece, backend + frontend.
6. **Loan table generation/seed (11)**, then the "doesn't render" view (7) once identified.

Items 1, 7, and the invoices-page location (decisions above) are the things I need from you before starting 4 and 5.
