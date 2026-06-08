import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'wc2026admin'

export default function AdminPanel({ matches, onClose, onMatchesUpdated }) {
  const [auth, setAuth] = useState(false)
  const [pass, setPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [results, setResults] = useState({})
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState(null)

  // Yeni maç ekleme formu
  const [newMatch, setNewMatch] = useState({ home_team:'', away_team:'', match_date:'', round:'Grup Aşaması' })
  const [addingMatch, setAddingMatch] = useState(false)

  const showToast = (msg, type='ok') => {
    setToast({msg,type})
    setTimeout(()=>setToast(null),2500)
  }

  const handleAuth = () => {
    if (pass === ADMIN_PASS) { setAuth(true); setPassErr('') }
    else setPassErr('Yanlış şifre!')
  }

  const setResult = (mid, side, val) => {
    if (!/^\d*$/.test(val)) return
    setResults(r => ({...r, [mid]: {...(r[mid]||{}), [side]: val}}))
  }

  const saveResult = async (match) => {
    const r = results[match.id] || {}
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
    setResults(r => { const n={...r}; delete n[match.id]; return n })
    onMatchesUpdated()
  }

  const addMatch = async () => {
    if (!newMatch.home_team || !newMatch.away_team || !newMatch.match_date) {
      showToast('Tüm alanları doldur!', 'err'); return
    }
    setAddingMatch(true)
    const { error } = await supabase.from('matches').insert({
      home_team: newMatch.home_team,
      away_team: newMatch.away_team,
      match_date: newMatch.match_date,
      round: newMatch.round,
      locked: false,
    })
    setAddingMatch(false)
    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast('Maç eklendi ✓')
    NewMatch({ home_team:'', away_team:'', match_date:'', round:'Grup Aşaması' })
    OnMatchesUpdated()
  }

  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        {toast && (
          <div style={{...s.toast, background: toast.type==='err'?'var(--red)':'var(--green)'}}>
            {toast.msg}
          </div>
        )}

        <div style={s.top}>
          <h2 style={s.title}>⚙️ Admin Paneli</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!auth ? (
          <div style={s.authBox}>
            <p style={s.authHint}>Admin şifresini gir:</p>
            <input style={s.input} type="password" value={pass}
              onChange={e=>setPass(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleAuth()}
              placeholder="Şifre..."
            />
            {passErr && <div style={s.err}>{passErr}</div>}
            <button style={s.btn} onClick={handleAuth}>Giriş</button>
          </div>
        ) : (
          <div>
            {/* ─── SONUÇ GİRME ─── */}
            <div style={s.section}>
              <div style={s.sectionTitle}>📋 Maç Sonuçları</div>
              {matches.map(match => (
                <div key={match.id} style={s.matchRow}>
                  <div style={s.matchInfo}>
                    <span style={s.matchTeams}>
                      {match.home_team}
                      <span style={s.vs}> vs </span>
                      {match.away_team}
                    </span>
                    <span style={s.matchMeta}>{match.round} · {new Date(match.match_date).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div style={s.scoreRow}>
                    <input style={s.scoreInput}
                      value={results[match.id]?.home !== undefined ? results[match.id].home : (match.actual_home ?? '')}
                      onChange={e=>setResult(match.id,'home',e.target.value)}
                      maxLength={2} placeholder="–"
                    />
                    <span style={s.colon}>:</span>
                    <input style={s.scoreInput}
                      value={results[match.id]?.away !== undefined ? results[match.id].away : (match.actual_away ?? '')}
                      onChange={e=>setResult(match.id,'away',e.target.value)}
                      maxLength={2} placeholder="–"
                    />
                    <button
                      style={{...s.saveBtn, background: match.locked ? 'rgba(22,163,74,.3)' : 'var(--red)', opacity: saving===match.id?.6:1}}
                      onClick={()=>saveResult(match)}
                      disabled={saving===match.id}
                    >
                      {saving===match.id ? '...' : match.locked ? '✓' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── YENİ MAÇ EKLE ─── */}
            <div style={s.section}>
              <div style={s.sectionTitle}>➕ Yeni Maç Ekle</div>
              <div style={s.addForm}>
                <input style={s.input} placeholder="Ev sahibi takım" value={newMatch.home_team} onChange={e=>setNewMatch(n=>({...n,home_team:e.target.value}))} />
                <input style={s.input} placeholder="Deplasman takım" value={newMatch.away_team} onChange={e=>setNewMatch(n=>({...n,away_team:e.target.value}))} />
                <input style={s.input} type="date" value={newMatch.match_date} onChange={e=>setNewMatch(n=>({...n,match_date:e.target.value}))} />
                <input style={s.input} placeholder="Tur (örn: Grup D, Final...)" value={newMatch.round} onChange={e=>setNewMatch(n=>({...n,round:e.target.value}))} />
                <button style={{...s.btn, opacity:addingMatch?.6:1}} onClick={addMatch} disabled={addingMatch}>
                  {addingMatch ? 'Ekleniyor...' : '+ Maç Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'flex-start', padding:16, overflowY:'auto' },
  panel: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:520, padding:20, marginTop:16, position:'relative' },
  toast: { position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', padding:'10px 20px', borderRadius:20, color:'#fff', fontWeight:700, fontSize:13, zIndex:200 },
  top: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  title: { fontFamily:'var(--font-display)', fontSize:20, letterSpacing:2 },
  closeBtn: { background:'rgba(255,255,255,.08)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:14 },
  authBox: { display:'flex', flexDirection:'column', gap:12, padding:'8px 0' },
  authHint: { color:'var(--muted)', fontSize:14 },
  err: { color:'#fca5a5', fontSize:13 },
  input: { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', color:'var(--text)', fontSize:14, outline:'none', width:'100%' },
  btn: { background:'var(--blue)', border:'none', borderRadius:10, padding:'11px 0', color:'#fff', fontSize:14, fontWeight:700, width:'100%' },
  section: { marginBottom:24 },
  sectionTitle: { fontSize:12, letterSpacing:2, color:'var(--gold)', fontWeight:700, textTransform:'uppercase', marginBottom:12 },
  matchRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)', gap:8 },
  matchInfo: { display:'flex', flexDirection:'column', gap:3, flex:1 },
  matchTeams: { fontSize:13, fontWeight:600 },
  vs: { color:'var(--muted)', fontWeight:400 },
  matchMeta: { fontSize:11, color:'var(--muted)' },
  scoreRow: { display:'flex', alignItems:'center', gap:6, flexShrink:0 },
  scoreInput: { width:36, height:36, textAlign:'center', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:8, color:'var(--text)', fontSize:16, fontWeight:700, outline:'none' },
  colon: { color:'var(--muted)', fontWeight:700 },
  saveBtn: { border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:12, fontWeight:700, whiteSpace:'nowrap' },
  addForm: { display:'flex', flexDirection:'column', gap:10 },
}
