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
        setResult({ sent: false, message: data?.error ?? "Could not send it." });
        return;
      }
      if (data.emailSent) {
        setResult({ sent: true, message: "Emailed to the client." });
      } else {
        setResult({
          sent: false,
          message: `Couldn't email it (${data.emailError}). Download the PDF and send it yourself.`,
        });
      }
    } catch {
      setResult({ sent: false, message: "Couldn't reach the server." });
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
        {pending ? "Sending..." : alreadySentAt ? "Resend by email" : "Send by email"}
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
