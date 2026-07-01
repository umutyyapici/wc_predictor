-- Admin Fonksiyonları — Supabase SQL Editöründen çalıştırılmalıdır.
--
-- UYGULAMA SIRASI (önemli):
--   1. enforce_prediction_rules() güncellemesi (bypass desteği ekler)
--   2. admin_upsert_prediction() yeni fonksiyon
--
-- Bu dosyadaki değişiklikler functions.sql'deki enforce_prediction_rules()
-- fonksiyonunu override eder — functions.sql'i ayrıca çalıştırmaya gerek yok.

-- ── ADIM 1: TRİGGER FONKSİYONUNA BYPASS DESTEĞİ EKLE ────────────
-- enforce_prediction_rules() güncellenir: admin_upsert_prediction RPC'si
-- çağrıldığında transaction-local flag ile kuralları atlar.
create or replace function enforce_prediction_rules()
returns trigger
language plpgsql
as $$
declare
  m              record;
  joker_conflict int;
begin
  -- Admin bypass: admin_upsert_prediction RPC'sinden çağrılırsa kuralları atla
  if current_setting('app.admin_bypass', true) = 'true' then
    return new;
  end if;

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

-- ── ADIM 2: ADMİN TAHMİN UPSERT FONKSİYONU ──────────────────────
-- Kilitli veya süresi geçmiş maçlar için admin adına tahmin ekler/günceller.
-- SECURITY DEFINER + transaction-local flag ile trigger kurallarını atlar.
-- Sadece profiles.is_admin = true olan kullanıcılar çağırabilir.
create or replace function admin_upsert_prediction(
  p_user_id   uuid,
  p_match_id  int,
  p_pred_home int,
  p_pred_away int,
  p_is_joker  boolean default false
) returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Yetkisiz işlem.';
  end if;

  -- Trigger'ın bu transaction için bypass moduna geçmesini sağla
  set local app.admin_bypass = 'true';

  insert into predictions (user_id, match_id, pred_home, pred_away, is_joker)
  values (p_user_id, p_match_id, p_pred_home, p_pred_away, p_is_joker)
  on conflict (user_id, match_id)
  do update set
    pred_home  = excluded.pred_home,
    pred_away  = excluded.pred_away,
    is_joker   = excluded.is_joker;
end;
$$;

grant execute on function admin_upsert_prediction(uuid, int, int, int, boolean) to authenticated;

-- ── TAHMİN EKRANI: KRİSTAL PUAN SORGUSU (NADİR İSABET DAHİL) ────
-- Tek bir maç için gruptaki tüm tahminleri Kristal kurallarıyla puanlar.
-- NADİR İSABET: Tam isabet yaptıysa VE gruptaki tahminlerin ≤%10'u aynı skoru bildiyse +2 bonus.
-- PredictTab "Diğer Tahminler" bölümünden çağrılır (isKristal && match.locked).
create or replace function get_match_kristal_scores(p_match_id int, p_group text)
returns table (
  uid       uuid,
  username  text,
  pred_home int,
  pred_away int,
  is_joker  boolean,
  pts       int,
  nadir     boolean
)
language sql
stable
security definer
as $$
with
  match_info as (
    select actual_home, actual_away
    from matches
    where id = p_match_id and locked = true
  ),
  group_preds as (
    select pr.user_id, pf.username, pr.pred_home, pr.pred_away, pr.is_joker
    from predictions pr
    join profiles pf    on pf.id = pr.user_id
    join user_groups ug on ug.user_id = pr.user_id and ug.invite_code = p_group
    where pr.match_id = p_match_id
  ),
  counts as (
    select
      count(*) as pred_count,
      count(*) filter (
        where gp.pred_home = mi.actual_home and gp.pred_away = mi.actual_away
      ) as exact_count
    from group_preds gp, match_info mi
  ),
  scored as (
    select
      gp.user_id,
      gp.username,
      gp.pred_home,
      gp.pred_away,
      gp.is_joker,
      (case when gp.pred_home > gp.pred_away then '1'
            when gp.pred_home < gp.pred_away then '2' else 'X' end)
      = (case when mi.actual_home > mi.actual_away then '1'
             when mi.actual_home < mi.actual_away then '2' else 'X' end)
        as result_ok,
      (gp.pred_home = mi.actual_home and gp.pred_away = mi.actual_away) as exact_score,
      (gp.pred_home = mi.actual_home or  gp.pred_away = mi.actual_away) as one_goal_ok,
      (gp.pred_home - gp.pred_away) = (mi.actual_home - mi.actual_away) as diff_ok,
      (gp.pred_home = mi.actual_home) as home_ok,
      (gp.pred_away = mi.actual_away) as away_ok,
      (gp.pred_home = mi.actual_home and gp.pred_away = mi.actual_away
        and c.exact_count <= ceil(c.pred_count * 0.1)) as nadir
    from group_preds gp, match_info mi, counts c
  ),
  final as (
    select
      s.user_id,
      s.username,
      s.pred_home,
      s.pred_away,
      s.is_joker,
      s.nadir,
      case
        when not s.result_ok then
          (case when s.home_ok then 1 else 0 end)
          + (case when s.away_ok then 1 else 0 end)
        when s.exact_score then
          6 + (case when s.nadir then 2 else 0 end)
        when s.one_goal_ok then 3
        when s.diff_ok     then 3
        else                    2
      end as base_pts
    from scored s
  )
select
  f.user_id as uid,
  f.username,
  f.pred_home,
  f.pred_away,
  f.is_joker,
  case when f.is_joker then f.base_pts * 2 else f.base_pts end as pts,
  f.nadir
from final f;
$$;

grant execute on function get_match_kristal_scores(int, text) to authenticated;
