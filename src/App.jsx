import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import { calcPoints } from './lib/scoring.js'
import AuthScreen from './components/AuthScreen.jsx'
import PredictTab from './components/PredictTab.jsx'
import LeaderboardTab from './components/LeaderboardTab.jsx'
import AdminPanel from './components/AdminPanel.jsx'

export default function App() {
  const [session, setSession]       = useState(null)
  const [profile, setProfile]       = useState(null)
  const [matches, setMatches]       = useState([])
  const [myPreds, setMyPreds]       = useState({})   // { match_id: pred }
  const [activeTab, setActiveTab]   = useState('predict')
  const [showAdmin, setShowAdmin]   = useState(false)
  const [loading, setLoading]       = useState(true)

  // ─── AUTH ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadData(data.session.user)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadData(session.user)
      else { setProfile(null); setMatches([]); setMyPreds([]); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ─── REALTIME: maç güncellenince tüm kullanıcılara yansısın ──
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  // ─── LOAD ────────────────────────────────────────────────────
  const loadData = async (user) => {
    setLoading(true)
    await Promise.all([loadProfile(user), loadMatches(), loadMyPreds(user.id)])
    setLoading(false)
  }

  const loadProfile = async (user) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!data) {
      // Profil yoksa oluştur (ilk giriş)
      const username = user.user_metadata?.username || user.email.split('@')[0]
      await supabase.from('profiles').insert({ id: user.id, username })
      setProfile({ id: user.id, username })
    } else {
      setProfile(data)
    }
  }

  const loadMatches = async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })
    if (data) setMatches(data)
  }

  const loadMyPreds = async (userId) => {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
    if (data) {
      const map = {}
      data.forEach(p => { map[p.match_id] = p })
      setMyPreds(map)
    }
  }

  const handleAuth = (user) => loadData(user)
  const handleLogout = async () => { await supabase.auth.signOut() }
  const handlePredSaved = () => session && loadMyPreds(session.user.id)
  const handleMatchesUpdated = () => loadMatches()

  // Tamamlanan maçlarda kullanıcının toplam puanı
  const calcMyTotal = () => {
    let total = 0
    Object.values(myPreds).forEach(p => {
      const match = matches.find(m => m.id === p.match_id)
      if (!match || !match.locked) return
      const pH = parseInt(p.pred_home), pA = parseInt(p.pred_away)
      const aH = parseInt(match.actual_home), aA = parseInt(match.actual_away)
      if (isNaN(pH)||isNaN(pA)||isNaN(aH)||isNaN(aA)) return
      const pR = pH>pA?'1':pH<pA?'2':'X'
      const aR = aH>aA?'1':aH<aA?'2':'X'
      if (pR===aR) total+=3
      if (pH===aH) total+=1
      if (pA===aA) total+=1
      if (pH===aH&&pA===aA) total+=1
    })
    return total
  }

  // ─── RENDER ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <span style={{fontSize:40}}>⚽</span>
      <div style={{width:32,height:32,border:'3px solid rgba(255,255,255,.1)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
    </div>
  )

  if (!session) return <AuthScreen onAuth={handleAuth} />

  const total = calcMyTotal()

  return (
    <div style={s.app}>
      {showAdmin && (
        <AdminPanel
          matches={matches}
          onClose={() => setShowAdmin(false)}
          onMatchesUpdated={handleMatchesUpdated}
        />
      )}

      {/* HEADER */}
      <header style={s.header}>
        <div>
          <div style={s.logo}>🏆 World Cup F26</div>
          <div style={s.username}>👤 {profile?.username}</div>
        </div>
        <div style={s.headerRight}>
          <div style={s.scoreBox}>
            <span style={s.scoreNum}>{total}</span>
            <span style={s.scoreLbl}>puan</span>
          </div>
          <div style={s.headerBtns}>
            <button style={s.adminBtn} onClick={() => setShowAdmin(true)} title="Admin">⚙️</button>
            <button style={s.logoutBtn} onClick={handleLogout} title="Çıkış">↩</button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <nav style={s.nav}>
        <button
          style={activeTab==='predict' ? s.tabActive : s.tab}
          onClick={() => setActiveTab('predict')}
        >⚽ Tahminler</button>
        <button
          style={activeTab==='leaderboard' ? s.tabActive : s.tab}
          onClick={() => setActiveTab('leaderboard')}
        >🏅 Sıralama</button>
      </nav>

      {/* CONTENT */}
      <main>
        {activeTab === 'predict'
          ? <PredictTab matches={matches} myPreds={myPreds} userId={session.user.id} onPredSaved={handlePredSaved} />
          : <LeaderboardTab matches={matches} currentUserId={session.user.id} />
        }
      </main>
    </div>
  )
}

const s = {
  app: { maxWidth:520, margin:'0 auto', minHeight:'100vh' },
  header: { position:'sticky', top:0, zIndex:50, background:'rgba(13,17,32,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  logo: { fontFamily:'var(--font-display)', fontSize:18, letterSpacing:3, color:'var(--gold)' },
  username: { fontSize:12, color:'var(--muted)', marginTop:2 },
  headerRight: { display:'flex', alignItems:'center', gap:10 },
  scoreBox: { textAlign:'right' },
  scoreNum: { fontFamily:'var(--font-display)', fontSize:26, color:'var(--gold)', letterSpacing:1, display:'block' },
  scoreLbl: { fontSize:10, color:'var(--muted)', display:'block', marginTop:-4 },
  headerBtns: { display:'flex', flexDirection:'column', gap:4 },
  adminBtn: { background:'rgba(255,255,255,.06)', border:'none', borderRadius:6, padding:'4px 8px', color:'#fff', fontSize:12 },
  logoutBtn: { background:'rgba(225,29,72,.15)', border:'none', borderRadius:6, padding:'4px 8px', color:'#fca5a5', fontSize:12 },
  nav: { display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)' },
  tab: { flex:1, background:'transparent', border:'none', padding:'13px 0', color:'var(--muted)', fontSize:14, letterSpacing:.5 },
  tabActive: { flex:1, background:'transparent', border:'none', borderBottom:'2px solid var(--red)', padding:'13px 0', color:'var(--text)', fontSize:14, fontWeight:700, letterSpacing:.5 },
}
