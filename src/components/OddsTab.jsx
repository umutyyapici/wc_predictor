import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const K_SKOR  = 3
const K_FARK  = 2
const K_SONUC = 1
const BOARD_ITEMS = 10
const PRED_ITEMS  = 5
const ODDS_CUTOFF = new Date('2026-06-23T21:00:00Z')  // 24.06.2026 00:00 TRT

// ── Poisson yardımcıları ─────────────────────────────────────────
function poissonProb(k, lam) {
  if (k < 0 || !Number.isInteger(k) || lam <= 0) return 0
  if (k === 0) return Math.exp(-lam)
  let logP = -lam + k * Math.log(lam)
  for (let i = 2; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

function homeWinP(lH, lA, N = 10) {
  let p = 0
  for (let h = 1; h <= N; h++)
    for (let a = 0; a < h; a++)
      p += poissonProb(h, lH) * poissonProb(a, lA)
  return p
}

function estimateLambdas(pH, pA, tot = 2.5) {
  let lo = 0.02, hi = tot - 0.02
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    homeWinP(mid, tot - mid) < pH ? hi = mid : lo = mid
  }
  const lH = (lo + hi) / 2
  return [lH, tot - lH]
}

function golFarkiP(diff, lH, lA, N = 12) {
  let p = 0
  if (diff >= 0)
    for (let a = 0; a + diff <= N; a++) p += poissonProb(a + diff, lH) * poissonProb(a, lA)
  else
    for (let h = 0; h - diff <= N; h++) p += poissonProb(h, lH) * poissonProb(h - diff, lA)
  return Math.max(p, 1e-9)
}

function logScore(K, p) { return K * Math.log2(1 / Math.max(p, 1e-9)) }

function calcOddsScore(predH, predA, actualH, actualA, odds) {
  if (!odds) return null
  const { h2h_home, h2h_draw, h2h_away, totals_line, correct_scores } = odds

  const predRes   = predH > predA ? 'home' : predH < predA ? 'away' : 'draw'
  const actualRes = actualH > actualA ? 'home' : actualH < actualA ? 'away' : 'draw'
  const resultOk  = predRes === actualRes
  const diffOk    = (predH - predA) === (actualH - actualA)
  const skorOk    = predH === actualH && predA === actualA

  let p_sonuc, p_fark, p_skor, usedApi = false

  const allEntries   = correct_scores ? Object.entries(correct_scores) : []
  const scoreEntries = allEntries.filter(([sc]) => /^\d{1,2}-\d{1,2}$/.test(sc))

  if (scoreEntries.length >= 10) {
    // Yol A: doğru skor oranlarından türet (_other dahil normalize)
    const impliedSum = allEntries.reduce((s, [, o]) => s + 1 / o, 0)
    const scoreProbs = {}
    scoreEntries.forEach(([sc, o]) => { scoreProbs[sc] = (1 / o) / impliedSum })

    let pH = 0, pD = 0, pA = 0
    for (const [sc, p] of Object.entries(scoreProbs)) {
      const [h, a] = sc.split('-').map(Number)
      if (h > a) pH += p; else if (h === a) pD += p; else pA += p
    }
    p_sonuc = predRes === 'home' ? pH : predRes === 'draw' ? pD : pA

    const predDiff = predH - predA
    p_fark = scoreEntries
      .filter(([sc]) => { const [h, a] = sc.split('-').map(Number); return (h - a) === predDiff })
      .reduce((s, [sc]) => s + (scoreProbs[sc] || 0), 0)

    p_skor  = scoreProbs[`${predH}-${predA}`] || 1e-9
    usedApi = true

  } else {
    // Yol B: h2h + Poisson fallback
    const rawH = 1 / h2h_home, rawD = 1 / h2h_draw, rawA = 1 / h2h_away
    const sum  = rawH + rawD + rawA
    const pH = rawH / sum, pD = rawD / sum, pA = rawA / sum
    p_sonuc = predRes === 'home' ? pH : predRes === 'draw' ? pD : pA
    const [lH, lA] = estimateLambdas(pH, pA, totals_line || 2.5)
    p_fark = golFarkiP(predH - predA, lH, lA)
    p_skor = poissonProb(predH, lH) * poissonProb(predA, lA)
  }

  let score = 0
  const components = { sonuc: 0, fark: 0, skor: 0, usedApi }
  if (resultOk) { components.sonuc = logScore(K_SONUC, p_sonuc);               score += components.sonuc }
  if (diffOk)   { components.fark  = logScore(K_FARK,  Math.max(p_fark, 1e-9)); score += components.fark  }
  if (skorOk)   { components.skor  = logScore(K_SKOR,  Math.max(p_skor, 1e-9)); score += components.skor  }

  return { score: +score.toFixed(2), components, resultOk, diffOk, skorOk }
}

// ── Ana bileşen ──────────────────────────────────────────────────
export default function OddsTab({ matches, currentUserId, activeGroup, groupCutoff }) {
  const [board, setBoard]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [profileRow, setProfileRow] = useState(null)
  const [page, setPage]             = useState(1)

  useEffect(() => {
    setPage(1)
    loadBoard()
  }, [matches?.length, activeGroup, groupCutoff])

  const loadBoard = async () => {
    setLoading(true)

    const { data: members } = await supabase
      .from('user_groups')
      .select('user_id, profiles(username)')
      .eq('invite_code', activeGroup || 'kodsuz')

    if (!members?.length) { setLoading(false); setBoard([]); return }

    const ids   = members.map(m => m.user_id)
    const names = {}
    members.forEach(m => { names[m.user_id] = m.profiles?.username || 'Anonim' })

    const eligibleMatches = matches.filter(m =>
      m.locked &&
      m.match_datetime &&
      new Date(m.match_datetime) >= ODDS_CUTOFF &&
      (!groupCutoff || new Date(m.match_datetime) >= new Date(groupCutoff))
    )
    const eligibleIds = eligibleMatches.map(m => m.id)

    const oddsMap = {}
    if (eligibleIds.length) {
      const { data: oddsRows } = await supabase
        .from('match_odds')
        .select('*')
        .in('match_id', eligibleIds)
      ;(oddsRows || []).forEach(o => { oddsMap[o.match_id] = o })
    }

    const map = {}
    ids.forEach(uid => {
      map[uid] = { uid, username: names[uid] || 'Anonim', total: 0, pred_count: 0,
        joker_count: 0, sonucOk: 0, diffOk: 0, skorOk: 0, details: [] }
    })

    if (eligibleIds.length) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, match_id, pred_home, pred_away, is_joker')
        .in('user_id', ids)
        .in('match_id', eligibleIds)

      ;(preds || []).forEach(p => {
        const u = map[p.user_id]
        if (!u) return
        const match = matches.find(m => m.id === p.match_id)
        if (!match?.locked) return
        u.pred_count++

        const odds = oddsMap[p.match_id]
        if (!odds) return

        const res = calcOddsScore(+p.pred_home, +p.pred_away, +match.actual_home, +match.actual_away, odds)
        if (!res) return

        const finalScore = p.is_joker ? +(res.score * 2).toFixed(2) : res.score
        u.total = +(u.total + finalScore).toFixed(2)
        if (p.is_joker) u.joker_count++
        if (res.resultOk) u.sonucOk++
        if (res.diffOk)   u.diffOk++
        if (res.skorOk)   u.skorOk++
        u.details.push({ match, pred: p, result: res, finalScore })
      })
    }

    const sorted = Object.values(map).sort((a, b) => {
      for (const k of ['total', 'skorOk', 'diffOk', 'sonucOk', 'pred_count'])
        if (b[k] !== a[k]) return b[k] - a[k]
      return a.username.localeCompare(b.username, 'tr')
    })
    setBoard(sorted)
    setLoading(false)
  }

  if (loading) return (
    <div style={s.center}><span style={s.spinner} /><p style={s.loadTxt}>Yükleniyor...</p></div>
  )

  const totalPages = Math.ceil(board.length / BOARD_ITEMS) || 1
  const pageRows   = board.slice((page - 1) * BOARD_ITEMS, page * BOARD_ITEMS)

  return (
    <div style={s.wrap}>
      <div style={s.info}>
        📊 Logaritmik puanlama · K_skor={K_SKOR} · K_fark={K_FARK} · K_sonuç={K_SONUC} · Joker ×2
      </div>

      <div style={s.hRow}>
        <span style={{ ...s.hLabel, flex: 1 }}>OYUNCU</span>
        <span style={{ ...s.hLabel, width: 64, textAlign: 'center' }}>TAHMİN</span>
        <span style={{ ...s.hLabel, width: 72, textAlign: 'right' }}>PUAN</span>
      </div>

      {board.length === 0 && <p style={s.empty}>Henüz uygun maç yok.</p>}

      {pageRows.map((row, i) => {
        const rank  = (page - 1) * BOARD_ITEMS + i
        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null
        const isMe  = row.uid === currentUserId
        return (
          <div key={row.uid} style={{ ...s.row, ...(isMe ? s.rowMe : {}) }} onClick={() => setProfileRow(row)}>
            <div style={s.rank}>{medal || <span style={s.rankNum}>#{rank + 1}</span>}</div>
            <div style={s.name}>
              {row.username}
              {isMe && <span style={s.youBadge}>sen</span>}
              {row.joker_count > 0 && <span style={s.jokerBadge}>🃏×{row.joker_count}</span>}
            </div>
            <div style={s.predCountBox}>
              <span style={s.predCountNum}>{row.pred_count}</span>
              <span style={s.predCountLabel}>maç</span>
            </div>
            <div style={s.pts}><span style={s.ptsNum}>{row.total.toFixed(1)}</span></div>
            <span style={s.chev}>›</span>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div style={s.pgWrap}>
          <button style={{ ...s.pgArrow, opacity: page === 1 ? .3 : 1 }}
            disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Önceki</button>
          <div style={s.pgNums}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} style={{ ...s.pgBtn, ...(n === page ? s.pgBtnActive : {}) }}
                onClick={() => setPage(n)}>{n}</button>
            ))}
          </div>
          <button style={{ ...s.pgArrow, opacity: page === totalPages ? .3 : 1 }}
            disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Sonraki ›</button>
        </div>
      )}

      {profileRow && <OddsProfileModal row={profileRow} onClose={() => setProfileRow(null)} />}
    </div>
  )
}

// ── Profil Modalı ────────────────────────────────────────────────
function OddsProfileModal({ row, onClose }) {
  const [predPage, setPredPage] = useState(0)

  const sorted = [...row.details].sort((a, b) =>
    new Date(b.match.match_datetime || '2000') - new Date(a.match.match_datetime || '2000')
  )
  const totalPredPages = Math.ceil(sorted.length / PRED_ITEMS)
  const pageItems      = sorted.slice(predPage * PRED_ITEMS, (predPage + 1) * PRED_ITEMS)

  return (
    <div style={pm.overlay}>
      <div style={pm.box}>
        <div style={pm.top}>
          <span style={pm.username}>👤 {row.username}</span>
          <button style={pm.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={pm.totalBox}>
          <span style={pm.totalNum}>{row.total.toFixed(1)}</span>
          <span style={pm.totalLbl}>logaritmik puan</span>
        </div>

        <div style={pm.statsGrid}>
          {[
            { label: '🔥 Tam Skor Doğru',    val: `${row.skorOk} maç`, gold: true },
            { label: '↔️ Gol Farkı Doğru',  val: `${row.diffOk} maç` },
            { label: '✅ Sonuç Doğru',       val: `${row.sonucOk} maç` },
            { label: '📋 Puanlı Maç',        val: row.pred_count },
            { label: '🃏 Joker Kullanımı',   val: `${row.joker_count}×` },
          ].map(({ label, val, gold }) => (
            <div key={label} style={pm.sRow}>
              <span style={pm.sLabel}>{label}</span>
              <span style={{ ...pm.sVal, ...(gold ? { color: 'var(--gold)' } : {}) }}>{val}</span>
            </div>
          ))}
        </div>

        {sorted.length > 0 && (
          <>
            <div style={pm.matchHead}>Tahminler ({sorted.length} maç)</div>
            {pageItems.map(({ match, pred, result, finalScore }) => {
              const pts = finalScore
              const bg  = pts >= 10 ? '#f5c518' : pts >= 3 ? '#16a34a' : pts > 0 ? '#2563eb' : '#374151'
              const isJoker = pred.is_joker
              return (
                <div key={match.id} style={pm.mRow}>
                  <div style={pm.mLeft}>
                    <span style={pm.mTeams}>{match.home_team} – {match.away_team}</span>
                    <span style={pm.mScore}>
                      {match.actual_home}:{match.actual_away}
                      {result.components.skor > 0 && (
                        <span style={{ color: '#f5c518', marginLeft: 4 }}>
                          ⚡{result.components.usedApi ? '' : '~'}+{result.components.skor.toFixed(1)}
                        </span>
                      )}
                      {result.components.fark > 0 && !result.skorOk && (
                        <span style={{ color: '#4ade80', marginLeft: 4 }}>↔+{result.components.fark.toFixed(1)}</span>
                      )}
                    </span>
                  </div>
                  <div style={pm.mRight}>
                    {isJoker && <span style={pm.jokerTag}>🃏</span>}
                    <span style={pm.mPred}>{pred.pred_home}–{pred.pred_away}</span>
                    <span style={{ ...pm.mPts, background: bg, color: pts >= 10 ? '#000' : '#fff' }}>
                      {pts > 0 ? '+' : ''}{pts.toFixed(1)}{isJoker ? '×2' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
            {totalPredPages > 1 && (
              <div style={pm.pgWrap}>
                <button style={{ ...pm.pgBtn, opacity: predPage === 0 ? .3 : 1 }}
                  disabled={predPage === 0} onClick={() => setPredPage(p => p - 1)}>‹ Önceki</button>
                <span style={pm.pgInfo}>{predPage + 1} / {totalPredPages}</span>
                <button style={{ ...pm.pgBtn, opacity: predPage === totalPredPages - 1 ? .3 : 1 }}
                  disabled={predPage === totalPredPages - 1} onClick={() => setPredPage(p => p + 1)}>Sonraki ›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap:           { padding: '12px 14px', paddingBottom: 60 },
  info:           { fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, letterSpacing: .3 },
  center:         { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, gap: 12 },
  spinner:        { width: 28, height: 28, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
  loadTxt:        { color: '#6b7280', fontSize: 14, margin: 0 },
  empty:          { color: '#6b7280', textAlign: 'center', padding: 32, fontSize: 14, margin: 0 },
  hRow:           { display: 'flex', alignItems: 'center', paddingInline: 14, marginBottom: 8, gap: 8 },
  hLabel:         { fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase' },
  row:            { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 6, cursor: 'pointer' },
  rowMe:          { background: 'rgba(225,29,72,.1)', border: '1px solid rgba(225,29,72,.25)' },
  rank:           { width: 28, fontSize: 20, textAlign: 'center', flexShrink: 0 },
  rankNum:        { fontFamily: 'var(--font-display)', fontSize: 16, color: '#6b7280', letterSpacing: 1 },
  name:           { flex: 1, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' },
  youBadge:       { fontSize: 10, background: 'rgba(225,29,72,.3)', color: '#fca5a5', padding: '2px 6px', borderRadius: 20, fontWeight: 700, flexShrink: 0 },
  jokerBadge:     { fontSize: 11, color: '#f5c518', flexShrink: 0 },
  predCountBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 },
  predCountNum:   { fontFamily: 'var(--font-display)', fontSize: 18, color: '#9ca3af', letterSpacing: 1, lineHeight: 1 },
  predCountLabel: { fontSize: 9, color: '#4b5563', letterSpacing: 1, textTransform: 'uppercase' },
  pts:            { display: 'flex', alignItems: 'center', width: 60, justifyContent: 'flex-end', flexShrink: 0 },
  ptsNum:         { fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--gold)', letterSpacing: 1 },
  chev:           { fontSize: 18, color: '#6b7280', flexShrink: 0 },
  pgWrap:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '8px 12px', margin: '14px 0' },
  pgArrow:        { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px' },
  pgNums:         { display: 'flex', gap: 6, alignItems: 'center' },
  pgBtn:          { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, width: 32, height: 32, color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pgBtnActive:    { background: '#fbbf24', color: '#0f172a' },
}

const pm = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 14px', overflowY: 'auto' },
  box:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  top:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.07)' },
  username: { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1, color: 'var(--text)' },
  closeBtn: { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 13, cursor: 'pointer' },
  totalBox: { textAlign: 'center', marginBottom: 16 },
  totalNum: { fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--gold)', letterSpacing: 2, display: 'block' },
  totalLbl: { fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' },
  statsGrid:{ background: 'rgba(0,0,0,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 },
  sRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBlock: 8, borderBottom: '1px solid rgba(255,255,255,.04)' },
  sLabel:   { fontSize: 13, color: '#94a3b8' },
  sVal:     { fontSize: 13, color: '#f1f5f9', fontWeight: 700 },
  matchHead:{ fontSize: 11, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 10 },
  mRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' },
  mLeft:    { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, paddingRight: 8 },
  mTeams:   { fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mScore:   { fontSize: 11, color: 'var(--muted)' },
  mRight:   { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  jokerTag: { fontSize: 13 },
  mPred:    { fontSize: 13, color: '#94a3b8', fontWeight: 600 },
  mPts:     { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
  pgWrap:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.07)' },
  pgBtn:    { background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  pgInfo:   { fontSize: 12, color: 'var(--muted)' },
}
