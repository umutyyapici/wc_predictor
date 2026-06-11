import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function RecoveryEmailModal({ userId, onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setError('')
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setError('Geçerli bir e-posta adresi gir.'); return }

    setLoading(true)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ recovery_email: clean })
      .eq('id', userId)

    setLoading(false)
    if (updateErr) { setError('Hata: ' + updateErr.message); return }
    onSaved(clean)
  }

  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>📧 Şifre Kurtarma E-postası</span>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={m.hint}>
          Şifreni unutursan sıfırlayabilmemiz için lütfen bir e-posta adresi gir.
        </p>
        <input
          style={m.input}
          type="email"
          placeholder="E-posta adresin..."
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        {error && <div style={m.error}>⚠️ {error}</div>}
        <button style={{ ...m.btn, opacity: loading ? .6 : 1 }} onClick={handleSave} disabled={loading}>
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button style={m.laterBtn} onClick={onClose}>Daha sonra</button>
      </div>
    </div>
  )
}

const m = {
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  box:      { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, padding:'24px 20px', width:'100%', maxWidth:360 },
  top:      { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  title:    { fontFamily:'var(--font-display)', fontSize:16, letterSpacing:1, color:'var(--gold)' },
  closeBtn: { background:'rgba(255,255,255,.08)', border:'none', borderRadius:8, padding:'5px 10px', color:'#fff', fontSize:13, cursor:'pointer' },
  hint:     { fontSize:13, color:'var(--muted)', marginBottom:14 },
  input:    { width:'100%', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:15, outline:'none', marginBottom:10 },
  error:    { background:'rgba(225,29,72,.15)', border:'1px solid rgba(225,29,72,.3)', borderRadius:8, padding:'8px 12px', color:'#fca5a5', fontSize:13, marginBottom:10 },
  btn:      { width:'100%', background:'linear-gradient(90deg, var(--red), #f97316)', border:'none', borderRadius:12, padding:'13px 0', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' },
  laterBtn: { width:'100%', background:'transparent', border:'none', borderRadius:12, padding:'10px 0', color:'var(--muted)', fontSize:13, cursor:'pointer', marginTop:4 },
}
