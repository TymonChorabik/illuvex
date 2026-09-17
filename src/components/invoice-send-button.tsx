"use client";

import { useState } from "react";

/**
 * Emails the invoice PDF to its client. A small client island inside the
 * otherwise server-rendered invoice document — the same pattern as
 * QuoteDecision on the quote page.
 */
export function InvoiceSendButton({
  invoiceId,
  alreadySentAt,
}: {
  invoiceId: string;
  alreadySentAt: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    sent: boolean;
    message: string;
  } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setResult({ sent: false, message: data?.error ?? "Kon het niet versturen." });
        return;
      }
      if (data.emailSent) {
        setResult({ sent: true, message: "Gemaild naar de klant." });
      } else {
        setResult({
          sent: false,
          message: `Kon het niet mailen (${data.emailError}). Download de PDF en stuur hem zelf.`,
        });
      }
    } catch {
      setResult({ sent: false, message: "Kon de server niet bereiken." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5 print:hidden">
      <button
        type="button"
        disabled={pending}
        onClick={() => void send()}
        className="rounded-full border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle disabled:opacity-55"
      >
        {pending
          ? "Versturen..."
          : alreadySentAt
            ? "Opnieuw mailen"
            : "Mailen naar klant"}
      </button>
      {result && (
        <p
          className={`max-w-xs text-right text-xs ${result.sent ? "text-muted" : "text-accent"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
