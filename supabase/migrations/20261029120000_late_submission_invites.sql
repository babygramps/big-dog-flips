-- Unlisted convenience flow, consistent with the league's open-admin model.
create table public.late_submission_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.late_submission_invites enable row level security;
create policy "public read" on public.late_submission_invites for select using (true);
grant select on public.late_submission_invites to anon, authenticated;
revoke insert, update, delete on public.late_submission_invites from anon, authenticated;

-- Match getLeagueContext: non-archived rounds ordered by position and creation.
-- Return the end of the current contiguous voting window, bounded by this round.
create function public.late_submission_deadline(p_round_id uuid)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_settings league_settings%rowtype;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_index int;
  v_round uuid;
  v_day date;
  v_template jsonb;
begin
  select * into v_settings from league_settings where id = 1;
  v_index := floor((v_today - v_settings.schedule_start_date)::numeric / 7)::int;
  if v_index < 0 then return null; end if;
  select id into v_round from rounds where not is_archived
    order by queue_position, created_at offset v_index limit 1;
  v_template := '{"monday":"submission","tuesday":"submission","wednesday":"submission","thursday":"voting","friday":"voting","saturday":"voting","sunday":"appreciation"}'::jsonb || coalesce(v_settings.weekly_phase_template, '{}'::jsonb);
  if v_round is distinct from p_round_id or
     coalesce(v_template->>lower(trim(to_char(v_today, 'Day'))), 'off') <> 'voting'
  then return null; end if;
  for i in 1..7 loop
    v_day := v_today + i;
    if v_day >= v_settings.schedule_start_date + (v_index + 1) * 7 or
       coalesce(v_template->>lower(trim(to_char(v_day, 'Day'))), 'off') <> 'voting'
    then return v_day::timestamp at time zone 'America/Los_Angeles'; end if;
  end loop;
  return null;
end;
$$;

create function public.create_late_submission_invite(p_round_id uuid, p_player_id uuid)
returns public.late_submission_invites language plpgsql security definer set search_path = public as $$
declare v_deadline timestamptz; v_invite late_submission_invites;
begin
  v_deadline := late_submission_deadline(p_round_id);
  if v_deadline is null then raise exception 'Late invites are available only during voting for the current round.'; end if;
  if not exists (select 1 from players where id = p_player_id and active) then raise exception 'Choose an active player.'; end if;
  if exists (select 1 from songs where round_id = p_round_id and player_id = p_player_id) then raise exception 'This player already submitted a song.'; end if;
  insert into late_submission_invites(round_id, player_id, expires_at)
    values(p_round_id, p_player_id, v_deadline) returning * into v_invite;
  return v_invite;
end;
$$;

create function public.revoke_late_submission_invite(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update late_submission_invites set revoked_at = now() where id = p_id and redeemed_at is null;
$$;

create function public.redeem_late_submission_invite(p_token uuid, p_song jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_invite late_submission_invites;
begin
  select * into v_invite from late_submission_invites where token = p_token for update;
  if not found then raise exception 'This invite does not exist.'; end if;
  if v_invite.redeemed_at is not null then raise exception 'This invite has already been used.'; end if;
  if v_invite.revoked_at is not null then raise exception 'This invite was revoked.'; end if;
  if now() >= v_invite.expires_at or late_submission_deadline(v_invite.round_id) is null then
    raise exception 'This invite has expired. Late submissions are only accepted during voting.';
  end if;
  if not exists (select 1 from players where id = v_invite.player_id and active) then raise exception 'This player is no longer active.'; end if;
  if exists (select 1 from songs where round_id = v_invite.round_id and player_id = v_invite.player_id) then raise exception 'This player already submitted a song.'; end if;
  if coalesce(trim(p_song->>'artist'), '') = '' or coalesce(trim(p_song->>'title'), '') = '' then raise exception 'Artist and title are required.'; end if;
  perform join_round_group(v_invite.round_id, v_invite.player_id);
  -- INSERT, never UPSERT: the unique song constraint also protects competing invites.
  insert into songs(round_id, player_id, artist, title, album, link, spotify_url, tidal_url, apple_music_url, youtube_music_url, submitter_note, artwork_url)
  values(v_invite.round_id, v_invite.player_id, trim(p_song->>'artist'), trim(p_song->>'title'),
    nullif(trim(p_song->>'album'), ''), nullif(p_song->>'link', ''), nullif(p_song->>'spotify_url', ''),
    nullif(p_song->>'tidal_url', ''), nullif(p_song->>'apple_music_url', ''), nullif(p_song->>'youtube_music_url', ''),
    nullif(trim(p_song->>'submitter_note'), ''), nullif(p_song->>'artwork_url', ''));
  update late_submission_invites set redeemed_at = now() where id = v_invite.id;
end;
$$;
