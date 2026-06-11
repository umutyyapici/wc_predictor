import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { translateAuthError } from '../lib/authErrors.js'

export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
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
    <div style={s.wrap}>
      <div style={s.bg} />
      <div style={s.card}>
        <div style={s.trophy}>🔑</div>
        <h1 style={s.title}>YENİ ŞİFRE BELİRLE</h1>

        {success ? (
          <>
            <p style={s.hint}>Şifren başarıyla güncellendi. Devam etmek için aşağıdaki butona tıkla.</p>
            <button style={s.btn} onClick={onDone}>UYGULAMAYA DEVAM ET ⚽</button>
          </>
        ) : (
          <div style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Yeni Şifre</label>
              <input style={s.input} type="password" placeholder="En az 6 karakter" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} autoFocus />
              <span style={s.fieldHint}>En az 6 karakter; en az bir küçük harf, bir büyük harf ve bir rakam içermeli.</span>
            </div>

            <div style={s.field}>
              <label style={s.label}>Yeni Şifre (Tekrar)</label>
              <input style={s.input} type="password" placeholder="Şifreni tekrar gir" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} />
            </div>

            {error && <div style={s.error}>⚠️ {error}</div>}

            <button
              style={{...s.btn, opacity: loading ? .6 : 1}}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <span style={s.spinner}/> : 'ŞİFREYİ GÜNCELLE 🔒'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, position:'relative', overflow:'hidden' },
  bg: { position:'fixed', inset:0, background:'radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, #0d1f3c 40%, #07090f 100%)', zIndex:0 },
  card: { position:'relative', zIndex:1, background:'rgba(255,255,255,.04)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:24, padding:'40px 32px', width:'100%', maxWidth:400, animation:'fadeUp .5s ease' },
  trophy: { fontSize:52, textAlign:'center', display:'block', marginBottom:8 },
  title: { fontFamily:'var(--font-display)', fontSize:22, letterSpacing:2, textAlign:'center', color:'var(--text)', textTransform:'uppercase', marginBottom:24 },
  form: { display:'flex', flexDirection:'column', gap:14 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, color:'var(--muted)', letterSpacing:1, textTransform:'uppercase' },
  fieldHint: { fontSize:11, color:'var(--muted)' },
  input: { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:15, outline:'none' },
  error: { background:'rgba(225,29,72,.15)', border:'1px solid rgba(225,29,72,.3)', borderRadius:8, padding:'10px 12px', color:'#fca5a5', fontSize:13 },
  btn: { background:'linear-gradient(90deg, var(--red), #f97316)', border:'none', borderRadius:12, padding:'14px 0', color:'#fff', fontSize:15, fontWeight:700, letterSpacing:1, marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%' },
  spinner: { width:18, height:18, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' },
  hint: { textAlign:'center', color:'var(--muted)', fontSize:13, marginBottom:20 },
}
