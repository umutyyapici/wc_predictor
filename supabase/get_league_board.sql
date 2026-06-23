-- P4 optimizasyonu: LeagueTab skor hesaplama
-- Supabase SQL editöründe çalıştır.
-- Tüm hesaplamayı server-side yaparak client'a sadece özet veri gönderir.
-- scoring.js:calcPoints() mantığıyla birebir eşleşir.

CREATE OR REPLACE FUNCTION get_league_board(p_group text, p_cutoff timestamptz DEFAULT NULL)
RETURNS TABLE (
  uid         uuid,
  username    text,
  total       integer,
  pred_count  integer,
  tam_isabet  integer,
  kil_payi    integer,
  strategist  integer,
  bilge       integer,
  teselli     integer,
  joker_count integer,
  details     jsonb
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

      /* Sonuç eşleşmesi — scoring.js:15 ile aynı */
      (CASE WHEN p.pred_home > p.pred_away THEN '1'
            WHEN p.pred_home < p.pred_away THEN '2' ELSE 'X' END) =
      (CASE WHEN m.actual_home > m.actual_away THEN '1'
            WHEN m.actual_home < m.actual_away THEN '2' ELSE 'X' END)          AS result_ok,

      p.pred_home = m.actual_home                                               AS home_ok,
      p.pred_away = m.actual_away                                               AS away_ok,
      (p.pred_home - p.pred_away) = (m.actual_home - m.actual_away)            AS diff_ok,

      /* Temel puan (joker çarpanı öncesi) — scoring.js:18-29 ile aynı */
      CASE
        WHEN (CASE WHEN p.pred_home > p.pred_away THEN '1'
                   WHEN p.pred_home < p.pred_away THEN '2' ELSE 'X' END) =
             (CASE WHEN m.actual_home > m.actual_away THEN '1'
                   WHEN m.actual_home < m.actual_away THEN '2' ELSE 'X' END)
        THEN 1
          + CASE WHEN p.pred_home = m.actual_home THEN 2 ELSE 0 END
          + CASE WHEN p.pred_away = m.actual_away THEN 2 ELSE 0 END
          + CASE WHEN (p.pred_home - p.pred_away) = (m.actual_home - m.actual_away) THEN 1 ELSE 0 END
        ELSE
          CASE WHEN p.pred_home = m.actual_home THEN 1 ELSE 0 END
          + CASE WHEN p.pred_away = m.actual_away THEN 1 ELSE 0 END
      END AS base_pts

    FROM predictions p
    JOIN locked_matches m ON m.id = p.match_id
    WHERE p.user_id IN (SELECT user_id FROM group_members)
  )
  SELECT
    gm.user_id                                                                       AS uid,
    gm.username,

    COALESCE(SUM(pd.base_pts * CASE WHEN pd.is_joker THEN 2 ELSE 1 END), 0)::int    AS total,
    COUNT(pd.user_id)::int                                                           AS pred_count,

    COUNT(pd.user_id) FILTER (WHERE pd.result_ok AND pd.home_ok AND pd.away_ok)::int
      AS tam_isabet,
    COUNT(pd.user_id) FILTER (WHERE pd.result_ok AND NOT (pd.home_ok AND pd.away_ok) AND (pd.home_ok OR pd.away_ok))::int
      AS kil_payi,
    COUNT(pd.user_id) FILTER (WHERE pd.result_ok AND NOT pd.home_ok AND NOT pd.away_ok AND pd.diff_ok)::int
      AS strategist,
    COUNT(pd.user_id) FILTER (WHERE pd.result_ok AND NOT pd.home_ok AND NOT pd.away_ok AND NOT pd.diff_ok)::int
      AS bilge,
    COUNT(pd.user_id) FILTER (WHERE NOT pd.result_ok AND (pd.home_ok OR pd.away_ok))::int
      AS teselli,
    COUNT(pd.user_id) FILTER (WHERE pd.is_joker)::int
      AS joker_count,

    /* ProfileModal'ın beklediği { match, pred, pts } formatında dizi */
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'match', jsonb_build_object(
            'id',             pd.match_id,
            'home_team',      pd.home_team,
            'away_team',      pd.away_team,
            'match_datetime', pd.match_datetime,
            'actual_home',    pd.actual_home,
            'actual_away',    pd.actual_away
          ),
          'pred', jsonb_build_object(
            'pred_home', pd.pred_home,
            'pred_away', pd.pred_away,
            'is_joker',  pd.is_joker
          ),
          'pts', pd.base_pts * CASE WHEN pd.is_joker THEN 2 ELSE 1 END
        )
        ORDER BY pd.match_datetime DESC NULLS LAST
      ) FILTER (WHERE pd.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS details

  FROM group_members gm
  LEFT JOIN pred_data pd ON pd.user_id = gm.user_id
  GROUP BY gm.user_id, gm.username
  ORDER BY
    total       DESC,
    tam_isabet  DESC,
    kil_payi    DESC,
    strategist  DESC,
    bilge       DESC,
    teselli     DESC,
    pred_count  DESC,
    gm.username ASC;
$$;

GRANT EXECUTE ON FUNCTION get_league_board(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_league_board(text, timestamptz) TO anon;
