-- Veritabanı şeması — yalnızca referans/dokümantasyon amaçlıdır.
-- Supabase bu dosyayı otomatik uygulamaz; değişiklikler Supabase SQL editöründen yapılmalıdır.
-- Tablo sırası foreign key bağımlılıklarına göre düzenlenmiştir.
--
-- KURULUM SIRASI:
--   1. functions.sql        — trigger fonksiyonları (bu dosyadaki trigger'lar buna bağımlı)
--   2. schema.sql           — bu dosya
--   3. get_league_board.sql — Lig sekmesi RPC
--   4. get_deneme_board.sql — Kristal sekmesi RPC

-- ── MATCHES ──────────────────────────────────────────────────────
create table public.matches (
  id            serial not null,
  external_id   text null,
  home_team     text not null,
  away_team     text not null,
  match_date    date null,
  match_datetime timestamp with time zone null,
  round         text not null default 'Grup Aşaması'::text,
  locked         boolean not null default false,
  score_override boolean not null default false,
  actual_home    integer null,
  actual_away    integer null,
  created_at    timestamp with time zone null default now(),
  constraint matches_pkey primary key (id),
  constraint matches_external_id_key unique (external_id)
) TABLESPACE pg_default;

create index if not exists idx_matches_match_datetime
  on public.matches using btree (match_datetime) TABLESPACE pg_default;

-- ── PROFILES ─────────────────────────────────────────────────────
create table public.profiles (
  id             uuid not null,
  username       text not null,
  created_at     timestamp with time zone null default now(),
  invite_code    text null,
  recovery_email text null,
  is_admin       boolean not null default false,
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint unique_username unique (username),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
) TABLESPACE pg_default;

-- ── ALLOWED_GROUPS ───────────────────────────────────────────────
create table public.allowed_groups (
  code       text not null,
  created_at timestamp with time zone null default now(),
  constraint allowed_groups_pkey primary key (code)
) TABLESPACE pg_default;

-- ── PREDICTIONS ──────────────────────────────────────────────────
create table public.predictions (
  id        serial not null,
  user_id   uuid not null,
  match_id  integer not null,
  pred_home integer not null,
  pred_away integer not null,
  is_joker  boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint predictions_pkey primary key (id),
  constraint predictions_user_id_match_id_key unique (user_id, match_id),
  constraint predictions_match_id_fkey foreign key (match_id) references matches (id) on delete cascade,
  constraint predictions_user_id_fkey foreign key (user_id) references profiles (id) on delete cascade
) TABLESPACE pg_default;

create index if not exists idx_predictions_user_id
  on public.predictions using btree (user_id) TABLESPACE pg_default;

create index if not exists idx_predictions_match_id
  on public.predictions using btree (match_id) TABLESPACE pg_default;

create unique index if not exists idx_predictions_user_match
  on public.predictions using btree (user_id, match_id) TABLESPACE pg_default;

create trigger predictions_updated_at
  before update on predictions
  for each row execute function update_updated_at();

create trigger trg_enforce_prediction_rules
  before insert or update on predictions
  for each row execute function enforce_prediction_rules();

-- ── USER_GROUPS ──────────────────────────────────────────────────
create table public.user_groups (
  user_id     uuid not null,
  invite_code text not null,
  joined_at   timestamp with time zone null default now(),
  constraint user_groups_pkey primary key (user_id, invite_code),
  constraint user_groups_user_id_fkey foreign key (user_id) references profiles (id) on delete cascade
) TABLESPACE pg_default;

create index if not exists idx_user_groups_invite_code
  on public.user_groups using btree (invite_code) TABLESPACE pg_default;

create index if not exists idx_user_groups_user_id
  on public.user_groups using btree (user_id) TABLESPACE pg_default;
