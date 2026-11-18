-- How many people use the app, for the owner's usage page (/usage): counts
-- only, so no id, email or name ever leaves it. Only the server's key can
-- call it, and the page checks the signed-in account is the owner's first.
-- p_exclude leaves accounts out of every count (the owner's own use).
-- Safe to run again: it replaces the function and its grants.
create or replace function public.usage_stats(p_exclude uuid[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with players as (
    select id, created_at, steam_id, display_name, avatar_url
    from public.profiles
    where not (id = any (coalesce(p_exclude, '{}')))
  ),
  -- Anything a player did, and when: a change to a game, a pick, a profile or
  -- roast written, and signing in or the app refreshing their session, which
  -- it does while they have it open.
  activity as (
    select a.user_id, a.at
    from (
      select user_id, created_at as at from public.game_events
      union all select user_id, created_at from public.game_picks
      union all select user_id, generated_at from public.player_insights
      union all select user_id, created_at from auth.sessions
      union all select user_id, updated_at from auth.sessions
    ) a
    join players p on p.id = a.user_id
    where a.at is not null
  ),
  picks as (
    select k.created_at, k.user_id, k.kind, k.outcome, k.mood, k.energy, k.time
    from public.game_picks k
    join players p on p.id = k.user_id
  ),
  recent_picks as (
    select * from picks where created_at > now() - interval '30 days'
  ),
  -- A finish is its date being set, not the status changing (a game moved
  -- off Finished by mistake and back is the same finish).
  finishes as (
    select e.created_at, e.user_id
    from public.game_events e
    join players p on p.id = e.user_id
    where e.changes ? 'finished_at'
      and e.changes -> 'finished_at' ->> 0 is null
      and e.changes -> 'finished_at' ->> 1 is not null
  ),
  -- The games in libraries as the app counts them: no hidden ones, and none of
  -- the tools and soundtracks Steam lists.
  library as (
    select g.user_id, g.source, g.notes, g.rating, g.art_chosen
    from public.games g
    join players p on p.id = g.user_id
    where g.status <> 'hidden' and coalesce(g.type, 'game') = 'game'
  ),
  weeks as (
    select start, start + interval '1 week' as finish
    from generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as start
  )
  select jsonb_build_object(
    'players', (select count(*) from players),
    'steamConnected', (select count(*) from players where steam_id is not null),
    'withGames', (select count(distinct user_id) from library),
    'activeDay', (select count(distinct user_id) from activity where at > now() - interval '1 day'),
    'activeWeek', (select count(distinct user_id) from activity where at > now() - interval '7 days'),
    'activeMonth', (select count(distinct user_id) from activity where at > now() - interval '30 days'),
    -- Did something on a later day than the one they signed up on.
    'cameBack', (
      select count(*) from players p
      where exists (
        select 1 from activity a where a.user_id = p.id and a.at >= p.created_at + interval '1 day'
      )
    ),
    -- How they signed in: an account can have more than one way.
    'signups', jsonb_build_object(
      'email', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'email'
      ),
      'google', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'google'
      ),
      'discord', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'discord'
      ),
      'unconfirmed', (
        select count(*) from auth.users u
        join players p on p.id = u.id where u.email_confirmed_at is null
      )
    ),
    'libraries', jsonb_build_object(
      'medianGames', (
        select coalesce(round(percentile_cont(0.5) within group (order by n)::numeric), 0)
        from (select count(*) as n from library group by user_id) s
      ),
      'steamGames', (select count(*) from library where source = 'steam'),
      'manualGames', (select count(*) from library where source = 'manual'),
      'manualOnly', (
        select count(*) from (
          select user_id from library group by user_id
          having bool_and(source = 'manual')
        ) s
      )
    ),
    -- Players who have used each feature, ever (or have it now, where only
    -- the present is kept: favorites, notes, ratings, art, a profile or roast).
    'features', jsonb_build_object(
      'queue', (
        select count(*) from players p
        where exists (select 1 from public.game_events e where e.user_id = p.id and e.kind = 'queue')
          or exists (select 1 from public.playing_queue q where q.user_id = p.id)
      ),
      'favorites', (
        select count(distinct f.user_id) from public.favorite_games f
        join players p on p.id = f.user_id
      ),
      'notes', (select count(distinct user_id) from library where coalesce(notes, '') <> ''),
      'ratings', (select count(distinct user_id) from library where rating is not null),
      'addedByHand', (select count(distinct user_id) from library where source = 'manual'),
      'chosenArt', (select count(distinct user_id) from library where art_chosen),
      'shareCards', (
        select count(distinct s.user_id) from public.shared_completions s
        join players p on p.id = s.user_id
      ),
      'nameOrPicture', (
        select count(*) from players where display_name is not null or avatar_url is not null
      ),
      'profile', (
        select count(*) from public.player_insights i
        join players p on p.id = i.user_id where i.tone = 'profile'
      ),
      'roast', (
        select count(*) from public.player_insights i
        join players p on p.id = i.user_id where i.tone = 'roast'
      )
    ),
    'pickMyGame', jsonb_build_object(
      'questions', (select count(*) from recent_picks where kind = 'questions'),
      'random', (select count(*) from recent_picks where kind = 'random'),
      'played', (select count(*) from recent_picks where outcome = 'played'),
      'queued', (select count(*) from recent_picks where outcome = 'queued'),
      'rerolled', (select count(*) from recent_picks where outcome = 'rerolled'),
      'closed', (select count(*) from recent_picks where outcome is null),
      -- The three answers given most to each question.
      'moods', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', mood, 'picks', n) order by n desc, mood), '[]')
        from (
          select mood, count(*) as n from recent_picks where mood is not null
          group by mood order by n desc, mood limit 3
        ) s
      ),
      'energies', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', energy, 'picks', n) order by n desc, energy), '[]')
        from (
          select energy, count(*) as n from recent_picks where energy is not null
          group by energy order by n desc, energy limit 3
        ) s
      ),
      'times', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', time, 'picks', n) order by n desc, time), '[]')
        from (
          select time, count(*) as n from recent_picks where time is not null
          group by time order by n desc, time limit 3
        ) s
      )
    ),
    'weeks', (
      select jsonb_agg(
        jsonb_build_object(
          'start', w.start,
          'signups', (select count(*) from players p where p.created_at >= w.start and p.created_at < w.finish),
          'active', (select count(distinct a.user_id) from activity a where a.at >= w.start and a.at < w.finish),
          'picks', (select count(*) from picks k where k.created_at >= w.start and k.created_at < w.finish),
          'finishes', (select count(*) from finishes f where f.created_at >= w.start and f.created_at < w.finish)
        )
        order by w.start desc
      )
      from weeks w
    ),
    'month', jsonb_build_object(
      'picks', (select count(*) from recent_picks),
      'picksTaken', (select count(*) from recent_picks where outcome in ('played', 'queued')),
      'pickers', (select count(distinct user_id) from recent_picks),
      'finishes', (select count(*) from finishes where created_at > now() - interval '30 days'),
      'finishers', (select count(distinct user_id) from finishes where created_at > now() - interval '30 days'),
      -- Only the latest profile and roast are kept, so this counts players
      -- whose latest one is from this month.
      'insightWriters', (
        select count(distinct i.user_id) from public.player_insights i
        join players p on p.id = i.user_id
        where i.generated_at > now() - interval '30 days'
      ),
      'supportTickets', (
        select count(*) from public.support_tickets t
        join players p on p.id = t.user_id
        where t.created_at > now() - interval '30 days'
      )
    )
  );
$$;

revoke all on function public.usage_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.usage_stats(uuid[]) to service_role;
