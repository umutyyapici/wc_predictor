# 🏆 WC Tahmin Ligi 2026

> Arkadaş grupları için Dünya Kupası maç skoru tahmin oyunu. Grup bazlı sıralama, joker sistemi ve otomatik maç/skor senkronizasyonu ile.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)

---

## ✨ Özellikler

- **🔒 Otomatik Bahis Kilidi:** Tahminler maç başlamadan 1 saat önce otomatik kilitlenir. Sonradan tahmin girme veya değiştirme mümkün değildir.
- **🃏 Günlük Joker:** Her kullanıcı günde 1 maça joker kullanabilir. Joker kazanılan puanı ikiye katlar.
- **👥 Grup Bazlı Sıralama:** Kullanıcılar kayıt sırasında davetiye koduyla gruba katılır. Her grup kendi içinde ayrı sıralanır.
- **👀 Diğer Tahminler:** Maç süresi dolunca veya maç kilitlenince, aynı gruptaki diğer kişilerin tahminleri görünür hale gelir.
- **🤖 Otomatik Maç/Skor Senkronizasyonu:** GitHub Actions ile saatlik çalışan iş akışı, Football-Data.org API'sinden maç takvimini ve sonuçları çekerek veritabanına yazar. Kilitlenmiş maçların üzerine yazılmaz.
- **📅 Takvim Navigasyonu:** Gün bazlı gezinme ve mini takvim ile turnuvanın herhangi bir gününe gidilebilir.

---

## 🎯 Puan Sistemi

| Kategori | Açıklama | Puan |
| :--- | :--- | :---: |
| **TAM İSABET 🔥** | Maç sonucu (1/X/2) ve tam skor doğru | **6** |
| **KIL PAYI 🎯** | Maç sonucu doğru + bir takımın golü doğru | **3** |
| **STRATEJİST ↔️** | Maç sonucu doğru + gol farkı doğru (goller yanlış) | **2** |
| **BİLGE 🔮** | Sadece maç sonucu (1/X/2) doğru | **1** |
| **TESELLİ ⚽** | Sonuç yanlış, ama bir takımın golü doğru | **1** |
| **KAPLAMA 🃏** | Joker aktifse tüm puanlar ×2 | **maks 12** |

---

## ⚖️ Eşitlik Bozma Kriterleri

Puan eşitliğinde sırasıyla:

1. TAM İSABET sayısı (fazla → önce)
2. KIL PAYI sayısı (fazla → önce)
3. STRATEJİST sayısı (fazla → önce)
4. BİLGE sayısı (fazla → önce)
5. TESELLİ sayısı (fazla → önce)
6. Tahmin yapılan maç sayısı (az → önce)
7. Alfabetik kullanıcı adı (Türkçe)

---

## 🚀 Teknoloji

| Katman | Teknoloji |
| :--- | :--- |
| Frontend | React + Vite (inline CSS) |
| Backend & Veritabanı | Supabase (PostgreSQL + Row Level Security) |
| Otomasyon | GitHub Actions + Node.js |
| Veri Kaynağı | [Football-Data.org API v4](https://www.football-data.org/) |
| Deploy | Vercel |

---

## ⚙️ Kurulum

### 1. Environment Variables

Proje kök dizininde `.env` dosyası oluştur:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_INVITE_CODE=davetiye_kodu
VITE_ADMIN_PASS=admin_sifresi
```

### 2. GitHub Secrets

Otomatik skor senkronizasyonu için **Settings → Secrets and variables → Actions** altına ekle:

| Secret | Açıklama |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Football-Data.org API anahtarı |
| `SUPABASE_URL` | Supabase proje URL'i |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role anahtarı |

### 3. Kurulum ve Çalıştırma

```bash
npm install
npm run dev
```

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────┐
│           GitHub Actions (Saatlik)          │
│   Football-Data.org API → Supabase          │
│   (Kilitli maçlar atlanır)                  │
└────────────────────┬────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Supabase  │  PostgreSQL + RLS
              │  (Database) │  Grup bazlı erişim
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │    React    │  Vite
              │  (Frontend) │  Vercel deploy
              └─────────────┘
```

---

*Futbol sevgisiyle yapıldı. En iyi tahmin eden kazansın.* ⚽🔥
