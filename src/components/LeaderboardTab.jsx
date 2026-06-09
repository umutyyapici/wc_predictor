import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcPoints, getResultChar } from '../lib/scoring.js'

export default function LeaderboardTab({ matches, currentUserId }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  
  // ── SAYFALAMA STATE'LERİ ──────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => { 
    loadLeaderboard() 
  }, [matches?.length])

  const loadLeaderboard = async () => {
    setLoading(true)

    // 1) Önce giriş yapan güncel kullanıcının hangi grupta olduğunu öğreniyoruz 🔑
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('invite_code')
      .eq('id', currentUserId)
      .single();

    const myGroup = myProfile?.invite_code || 'kodsuz';

    // 2) Tahminleri ve kullanıcıların invite_code alanlarını çekiyoruz
    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id, match_id, pred_home, pred_away, is_joker, profiles(username, invite_code)')

    if (!preds) { setLoading(false); return }

    // 3) Gelen tüm tahmin havuzunu SADECE bizimle aynı grupta olan oyunculara göre filtreliyoruz 🎯
    const filteredPreds = preds.filter(p => (p.profiles?.invite_code || 'kodsuz') === myGroup);

    const userMap = {}
    filteredPreds.forEach(p => {
      const uid   = p.user_id
      const uname = p.profiles?.username || 'Anonim'
      if (!userMap[uid]) userMap[uid] = {
        uid, username: uname,
        total:         0,
        pred_count:    0,  
        tam_isabet:    0,  
        kil_payi:      0,  
        strategist:    0,  
        bilge:         0,  
        teselli:       0,  
        joker_count:   0,
        details:       []
      }

      userMap[uid].pred_count++  

      const match = matches.find(m => m.id === p.match_id)
      if (!match || !match.locked) return

      const pts = calcPoints(p.pred_home, p.pred_away, match.actual_home, match.actual_away, p.is_joker)
      if (pts === null) return
      userMap[uid].total += pts
      if (p.is_joker) userMap[uid].joker_count++

      const pH = parseInt(p.pred_home), pA = parseInt(p.pred_away)
      const aH = parseInt(match.actual_home), aA = parseInt(match.actual_away)
      
      const resultOk   = (pH > pA ? '1' : pH < pA ? '2' : 'X') === (aH > aA ? '1' : aH < aA ? '2' : 'X')
      const homeGoalOk = pH === aH
      const awayGoalOk = pA === aA
      const exactOk    = homeGoalOk && awayGoalOk
      const diffOk     = resultOk && (pH - pA) === (aH - aA)

      if (resultOk && exactOk) {
        userMap[uid].tam_isabet++
      } else if (resultOk && (homeGoalOk || awayGoalOk)) {
        userMap[uid].kil_payi++
      } else if (resultOk && diffOk) {
        userMap[uid].strategist++
      } else if (resultOk) {
        userMap[uid].bilge++
      } else if (!resultOk && (homeGoalOk || awayGoalOk)) {
        userMap[uid].teselli++
      }

      userMap[uid].details.push({ match, pred: p, pts })
    })

    const sorted = Object.values(userMap).sort((a, b) => {
      if (b.total      !== a.total)      return b.total      - a.total      
      if (b.tam_isabet !== a.tam_isabet) return b.tam_isabet - a.tam_isabet 
      if (b.kil_payi   !== a.kil_payi)   return b.kil_payi   - a.kil_payi   
      if (b.strategist !== a.strategist) return b.strategist - a.strategist 
      if (b.bilge      !== a.bilge)      return b.bilge      - a.bilge      
      if (b.teselli    !== a.teselli)    return b.teselli    - a.teselli    
      if (a.pred_count !== b.pred_count) return a.pred_count - b.pred_count 
      return a.username.localeCompare(b.username, 'tr')
    })
    
    setRows(sorted)
    setLoading(false)
  }

  if (loading) return (
    <div style={s.center}>
      <span style={s.spinner} />
      <p style={s.loadText}>Yükleniyor...</p>
    </div>
  )

  const totalPages = Math.ceil(rows.length / itemsPerPage) || 1
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentRows = rows.slice(indexOfFirstItem, indexOfLastItem)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    setExpanded(null)
  }

  return (
    <div style={s.wrap}>
      <div style={s.hRow}>
        <span style={{ ...s.hLabel, flex: 1 }}>OYUNCU</span>
        <span style={{ ...s.hLabel, width: 64, textAlign: 'center' }}>TAHMİN</span>
        <span style={{ ...s.hLabel, width: 56, textAlign: 'right' }}>PUAN</span>
      </div>

      {rows.length === 0 && <div style={s.empty}>Henüz tamamlanmış maç yok.</div>}

      {currentRows.map((row, index) => {
        const realRank = indexOfFirstItem + index
        const medal = realRank === 0 ? '🥇' : realRank === 1 ? '🥈' : realRank === 2 ? '🥉' : null
        const isMe  = row.uid === currentUserId
        const isExp = expanded === row.uid
        return (
          <div key={row.uid}>
            <div style={{ ...s.row, ...(isMe ? s.rowMe : {}) }} onClick={() => setExpanded(isExp ? null : row.uid)}>
              <div style={s.rank}>{medal || <span style={s.rankNum}>#{realRank + 1}</span>}</div>
              <div style={s.name}>
                {row.username}
                {isMe && <span style={s.youBadge}>sen</span>}
                {row.joker_count > 0 && <span style={s.jokerBadge}>🃏×{row.joker_count}</span>}
              </div>
              <div style={s.predCountBox}>
                <span style={s.predCountNum}>{row.pred_count}</span>
                <span style={s.predCountLabel}>maç</span>
              </div>
              <div style={s.pts}>
                <span style={s.ptsNum}>{row.total}</span>
              </div>
              <span style={s.chev}>{isExp ? '▲' : '▼'}</span>
            </div>

            {isExp && (
              <div style={s.detail}>
                {/* 🎯 GÜNCELLENDİ: PREMIUM İKİ TARAFA YASLI VE HİZALANMIŞ DETAY ALANI */}
                <div style={s.breakdown}>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>📋 Tahmin Yapılan Maç</span>
                    <span style={s.bValueText}>{row.pred_count}</span>
                  </div>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>🔥 TAM İSABET Sayısı</span>
                    <span style={{ ...s.bValueText, color: 'var(--gold)' }}>{row.tam_isabet} maç</span>
                  </div>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>🎯 KIL PAYI Sayısı</span>
                    <span style={s.bValueText}>{row.kil_payi} maç</span>
                  </div>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>↔️ STRATEJİST Sayısı</span>
                    <span style={s.bValueText}>{row.strategist} maç</span>
                  </div>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>🔮 BİLGE Sayısı</span>
                    <span style={s.bValueText}>{row.bilge} maç</span>
                  </div>
                  <div style={s.bRow}>
                    <span style={s.bLabelText}>⚽ TESELLİ Sayısı</span>
                    <span style={s.bValueText}>{row.teselli} maç</span>
                  </div>
                  <div style={{ ...s.bRow, borderBottom: 'none', paddingBottom: 0 }}>
                    <span style={s.bLabelText}>🃏 Joker Kullanımı</span>
                    <span style={s.bValueText}>{row.joker_count}×</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── SAYFALAMA BUTON GRUBU ARAYÜZÜ ───────────────────────────── */}
      {totalPages > 1 && (
        <div style={s.paginationWrap}>
          <button 
            style={{ ...s.pageArrow, opacity: currentPage === 1 ? 0.3 : 1 }}
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            ‹ Önceki
          </button>
          
          <div style={s.pageNumbers}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                style={{
                  ...s.pageBtn,
                  ...(currentPage === pageNum ? s.pageBtnActive : {})
                }}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button 
            style={{ ...s.pageArrow, opacity: currentPage === totalPages ? 0.3 : 1 }}
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Sonraki ›
          </button>
        </div>
      )}

      {/* ── PUAN SİSTEMİ KARTI ──────────────────────────── */}
      <div style={s.newLegendCard}>
        <div style={s.newCardTitle}>🏆 PUAN SİSTEMİ</div>
        <div style={s.newGrid}>
          {[
            { tag: 'TAM İSABET 🔥', l: 'Maç sonucu (1/0/2) ve maç skoru doğru', v: '6 Puan', highlight: true },
            { tag: 'KIL PAYI 🎯', l: 'Maç sonucu (1/0/2) ve bir takımın gol sayısı doğru', v: '3 Puan' },
            { tag: 'STRATEJİST ↔️', l: 'Maç sonucu (1/0/2) ve gol farkı doğru', v: '2 Puan' },
            { tag: 'BİLGE 🔮', l: 'Sadece maç sonucu (1/0/2) doğru', v: '1 Puan' },
            { tag: 'TESELLİ ⚽', l: 'Sonuç yanlış ama bir takımın gol sayısı doğru', v: '1 Puan' },
            { tag: 'KAPLAMA 🃏', l: 'Joker hakkı kazanılan puanı ikiye katlar', v: 'Maks 12', joker: true },
          ].map((item, idx) => (
            <div key={idx} style={{
              ...s.newBoxRow,
              ...(item.highlight ? s.newBoxHighlight : {}),
              ...(item.joker ? s.newBoxJoker : {})
            }}>
              <div style={s.newBoxLeft}>
                <span style={{
                  ...s.newBoxTag,
                  ...(item.highlight ? { color: '#fbbf24' } : {}),
                  ...(item.joker ? { color: '#f87171' } : {})
                }}>{item.tag}</span>
                <span style={s.newBoxText}>{item.l}</span>
              </div>
              <span style={{
                ...s.newBoxBadge,
                ...(item.highlight ? s.newBadgeHighlight : {}),
                ...(item.joker ? s.newBadgeJoker : {})
              }}>{item.v}</span>
            </div>
          ))}
        </div>

        <div style={{ ...s.newCardTitle, marginTop: 24 }}>⚖️ EŞİTLİK BOZMA KRİTERLERİ</div>
        <div style={s.kravajContainer}>
          {[
            { n: '1', text: 'TAM İSABET Sayısı', sub: 'fazla → önce' },
            { n: '2', text: 'KIL PAYI Sayısı', sub: 'fazla → önce' },
            { n: '3', text: 'STRATEJİST Sayısı', sub: 'fazla → önce' },
            { n: '4', text: 'BİLGE Sayısı', sub: 'fazla → önce' },
            { n: '5', text: 'TESELLİ Sayısı', sub: 'fazla → önce' },
            { n: '6', text: 'Tahmin Yapılan Maç Sayısı', sub: 'az → önce' },
          ].map((item, idx) => (
            <div key={idx} style={s.kravajRow}>
              <div style={s.kravajNum}>{item.n}</div>
              <div style={s.kravajContent}>
                <span style={s.kravajText}>{item.text}</span>
                <span style={s.kravajSub}>({item.sub})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap:            { padding: '12px 14px', paddingBottom: 60, height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  center:          { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, gap: 12 },
  spinner:         { width: 28, height: 28, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
  loadText:        { color: '#6b7280', fontSize: 14 },
  empty:           { color: '#6b7280', textAlign: 'center', padding: 32, fontSize: 14 },
  hRow:            { display: 'flex', alignItems: 'center', paddingInline: 14, marginBottom: 8, gap: 8 },
  hLabel:          { fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase' },
  row:             { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 6, cursor: 'pointer' },
  rowMe:           { background: 'rgba(225,29,72,.1)', border: '1px solid rgba(225,29,72,.25)' },
  rank:            { width: 28, fontSize: 20, textAlign: 'center', flexShrink: 0 },
  rankNum:         { fontFamily: 'var(--font-display)', fontSize: 16, color: '#6b7280', letterSpacing: 1 },
  name:            { flex: 1, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' },
  youBadge:        { fontSize: 10, background: 'rgba(225,29,72,.3)', color: '#fca5a5', padding: '2px 6px', borderRadius: 20, fontWeight: 700, flexShrink: 0 },
  jokerBadge:      { fontSize: 11, color: '#f5c518', flexShrink: 0 },
  predCountBox:    { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 },
  predCountNum:    { fontFamily: 'var(--font-display)', fontSize: 18, color: '#9ca3af', letterSpacing: 1, lineHeight: 1 },
  predCountLabel:  { fontSize: 9, color: '#4b5563', letterSpacing: 1, textTransform: 'uppercase' },
  pts:             { display: 'flex', alignItems: 'center', width: 44, justifyContent: 'flex-end', flexShrink: 0 },
  ptsNum:          { fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--gold)', letterSpacing: 1 },
  chev:            { fontSize: 9, color: '#6b7280', flexShrink: 0 },
  
  // ── YENİLENEN MODAL DETAY ALANI TASARIMI ────────────────────────
  detail:          { background: 'rgba(20,27,47,0.7)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '16px 20px', marginBottom: 8, marginTop: -6, backdropFilter: 'blur(10px)' },
  breakdown:       { display: 'flex', flexDirection: 'column' },
  bRow:            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' },
  bLabelText:      { fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  bValueText:      { fontSize: 13, color: '#f1f5f9', fontWeight: 700, fontFamily: 'monospace' },

  paginationWrap:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '8px 12px', marginVertical: 14, marginBottom: 16 },
  pageArrow:       { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px' },
  pageNumbers:     { display: 'flex', gap: 6, alignItems: 'center' },
  pageBtn:         { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, width: 32, height: 32, color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageBtnActive:   { background: '#fbbf24', color: '#0f172a' },

  newLegendCard:   { marginTop: 24, padding: '20px 16px', background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '16px', backdropFilter: 'blur(8px)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' },
  newCardTitle:    { fontSize: 13, letterSpacing: '2px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', marginBottom: 14 },
  newGrid:         { display: 'flex', flexDirection: 'column', gap: '10px' },
  newBoxRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(30, 41, 59, 0.25)', border: '1px solid rgba(255, 255, 255, 0.02)', borderRadius: '12px' },
  newBoxHighlight: { background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' },
  newBoxJoker:     { background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)' },
  newBoxLeft:      { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '12px' },
  newBoxTag:       { fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px' },
  newBoxText:      { fontSize: 12, color: '#cbd5e1', fontWeight: 400, lineHeight: '1.4' },
  newBoxBadge:     { fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: 'rgba(71, 85, 105, 0.4)', color: '#94a3b8', whiteSpace: 'nowrap' },
  newBadgeHighlight: { background: '#f5c518', color: '#0f172a' },
  newBadgeJoker:   { background: '#ef4444', color: '#fff' },
  
  kravajContainer: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' },
  kravajRow:       { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  kravajNum:       { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', background: 'rgba(245, 197, 24, 0.15)', border: '1px solid rgba(245, 197, 24, 0.3)', color: '#f5c518', borderRadius: '50%', fontSize: '11px', fontWeight: 700, flexShrink: 0, marginTop: '1px' },
  kravajContent:  { display: 'flex', flexDirection: 'column', gap: '2px' },
  kravajText:     { fontSize: 13, color: '#e2e8f0', fontWeight: 500 },
  kravajSub:      { fontSize: 11, color: '#64748b' }
}