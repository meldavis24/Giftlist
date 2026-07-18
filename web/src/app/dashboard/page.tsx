import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapUser } from "@/lib/bootstrap-user";
import { createList, signOut } from "./actions";
import PushSubscribeButton from "@/components/PushSubscribeButton";

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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your lists</h1>
        <div className="flex items-center gap-3">
          <PushSubscribeButton />
          <Link href="/settings/tokens" className="text-sm text-neutral-500 underline">
            Extension tokens
          </Link>
          <form action={signOut}>
            <button className="text-sm text-neutral-500 underline">Sign out</button>
          </form>
        </div>
      </div>

      <form action={createList} className="mb-8 flex gap-2">
        <input
          name="name"
          placeholder="List name (e.g. Christmas 2026)"
          required
          className="flex-1 rounded border px-3 py-2"
        />
        <input name="occasion" placeholder="Occasion" className="w-40 rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Create
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {(lists ?? []).map((list) => (
          <li key={list.id}>
            <Link
              href={`/lists/${list.id}`}
              className="block rounded border px-4 py-3 hover:bg-neutral-50"
            >
              <div className="font-medium">{list.name}</div>
              {list.occasion && <div className="text-sm text-neutral-500">{list.occasion}</div>}
            </Link>
          </li>
        ))}
        {(!lists || lists.length === 0) && (
          <p className="text-sm text-neutral-500">No lists yet — create one above.</p>
        )}
      </ul>
    </div>
  );
}
