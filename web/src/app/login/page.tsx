"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }
    setLoading(false);
  }

  async function handleMagicLink() {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage("Check your email for a magic sign-in link.");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
            <GiftIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GiftList</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "sign-in" ? "Welcome back" : "Create your account"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "sign-up" && (
              <Field label="Your name">
                <input
                  type="text"
                  placeholder="Jamie Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-hover disabled:opacity-50"
            >
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-card-border" />
            or
            <div className="h-px flex-1 bg-card-border" />
          </div>

          <button
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full rounded-xl border border-card-border px-4 py-2.5 text-sm font-medium transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            Email me a magic sign-in link
          </button>
        </div>

        <button
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="mt-6 w-full text-center text-sm text-muted hover:text-foreground"
        >
          {mode === "sign-in" ? "Need an account? " : "Already have an account? "}
          <span className="font-medium text-accent">
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </span>
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-card-border bg-transparent px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 22V7M12 7C10 7 8 5.5 8 3.8 8 2.8 8.8 2 9.8 2c1.9 0 2.2 2 2.2 5Zm0 0c2 0 4-1.5 4-3.2 0-1-.8-1.8-1.8-1.8-1.9 0-2.2 2-2.2 5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
