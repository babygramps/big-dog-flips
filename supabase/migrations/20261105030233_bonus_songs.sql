-- Separate storage guarantees extras cannot receive votes or duplicate-merge points:
-- both features reference public.songs, never this table.
create table public.bonus_songs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  artist text not null check (length(trim(artist)) > 0),
  title text not null check (length(trim(title)) > 0),
  album text,
  link text,
  spotify_url text,
  tidal_url text,
  apple_music_url text,
  youtube_music_url text,
  artwork_url text,
  submitter_note text,
  created_at timestamptz not null default now()
);
create index bonus_songs_round_id_idx on public.bonus_songs(round_id);
alter table public.bonus_songs enable row level security;
grant select, insert, update, delete on public.bonus_songs to anon, authenticated;
create policy "Public bonus songs" on public.bonus_songs
  for all to anon, authenticated using (true) with check (true);
alter publication supabase_realtime add table public.bonus_songs;

-- Stop future competition splits, including requests from older clients.
update public.league_settings set b_sides_enabled = false;
create or replace function public.assign_round_groups(p_round_id uuid, p_assignments jsonb)
returns int language sql security invoker set search_path = public
as $$ select 0; $$;
