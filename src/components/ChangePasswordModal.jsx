import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { translateAuthError } from '../lib/authErrors.js'

export default function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setError('')
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) { setError(translateAuthError(err.message)); return }
    setSuccess(true)
  }

  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>🔑 Şifre Değiştir</span>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <>
            <p style={m.hint}>Şifren başarıyla güncellendi.</p>
            <button style={m.btn} onClick={onClose}>Kapat</button>
          </>
        ) : (
          <>
            <p style={m.hint}>Yeni şifreni gir.</p>
            <input
              style={m.input}
              type="password"
              placeholder="Yeni şifre (en az 6 karakter)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <input
              style={m.input}
              type="password"
              placeholder="Yeni şifre (tekrar)"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            {error && <div style={m.error}>⚠️ {error}</div>}
            <button style={{ ...m.btn, opacity: loading ? .6 : 1 }} onClick={handleSave} disabled={loading}>
              {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </>
        )}
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
}
