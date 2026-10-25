-- Shared state for serverless: rate-limit counters and the roast cache used to
-- live in each instance's memory, so limits reset on cold starts and multiply
-- with the instance count, and shared roast links missed the cache.
-- Both tables are written only by the server with the service role: RLS is
-- enabled with no policies, so anon/authenticated users can't touch them.

create table if not exists rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
alter table rate_limits enable row level security;

-- Atomically counts one request against `p_key` and reports whether it is
-- within `p_limit` for the current window.
create or replace function consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
begin
  insert into rate_limits as rl (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rl.reset_at <= now() then 1 else rl.count + 1 end,
        reset_at = case
          when rl.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
          else rl.reset_at
        end
  returning rl.count, rl.reset_at into v_count, v_reset;

  -- Occasionally drop long-expired counters so the table stays small.
  if random() < 0.01 then
    delete from rate_limits where rate_limits.reset_at < now() - interval '1 day';
  end if;

  return query select v_count <= p_limit, greatest(p_limit - v_count, 0), v_reset;
end;
$$;

revoke all on function consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, integer, integer) to service_role;

create table if not exists roast_cache (
  steam_id text primary key,
  response jsonb not null,
  expires_at timestamptz not null
);
alter table roast_cache enable row level security;
create index if not exists roast_cache_expires_at on roast_cache (expires_at);
