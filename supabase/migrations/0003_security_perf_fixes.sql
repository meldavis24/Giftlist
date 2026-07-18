-- Fixes from Supabase's security/performance advisors:
-- 1. is_list_member was a SECURITY DEFINER function in `public`, which PostgREST
--    exposes as a directly-callable RPC endpoint to anon/authenticated -- not
--    intended, it's meant to be an internal helper for RLS policies only. Move
--    it to a `private` schema (not exposed by PostgREST) and pin its search_path.
-- 2. RLS policies called auth.uid()/auth.email() directly, which Postgres
--    re-evaluates per row. Wrapping in (select ...) lets it evaluate once per
--    query and reuse a cached plan.
-- 3. Several foreign keys had no covering index.

-- Drop every policy that references is_list_member() or a bare auth.*() call
-- so the function can be dropped and recreated without dependency errors.
drop policy "list visible to members" on lists;
drop policy "owner creates list" on lists;
drop policy "owner updates list" on lists;
drop policy "owner deletes list" on lists;
drop policy "members visible to list members" on list_members;
drop policy "owner or editor invites member" on list_members;
drop policy "invited user accepts their own membership" on list_members;
drop policy "owner removes member" on list_members;
drop policy "items visible to list members" on list_items;
drop policy "owner or editor adds item" on list_items;
drop policy "adder or owner updates item" on list_items;
drop policy "adder or owner deletes item" on list_items;
drop policy "non-owner members see claims" on item_claims;
drop policy "non-owner member claims item" on item_claims;
drop policy "claimer unclaims" on item_claims;
drop policy "price history visible to list members" on price_checks;
drop policy "manage own push subscriptions" on push_subscriptions;
drop policy "users manage their own tokens" on api_tokens;
drop policy "users can update their own profile" on profiles;
drop policy "users can insert their own profile" on profiles;

drop function if exists public.is_list_member(uuid);

create schema if not exists private;

create function private.is_list_member(target_list_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.lists l where l.id = target_list_id and l.owner_id = (select auth.uid())
    union
    select 1 from public.list_members m
      where m.list_id = target_list_id and m.user_id = (select auth.uid()) and m.status = 'accepted'
  );
$$;

revoke all on function private.is_list_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_list_member(uuid) to authenticated;

-- Recreate all policies with the relocated function + (select auth.*()) wrapping.

create policy "users can update their own profile"
  on profiles for update to authenticated using (id = (select auth.uid()));
create policy "users can insert their own profile"
  on profiles for insert to authenticated with check (id = (select auth.uid()));

create policy "list visible to members"
  on lists for select to authenticated using (private.is_list_member(id));
create policy "owner creates list"
  on lists for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates list"
  on lists for update to authenticated using (owner_id = (select auth.uid()));
create policy "owner deletes list"
  on lists for delete to authenticated using (owner_id = (select auth.uid()));

create policy "members visible to list members"
  on list_members for select to authenticated using (private.is_list_member(list_id));
create policy "owner or editor invites member"
  on list_members for insert to authenticated with check (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = (select auth.uid()))
    or exists (select 1 from list_members m where m.list_id = list_id and m.user_id = (select auth.uid()) and m.role = 'editor' and m.status = 'accepted')
  );
create policy "invited user accepts their own membership"
  on list_members for update to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and invited_email = (select auth.email())))
  with check (user_id = (select auth.uid()));
create policy "owner removes member"
  on list_members for delete to authenticated using (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = (select auth.uid()))
  );

create policy "items visible to list members"
  on list_items for select to authenticated using (private.is_list_member(list_id));
create policy "owner or editor adds item"
  on list_items for insert to authenticated with check (
    private.is_list_member(list_id) and added_by = (select auth.uid())
  );
create policy "adder or owner updates item"
  on list_items for update to authenticated using (
    added_by = (select auth.uid())
    or exists (select 1 from lists l where l.id = list_id and l.owner_id = (select auth.uid()))
  );
create policy "adder or owner deletes item"
  on list_items for delete to authenticated using (
    added_by = (select auth.uid())
    or exists (select 1 from lists l where l.id = list_id and l.owner_id = (select auth.uid()))
  );

create policy "non-owner members see claims"
  on item_claims for select to authenticated using (
    exists (
      select 1 from list_items li
        join lists l on l.id = li.list_id
        where li.id = item_id
          and private.is_list_member(li.list_id)
          and l.owner_id <> (select auth.uid())
    )
  );
create policy "non-owner member claims item"
  on item_claims for insert to authenticated with check (
    claimed_by = (select auth.uid())
    and exists (
      select 1 from list_items li
        join lists l on l.id = li.list_id
        where li.id = item_id
          and private.is_list_member(li.list_id)
          and l.owner_id <> (select auth.uid())
    )
  );
create policy "claimer unclaims"
  on item_claims for delete to authenticated using (claimed_by = (select auth.uid()));

create policy "price history visible to list members"
  on price_checks for select to authenticated using (
    exists (select 1 from list_items li where li.id = item_id and private.is_list_member(li.list_id))
  );

create policy "manage own push subscriptions"
  on push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "users manage their own tokens"
  on api_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Covering indexes for foreign keys flagged by the performance advisor.
create index if not exists idx_lists_owner_id on lists (owner_id);
create index if not exists idx_list_members_user_id on list_members (user_id);
create index if not exists idx_list_items_list_id on list_items (list_id);
create index if not exists idx_list_items_added_by on list_items (added_by);
create index if not exists idx_item_claims_claimed_by on item_claims (claimed_by);
create index if not exists idx_price_checks_item_id on price_checks (item_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions (user_id);
create index if not exists idx_api_tokens_user_id on api_tokens (user_id);
