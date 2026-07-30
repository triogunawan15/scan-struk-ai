-- Jalankan file ini di Supabase Dashboard > SQL Editor > New query > Run

-- Profil user, 1 baris per akun, dibuat otomatis saat sign up
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  plan text not null default 'free', -- 'free' atau 'paid'
  scan_count int not null default 0, -- jumlah scan di periode berjalan
  period_start date not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

-- Riwayat struk yang sudah discan
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  store_name text,
  transaction_date date,
  total numeric,
  category text,
  items jsonb,
  raw_ai_response jsonb,
  created_at timestamptz not null default now()
);

-- Bikin profile otomatis tiap ada user baru daftar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: user cuma boleh baca/tulis datanya sendiri
alter table public.profiles enable row level security;
alter table public.receipts enable row level security;

create policy "profiles: user lihat data sendiri"
  on public.profiles for select using (auth.uid() = id);

create policy "receipts: user lihat data sendiri"
  on public.receipts for select using (auth.uid() = user_id);

-- Catatan: insert/update ke profiles & receipts dari sisi app HANYA lewat
-- API route server (pakai Service Role Key), jadi tidak perlu policy insert
-- untuk role 'authenticated' di sini -- ini mencegah user mengubah scan_count-nya sendiri.
