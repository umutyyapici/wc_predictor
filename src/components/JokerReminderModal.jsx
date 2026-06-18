import { m } from '../lib/modalStyles.js'

export default function JokerReminderModal({ days, onClose, onDismissForever }) {
  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>🃏 Joker Hatırlatması</span>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={{ ...m.hint, lineHeight: 1.5 }}>
          Aşağıdaki günler için tahmin yaptın ama günlük joker hakkını kullanmadın.
          Maç başlamadan önce ⚽ Tahminler sekmesinden o güne gidip 🃏 butonuna basabilirsin:
        </p>

        <ul style={local.list}>
          {days.map(day => (
            <li key={day} style={local.listItem}>
              {new Date(day + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </li>
          ))}
        </ul>

        <button style={m.btn} onClick={onClose}>Tamam, anladım</button>
        <button style={local.linkBtn} onClick={onDismissForever}>Bir daha gösterme</button>
      </div>
    </div>
  )
}

const local = {
  list:     { listStyle:'none', display:'flex', flexDirection:'column', gap:8, margin:'0 0 16px', padding:0 },
  listItem: { background:'rgba(245,197,24,.1)', border:'1px solid rgba(245,197,24,.25)', borderRadius:10, padding:'10px 14px', color:'#f5c518', fontSize:13, fontWeight:600, textTransform:'capitalize' },
  linkBtn:  { width:'100%', background:'transparent', border:'none', color:'var(--muted)', fontSize:12, textAlign:'center', textDecoration:'underline', cursor:'pointer', marginTop:10, padding:0 },
}
