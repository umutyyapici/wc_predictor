import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { m } from '../lib/modalStyles.js'

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

