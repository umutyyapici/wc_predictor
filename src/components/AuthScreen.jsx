import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { translateAuthError } from '../lib/authErrors.js'

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // login | register | forgot
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [invite, setInvite] = useState('')
  const [email, setEmail] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotUsername, setForgotUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Kullanıcı adından boşlukları silip küçük harfe çevirerek otomatik e-posta üreten yardımcı fonksiyon
  const getGeneratedEmail = (user) => {
    return `${user.trim().toLowerCase().replace(/\s+/g, '')}@tahmin.com`
  }

  const handleLogin = async () => {
    setError('')
    if (!username || !password) { setError('Kullanıcı adı ve şifre gerekli.'); return }
    setLoading(true)

    // Kullanıcının auth.users'taki güncel emailini username üzerinden bulmaya çalış
    // (recovery_email ile senkronize edilmiş olabilir). Bulunamazsa eski
    // kullaniciadi@tahmin.com formatına geri dön.
    const { data: lookupEmail } = await supabase.rpc('get_login_email', { p_username: username })
    const loginEmail = lookupEmail || getGeneratedEmail(username)

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password
    })

    setLoading(false)
    if (err) { setError('Giriş başarısız: Kullanıcı adı veya şifre hatalı.'); return }
    onAuth(data.user)
  }

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')
    const cleanUsername = forgotUsername.trim()
    const cleanEmail = forgotEmail.trim().toLowerCase()
    if (!cleanUsername) { setError('Kullanıcı adını gir.'); return }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { setError('Geçerli bir e-posta adresi gir.'); return }

    setLoading(true)
    // Kullanıcının recovery_email'i henüz set edilmemişse, bu e-postayı
    // profiles.recovery_email ve auth.users.email olarak kaydeder.
    // Zaten set edilmişse no-op'tur (hesap ele geçirme korumalı).
    await supabase.rpc('claim_recovery_email', { p_username: cleanUsername, p_email: cleanEmail })
    await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin })
    setLoading(false)

    // Email enumeration'ı önlemek için sonucu her durumda aynı mesajla göster
    setInfo('Eğer bu e-posta sistemde kayıtlıysa, şifre sıfırlama linki gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.')
  }

  const handleRegister = async () => {
    setError('')
    if (!username || !password || !invite || !email) { setError('Tüm alanları doldur.'); return }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) { setError('Kullanıcı adı en az 3 karakter.'); return }

    const cleanEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { setError('Geçerli bir e-posta adresi gir.'); return }

    setLoading(true)

    // 🎯 GÜNCELLENDİ: Davetiye kodunu tamamen küçük harfe çevirip dynamic olarak allowed_groups tablosundan kontrol ediyoruz
    const cleanInvite = invite.toLowerCase().trim()
    const { data: validGroup, error: groupError } = await supabase
      .from('allowed_groups')
      .select('code')
      .eq('code', cleanInvite)
      .maybeSingle()

    if (groupError || !validGroup) {
      setLoading(false)
      setError('Davetiye kodu hatalı veya geçersiz!')
      return
    }

    // 🎯 GÜNCELLENDİ: invite_code verisini metadata içerisine ekliyoruz ki App.jsx profiles'a otomatik yazabilsin
    const { data, error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          invite_code: cleanInvite,
          recovery_email: cleanEmail
        }
      }
    })

    setLoading(false)
    if (err) {
      if (err.message.includes('already exists')) {
        setError('Bu kullanıcı adı sistemde zaten kayıtlı.');
      } else {
        setError('Kayıt başarısız: ' + translateAuthError(err.message));
      }
      return
    }

    if (data.user) {
      // Kayıt sonrası kimlik doğrulandı — kullanıcı adı çakışmasını kontrol et
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle()

      if (existingUsername) {
        await supabase.auth.signOut()
        setError('Bu kullanıcı adı zaten alınmış. Başka bir isim dene.')
        return
      }
      onAuth(data.user)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.bg} />
      <div style={s.card}>
        <div style={s.trophy}>🏆</div>
        <h1 style={s.title}>WORLD CUP PREDICTOR</h1>
        <p style={s.subtitle}>by pepinkeli</p>

        {mode !== 'forgot' && (
          <div style={s.tabs}>
            <button style={mode==='login' ? s.tabOn : s.tabOff} onClick={()=>{setMode('login');setError('');setInfo('')}}>Giriş Yap</button>
            <button style={mode==='register' ? s.tabOn : s.tabOff} onClick={()=>{setMode('register');setError('');setInfo('')}}>Üye Ol</button>
          </div>
        )}

        {mode === 'forgot' ? (
          <div style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Kullanıcı Adı</label>
              <input style={s.input} placeholder="Kayıtlı kullanıcı adın" value={forgotUsername} onChange={e=>setForgotUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleForgotPassword()} autoFocus />
            </div>

            <div style={s.field}>
              <label style={s.label}>E-posta</label>
              <input style={s.input} type="email" placeholder="Sıfırlama linkinin gideceği e-posta" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleForgotPassword()} />
            </div>

            {error && <div style={s.error}>⚠️ {error}</div>}
            {info && <div style={s.info}>✅ {info}</div>}

            <button
              style={{...s.btn, opacity: loading ? .6 : 1}}
              onClick={handleForgotPassword}
              disabled={loading}
            >
              {loading ? <span style={s.spinner}/> : 'SIFIRLAMA LİNKİ GÖNDER 📧'}
            </button>

            <button style={s.linkBtn} onClick={()=>{setMode('login');setError('');setInfo('');setForgotEmail('');setForgotUsername('')}}>← Giriş ekranına dön</button>
          </div>
        ) : (
          <div style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Kullanıcı Adı</label>
              <input style={s.input} placeholder="örn: gol_krali_34" value={username} onChange={e=>setUsername(e.target.value)} maxLength={20} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Şifre</label>
              <input style={s.input} type="password" placeholder={mode==='register' ? 'En az 6 karakter' : '••••••••'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())} />
              {mode === 'register' && <span style={s.fieldHint}>En az bir küçük harf, bir büyük harf ve bir rakam içermeli.</span>}
            </div>

            {mode === 'register' && (
              <div style={s.field}>
                <label style={s.label}>E-posta</label>
                <input style={s.input} type="email" placeholder="Şifreni unutursan kullanılır" value={email} onChange={e=>setEmail(e.target.value)} />
              </div>
            )}

            {mode === 'register' && (
              <div style={s.field}>
                <label style={s.label}>Davetiye Kodu</label>
                <input style={s.input} placeholder="Kodu gir..." value={invite} onChange={e=>setInvite(e.target.value)} />
              </div>
            )}

            {error && <div style={s.error}>⚠️ {error}</div>}

            <button
              style={{...s.btn, opacity: loading ? .6 : 1}}
              onClick={mode==='login' ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? <span style={s.spinner}/> : mode==='login' ? 'GİRİŞ YAP ⚽' : 'HESAP OLUŞTUR 🚀'}
            </button>

            {mode === 'login' && (
              <button style={s.linkBtn} onClick={()=>{setMode('forgot');setError('');setInfo('');setForgotEmail('');setForgotUsername('')}}>Şifremi unuttum</button>
            )}
          </div>
        )}

        <p style={s.hint}>
          {mode==='login'
            ? 'Hesabın yok mu? Üye ol butonuna tıkla.'
            : mode==='register'
            ? 'Davetiye kodunu arkadaşlarından al.'
            : 'Girdiğin e-posta adresine şifre sıfırlama linki göndereceğiz.'}
        </p>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, position:'relative', overflow:'hidden' },
  bg: { position:'fixed', inset:0, background:'radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, #0d1f3c 40%, #07090f 100%)', zIndex:0 },
  card: { position:'relative', zIndex:1, background:'rgba(255,255,255,.04)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:24, padding:'40px 32px', width:'100%', maxWidth:400, animation:'fadeUp .5s ease' },
  trophy: { fontSize:52, textAlign:'center', display:'block', marginBottom:8 },
  title: { fontFamily:'var(--font-display)', fontSize:26, letterSpacing:2, textAlign:'center', color:'var(--text)', textTransform:'uppercase' },
  subtitle: { fontFamily:'var(--font-display)', fontSize:13, letterSpacing:3, textAlign:'center', color:'var(--gold)', marginBottom:28, textTransform:'lowercase' },
  tabs: { display:'flex', background:'rgba(0,0,0,.3)', borderRadius:12, padding:4, marginBottom:24, gap:4 },
  tabOn: { flex:1, background:'var(--red)', border:'none', borderRadius:9, padding:'10px 0', color:'#fff', fontSize:14, fontWeight:700 },
  tabOff: { flex:1, background:'transparent', border:'none', borderRadius:9, padding:'10px 0', color:'var(--muted)', fontSize:14 },
  form: { display:'flex', flexDirection:'column', gap:14 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, color:'var(--muted)', letterSpacing:1, textTransform:'uppercase' },
  fieldHint: { fontSize:11, color:'var(--muted)' },
  input: { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:15, outline:'none' },
  error: { background:'rgba(225,29,72,.15)', border:'1px solid rgba(225,29,72,.3)', borderRadius:8, padding:'10px 12px', color:'#fca5a5', fontSize:13 },
  info: { background:'rgba(74,222,128,.12)', border:'1px solid rgba(74,222,128,.3)', borderRadius:8, padding:'10px 12px', color:'#4ade80', fontSize:13 },
  btn: { background:'linear-gradient(90deg, var(--red), #f97316)', border:'none', borderRadius:12, padding:'14px 0', color:'#fff', fontSize:15, fontWeight:700, letterSpacing:1, marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  spinner: { width:18, height:18, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', onAuth: 'none', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' },
  linkBtn: { background:'transparent', border:'none', color:'var(--muted)', fontSize:12, textAlign:'center', textDecoration:'underline', cursor:'pointer', marginTop:2 },
  hint: { textAlign:'center', color:'var(--muted)', fontSize:12, marginTop:20 },
}
