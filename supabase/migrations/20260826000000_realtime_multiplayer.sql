-- Supermarket Rapido real multiplayer. Client keys can read only room data;
-- every mutation that affects a match is performed by the room-action Edge Function.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete restrict,
  store text not null check (store in ('food','tech')),
  currency text not null check (currency in ('usd','eur','jpy')),
  budget_base numeric(10,2) not null check (budget_base > 0),
  duration_seconds integer not null check (duration_seconds between 60 and 1800),
  max_players integer not null default 6 check (max_players between 2 and 8),
  status text not null default 'lobby' check (status in ('lobby','playing','results','closed')),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 10),
  avatar text not null check (avatar in ('orange','blue','green','yellow','pink','black')),
  sex text not null check (sex in ('female','male')),
  ready boolean not null default false,
  state text not null default 'joined' check (state in ('joined','ready','active','finished','left')),
  position jsonb not null default '{"x":48,"y":73}'::jsonb,
  score_base numeric(10,2) not null default 0 check (score_base >= 0),
  cart_count integer not null default 0 check (cart_count >= 0),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(room_id,user_id)
);

create table if not exists public.room_inventory (
  room_id uuid not null references public.rooms(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  price_base numeric(10,2) not null check (price_base >= 0),
  stock integer not null check (stock >= 0),
  max_stock integer not null check (max_stock >= 0),
  primary key(room_id,product_id)
);

create table if not exists public.room_cart_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.room_players(id) on delete cascade,
  product_id text not null,
  price_base numeric(10,2) not null check (price_base >= 0),
  collected_at timestamptz not null default now()
);

create index if not exists room_players_room_state_idx on public.room_players(room_id,state);
create index if not exists room_cart_items_player_idx on public.room_cart_items(player_id,collected_at);

create or replace function private.is_room_member(target_room uuid)
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.room_players
    where room_id = target_room
      and user_id = (select auth.uid())
      and state <> 'left'
  );
$$;
revoke all on function private.is_room_member(uuid) from public;

-- Called only by the Edge Function through its service role. A heartbeat marks
-- stale players as left, promotes a remaining player to host, and resolves a
-- match once no active shopper remains.
create or replace function public.reconcile_room(p_room uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare next_host uuid;
begin
  update public.room_players
     set state='left', ready=false
   where room_id=p_room
     and state in ('joined','ready','active')
     and last_seen < now() - interval '45 seconds';

  select user_id into next_host
  from public.room_players
  where room_id=p_room and state <> 'left'
  order by joined_at
  limit 1;

  update public.rooms
     set host_user_id=next_host, updated_at=now()
   where id=p_room and status in ('lobby','playing') and next_host is not null
     and host_user_id not in (select user_id from public.room_players where room_id=p_room and state <> 'left');

  update public.rooms
     set status='results', finished_at=coalesce(finished_at,now()), updated_at=now()
   where id=p_room and status='playing'
     and not exists (select 1 from public.room_players where room_id=p_room and state in ('joined','ready','active'));

  update public.rooms
     set status='closed', finished_at=coalesce(finished_at,now()), updated_at=now()
   where id=p_room and status='lobby' and next_host is null;
end;
$$;
revoke all on function public.reconcile_room(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_room(uuid) to service_role;

-- Atomic pickup: locks the inventory row, checks the authoritative score
-- against the room budget, decreases stock, then records the cart item.
create or replace function public.take_room_product(p_room uuid,p_user uuid,p_product text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare player_row public.room_players%rowtype;
declare item_row public.room_inventory%rowtype;
declare budget numeric(10,2);
begin
  perform public.reconcile_room(p_room);
  select * into player_row from public.room_players
    where room_id=p_room and user_id=p_user for update;
  if not found or player_row.state <> 'active' then raise exception 'Player is not shopping in this room'; end if;
  select budget_base into budget from public.rooms where id=p_room and status='playing';
  if budget is null then raise exception 'This match is not active'; end if;
  select * into item_row from public.room_inventory
    where room_id=p_room and product_id=p_product for update;
  if not found or item_row.stock <= 0 then raise exception 'This product is sold out'; end if;
  if player_row.score_base + item_row.price_base > budget then raise exception 'Not enough budget for this product'; end if;
  update public.room_inventory set stock=stock-1 where room_id=p_room and product_id=p_product;
  update public.room_players
     set score_base=score_base+item_row.price_base, cart_count=cart_count+1, last_seen=now()
   where id=player_row.id;
  insert into public.room_cart_items(room_id,player_id,product_id,price_base)
  values(p_room,player_row.id,p_product,item_row.price_base);
  return jsonb_build_object('product_id',p_product,'price_base',item_row.price_base);
end;
$$;
revoke all on function public.take_room_product(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.take_room_product(uuid,uuid,text) to service_role;

create or replace function public.finish_room_player(p_room uuid,p_user uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.reconcile_room(p_room);
  update public.room_players
     set state='finished', ready=false, last_seen=now()
   where room_id=p_room and user_id=p_user and state='active';
  if not found then raise exception 'Player is not active in this room'; end if;
  perform public.reconcile_room(p_room);
end;
$$;
revoke all on function public.finish_room_player(uuid,uuid) from public, anon, authenticated;
grant execute on function public.finish_room_player(uuid,uuid) to service_role;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_inventory enable row level security;
alter table public.room_cart_items enable row level security;

create policy "room members read room" on public.rooms for select to authenticated using (private.is_room_member(id));
create policy "room members read players" on public.room_players for select to authenticated using (private.is_room_member(room_id));
create policy "room members read stock" on public.room_inventory for select to authenticated using (private.is_room_member(room_id));
create policy "room members read carts" on public.room_cart_items for select to authenticated using (private.is_room_member(room_id));

grant select on public.rooms,public.room_players,public.room_inventory,public.room_cart_items to authenticated;
grant all on public.rooms,public.room_players,public.room_inventory,public.room_cart_items to service_role;

alter table public.rooms replica identity full;
alter table public.room_players replica identity full;
alter table public.room_inventory replica identity full;
alter publication supabase_realtime add table public.rooms,public.room_players,public.room_inventory;
