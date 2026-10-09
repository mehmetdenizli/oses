# 🪟 O Ses Çiğköfte POS & Adisyon Sistemi - Windows Kurulum ve Kullanım Kılavuzu

Bu doküman, **O Ses Çiğköfte POS & Adisyon Uygulaması**'nın dükkandaki **Windows Dokunmatik Kasa Bilgisayarına** sıfırdan nasıl kurulacağını, açılışta otomatik başlatılacağını, 80mm termal yazıcının bağlayıp günlük adisyon ve QR müşteri siparişlerinin nasıl yönetileceğini adım adım açıklar.

---

## 💻 1. BÖLÜM: Sıfırdan Windows Kurulum Adımları

Uygulama **sıfır harici sunucu bağımlılığına** sahiptir. Tek bir Windows masaüstü veya dokunmatik kasa PC sunucu olarak çalışır.

### 📋 Sistem Gereksinimleri
- **İşletim Sistemi:** Windows 10 veya Windows 11 (32-bit / 64-bit).
- **Python:** Python 3.9 veya üstü ([python.org/downloads](https://www.python.org/downloads/) adresinden indirebilirsiniz).
- **Yazıcı:** 80mm USB Termal Fiş Yazıcısı.

---

### 🛠️ Adım 1: Python Yüklemesi (Çok Önemli!)
1. `python.org/downloads` adresinden en güncel Python kurucusunu (`python-3.x.x-amd64.exe`) indirin.
2. Kurulum ekranı açıldığında **en alttaki "Add Python.exe to PATH" kutucuğunu MUTLAKA İŞARETLEYİN!**
3. **"Install Now"** butonuna basarak kurulumu tamamlayın.

---

### 📁 Adım 2: Proje Klasörünü Kasaya Kopyalama
1. POS uygulama klasörünü kasanın `C:\` sürücüsüne kopyalayın (Örn: `C:\OsesPOS`).

---

### 🚀 Adım 3: Tek Tıkla POS Sunucusunu Başlatma
1. `C:\OsesPOS` klasörüne girin.
2. **`run_windows.bat`** dosyasına çift tıklayın.
   - Script otomatik olarak Python sanal ortamını (`venv`) oluşturacak, gerekli kütüphaneleri yükleyecek ve POS sunucusunu başlatacaktır.
3. Kasa ekranında POS adresi: `http://localhost:8000`

---

## ⚙️ 2. BÖLÜM: Otomatik Başlatma & Dokunmatik Kiosk Modu

Kasa bilgisayarı her açıldığında (elektrik kesintisinden sonra veya sabah bilgisayar açıldığında) POS sisteminin otomatik başlaması ve tam ekran dokunmatik modda açılması için:

### 🔄 1. Windows Açılışında Otomatik Başlatma (Startup)
1. Klavyeden `Win + R` tuşlarına basıp açılan kutuya `shell:startup` yazın ve Enter'a basın.
2. `C:\OsesPOS` klasöründeki **`run_windows.bat`** ve **`run_tunnel_windows.bat`** dosyalarının kısayolunu bu klasör içine yapıştırın.
3. Artık bilgisayar her açıldığında POS sunucusu ve QR tüneli otomatik olarak arka planda başlayacaktır.

---

### 🖥️ 2. Dokunmatik Tam Ekran & Pencere Modu Seçenekleri

Windows'ta uygulamanın tam ekran kullanımı için 2 seçeneğiniz vardır:

#### A) Önerilen: Masaüstü Uygulama Modu (Pencereli App Modu)
Kasa ekranı adres çubuğu ve sekmeler olmadan tıpkı yerel bir masaüstü programı gibi açılır. Ekranı tam kaplar ancak sağ üstte **Küçült (`_`)** ve **Kapat (`X`)** butonları aktif kalır:
- Kısayol Hedefi:
  ```cmd
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8000 --start-maximized --kiosk-printing
  ```

#### B) Kilitli Kiosk Modu (Tam Ekran Kasa Modu)
Ekran tamamen kilitlenir, Başlat çubuğu ve pencere butonları gizlenir (Garson/Kasa müdahalesini engellemek için idealdir):
- Kısayol Hedefi:
  ```cmd
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://localhost:8000 --kiosk-printing
  ```
- **Tam Ekrandan Çıkma / Değiştirme:** POS ekranının üst barında bulunan **`⛶ Tam Ekran`** butonuna tıklayarak veya klavyeden `F11` tuşuna basarak tam ekran modunu istediğiniz an açıp kapatabilirsiniz.

---

## 🖨️ 3. BÖLÜM: 80mm Termal Fiş Yazıcısı Yapılandırması

1. 80mm USB Termal Fiş Yazıcısını kasaya takın ve Windows driver'ını kurun.
2. Windows **Denetim Masası -> Cihazlar ve Yazıcılar** bölümüne girin.
3. 80mm termal yazıcınıza sağ tıklayıp **"Varsayılan Yazıcı Olarak Ayarla (Set as default printer)"** seçeneğini işaretleyin.
4. Yazıcı Özellikleri -> Kağıt Boyutu kısmından **80mm x Continuous (Sürekli Kağıt)** seçin.

---

## 📱 4. BÖLÜM: Karekod (QR) Menü & Masadan Sipariş Kullanımı

Müşterilerin dükkandaki masalardan kendi telefonlarıyla sipariş verebilmesi için:

### 🖼️ Masalara Yapıştırılacak QR Etiketlerini Bastırma:
1. POS ekranında sağ üstteki **`📱 Karekod (QR) Menü`** butonuna tıklayın.
2. Açılan pencerede **`Masa 1`**, **`Masa 2`** ... veya **`Tezgah / Gel-Al`** seçimini yapın.
3. **`🖨️ Tüm Masaları (1-10) Toplu Yazdır`** butonuna basarak dükkandaki 10 masanın etiket çıktısını tek tıkla 80mm yazıcıdan alın ve masalara yapıştırın.

---

### 🛡️ Kasada Müşteri Siparişlerini Onaylama (Sahte Sipariş Engelleme):
Çocukların veya müşterilerin yazıcıyı gereksiz meşgul etmesini önlemek için gelen tüm QR siparişleri **kasa onayına** düşer:

1. Müşteri telefonundan sipariş verdiğinde kasada **sesli zil uyarısı** çalar (`🔔 YENİ KAREKOD SİPARİŞİ!`).
2. POS ekranının üst barında turuncu buton belitir: **`📱 1 Karekod Sipariş Onayı Bekliyor!`**
3. Görevli butona tıklar; gelen siparişin masa numarasını ve ürünlerini görür:
   - **`✅ ONAYLA VE FİŞ BASTIR`:** Butonuna basıldığında fiş 80mm yazıcıdan anında basılır ve satışa işlenir.
   - **`❌ REDDET / İPTAL ET`:** Şaka sipariş ise tek tıkla reddedilir, yazıcı boşuna çalışmaz!

---

## 📖 5. BÖLÜM: Günlük Kasa POS Kullanım Kılavuzu

### 🛒 1. Hızlı Satış ve Adisyon Oluşturma
- **Ürün Seçimi:** Sol panelden kategori seçip ürün kartına tıklayın. *(Örn: DÜBLE DÜRÜM)*.
- **Opsiyon Seçimi:** Açılan pencereden Acı Seviyesi (Az, Orta, Bol), Garnitürler (ilk 4 ücretsiz kuralıyla) ve Ekstraları (Çift Lavaş +₺15, Doritos +₺20) seçin.
- **İndirim Uygulama:** Sepetin altında `%10`, `%20`, `Özel TL İndirimi` veya `🎁 İkram (%100)` seçeneklerini kullanın.
- **Ödeme Alımı & Fiş Basımı:** **`Nakit`**, **`Kredi Kartı`** veya **`Veresiye`** butonuna tıklayıp **`🛒 Siparişi Tamamla & Fiş Bastır (80mm)`** butonuna basın. Fiş anında yazıcıdan çıkar.

---

### 👥 2. Müşteri Kayıt Defteri Kullanımı
- **Müşteri Arama:** Sol üstteki arama kutusuna müşteri telefonunu veya adını yazıp Enter'a basın.
- **Müşteri Ekleme / Düzenleme:** **`👥 Müşteri Rehberi`** butonuna tıklayarak yeni müşteri ekleyebilir, adres/not bilgilerini güncelleyebilirsiniz.
- **Sepete Bağlama:** Müşterinin yanındaki **`Sepete Seç`** butonuna basıldığında müşterinin adresi ve özel sipariş notu adisyona otomatik eklenir.

---

### 📊 3. Gün Sonu Özeti ve Raporlama
- Sağ üstteki **`📊 Raporlar & Gün Sonu Özeti`** butonuna basarak:
  - **7 KPI Göstergesi:** Net Ciro, Nakit, Kredi Kartı, Veresiye, İndirim Toplamı ve Ortalama Sepet Tutarını görün.
  - **En Çok Satan Ürünler:** Hangi çiğ köfte paketinin kaç adet satıldığını inceleyin.
  - **Kanal Dağılımı:** Kasa, Trendyol, Getir ve Karekod sipariş cirolarını kıyaslayın.

---

## 💾 6. BÖLÜM: Veritabanı Yedekleme ve Güvenlik

Tüm veriler tamamen kasanın diski üzerindeki tek bir dosyada saklanır:
- **Veritabanı Dosyası:** `C:\OsesPOS\oses_pos.db`

### 🛡️ Yedek Alma:
Haftada bir kez `C:\OsesPOS\oses_pos.db` dosyasını bir USB belleğe veya Google Drive / OneDrive klasörüne kopyalayarak tüm müşteri kayıtlarını, menüyü ve geçmiş satış raporlarını saniyeler içinde yedekleyebilirsiniz.
