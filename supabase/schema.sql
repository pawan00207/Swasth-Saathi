-- Legacy Supabase relational schema. The application now uses Prisma Postgres
-- for relational data. Do not apply this file to new installations; use
-- prisma/migrations and supabase/storage.sql instead.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'patient' check (role in ('patient', 'doctor', 'hospital_admin')),
  emergency_contact text,
  created_at timestamptz not null default now()
);

alter table public.appointments add column if not exists room_name text;
alter table public.appointments add column if not exists patient_name text not null default '';
alter table public.appointments add column if not exists updated_at timestamptz not null default now();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.schemes (
  id text primary key,
  name text not null,
  category text not null default 'health',
  state text not null default 'All India',
  min_age integer,
  max_age integer,
  income_limit numeric,
  disability_required text[] not null default '{}',
  benefits text not null default '',
  documents text[] not null default '{}',
  apply_url text,
  source_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_schemes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scheme_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, scheme_id)
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  speciality text not null,
  languages text[] not null default '{}',
  fee numeric not null default 0,
  registration_number text,
  availability_slots jsonb not null default '[]'::jsonb,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text,
  address text,
  latitude double precision,
  longitude double precision,
  speciality text[] not null default '{}',
  emergency boolean not null default false,
  wheelchair_accessible boolean,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hospitals_name_city_unique' and conrelid = 'public.hospitals'::regclass) then
    alter table public.hospitals add constraint hospitals_name_city_unique unique (name, city);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'doctors_name_speciality_unique' and conrelid = 'public.doctors'::regclass) then
    alter table public.doctors add constraint doctors_name_speciality_unique unique (name, speciality);
  end if;
end;
$$;

alter table public.profiles
  add column if not exists hospital_id uuid references public.hospitals(id) on delete set null;

create table if not exists public.bed_inventory (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  bed_type text not null check (bed_type in ('ICU', 'Oxygen', 'General', 'Ventilator')),
  total integer not null default 0 check (total >= 0),
  available integer not null default 0 check (available >= 0 and available <= total),
  updated_at timestamptz not null default now(),
  unique (hospital_id, bed_type)
);

create table if not exists public.bed_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  bed_type text not null check (bed_type in ('ICU', 'Oxygen', 'General', 'Ventilator')),
  patient_name text not null,
  patient_phone text not null,
  urgency text not null check (urgency in ('routine', 'urgent', 'emergency')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  patient_name text not null default '',
  doctor_id uuid references public.doctors(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  starts_at timestamptz not null,
  mode text not null default 'video' check (mode in ('video', 'audio', 'chat', 'in_person')),
  status text not null default 'booked' check (status in ('booked', 'confirmed', 'completed', 'cancelled')),
  room_token_hash text,
  room_name text,
  updated_at timestamptz not null default now(),
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  patient_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid references public.hospitals(id) on delete set null,
  subtotal numeric not null default 0 check (subtotal >= 0),
  tax numeric not null default 0 check (tax >= 0),
  discount numeric not null default 0 check (discount >= 0),
  total numeric not null default 0 check (total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bills add column if not exists razorpay_order_id text unique;
alter table public.bills add column if not exists razorpay_payment_id text;

create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.bill_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_name text not null,
  report_type text not null,
  report_date date not null default current_date,
  doctor_name text,
  notes text,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_share_tokens (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  pin_salt text,
  pin_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.report_share_tokens add column if not exists pin_salt text;
alter table public.report_share_tokens add column if not exists pin_hash text;

create table if not exists public.report_views (
  id bigint generated always as identity primary key,
  share_token_id uuid not null references public.report_share_tokens(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  viewer_fingerprint text
);

create table if not exists public.report_share_rate_limits (
  share_token_id uuid not null references public.report_share_tokens(id) on delete cascade,
  minute_bucket timestamptz not null,
  request_count integer not null default 0,
  primary key (share_token_id, minute_bucket)
);

create or replace function public.consume_report_share_view(p_share_token_id uuid, p_limit integer default 30)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  current_bucket timestamptz := date_trunc('minute', now());
  resulting_count integer;
begin
  insert into public.report_share_rate_limits (share_token_id, minute_bucket, request_count)
  values (p_share_token_id, current_bucket, 1)
  on conflict (share_token_id, minute_bucket)
  do update set request_count = report_share_rate_limits.request_count + 1
  returning request_count into resulting_count;
  return resulting_count <= p_limit;
end;
$$;

create or replace function public.record_report_share_view(
  p_share_token_id uuid,
  p_fingerprint text,
  p_limit integer default 30
)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.report_share_tokens
  set view_count = view_count + 1
  where id = p_share_token_id and revoked_at is null
    and (expires_at is null or expires_at > now());
  if not found then return false; end if;
  insert into public.report_views (share_token_id, viewer_fingerprint)
  values (p_share_token_id, p_fingerprint);
  return true;
end;
$$;

create or replace function public.update_hospital_bed_inventory(
  p_hospital_id uuid,
  p_admin_user_id uuid,
  p_counts jsonb
)
returns setof public.bed_inventory language plpgsql security definer set search_path = public
as $$
declare
  item record;
  count_value integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_user_id and role = 'hospital_admin' and hospital_id = p_hospital_id
  ) then
    raise exception 'Hospital administrator access required';
  end if;
  for item in select key, value from jsonb_each_text(p_counts)
  loop
    if item.key not in ('ICU','Oxygen','General','Ventilator') then
      raise exception 'Unsupported bed type';
    end if;
    count_value := item.value::integer;
    if count_value < 0 then raise exception 'Available count cannot be negative'; end if;
    update public.bed_inventory
    set available = count_value, updated_at = now()
    where hospital_id = p_hospital_id and bed_type = item.key and count_value <= total;
    if not found then raise exception 'Bed inventory missing or count exceeds total'; end if;
  end loop;
  return query select * from public.bed_inventory where hospital_id = p_hospital_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.schemes enable row level security;
alter table public.saved_schemes enable row level security;
alter table public.doctors enable row level security;
alter table public.hospitals enable row level security;
alter table public.bed_inventory enable row level security;
alter table public.bed_requests enable row level security;
alter table public.appointments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.bill_verification_tokens enable row level security;
alter table public.reports enable row level security;
alter table public.report_share_tokens enable row level security;
alter table public.report_views enable row level security;
alter table public.report_share_rate_limits enable row level security;

drop policy if exists "profiles read self" on public.profiles;
create policy "profiles read self" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, emergency_contact) on public.profiles to authenticated;

drop policy if exists "schemes readable" on public.schemes;
create policy "schemes readable" on public.schemes for select using (true);

drop policy if exists "saved schemes owned" on public.saved_schemes;
create policy "saved schemes owned" on public.saved_schemes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "doctors directory readable" on public.doctors;
create policy "doctors directory readable" on public.doctors for select using (true);
drop policy if exists "doctor updates own profile" on public.doctors;
create policy "doctor updates own profile" on public.doctors for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.doctors from authenticated;

drop policy if exists "hospitals readable" on public.hospitals;
create policy "hospitals readable" on public.hospitals for select using (true);
drop policy if exists "bed inventory readable" on public.bed_inventory;
create policy "bed inventory readable" on public.bed_inventory for select using (true);
drop policy if exists "admins update bed inventory" on public.bed_inventory;
create policy "admins update bed inventory" on public.bed_inventory for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hospital_admin' and p.hospital_id = bed_inventory.hospital_id)
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hospital_admin' and p.hospital_id = bed_inventory.hospital_id)
);

drop policy if exists "bed requests owned or admin" on public.bed_requests;
create policy "bed requests owned or admin" on public.bed_requests for select using (
  user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hospital_admin' and p.hospital_id = bed_requests.hospital_id)
);
drop policy if exists "users create own bed requests" on public.bed_requests;
create policy "users create own bed requests" on public.bed_requests for insert with check (user_id = auth.uid());
drop policy if exists "admins update bed requests" on public.bed_requests;
create policy "admins update bed requests" on public.bed_requests for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hospital_admin' and p.hospital_id = bed_requests.hospital_id)
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hospital_admin' and p.hospital_id = bed_requests.hospital_id)
);

drop policy if exists "appointments visible to participants" on public.appointments;
create policy "appointments visible to participants" on public.appointments for select using (
  patient_id = auth.uid() or exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid())
);
drop policy if exists "patients create appointments" on public.appointments;
create policy "patients create appointments" on public.appointments for insert with check (patient_id = auth.uid() and status = 'booked');
drop policy if exists "participants update appointments" on public.appointments;
revoke update on public.appointments from authenticated;

drop policy if exists "bills owned" on public.bills;
create policy "bills owned" on public.bills for select using (patient_id = auth.uid());
drop policy if exists "bill items owned" on public.bill_items;
create policy "bill items owned" on public.bill_items for select using (
  exists (select 1 from public.bills b where b.id = bill_id and b.patient_id = auth.uid())
);
drop policy if exists "bill verification tokens owned" on public.bill_verification_tokens;
create policy "bill verification tokens owned" on public.bill_verification_tokens for select using (owner_id = auth.uid());

drop policy if exists "reports owned" on public.reports;
create policy "reports owned" on public.reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "share tokens owned" on public.report_share_tokens;
create policy "share tokens owned" on public.report_share_tokens for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "report views owned" on public.report_views;
create policy "report views owned" on public.report_views for select using (
  exists (select 1 from public.report_share_tokens t where t.id = share_token_id and t.owner_id = auth.uid())
);

grant execute on function public.record_report_share_view(uuid, text, integer) to service_role;
grant execute on function public.consume_report_share_view(uuid, integer) to service_role;
grant execute on function public.update_hospital_bed_inventory(uuid, uuid, jsonb) to service_role;
revoke all on function public.consume_report_share_view(uuid, integer) from public, anon, authenticated;
revoke all on function public.record_report_share_view(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.update_hospital_bed_inventory(uuid, uuid, jsonb) from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-reports', 'medical-reports', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "report files owned by user" on storage.objects;
create policy "report files owned by user" on storage.objects for all to authenticated
using (bucket_id = 'medical-reports' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'medical-reports' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bed_inventory') then
    alter publication supabase_realtime add table public.bed_inventory;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bed_requests') then
    alter publication supabase_realtime add table public.bed_requests;
  end if;
end;
$$;
