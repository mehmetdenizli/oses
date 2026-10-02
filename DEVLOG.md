# O Ses Çiğköfte POS & Adisyon Sistemi - Geliştirme Günlüğü (Devlog / Changelog)

Bu dosya, projedeki tüm geliştirme aşamalarını, veritabanı güncellemelerini, hata düzeltmelerini ve yeni eklenen özellikleri kayıt altında tutar.

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

- **Kapsamlı Raporlama ve Analiz Paneli (`index.html`, `app.js`, `main.py`):**
  - **Tarih Filtreleri:** "📅 Bugün (Günlük Özeti)", "🗓️ Bu Ay (Aylık Rapor)" ve "📆 Özel Tarih Aralığı Seçimi" butonları ile dinamik raporlama.
  - **Sekmeli Analiz Görünümü:** "📦 En Çok Satan Ürünler Tablosu", "🛵 Sipariş Kaynakları", "🎁 İndirim Detayı" ve "📋 Adisyon Geçmişi (Tek Tıkla Fiş Basımı)".
  - REST API Endpoint'leri: `GET /api/stats/analytics` eklendi.

---

## [1.2.0] - 2026-10-02

### 🌶️ Dinamik Opsiyon, Ücretli Ekstralar ve Ücretsiz Garnitür Limiti Kural Yapısı
- **Veritabanı Mimarisi Genişletildi (`database.py`):**
  - `option_groups` ve `option_items` tabloları eklendi.
- **Canlı Opsiyon Fiyat Farkı & Ücretsiz Garnitür Limiti Motoru (`app.js`):**
  - 4 çeşitten fazla garnitür seçildiğinde limiti aşan her ilave garnitür için tanımlanan ücret (örn. +₺10.00) otomatik hesaplanır.
  - Çift Lavaş (+₺15.00), Bol Nar Ekşisi (+₺15.00), Doritos (+₺20.00) gibi tercihler anında sepete ve birim fiyata eklenir.

---

## [1.1.0] - 2026-10-02

### 🍱 O Ses 25. Yıl Fiyat Listesi Güncellemesi & ⚙️ Ürün & Fiyat Yönetimi Paneli
- **Resmi Menü Fiyatları Güncellendi (`database.py`):**
  - Görseldeki orijinal O Ses 25. Yıl fiyat listesi veritabanına işlendi.

---

## [1.0.0] - 2026-10-02

### 🚀 Başlangıç & Mimari Kurulum (Initial Release)
- Backend: Python FastAPI + SQLite3 (`oses_pos.db`).
- Frontend: SPA (Single Page Application) HTML5, Vanilla CSS3 (Touch-friendly POS) ve Modüler JavaScript (`app.js`).
- 80mm Termal Adisyon Yazıcı Çıktısı (`@media print` CSS).
- Getir / Trendyol / Migros Yemek Entegrasyon Altyapısı (`POST /api/external/orders`).
