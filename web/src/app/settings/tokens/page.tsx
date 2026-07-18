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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <a href="/dashboard" className="text-sm text-neutral-500 underline">
        &larr; Dashboard
      </a>
      <h1 className="mt-2 text-2xl font-semibold">API tokens</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Used by the browser extension to add items to your lists. Treat a token like a
        password — anyone with it can add items on your behalf.
      </p>

      {newToken && (
        <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Copy this token now — it won&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-sm">
            {newToken}
          </code>
        </div>
      )}

      <form action={generateToken} className="mt-8 flex gap-2">
        <input
          name="label"
          placeholder="Label (e.g. Chrome on laptop)"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Generate token
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-2">
        {(tokens ?? []).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded border px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium">{t.label}</div>
              <div className="text-neutral-500">
                Created {new Date(t.created_at).toLocaleDateString()}
                {t.last_used_at &&
                  ` · last used ${new Date(t.last_used_at).toLocaleDateString()}`}
              </div>
            </div>
            <form action={revokeToken.bind(null, t.id)}>
              <button className="text-red-600 underline">Revoke</button>
            </form>
          </li>
        ))}
        {(!tokens || tokens.length === 0) && (
          <p className="text-sm text-neutral-500">No tokens yet.</p>
        )}
      </ul>
    </div>
  );
}
