-- Three points per player, spread across songs or spent on a single song.
-- Existing vote rows and historical song totals stay unchanged.
alter table public.league_settings
  alter column points_per_player set default 3;

update public.league_settings
set points_per_player = 3
where id = 1;
