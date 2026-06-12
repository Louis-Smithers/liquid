-- ============================================================================
-- CLEANUP: Remove all staging / seeded test data
-- ============================================================================
-- Run this in the Supabase SQL Editor when done testing.
-- Order respects foreign-key constraints (children before parents).
-- ============================================================================

BEGIN;

-- Children first (deepest dependencies first)
DELETE FROM public.invoice_ocr_results;
DELETE FROM public.notification_sheet_items;
DELETE FROM public.notification_sheets;
DELETE FROM public.import_review_queue;
DELETE FROM public.import_runs;
DELETE FROM public.staged_documents;
DELETE FROM public.upload_batches;
DELETE FROM public.loan_payments;
DELETE FROM public.loans;
DELETE FROM public.invoices;
DELETE FROM public.user_access_requests;

-- Parents
DELETE FROM public.debtors;
DELETE FROM public.clients;

COMMIT;

-- Verify counts (should all be 0)
SELECT 'clients'                  AS tbl, COUNT(*) FROM public.clients
UNION ALL SELECT 'debtors',                  COUNT(*) FROM public.debtors
UNION ALL SELECT 'invoices',                 COUNT(*) FROM public.invoices
UNION ALL SELECT 'import_runs',              COUNT(*) FROM public.import_runs
UNION ALL SELECT 'import_review_queue',      COUNT(*) FROM public.import_review_queue
UNION ALL SELECT 'notification_sheets',      COUNT(*) FROM public.notification_sheets
UNION ALL SELECT 'notification_sheet_items', COUNT(*) FROM public.notification_sheet_items
UNION ALL SELECT 'invoice_ocr_results',      COUNT(*) FROM public.invoice_ocr_results
UNION ALL SELECT 'upload_batches',           COUNT(*) FROM public.upload_batches
UNION ALL SELECT 'staged_documents',         COUNT(*) FROM public.staged_documents
UNION ALL SELECT 'loans',                    COUNT(*) FROM public.loans
UNION ALL SELECT 'loan_payments',            COUNT(*) FROM public.loan_payments
UNION ALL SELECT 'user_access_requests',     COUNT(*) FROM public.user_access_requests;
