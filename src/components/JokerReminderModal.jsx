export default function JokerReminderModal({ days, onClose, onDismissForever }) {
  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>🃏 Joker Hatırlatması</span>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={m.hint}>
          Aşağıdaki günler için tahmin yaptın ama günlük joker hakkını kullanmadın.
          Maç başlamadan önce ⚽ Tahminler sekmesinden o güne gidip 🃏 butonuna basabilirsin:
        </p>

        <ul style={m.list}>
          {days.map(day => (
            <li key={day} style={m.listItem}>
              {new Date(day + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </li>
          ))}
        </ul>

        <button style={m.btn} onClick={onClose}>Tamam, anladım</button>
        <button style={m.linkBtn} onClick={onDismissForever}>Bir daha gösterme</button>
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
  hint:     { fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.5 },
  list:     { listStyle:'none', display:'flex', flexDirection:'column', gap:8, margin:'0 0 16px', padding:0 },
  listItem: { background:'rgba(245,197,24,.1)', border:'1px solid rgba(245,197,24,.25)', borderRadius:10, padding:'10px 14px', color:'#f5c518', fontSize:13, fontWeight:600, textTransform:'capitalize' },
  btn:      { width:'100%', background:'linear-gradient(90deg, var(--red), #f97316)', border:'none', borderRadius:12, padding:'13px 0', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' },
  linkBtn:  { width:'100%', background:'transparent', border:'none', color:'var(--muted)', fontSize:12, textAlign:'center', textDecoration:'underline', cursor:'pointer', marginTop:10, padding:0 },
}
