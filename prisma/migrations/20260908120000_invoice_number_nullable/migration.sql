-- Invoice numbers are allocated when an invoice is issued, not when the draft
-- is created, so deleting a draft cannot leave a gap in the sequence.
ALTER TABLE "invoices" ALTER COLUMN "number" DROP NOT NULL;
