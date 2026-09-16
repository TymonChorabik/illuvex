"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";

type Client = {
  id: string;
  name: string;
  email: string;
  contactName: string | null;
  city: string | null;
  users: { id: string; emailVerifiedAt: string | null; lastLoginAt: string | null }[];
  _count: { tickets: number; quotes: number };
};

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ id: string; link: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/clients");
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin");
          return;
        }
        setError(data.error ?? "Could not load clients.");
        return;
      }
      setClients(data.clients as Client[]);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function invite(id: string) {
    setInvitingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${id}/invite`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not send the invite.");
        return;
      }
      setLastInvite({ id, link: data.link });
      if (!data.emailSent) {
        setError(
          `Invite created, but the email did not go out (${data.emailError}). Copy the link below and send it yourself.`,
        );
      }
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AdminNav />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1.5 text-sm text-muted">
            Invite a client and they can sign in to raise tickets and see their
            quotes.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {loading && !clients && <p className="mt-8 text-sm text-muted">Loading...</p>}

      {clients && clients.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">No clients yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            A client record is created the first time you raise a quote for
            someone.
          </p>
        </div>
      )}

      {clients && clients.length > 0 && (
        <ul className="mt-6 space-y-3">
          {clients.map((client) => {
            const account = client.users[0];
            const activated = account?.emailVerifiedAt != null;
            return (
              <li
                key={client.id}
                className="rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold tracking-tight">
                        {client.name}
                      </h2>
                      {account && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            activated
                              ? "bg-ink text-white"
                              : "bg-accent-soft text-accent"
                          }`}
                        >
                          {activated ? "Portal active" : "Invite pending"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-muted">
                      {client.contactName ? `${client.contactName} · ` : ""}
                      {client.email}
                      {client.city ? ` · ${client.city}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {client._count.quotes} quote
                      {client._count.quotes === 1 ? "" : "s"} ·{" "}
                      {client._count.tickets} ticket
                      {client._count.tickets === 1 ? "" : "s"}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={invitingId === client.id}
                    onClick={() => void invite(client.id)}
                    className="shrink-0 rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-subtle disabled:opacity-55"
                  >
                    {invitingId === client.id
                      ? "Sending..."
                      : account
                        ? "Resend invite"
                        : "Invite to portal"}
                  </button>
                </div>

                {lastInvite?.id === client.id && (
                  <div className="mt-3 rounded-lg bg-subtle px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                      Set-password link
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {lastInvite.link}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
