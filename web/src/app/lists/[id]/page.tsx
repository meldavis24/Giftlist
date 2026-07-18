import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapUser } from "@/lib/bootstrap-user";
import { addItem, claimItem, unclaimItem, inviteMember, checkPriceNow } from "./actions";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params;
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <a href="/dashboard" className="text-sm text-neutral-500 underline">
        &larr; All lists
      </a>
      <h1 className="mt-2 text-2xl font-semibold">{list.name}</h1>
      {list.occasion && <p className="text-neutral-500">{list.occasion}</p>}

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Add an item</h2>
        <form action={addItem.bind(null, listId)} className="flex flex-col gap-2 sm:flex-row">
          <input
            name="product_url"
            placeholder="Product URL"
            required
            className="flex-1 rounded border px-3 py-2"
          />
          <input name="title" placeholder="Name (optional)" className="rounded border px-3 py-2" />
          <input
            name="target_price"
            placeholder="Notify below $"
            type="number"
            step="0.01"
            className="w-36 rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Add
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Items</h2>
        <ul className="flex flex-col gap-3">
          {(items ?? []).map((item) => {
            const isClaimed = claimedItemIds.has(item.id);
            const isMyClaim = myClaimedItemIds.has(item.id);
            return (
              <li key={item.id} className="rounded border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline"
                    >
                      {item.title || item.product_url}
                    </a>
                    <div className="text-sm text-neutral-500">
                      {item.retailer}
                      {item.current_price != null && ` · $${item.current_price}`}
                      {item.target_price != null && ` · notify below $${item.target_price}`}
                    </div>
                    {!isOwner && isClaimed && (
                      <div className="mt-1 text-sm text-green-700">
                        {isMyClaim ? "Claimed by you" : "Already claimed by someone"}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-black px-3 py-1.5 text-sm text-white"
                    >
                      Buy
                    </a>
                    <form action={checkPriceNow.bind(null, listId, item.id)}>
                      <button className="text-xs text-neutral-500 underline">
                        Check price now
                      </button>
                    </form>
                    {!isOwner &&
                      (isMyClaim ? (
                        <form action={unclaimItem.bind(null, listId, item.id)}>
                          <button className="text-xs text-neutral-500 underline">Unclaim</button>
                        </form>
                      ) : !isClaimed ? (
                        <form action={claimItem.bind(null, listId, item.id)}>
                          <button className="text-xs text-neutral-500 underline">
                            Claim (I'll get this)
                          </button>
                        </form>
                      ) : null)}
                  </div>
                </div>
              </li>
            );
          })}
          {(!items || items.length === 0) && (
            <p className="text-sm text-neutral-500">No items yet.</p>
          )}
        </ul>
      </section>

      {isOwner && (
        <section className="mt-8">
          <h2 className="mb-3 font-medium">Share this list</h2>
          <form action={inviteMember.bind(null, listId)} className="flex gap-2">
            <input
              name="email"
              type="email"
              placeholder="Invite by email"
              required
              className="flex-1 rounded border px-3 py-2"
            />
            <select name="role" className="rounded border px-3 py-2">
              <option value="viewer">Can view / claim</option>
              <option value="editor">Can also add items</option>
            </select>
            <button type="submit" className="rounded bg-black px-4 py-2 text-white">
              Invite
            </button>
          </form>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-500">
            {(members ?? []).map((m) => (
              <li key={m.id}>
                {m.invited_email ?? m.user_id} — {m.role} ({m.status})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
