CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN

                    DROP TABLE IF EXISTS public.invoice_line_items CASCADE;
                    DROP TABLE IF EXISTS public.document_jobs     CASCADE;
                    DROP TABLE IF EXISTS public.invoices          CASCADE;
                    DROP TABLE IF EXISTS public.company_members   CASCADE;
                    DROP TABLE IF EXISTS public.companies         CASCADE;
                    DROP TYPE IF EXISTS public.member_role;
                    DROP TYPE IF EXISTS public.invoice_status;
                    DROP TYPE IF EXISTS public.document_status;
                    DROP TYPE IF EXISTS public.document_format;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE clients (
        id uuid NOT NULL,
        shortcode character varying(50) NOT NULL,
        cadence_name text,
        active boolean NOT NULL,
        dnc boolean NOT NULL,
        CONSTRAINT pk_clients PRIMARY KEY (id),
        CONSTRAINT ak_clients_shortcode UNIQUE (shortcode)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE debtors (
        id uuid NOT NULL,
        name text NOT NULL,
        cadence_name text,
        "group" text NOT NULL,
        redirect_id uuid,
        active boolean NOT NULL,
        CONSTRAINT pk_debtors PRIMARY KEY (id),
        CONSTRAINT fk_debtors_debtors_redirect_id FOREIGN KEY (redirect_id) REFERENCES debtors (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE import_runs (
        id uuid NOT NULL,
        run_date timestamp with time zone NOT NULL,
        source_file text,
        status text NOT NULL,
        row_count integer NOT NULL,
        matched integer NOT NULL,
        unmatched integer NOT NULL,
        CONSTRAINT pk_import_runs PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE purchased (
        invoice_id text NOT NULL,
        original_invoice text NOT NULL,
        date date NOT NULL,
        debtor_id uuid NOT NULL,
        liquid_client character varying(50) NOT NULL,
        amount numeric NOT NULL,
        status text NOT NULL,
        archived boolean NOT NULL,
        document_path text,
        created_time timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        CONSTRAINT pk_purchased PRIMARY KEY (invoice_id),
        CONSTRAINT fk_purchased_clients_liquid_client FOREIGN KEY (liquid_client) REFERENCES clients (shortcode) ON DELETE CASCADE,
        CONSTRAINT fk_purchased_debtors_debtor_id FOREIGN KEY (debtor_id) REFERENCES debtors (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE import_review_queue (
        id uuid NOT NULL,
        run_id uuid,
        client_name text,
        debtor_name text,
        invoice_number text,
        amount numeric,
        review_status text NOT NULL,
        notes text,
        resolved_by uuid,
        resolved_at timestamp with time zone,
        CONSTRAINT pk_import_review_queue PRIMARY KEY (id),
        CONSTRAINT fk_import_review_queue_import_runs_run_id FOREIGN KEY (run_id) REFERENCES import_runs (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE TABLE invoice_ocr_results (
        id uuid NOT NULL,
        invoice_id text NOT NULL,
        field_name text NOT NULL,
        extracted_value text,
        confirmed_value text,
        confidence numeric(5,4),
        page_number integer NOT NULL,
        bbox_x numeric(8,6),
        bbox_y numeric(8,6),
        bbox_width numeric(8,6),
        bbox_height numeric(8,6),
        reviewed boolean NOT NULL,
        reviewed_by uuid,
        reviewed_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_invoice_ocr_results PRIMARY KEY (id),
        CONSTRAINT fk_invoice_ocr_results_purchased_invoice_id FOREIGN KEY (invoice_id) REFERENCES purchased (invoice_id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    INSERT INTO clients (id, active, cadence_name, dnc, shortcode)
    VALUES ('00000000-0000-0000-0000-000000000001', TRUE, 'ACME Corp', FALSE, 'ACME');
    INSERT INTO clients (id, active, cadence_name, dnc, shortcode)
    VALUES ('00000000-0000-0000-0000-000000000002', TRUE, 'Globex Corporation', FALSE, 'GLOBEX');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    INSERT INTO debtors (id, active, cadence_name, "group", name, redirect_id)
    VALUES ('10000000-0000-0000-0000-000000000001', TRUE, 'Wayne Ent', 'Active', 'Wayne Enterprises', NULL);
    INSERT INTO debtors (id, active, cadence_name, "group", name, redirect_id)
    VALUES ('10000000-0000-0000-0000-000000000002', TRUE, 'Stark Ind', 'Review', 'Stark Industries', NULL);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_clients_shortcode ON clients (shortcode);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE INDEX ix_debtors_redirect_id ON debtors (redirect_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE INDEX ix_import_review_queue_run_id ON import_review_queue (run_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE INDEX ix_invoice_ocr_results_invoice_id ON invoice_ocr_results (invoice_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE INDEX ix_purchased_debtor_id ON purchased (debtor_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_purchased_liquid_client_original_invoice ON purchased (liquid_client, original_invoice);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602155631_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260602155631_InitialCreate', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    ALTER TABLE invoice_ocr_results DROP CONSTRAINT fk_invoice_ocr_results_purchased_invoice_id;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    DROP INDEX ix_purchased_debtor_id;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    DROP INDEX ix_purchased_liquid_client_original_invoice;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    ALTER TABLE purchased RENAME TO invoices;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    ALTER INDEX pk_purchased RENAME TO pk_invoices;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    CREATE INDEX ix_invoices_debtor_id ON invoices (debtor_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    CREATE UNIQUE INDEX ix_invoices_liquid_client_original_invoice ON invoices (liquid_client, original_invoice);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    ALTER TABLE invoice_ocr_results ADD CONSTRAINT fk_invoice_ocr_results_invoices_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id) ON DELETE CASCADE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602172443_RenameTablePurchasedToInvoices') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260602172443_RenameTablePurchasedToInvoices', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue DROP CONSTRAINT fk_import_review_queue_import_runs_run_id;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    DROP INDEX ix_import_review_queue_run_id;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE invoices ADD debtor_name text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ALTER COLUMN run_id TYPE text;
    UPDATE import_review_queue SET run_id = '' WHERE run_id IS NULL;
    ALTER TABLE import_review_queue ALTER COLUMN run_id SET NOT NULL;
    ALTER TABLE import_review_queue ALTER COLUMN run_id SET DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    UPDATE import_review_queue SET client_name = '' WHERE client_name IS NULL;
    ALTER TABLE import_review_queue ALTER COLUMN client_name SET NOT NULL;
    ALTER TABLE import_review_queue ALTER COLUMN client_name SET DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue DROP CONSTRAINT pk_import_review_queue;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue DROP COLUMN id;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD COLUMN id bigint GENERATED BY DEFAULT AS IDENTITY;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD CONSTRAINT pk_import_review_queue PRIMARY KEY (id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD all_debtors text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD created_at timestamp with time zone NOT NULL DEFAULT TIMESTAMPTZ '-infinity';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD invoice_date text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD run_timestamp timestamp with time zone NOT NULL DEFAULT TIMESTAMPTZ '-infinity';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD total_amount numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    ALTER TABLE import_review_queue ADD total_invoices integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260602193456_AlignSchemaWithN8n') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260602193456_AlignSchemaWithN8n', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD city text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD email text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD language text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD notes text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD phone text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD postal_code text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    ALTER TABLE clients ADD province text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    UPDATE clients SET city = NULL, email = NULL, language = NULL, notes = NULL, phone = NULL, postal_code = NULL, province = NULL
    WHERE id = '00000000-0000-0000-0000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    UPDATE clients SET city = NULL, email = NULL, language = NULL, notes = NULL, phone = NULL, postal_code = NULL, province = NULL
    WHERE id = '00000000-0000-0000-0000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260603173637_AddClientDetailsFromFigma') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260603173637_AddClientDetailsFromFigma', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    DELETE FROM clients
    WHERE id = '00000000-0000-0000-0000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    DELETE FROM clients
    WHERE id = '00000000-0000-0000-0000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    DELETE FROM debtors
    WHERE id = '10000000-0000-0000-0000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    DELETE FROM debtors
    WHERE id = '10000000-0000-0000-0000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD file_count integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD flag_reason text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD flag_timestamp timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD flagged boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD notes text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD processed_time timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD schedule_number text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD terms integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE invoices ADD verified boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD address text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD city text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD contact text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD dnc boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD email text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD language text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD notes text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD phone text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD postal_code text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD preferred_contact_method text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE debtors ADD province text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE clients ADD address text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE clients ADD contact text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE clients ADD discount_rate numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    ALTER TABLE clients ADD reserve_rate numeric;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604234658_AddRetoolFields') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260604234658_AddRetoolFields', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    CREATE TABLE notification_sheets (
        id uuid NOT NULL,
        client_shortcode character varying(50) NOT NULL,
        status text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        created_by uuid,
        initial_fee_percent numeric NOT NULL,
        reserve_fee_percent numeric NOT NULL,
        total_fee numeric NOT NULL,
        total_reserve numeric NOT NULL,
        other_fee numeric NOT NULL,
        cash_reserves_to_release numeric NOT NULL,
        reserves_to_hold_back numeric NOT NULL,
        other_adjustments numeric NOT NULL,
        advance_amount numeric NOT NULL,
        notes text,
        CONSTRAINT pk_notification_sheets PRIMARY KEY (id),
        CONSTRAINT fk_notification_sheets_clients_client_shortcode FOREIGN KEY (client_shortcode) REFERENCES clients (shortcode) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    CREATE TABLE notification_sheet_items (
        id uuid NOT NULL,
        notification_sheet_id uuid NOT NULL,
        invoice_id text NOT NULL,
        included_amount numeric NOT NULL,
        override_initial_fee numeric,
        override_reserve_fee numeric,
        CONSTRAINT pk_notification_sheet_items PRIMARY KEY (id),
        CONSTRAINT fk_notification_sheet_items_invoices_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id) ON DELETE RESTRICT,
        CONSTRAINT fk_notification_sheet_items_notification_sheets_notification_s FOREIGN KEY (notification_sheet_id) REFERENCES notification_sheets (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    CREATE INDEX ix_notification_sheet_items_invoice_id ON notification_sheet_items (invoice_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    CREATE INDEX ix_notification_sheet_items_notification_sheet_id ON notification_sheet_items (notification_sheet_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    CREATE INDEX ix_notification_sheets_client_shortcode ON notification_sheets (client_shortcode);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260604235144_AddNotificationSheets') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260604235144_AddNotificationSheets', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260605014411_AddIsSharedToNotificationSheets') THEN
    ALTER TABLE notification_sheets ADD is_shared boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260605014411_AddIsSharedToNotificationSheets') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260605014411_AddIsSharedToNotificationSheets', '10.0.8');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260606225438_AddUserAccessRequest') THEN
    ALTER TABLE notification_sheets ALTER COLUMN is_shared SET DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260606225438_AddUserAccessRequest') THEN
    CREATE TABLE user_access_requests (
        id uuid NOT NULL,
        email text NOT NULL,
        username_wanted text NOT NULL,
        first_name text NOT NULL,
        last_name text NOT NULL,
        status text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        reviewed_at timestamp with time zone,
        reviewed_by_supabase_id text,
        CONSTRAINT pk_user_access_requests PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260606225438_AddUserAccessRequest') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260606225438_AddUserAccessRequest', '10.0.8');
    END IF;
END $EF$;
COMMIT;

