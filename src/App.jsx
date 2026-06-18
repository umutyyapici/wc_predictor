import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import { calcPoints, isBettingOpen } from './lib/scoring.js'
import AuthScreen from './components/AuthScreen.jsx'
import PredictTab from './components/PredictTab.jsx'
import LeagueTab from './components/LeagueTab.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import RecoveryEmailModal from './components/RecoveryEmailModal.jsx'
import ChangePasswordModal from './components/ChangePasswordModal.jsx'
import JokerReminderModal from './components/JokerReminderModal.jsx'
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx'

export default function App() {
  const [session, setSession]       = useState(null)
  const [profile, setProfile]       = useState(null)
  const [matches, setMatches]       = useState([])
  const [myPreds, setMyPreds]       = useState({})
  const [activeTab, setActiveTab]   = useState('predict')
  const [showAdmin, setShowAdmin]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const [myGroups, setMyGroups]         = useState([])
  const [activeGroup, setActiveGroup]   = useState(null)
  const [groupCutoffs, setGroupCutoffs] = useState({})
  const [showJoinModal, setShowJoinModal]       = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [jokerReminderDismissed, setJokerReminderDismissed] = useState(false)

  // ─── AUTH ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadData(data.session.user)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setLoading(false); return }
      setSession(session)
      if (session) loadData(session.user)
      else { setProfile(null); setMatches([]); setMyPreds([]); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ─── REALTIME ────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    let timeout
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        clearTimeout(timeout)
        timeout = setTimeout(loadMatches, 1000)
      })
      .subscribe()
    return () => {
      clearTimeout(timeout)
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [session])

  // ─── KURTARMA E-POSTASI HATIRLATMASI ─────────────────────────
  useEffect(() => {
    if (!profile) return
    if (profile.recovery_email) { setShowRecoveryModal(false); return }
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
    const dismissed = localStorage.getItem('wc_recovery_dismiss_date')
    if (dismissed !== todayKey) setShowRecoveryModal(true)
  }, [profile])

  // ─── LOAD ────────────────────────────────────────────────────
  const loadData = async (user) => {
    setLoading(true)
    await Promise.all([loadProfile(user), loadMatches(), loadMyPreds(user.id)])
    await loadMyGroups(user.id)
    setLoading(false)
  }

  const loadProfile = async (user) => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()

    if (!data) {
      const username = user.user_metadata?.username || user.email.split('@')[0]
      const rawCode = user.user_metadata?.invite_code || user.user_metadata?.inviteCode || ''
      const cleanCode = rawCode.toLowerCase().trim() || null
      const recoveryEmail = user.user_metadata?.recovery_email || null
      await supabase.from('profiles').insert({ id: user.id, username, invite_code: cleanCode, recovery_email: recoveryEmail })
      if (cleanCode) {
        await supabase.from('user_groups').insert({ user_id: user.id, invite_code: cleanCode })
      }
      setProfile({ id: user.id, username, invite_code: cleanCode, recovery_email: recoveryEmail })
    } else {
      setProfile(data)
    }
  }

  const loadMyGroups = async (userId) => {
    const { data } = await supabase
      .from('user_groups').select('invite_code').eq('user_id', userId).order('joined_at', { ascending: true })

    if (data && data.length > 0) {
      const codes = data.map(g => g.invite_code)
      setMyGroups(codes)
      setActiveGroup(prev => prev && codes.includes(prev) ? prev : codes[0])

      const { data: groupRows } = await supabase
        .from('allowed_groups').select('code, created_at').in('code', codes)

      if (groupRows) {
        const cutoffs = {}
        groupRows.forEach(g => { cutoffs[g.code] = g.created_at })
        setGroupCutoffs(cutoffs)
      }
    }
  }

  const loadMatches = async () => {
    const { data } = await supabase.from('matches').select('*').order('match_datetime', { ascending: true })
    if (data) setMatches(data)
  }

  const loadMyPreds = async (userId) => {
    const { data } = await supabase.from('predictions').select('*').eq('user_id', userId)
    if (data) {
      const map = {}
      data.forEach(p => { map[p.match_id] = p })
      setMyPreds(map)
    }
  }

  const handleAuth           = (user) => loadData(user)
  const handleLogout         = async () => { await supabase.auth.signOut() }
  const handleMatchesUpdated = () => loadMatches()
  const handlePredSaved      = () => {
    if (!session) return
    loadMyPreds(session.user.id)
    setJokerReminderDismissed(false)
  }

  // ─── JOKER HATIRLATMASI ───────────────────────────────────────
  const dayKey = (dt) => new Date(dt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })

  const getMissingJokerDays = () => {
    const dayMap = {}
    matches.forEach(m => {
      const dt = m.match_datetime || m.match_date
      if (!dt) return
      const pred = myPreds[m.id]
      if (!pred) return
      const key = dayKey(dt)
      if (!dayMap[key]) dayMap[key] = { hasJoker: false, anyOpen: false }
      if (pred.is_joker) dayMap[key].hasJoker = true
      if (!m.locked && isBettingOpen(m.match_datetime)) dayMap[key].anyOpen = true
    })
    return Object.keys(dayMap).filter(k => dayMap[k].anyOpen && !dayMap[k].hasJoker).sort()
  }

  const calcMyTotal = () => {
    let total = 0
    const cutoff = groupCutoffs[activeGroup]
    Object.values(myPreds).forEach(p => {
      const match = matches.find(m => m.id === p.match_id)
      if (!match || !match.locked) return
      if (cutoff && match.match_datetime && new Date(match.match_datetime) < new Date(cutoff)) return
      const pts = calcPoints(p.pred_home, p.pred_away, match.actual_home, match.actual_away, p.is_joker)
      if (pts !== null) total += pts
    })
    return total
  }

  // ─── RENDER ──────────────────────────────────────────────────
  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => {
      setPasswordRecovery(false)
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        if (data.session) loadData(data.session.user)
        else setLoading(false)
      })
    }} />
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontSize: 40 }}>⚽</span>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )

  if (!session) return <AuthScreen onAuth={handleAuth} />

  const total = calcMyTotal()
  const missingJokerDays = getMissingJokerDays()
  const jokerReminderDisabled = localStorage.getItem('wc_joker_reminder_disabled') === '1'
  const showJokerModal = !jokerReminderDisabled && missingJokerDays.length > 0 && !jokerReminderDismissed

  return (
    <div style={s.app}>
      {showAdmin && (
        <AdminPanel matches={matches} onClose={() => setShowAdmin(false)} onMatchesUpdated={handleMatchesUpdated} />
      )}

      {showRecoveryModal && (
        <RecoveryEmailModal
          userId={session.user.id}
          onClose={() => {
            const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
            localStorage.setItem('wc_recovery_dismiss_date', todayKey)
            setShowRecoveryModal(false)
          }}
          onSaved={(recoveryEmail) => {
            setProfile(p => ({ ...p, recovery_email: recoveryEmail }))
            setShowRecoveryModal(false)
          }}
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {showJokerModal && (
        <JokerReminderModal
          days={missingJokerDays}
          onClose={() => setJokerReminderDismissed(true)}
          onDismissForever={() => {
            localStorage.setItem('wc_joker_reminder_disabled', '1')
            setJokerReminderDismissed(true)
          }}
        />
      )}

      {showJoinModal && (
        <JoinGroupModal
          userId={session.user.id}
          myGroups={myGroups}
          onClose={() => setShowJoinModal(false)}
          onJoined={async (code) => {
            setShowJoinModal(false)
            await loadMyGroups(session.user.id)
            setActiveGroup(code)
          }}
        />
      )}

      {/* HEADER */}
      <header style={s.header}>
        <div>
          <div style={s.logo}>🏆 World Cup F26</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
            <div style={s.username}>👤 {profile?.username}</div>
            {myGroups.map(code => (
              <button
                key={code}
                style={{ ...s.groupTag, ...(activeGroup === code ? s.groupTagActive : s.groupTagInactive) }}
                onClick={() => setActiveGroup(code)}
              >
                #{code}
              </button>
            ))}
            <button style={s.joinBtn} onClick={() => setShowJoinModal(true)} title="Başka bir lige katıl">+</button>
          </div>
        </div>
        <div style={s.headerRight}>
          <div style={s.scoreBox}>
            <span style={s.scoreNum}>{total}</span>
            <span style={s.scoreLbl}>puan</span>
          </div>
          <div style={s.headerBtns}>
            <button style={s.adminBtn} onClick={() => setShowPasswordModal(true)} title="Şifre Değiştir">🔒</button>
            {profile?.is_admin && <button style={s.adminBtn} onClick={() => setShowAdmin(true)} title="Admin">⚙️</button>}
            <button style={s.logoutBtn} onClick={handleLogout} title="Çıkış">↩</button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <nav style={s.nav}>
        <button style={activeTab === 'predict' ? s.tabActive : s.tab} onClick={() => setActiveTab('predict')}>⚽ Tahminler</button>
        <button style={activeTab === 'league'  ? s.tabActive : s.tab} onClick={() => setActiveTab('league')}>🏆 Lig</button>
      </nav>

      {/* CONTENT */}
      <main>
        {activeTab === 'predict'
          ? <PredictTab
              matches={matches}
              myPreds={myPreds}
              userId={session.user.id}
              activeGroup={activeGroup}
              groupCutoff={groupCutoffs[activeGroup]}
              onPredSaved={handlePredSaved}
            />
          : <LeagueTab
              matches={matches}
              currentUserId={session.user.id}
              activeGroup={activeGroup}
              groupCutoff={groupCutoffs[activeGroup]}
            />
        }
      </main>
    </div>
  )
}

// ─── LİGE KATIL MODAL ────────────────────────────────────────
function JoinGroupModal({ userId, myGroups, onClose, onJoined }) {
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    setError('')
    const clean = code.toLowerCase().trim()
    if (!clean) { setError('Kod boş olamaz.'); return }
    if (myGroups.includes(clean)) { setError('Bu lige zaten katıldın.'); return }

    setLoading(true)
    const { data: valid } = await supabase
      .from('allowed_groups').select('code').eq('code', clean).maybeSingle()

    if (!valid) { setLoading(false); setError('Geçersiz davetiye kodu.'); return }

    const { error: insertErr } = await supabase
      .from('user_groups').insert({ user_id: userId, invite_code: clean })

    setLoading(false)
    if (insertErr) { setError('Hata: ' + insertErr.message); return }
    onJoined(clean)
  }

  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={m.top}>
          <span style={m.title}>🏆 Yeni Lige Katıl</span>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={m.hint}>Katılmak istediğin ligin davetiye kodunu gir:</p>
        <input
          style={m.input}
          placeholder="Davetiye kodunu gir..."
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          autoFocus
        />
        {error && <div style={m.error}>⚠️ {error}</div>}
        <button style={{ ...m.btn, opacity: loading ? .6 : 1 }} onClick={handleJoin} disabled={loading}>
          {loading ? 'Kontrol ediliyor...' : 'Katıl →'}
        </button>
      </div>
    </div>
  )
}

const s = {
  app:             { maxWidth: 520, margin: '0 auto', minHeight: '100vh' },
  header:          { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,17,32,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo:            { fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 3, color: 'var(--gold)' },
  username:        { fontSize: 12, color: 'var(--muted)' },
  groupTag:        { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, border: 'none', cursor: 'pointer', transition: 'all .15s' },
  groupTagActive:  { background: 'rgba(74,222,128,.18)', color: '#4ade80' },
  groupTagInactive:{ background: 'rgba(255,255,255,.06)', color: '#6b7280' },
  joinBtn:         { fontSize: 13, fontWeight: 700, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 },
  headerRight:     { display: 'flex', alignItems: 'center', gap: 10 },
  scoreBox:        { textAlign: 'right' },
  scoreNum:        { fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--gold)', letterSpacing: 1, display: 'block' },
  scoreLbl:        { fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: -4 },
  headerBtns:      { display: 'flex', flexDirection: 'column', gap: 4 },
  adminBtn:        { background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 12, cursor: 'pointer' },
  logoutBtn:       { background: 'rgba(225,29,72,.15)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fca5a5', fontSize: 12, cursor: 'pointer' },
  nav:             { display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  tab:             { flex: 1, background: 'transparent', border: 'none', padding: '13px 0', color: 'var(--muted)', fontSize: 14, letterSpacing: .5, cursor: 'pointer' },
  tabActive:       { flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid var(--red)', padding: '13px 0', color: 'var(--text)', fontSize: 14, fontWeight: 700, letterSpacing: .5, cursor: 'pointer' },
}

const m = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 360 },
  top:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:    { fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 2, color: 'var(--gold)' },
  closeBtn: { background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 13, cursor: 'pointer' },
  hint:     { fontSize: 13, color: 'var(--muted)', marginBottom: 14 },
  input:    { width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', marginBottom: 10 },
  error:    { background: 'rgba(225,29,72,.15)', border: '1px solid rgba(225,29,72,.3)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 10 },
  btn:      { width: '100%', background: 'linear-gradient(90deg, var(--red), #f97316)', border: 'none', borderRadius: 12, padding: '13px 0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
