-- Keep the client-facing round-scoped reads fast as season data accumulates.

create index if not exists rounds_queue_position_idx
  on rounds (queue_position);

create index if not exists players_active_name_idx
  on players (active, name);

create index if not exists songs_round_created_idx
  on songs (round_id, created_at);

create index if not exists votes_round_idx
  on votes (round_id);

create index if not exists comments_round_created_idx
  on comments (round_id, created_at);

create index if not exists duplicate_groups_round_created_idx
  on duplicate_groups (round_id, created_at);
