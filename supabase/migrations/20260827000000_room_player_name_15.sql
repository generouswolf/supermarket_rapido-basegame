-- Multiplayer names can use a longer private gamer tag.
alter table public.room_players
  drop constraint if exists room_players_display_name_check;

alter table public.room_players
  add constraint room_players_display_name_check
  check (char_length(display_name) between 1 and 15);
