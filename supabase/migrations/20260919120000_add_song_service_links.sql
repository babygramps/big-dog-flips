-- Optional direct track links. Keep link for existing submissions and services
-- beyond these four. No backfill is needed: old links still display as before.
alter table public.songs
  add column if not exists spotify_url text,
  add column if not exists tidal_url text,
  add column if not exists apple_music_url text,
  add column if not exists youtube_music_url text;
