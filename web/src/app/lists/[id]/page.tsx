import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapUser } from "@/lib/bootstrap-user";
import { addItem, claimItem, unclaimItem, inviteMember } from "./actions";
import ListActionsMenu from "@/components/ListActionsMenu";
import CheckPriceButton from "@/components/CheckPriceButton";

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id: listId } = await params;
  const { share } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await bootstrapUser(supabase, user);

  const { data: list } = await supabase.from("lists").select("*").eq("id", listId).single();
  if (!list) notFound();

  const isOwner = list.owner_id === user.id;

  const [{ data: items }, { data: members }, { data: claims }] = await Promise.all([
    supabase
      .from("list_items")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: false }),
    supabase.from("list_members").select("*").eq("list_id", listId),
    supabase.from("item_claims").select("item_id, claimed_by"),
  ]);

  // For the owner, RLS returns zero claims regardless of reality -- that's the
  // surprise-preserving privacy rule at work, not a bug.
  const claimedItemIds = new Set((claims ?? []).map((c) => c.item_id));
  const myClaimedItemIds = new Set(
    (claims ?? []).filter((c) => c.claimed_by === user.id).map((c) => c.item_id)
  );

  const shareSection = isOwner ? (
    <div className="rounded-2xl border border-card-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-muted">Share this list</h2>
      <form action={inviteMember.bind(null, listId)} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          placeholder="Invite by email"
          required
          className={`${inputClass} flex-1`}
        />
        <select name="role" className={inputClass}>
          <option value="viewer">Can view / claim</option>
          <option value="editor">Can also add items</option>
        </select>
        <button type="submit" className={primaryButton}>
          Invite
        </button>
      </form>
      {members && members.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-muted">
              <span>{m.invited_email ?? m.user_id}</span>
              <span className="text-xs">
                {m.role} · {m.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            &larr; All lists
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{list.name}</h1>
          {list.occasion && <p className="text-sm text-muted">{list.occasion}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex justify-end">
          <ListActionsMenu
            listId={listId}
            listName={list.name}
            isOwner={isOwner}
            shareSection={shareSection}
            initialShareOpen={share === "1"}
          />
        </div>

        <section className="rounded-2xl border border-card-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-muted">Add an item</h2>
          <form action={addItem.bind(null, listId)} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="product_url"
              placeholder="Paste a product URL"
              required
              className={`${inputClass} flex-1`}
            />
            <input name="title" placeholder="Name (optional)" className={`${inputClass} sm:w-40`} />
            <input
              name="target_price"
              placeholder="Notify below $"
              type="number"
              step="0.01"
              className={`${inputClass} sm:w-36`}
            />
            <button type="submit" className={primaryButton}>
              Add
            </button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Items {items && items.length > 0 ? `(${items.length})` : ""}
          </h2>
          <ul className="flex flex-col gap-3">
            {(items ?? []).map((item) => {
              const isClaimed = claimedItemIds.has(item.id);
              const isMyClaim = myClaimedItemIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-card-border bg-card p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-peach/20 text-lg">
                        🎁
                      </div>
                      <div>
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium tracking-tight hover:text-accent"
                        >
                          {item.title || item.product_url}
                        </a>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                          {item.retailer && <span>{item.retailer}</span>}
                          {item.current_price != null && (
                            <span className="rounded-full bg-peach/25 px-2 py-0.5 text-xs font-medium text-peach-foreground">
                              ${item.current_price}
                            </span>
                          )}
                          {item.target_price != null && (
                            <span className="text-xs">notify below ${item.target_price}</span>
                          )}
                        </div>
                        {!isOwner && isClaimed && (
                          <span className="mt-1.5 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {isMyClaim ? "Claimed by you" : "Already claimed"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-hover"
                      >
                        Buy
                      </a>
                      <CheckPriceButton listId={listId} itemId={item.id} />
                      {!isOwner &&
                        (isMyClaim ? (
                          <form action={unclaimItem.bind(null, listId, item.id)}>
                            <button className="text-xs text-muted hover:text-foreground">
                              Unclaim
                            </button>
                          </form>
                        ) : !isClaimed ? (
                          <form action={claimItem.bind(null, listId, item.id)}>
                            <button className="text-xs font-medium text-accent hover:text-accent-hover">
                              I&apos;ll get this
                            </button>
                          </form>
                        ) : null)}
                    </div>
                  </div>
                </li>
              );
            })}
            {(!items || items.length === 0) && (
              <div className="rounded-2xl border border-dashed border-card-border py-12 text-center">
                <p className="text-sm text-muted">No items yet — add one above.</p>
              </div>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

const inputClass =
  "rounded-xl border border-card-border bg-transparent px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

const primaryButton =
  "rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-hover";
