-- Shared multiplayer pause state. Only the shopper who pauses can resume,
-- and the elapsed pause time is added back to the match clock.
alter table public.rooms
  add column if not exists paused_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists paused_at timestamptz;

create or replace function public.reconcile_room(p_room uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.room_players
     set state='left', ready=false
   where room_id=p_room
     and state in ('joined','ready','active')
     and last_seen < now() - interval '45 seconds';

  -- A player who leaves while holding the shared pause cannot freeze a room.
  update public.rooms
     set started_at=case
           when status='playing' and paused_at is not null
             then started_at + (now()-paused_at)
           else started_at
         end,
         paused_by_user_id=null,
         paused_at=null,
         updated_at=now()
   where id=p_room
     and paused_by_user_id is not null
     and exists (
       select 1 from public.room_players
       where room_id=p_room
         and user_id=public.rooms.paused_by_user_id
         and state='left'
     );

  update public.rooms
     set status='closed', finished_at=coalesce(finished_at,now()),
         paused_by_user_id=null, paused_at=null, updated_at=now()
   where id=p_room
     and status in ('lobby','playing')
     and exists (
       select 1 from public.room_players
       where room_id=p_room
         and user_id=public.rooms.host_user_id
         and state='left'
     );

  update public.rooms
     set status='results', finished_at=coalesce(finished_at,now()),
         paused_by_user_id=null, paused_at=null, updated_at=now()
   where id=p_room and status='playing'
     and not exists (
       select 1 from public.room_players
       where room_id=p_room and state in ('joined','ready','active')
     );

  update public.rooms
     set status='closed', finished_at=coalesce(finished_at,now()),
         paused_by_user_id=null, paused_at=null, updated_at=now()
   where id=p_room and status='lobby'
     and not exists (
       select 1 from public.room_players
       where room_id=p_room and state <> 'left'
     );
end;
$$;

revoke all on function public.reconcile_room(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_room(uuid) to service_role;
