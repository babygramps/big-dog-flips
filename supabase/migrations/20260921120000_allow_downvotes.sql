-- Negative one represents the optional downvote. Positive points remain upvotes.
-- Existing ballots are preserved, including historical three-upvote ballots.
alter table public.votes drop constraint if exists votes_points_check;
alter table public.votes add constraint votes_points_check
  check (points = -1 or points > 0);
