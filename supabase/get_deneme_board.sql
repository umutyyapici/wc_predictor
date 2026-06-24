-- Deneme sekmesi puan cetveli — sunucu taraflı hesaplama
-- Supabase SQL editöründe çalıştır.
-- DenemeTab.jsx'in calcDenemeResult() + nadir mantığını birebir uygular.

CREATE OR REPLACE FUNCTION get_deneme_board(p_group text, p_cutoff timestamptz DEFAULT NULL)
RETURNS TABLE (
  uid                  uuid,
  username             text,
  total                integer,
  standard_total       integer,
  pred_count           integer,
  joker_count          integer,
  nadir_count          integer,
  tam_isabet           integer,
  kil_payi_strategist  integer,
  bilge                integer,
  teselli              integer,
  details              jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH group_members AS (
    SELECT ug.user_id, pr.username
    FROM   user_groups ug
    JOIN   profiles pr ON pr.id = ug.user_id
    WHERE  ug.invite_code = p_group
  ),
  locked_matches AS (
    SELECT id, home_team, away_team, match_datetime, actual_home, actual_away
    FROM   matches
    WHERE  locked = true
      AND  actual_home IS NOT NULL
      AND  actual_away IS NOT NULL
      AND  (p_cutoff IS NULL OR match_datetime >= p_cutoff)
  ),
  -- Ham tahmin verisi + sonuç bayrakları
  pred_data AS (
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

      (CASE WHEN p.pred_home > p.pred_away THEN '1'
            WHEN p.pred_home < p.pred_away THEN '2' ELSE 'X' END) =
      (CASE WHEN m.actual_home > m.actual_away THEN '1'
            WHEN m.actual_home < m.actual_away THEN '2' ELSE 'X' END)      AS result_ok,

      p.pred_home = m.actual_home                                           AS home_ok,
      p.pred_away = m.actual_away                                           AS away_ok,
      (p.pred_home - p.pred_away) = (m.actual_home - m.actual_away)        AS diff_ok,
      p.pred_home = m.actual_home AND p.pred_away = m.actual_away          AS exact_score

    FROM predictions p
    JOIN locked_matches m ON m.id = p.match_id
    WHERE p.user_id IN (SELECT user_id FROM group_members)
  ),
  -- Deneme baz puanı ve kategori (calcDenemeResult mantığı)
  pred_base AS (
    SELECT
      *,
      CASE
        WHEN result_ok THEN
          CASE
            WHEN exact_score        THEN 8   -- TAM İSABET
            WHEN home_ok OR away_ok THEN 4   -- KIL PAYI
            WHEN diff_ok            THEN 4   -- STRATEJİST
            ELSE                         2   -- BİLGE
          END
        ELSE
          CASE WHEN home_ok OR away_ok THEN 1 ELSE 0 END  -- TESELLİ veya 0
      END AS base_pts,

      CASE
        WHEN result_ok AND exact_score                                              THEN 'tam_isabet'
        WHEN result_ok AND NOT exact_score AND (home_ok OR away_ok)                THEN 'kil_payi'
        WHEN result_ok AND NOT exact_score AND NOT (home_ok OR away_ok) AND diff_ok THEN 'strategist'
        WHEN result_ok AND NOT exact_score AND NOT (home_ok OR away_ok)            THEN 'bilge'
        WHEN NOT result_ok AND (home_ok OR away_ok)                                THEN 'teselli'
        ELSE NULL
      END AS category,

      -- Standart puan (Lig sekmesiyle aynı; fark göstergesi için)
      CASE
        WHEN result_ok
        THEN 1
          + CASE WHEN home_ok THEN 2 ELSE 0 END
          + CASE WHEN away_ok THEN 2 ELSE 0 END
          + CASE WHEN diff_ok THEN 1 ELSE 0 END
        ELSE
          CASE WHEN home_ok THEN 1 ELSE 0 END
          + CASE WHEN away_ok THEN 1 ELSE 0 END
      END AS standard_base_pts

    FROM pred_data
  ),
  -- Maç başına exact-score istatistikleri (nadir hesabı için)
  match_stats AS (
    SELECT
      match_id,
      COUNT(*)                              AS total_preds,
      COUNT(*) FILTER (WHERE exact_score)  AS exact_count
    FROM pred_base
    GROUP BY match_id
  ),
  -- Nihai puan: (baz + nadir bonusu) × joker çarpanı
  pred_final AS (
    SELECT
      pb.*,
      -- Nadir: doğru skor VE grubun en fazla %10'u aynı skoru tahmin ettiyse
      pb.exact_score
        AND ms.exact_count <= CEIL(ms.total_preds::numeric * 0.1)  AS nadir,

      CASE WHEN pb.is_joker
        THEN (pb.base_pts + CASE WHEN pb.exact_score AND ms.exact_count <= CEIL(ms.total_preds::numeric * 0.1) THEN 2 ELSE 0 END) * 2
        ELSE  pb.base_pts + CASE WHEN pb.exact_score AND ms.exact_count <= CEIL(ms.total_preds::numeric * 0.1) THEN 2 ELSE 0 END
      END AS pts,

      CASE WHEN pb.is_joker THEN pb.standard_base_pts * 2
                            ELSE pb.standard_base_pts
      END AS std_pts

    FROM pred_base pb
    JOIN match_stats ms ON ms.match_id = pb.match_id
  )
  SELECT
    gm.user_id                                                                      AS uid,
    gm.username,
    COALESCE(SUM(pf.pts),         0)::int                                           AS total,
    COALESCE(SUM(pf.std_pts),     0)::int                                           AS standard_total,
    COUNT(pf.user_id)::int                                                          AS pred_count,
    COUNT(pf.user_id) FILTER (WHERE pf.is_joker)::int                              AS joker_count,
    COUNT(pf.user_id) FILTER (WHERE pf.nadir)::int                                 AS nadir_count,
    COUNT(pf.user_id) FILTER (WHERE pf.category = 'tam_isabet')::int               AS tam_isabet,
    COUNT(pf.user_id) FILTER (WHERE pf.category IN ('kil_payi','strategist'))::int AS kil_payi_strategist,
    COUNT(pf.user_id) FILTER (WHERE pf.category = 'bilge')::int                   AS bilge,
    COUNT(pf.user_id) FILTER (WHERE pf.category = 'teselli')::int                 AS teselli,

    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'match', jsonb_build_object(
            'id',             pf.match_id,
            'home_team',      pf.home_team,
            'away_team',      pf.away_team,
            'match_datetime', pf.match_datetime,
            'actual_home',    pf.actual_home,
            'actual_away',    pf.actual_away
          ),
          'pred', jsonb_build_object(
            'pred_home', pf.pred_home,
            'pred_away', pf.pred_away,
            'is_joker',  pf.is_joker
          ),
          'pts',      pf.pts,
          'nadir',    pf.nadir,
          'category', pf.category
        )
        ORDER BY pf.match_datetime DESC NULLS LAST
      ) FILTER (WHERE pf.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS details

  FROM group_members gm
  LEFT JOIN pred_final pf ON pf.user_id = gm.user_id
  GROUP BY gm.user_id, gm.username
  ORDER BY
    total                DESC,
    nadir_count          DESC,
    tam_isabet           DESC,
    kil_payi_strategist  DESC,
    bilge                DESC,
    teselli              DESC,
    pred_count           DESC,
    gm.username          ASC;
$$;

GRANT EXECUTE ON FUNCTION get_deneme_board(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deneme_board(text, timestamptz) TO anon;
