# 🌯 O Ses Çiğköfte POS & Adisyon Sistemi

![Version](https://img.shields.io/badge/version-1.1.0-brightgreen.svg)
![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-blue.svg)
![inPOS m530](https://img.shields.io/badge/inPOS%20m530-GMP--3-orange.svg)

Dokunmatik kasa uyumlu, **inPOS m530 YN ÖKC POS entegrasyonlu**, sıfır harici sunucu maliyetli **POS, Adisyon, Müşteri Rehberi, Raporlama ve Karekod (QR) Masadan Sipariş Sistemi**.

---

## ✨ Öne Çıkan Özellikler

- 💳 **inPOS m530 (Mikrosaray) YN ÖKC Entegrasyonu:** Bilgisayardan tek tıkla tutar (örn: ₺150.00) kablosuz/kablolu ağ (IP Socket / Serial COM / Simülasyon) üzerinden inPOS m530 ekranına otomatik aktarılır.
- 🛡️ **Yönetici PIN Güvenliği & Akıllı Oturum (30 Dakika Hatırla):** Varsayılan PIN `oses1234`. Bir kez şifre girildikten sonra 30 dakika boyunca kesintisiz yetkilendirme. İstenildiği an tek tıkla **`🔒 Kilitli`** moduna geçiş.
- 🍽️ **Açık Masalar & Kağıt İsrafını Önleyen Çift Fiş İptali:** Masaya sipariş verirken **`📄 Mutfak / Ara Fiş`** çıktısı alınır; ödeme aşamasında tekrar ikinci gereksiz fiş basımı yapılmaz.
- 🏷️ **Çiftli Fiyatlandırma (Gel-Al & Masa Fiyatı):** Her ürün için Gel-Al ve Masa/Salon fiyatları ayrı yönetilir.
- 🖥️ **Dokunmatik Kasa POS Arayüzü:** Hızlı kategori/ürün seçimi, garnitür ve sos opsiyonları, parçalı ödeme (Nakit, Kredi Kartı, Veresiye).
- 🖨️ **80mm Termal Fiş Çıktısı (SPENTA SPR-160P):** Mutfak ve adisyon fişi yazdırma.
- 📱 **QR Menü & Masadan Sipariş (`/qr`):** Müşterilerin kendi telefonlarından masadaki QR kodu okutarak sipariş vermesi ve kasada onay paneli (`✅ ONAYLA` / `❌ REDDET`).
- 🔗 **Vercel Smart QR Redirector (`redirector/`):** Dinamik IP/Tünel adres değişikliklerinde masalardaki sabit QR kodları değiştirmeden otomatik yönlendirme.
- 🪟 **Tam Otomatik Windows Installer (`windows_installer/`):** Tek tıkla Python kurulumu, `venv` bağımlılıkları, `cloudflared.exe` indirme ve Windows Başlangıç (`shell:startup`) servisi oluşturma.

---

## 📚 Dokümantasyon & Rehberler

- 📜 [Proje Geliştirme Hikayesi ve Evreleri (PROJECT_HISTORY)](PROJECT_HISTORY.md)
- 📝 [Geliştirici Günlüğü (DEVLOG)](DEVLOG.md)
- 🪟 [Windows Otomatik Kurulum Sihirbazı](windows_installer/README.md)
- 📖 [Windows Detaylı Kurulum ve Kullanım Kılavuzu](WINDOWS_KURULUM_VE_KULLANIM.md)
- ⚙️ [Genel Kurulum ve Veritabanı Rehberi](KURULUM_VE_VERITABANI_REHBERI.md)
- 🌐 [Vercel Redirector Kurulum Rehberi](redirector/README.md)

---

## 🚀 Hızlı Başlangıç

### Windows
`windows_installer/run_installer.bat` veya `run_windows.bat` dosyasına tıklayarak başlatabilirsiniz.

### macOS / Linux
```bash
chmod +x run_mac.sh run_tunnel_mac.sh
./run_mac.sh
```

---

## 🛠️ Teknolojiler

- **Backend:** Python 3.9+, FastAPI, Uvicorn
- **POS / ÖKC Sürücüsü:** GMP-3 Protokolü (`gmp3_driver.py` - inPOS m530 Mikrosaray A.Ş.)
- **Database:** SQLite (WAL Mode, `busy_timeout=30000`)
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism design), JavaScript ES6+
- **Tunneling:** Cloudflare Tunnel (`cloudflared`) & Vercel Serverless Redirector
