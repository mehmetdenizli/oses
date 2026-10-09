# O Ses Çiğköfte POS & Adisyon Sistemi - Geliştirme Günlüğü (Devlog / Changelog)

Bu dosya, projedeki tüm geliştirme aşamalarını, veritabanı güncellemelerini, mimari kararları, POS donanım entegrasyonlarını ve yeni eklenen özellikleri kayıt altında tutar.

---

## [1.1.0] - 2026-10-09

### 🚀 Major Versiyon Güncellemesi: inPOS m530 Entegrasyonu, Akıllı Oturum, Kağıt İsrafı Engelleme & Tam Windows Otomasyonu

#### 💳 1. Mikrosaray inPOS m530 YN ÖKC Entegrasyonu (`gmp3_driver.py`, `main.py`, `app.js`)
- **GMP-3 Protokol Sürücüsü (`gmp3_driver.py`):**
  - Gelir İdaresi Başkanlığı (GİB) onaylı GMP-3 ortak ÖKC entegrasyon protokolü yazıldı.
  - 3 Farklı Bağlantı Modu desteklenmektedir:
    1. **`IP` (Ethernet / Wi-Fi Ağ Bağlantısı):** TCP Socket (`port: 9090`) üzerinden bilgisayardan inPOS m530 cihazına tutar aktarır.
    2. **`SERIAL` (USB / RS232 Kablo):** COM port üzerinden haberleşir (`pyserial` kütüphanesi).
    3. **`SIMULATION` (Test / Çevrimdışı Mod):** Fiziksel POS cihazı bağlı değilken geliştirme ve test yapmak için otomatik onay simülasyonu sunar.
- **Otomatik Tutar Aktarımı:** Kasadan `💳 Kredi Kartı (inPOS m530)` butonuna basıldığı an tutar (örn: ₺150.00) kablosuz/kablolu ağ üzerinden inPOS m530 ekranına düşer; kasiyer elle tutar girmek zorunda kalmaz.
- **REST API Endpoint'leri:**
  - `POST /api/gmp3/send-payment`: Tutar aktarım komutunu tetikler.
  - `GET /api/gmp3/status`: inPOS m530 bağlantı ve cihaz durumunu döndürür.

#### 🛡️ 2. Yönetici PIN Güvenlik Mimarisi & Akıllı Oturum Sistemi (`database.py`, `app.js`, `index.html`)
- **Güvenli Varsayılan PIN:** Varsayılan yönetici şifresi **`oses1234`** olarak belirlendi.
- **Açık Metin Şifre Temizliği:** Arayüzdeki tüm modal başlıkları, butonlar, alt yazılar ve placeholder'lardaki açık metin PIN gösterimleri kaldırıldı.
- **Tek Kullanımlık PIN Doğrulama (`POST /api/verify-pin`):** Yönetici işlemleri backend tarafında doğrulama sorgusu ile korundu.
- **30 Dakikalık Akıllı Yönetici Oturumu (Admin Session Memory):**
  - Yönetici şifresini bir kez doğru girdiğinde sistem 30 dakika boyunca oturumu açık tutar.
  - Ürün fiyatı güncelleme, marka/logo değiştirme, müşteri silme veya menü sıfırlama işlemlerinde **her seferinde tekrar şifre girme yorgunluğu önlendi.**
  - Üst çubuğa canlı **`🔓 Yetkili (30 dk)`** rozet butonu eklendi. Butona basıldığında oturum anında **`🔒 Kilitli`** durumuna geçer.

#### 🍽️ 3. Masa / Salon Adisyon Modu & Kağıt İsrafını Önleyen Çift Fiş İptali (`database.py`, `app.js`, `index.html`)
- **Mutfak / Ara Fiş (Ödemesiz) Butonu (`📄 Mutfak / Ara Fiş`):**
  - Müşteri yemeden önce adisyon yazdırıldığında SPENTA SPR-160P termal yazıcıdan mutfak/ara adisyon fişi basılır.
  - Sipariş `order_status = 'BEKLIYOR'` ve `payment_method = 'ÖDEME BEKLİYOR'` olarak kaydedilir.
- **Canlı Açık Masalar Paneli (`renderMiniOpenTables`):**
  - Sağ panelde Live Adisyon (Sepet) kutusunun tam üzerine konumlandırıldı.
  - En son açılan 3 açık masayı canlı tutarlarıyla ve hızlı ödeme butonlarıyla (`💵`, `💳`, `🖨️`) gösterir; `Tümünü Gör 🔍` butonu ile modal açılır.
- **Kağıt İsrafını Önleyen Kapatma Mimarisi (`_checkoutOpenOrderInternal`):**
  - Açık masadan ödeme alındığında adisyon `TAMAMLANDI` durumuna geçer ancak **ikinci kez gereksiz termal fiş basımı YAPILMAZ**.
  - Kredi kartı ödemelerinde inPOS m530 cihazı banka POS slipini kendisi basar.

#### 🏷️ 4. Çiftli Fiyatlandırma Mimarisi (Gel-Al & Masa Fiyatı) (`database.py`, `main.py`, `app.js`)
- Her ürün için 2 ayrı fiyat tutulur: `price` (Gel-Al Fiyatı) ve `price_masa` (Masa / Salon Fiyatı).
- `PATCH /api/products/{id}/price` endpoint'i ile hızlı fiyat güncelleme sağlandı.

#### 🪟 5. Windows 10/11 Tam Otomatik Kurulum Sihirbazı (`windows_installer/`)
- Cross-Platform Mimari: Mac ve Windows işletim sistemlerinde tam uyumlu.
- `windows_installer/run_installer.bat` ve `setup_windows.ps1` scripti ile:
  1. Python 3.9+ var mı denetler, yoksa internetten **Python 3.11** indirip silent kurulum yapar.
  2. Sanal ortamı (`venv`) oluşturur ve `requirements.txt` bağımlılıklarını (`FastAPI`, `Uvicorn`, `Pydantic`, `PySerial`) yükler.
  3. `cloudflared.exe` tünel dosyasını indirir.
  4. Elektrik kesintisi ve açılış koruması için Windows Başlangıç Klasörüne (`shell:startup`) ve Görev Zamanlayıcısına (`Task Scheduler`) otomatik servis kaydı ekler.
  5. Masaüstüne Pencereli App Modu ve Kiosk Tam Ekran Modu kısayollarını oluşturur.

---

## [1.7.0] - 2026-10-02

### 🛡️ Kasa Onaylı Karekod Siparişi & Sahte/Şaka Sipariş Engelleme Mekanizması
- **🛡️ Kasa Görevlisi Onay Paneli (`index.html`, `app.js`, `main.py`, `database.py`):**
  - Karekod üzerinden gelen siparişler yazıcıyı meşgul etmeden ve kağıt israfı yapmadan önce `order_status = 'BEKLIYOR'` olarak tutulur.
  - POS ekranında turuncu renkte **`📱 1 Karekod Sipariş Onayı Bekliyor!`** uyarısı çalar.
  - Kasa görevlisi **`✅ ONAYLA VE FİŞ BASTIR`** butonuna bastığında fiş basılır; **`❌ REDDET / İPTAL ET`** butonuna bastığında şaka siparişler tek tıkla silinir.
- **📱 Müşteri Telefonunda Canlı Sipariş Takibi (`static/qr.html`):**
  - Müşteri kendi telefonunda siparişinin onay durumunu canlı görür (`⏳ Kasada Onay Bekliyor...` -> `🟢 Onaylandı! Fişiniz Basıldı 🖨️`).

---

## [1.6.0] - 2026-10-02

### 🚀 Vercel Akıllı QR Yönlendirici (0 TL - Ömür Boyu Sabit QR Kod Mimarisi)
- **🚀 Vercel Serverless Redirector (`redirector/`):**
  - Masalardaki QR kodların ömür boyu **HİÇ DEĞİŞMEMESİNİ** sağlayan %100 ücretsiz Vercel yönlendirici altyapısı (`redirector/vercel.json`, `redirector/api/redirect.js`, `redirector/api/update.js`).
  - Müşteriler `https://oses-pos.vercel.app/qr?masa=Masa1` adresinden 4G/5G ile 0.05 saniyede kasaya yönlendirilir.
- **⚡ Otomatik Target URL Senkronizasyonu (`run_tunnel_mac.sh`, `run_tunnel_windows.bat`):**
  - Kasa bilgisayarı açıldığında aktif Cloudflare tünel adresini otomatik Vercel'e bildirir.
- **🖨️ Masa Bazlı Toplu QR Etiket Basımı (`index.html`, `app.js`):**
  - `Tezgah`, `Masa 1` ... `Masa 10` için ayrı ayrı veya tek tıkla toplu QR etiket çıktısı alabilme.

---

## [1.5.0] - 2026-10-02

### 📱 Müşteri Karekod (QR) Self-Ordering & Otomatik Kasa Fişi Basım Sistemi
- **📱 Mobil Müşteri Sipariş Arayüzü (`static/qr.html`):**
  - Müşterilerin cep telefonlarından uygulama yüklemeden menüyü gezebileceği, acı ve garnitür seçeneklerini seçebileceği responsive QR web uygulaması.
  - Canlı sepet hesaplamaları (ilk 4 garnitür ücretsiz, ilave ücretler, ekstralar).
- **🖨️ Kasada Otomatik 80mm Fiş Basımı & Sesli Bildirim (`app.js`, `main.py`):**
  - Müşteri "Siparişi Ver" butonuna bastığı an kasadaki POS ekranı **"🔔 YENİ KAREKOD SİPARİŞİ GELDI!"** uyarısı verir.
  - `is_printed` bayrağı ile sipariş kasadaki 80mm termal yazıcıdan beklemeden **otomatik olarak basılır**.
- **🖼️ Kasa İçi QR Kod Oluşturucu ve Etiket Bastırıcı (`index.html`):**
  - Kasadan masa ve tezgah karekod etiketlerini tek tıkla bastırabilme özelliği.

---

## [1.4.0] - 2026-10-02

### 📖 Müşteri Kayıt Defteri - Müşteri Ekleme, Çıkartma ve Bilgi Düzenleme Paneli
- **Tam Müşteri CRUD Desteği (`database.py`, `main.py`, `app.js`):**
  - **➕ Müşteri Ekleme:** Müşteri Kayıt Defteri modalında veya arama alanından yeni müşteri ekleme formu.
  - **✏️ Müşteri Bilgisi Düzenleme:** Kayıtlı müşterilerin telefon numarası, ad-soyadı, teslimat adresi ve özel notlarını anında güncelleme.
  - **🗑️ Müşteri Silme (Çıkartma):** Kayıt Defterinden müşteri onay mekanizması ile müşteri kaydını tamamen silebilme.
  - **REST API Endpoint'leri:** `POST /api/customers`, `PUT /api/customers/{phone}`, `DELETE /api/customers/{phone}` endpoints.

---

## [1.3.0] - 2026-10-02

### 📊 Günlük, Aylık & Özel Tarih Bazlı Raporlama ve Satış Analizi Sistemi
- **Veritabanı Analiz ve Raporlama Motoru (`database.py`):**
  - `get_analytics_report(period='daily'|'monthly'|'custom', ...)` metodu geliştirildi.
  - **7 KPI Gösterge Kartı:** Toplam Net Ciro, Nakit Satışlar, Kredi Kartı Satışları, Veresiye/Açık Hesap Satışları, Sipariş Adedi, Toplam Yapılan İndirim Tutarı ve Ortalama Sepet Tutarı (AOV).
  - **En Çok Satan Ürünler Analizi:** Satılan ürün bazında Satış Adedi, Kategori ve Oluşturulan Ciro Katkısı dökümü.
  - **Kanal / Sipariş Kaynağı Dağılımı:** KASA, TRENDYOL, GETİR, MİGROS bazında sipariş adedi ve ciro payı.
  - **İndirim & İkram Analizi:** Uygulanan indirim türleri dökümü (%10, %20, Özel TL İndirimi, 🎁 İkramlar).

---

## [1.2.0] - 2026-10-02

### 🌶️ Dinamik Opsiyon, Ücretli Ekstralar ve Ücretsiz Garnitür Limiti Kural Yapısı
- `option_groups` ve `option_items` tabloları eklendi.
- 4 çeşitten fazla garnitür seçildiğinde limiti aşan her ilave garnitür için tanımlanan ücret (örn. +₺10.00) otomatik hesaplanır.

---

## [1.0.0] - 2026-10-02

### 🚀 Başlangıç & Mimari Kurulum (Initial Release)
- Backend: Python FastAPI + SQLite3 (`oses_pos.db`).
- Frontend: SPA (Single Page Application) HTML5, Vanilla CSS3 (Touch-friendly POS) ve Modüler JavaScript (`app.js`).
- 80mm Termal Adisyon Yazıcı Çıktısı (`@media print` CSS).
- Getir / Trendyol / Migros Yemek Entegrasyon Altyapısı (`POST /api/external/orders`).
