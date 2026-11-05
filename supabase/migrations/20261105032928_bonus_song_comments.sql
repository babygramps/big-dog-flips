-- Side B has the same discussion features, isolated from scored-song awards.
create table public.bonus_comments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  song_id uuid not null references public.bonus_songs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  body text not null default '',
  gif_url text,
  gif_preview_url text,
  gif_provider text,
  gif_id text,
  created_at timestamptz not null default now(),
  constraint bonus_comments_has_content check (nullif(trim(body), '') is not null or gif_url is not null),
  constraint bonus_comments_gif_urls_are_https check (
    (gif_url is null or gif_url like 'https://%') and
    (gif_preview_url is null or gif_preview_url like 'https://%')
  )
);
create index bonus_comments_round_id_idx on public.bonus_comments(round_id);
create index bonus_comments_song_id_idx on public.bonus_comments(song_id);
create table public.bonus_comment_likes (
  comment_id uuid not null references public.bonus_comments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, player_id)
);
alter table public.bonus_comments enable row level security;
alter table public.bonus_comment_likes enable row level security;
grant select, insert, update, delete on public.bonus_comments, public.bonus_comment_likes to anon, authenticated;
create policy "Public bonus comments" on public.bonus_comments
  for all to anon, authenticated using (true) with check (true);
create policy "Public bonus comment likes" on public.bonus_comment_likes
  for all to anon, authenticated using (true) with check (true);
alter publication supabase_realtime add table public.bonus_comments;
alter publication supabase_realtime add table public.bonus_comment_likes;
