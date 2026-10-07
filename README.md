# 🌯 O Ses Çiğköfte POS & Adisyon Sistemi

![Version](https://img.shields.io/badge/version-1.7.0-brightgreen.svg)
![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-blue.svg)

Dokunmatik kasa uyumlu, sıfır harici sunucu maliyetli **POS, Adisyon, Müşteri Rehberi, Raporlama ve Karekod (QR) Masadan Sipariş Sistemi**.

---

## ✨ Öne Çıkan Özellikler

- 🖥️ **Dokunmatik Kasa POS Arayüzü:** Hızlı kategori/ürün seçimi, garnitür ve sos opsiyonları, parçalı ödeme (Nakit, Kredi Kartı, Veresiye).
- 🖨️ **80mm Termal Fiş Çıktısı:** Saniyeler içinde mutfak ve adisyon fişi yazdırma.
- 📱 **QR Menü & Masadan Sipariş (`/qr`):** Müşterilerin kendi telefonlarından masadaki QR kodu okutarak sipariş vermesi.
- 🛡️ **Kasada Sipariş Onay Mekanizması:** Şaka/çocuk siparişlerini engellemek için kasada sesli zil ikazı ve kasa görevlisi onayı (`✅ ONAYLA` / `❌ REDDET`).
- 🔗 **Vercel Smart QR Redirector (`redirector/`):** Dinamik IP/Tünel adres değişikliklerinde masalardaki sabit QR kodları değiştirmeden otomatik yönlendirme.
- 👥 **Müşteri Rehberi (CRUD):** Müşteri arama, adres kaydı, özel sipariş notu ve geçmiş sipariş özeti.
- 📊 **7 KPI Göstergeli Analiz & Raporlama:** Günlük/Aylık ciro, ödeme türü dağılımları ve çok satan ürün analizleri.

---

## 📚 Dokümantasyon

- 🪟 [Windows Otomatik Kurulum Sihirbazı](windows_installer/README.md)
- 📖 [Windows Detaylı Kurulum ve Kullanım Kılavuzu](WINDOWS_KURULUM_VE_KULLANIM.md)
- ⚙️ [Genel Kurulum ve Veritabanı Rehberi](KURULUM_VE_VERITABANI_REHBERI.md)
- 🌐 [Vercel Redirector Kurulum Rehberi](redirector/README.md)
- 📝 [Geliştirici Günlüğü (DEVLOG)](DEVLOG.md)

---

## 🚀 Hızlı Başlangıç

### Windows
```cmd
run_windows.bat
```

### macOS / Linux
```bash
chmod +x run_mac.sh run_tunnel_mac.sh
./run_mac.sh
```

---

## 🛠️ Teknolojiler

- **Backend:** Python 3.9+, FastAPI, Uvicorn
- **Database:** SQLite (WAL Mode, `busy_timeout=30000`)
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism design), JavaScript ES6+
- **Tunneling:** Cloudflare Tunnel (`cloudflared`) & Vercel Serverless Redirector
