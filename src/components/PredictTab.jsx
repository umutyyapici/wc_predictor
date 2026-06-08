import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcPoints, getResultChar, isBettingOpen, todayTR } from '../lib/scoring.js'

function dateKey(dt) {
  if (!dt) return '9999-12-31'
  return new Date(dt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
}

function fmtDay(dk) {
  return new Date(dk + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short', day: 'numeric', month: 'long'
  })
}

// Bir ay için takvim grid'i oluştur
function buildCalendar(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7 // Pazartesi = 0
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(d)
  return days
}

export default function PredictTab({ matches, myPreds, userId, onPredSaved }) {
  const [edits, setEdits]           = useState({})
  const [saving, setSaving]         = useState(null)
  const [toast, setToast]           = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [othersData, setOthersData] = useState({})
  const [loadingOthers, setLoadingOthers] = useState(null)
  const [showCal, setShowCal]       = useState(false)

  // ── Tarih Navigasyonu (GÜN GÜN AKIŞ DÜZENLEMESİ) ────────────────
  const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
  
  // Turnuva takvimini 11 Haziran - 19 Temmuz arasında zorunlu olarak gün gün dolduruyoruz
  const allDates = []
  let startDate = new Date('2026-06-11T12:00:00')
  const endDate = new Date('2026-07-19T12:00:00')

  while (startDate <= endDate) {
    const k = startDate.toISOString().split('T')[0]
    allDates.push(k)
    startDate.setDate(startDate.getDate() + 1)
  }
  
  const todayIdx  = allDates.findIndex(d => d >= todayKey)
  const maxIdx    = allDates.length - 1
  const [dateIdx, setDateIdx] = useState(todayIdx === -1 ? 0 : todayIdx)

  const curDate    = allDates[dateIdx] || '2026-06-11'
  const dayMatches = matches.filter(m => dateKey(m.match_datetime || m.match_date) === curDate)

  // Takvim odağı turnuva başlangıcı olan Haziran 2026
  const [calYear,  setCalYear]  = useState(2026)
  const [calMonth, setCalMonth] = useState(5) // 5 = Haziran

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2800)
  }

  // ── Joker Kontrolleri ─────────────────────────────────────────
  const getJokerMidForDay = (dayTR) => {
    const fromEdit = Object.entries(edits).find(([mid, e]) => {
      if (!e.is_joker) return false
      const m = matches.find(x => x.id === parseInt(mid))
      if (!m?.match_datetime) return false
      return new Date(m.match_datetime).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === dayTR
    })?.[0]
    if (fromEdit !== undefined) return fromEdit

    return Object.entries(myPreds).find(([mid, p]) => {
      if (!p.is_joker) return false
      const m = matches.find(x => x.id === parseInt(mid))
      if (!m?.match_datetime) return false
      return new Date(m.match_datetime).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === dayTR
    })?.[0] || null
  }

  const canUseJoker = (matchId) => {
    const mid = String(matchId)
    const m   = matches.find(x => x.id === matchId)
    if (!m || m.locked) return false
    if (!isBettingOpen(m.match_datetime)) return false
    if (!m.match_datetime) return false
    const mDayTR = new Date(m.match_datetime).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
    const activeJoker = getJokerMidForDay(mDayTR)
    if (activeJoker && activeJoker !== mid) return false
    return true
  }

  const setEdit = (mid, field, val) => {
    if (field === 'is_joker') {
      if (val && !canUseJoker(mid)) return
      setEdits(e => ({ ...e, [mid]: { ...(e[mid] || {}), is_joker: val } }))
      return
    }
    if (!/^\d*$/.test(val) || parseInt(val) > 30) return
    setEdits(e => ({ ...e, [mid]: { ...(e[mid] || {}), [field]: val } }))
  }

  const handleSave = async (match) => {
    const e    = edits[match.id] || {}
    const prev = myPreds[match.id]
    const home = e.home !== undefined ? e.home : (prev?.pred_home ?? '')
    const away = e.away !== undefined ? e.away : (prev?.pred_away ?? '')
    if (home === '' || away === '') { showToast('İki skoru da gir!', 'err'); return }
    if (!isBettingOpen(match.match_datetime)) { showToast('Bahis süresi doldu!', 'err'); return }
    const is_joker = e.is_joker !== undefined ? e.is_joker : (prev?.is_joker ?? false)
    
    setSaving(match.id)
    const { error } = await supabase
      .from('predictions')
      .upsert({ user_id: userId, match_id: match.id, pred_home: parseInt(home), pred_away: parseInt(away), is_joker }, { onConflict: 'user_id,match_id' })
    setSaving(null)
    
    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast(is_joker ? 'Kaydedildi ✓ 🃏 Joker aktif!' : 'Kaydedildi ✓')
    setEdits(e => { const n = { ...e }; delete n[match.id]; return n })
    onPredSaved()
  }

  const showOthers = (match) => match.locked || !isBettingOpen(match.match_datetime)

  const toggleOthers = async (matchId) => {
    if (expanded === matchId) { setExpanded(null); return }
    setExpanded(matchId)
    if (othersData[matchId]) return
    setLoadingOthers(matchId)
    const { data } = await supabase
      .from('predictions')
      .select('pred_home, pred_away, is_joker, profiles(username)')
      .eq('match_id', matchId)
      .neq('user_id', userId)
    setOthersData(d => ({ ...d, [matchId]: data || [] }))
    setLoadingOthers(null)
  }

  const calDays    = buildCalendar(calYear, calMonth)
  const matchDays  = new Set(allDates.map(d => d))
  const DOW_LABELS = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz']
  const MONTHS_TR  = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  const handleCalDay = (d) => {
    if (!d) return
    const dk = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const idx = allDates.indexOf(dk)
    if (idx === -1) return
    setDateIdx(idx)
    setShowCal(false)
  }

  const curDayTR  = new Date(curDate + 'T12:00:00').toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const jokerMid  = getJokerMidForDay(curDayTR)
  const jokerUsed = !!jokerMid

  return (
    <div style={s.wrap}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Tarih Navigasyonu */}
      <div style={s.dateNav}>
        <button style={{ ...s.arrow, opacity: dateIdx === 0 ? .3 : 1 }}
          onClick={() => setDateIdx(i => Math.max(0, i - 1))} disabled={dateIdx === 0}>‹</button>

        <button style={s.dateBtn} onClick={() => { setShowCal(v => !v); setCalYear(new Date(curDate+'T12:00:00').getFullYear()); setCalMonth(new Date(curDate+'T12:00:00').getMonth()); }}>
          <div style={s.dateMain}>{fmtDay(curDate)}</div>
          {curDate === todayKey && <div style={s.todayLabel}>BUGÜN</div>}
        </button>

        <button style={{ ...s.arrow, opacity: dateIdx === maxIdx ? .3 : 1 }}
          onClick={() => setDateIdx(i => Math.min(maxIdx, i + 1))} disabled={dateIdx === maxIdx}>›</button>
      </div>

      {/* Mini Takvim */}
      {showCal && (
        <div style={s.calBox}>
          <div style={s.calHeader}>
            <button style={s.calArrow} onClick={() => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }}>‹</button>
            <span style={s.calMonthLabel}>{MONTHS_TR[calMonth]} {calYear}</span>
            <button style={s.calArrow} onClick={() => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0) } else setCalMonth(m=>m+1) }}>›</button>
          </div>
          <div style={s.calGrid}>
            {DOW_LABELS.map(d => <div key={d} style={s.calDow}>{d}</div>)}
            {calDays.map((d, i) => {
              if (!d) return <div key={'e'+i} />
              const dk = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              const hasMatch = matchDays.has(dk)
              const isActive = dk === curDate
              const isTodayCal = dk === todayKey
              return (
                <button key={dk} style={{
                  ...s.calDay,
                  ...(hasMatch ? s.calDayMatch : {}),
                  ...(isActive ? s.calDayActive : {}),
                  ...(!hasMatch ? { opacity: .3, cursor: 'default' } : {}),
                  ...(isTodayCal && !isActive ? { color: '#f5c518', fontWeight: 700 } : {}),
                }} onClick={() => handleCalDay(d)} disabled={!hasMatch}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}

	{/* Joker Banner */}
	<div style={s.jokerBanner}>
	 <span>🃏 Joker: </span>
  	 <span style={{ fontWeight: 700, color: jokerUsed ? '#f87171' : '#4ade80' }}>
    	   {jokerUsed ? 'Kullanıldı' : 'Kullanılmadı'}
 	 </span>
 	 <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 'auto' }}>Günde 1 maça ×2</span>
	</div>

      {/* Maç Kartları Listesi */}
      {dayMatches.map(match => {
        const prev     = myPreds[match.id]
        const ed       = edits[match.id] || {}
        const hVal     = ed.home !== undefined ? ed.home : (prev?.pred_home ?? '')
        const aVal     = ed.away !== undefined ? ed.away : (prev?.pred_away ?? '')
        const joker    = ed.is_joker !== undefined ? ed.is_joker : (prev?.is_joker ?? false)
        const isDirty  = Object.keys(ed).length > 0
        const open     = isBettingOpen(match.match_datetime)
        const isLocked = match.locked || !open
        const cutoff   = match.match_datetime ? new Date(new Date(match.match_datetime).getTime() - 3600000) : null
        const pts      = match.locked && prev
          ? calcPoints(prev.pred_home, prev.pred_away, match.actual_home, match.actual_away, prev.is_joker)
          : null
        const jokerOk   = canUseJoker(match.id)
        const isExpanded = expanded === match.id
        const others     = othersData[match.id] || []
        const canSeeOthers = showOthers(match)

        return (
          <div key={match.id} style={{
            ...s.card,
            ...(joker && !match.locked ? { border: '1px solid rgba(245,197,24,.4)', background: 'rgba(245,197,24,.04)' } : {}),
            ...(joker && match.locked  ? { border: '1px solid rgba(245,197,24,.25)' } : {}),
            ...(isLocked && !match.locked ? { opacity: .75 } : {}),
          }}>
            <div style={s.cardTop}>
              <span style={s.timeStr}>
                {match.match_datetime
                  ? new Date(match.match_datetime).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }) + ' (TR)'
                  : ''}
                {match.round && <span style={s.roundPill}>{match.round}</span>}
              </span>
              <div style={s.badges}>
                {match.locked && <span style={s.badge}>🔒 Kilitli</span>}
                {!match.locked && open && cutoff && <span style={{ ...s.badge, color: '#fbbf24', background: 'rgba(251,191,36,.1)' }}>⏰ {cutoff.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} (TR)'a kadar</span>}
                {!match.locked && !open && <span style={s.badge}>⏰ Süre doldu</span>}
                {prev && !isDirty && !isLocked && <span style={{ ...s.badge, color: '#4ade80', background: 'rgba(22,163,74,.15)' }}>✓</span>}
                {joker && <span style={{ ...s.badge, color: '#f5c518', background: 'rgba(245,197,24,.15)', fontWeight: 700 }}>🃏 ×2</span>}
              </div>
            </div>

            {/* BAYRAKSIZ SAF METİN TASARIMI */}
            <div style={s.matchRow}>
              <div style={s.team}>
                <span style={s.teamName}>{match.home_team}</span>
              </div>
              <div style={s.center}>
                {match.locked ? (
                  <div style={s.actualRow}>
                    <span style={s.bigNum}>{match.actual_home}</span>
                    <span style={s.dash}>–</span>
                    <span style={s.bigNum}>{match.actual_away}</span>
                  </div>
                ) : (
                  <div style={s.inputRow}>
                    <input style={s.scoreInput} value={hVal} onChange={e => setEdit(match.id, 'home', e.target.value)} disabled={isLocked} maxLength={2} placeholder="?" />
                    <span style={s.colon}>:</span>
                    <input style={s.scoreInput} value={aVal} onChange={e => setEdit(match.id, 'away', e.target.value)} disabled={isLocked} maxLength={2} placeholder="?" />
                  </div>
                )}
                {match.locked && <div style={s.resultChar}>{getResultChar(match.actual_home, match.actual_away)}</div>}
              </div>
              <div style={{ ...s.team, alignItems: 'flex-end' }}>
                <span style={{ ...s.teamName, textAlign: 'right' }}>{match.away_team}</span>
              </div>
            </div>

            {!isLocked && (jokerOk || joker) && (
              <button style={{ ...s.jokerToggle, ...(joker ? s.jokerOn : {}) }} onClick={() => setEdit(match.id, 'is_joker', !joker)}>
                🃏 {joker ? 'Joker Aktif — Kaldır' : 'Joker Kullan (×2 puan)'}
              </button>
            )}

            {match.locked && prev && (
              <div style={s.predRow}>
                <span style={s.predText}>
                  Tahminin: <b style={{ color: '#93c5fd' }}>{prev.pred_home}–{prev.pred_away}</b>
                  <span style={{ color: '#9ca3af' }}> ({getResultChar(prev.pred_home, prev.pred_away)})</span>
                  {prev.is_joker && <span style={{ color: '#f5c518' }}> 🃏</span>}
                </span>
                {pts !== null && <PtsBadge pts={pts} />}
              </div>
            )}
            {match.locked && !prev && <div style={s.noPred}>Bu maç için tahmin yapılmadı</div>}

            {/* Diğer Tahminler */}
            {canSeeOthers && (
              <div style={{ marginTop: 10 }}>
                <button style={s.othersBtn} onClick={() => toggleOthers(match.id)}>
                  👥 Diğer Tahminler {isExpanded ? '▲' : '▼'}
                </button>
                {isExpanded && (
                  <div style={s.othersPanel}>
                    {loadingOthers === match.id ? (
                      <div style={s.othersLoading}><span style={s.spinner} /> Yükleniyor...</div>
                    ) : others.length === 0 ? (
                      <div style={s.othersEmpty}>Başka tahmin yok.</div>
                    ) : (
                      <>
                        <div style={s.othersHeader}><span>Oyuncu</span><span>Tahmin</span><span>Puan</span></div>
                        {others.map((o, i) => {
                          const oPts = match.locked
                            ? calcPoints(o.pred_home, o.pred_away, match.actual_home, match.actual_away, o.is_joker)
                            : null
                          return (
                            <div key={i} style={s.otherRow}>
                              <span style={s.otherName}>
                                {o.profiles?.username || 'Anonim'}
                                {o.is_joker && <span style={{ color: '#f5c518', marginLeft: 4 }}>🃏</span>}
                              </span>
                              <span style={s.otherPred}>
                                {o.pred_home}–{o.pred_away}
                                <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>({getResultChar(o.pred_home, o.pred_away)})</span>
                              </span>
                              {oPts !== null ? <PtsBadge pts={oPts} small /> : <span style={{ fontSize: 11, color: '#6b7280' }}>—</span>}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isLocked && (
              <button style={{ ...s.saveBtn, background: isDirty ? '#e11d48' : 'rgba(255,255,255,.06)', opacity: saving === match.id ? .6 : 1 }}
                onClick={() => handleSave(match)} disabled={saving === match.id}>
                {saving === match.id ? '⏳ Kaydediliyor...' : isDirty ? '💾 Kaydet' : prev ? '✏️ Düzenle' : '+ Tahmin Ekle'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PtsBadge({ pts, small }) {
  const bg = pts >= 6 ? '#f5c518' : pts >= 2 ? '#16a34a' : pts > 0 ? '#2563eb' : '#374151'
  return <span style={{ background: bg, color: pts >= 6 ? '#000' : '#fff', fontSize: small ? 11 : 12, fontWeight: 700, padding: small ? '2px 7px' : '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>{pts >= 6 ? '🔥 ' : ''}{pts > 0 ? '+' : ''}{pts}</span>
}

function Toast({ msg, type }) {
  return <div style={{ position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', background: type === 'err' ? '#e11d48' : '#15803d', color: '#fff', padding: '10px 20px', borderRadius: 20, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 24px rgba(0,0,0,.6)', whiteSpace: 'nowrap' }}>{msg}</div>
}

const s = {
  wrap:         { padding: '12px 14px', paddingBottom: 40 },
  dateNav:      { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '8px', marginBottom: 10 },
  arrow:        { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 24, color: '#f0f2f8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dateBtn:      { flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '2px 0' },
  dateMain:     { fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 2, color: '#f0f2f8', textTransform: 'uppercase' },
  todayLabel:   { fontSize: 9, letterSpacing: 3, color: '#f5c518', fontWeight: 700, marginTop: 1 },
  calBox:       { background: 'var(--bg2)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: '12px', marginBottom: 10 },
  calHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calArrow:     { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 18, color: '#f0f2f8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  calMonthLabel:{ fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: 2, color: '#f0f2f8' },
  calGrid:      { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 },
  calDow:       { textAlign: 'center', fontSize: 10, color: '#6b7280', padding: '4px 0', fontWeight: 600 },
  calDay:       { textAlign: 'center', fontSize: 12, color: '#4b5563', padding: '6px 2px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'default' },
  calDayMatch:  { color: '#f0f2f8', cursor: 'pointer', background: 'rgba(255,255,255,.06)' },
  calDayActive: { background: '#e11d48', color: '#fff', fontWeight: 700 },
  jokerBanner:  { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'rgba(245,197,24,.07)', border: '1px solid rgba(245,197,24,.18)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13 },
  empty:        { color: '#6b7280', textAlign: 'center', padding: '32px 0', fontSize: 14 },
  card:         { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 4 },
  timeStr:      { fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 },
  roundPill:    { background: 'rgba(255,255,255,.07)', borderRadius: 20, padding: '1px 7px', fontSize: 10, color: '#9ca3af' },
  badges:       { display: 'flex', gap: 5, flexWrap: 'wrap' },
  badge:        { fontSize: 10, color: '#9ca3af', background: 'rgba(255,255,255,.06)', padding: '2px 7px', borderRadius: 20 },
  matchRow:     { display: 'flex', alignItems: 'center', gap: 8 },
  team:         { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  teamName:     { fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 },
  center:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 100 },
  actualRow:    { display: 'flex', alignItems: 'center', gap: 6 },
  bigNum:       { fontFamily: 'var(--font-display)', fontSize: 34, color: 'var(--text)', lineHeight: 1 },
  dash:         { fontFamily: 'var(--font-display)', fontSize: 24, color: '#374151' },
  inputRow:     { display: 'flex', alignItems: 'center', gap: 6 },
  scoreInput:   { width: 44, height: 44, textAlign: 'center', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, color: 'var(--text)', fontSize: 20, fontWeight: 700, outline: 'none' },
  colon:        { fontFamily: 'var(--font-display)', fontSize: 22, color: '#374151' },
  resultChar:   { fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 3, color: 'var(--gold)', textAlign: 'center' },
  jokerToggle:  { width: '100%', marginTop: 10, background: 'rgba(245,197,24,.07)', border: '1px solid rgba(245,197,24,.2)', borderRadius: 8, padding: '8px 0', color: '#b8960a', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  jokerOn:      { background: 'rgba(245,197,24,.2)', border: '1px solid rgba(245,197,24,.5)', color: '#f5c518' },
  predRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' },
  predText:     { fontSize: 13, color: '#6b7280' },
  noPred:       { fontSize: 12, color: '#4b5563', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  othersBtn:    { width: '100%', marginTop: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '8px 12px', color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' },
  othersPanel:  { marginTop: 6, background: 'rgba(0,0,0,.35)', borderRadius: 10, padding: '10px 12px' },
  othersLoading:{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 },
  othersEmpty:  { color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '8px 0' },
  othersHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,.06)' },
  otherRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  otherName:    { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  otherPred:    { fontSize: 13, color: '#93c5fd', fontWeight: 700 },
  spinner:      { width: 14, height: 14, border: '2px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
  saveBtn:      { width: '100%', marginTop: 12, border: 'none', borderRadius: 10, padding: '11px 0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}