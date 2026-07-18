import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapUser } from "@/lib/bootstrap-user";
import { createList, signOut } from "./actions";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import DashboardListMenu from "@/components/DashboardListMenu";

const OCCASION_EMOJI: Record<string, string> = {
  christmas: "🎄",
  birthday: "🎂",
  graduation: "🎓",
  anniversary: "💍",
  wedding: "💒",
  "baby shower": "🍼",
  holiday: "🎁",
};

function emojiFor(occasion: string | null) {
  if (!occasion) return "🎁";
  return OCCASION_EMOJI[occasion.trim().toLowerCase()] ?? "🎁";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await bootstrapUser(supabase, user);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, occasion, owner_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <span className="text-sm">🎁</span>
            </div>
            <span className="font-semibold tracking-tight">GiftList</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <PushSubscribeButton />
            <Link href="/settings/tokens" className="text-muted hover:text-foreground">
              Extension tokens
            </Link>
            <form action={signOut}>
              <button className="text-muted hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Your lists</h1>
          <p className="mt-1 text-sm text-muted">
            One place for every occasion — shared with the people you choose.
          </p>
        </div>

        <form
          action={createList}
          className="mb-10 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <input
            name="name"
            placeholder="List name (e.g. Christmas 2026)"
            required
            className="flex-1 rounded-xl border border-card-border bg-transparent px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            name="occasion"
            placeholder="Occasion"
            className="rounded-xl border border-card-border bg-transparent px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-44"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-hover"
          >
            Create list
          </button>
        </form>

        {lists && lists.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <div
                key={list.id}
                className="group relative rounded-2xl border border-card-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <DashboardListMenu
                  listId={list.id}
                  listName={list.name}
                  isOwner={list.owner_id === user.id}
                />
                <Link href={`/lists/${list.id}`} className="block">
                  <span className="text-2xl">{emojiFor(list.occasion)}</span>
                  <div className="mt-3 pr-8 font-semibold tracking-tight group-hover:text-accent">
                    {list.name}
                  </div>
                  {list.occasion && (
                    <div className="mt-0.5 text-sm text-muted">{list.occasion}</div>
                  )}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-card-border py-16 text-center">
            <span className="text-3xl">🎁</span>
            <p className="mt-3 text-sm text-muted">No lists yet — create one above to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
