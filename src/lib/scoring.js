// ─── WORLD CUP F26 PUAN SİSTEMİ MOTORU ──────────────────────────
// TAM İSABET 🔥  -> Maç sonucu ve tam skor doğru                : +6 Puan
// KIL PAYI 🎯    -> Maç sonucu + ev sahibi veya dep golü doğru : +3 Puan
// STRATEJİST ↔️ -> Maç sonucu + gol farkı doğru (Skor yanlış)  : +2 Puan
// BİLGE 🔮       -> Sadece maç sonucu (1/X/2) doğru             : +1 Puan
// TESELLİ ⚽     -> Sonuç yanlış ama bir takımın golü doğru    : +1 Puan
// KAPLAMA 🃏    -> Joker hakkı kazanılan puanı ikiye katlar   : Maks 12 Puan
// ────────────────────────────────────────────────────────────────

export function calcPoints(predHome, predAway, actualHome, actualAway, isJoker = false) {
  const pH = parseInt(predHome), pA = parseInt(predAway)
  const aH = parseInt(actualHome), aA = parseInt(actualAway)
  if (isNaN(pH) || isNaN(pA) || isNaN(aH) || isNaN(aA)) return null

  const resultOk = (pH > pA ? '1' : pH < pA ? '2' : 'X') === (aH > aA ? '1' : aH < aA ? '2' : 'X')
  let pts = 0

  if (resultOk) {
    pts += 1                                  // BİLGE: sonuç doğru (+1)
    if (pH === aH) pts += 2                   // KIL PAYI adayı: ev golü doğru (+2)
    if (pA === aA) pts += 2                   // KIL PAYI adayı: deplasman golü doğru (+2)
    if ((pH - pA) === (aH - aA)) pts += 1    // STRATEJİST / TAM İSABET adayı: gol farkı doğru (+1)
  } else {
    if (pH === aH) pts += 1                   // TESELLİ: sonuç yanlış ama ev golü doğru (+1)
    if (pA === aA) pts += 1                   // TESELLİ: sonuç yanlış ama deplasman golü doğru (+1)
  }

  // Joker kullanıldıysa hesaplanan puanı 2 ile çarp (maksimum 12 puan)
  return isJoker ? pts * 2 : pts
}

// ─── KRİSTAL PUAN SİSTEMİ ────────────────────────────────────────
// STRATEJİST: 3 puan (Lig'den farklı), BİLGE: 2 puan (Lig'den farklı)
// NADİR İSABET (+2 bonus) sunucu taraflı hesaplanır, burada dahil değildir.
// ────────────────────────────────────────────────────────────────
export function calcKristalPoints(predHome, predAway, actualHome, actualAway, isJoker = false) {
  const pH = parseInt(predHome), pA = parseInt(predAway)
  const aH = parseInt(actualHome), aA = parseInt(actualAway)
  if (isNaN(pH) || isNaN(pA) || isNaN(aH) || isNaN(aA)) return null

  const resultOk = (pH > pA ? '1' : pH < pA ? '2' : 'X') === (aH > aA ? '1' : aH < aA ? '2' : 'X')
  let pts = 0

  if (resultOk) {
    const exactScore = pH === aH && pA === aA
    const oneGoalOk  = pH === aH || pA === aA
    const diffOk     = (pH - pA) === (aH - aA)

    if (exactScore)     pts = 6   // TAM İSABET
    else if (oneGoalOk) pts = 3   // KIL PAYI
    else if (diffOk)    pts = 3   // STRATEJİST
    else                pts = 2   // BİLGE
  } else {
    if (pH === aH) pts += 1       // TESELLİ: ev golü doğru
    if (pA === aA) pts += 1       // TESELLİ: deplasman golü doğru
  }

  return isJoker ? pts * 2 : pts
}

export function getResultChar(home, away) {
  const h = parseInt(home), a = parseInt(away)
  if (isNaN(h) || isNaN(a)) return '?'
  return h > a ? '1' : h < a ? '2' : 'X'
}

// Bahisler maç saatinden tam 1 saat (3600000 ms) önce kilitlenir.
// SQL şemasındaki RLS kuralları ile tam eşleşmektedir.
export function isBettingOpen(matchDatetimeUTC) {
  if (!matchDatetimeUTC) return true
  const cutoff = new Date(new Date(matchDatetimeUTC).getTime() - 60 * 60 * 1000)
  return new Date() < cutoff
}

export function formatTR(datetimeUTC) {
  if (!datetimeUTC) return ''
  return new Date(datetimeUTC).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  }) + ' (TR)'
}

export function todayTR() {
  return new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
}
