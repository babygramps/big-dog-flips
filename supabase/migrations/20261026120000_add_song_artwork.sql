-- Optional cover art found from free catalogs when a song is submitted.
-- Older songs simply show no thumbnail.
alter table public.songs
  add column if not exists artwork_url text;
