"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/db";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
  type OrderStatus,
} from "@/lib/order-status";
import { formatPrice } from "@/lib/site";

type StaffUser = { name: string; email: string; role: string };

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The httpOnly session cookie rides along automatically.
      const response = await fetch("/api/admin/orders");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load requests.");
        setAuthed(false);
        return;
      }
      setOrders(data.orders as Order[]);
      setAuthed(true);
      setPassword("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Exchange the password for a session cookie, once. After this the password
  // is dropped from memory and never travels again.
  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Could not sign in.");
        return;
      }
      setUser(data?.user ?? null);
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setOrders([]);
    setUser(null);
  }

  async function changeStatus(id: string, status: OrderStatus) {
    setSavingId(id);
    const previous = orders;
    // Optimistic: the dropdown should feel instant.
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order)),
    );
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not save that change.");
        setOrders(previous);
      }
    } catch {
      setError("Couldn't reach the server.");
      setOrders(previous);
    } finally {
      setSavingId(null);
    }
  }

  // The session cookie survives a reload; ask the server who we are.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated) {
          setUser(data.user);
          void load();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (checking) {
    return (
      <div className="mx-auto max-w-sm px-5 py-24 text-center text-sm text-muted">
        Checking your session...
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-5 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Every request that comes through the site, and the controls to move
          each one along.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@illuvex.example"
            autoComplete="username"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
          >
            {loading ? "Checking..." : "Sign in"}
          </button>
        </form>
        {error && (
          <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
            {error}
          </p>
        )}
      </div>
    );
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Requests</h1>
          <p className="mt-1.5 text-sm text-muted">
            {orders.length} total
            {pendingCount > 0 && ` · ${pendingCount} awaiting a reply`}
            {user && ` · signed in as ${user.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/tickets"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Tickets
          </Link>
          <Link
            href="/admin/clients"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Clients
          </Link>
          <Link
            href="/admin/invoices"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Facturen
          </Link>
          <Link
            href="/admin/quotes"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Offertes
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle disabled:opacity-55"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">No requests yet.</p>
          <p className="mt-1.5 text-sm text-muted">
            They will appear here the moment someone submits one.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold tracking-tight">
                      {order.offerName}
                    </h2>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[order.status]}`}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {order.reference}
                  </p>
                  <p className="mt-2 text-sm">
                    {order.name}
                    {order.company && (
                      <span className="text-muted"> · {order.company}</span>
                    )}
                  </p>
                  <p className="text-sm">
                    <a
                      href={`mailto:${order.email}?subject=Re: your ${order.offerName} request (${order.reference})`}
                      className="text-accent hover:underline"
                    >
                      {order.email}
                    </a>
                    {order.phone && (
                      <span className="text-muted"> · {order.phone}</span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-semibold">
                    {formatPrice(order.price, order.priceUnit)}
                  </span>
                  <select
                    value={order.status}
                    disabled={savingId === order.id}
                    onChange={(event) =>
                      void changeStatus(
                        order.id,
                        event.target.value as OrderStatus,
                      )
                    }
                    className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-55"
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {order.notes && (
                <p className="mt-3 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
                  {order.notes}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                <span>{new Date(order.createdAt).toLocaleString()}</span>
                <span>
                  {order.emailSent
                    ? "Confirmation emailed"
                    : "Confirmation NOT sent"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
