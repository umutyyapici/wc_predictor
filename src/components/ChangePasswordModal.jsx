import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { translateAuthError } from '../lib/authErrors.js'
import { m } from '../lib/modalStyles.js'

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

