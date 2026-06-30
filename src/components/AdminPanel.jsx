import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { isBettingOpen } from '../lib/scoring.js'

const PAGE_SIZE = 10

export default function AdminPanel({ matches, onClose, onMatchesUpdated }) {
  const [adminTab, setAdminTab] = useState('matches')
  const [toast, setToast]       = useState(null)

  // ── Maçlar sekmesi ──
  const [results, setResults]     = useState({})
  const [saving, setSaving]       = useState(null)
  const [matchPage, setMatchPage] = useState(1)
  const [newMatch, setNewMatch]   = useState({ home_team: '', away_team: '', match_date: '', match_time: '', round: 'Grup Aşaması' })
  const [addingMatch, setAddingMatch] = useState(false)

  // ── Tahminler sekmesi ──
  const [profiles, setProfiles]   = useState([])
  const [selUserId, setSelUserId] = useState('')
  const [selMatchId, setSelMatchId] = useState('')
  const [predHome, setPredHome]   = useState('')
  const [predAway, setPredAway]   = useState('')
  const [isJoker, setIsJoker]     = useState(false)
  const [savingPred, setSavingPred] = useState(false)

  useEffect(() => {
    if (adminTab !== 'preds') return
    supabase.from('profiles').select('id, username').order('username')
      .then(({ data }) => setProfiles(data || []))
  }, [adminTab])

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Maçlar: sıralama ve sayfalama ──
  const sortedMatches = [...matches].sort((a, b) =>
    new Date(b.match_datetime || b.match_date || 0) - new Date(a.match_datetime || a.match_date || 0)
  )
  const totalMatchPages = Math.max(1, Math.ceil(sortedMatches.length / PAGE_SIZE))
  const pagedMatches    = sortedMatches.slice((matchPage - 1) * PAGE_SIZE, matchPage * PAGE_SIZE)

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
      .update({ actual_home: parseInt(home), actual_away: parseInt(away), locked: true, score_override: true })
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
      home_team:      newMatch.home_team,
      away_team:      newMatch.away_team,
      match_date:     newMatch.match_date,
      match_datetime: datetimeISO,
      round:          newMatch.round,
      locked:         false,
    })
    setAddingMatch(false)
    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    showToast('Maç başarıyla eklendi ✓')
    setNewMatch({ home_team: '', away_team: '', match_date: '', match_time: '', round: 'Grup Aşaması' })
    onMatchesUpdated()
  }

  // ── Tahminler: bahis süresi dolmuş maçlar dropdown için ──
  const closedMatches = [...matches]
    .filter(m => !isBettingOpen(m.match_datetime))
    .sort((a, b) => new Date(b.match_datetime || b.match_date || 0) - new Date(a.match_datetime || a.match_date || 0))

  const savePred = async () => {
    if (!selUserId)               { showToast('Kullanıcı seç!', 'err'); return }
    if (!selMatchId)              { showToast('Maç seç!', 'err'); return }
    if (predHome === '' || predAway === '') { showToast('Skoru gir!', 'err'); return }

    setSavingPred(true)
    const { error } = await supabase.rpc('admin_upsert_prediction', {
      p_user_id:   selUserId,
      p_match_id:  parseInt(selMatchId),
      p_pred_home: parseInt(predHome),
      p_pred_away: parseInt(predAway),
      p_is_joker:  isJoker,
    })
    setSavingPred(false)

    if (error) { showToast('Hata: ' + error.message, 'err'); return }
    const user  = profiles.find(p => p.id === selUserId)
    const match = matches.find(m => String(m.id) === selMatchId)
    showToast(`${user?.username} → ${match?.home_team} – ${match?.away_team} tahmini kaydedildi ✓`)
    setPredHome('')
    setPredAway('')
    setIsJoker(false)
  }

  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        {toast && (
          <div style={{ ...s.toast, background: toast.type === 'err' ? 'var(--red)' : '#15803d' }}>
            {toast.msg}
          </div>
        )}

        <div style={s.top}>
          <h2 style={s.title}>⚙️ Admin Paneli</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.tabRow}>
          <button
            style={{ ...s.tabBtn, ...(adminTab === 'matches' ? s.tabBtnActive : {}) }}
            onClick={() => setAdminTab('matches')}
          >
            📋 Maçlar
          </button>
          <button
            style={{ ...s.tabBtn, ...(adminTab === 'preds' ? s.tabBtnActive : {}) }}
            onClick={() => setAdminTab('preds')}
          >
            🎯 Tahminler
          </button>
        </div>

        {/* ── MAÇLAR SEKMESİ ── */}
        {adminTab === 'matches' && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>📋 Maç Sonuçları</div>
              {matches.length === 0 && <p style={{ fontSize: 13, color: '#6b7280' }}>Henüz eklenmiş maç yok.</p>}
              {pagedMatches.map(match => (
                <div key={match.id} style={s.matchRow}>
                  <div style={s.matchInfo}>
                    <span style={s.matchTeams}>
                      {match.home_team} <span style={s.vs}>vs</span> {match.away_team}
                    </span>
                    <span style={s.matchMeta}>
                      {match.round} · {new Date(match.match_datetime || match.match_date).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div style={s.scoreRow}>
                    <input
                      style={s.scoreInput}
                      value={results[match.id]?.home !== undefined ? results[match.id].home : (match.actual_home ?? '')}
                      onChange={e => setResult(match.id, 'home', e.target.value)}
                      maxLength={2} placeholder="–"
                    />
                    <span style={s.colon}>:</span>
                    <input
                      style={s.scoreInput}
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

              {totalMatchPages > 1 && (
                <div style={s.pgWrap}>
                  <button
                    style={{ ...s.pgBtn, opacity: matchPage === 1 ? .35 : 1 }}
                    disabled={matchPage === 1}
                    onClick={() => setMatchPage(p => p - 1)}
                  >
                    ‹ Önceki
                  </button>
                  <span style={s.pgInfo}>{matchPage} / {totalMatchPages}</span>
                  <button
                    style={{ ...s.pgBtn, opacity: matchPage === totalMatchPages ? .35 : 1 }}
                    disabled={matchPage === totalMatchPages}
                    onClick={() => setMatchPage(p => p + 1)}
                  >
                    Sonraki ›
                  </button>
                </div>
              )}
            </div>

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
          </>
        )}

        {/* ── TAHMİNLER SEKMESİ ── */}
        {adminTab === 'preds' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>🎯 Geçmiş Tahmin Ekle / Güncelle</div>
            <p style={s.hint}>Bahis süresi dolmuş bir maç için kullanıcı adına tahmin ekler veya varsa günceller.</p>
            <div style={s.addForm}>
              <select style={s.input} value={selUserId} onChange={e => setSelUserId(e.target.value)}>
                <option value="">— Kullanıcı seç —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>

              <select style={s.input} value={selMatchId} onChange={e => setSelMatchId(e.target.value)}>
                <option value="">— Maç seç —</option>
                {closedMatches.map(m => (
                  <option key={m.id} value={m.id}>
                    {new Date(m.match_datetime || m.match_date).toLocaleDateString('tr-TR')} · {m.home_team} – {m.away_team}{m.locked ? ` (${m.actual_home}:${m.actual_away})` : ''}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  style={{ ...s.input, flex: 1, textAlign: 'center' }}
                  type="number" min="0" max="30"
                  placeholder="Ev golü"
                  value={predHome}
                  onChange={e => setPredHome(e.target.value)}
                />
                <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 18 }}>–</span>
                <input
                  style={{ ...s.input, flex: 1, textAlign: 'center' }}
                  type="number" min="0" max="30"
                  placeholder="Dep golü"
                  value={predAway}
                  onChange={e => setPredAway(e.target.value)}
                />
              </div>

              <label style={s.jokerLabel}>
                <input
                  type="checkbox"
                  checked={isJoker}
                  onChange={e => setIsJoker(e.target.checked)}
                  style={{ marginRight: 8, accentColor: '#f5c518' }}
                />
                🃏 Joker kullanıldı (×2 puan)
              </label>

              <button style={{ ...s.btn, opacity: savingPred ? .6 : 1 }} onClick={savePred} disabled={savingPred}>
                {savingPred ? 'Kaydediliyor...' : '💾 Tahmin Kaydet'}
              </button>
            </div>

            {closedMatches.length === 0 && (
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>Henüz bahis süresi dolmuş maç yok.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16, overflowY: 'auto' },
  panel:        { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 520, padding: 20, marginTop: 16, position: 'relative' },
  toast:        { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 20, color: '#fff', fontWeight: 700, fontSize: 13, zIndex: 200, whiteSpace: 'nowrap' },
  top:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:        { fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 2 },
  closeBtn:     { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 14, cursor: 'pointer' },
  tabRow:       { display: 'flex', gap: 8, marginBottom: 20 },
  tabBtn:       { flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 0', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabBtnActive: { background: 'rgba(245,197,24,.12)', border: '1px solid rgba(245,197,24,.3)', color: '#f5c518' },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 12, letterSpacing: 2, color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 },
  hint:         { fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 },
  input:        { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn:          { background: 'var(--blue)', border: 'none', borderRadius: 10, padding: '11px 0', color: '#fff', fontSize: 14, fontWeight: 700, width: '100%', cursor: 'pointer' },
  addForm:      { display: 'flex', flexDirection: 'column', gap: 10 },
  jokerLabel:   { display: 'flex', alignItems: 'center', fontSize: 13, color: '#f5c518', cursor: 'pointer', padding: '8px 12px', background: 'rgba(245,197,24,.07)', border: '1px solid rgba(245,197,24,.2)', borderRadius: 10 },
  matchRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 8 },
  matchInfo:    { display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  matchTeams:   { fontSize: 13, fontWeight: 600 },
  vs:           { color: 'var(--muted)', fontWeight: 400 },
  matchMeta:    { fontSize: 11, color: 'var(--muted)' },
  scoreRow:     { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  scoreInput:   { width: 36, height: 36, textAlign: 'center', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: 'var(--text)', fontSize: 16, fontWeight: 700, outline: 'none' },
  colon:        { color: 'var(--muted)', fontWeight: 700 },
  saveBtn:      { border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' },
  pgWrap:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '10px 0', borderTop: '1px solid var(--border)' },
  pgBtn:        { background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, padding: '7px 16px', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  pgInfo:       { fontSize: 13, color: 'var(--muted)', fontWeight: 600 },
}
