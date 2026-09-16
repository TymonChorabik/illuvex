-- Client numbers: a permanent per-tenant identifier shown on quotes and
-- invoices, allocated once when the client is first created (see
-- nextClientNumber in src/lib/quotes.ts). Nullable so existing rows are not
-- broken by this migration; they simply have no number until touched.
ALTER TABLE "clients" ADD COLUMN "number" TEXT;
CREATE UNIQUE INDEX "clients_tenantId_number_key" ON "clients"("tenantId", "number");
