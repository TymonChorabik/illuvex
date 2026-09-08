-- Quote access tokens: emailed link that lets a client open and decide on a
-- quote without an account. Only the SHA-256 is stored.
ALTER TABLE "quotes" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "quotes" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "quotes_accessTokenHash_key" ON "quotes"("accessTokenHash");
