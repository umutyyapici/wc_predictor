-- get_deneme_board — Kristal puan sistemi skor tablosu
-- Supabase SQL editöründe çalıştır.
--
-- Puanlama:
--   TAM İSABET 🔥   sonuç + tam skor         → 6 puan
--   KIL PAYI 🎯     sonuç + bir gol doğru     → 3 puan
--   STRATEJİST ↔️  sonuç + gol farkı doğru   → 3 puan
--   BİLGE 🔮        sadece sonuç doğru        → 2 puan
--   TESELLİ ⚽      yanlış sonuç + bir gol    → 1 puan
--   NADİR İSABET ⚡ tam skor + ≤%10 aynı tahmin → +2 bonus
--   JOKER 🃏        (baz + nadir) × 2

CREATE OR REPLACE FUNCTION get_deneme_board(p_group text, p_cutoff timestamptz DEFAULT NULL)
RETURNS TABLE (
  uid                 uuid,
  username            text,
  total               integer,
  pred_count          integer,
  nadir_count         integer,
  tam_isabet          integer,
  kil_payi_strategist integer,
  bilge               integer,
  teselli             integer,
  joker_count         integer,
  details             jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH group_members AS (
    SELECT ug.user_id, pr.username
    FROM   user_groups ug
    JOIN   profiles    pr ON pr.id = ug.user_id
    WHERE  ug.invite_code = p_group
  ),
  locked_matches AS (
    SELECT id, home_team, away_team, match_datetime, actual_home, actual_away
    FROM   matches
    WHERE  locked      = true
      AND  actual_home IS NOT NULL
      AND  actual_away IS NOT NULL
      AND  (p_cutoff IS NULL OR match_datetime >= p_cutoff)
  ),
  pred_base AS (
    SELECT
      p.user_id,
      p.pred_home,
      p.pred_away,
      p.is_joker,
      m.id             AS match_id,
      m.home_team,
      m.away_team,
      m.match_datetime,
      m.actual_home,
      m.actual_away,

      /* Sonuç eşleşmesi */
      (CASE WHEN p.pred_home > p.pred_away THEN '1'
            WHEN p.pred_home < p.pred_away THEN '2' ELSE 'X' END) =
      (CASE WHEN m.actual_home > m.actual_away THEN '1'
            WHEN m.actual_home < m.actual_away THEN '2' ELSE 'X' END)  AS result_ok,

      p.pred_home = m.actual_home                                        AS home_ok,
      p.pred_away = m.actual_away                                        AS away_ok,
      (p.pred_home - p.pred_away) = (m.actual_home - m.actual_away)     AS diff_ok

    FROM predictions p
    JOIN locked_matches m ON m.id = p.match_id
    WHERE p.user_id IN (SELECT user_id FROM group_members)
  ),
  pred_scored AS (
    SELECT *,
      /* Yeni Kristal puan bazı */
      CASE
        WHEN result_ok AND home_ok AND away_ok THEN 6
        WHEN result_ok AND (home_ok OR away_ok) THEN 3
        WHEN result_ok AND diff_ok              THEN 3
        WHEN result_ok                           THEN 2
        WHEN home_ok OR away_ok                  THEN 1
        ELSE 0
      END AS new_base_pts,

      /* Nadir İsabet için: bu maçta kaç kişi tam skor tahmin etti */
      COUNT(*) FILTER (WHERE result_ok AND home_ok AND away_ok)
        OVER (PARTITION BY match_id) AS match_exact_count,
      COUNT(*)
        OVER (PARTITION BY match_id) AS match_pred_count

    FROM pred_base
  ),
  pred_classified AS (
    SELECT *,
      /* Nadir İsabet: tam skor + ligdeki en fazla %10'u aynı skoru tahmin etti */
      result_ok AND home_ok AND away_ok AND
      match_exact_count <= CEIL(match_pred_count::numeric * 0.1) AS nadir,

      CASE
        WHEN result_ok AND home_ok AND away_ok  THEN 'tam_isabet'
        WHEN result_ok AND (home_ok OR away_ok) THEN 'kil_payi'
        WHEN result_ok AND diff_ok              THEN 'strategist'
        WHEN result_ok                           THEN 'bilge'
        WHEN home_ok OR away_ok                  THEN 'teselli'
        ELSE NULL
      END AS category

    FROM pred_scored
  ),
  pred_pts AS (
    SELECT *,
      (new_base_pts + CASE WHEN nadir THEN 2 ELSE 0 END)
        * CASE WHEN is_joker THEN 2 ELSE 1 END AS deneme_pts
    FROM pred_classified
  )
  SELECT
    gm.user_id                                                                       AS uid,
    gm.username,

    COALESCE(SUM(pp.deneme_pts), 0)::int                                             AS total,
    COUNT(pp.user_id)::int                                                           AS pred_count,

    COUNT(pp.user_id) FILTER (WHERE pp.nadir)::int                                  AS nadir_count,
    COUNT(pp.user_id) FILTER (WHERE pp.category = 'tam_isabet')::int                AS tam_isabet,
    COUNT(pp.user_id) FILTER (WHERE pp.category IN ('kil_payi', 'strategist'))::int AS kil_payi_strategist,
    COUNT(pp.user_id) FILTER (WHERE pp.category = 'bilge')::int                     AS bilge,
    COUNT(pp.user_id) FILTER (WHERE pp.category = 'teselli')::int                   AS teselli,
    COUNT(pp.user_id) FILTER (WHERE pp.is_joker)::int                               AS joker_count,

    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'match', jsonb_build_object(
            'id',             pp.match_id,
            'home_team',      pp.home_team,
            'away_team',      pp.away_team,
            'match_datetime', pp.match_datetime,
            'actual_home',    pp.actual_home,
            'actual_away',    pp.actual_away
          ),
          'pred', jsonb_build_object(
            'pred_home', pp.pred_home,
            'pred_away', pp.pred_away,
            'is_joker',  pp.is_joker
          ),
          'pts',      pp.deneme_pts,
          'nadir',    pp.nadir,
          'category', pp.category
        )
        ORDER BY pp.match_datetime DESC NULLS LAST
      ) FILTER (WHERE pp.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS details

  FROM group_members gm
  LEFT JOIN pred_pts pp ON pp.user_id = gm.user_id
  GROUP BY gm.user_id, gm.username
  ORDER BY
    total               DESC,
    nadir_count         DESC,
    tam_isabet          DESC,
    kil_payi_strategist DESC,
    bilge               DESC,
    teselli             DESC,
    pred_count          DESC,
    gm.username         ASC;
$$;

GRANT EXECUTE ON FUNCTION get_deneme_board(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deneme_board(text, timestamptz) TO anon;
