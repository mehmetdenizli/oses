# 📜 O Ses Çiğköfte POS & Adisyon Sistemi - Baştan Sona Geliştirme Yolculuğu (Project History)

Bu doküman, **O Ses Çiğköfte POS & Adisyon Sistemi** projesinin ilk günkü fikir aşamasından bugünkü tam teşekküllü **inPOS m530 YN ÖKC entegrasyonlu, QR masadan siparişli ve Windows otomatik kurulumlu** haline kadarki tüm geliştirme evrelerini özetler.

---

## 🧭 Projenin Temel Felsefesi ve Amacı

1. **0 TL Dış Sunucu Maliyeti:** Aylık/yıllık bulut veya sunucu kira ücreti olmadan dükkandaki tek bir dokunmatik kasa bilgisayar üzerinde bağımsız çalışmak.
2. **Hızlı ve Sezgisel Kasa Arayüzü:** Kasiyerlerin en yoğun saatlerde 2 tıkla sipariş alabilmesini sağlamak.
3. **Müşteri Odaklı QR Self-Ordering:** Masadaki müşterinin uygulama indirmeden kendi telefonundan acı ve garnitür tercihlerini seçerek sipariş verebilmesi.
4. **Donanım Entegrasyonu:** SPENTA 80mm termal fiş yazıcısı ve inPOS m530 YN ÖKC yazar kasa POS cihazı ile sıfır veri kaybıyla entegre çalışmak.

---

## 📈 Kilometre Taşları ve Geliştirme Evreleri

### 🚀 1. EVRE: Temel Mimari ve Kasa POS Ekranının Doğuşu
- **Tarih:** 2026-10-02
- **Odak:** Backend altyapısı ve dokunmatik POS ekranı.
- **Neler Yapıldı?**
  - **Backend:** Python FastAPI framework'ü ve SQLite3 veri tabanı (`oses_pos.db`, WAL Mode) mimarisi kuruldu.
  - **Frontend:** SPA (Single Page Application) mimarisinde HTML5, Vanilla CSS3 (Modern Glassmorphism tasarım) ve `app.js` modülü ile responsive dokunmatik arayüz tasarlandı.
  - **Yazıcı:** 80mm Termal Adisyon Yazıcısı çıktı şablonu CSS `@media print` kurallarıyla hazırlandı.
  - **Katalog:** O Ses Çiğköfte 25. Yıl resmi ürün kataloğu ve fiyatları sisteme eklendi.

---

### 🌶️ 2. EVRE: Dinamik Opsiyonlar, Ücretsiz Limitler ve Ekstralar
- **Tarih:** 2026-10-02
- **Odak:** Çiğköfte restoranlarına özel opsiyon mantığı.
- **Neler Yapıldı?**
  - `option_groups` ve `option_items` veritabanı tabloları eklendi.
  - "Acı Seviyesi (Az, Orta, Bol)", "Garnitürler (Marul, Maydanoz, Nane, Limon vb.)" ve "Sos/Ekstralar (Çift Lavaş, Doritos, Nar Ekşisi)" kuralları yazıldı.
  - **Akıllı Limit Motoru:** "İlk 4 garnitür ücretsiz, 4'ten sonraki her garnitür +₺10", "Çift Lavaş +₺15" gibi canlı sepet fiyat hesaplama motoru geliştirildi.

---

### 📊 3. EVRE: Günlük / Aylık Satış Analitiği & Ciro Raporlama
- **Tarih:** 2026-10-02
- **Odak:** İşletme sahibinin ciro ve satış istatistiklerini takibi.
- **Neler Yapıldı?**
  - `get_analytics_report()` metodu ile 7 KPI gösterge kartı oluşturuldu (Net Ciro, Nakit, Kredi Kartı, Veresiye, Yapılan İndirimler, Sipariş Adedi, Ortalama Sepet Tutarı).
  - Günlük, Aylık ve Özel Tarih Aralığı filtreleme desteği sunuldu.
  - En Çok Satan Ürünler ve Sipariş Kanalı (Kasa, Trendyol, Getir, Migros) dağılım grafikleri eklendi.

---

### 📖 4. EVRE: Müşteri Kayıt Defteri & Açık Hesap Takibi
- **Tarih:** 2026-10-02
- **Odak:** Müşteri yönetimi ve paket servis adresleri.
- **Neler Yapıldı?**
  - Tam Müşteri CRUD (Ekleme, Adres Güncelleme, Silme, Telefon Arama) paneli yazıldı.
  - Müşterinin geçmiş siparişleri ve veresiye borç takibi bağlandı.

---

### 📱 5. EVRE: Müşteri Karekod (QR) Self-Ordering & Sabit QR Mimarisi
- **Tarih:** 2026-10-02
- **Odak:** Masadan sipariş ve şaka sipariş engelleme.
- **Neler Yapıldı?**
  - **Müşteri Mobil Web Uygulaması (`static/qr.html`):** Müşterilerin cep telefonlarından menüyü gezip sipariş verebildiği arayüz.
  - **Kasa Onay Mekanizması:** İnternetten gelen QR siparişleri kasaya düşer, sesli ikaz verir. Kasiyer `✅ ONAYLA` butonuna basınca fiş yazdırılır; `❌ REDDET` butonuna basınca şaka sipariş elenir.
  - **Vercel Smart QR Redirector (`redirector/`):** Masalardaki QR etiketlerin ömür boyu hiç değişmemesini sağlayan Vercel serverless yönlendiricisi kuruldu. Kasa IP/tünel adresi değişse bile QR kodlar bozulmaz.

---

### 💳 6. EVRE: inPOS m530 ÖKC Entegrasyonu, Akıllı PIN & Windows Otomasyonu
- **Tarih:** 2026-10-09
- **Odak:** Yazar kasa POS donanım bağlantısı, kağıt israfı önleme ve tek tıkla Windows kurulumu.
- **Neler Yapıldı?**
  - **gmp3_driver.py Sürücüsü:** Mikrosaray inPOS m530 YN ÖKC cihazı için GİB GMP-3 ortak ÖKC entegrasyon sürücüsü yazıldı. Bilgisayardan `Kredi Kartı` ödemesi seçildiğinde tutar (₺150.00) IP/Serial ağ üzerinden otomatik POS cihazının ekranına yansıtıldı.
  - **Akıllı Yönetici Oturumu (30 Dakika Hatırla):** Yönetici PIN şifresi (`oses1234`) bir kez doğru girildiğinde 30 dakika boyunca şifre sormadan hızlı işlem imkanı sağlandı (`🔓 Yetkili (30 dk)`).
  - **Kağıt İsrafını Önleyen Çift Fiş İptali:** Masada önceden `📄 Mutfak / Ara Fiş` basıldığı için ödeme kapatıldığında ikinci kez gereksiz termal fiş basılması engellendi.
  - **Windows Otomatik Kurulum Sihirbazı (`windows_installer/run_installer.bat`):** Tek tıkla Python indirme, `venv` paket yükleme, `cloudflared.exe` indirme, Windows Başlangıç (`shell:startup`) ve Görev Zamanlayıcısı servisi oluşturma eklendi.

---

## 🛠️ Genel Teknolojik Mimarinin Özeti

| Katman | Kullanılan Teknolojiler / Standartlar |
| :--- | :--- |
| **Backend Framework** | Python 3.9+, FastAPI, Uvicorn (Asenkron ASGI) |
| **Veri Tabanı** | SQLite3 (WAL Mode, `busy_timeout=30000`, Foreign Keys Active) |
| **POS Donanım Sürücüsü** | GİB GMP-3 Protokolü (`gmp3_driver.py` - IP Socket & Serial COM) |
| **Termal Yazıcı** | 80mm ESC/POS CSS `@media print` şablonu (SPENTA SPR-160P) |
| **Frontend Arayüzü** | HTML5, Vanilla CSS3 (Glassmorphism), JavaScript ES6+ (SPA) |
| **İnternet Tüneli** | Cloudflare Tunnel (`cloudflared`) & Vercel Serverless Yönlendirici |
| **İşletim Sistemi Desteği** | macOS (Native) & Windows 10/11 (Tam Otomatik Oturum Servisleri) |
