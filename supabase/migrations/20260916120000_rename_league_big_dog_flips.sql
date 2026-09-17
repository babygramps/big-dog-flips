-- This fork runs the Big Dog Flips league. Change the defaults and flip the
-- settings row only if it still carries the upstream default name, so a name
-- chosen in the admin page is left alone.
alter table league_settings alter column league_name set default 'Big Dog Flips';
alter table league_settings alter column season_label set default 'Season 1';

update league_settings
set league_name = 'Big Dog Flips',
    season_label = 'Season 1'
where id = 1
  and league_name = 'Muzak de Seattle';
