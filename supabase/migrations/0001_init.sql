-- GiftList MVP schema
-- Run against a Supabase project (Postgres + auth.users already provided by Supabase Auth)

create extension if not exists "pgcrypto";

-- Mirrors auth.users with app-specific profile fields
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  occasion text,
  created_at timestamptz not null default now()
);

create table list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  added_by uuid not null references profiles(id) on delete cascade,
  product_url text not null,
  title text,
  image_url text,
  retailer text,
  current_price numeric(10, 2),
  target_price numeric(10, 2),
  notes text,
  created_at timestamptz not null default now()
);

-- Separate from list_items so RLS can hide claims from the list owner (keeps the surprise)
create table item_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references list_items(id) on delete cascade,
  claimed_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table price_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references list_items(id) on delete cascade,
  price numeric(10, 2) not null,
  checked_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Helper: is the current user a member (any role, accepted) of a list?
create or replace function is_list_member(target_list_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from lists l where l.id = target_list_id and l.owner_id = auth.uid()
    union
    select 1 from list_members m
      where m.list_id = target_list_id and m.user_id = auth.uid() and m.status = 'accepted'
  );
$$;

alter table profiles enable row level security;
alter table lists enable row level security;
alter table list_members enable row level security;
alter table list_items enable row level security;
alter table item_claims enable row level security;
alter table price_checks enable row level security;
alter table push_subscriptions enable row level security;

-- profiles: readable by any authenticated user (needed to show names on shared lists), writable only by self
create policy "profiles are readable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "users can update their own profile"
  on profiles for update to authenticated using (id = auth.uid());
create policy "users can insert their own profile"
  on profiles for insert to authenticated with check (id = auth.uid());

-- lists: visible to owner + accepted members; only owner can insert/update/delete
create policy "list visible to members"
  on lists for select to authenticated using (is_list_member(id));
create policy "owner creates list"
  on lists for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates list"
  on lists for update to authenticated using (owner_id = auth.uid());
create policy "owner deletes list"
  on lists for delete to authenticated using (owner_id = auth.uid());

-- list_members: visible to members of that list; owner/editor can invite; only owner can remove
create policy "members visible to list members"
  on list_members for select to authenticated using (is_list_member(list_id));
create policy "owner or editor invites member"
  on list_members for insert to authenticated with check (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
    or exists (select 1 from list_members m where m.list_id = list_id and m.user_id = auth.uid() and m.role = 'editor' and m.status = 'accepted')
  );
create policy "invited user accepts their own membership"
  on list_members for update to authenticated
  using (user_id = auth.uid() or (user_id is null and invited_email = auth.email()))
  with check (user_id = auth.uid());
create policy "owner removes member"
  on list_members for delete to authenticated using (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- list_items: visible to members; owner/editor can add; adder or owner can edit/delete
create policy "items visible to list members"
  on list_items for select to authenticated using (is_list_member(list_id));
create policy "owner or editor adds item"
  on list_items for insert to authenticated with check (
    is_list_member(list_id) and added_by = auth.uid()
  );
create policy "adder or owner updates item"
  on list_items for update to authenticated using (
    added_by = auth.uid()
    or exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
  );
create policy "adder or owner deletes item"
  on list_items for delete to authenticated using (
    added_by = auth.uid()
    or exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- item_claims: THE PRIVACY RULE. List owner must never see or create a claim on their own list's item.
create policy "non-owner members see claims"
  on item_claims for select to authenticated using (
    exists (
      select 1 from list_items li
        join lists l on l.id = li.list_id
        where li.id = item_id
          and is_list_member(li.list_id)
          and l.owner_id <> auth.uid()
    )
  );
create policy "non-owner member claims item"
  on item_claims for insert to authenticated with check (
    claimed_by = auth.uid()
    and exists (
      select 1 from list_items li
        join lists l on l.id = li.list_id
        where li.id = item_id
          and is_list_member(li.list_id)
          and l.owner_id <> auth.uid()
    )
  );
create policy "claimer unclaims"
  on item_claims for delete to authenticated using (claimed_by = auth.uid());

-- price_checks: visible to list members; writes come from the worker via service role only
create policy "price history visible to list members"
  on price_checks for select to authenticated using (
    exists (select 1 from list_items li where li.id = item_id and is_list_member(li.list_id))
  );

-- push_subscriptions: strictly own rows
create policy "manage own push subscriptions"
  on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
