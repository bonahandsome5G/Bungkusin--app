-- =====================================================================
-- Bungkus! — skema database Supabase
-- Jalankan seluruh file ini di Supabase Dashboard → SQL Editor → Run.
-- Aman dijalankan ulang (idempotent) selama belum ada perubahan manual.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PROFILES — satu baris per akun (pembeli atau mitra)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'buyer' check (role in ('buyer', 'partner')),
  phone       text,
  created_at  timestamptz not null default now()
);

-- Buat profil otomatis saat user mendaftar (pakai metadata dari signUp)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'partner' then 'partner' else 'buyer' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. STORES — toko / restoran mitra
-- owner_id boleh null hanya untuk data contoh (seed.sql)
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references public.profiles(id) on delete cascade,
  name          text not null,
  category      text not null default 'restoran'
                check (category in ('restoran', 'kafe', 'bakery', 'umkm')),
  description   text,
  address       text not null default '',
  lat           double precision not null,
  lng           double precision not null,
  phone         text,
  closing_time  time,
  rating_avg    numeric(2,1) not null default 0,
  rating_count  int not null default 0,
  created_at    timestamptz not null default now()
);
create unique index if not exists stores_one_per_owner on public.stores(owner_id) where owner_id is not null;

-- ---------------------------------------------------------------------
-- 3. LISTINGS — stok surplus yang diunggah mitra
-- ---------------------------------------------------------------------
create table if not exists public.listings (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  title              text not null,
  description        text,
  category           text not null default 'makanan-berat'
                     check (category in ('makanan-berat', 'roti-kue', 'minuman', 'camilan', 'sayur-buah')),
  original_price     int not null check (original_price > 0),
  price              int not null check (price > 0),
  qty_total          int not null check (qty_total > 0),
  qty_available      int not null check (qty_available >= 0),
  pickup_start       timestamptz not null,
  pickup_end         timestamptz not null,
  photo_url          text,
  allergens          text,
  made_at            timestamptz,
  quality_checked    boolean not null default false,
  delivery_available boolean not null default false,
  status             text not null default 'active' check (status in ('active', 'closed')),
  created_at         timestamptz not null default now(),
  constraint price_is_discounted check (price < original_price),
  constraint pickup_window_valid check (pickup_end > pickup_start),
  constraint qty_not_over_total check (qty_available <= qty_total)
);
create index if not exists listings_active_idx on public.listings(status, pickup_end);
create index if not exists listings_store_idx on public.listings(store_id);

-- ---------------------------------------------------------------------
-- 4. ORDERS — dibuat hanya lewat fungsi place_order()
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  listing_id          uuid not null references public.listings(id) on delete restrict,
  store_id            uuid not null references public.stores(id) on delete cascade,
  buyer_id            uuid not null references public.profiles(id) on delete cascade,
  qty                 int not null check (qty between 1 and 5),
  unit_price          int not null,
  original_unit_price int not null,
  delivery_fee        int not null default 0,
  total               int not null,
  fulfillment         text not null default 'pickup' check (fulfillment in ('pickup', 'delivery')),
  delivery_address    text,
  payment_method      text not null,
  status              text not null default 'paid' check (status in ('paid', 'completed', 'cancelled')),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_store_idx on public.orders(store_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. REVIEWS — satu ulasan per pesanan yang sudah diambil
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  buyer_name  text not null default '',
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. FAVORITES — toko favorit pembeli (untuk notifikasi)
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (buyer_id, store_id)
);

-- ---------------------------------------------------------------------
-- 7. SCHEDULES — jadwal stok rutin menjelang tutup
-- days: 0 = Minggu … 6 = Sabtu (zona Asia/Jakarta)
-- ---------------------------------------------------------------------
create table if not exists public.schedules (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  title             text not null,
  description       text,
  category          text not null default 'makanan-berat',
  original_price    int not null check (original_price > 0),
  price             int not null check (price > 0),
  qty               int not null check (qty > 0),
  days              int[] not null default '{0,1,2,3,4,5,6}',
  pickup_start      time not null,
  pickup_end        time not null,
  active            boolean not null default true,
  last_published_on date,
  created_at        timestamptz not null default now(),
  constraint schedule_price_is_discounted check (price < original_price),
  constraint schedule_window_valid check (pickup_end > pickup_start)
);

-- =====================================================================
-- FUNGSI (RPC)
-- =====================================================================

-- Pemesanan atomik: kunci baris stok, kurangi, buat kode unik BGS-XXXX
create or replace function public.place_order(
  p_listing_id uuid,
  p_qty int,
  p_fulfillment text default 'pickup',
  p_payment_method text default 'QRIS',
  p_delivery_address text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_listing public.listings;
  v_order   public.orders;
  v_code    text;
  v_fee     int := 0;
begin
  if auth.uid() is null then
    raise exception 'Masuk dulu untuk memesan';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 5 then
    raise exception 'Jumlah porsi harus 1 sampai 5';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Stok tidak ditemukan';
  end if;
  if v_listing.status <> 'active' or v_listing.pickup_end <= now() then
    raise exception 'Stok ini sudah ditutup';
  end if;
  if v_listing.qty_available < p_qty then
    raise exception 'Sisa porsi tinggal %', v_listing.qty_available;
  end if;

  if p_fulfillment = 'delivery' then
    if not v_listing.delivery_available then
      raise exception 'Toko ini belum melayani antar kurir';
    end if;
    if coalesce(trim(p_delivery_address), '') = '' then
      raise exception 'Isi alamat pengantaran';
    end if;
    v_fee := 10000;
  elsif p_fulfillment <> 'pickup' then
    raise exception 'Metode pengambilan tidak dikenal';
  end if;

  -- kode pendek BGS-1234; kalau sudah padat, pakai 6 digit
  for i in 1..30 loop
    v_code := 'BGS-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.orders where code = v_code);
    v_code := null;
  end loop;
  while v_code is null or exists (select 1 from public.orders where code = v_code) loop
    v_code := 'BGS-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
  end loop;

  update public.listings
     set qty_available = qty_available - p_qty
   where id = p_listing_id;

  insert into public.orders (
    code, listing_id, store_id, buyer_id, qty, unit_price, original_unit_price,
    delivery_fee, total, fulfillment, delivery_address, payment_method
  ) values (
    v_code, v_listing.id, v_listing.store_id, auth.uid(), p_qty, v_listing.price,
    v_listing.original_price, v_fee, v_listing.price * p_qty + v_fee, p_fulfillment,
    case when p_fulfillment = 'delivery' then p_delivery_address end, p_payment_method
  ) returning * into v_order;

  return v_order;
end $$;

-- Pembeli membatalkan pesanan yang belum diambil → stok dikembalikan
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
   where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then
    raise exception 'Pesanan tidak ditemukan';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'Pesanan ini tidak bisa dibatalkan';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  update public.listings set qty_available = qty_available + v_order.qty where id = v_order.listing_id;
  return v_order;
end $$;

-- Mitra memverifikasi kode di kasir → pesanan selesai
create or replace function public.complete_order(p_code text)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
begin
  select o.* into v_order
    from public.orders o
    join public.stores s on s.id = o.store_id
   where upper(o.code) = upper(trim(p_code))
     and s.owner_id = auth.uid()
   order by o.created_at desc
   limit 1
   for update of o;
  if not found then
    raise exception 'Kode % tidak ditemukan di toko ini', upper(trim(p_code));
  end if;
  if v_order.status = 'completed' then
    raise exception 'Kode % sudah dipakai', v_order.code;
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Pesanan % sudah dibatalkan pembeli', v_order.code;
  end if;

  update public.orders
     set status = 'completed', completed_at = now()
   where id = v_order.id
  returning * into v_order;
  return v_order;
end $$;

-- Terbitkan jadwal rutin untuk hari ini (zona Asia/Jakarta).
-- p_store_id null = semua toko (dipakai pg_cron); selain itu hanya toko milik pemanggil.
create or replace function public.publish_schedules(p_store_id uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_dow   int  := extract(dow from (now() at time zone 'Asia/Jakarta'))::int;
  v_count int  := 0;
  r       record;
begin
  if p_store_id is not null and not exists (
    select 1 from public.stores where id = p_store_id and owner_id = auth.uid()
  ) then
    raise exception 'Bukan toko kamu';
  end if;
  if p_store_id is null and auth.uid() is not null then
    raise exception 'Pilih toko yang akan diterbitkan';
  end if;

  for r in
    select * from public.schedules
     where active
       and (p_store_id is null or store_id = p_store_id)
       and v_dow = any(days)
       and (last_published_on is null or last_published_on < v_today)
  loop
    -- lewati jadwal yang jam ambilnya sudah lewat hari ini
    continue when ((v_today + r.pickup_end) at time zone 'Asia/Jakarta') <= now();

    insert into public.listings (
      store_id, title, description, category, original_price, price,
      qty_total, qty_available, pickup_start, pickup_end, made_at, quality_checked
    ) values (
      r.store_id, r.title, r.description, r.category, r.original_price, r.price,
      r.qty, r.qty,
      (v_today + r.pickup_start) at time zone 'Asia/Jakarta',
      (v_today + r.pickup_end) at time zone 'Asia/Jakarta',
      now(), true
    );
    update public.schedules set last_published_on = v_today where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Perbarui rating toko setiap ada ulasan baru
create or replace function public.refresh_store_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.stores s
     set rating_avg   = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where store_id = s.id), 0),
         rating_count = (select count(*) from public.reviews where store_id = s.id)
   where s.id = coalesce(new.store_id, old.store_id);
  return null;
end $$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_store_rating();

-- Isi store_id & nama pembeli pada ulasan dari pesanan (tidak bisa dipalsukan klien)
create or replace function public.fill_review_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select o.store_id into new.store_id from public.orders o where o.id = new.order_id;
  select coalesce(nullif(p.full_name, ''), 'Pembeli') into new.buyer_name
    from public.profiles p where p.id = new.buyer_id;
  return new;
end $$;

drop trigger if exists reviews_fill_fields on public.reviews;
create trigger reviews_fill_fields
  before insert on public.reviews
  for each row execute function public.fill_review_fields();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles  enable row level security;
alter table public.stores    enable row level security;
alter table public.listings  enable row level security;
alter table public.orders    enable row level security;
alter table public.reviews   enable row level security;
alter table public.favorites enable row level security;
alter table public.schedules enable row level security;

-- helper: apakah user pemilik toko ini?
create or replace function public.owns_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores where id = p_store_id and owner_id = auth.uid());
$$;

-- profiles
drop policy if exists "profil sendiri" on public.profiles;
create policy "profil sendiri" on public.profiles
  for select using (
    id = auth.uid()
    or exists (select 1 from public.orders o where o.buyer_id = profiles.id and public.owns_store(o.store_id))
  );
drop policy if exists "ubah profil sendiri" on public.profiles;
create policy "ubah profil sendiri" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- stores
drop policy if exists "toko publik" on public.stores;
create policy "toko publik" on public.stores for select using (true);
drop policy if exists "mitra buat toko" on public.stores;
create policy "mitra buat toko" on public.stores for insert with check (
  owner_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
);
drop policy if exists "mitra ubah toko" on public.stores;
create policy "mitra ubah toko" on public.stores for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- listings
drop policy if exists "stok publik" on public.listings;
create policy "stok publik" on public.listings for select using (true);
drop policy if exists "mitra kelola stok" on public.listings;
create policy "mitra kelola stok" on public.listings for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- orders (insert/update hanya lewat fungsi security definer)
drop policy if exists "lihat pesanan" on public.orders;
create policy "lihat pesanan" on public.orders for select
  using (buyer_id = auth.uid() or public.owns_store(store_id));

-- reviews
drop policy if exists "ulasan publik" on public.reviews;
create policy "ulasan publik" on public.reviews for select using (true);
drop policy if exists "tulis ulasan" on public.reviews;
create policy "tulis ulasan" on public.reviews for insert with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from public.orders o
     where o.id = order_id and o.buyer_id = auth.uid() and o.status = 'completed'
  )
);

-- favorites
drop policy if exists "favorit sendiri" on public.favorites;
create policy "favorit sendiri" on public.favorites for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- schedules
drop policy if exists "mitra kelola jadwal" on public.schedules;
create policy "mitra kelola jadwal" on public.schedules for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

revoke execute on function public.place_order(uuid, int, text, text, text) from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.complete_order(text) from public, anon;
revoke execute on function public.publish_schedules(uuid) from public, anon;
grant execute on function public.place_order(uuid, int, text, text, text) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.complete_order(text) to authenticated;
grant execute on function public.publish_schedules(uuid) to authenticated;

-- =====================================================================
-- STORAGE — foto makanan (bucket publik, upload ke folder <user_id>/)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "foto publik" on storage.objects;
create policy "foto publik" on storage.objects for select
  using (bucket_id = 'listing-photos');
drop policy if exists "mitra unggah foto" on storage.objects;
create policy "mitra unggah foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- REALTIME — notifikasi stok baru & status pesanan
-- =====================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.listings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- OPSIONAL — terbitkan jadwal otomatis setiap 15 menit dengan pg_cron
-- Aktifkan dulu: Database → Extensions → pg_cron, lalu jalankan:
--
--   select cron.schedule('bungkus-publish-schedules', '*/15 * * * *',
--                        $$ select public.publish_schedules(null) $$);
-- =====================================================================
