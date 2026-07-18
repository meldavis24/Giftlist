import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateToken, revokeToken } from "./actions";

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: newToken } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            &larr; Dashboard
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Extension tokens</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">
          Used by the browser extension to add items to your lists. Treat a token like a
          password — anyone with it can add items on your behalf.
        </p>

        {newToken && (
          <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Copy this token now — it won&apos;t be shown again.
            </p>
            <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-sm dark:bg-black/30">
              {newToken}
            </code>
          </div>
        )}

        <form
          action={generateToken}
          className="mt-6 flex gap-2 rounded-2xl border border-card-border bg-card p-4 shadow-sm"
        >
          <input
            name="label"
            placeholder="Label (e.g. Chrome on laptop)"
            className="flex-1 rounded-xl border border-card-border bg-transparent px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-hover"
          >
            Generate
          </button>
        </form>

        <ul className="mt-6 flex flex-col gap-2">
          {(tokens ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-2xl border border-card-border bg-card px-4 py-3 text-sm shadow-sm"
            >
              <div>
                <div className="font-medium">{t.label}</div>
                <div className="text-muted">
                  Created {new Date(t.created_at).toLocaleDateString()}
                  {t.last_used_at &&
                    ` · last used ${new Date(t.last_used_at).toLocaleDateString()}`}
                </div>
              </div>
              <form action={revokeToken.bind(null, t.id)}>
                <button className="text-sm font-medium text-red-600 hover:text-red-700">
                  Revoke
                </button>
              </form>
            </li>
          ))}
          {(!tokens || tokens.length === 0) && (
            <div className="rounded-2xl border border-dashed border-card-border py-10 text-center">
              <p className="text-sm text-muted">No tokens yet.</p>
            </div>
          )}
        </ul>
      </main>
    </div>
  );
}
