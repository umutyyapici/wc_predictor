import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcPoints } from '../lib/scoring.js'

const BOARD_ITEMS = 10
const PRED_ITEMS  = 5

function calcDenemeResult(predH, predA, actualH, actualA) {
  const pH = parseInt(predH), pA = parseInt(predA)
  const aH = parseInt(actualH), aA = parseInt(actualA)
  if (isNaN(pH) || isNaN(pA) || isNaN(aH) || isNaN(aA)) return null
  const predRes   = pH > pA ? '1' : pH < pA ? '2' : 'X'
  const actualRes = aH > aA ? '1' : aH < aA ? '2' : 'X'
  const resultOk  = predRes === actualRes
  const exactScore = pH === aH && pA === aA
  let base = 0, category = null
  if (resultOk) {
    if (exactScore)                     { base = 8; category = 'tam_isabet' }
    else if (pH === aH || pA === aA)   { base = 4; category = 'kil_payi'   }
    else if ((pH - pA) === (aH - aA)) { base = 4; category = 'strategist' }
    else                                { base = 2; category = 'bilge'      }
  } else {
    if (pH === aH || pA === aA)        { base = 1; category = 'teselli'    }
  }
  return { base, category, exactScore }
}

export default function DenemeTab({ matches, currentUserId, activeGroup, groupCutoff }) {
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
      (!groupCutoff || new Date(m.match_datetime) >= new Date(groupCutoff))
    )
    const eligibleIds = eligibleMatches.map(m => m.id)

    const map = {}
    ids.forEach(uid => {
      map[uid] = {
        uid, username: names[uid] || 'Anonim',
        total: 0, standard_total: 0,
        pred_count: 0, joker_count: 0, nadir_count: 0,
        tam_isabet: 0, kil_payi_strategist: 0, bilge: 0, teselli: 0,
        details: [],
      }
    })

    if (!eligibleIds.length) { setBoard(Object.values(map)); setLoading(false); return }

    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id, match_id, pred_home, pred_away, is_joker')
      .in('user_id', ids)
      .in('match_id', eligibleIds).limit(20000)

    const allPreds = preds || []

    // Geçiş 1: Her maç için exact-score sayıları
    const matchStats = {}
    allPreds.forEach(p => {
      const match = matches.find(m => m.id === p.match_id)
      if (!match?.locked) return
      if (!matchStats[p.match_id]) matchStats[p.match_id] = { total: 0, exactors: new Set() }
      matchStats[p.match_id].total++
      const pH = parseInt(p.pred_home), pA = parseInt(p.pred_away)
      const aH = parseInt(match.actual_home), aA = parseInt(match.actual_away)
      if (!isNaN(pH) && !isNaN(pA) && !isNaN(aH) && !isNaN(aA) && pH === aH && pA === aA) {
        matchStats[p.match_id].exactors.add(p.user_id)
      }
    })

    // Geçiş 2: Kişi başı puan hesabı
    allPreds.forEach(p => {
      const u = map[p.user_id]
      if (!u) return
      const match = matches.find(m => m.id === p.match_id)
      if (!match?.locked) return
      u.pred_count++
      if (p.is_joker) u.joker_count++

      const standardPts = calcPoints(p.pred_home, p.pred_away, match.actual_home, match.actual_away, p.is_joker) || 0
      u.standard_total += standardPts

      const res = calcDenemeResult(p.pred_home, p.pred_away, match.actual_home, match.actual_away)
      if (!res) return

      const stats = matchStats[p.match_id]
      const nadir = res.exactScore && !!stats &&
        stats.exactors.has(p.user_id) &&
        stats.exactors.size <= Math.ceil(stats.total * 0.1)

      const pts = p.is_joker ? (res.base + (nadir ? 2 : 0)) * 2 : res.base + (nadir ? 2 : 0)

      u.total += pts
      if (nadir)                                          u.nadir_count++
      if (res.category === 'tam_isabet')                  u.tam_isabet++
      if (res.category === 'kil_payi' || res.category === 'strategist') u.kil_payi_strategist++
      if (res.category === 'bilge')                       u.bilge++
      if (res.category === 'teselli')                     u.teselli++
      u.details.push({ match, pred: p, pts, nadir, category: res.category })
    })

    const sorted = Object.values(map).sort((a, b) => {
      if (b.total !== a.total)                       return b.total - a.total
      if (b.nadir_count !== a.nadir_count)           return b.nadir_count - a.nadir_count
      if (b.tam_isabet !== a.tam_isabet)             return b.tam_isabet - a.tam_isabet
      if (b.kil_payi_strategist !== a.kil_payi_strategist) return b.kil_payi_strategist - a.kil_payi_strategist
      if (b.bilge !== a.bilge)                       return b.bilge - a.bilge
      if (b.teselli !== a.teselli)                   return b.teselli - a.teselli
      if (b.pred_count !== a.pred_count)             return b.pred_count - a.pred_count
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
      <div style={s.hRow}>
        <span style={{ ...s.hLabel, flex: 1 }}>OYUNCU</span>
        <span style={{ ...s.hLabel, width: 64, textAlign: 'center' }}>TAHMİN</span>
        <span style={{ ...s.hLabel, width: 56, textAlign: 'right' }}>PUAN</span>
      </div>

      {board.length === 0 && <p style={s.empty}>Henüz tamamlanmış maç yok.</p>}

      {pageRows.map((row, i) => {
        const rank  = (page - 1) * BOARD_ITEMS + i
        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null
        const isMe  = row.uid === currentUserId
        const diff  = row.total - row.standard_total
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
            <div style={s.pts}>
              <span style={s.ptsNum}>{row.total}</span>
              {diff !== 0 && (
                <span style={{ ...s.diff, color: diff > 0 ? '#4ade80' : '#f87171' }}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              )}
            </div>
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

      <DenemeScoringLegend />

      {profileRow && <DenemeProfileModal row={profileRow} onClose={() => setProfileRow(null)} />}
    </div>
  )
}

// ── SCORING LEGEND ─────────────────────────────────────────────
function DenemeScoringLegend() {
  return (
    <div style={sl.card}>
      <div style={sl.title}>🧪 DENEME PUAN SİSTEMİ</div>
      <div style={sl.grid}>
        {[
          { tag: 'TAM İSABET 🔥',    l: 'Maç sonucu ve skor tam doğru',                              v: '8 Puan',  hl: true  },
          { tag: 'KIL PAYI 🎯',       l: 'Maç sonucu ve bir takımın gol sayısı doğru',               v: '4 Puan'            },
          { tag: 'STRATEJİST ↔️',    l: 'Maç sonucu ve gol farkı doğru',                            v: '4 Puan'            },
          { tag: 'BİLGE 🔮',          l: 'Sadece maç sonucu doğru',                                  v: '2 Puan'            },
          { tag: 'TESELLİ ⚽',        l: 'Sonuç yanlış ama bir takımın gol sayısı doğru',            v: '1 Puan'            },
          { tag: 'NADİR İSABET ⚡',   l: 'Doğru skoru ligdeki tahminlerin en fazla %10\'u bildiyse', v: '+2 Bonus', nadir: true },
          { tag: 'KAPLAMA 🃏',        l: 'Joker hakkı kazanılan puanı ikiye katlar',                 v: 'Maks ×2',  joker: true },
        ].map((item, i) => (
          <div key={i} style={{ ...sl.row, ...(item.hl ? sl.rowHL : {}), ...(item.nadir ? sl.rowNadir : {}), ...(item.joker ? sl.rowJoker : {}) }}>
            <div style={sl.rowLeft}>
              <span style={{ ...sl.tag, ...(item.hl ? { color: '#fbbf24' } : {}), ...(item.nadir ? { color: '#a78bfa' } : {}), ...(item.joker ? { color: '#f87171' } : {}) }}>{item.tag}</span>
              <span style={sl.desc}>{item.l}</span>
            </div>
            <span style={{ ...sl.badge, ...(item.hl ? sl.badgeHL : {}), ...(item.nadir ? sl.badgeNadir : {}), ...(item.joker ? sl.badgeJoker : {}) }}>{item.v}</span>
          </div>
        ))}
      </div>
      <div style={{ ...sl.title, marginTop: 24 }}>⚖️ EŞİTLİK BOZMA KRİTERLERİ</div>
      <div style={sl.kravaj}>
        {[
          { n: '1', text: 'NADİR İSABET Sayısı',          sub: 'fazla → önce' },
          { n: '2', text: 'TAM İSABET Sayısı',            sub: 'fazla → önce' },
          { n: '3', text: 'KIL PAYI + STRATEJİST Sayısı', sub: 'fazla → önce' },
          { n: '4', text: 'BİLGE Sayısı',                 sub: 'fazla → önce' },
          { n: '5', text: 'TESELLİ Sayısı',               sub: 'fazla → önce' },
          { n: '6', text: 'Tahmin Yapılan Maç Sayısı',    sub: 'fazla → önce' },
        ].map(item => (
          <div key={item.n} style={sl.kRow}>
            <div style={sl.kNum}>{item.n}</div>
            <div><div style={sl.kText}>{item.text}</div><div style={sl.kSub}>({item.sub})</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PROFIL MODAL ───────────────────────────────────────────────
function DenemeProfileModal({ row, onClose }) {
  const [predPage, setPredPage] = useState(0)

  const sorted = [...row.details].sort((a, b) =>
    new Date(b.match.match_datetime || '2000') - new Date(a.match.match_datetime || '2000')
  )
  const totalPredPages = Math.ceil(sorted.length / PRED_ITEMS)
  const pageItems      = sorted.slice(predPage * PRED_ITEMS, (predPage + 1) * PRED_ITEMS)
  const diff           = row.total - row.standard_total

  return (
    <div style={pm.overlay}>
      <div style={pm.box}>
        <div style={pm.top}>
          <span style={pm.username}>👤 {row.username}</span>
          <button style={pm.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={pm.totalBox}>
          <span style={pm.totalNum}>{row.total}</span>
          <span style={pm.totalLbl}>
            deneme puanı
            {diff !== 0 && (
              <span style={{ marginLeft: 8, color: diff > 0 ? '#4ade80' : '#f87171', fontWeight: 700, letterSpacing: 0 }}>
                ({diff > 0 ? '+' : ''}{diff} standart'tan)
              </span>
            )}
          </span>
        </div>

        <div style={pm.statsGrid}>
          {[
            { label: '⚡ NADİR İSABET Sayısı',          val: `${row.nadir_count} maç`,               nadir: true },
            { label: '🔥 TAM İSABET Sayısı',             val: `${row.tam_isabet} maç`,               gold: true  },
            { label: '🎯 KIL PAYI + STRATEJİST Sayısı', val: `${row.kil_payi_strategist} maç`                   },
            { label: '🔮 BİLGE Sayısı',                  val: `${row.bilge} maç`                                 },
            { label: '⚽ TESELLİ Sayısı',                val: `${row.teselli} maç`                               },
            { label: '📋 Tahmin Yapılan Maç',            val: row.pred_count                                     },
            { label: '🃏 Joker Kullanımı',               val: `${row.joker_count}×`                              },
          ].map(({ label, val, gold, nadir }) => (
            <div key={label} style={pm.sRow}>
              <span style={pm.sLabel}>{label}</span>
              <span style={{ ...pm.sVal, ...(gold ? { color: 'var(--gold)' } : {}), ...(nadir ? { color: '#a78bfa' } : {}) }}>{val}</span>
            </div>
          ))}
        </div>

        {sorted.length > 0 && (
          <>
            <div style={pm.matchHead}>Tahminler ({sorted.length} maç)</div>
            {pageItems.map(({ match, pred, pts, nadir, category }) => {
              const bg = pts >= 10 ? '#f5c518' : pts >= 4 ? '#16a34a' : pts > 0 ? '#2563eb' : '#374151'
              const catTag = category === 'tam_isabet' ? '🔥 ' : category === 'kil_payi' ? '🎯 ' :
                             category === 'strategist' ? '↔️ ' : category === 'bilge' ? '🔮 ' :
                             category === 'teselli' ? '⚽ ' : ''
              return (
                <div key={match.id} style={pm.mRow}>
                  <div style={pm.mLeft}>
                    <span style={pm.mTeams}>{match.home_team} – {match.away_team}</span>
                    <span style={pm.mScore}>
                      {match.actual_home}:{match.actual_away}
                      {nadir && <span style={{ color: '#a78bfa', marginLeft: 4 }}>⚡ NADİR İSABET</span>}
                    </span>
                  </div>
                  <div style={pm.mRight}>
                    {pred.is_joker && <span style={pm.jokerTag}>🃏</span>}
                    <span style={pm.mPred}>{pred.pred_home}–{pred.pred_away}</span>
                    <span style={{ ...pm.mPts, background: bg, color: pts >= 10 ? '#000' : '#fff' }}>
                      {catTag}{pts > 0 ? '+' : ''}{pts}
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
  wrap:          { padding: '12px 14px', paddingBottom: 60 },
  center:        { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, gap: 12 },
  spinner:       { width: 28, height: 28, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
  loadTxt:       { color: '#6b7280', fontSize: 14, margin: 0 },
  empty:         { color: '#6b7280', textAlign: 'center', padding: 32, fontSize: 14, margin: 0 },
  hRow:          { display: 'flex', alignItems: 'center', paddingInline: 14, marginBottom: 8, gap: 8 },
  hLabel:        { fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase' },
  row:           { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 6, cursor: 'pointer' },
  rowMe:         { background: 'rgba(225,29,72,.1)', border: '1px solid rgba(225,29,72,.25)' },
  rank:          { width: 28, fontSize: 20, textAlign: 'center', flexShrink: 0 },
  rankNum:       { fontFamily: 'var(--font-display)', fontSize: 16, color: '#6b7280', letterSpacing: 1 },
  name:          { flex: 1, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' },
  youBadge:      { fontSize: 10, background: 'rgba(225,29,72,.3)', color: '#fca5a5', padding: '2px 6px', borderRadius: 20, fontWeight: 700, flexShrink: 0 },
  jokerBadge:    { fontSize: 11, color: '#f5c518', flexShrink: 0 },
  predCountBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 },
  predCountNum:  { fontFamily: 'var(--font-display)', fontSize: 18, color: '#9ca3af', letterSpacing: 1, lineHeight: 1 },
  predCountLabel:{ fontSize: 9, color: '#4b5563', letterSpacing: 1, textTransform: 'uppercase' },
  pts:           { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 52, flexShrink: 0 },
  ptsNum:        { fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--gold)', letterSpacing: 1, lineHeight: 1 },
  diff:          { fontSize: 9, fontWeight: 700, letterSpacing: .5 },
  chev:          { fontSize: 18, color: '#6b7280', flexShrink: 0 },
  pgWrap:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '8px 12px', margin: '14px 0' },
  pgArrow:       { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px' },
  pgNums:        { display: 'flex', gap: 6, alignItems: 'center' },
  pgBtn:         { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, width: 32, height: 32, color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pgBtnActive:   { background: '#fbbf24', color: '#0f172a' },
}

const pm = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 14px', overflowY: 'auto' },
  box:       { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  top:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.07)' },
  username:  { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1, color: 'var(--text)' },
  closeBtn:  { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 13, cursor: 'pointer' },
  totalBox:  { textAlign: 'center', marginBottom: 16 },
  totalNum:  { fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--gold)', letterSpacing: 2, display: 'block' },
  totalLbl:  { fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', display: 'block' },
  statsGrid: { background: 'rgba(0,0,0,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 },
  sRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBlock: 8, borderBottom: '1px solid rgba(255,255,255,.04)' },
  sLabel:    { fontSize: 13, color: '#94a3b8' },
  sVal:      { fontSize: 13, color: '#f1f5f9', fontWeight: 700 },
  matchHead: { fontSize: 11, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 10 },
  mRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' },
  mLeft:     { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, paddingRight: 8 },
  mTeams:    { fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mScore:    { fontSize: 11, color: 'var(--muted)' },
  mRight:    { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  jokerTag:  { fontSize: 13 },
  mPred:     { fontSize: 13, color: '#94a3b8', fontWeight: 600 },
  mPts:      { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
  pgWrap:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.07)' },
  pgBtn:     { background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  pgInfo:    { fontSize: 12, color: 'var(--muted)' },
}

const sl = {
  card:      { marginTop: 24, padding: '20px 16px', background: 'rgba(15,23,42,.45)', border: '1px solid rgba(51,65,85,.5)', borderRadius: 16, backdropFilter: 'blur(8px)' },
  title:     { fontSize: 13, letterSpacing: 2, color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', marginBottom: 14 },
  grid:      { display: 'flex', flexDirection: 'column', gap: 10 },
  row:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(30,41,59,.25)', border: '1px solid rgba(255,255,255,.02)', borderRadius: 12 },
  rowHL:     { background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' },
  rowNadir:  { background: 'rgba(167,139,250,.07)', border: '1px solid rgba(167,139,250,.25)' },
  rowJoker:  { background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' },
  rowLeft:   { display: 'flex', flexDirection: 'column', gap: 3, flex: 1, paddingRight: 12 },
  tag:       { fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: .5 },
  desc:      { fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 },
  badge:     { fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: 'rgba(71,85,105,.4)', color: '#94a3b8', whiteSpace: 'nowrap' },
  badgeHL:   { background: '#f5c518', color: '#0f172a' },
  badgeNadir:{ background: '#7c3aed', color: '#fff' },
  badgeJoker:{ background: '#ef4444', color: '#fff' },
  kravaj:    { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  kRow:      { display: 'flex', alignItems: 'flex-start', gap: 12 },
  kNum:      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'rgba(245,197,24,.15)', border: '1px solid rgba(245,197,24,.3)', color: '#f5c518', borderRadius: '50%', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 },
  kText:     { fontSize: 13, color: '#e2e8f0', fontWeight: 500 },
  kSub:      { fontSize: 11, color: '#64748b' },
}
