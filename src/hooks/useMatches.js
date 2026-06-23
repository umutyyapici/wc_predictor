import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useMatches(session) {
  const [matches, setMatches] = useState(() => {
    try { const c = sessionStorage.getItem('wc_matches'); return c ? JSON.parse(c) : [] } catch { return [] }
  })

  const loadMatches = async () => {
    const { data } = await supabase
      .from('matches').select('*').order('match_datetime', { ascending: true })
    if (data) {
      setMatches(data)
      try { sessionStorage.setItem('wc_matches', JSON.stringify(data)) } catch {}
    }
  }

  // Maç sonucu girildiğinde realtime bildirim → 1 sn debounce ile yenile
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

  return { matches, setMatches, loadMatches }
}
