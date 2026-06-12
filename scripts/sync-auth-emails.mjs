import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, recovery_email')
    .not('recovery_email', 'is', null)

  if (error) {
    console.error('❌ Profiller alınamadı:', error.message)
    process.exit(1)
  }

  console.log(`📦 ${profiles.length} profil bulundu, kontrol ediliyor...\n`)

  for (const p of profiles) {
    const { data: userRes, error: getErr } = await supabase.auth.admin.getUserById(p.id)
    if (getErr) {
      console.error(`❌ ${p.username}: kullanıcı alınamadı - ${getErr.message}`)
      continue
    }

    const currentEmail = userRes.user?.email
    if (currentEmail === p.recovery_email) {
      console.log(`✓ ${p.username}: zaten güncel (${currentEmail})`)
      continue
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(p.id, {
      email: p.recovery_email,
      email_confirm: true
    })

    if (updateErr) {
      console.error(`❌ ${p.username}: güncellenemedi - ${updateErr.message}`)
    } else {
      console.log(`✅ ${p.username}: ${currentEmail} -> ${p.recovery_email}`)
    }
  }

  console.log('\n🎉 Senkronizasyon tamamlandı!')
}

main()
