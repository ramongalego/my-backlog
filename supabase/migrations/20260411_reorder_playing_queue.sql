-- Atomic, validated reorder of a user's playing queue.
-- Replaces the previous non-atomic fan-out of N UPDATE statements from the API
-- route, which could leave the queue in an inconsistent state on partial failure.
--
-- Runs with the caller's privileges (SECURITY INVOKER) so RLS on playing_queue
-- still applies — the function cannot touch another user's rows.

create or replace function public.reorder_playing_queue(p_order bigint[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_len integer := coalesce(array_length(p_order, 1), 0);
  v_existing_count integer;
  v_distinct_count integer;
  v_missing_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_order_len = 0 then
    raise exception 'Order must not be empty' using errcode = '22023';
  end if;

  select count(*) into v_existing_count
  from playing_queue
  where user_id = v_user_id;

  if v_existing_count <> v_order_len then
    raise exception 'Order length does not match queue size' using errcode = '22023';
  end if;

  select count(distinct x) into v_distinct_count
  from unnest(p_order) as x;

  if v_distinct_count <> v_order_len then
    raise exception 'Order contains duplicate app_ids' using errcode = '22023';
  end if;

  select count(*) into v_missing_count
  from unnest(p_order) as x
  where not exists (
    select 1 from playing_queue
    where user_id = v_user_id and app_id = x
  );

  if v_missing_count <> 0 then
    raise exception 'Order references games not in queue' using errcode = '22023';
  end if;

  -- Single-statement UPDATE. Postgres defers UNIQUE constraint checks to the
  -- end of the statement, so rearranging positions within one statement is
  -- safe even if (user_id, position) has a unique index.
  update playing_queue as pq
  set position = (new_order.pos - 1)::integer
  from unnest(p_order) with ordinality as new_order(app_id, pos)
  where pq.user_id = v_user_id
    and pq.app_id = new_order.app_id;
end;
$$;

grant execute on function public.reorder_playing_queue(bigint[]) to authenticated;
