-- ============================================================================
-- DROP legacy Supabase tables  ⚠️ DESTRUCTIVE — IRREVERSIBLE
-- ============================================================================
-- Removes the unrelated prototype schema so the Smithers backend's EF Core
-- migrations can create the real schema (clients, debtors, invoices, …).
--
-- RUN THIS ONLY AFTER confirming none of these tables hold data you need.
-- Structure is preserved in: legacy-supabase-schema.backup.sql
--
-- Run from the Supabase dashboard SQL Editor, or:
--   psql "<connection-string>" -f drop-legacy-tables.sql
-- ============================================================================

BEGIN;

-- Tables (CASCADE clears the FKs between them)
DROP TABLE IF EXISTS public.invoice_line_items CASCADE;
DROP TABLE IF EXISTS public.document_jobs     CASCADE;
DROP TABLE IF EXISTS public.invoices          CASCADE;
DROP TABLE IF EXISTS public.company_members   CASCADE;
DROP TABLE IF EXISTS public.companies         CASCADE;

-- Enum types used only by the tables above
DROP TYPE IF EXISTS public.member_role;
DROP TYPE IF EXISTS public.invoice_status;
DROP TYPE IF EXISTS public.document_status;
DROP TYPE IF EXISTS public.document_format;

COMMIT;
