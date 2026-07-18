-- Personal access tokens for the browser extension (and any future non-cookie client).
-- The raw token is shown to the user exactly once at creation time and never stored;
-- only its SHA-256 hash is kept, so a leaked database dump doesn't leak usable tokens.

create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null default 'Browser extension',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table api_tokens enable row level security;

create policy "users manage their own tokens"
  on api_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
