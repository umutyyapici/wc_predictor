// Supabase auth hata mesajlarını kullanıcıya Türkçe göstermek için çevirir.
export function translateAuthError(message) {
  if (!message) return 'Bilinmeyen bir hata oluştu.'

  if (message.includes('Password should contain at least one character of each')) {
    return 'Şifre en az bir küçük harf, bir büyük harf ve bir rakam içermeli.'
  }
  if (message.includes('Password should be at least')) {
    const match = message.match(/at least (\d+)/)
    const n = match ? match[1] : '6'
    return `Şifre en az ${n} karakter olmalı.`
  }
  if (message.includes('already exists') || message.includes('already registered')) {
    return 'Bu kullanıcı adı veya e-posta sistemde zaten kayıtlı.'
  }
  if (message.includes('Invalid login credentials')) {
    return 'Kullanıcı adı veya şifre hatalı.'
  }
  if (message.includes('rate limit')) {
    return 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.'
  }

  return message
}
