import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function AdminPanel({ matches, onClose, onMatchesUpdated }) {
  const [results, setResults]   = useState({})
  const [saving, setSaving]     = useState(null)
  const [toast, setToast]       = useState(null)

  const [newMatch, setNewMatch] = useState({ home_team:'', away_team:'', match_date:'', match_time:'', round:'Grup Aşaması' })
  const [addingMatch, setAddingMatch] = useState(false)

  // Odds section state
  const [oddsData, setOddsData]   = useState({})   // { [matchId]: { h2h_home, h2h_draw, h2h_away, is_manual } }
  const [oddsEdits, setOddsEdits] = useState({})   // { [matchId]: { home, draw, away } }
  const [savingOdds, setSavingOdds] = useState(null)

  useEffect(() => { loadOdds() }, [])

  const loadOdds = async () => {
    const { data } = await supabase.from('match_odds').select('match_id,h2h_home,h2h_draw,h2h_away,is_manual')
    if (data) {
      const m = {}
      data.forEach(o => { m[o.match_id] = o })
      setOddsData(m)
    }
  }

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const setResult = (mid, side, val) => {
    if (!/^\d*$/.test(val)) return
    setResults(r => ({ ...r, [mid]: { ...(r[mid] || {}), [side]: val } }))
  }

  const saveResult = async (match) => {
    const r    = results[match.id] || {}
    const home = r.home !== undefined ? r.home : (match.actual_home ?? '')
    const away = r.away !== undefined ? r.away : (match.actual_away ?? '')
    if (home === '' || away === '') { showToast('Skoru gir!', 'err'); return }

    setSaving(match.id)
    const { error } = await supabase
      .from('matches')
      .update({ actual_home: parseInt(home), actual_away: parseInt(away), locked: true })
      .eq('id', match.id)

    setSaving(null)
    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast(`${match.home_team} – ${match.away_team} sonucu kaydedildi ✓`)
    setResults(r => { const n = { ...r }; delete n[match.id]; return n })
    onMatchesUpdated()
  }

  const addMatch = async () => {
    if (!newMatch.home_team || !newMatch.away_team || !newMatch.match_date || !newMatch.match_time) {
      showToast('Saat dahil tüm alanları doldur!', 'err'); return
    }
    setAddingMatch(true)
    const datetimeISO = new Date(`${newMatch.match_date}T${newMatch.match_time}`).toISOString()
    const { error } = await supabase.from('matches').insert({
      home_team: newMatch.home_team,
      away_team: newMatch.away_team,
      match_date: newMatch.match_date,
      match_datetime: datetimeISO,
      round: newMatch.round,
      locked: false,
    })
    setAddingMatch(false)
    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast('Maç başarıyla eklendi ✓')
    setNewMatch({ home_team:'', away_team:'', match_date:'', match_time:'', round:'Grup Aşaması' })
    onMatchesUpdated()
  }

  const setOddsField = (mid, field, val) => {
    setOddsEdits(e => ({ ...e, [mid]: { ...(e[mid] || {}), [field]: val } }))
  }

  const saveOdds = async (match) => {
    const existing = oddsData[match.id] || {}
    const edited   = oddsEdits[match.id] || {}
    const h2h_home = parseFloat(edited.home ?? existing.h2h_home ?? '')
    const h2h_draw = parseFloat(edited.draw ?? existing.h2h_draw ?? '')
    const h2h_away = parseFloat(edited.away ?? existing.h2h_away ?? '')

    if (!h2h_home || !h2h_draw || !h2h_away || h2h_home < 1 || h2h_draw < 1 || h2h_away < 1) {
      showToast("Tüm oranlar 1'den büyük olmalı!", 'err'); return
    }

    setSavingOdds(match.id)
    const { error } = await supabase
      .from('match_odds')
      .upsert(
        { match_id: match.id, h2h_home, h2h_draw, h2h_away, is_manual: true, fetched_at: new Date().toISOString() },
        { onConflict: 'match_id' }
      )
    setSavingOdds(null)

    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast(`${match.home_team} – ${match.away_team} odds kaydedildi ✓`)
    setOddsData(o => ({ ...o, [match.id]: { h2h_home, h2h_draw, h2h_away, is_manual: true } }))
    setOddsEdits(e => { const n = { ...e }; delete n[match.id]; return n })
  }

  const oddsMatches = [...matches].sort((a, b) =>
    new Date(a.match_datetime || a.match_date) - new Date(b.match_datetime || b.match_date)
  )

  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        {toast && (
          <div style={{ ...s.toast, background: toast.type === 'err' ? 'var(--red)' : 'var(--green)' }}>
            {toast.msg}
          </div>
        )}

        <div style={s.top}>
          <h2 style={s.title}>⚙️ Admin Paneli</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ─── SONUÇ GİRME ─── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>📋 Maç Sonuçları</div>
          {matches.length === 0 && <p style={{ fontSize: 13, color: '#6b7280' }}>Henüz eklenmiş maç yok.</p>}
          {matches.map(match => (
            <div key={match.id} style={s.matchRow}>
              <div style={s.matchInfo}>
                <span style={s.matchTeams}>
                  {match.home_team} <span style={s.vs}>vs</span> {match.away_team}
                </span>
                <span style={s.matchMeta}>{match.round} · {new Date(match.match_datetime || match.match_date).toLocaleString('tr-TR')}</span>
              </div>
              <div style={s.scoreRow}>
                <input style={s.scoreInput}
                  value={results[match.id]?.home !== undefined ? results[match.id].home : (match.actual_home ?? '')}
                  onChange={e => setResult(match.id, 'home', e.target.value)}
                  maxLength={2} placeholder="–"
                />
                <span style={s.colon}>:</span>
                <input style={s.scoreInput}
                  value={results[match.id]?.away !== undefined ? results[match.id].away : (match.actual_away ?? '')}
                  onChange={e => setResult(match.id, 'away', e.target.value)}
                  maxLength={2} placeholder="–"
                />
                <button
                  style={{ ...s.saveBtn, background: match.locked ? 'rgba(22,163,74,.3)' : 'var(--red)', opacity: saving === match.id ? .6 : 1 }}
                  onClick={() => saveResult(match)}
                  disabled={saving === match.id}
                >
                  {saving === match.id ? '...' : match.locked ? '✓' : 'Kaydet'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ODDS GİRİŞİ ─── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>🎯 Odds Girişi</div>
          <p style={s.hint}>Ondalık oran girin (ör: 1.85 / 3.50 / 4.20). API'den otomatik çekilenler "API" etiketiyle gösterilir.</p>
          <div style={s.oddsHeader}>
            <span style={{ flex: 1 }} />
            <span style={s.oddsColLabel}>Ev</span>
            <span style={s.oddsColLabel}>Bera</span>
            <span style={s.oddsColLabel}>Dep</span>
            <span style={{ width: 64 }} />
          </div>
          {oddsMatches.map(match => {
            const existing = oddsData[match.id]
            const edited   = oddsEdits[match.id] || {}
            const homeVal  = edited.home  ?? (existing?.h2h_home  ?? '')
            const drawVal  = edited.draw  ?? (existing?.h2h_draw  ?? '')
            const awayVal  = edited.away  ?? (existing?.h2h_away  ?? '')
            const isDirty  = edited.home !== undefined || edited.draw !== undefined || edited.away !== undefined
            const isManual = existing?.is_manual
            return (
              <div key={match.id} style={s.oddsRow}>
                <div style={s.oddsMatchInfo}>
                  <span style={s.oddsTeams}>{match.home_team} – {match.away_team}</span>
                  {existing && (
                    <span style={{ ...s.oddsBadge, background: isManual ? 'rgba(99,102,241,.25)' : 'rgba(16,185,129,.2)', color: isManual ? '#a5b4fc' : '#6ee7b7' }}>
                      {isManual ? 'Manuel' : 'API'}
                    </span>
                  )}
                </div>
                <div style={s.oddsInputRow}>
                  <input style={{ ...s.oddsInput, ...(isDirty ? s.oddsInputDirty : {}) }}
                    type="number" min="1.01" step="0.01" placeholder="–"
                    value={homeVal} onChange={e => setOddsField(match.id, 'home', e.target.value)}
                  />
                  <input style={{ ...s.oddsInput, ...(isDirty ? s.oddsInputDirty : {}) }}
                    type="number" min="1.01" step="0.01" placeholder="–"
                    value={drawVal} onChange={e => setOddsField(match.id, 'draw', e.target.value)}
                  />
                  <input style={{ ...s.oddsInput, ...(isDirty ? s.oddsInputDirty : {}) }}
                    type="number" min="1.01" step="0.01" placeholder="–"
                    value={awayVal} onChange={e => setOddsField(match.id, 'away', e.target.value)}
                  />
                  <button
                    style={{ ...s.saveBtn, background: isDirty ? 'var(--blue)' : 'rgba(99,102,241,.25)', opacity: savingOdds === match.id ? .6 : 1, width: 64 }}
                    onClick={() => saveOdds(match)}
                    disabled={savingOdds === match.id}
                  >
                    {savingOdds === match.id ? '...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ─── YENİ MAÇ EKLE ─── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>➕ Yeni Maç Ekle</div>
          <div style={s.addForm}>
            <input style={s.input} placeholder="Ev sahibi takım" value={newMatch.home_team} onChange={e => setNewMatch(n => ({ ...n, home_team: e.target.value }))} />
            <input style={s.input} placeholder="Deplasman takım" value={newMatch.away_team} onChange={e => setNewMatch(n => ({ ...n, away_team: e.target.value }))} />
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={{ ...s.input, flex: 1 }} type="date" value={newMatch.match_date} onChange={e => setNewMatch(n => ({ ...n, match_date: e.target.value }))} />
              <input style={{ ...s.input, flex: 1 }} type="time" value={newMatch.match_time} onChange={e => setNewMatch(n => ({ ...n, match_time: e.target.value }))} />
            </div>
            <input style={s.input} placeholder="Tur (örn: Grup A, Çeyrek Final...)" value={newMatch.round} onChange={e => setNewMatch(n => ({ ...n, round: e.target.value }))} />
            <button style={{ ...s.btn, opacity: addingMatch ? .6 : 1 }} onClick={addMatch} disabled={addingMatch}>
              {addingMatch ? 'Ekleniyor...' : '+ Maç Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay:       { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'flex-start', padding:16, overflowY:'auto' },
  panel:         { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:520, padding:20, marginTop:16, position:'relative' },
  toast:         { position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', padding:'10px 20px', borderRadius:20, color:'#fff', fontWeight:700, fontSize:13, zIndex:200 },
  top:           { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  title:         { fontFamily:'var(--font-display)', fontSize:20, letterSpacing:2 },
  closeBtn:      { background:'rgba(255,255,255,.08)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:14 },
  input:         { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', color:'var(--text)', fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' },
  btn:           { background:'var(--blue)', border:'none', borderRadius:10, padding:'11px 0', color:'#fff', fontSize:14, fontWeight:700, width:'100%' },
  section:       { marginBottom:24 },
  sectionTitle:  { fontSize:12, letterSpacing:2, color:'var(--gold)', fontWeight:700, textTransform:'uppercase', marginBottom:12 },
  hint:          { fontSize:11, color:'#6b7280', marginBottom:10, lineHeight:1.4 },
  matchRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)', gap:8 },
  matchInfo:     { display:'flex', flexDirection:'column', gap:3, flex:1 },
  matchTeams:    { fontSize:13, fontWeight:600 },
  vs:            { color:'var(--muted)', fontWeight:400 },
  matchMeta:     { fontSize:11, color:'var(--muted)' },
  scoreRow:      { display:'flex', alignItems:'center', gap:6, flexShrink:0 },
  scoreInput:    { width:36, height:36, textAlign:'center', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:8, color:'var(--text)', fontSize:16, fontWeight:700, outline:'none' },
  colon:         { color:'var(--muted)', fontWeight:700 },
  saveBtn:       { border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer' },
  addForm:       { display:'flex', flexDirection:'column', gap:10 },
  // Odds section
  oddsHeader:    { display:'flex', alignItems:'center', gap:4, paddingBottom:6, borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:4 },
  oddsColLabel:  { width:60, textAlign:'center', fontSize:10, letterSpacing:1, color:'#6b7280', textTransform:'uppercase' },
  oddsRow:       { display:'flex', flexDirection:'column', gap:6, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.06)' },
  oddsMatchInfo: { display:'flex', alignItems:'center', gap:8 },
  oddsTeams:     { fontSize:13, fontWeight:600, flex:1 },
  oddsBadge:     { fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, letterSpacing:.5, textTransform:'uppercase', flexShrink:0 },
  oddsInputRow:  { display:'flex', alignItems:'center', gap:4 },
  oddsInput:     { width:60, height:34, textAlign:'center', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'var(--text)', fontSize:13, fontWeight:600, outline:'none' },
  oddsInputDirty:{ border:'1px solid rgba(99,102,241,.5)', background:'rgba(99,102,241,.1)' },
}
