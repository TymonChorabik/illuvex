-- Tracks the last time an invoice's PDF was actually emailed to the client.
-- Informational only, unlike a quote's one-shot send: re-sending an invoice
-- is normal and expected.
ALTER TABLE "invoices" ADD COLUMN "emailSentAt" TIMESTAMP(3);
