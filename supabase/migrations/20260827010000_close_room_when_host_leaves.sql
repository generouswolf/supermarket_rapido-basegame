-- A host departure closes the room instead of transferring ownership.
-- Remaining shoppers receive the host-disconnected screen in the client.
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

  update public.rooms
     set status='closed', finished_at=coalesce(finished_at,now()), updated_at=now()
   where id=p_room
     and status in ('lobby','playing')
     and exists (
       select 1 from public.room_players
       where room_id=p_room
         and user_id=public.rooms.host_user_id
         and state='left'
     );

  update public.rooms
     set status='results', finished_at=coalesce(finished_at,now()), updated_at=now()
   where id=p_room and status='playing'
     and not exists (
       select 1 from public.room_players
       where room_id=p_room and state in ('joined','ready','active')
     );

  update public.rooms
     set status='closed', finished_at=coalesce(finished_at,now()), updated_at=now()
   where id=p_room and status='lobby'
     and not exists (
       select 1 from public.room_players
       where room_id=p_room and state <> 'left'
     );
end;
$$;

revoke all on function public.reconcile_room(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_room(uuid) to service_role;
