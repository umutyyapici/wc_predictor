import { useState, useEffect } from 'react'

const STORAGE_KEY = 'wc_install_guide_dismissed'

export default function InstallGuide() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState(null)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true

    if (isStandalone || (!isIOS && !isAndroid)) return

    setPlatform(isIOS ? 'ios' : 'android')
    setVisible(true)
  }, [])

  const dismiss = (permanent) => {
    if (permanent) localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible || !platform) return null

  const steps =
    platform === 'ios'
      ? [
          { icon: '⬆️', text: "Safari'de alt çubukta Paylaş simgesine bas" },
          { icon: '➕', text: '"Ana Ekrana Ekle" seçeneğine dokun' },
          { icon: '✅', text: '"Ekle" butonuna bas' },
        ]
      : [
          { icon: '⋮', text: "Chrome'da sağ üstteki üç noktaya bas" },
          { icon: '📲', text: '"Uygulamayı yükle" veya "Ana ekrana ekle" seçeneğine dokun' },
          { icon: '✅', text: '"Yükle" butonuna bas' },
        ]

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.top}>
          <span style={{ fontSize: 40 }}>📲</span>
          <h2 style={s.title}>Ana Ekrana Ekle</h2>
          <p style={s.sub}>
            Uygulamayı ana ekranına ekle, tam ekran açılsın!
          </p>
        </div>

        <div style={s.badge}>
          {platform === 'ios' ? '🍎 iPhone / iPad — Safari' : '🤖 Android — Chrome'}
        </div>

        <ol style={s.list}>
          {steps.map((step, i) => (
            <li key={i} style={s.item}>
              <span style={s.stepIcon}>{step.icon}</span>
              <span style={s.stepText}>{step.text}</span>
            </li>
          ))}
        </ol>

        <div style={s.buttons}>
          <button style={s.btnSec} onClick={() => dismiss(true)}>
            Bir daha gösterme
          </button>
          <button style={s.btnPri} onClick={() => dismiss(false)}>
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: '0 0 24px 0',
  },
  card: {
    background: '#111520',
    border: '1px solid #2a2f42',
    borderRadius: 20,
    padding: '24px 20px 20px',
    maxWidth: 360,
    width: '92%',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  top: {
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    gap: 6, alignItems: 'center',
  },
  title: {
    margin: 0, fontFamily: 'var(--font-display)', fontSize: 24,
    color: '#f5c518', letterSpacing: 1,
  },
  sub: { margin: 0, fontSize: 13, color: '#aab', lineHeight: 1.4 },
  badge: {
    background: '#1e2235', borderRadius: 8, padding: '6px 12px',
    fontSize: 13, color: '#ccd', textAlign: 'center', fontWeight: 500,
  },
  list: {
    margin: 0, padding: 0, listStyle: 'none',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  item: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  stepIcon: { fontSize: 20, minWidth: 28, textAlign: 'center', marginTop: 1 },
  stepText: { fontSize: 14, color: '#dde', lineHeight: 1.4 },
  buttons: { display: 'flex', gap: 8, marginTop: 4 },
  btnSec: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #2a2f42',
    background: 'transparent', color: '#778', fontSize: 13, cursor: 'pointer',
  },
  btnPri: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    background: '#f5c518', color: '#07090f', fontSize: 13,
    fontWeight: 700, cursor: 'pointer',
  },
}
