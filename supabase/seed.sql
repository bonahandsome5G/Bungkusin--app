-- =====================================================================
-- Bungkus! — data contoh (opsional)
-- Jalankan SETELAH schema.sql. Membuat 6 toko contoh di sekitar
-- Kampus BINUS Anggrek (Kemanggisan) dengan stok yang aktif mulai sekarang.
-- Toko contoh tidak punya pemilik (owner_id null), jadi hanya untuk dilihat
-- dan dipesan pembeli. Untuk mencoba sisi mitra, daftar akun Mitra di aplikasi.
-- =====================================================================

with s as (
  insert into public.stores (name, category, description, address, lat, lng, closing_time, rating_avg, rating_count)
  values
    ('Roti Senja Kemanggisan', 'bakery', 'Roti dan pastry dipanggang tiap pagi.', 'Jl. Kemanggisan Raya No. 12', -6.1987, 106.7841, '21:00', 4.7, 38),
    ('Warung Bu Tini',         'umkm',   'Nasi rames dan lauk rumahan.',            'Jl. Rawa Belong No. 45',      -6.2049, 106.7862, '20:30', 4.6, 52),
    ('Kopi Rindang',           'kafe',   'Kopi susu, sandwich, dan kue.',            'Jl. Anggrek Cakra No. 3',     -6.2021, 106.7795, '22:00', 4.5, 21),
    ('Ayam Bakar Mas Yon',     'restoran','Ayam bakar madu dan sambal korek.',       'Jl. Palmerah Barat No. 88',   -6.2078, 106.7910, '21:30', 4.8, 67),
    ('Es Teh Segar Pak Ujang', 'umkm',   'Es teh, es jeruk, dan gorengan.',          'Jl. Syahdan No. 7',           -6.2003, 106.7856, '21:00', 4.4, 15),
    ('Dapur Hijau Salad Bar',  'restoran','Salad, buah potong, dan jus.',            'Jl. Kebon Jeruk Raya No. 21', -6.1952, 106.7760, '20:00', 4.6, 29)
  returning id, name
)
insert into public.listings (store_id, title, description, category, original_price, price,
                             qty_total, qty_available, pickup_start, pickup_end, allergens,
                             made_at, quality_checked, delivery_available)
select s.id, l.title, l.description, l.category, l.original_price, l.price, l.qty, l.left_qty,
       now() + (l.start_min || ' minutes')::interval,
       now() + (l.end_min   || ' minutes')::interval,
       l.allergens, now() - interval '5 hours', true, l.delivery
from s
join (values
  ('Roti Senja Kemanggisan', 'Paket roti manis isi 4',   'Campur: cokelat, keju, srikaya, pisang.', 'roti-kue',      40000, 14000, 8, 5, 0,  150, 'Gluten, susu, telur', true),
  ('Roti Senja Kemanggisan', 'Croissant butter',         'Dipanggang pagi ini, masih renyah.',       'roti-kue',      22000,  8000, 6, 6, 30, 180, 'Gluten, susu',        false),
  ('Warung Bu Tini',         'Nasi ayam bakar + sayur',  'Nasi, ayam bakar, sayur asem, sambal.',    'makanan-berat', 30000,  9000, 6, 4, 0,  90,  null,                  true),
  ('Warung Bu Tini',         'Paket lauk rumahan',       'Tempe orek, perkedel, telur balado.',      'makanan-berat', 25000,  9000, 5, 5, 0,  90,  'Telur',               false),
  ('Kopi Rindang',           'Sandwich tuna',            'Roti gandum, tuna mayo, selada.',          'makanan-berat', 35000, 12000, 4, 3, 0,  200, 'Gluten, ikan, telur', true),
  ('Kopi Rindang',           'Slice cheesecake',         'Cheesecake panggang, potongan besar.',     'roti-kue',      32000, 11000, 3, 2, 15, 200, 'Susu, telur, gluten', false),
  ('Ayam Bakar Mas Yon',     'Ayam bakar madu + nasi',   'Paha atas, nasi, lalapan, sambal korek.',  'makanan-berat', 38000, 13000, 10, 7, 45, 165, null,                 true),
  ('Es Teh Segar Pak Ujang', 'Es teh jumbo 2 gelas',     'Teh melati, gula aren terpisah.',          'minuman',       16000,  6000, 12, 9, 0, 150, null,                  false),
  ('Es Teh Segar Pak Ujang', 'Gorengan campur 6 pcs',    'Bakwan, tahu isi, tempe mendoan.',         'camilan',       15000,  5000, 8, 8, 0,  150, 'Gluten',              false),
  ('Dapur Hijau Salad Bar',  'Buah potong 400 g',        'Melon, semangka, pepaya, nanas.',          'sayur-buah',    28000,  9000, 5, 4, 0,  60,  null,                  true)
) as l(store_name, title, description, category, original_price, price, qty, left_qty, start_min, end_min, allergens, delivery)
  on l.store_name = s.name;
