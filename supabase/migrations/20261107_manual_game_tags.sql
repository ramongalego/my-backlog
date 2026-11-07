-- Games added by hand that Steam doesn't sell get their tags from IGDB. (Ones
-- Steam sells, with a steam_app_id, get Steam's, already in vote order, and
-- are left alone here.) IGDB's used to be stored as
-- genres, then themes, then keywords, so a subgenre like Metroidvania came
-- last, where tag matching (More Like ..., Pick My Game) weighs a tag least.
-- And every RPG made in Japan was tagged JRPG, Castlevania: Aria of Sorrow
-- included. Games added from now on get both right (igdbTags in
-- lib/igdb/api.ts); this fixes the ones already added.

-- Subgenres first, then the rest in the order they were in. The list is
-- SUBGENRE_TAGS in lib/igdb/api.ts.
update games
set tags = (
  select array_agg(tag order by tag = any (array[
    'Metroidvania', 'Roguelike', 'Roguelite', 'Souls-like', 'Immersive Sim',
    'Boomer Shooter', 'Bullet Hell', 'Survival Horror', 'Deckbuilding',
    'Creature Collector', 'Tactical RPG', 'Party-Based RPG', 'CRPG',
    'Turn-Based Tactics', 'Turn-Based Combat', 'Dungeon Crawler', 'Dating Sim',
    'Life Sim', 'Rhythm'
  ]) desc, position)
  from unnest(tags) with ordinality as t (tag, position)
)
where source = 'manual'
  and steam_app_id is null
  and tags && array[
    'Metroidvania', 'Roguelike', 'Roguelite', 'Souls-like', 'Immersive Sim',
    'Boomer Shooter', 'Bullet Hell', 'Survival Horror', 'Deckbuilding',
    'Creature Collector', 'Tactical RPG', 'Party-Based RPG', 'CRPG',
    'Turn-Based Tactics', 'Turn-Based Combat', 'Dungeon Crawler', 'Dating Sim',
    'Life Sim', 'Rhythm'
  ]::text[];

-- Japanese platformers, Metroidvanias and Souls-likes aren't JRPGs.
update games
set tags = array_remove(tags, 'JRPG')
where source = 'manual'
  and steam_app_id is null
  and 'JRPG' = any (tags)
  and tags && array['Platformer', 'Metroidvania', 'Souls-like']::text[];
