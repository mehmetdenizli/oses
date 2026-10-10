# 🪟 Windows Otomatik Sistem Kontrolü & Kurulum Sihirbazı

Bu dizindeki **`setup_windows.ps1`** PowerShell scripti, **O Ses Çiğköfte POS & Adisyon Uygulaması**'nın Windows kasa bilgisayarında çalışması için gereken tüm sistem bileşenlerini otomatik olarak denetler ve eksikse kurar.

---

## 🛠️ Script Ne Yapar?

1. **Python 3.9+ Kontrolü:** Sistemde Python 3 yoksa internetten resmi Python 3.11 kurucusunu indirir ve PATH değişkenine ekleyerek otomatik kurar.
2. **Sanal Ortam (venv) Kurulumu:** Proje kök dizininde `venv` sanal ortamını oluşturur.
3. **Pip Paket Yüklemesi:** `FastAPI`, `Uvicorn`, `Pydantic` ve gerekli tüm kütüphaneleri `requirements.txt` üzerinden sanal ortama yükler.
4. **Cloudflare Tüneli (`cloudflared.exe`):** QR masadan sipariş sisteminin internete açılabilmesi için `cloudflared.exe` Windows sürümünü indirir ve proje klasörüne yerleştirir.
5. **Masaüstü Kısayolları:** Masaüstüne **"O Ses POS - Kasa Başlat"** ve **"O Ses POS - Kiosk Ekranı"** (dokunmatik tam ekran ve otomatik diyalogsuz fiş yazıcı modu) kısayollarını otomatik ekler.
6. **Arka Planda Otomatik Başlatma (Elektrik Kesintisi Koruması):** `run_background_windows.vbs` scriptini oluşturur ve Windows Başlangıç Klasörüne (`shell:startup`) ile Windows Görev Zamanlayıcısına ekler. Bilgisayar veya elektrik yeniden geldiğinde POS Sunucusu ve Tünel arka planda otomatik başlar!

---

## 🚀 PowerShell Scripti Nasıl Çalıştırılır?

Windows güvenlik politikaları nedeniyle PowerShell scriptlerinin çalıştırılması varsayılan olarak kısıtlanmış olabilir. Scripti çalıştırmak için **3 kolay yöntem** vardır:

### 🌟 1. YÖNTEM: Tek Tıkla Çalıştırmak (En Kolay)
1. `windows_installer` klasörü içindeki **`run_installer.bat`** dosyasına çift tıklayın!
2. Batch dosyası güvenlik ilkesini otomatik atlayarak PowerShell sihirbazını başlatır.

---

### 💻 2. YÖNTEM: PowerShell İle Çalıştırmak (Komut Satırından)
1. Windows klavye tuşundan **PowerShell** yazın ve **"Yönetici Olarak Çalıştır"** (Run as Administrator) deyin.
2. Açılan siyah/mavi pencerede şu iki komutu sırasıyla çalıştırın:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
*(Güvenlik uyarısı çıkarsa `Y` tuşuna basıp Enter'a basın).*

3. Ardından proje klasörüne gidip scripti başlatın:
```powershell
cd C:\OsesPOS\windows_installer
.\setup_windows.ps1
```

---

### 🖱️ 3. YÖNTEM: Fare İle Sağ Tıklayarak
1. `setup_windows.ps1` dosyasına sağ tıklayın.
2. **"PowerShell ile Çalıştır"** (Run with PowerShell) seçeneğini tıklayın.

---

## 🛑 Arka Plan Servislerini Durdurma (Stop)

POS sunucusunu ve Cloudflare tünelini geçici olarak kapatmak istediğinizde:
- Masaüstünüzdeki **`O Ses POS - Sunucuyu Durdur`** kısayoluna çift tıklayın, **veya**
- Proje ana klasöründeki **`stop_windows.bat`** dosyasını çalıştırın.
Arka planda port 8000'i dinleyen Python ve `cloudflared.exe` tüneli anında kapatılır.

---

## 🗑️ Uygulamayı ve Arka Plan Servislerini Tamamen Kaldırma (Uninstall)

Uygulamayı, otomatik açılış servislerini ve kısayolları bilgisayardan temizlemek istediğinizde:
- Masaüstündeki **`O Ses POS - Kaldir (Uninstall)`** kısayoluna çift tıklayın, **veya**
- `windows_installer` klasöründeki **`uninstall_windows.bat`** (veya ana klasördeki `uninstall_windows.bat`) dosyasını çalıştırın.

**Kaldırma Sihirbazı Neler Yapar?**
1. Arka planda çalışan `cloudflared.exe` ve `python.exe` süreçlerini anında sonlandırır.
2. Windows Görev Zamanlayıcısı (`OsesPOS_AutoServer`) kaydını siler.
3. Windows Başlangıç Klasöründeki (`shell:startup`) otomatik başlatıcıyı siler.
4. Masaüstündeki tüm "O Ses POS" kısayollarını temizler.
5. Size sorarak `venv` sanal ortamını ve indirilen `cloudflared.exe` dosyasını diskten temizler.

