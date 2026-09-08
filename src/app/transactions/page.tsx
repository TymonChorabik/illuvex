"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/db";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import { formatPrice, SITE, STORAGE_KEY } from "@/lib/site";

export default function TransactionsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/orders?email=${encodeURIComponent(trimmed)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load your requests.");
        setOrders(null);
        return;
      }
      setOrders(data.orders as Order[]);
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch {
        // Storage unavailable — the lookup still worked.
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and retry.");
      setOrders(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Anyone who has ordered before gets their history without retyping. The
  // input is uncontrolled so this can prefill the DOM without a render pass.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) return;
    if (inputRef.current) inputRef.current.value = saved;
    // Deferred out of the effect body so the fetch's state updates land in a
    // later task rather than cascading through this render.
    queueMicrotask(() => void lookup(saved));
  }, [lookup]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Your transactions</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Every package request you have sent us, and where each one stands. Look
        them up with the email address you ordered with.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(inputRef.current?.value ?? "");
        }}
        className="mt-6 flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          ref={inputRef}
          type="email"
          required
          defaultValue=""
          placeholder="you@example.com"
          autoComplete="email"
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
        >
          {loading ? "Looking..." : "Look up"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {orders !== null && !error && (
        <div className="mt-8">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="font-medium">No requests under that address.</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                Check the spelling, or pick a package on the home page to send
                your first one.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                {orders.length} request{orders.length === 1 ? "" : "s"}
              </p>
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold tracking-tight">
                          {order.offerName}
                        </h2>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {order.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(order.price, order.priceUnit)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                    </div>

                    {order.notes && (
                      <p className="mt-3 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
                        {order.notes}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                      <span>
                        Sent{" "}
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>
                        {order.emailSent
                          ? "Confirmation emailed"
                          : "Confirmation not sent"}
                      </span>
                      {order.company && <span>{order.company}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="mt-10 border-t border-line pt-5 text-xs text-muted">
        Something look wrong? Email{" "}
        <a
          href={`mailto:${SITE.businessEmail}`}
          className="font-medium text-accent hover:underline"
        >
          {SITE.businessEmail}
        </a>{" "}
        with your reference.
      </p>
    </div>
  );
}
