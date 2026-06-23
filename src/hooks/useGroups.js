import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useGroups() {
  const [profile, setProfile]           = useState(null)
  const [myPreds, setMyPreds]           = useState({})
  const [myGroups, setMyGroups]         = useState([])
  const [activeGroup, setActiveGroup]   = useState(null)
  const [groupCutoffs, setGroupCutoffs] = useState({})

  const loadProfile = async (user) => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()

    if (!data) {
      const username      = user.user_metadata?.username || user.email.split('@')[0]
      const rawCode       = user.user_metadata?.invite_code || user.user_metadata?.inviteCode || ''
      const cleanCode     = rawCode.toLowerCase().trim() || null
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

  const loadMyPreds = async (userId) => {
    const { data } = await supabase.from('predictions').select('*').eq('user_id', userId)
    if (data) {
      const map = {}
      data.forEach(p => { map[p.match_id] = p })
      setMyPreds(map)
    }
  }

  return {
    profile, setProfile,
    myPreds, setMyPreds,
    myGroups,
    activeGroup, setActiveGroup,
    groupCutoffs,
    loadProfile, loadMyGroups, loadMyPreds,
  }
}
