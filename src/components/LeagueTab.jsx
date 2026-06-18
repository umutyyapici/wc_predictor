import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcPoints } from '../lib/scoring.js'

export default function LeagueTab({ matches, currentUserId, groups, groupCutoffs, onGroupChange, onGroupJoined }) {
  const [view, setView]                 = useState('list')
  const [activeLeague, setActiveLeague] = useState(null)
  const [board, setBoard]               = useState([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [profileRow, setProfileRow]     = useState(null)
  const [newCode, setNewCode]           = useState('')
  const [addErr, setAddErr]             = useState('')
  const [addLoading, setAddLoading]     = useState(false)
  const [page, setPage]                 = useState(1)
  const ITEMS = 10

  useEffect(() => {
    if (view === 'detail' && activeLeague) loadBoard(activeLeague)
  }, [view, activeLeague, matches?.length])

  const goToLeague = (code) => {
    setActiveLeague(code)
    setProfileRow(null)
    setPage(1)
    setView('detail')
    onGroupChange(code)
  }

  const loadBoard = async (code) => {
    setBoardLoading(true)
    const cutoff = groupCutoffs[code]

    const { data: members } = await supabase
      .from('user_groups')
      .select('user_id, profiles(username)')
      .eq('invite_code', code)

    if (!members?.length) { setBoardLoading(false); setBoard([]); return }

    const ids   = members.map(m => m.user_id)
    const names = {}
    members.forEach(m => { names[m.user_id] = m.profiles?.username || 'Anonim' })

    const lockedIds = matches
      .filter(m => m.locked)
      .filter(m => !cutoff || !m.match_datetime || new Date(m.match_datetime) >= new Date(cutoff))
      .map(m => m.id)

    const map = {}
    ids.forEach(uid => {
      map[uid] = { uid, username: names[uid] || 'Anonim', total: 0, pred_count: 0,
        tam_isabet: 0, kil_payi: 0, strategist: 0, bilge: 0, teselli: 0, joker_count: 0, details: [] }
    })

    if (lockedIds.length) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, match_id, pred_home, pred_away, is_joker')
        .in('user_id', ids)
        .in('match_id', lockedIds)

      ;(preds || []).forEach(p => {
        const u = map[p.user_id]
        if (!u) return
        u.pred_count++
        const match = matches.find(m => m.id === p.match_id)
        if (!match?.locked) return
        const pts = calcPoints(p.pred_home, p.pred_away, match.actual_home, match.actual_away, p.is_joker)
        if (pts === null) return
        u.total += pts
        if (p.is_joker) u.joker_count++
        const pH = +p.pred_home, pA = +p.pred_away, aH = +match.actual_home, aA = +match.actual_away
        const rOk = (pH > pA ? '1' : pH < pA ? '2' : 'X') === (aH > aA ? '1' : aH < aA ? '2' : 'X')
        if (rOk && pH === aH && pA === aA)          u.tam_isabet++
        else if (rOk && (pH === aH || pA === aA))   u.kil_payi++
        else if (rOk && (pH - pA) === (aH - aA))   u.strategist++
        else if (rOk)                               u.bilge++
        else if (!rOk && (pH === aH || pA === aA))  u.teselli++
        u.details.push({ match, pred: p, pts })
      })
    }

    const sorted = Object.values(map).sort((a, b) => {
      for (const k of ['total','tam_isabet','kil_payi','strategist','bilge','teselli','pred_count'])
        if (b[k] !== a[k]) return b[k] - a[k]
      return a.username.localeCompare(b.username, 'tr')
    })
    setBoard(sorted)
    setBoardLoading(false)
  }

  const handleJoin = async () => {
    setAddErr('')
    const clean = newCode.toLowerCase().trim()
    if (!clean) { setAddErr('Kod boş olamaz.'); return }
    if (groups.includes(clean)) { setAddErr('Bu lige zaten katıldın.'); return }
    setAddLoading(true)
    const { data: valid } = await supabase.from('allowed_groups').select('code').eq('code', clean).maybeSingle()
    if (!valid) { setAddLoading(false); setAddErr('Geçersiz davetiye kodu.'); return }
    const { error } = await supabase.from('user_groups').insert({ user_id: currentUserId, invite_code: clean })
    setAddLoading(false)
    if (error) { setAddErr('Hata: ' + error.message); return }
    setNewCode('')
    onGroupJoined(clean)
  }

  // ── LIST VIEW ──────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={s.wrap}>
        <p style={s.secHead}>Liglerim</p>
        {groups.length === 0 && <p style={s.empty}>Henüz bir lige katılmadın.</p>}
        {groups.map(code => (
          <button key={code} style={s.leagueCard} onClick={() => goToLeague(code)}>
            <span style={s.leagueTrophy}>🏆</span>
            <span style={s.leagueName}>#{code}</span>
            <span style={s.leagueArrow}>›</span>
          </button>
        ))}

        <div style={{ marginTop: 24 }}>
          <p style={s.secHead}>Yeni Lig Ekle</p>
          <div style={s.addRow}>
            <input
              style={s.addInput}
              placeholder="Davetiye kodunu gir..."
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button style={{ ...s.addBtn, opacity: addLoading ? .6 : 1 }} onClick={handleJoin} disabled={addLoading}>
              {addLoading ? '...' : 'Katıl →'}
            </button>
          </div>
          {addErr && <div style={s.addErr}>⚠️ {addErr}</div>}
        </div>

        <ScoringLegend />
      </div>
    )
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────
  const totalPages = Math.ceil(board.length / ITEMS) || 1
  const pageRows   = board.slice((page - 1) * ITEMS, page * ITEMS)

  return (
    <div style={s.wrap}>
      <div style={s.detailTop}>
        <button style={s.backBtn} onClick={() => setView('list')}>← Geri</button>
        <span style={s.detailTitle}>#{activeLeague}</span>
      </div>

      {boardLoading ? (
        <div style={s.center}><span style={s.spinner} /><p style={s.loadTxt}>Yükleniyor...</p></div>
      ) : (
        <>
          <div style={s.hRow}>
            <span style={{ ...s.hLabel, flex: 1 }}>OYUNCU</span>
            <span style={{ ...s.hLabel, width: 64, textAlign: 'center' }}>TAHMİN</span>
            <span style={{ ...s.hLabel, width: 56, textAlign: 'right' }}>PUAN</span>
          </div>

          {board.length === 0 && <p style={s.empty}>Henüz tamamlanmış maç yok.</p>}

          {pageRows.map((row, i) => {
            const rank  = (page - 1) * ITEMS + i
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
                <div style={s.pts}><span style={s.ptsNum}>{row.total}</span></div>
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

          <ScoringLegend />
        </>
      )}

      {profileRow && <ProfileModal row={profileRow} onClose={() => setProfileRow(null)} />}
    </div>
  )
}

// ── PROFILE MODAL ──────────────────────────────────────────────
function ProfileModal({ row, onClose }) {
  const sorted = [...row.details].sort((a, b) =>
    new Date(a.match.match_datetime || '2099') - new Date(b.match.match_datetime || '2099')
  )

  return (
    <div style={pm.overlay}>
      <div style={pm.box}>
        <div style={pm.top}>
          <span style={pm.username}>👤 {row.username}</span>
          <button style={pm.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={pm.totalBox}>
          <span style={pm.totalNum}>{row.total}</span>
          <span style={pm.totalLbl}>puan</span>
        </div>

        <div style={pm.statsGrid}>
          {[
            { label: '📋 Tahmin Yapılan Maç', val: row.pred_count },
            { label: '🔥 TAM İSABET Sayısı',  val: `${row.tam_isabet} maç`, gold: true },
            { label: '🎯 KIL PAYI Sayısı',     val: `${row.kil_payi} maç` },
            { label: '↔️ STRATEJİST Sayısı',  val: `${row.strategist} maç` },
            { label: '🔮 BİLGE Sayısı',        val: `${row.bilge} maç` },
            { label: '⚽ TESELLİ Sayısı',      val: `${row.teselli} maç` },
            { label: '🃏 Joker Kullanımı',     val: `${row.joker_count}×` },
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
            {sorted.map(({ match, pred, pts }) => {
              const bg = pts >= 6 ? '#f5c518' : pts >= 2 ? '#16a34a' : pts > 0 ? '#2563eb' : '#374151'
              return (
                <div key={match.id} style={pm.mRow}>
                  <div style={pm.mLeft}>
                    <span style={pm.mTeams}>{match.home_team} – {match.away_team}</span>
                    <span style={pm.mScore}>{match.actual_home}:{match.actual_away}</span>
                  </div>
                  <div style={pm.mRight}>
                    {pred.is_joker && <span style={pm.jokerTag}>🃏</span>}
                    <span style={pm.mPred}>{pred.pred_home}–{pred.pred_away}</span>
                    <span style={{ ...pm.mPts, background: bg, color: pts >= 6 ? '#000' : '#fff' }}>
                      {pts >= 6 ? '🔥 ' : ''}{pts > 0 ? '+' : ''}{pts}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ── SCORING LEGEND ─────────────────────────────────────────────
function ScoringLegend() {
  return (
    <div style={sl.card}>
      <div style={sl.title}>🏆 PUAN SİSTEMİ</div>
      <div style={sl.grid}>
        {[
          { tag: 'TAM İSABET 🔥', l: 'Maç sonucu (1/0/2) ve maç skoru doğru',                v: '6 Puan',  hl: true },
          { tag: 'KIL PAYI 🎯',   l: 'Maç sonucu (1/0/2) ve bir takımın gol sayısı doğru',  v: '3 Puan' },
          { tag: 'STRATEJİST ↔️', l: 'Maç sonucu (1/0/2) ve gol farkı doğru',              v: '2 Puan' },
          { tag: 'BİLGE 🔮',      l: 'Sadece maç sonucu (1/0/2) doğru',                     v: '1 Puan' },
          { tag: 'TESELLİ ⚽',    l: 'Sonuç yanlış ama bir takımın gol sayısı doğru',       v: '1 Puan' },
          { tag: 'KAPLAMA 🃏',    l: 'Joker hakkı kazanılan puanı ikiye katlar',             v: 'Maks 12', joker: true },
        ].map((item, i) => (
          <div key={i} style={{ ...sl.row, ...(item.hl ? sl.rowHL : {}), ...(item.joker ? sl.rowJoker : {}) }}>
            <div style={sl.rowLeft}>
              <span style={{ ...sl.tag, ...(item.hl ? { color: '#fbbf24' } : {}), ...(item.joker ? { color: '#f87171' } : {}) }}>{item.tag}</span>
              <span style={sl.desc}>{item.l}</span>
            </div>
            <span style={{ ...sl.badge, ...(item.hl ? sl.badgeHL : {}), ...(item.joker ? sl.badgeJoker : {}) }}>{item.v}</span>
          </div>
        ))}
      </div>

      <div style={{ ...sl.title, marginTop: 24 }}>⚖️ EŞİTLİK BOZMA KRİTERLERİ</div>
      <div style={sl.kravaj}>
        {[
          { n: '1', text: 'TAM İSABET Sayısı',          sub: 'fazla → önce' },
          { n: '2', text: 'KIL PAYI Sayısı',            sub: 'fazla → önce' },
          { n: '3', text: 'STRATEJİST Sayısı',          sub: 'fazla → önce' },
          { n: '4', text: 'BİLGE Sayısı',               sub: 'fazla → önce' },
          { n: '5', text: 'TESELLİ Sayısı',             sub: 'fazla → önce' },
          { n: '6', text: 'Tahmin Yapılan Maç Sayısı',  sub: 'fazla → önce' },
        ].map(item => (
          <div key={item.n} style={sl.kRow}>
            <div style={sl.kNum}>{item.n}</div>
            <div>
              <div style={sl.kText}>{item.text}</div>
              <div style={sl.kSub}>({item.sub})</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  wrap:          { padding: '12px 14px', paddingBottom: 60 },
  secHead:       { fontSize: 11, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 10, marginTop: 0 },
  empty:         { color: '#6b7280', textAlign: 'center', padding: 32, fontSize: 14, margin: 0 },
  leagueCard:    { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' },
  leagueTrophy:  { fontSize: 22 },
  leagueName:    { flex: 1, fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: 2, color: 'var(--gold)' },
  leagueArrow:   { fontSize: 20, color: '#6b7280' },
  addRow:        { display: 'flex', gap: 8 },
  addInput:      { flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none' },
  addBtn:        { background: 'linear-gradient(90deg, var(--red), #f97316)', border: 'none', borderRadius: 10, padding: '11px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  addErr:        { background: 'rgba(225,29,72,.15)', border: '1px solid rgba(225,29,72,.3)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 13, marginTop: 8 },
  detailTop:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn:       { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 13, cursor: 'pointer' },
  detailTitle:   { fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 2, color: 'var(--gold)' },
  center:        { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, gap: 12 },
  spinner:       { width: 28, height: 28, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
  loadTxt:       { color: '#6b7280', fontSize: 14, margin: 0 },
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
  pts:           { display: 'flex', alignItems: 'center', width: 44, justifyContent: 'flex-end', flexShrink: 0 },
  ptsNum:        { fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--gold)', letterSpacing: 1 },
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
  totalLbl:  { fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' },
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
}

const sl = {
  card:      { marginTop: 24, padding: '20px 16px', background: 'rgba(15,23,42,.45)', border: '1px solid rgba(51,65,85,.5)', borderRadius: 16, backdropFilter: 'blur(8px)' },
  title:     { fontSize: 13, letterSpacing: 2, color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', marginBottom: 14 },
  grid:      { display: 'flex', flexDirection: 'column', gap: 10 },
  row:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(30,41,59,.25)', border: '1px solid rgba(255,255,255,.02)', borderRadius: 12 },
  rowHL:     { background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' },
  rowJoker:  { background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' },
  rowLeft:   { display: 'flex', flexDirection: 'column', gap: 3, flex: 1, paddingRight: 12 },
  tag:       { fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: .5 },
  desc:      { fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 },
  badge:     { fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: 'rgba(71,85,105,.4)', color: '#94a3b8', whiteSpace: 'nowrap' },
  badgeHL:   { background: '#f5c518', color: '#0f172a' },
  badgeJoker:{ background: '#ef4444', color: '#fff' },
  kravaj:    { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  kRow:      { display: 'flex', alignItems: 'flex-start', gap: 12 },
  kNum:      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'rgba(245,197,24,.15)', border: '1px solid rgba(245,197,24,.3)', color: '#f5c518', borderRadius: '50%', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 },
  kText:     { fontSize: 13, color: '#e2e8f0', fontWeight: 500 },
  kSub:      { fontSize: 11, color: '#64748b' },
}
