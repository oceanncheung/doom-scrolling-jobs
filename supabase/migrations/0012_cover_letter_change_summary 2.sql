alter table public.application_packets
  add column if not exists cover_letter_change_summary text;
