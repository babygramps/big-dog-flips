-- One voting pool is the default. Side B is an explicit league opt-in.
alter table public.league_settings
  add column if not exists b_sides_enabled boolean not null default false;

-- Preserve first-writer-wins assignment and all existing split rounds.
create or replace function assign_round_groups(
  p_round_id uuid,
  p_assignments jsonb
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing int;
  v_inserted int;
  v_total int;
  v_distinct int;
begin
  if p_round_id is null then
    raise exception 'A round is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('round_groups:' || p_round_id::text));

  select count(*) into v_existing
  from round_groups
  where round_id = p_round_id;

  if v_existing > 0 then
    return 0;
  end if;

  -- Consult the saved setting so stale clients cannot split a one-side league.
  -- Existing assignments stay frozen and late joiners still use join_round_group.
  if not coalesce((select b_sides_enabled from league_settings where id = 1), false) then
    return 0;
  end if;

  select count(*), count(distinct (entry->>'player_id')::uuid)
  into v_total, v_distinct
  from jsonb_array_elements(p_assignments) as entry;

  if coalesce(v_total, 0) = 0 then
    raise exception 'No players to assign.' using errcode = '22023';
  end if;

  if v_total <> v_distinct then
    raise exception 'A player cannot be assigned to both sides.' using errcode = '22023';
  end if;

  insert into round_groups (round_id, player_id, group_index)
  select p_round_id, (entry->>'player_id')::uuid, (entry->>'group_index')::int
  from jsonb_array_elements(p_assignments) as entry
  on conflict (round_id, player_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
