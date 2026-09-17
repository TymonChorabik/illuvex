"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

function SetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [account, setAccount] = useState<{ email: string; name: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/portal/set-password?token=${encodeURIComponent(token)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Deze link is niet geldig.");
        return;
      }
      setAccount(data);
    } catch {
      setError("Kon de server niet bereiken.");
    } finally {
      setChecking(false);
    }
  }, [token]);

  useEffect(() => {
    queueMicrotask(() => void check());
  }, [check]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("De twee wachtwoorden komen niet overeen.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Kon je wachtwoord niet instellen.");
        return;
      }
      router.push("/portal");
    } catch {
      setError("Kon de server niet bereiken.");
    } finally {
      setPending(false);
    }
  }

  if (checking) {
    return (
      <p className="py-24 text-center text-sm text-muted">Link controleren...</p>
    );
  }

  if (!account) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Link niet geldig</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {error}
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";

  return (
    <div className="py-20">
      <h1 className="text-2xl font-semibold tracking-tight">
        Kies je wachtwoord
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Voor <span className="font-medium text-ink">{account.email}</span>.
        Minimaal {MIN_PASSWORD_LENGTH} tekens — een korte zin werkt goed en is
        makkelijker te onthouden dan een reeks tekens.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nieuw wachtwoord"
          autoComplete="new-password"
          className={field}
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Herhaal wachtwoord"
          autoComplete="new-password"
          className={field}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
        >
          {pending ? "Opslaan..." : "Wachtwoord instellen en inloggen"}
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

export default function SetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-5">
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense
        fallback={<p className="py-24 text-center text-sm text-muted">Laden...</p>}
      >
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
