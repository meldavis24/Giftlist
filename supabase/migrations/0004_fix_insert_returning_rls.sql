-- Bug found while smoke-testing: INSERT ... RETURNING (which every
-- supabase-js `.insert(...).select().single()` call compiles to) implicitly
-- re-checks the new row against the table's SELECT policies. When that SELECT
-- policy goes through the `private.is_list_member()` SECURITY DEFINER helper,
-- the helper's internal query does not see the row just inserted earlier in
-- the same command, so the RETURNING check fails with "new row violates
-- row-level security policy" even though the INSERT's own WITH CHECK passed.
-- Confirmed by reproducing in isolation: a plain inline `owner_id = auth.uid()`
-- SELECT policy (no function indirection) does NOT hit this, while the
-- function-backed policy reliably does, on the same row, in the same session.
--
-- Fix: add a second, simple, function-free permissive SELECT policy that
-- covers "the row I just created" for the two tables where the app actually
-- requests the inserted row back (`lists` via createList, and defensively
-- `list_items` for the same insert-then-select pattern). RLS permissive
-- policies are OR'd, so this doesn't loosen who can see *other* people's rows
-- -- it only guarantees a user can always see their own just-written row.

create policy "owner sees own list rows immediately"
  on lists for select to authenticated using (owner_id = (select auth.uid()));

create policy "adder sees own item rows immediately"
  on list_items for select to authenticated using (added_by = (select auth.uid()));
