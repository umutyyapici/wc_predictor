-- Tüm PostgreSQL fonksiyonları — yalnızca referans/dokümantasyon amaçlıdır.
-- Supabase bu dosyayı otomatik uygulamaz; Supabase SQL editöründen çalıştırılmalıdır.
-- schema.sql'deki trigger'lar bu fonksiyonlara bağımlıdır — önce bu dosyayı çalıştır.
--
-- Dosyadaki fonksiyonlar:
--   update_updated_at()          — trigger: predictions.updated_at otomatik güncelleme
--   enforce_prediction_rules()   — trigger: bahis kilidi, joker kuralı, maç kilidi
--   get_login_email(p_username)  — RPC: kullanıcı adından auth e-postasını döndürür
--   claim_recovery_email(...)    — RPC: kurtarma e-postası self-servis atama

-- ── TRİGGER: UPDATED_AT OTOMATİK GÜNCELLEME ─────────────────────
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── TRİGGER: TAHMİN KURALLARI ZORUNLULUĞU ───────────────────────
-- predictions tablosuna BEFORE INSERT OR UPDATE olarak bağlıdır.
-- Üç kuralı veritabanı seviyesinde zorlar (UI bypass'ına karşı):
--   1. Maç kilitliyse değişiklik yasak
--   2. Maç başlangıcından 1 saat öncesinde bahis penceresi kapanır
--   3. Aynı Istanbul günü için joker zaten kullanılmışsa yeni joker yasak
create or replace function enforce_prediction_rules()
returns trigger
language plpgsql
as $$
declare
  m              record;
  joker_conflict int;
begin
  select match_datetime, locked into m
  from matches
  where id = new.match_id;

  if m.locked then
    raise exception 'Bu maç kilitli, tahmin değiştirilemez.';
  end if;

  if m.match_datetime is not null
     and now() > (m.match_datetime - interval '1 hour') then
    raise exception 'Bahis süresi doldu.';
  end if;

  if new.is_joker then
    select count(*) into joker_conflict
    from predictions p
    join matches mm on mm.id = p.match_id
    where p.user_id    = new.user_id
      and p.is_joker   = true
      and p.match_id  <> new.match_id
      and (mm.match_datetime at time zone 'Europe/Istanbul')::date
        = (m.match_datetime  at time zone 'Europe/Istanbul')::date;

    if joker_conflict > 0 then
      raise exception 'Bugün için joker zaten kullanılmış.';
    end if;
  end if;

  return new;
end;
$$;

-- ── RPC: KULLANICI ADINDAN AUTH E-POSTASI ────────────────────────
-- Giriş ekranındaki "Şifremi unuttum" akışı için kullanılır.
-- Kullanıcının auth.users tablosundaki güncel e-postasını döndürür.
create or replace function get_login_email(p_username text)
returns text
language sql
security definer
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

grant execute on function get_login_email(text) to anon;
grant execute on function get_login_email(text) to authenticated;

-- ── RPC: KURTARMA E-POSTASI SELF-SERVİS ATAMA ───────────────────
-- "Şifremi unuttum" ekranından recovery_email henüz atanmamış
-- kullanıcıların kendi e-postalarını girmesine olanak tanır.
-- recovery_email zaten varsa no-op döner (hesap ele geçirme önlemi).
create or replace function claim_recovery_email(p_username text, p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from profiles
  where lower(username) = lower(p_username)
    and recovery_email is null;

  if v_id is null then
    return;
  end if;

  if exists (
    select 1 from auth.users
    where email = lower(p_email) and id <> v_id
  ) then
    return;
  end if;

  update profiles
  set recovery_email = lower(p_email)
  where id = v_id;

  update auth.users
  set email               = lower(p_email),
      email_confirmed_at  = coalesce(email_confirmed_at, now())
  where id = v_id;
end;
$$;

grant execute on function claim_recovery_email(text, text) to anon;
grant execute on function claim_recovery_email(text, text) to authenticated;

-- ── RPC: ŞİFRE DEĞİŞTİR (mevcut şifre doğrulaması ile) ──────────
-- Supabase'in "Secure password change" ayarını bypass eder.
-- pgcrypto ile mevcut şifreyi doğrular, yeni bcrypt hash kaydeder.
create or replace function change_user_password(current_password text, new_password text)
returns void
language plpgsql
security definer
as $$
declare
  v_encrypted text;
begin
  select encrypted_password into v_encrypted
  from auth.users where id = auth.uid();

  if v_encrypted is null then
    raise exception 'Kullanıcı bulunamadı.';
  end if;

  if crypt(current_password, v_encrypted) != v_encrypted then
    raise exception 'Mevcut şifre yanlış.';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where id = auth.uid();
end;
$$;

grant execute on function change_user_password(text, text) to authenticated;
