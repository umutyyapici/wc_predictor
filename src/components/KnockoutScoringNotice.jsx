import { m } from '../lib/modalStyles.js'

export default function KnockoutScoringNotice({ onClose }) {
  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>⚽ Eleme Aşaması Puanlaması</span>
        </div>
        <p style={m.hint}>
          Eleme turlarındaki maçlarda puanlama <strong style={{ color: 'var(--text)' }}>90 dakikanın sonucuna</strong> göre yapılır.
        </p>
        <p style={{ ...m.hint, marginTop: -6 }}>
          Uzatma süresi ve penaltı atışları tahmin sonucuna <strong style={{ color: 'var(--text)' }}>dahil edilmez</strong>.
        </p>
        <button style={m.btn} onClick={onClose}>Anladım</button>
      </div>
    </div>
  )
}
