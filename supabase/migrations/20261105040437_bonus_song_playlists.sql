-- Keep extras separate from the voting pools of legacy split rounds.
create table public.bonus_playlists (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  group_index int not null default 0 check (group_index = 0),
  service text not null default 'Playlist',
  url text not null,
  created_at timestamptz not null default now(),
  unique (round_id, url)
);
create index bonus_playlists_round_idx on public.bonus_playlists(round_id, created_at);
alter table public.bonus_playlists enable row level security;
grant select, insert, update, delete on public.bonus_playlists to anon, authenticated;
create policy "Public bonus playlists" on public.bonus_playlists
  for all to anon, authenticated using (true) with check (true);
alter publication supabase_realtime add table public.bonus_playlists;
