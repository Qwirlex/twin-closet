-- Twin Closet: аккаунты и данные человека. Каждый видит и меняет только своё (RLS: owner = auth.uid()).
-- Фото тела и вещей — в закрытом хранилище: путь начинается с id владельца, чужие файлы недоступны.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  country text not null default 'IE',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  created_at timestamptz not null default now()
);

create table public.garments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('closet', 'screenshot', 'store_scan', 'link')),
  kind text not null check (kind in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  title text not null,
  color text not null,
  material text,
  fit text,
  pattern text,
  season text not null default 'all' check (season in ('all', 'summer', 'winter', 'spring_autumn')),
  -- пути в хранилище photos: <owner>/garments/<id>.png
  cutout_path text not null,
  frame_path text,
  shop jsonb,
  created_at timestamptz not null default now()
);
create index garments_owner on public.garments (owner, created_at desc);

create table public.body_photos (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  angle text not null check (angle in ('front', 'three_quarter', 'side', 'back')),
  photo_path text not null,
  masks jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (owner, angle)
);

create table public.looks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  note text not null default '',
  garment_ids uuid[] not null default '{}',
  -- ракурс → путь рендера в хранилище
  renders jsonb not null default '{}',
  saved boolean not null default false,
  created_at timestamptz not null default now()
);
create index looks_owner on public.looks (owner, created_at desc);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  store_id text,
  ref text,
  url text,
  image_path text,
  price numeric(10, 2),
  currency text,
  target_price numeric(10, 2) check (target_price is null or target_price > 0),
  added_at timestamptz not null default now()
);
create index wishlist_owner on public.wishlist (owner, added_at desc);

create table public.favorite_stores (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_id text not null,
  primary key (owner, store_id)
);

-- RLS: только своё, на всех таблицах
alter table public.profiles enable row level security;
alter table public.garments enable row level security;
alter table public.body_photos enable row level security;
alter table public.looks enable row level security;
alter table public.wishlist enable row level security;
alter table public.favorite_stores enable row level security;

create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own garments" on public.garments for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own body photos" on public.body_photos for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own looks" on public.looks for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own wishlist" on public.wishlist for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own stores" on public.favorite_stores for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- профиль создаётся сам при регистрации
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- закрытое хранилище фото: <owner>/… — только владелец
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;

create policy "own photos read" on storage.objects for select to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos write" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos update" on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
