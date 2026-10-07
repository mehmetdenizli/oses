# ==============================================================================
# 🌶️ O Ses Çiğköfte POS & Adisyon Sistemi - Windows Otomatik Sistem Kurucu
# ==============================================================================
# Bu script Windows kasa bilgisayarında POS uygulamasının çalışabilmesi için
# gerekli olan Python, Pip paketleri, Cloudflared tünel yazılımı ve Google Chrome
# bağımlılıklarını kontrol eder, eksik olanları otomatik indirir ve kurar.
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

function Write-Header {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host " 🌯 O SES ÇİĞKÖFTE POS - WINDOWS SİSTEM KONTROL VE KURULUM SİHRİBAZI  " -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host ""
}

function Write-Step ($message) {
    Write-Host "👉 $message" -ForegroundColor Cyan
}

function Write-Success ($message) {
    Write-Host "   ✅ $message" -ForegroundColor Green
}

function Write-Warn ($message) {
    Write-Host "   ⚠️ $message" -ForegroundColor Yellow
}

function Write-Err ($message) {
    Write-Host "   ❌ $message" -ForegroundColor Red
}

Write-Header

# 1. Proje Kök Dizinini Tespit Etme
$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = Split-Path -Parent $InstallerDir
Set-Location $ProjectDir
Write-Step "Proje Klasörü: $ProjectDir"
Write-Host ""

# 2. Yönetici (Administrator) İzni Kontrolü
Write-Step "1/5: Yönetici (Administrator) İzinleri Kontrol Ediliyor..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Script yönetici haklarıyla çalıştırılmadı. Bazı yüklemeler için izin istenebilir."
} else {
    Write-Success "Yönetici izinleri aktif."
}
Write-Host ""

# 3. Python 3.9+ Kontrolü ve Otomatik Kurulumu
Write-Step "2/5: Python 3 İncelemesi Yapılıyor..."
$pythonPath = $null

try {
    $pyVer = python --version 2>&1
    if ($pyVer -match "Python 3\.(\d+)") {
        $minor = [int]$matches[1]
        if ($minor -ge 9) {
            $pythonPath = "python"
            Write-Success "Python bulundu: $pyVer"
        }
    }
} catch {
    # Python sistemde doğrudan yok
}

if (-not $pythonPath) {
    try {
        $pyVer = py -3 --version 2>&1
        if ($pyVer -match "Python 3\.(\d+)") {
            $pythonPath = "py -3"
            Write-Success "Python bulundu (py launcher): $pyVer"
        }
    } catch {}
}

if (-not $pythonPath) {
    Write-Warn "Python 3 (v3.9 veya üstü) bulunamadı! Otomatik kurulum başlatılıyor..."
    $pythonInstallerUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $tempInstaller = "$env:TEMP\python-3.11.9-amd64.exe"
    
    Write-Step "Python 3.11 İndiriliyor (python.org)..."
    Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $tempInstaller -UseBasicParsing
    
    Write-Step "Python Sessizce Kuruluyor (PATH'e ekleniyor)..."
    Start-Process -FilePath $tempInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
    
    # Path değişkenini güncelleme
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Remove-Item $tempInstaller -ErrorAction SilentlyContinue
    $pythonPath = "python"
    Write-Success "Python 3.11 başarıyla kuruldu ve PATH'e eklendi!"
}
Write-Host ""

# 4. Python Sanal Ortam (venv) ve Bağımlılıklar (requirements.txt)
Write-Step "3/5: Python Sanal Ortamı ve Paket Bağımlılıkları Kontrol Ediliyor..."
$VenvDir = Join-Path $ProjectDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvDir)) {
    Write-Step "Sanal ortam (venv) oluşturuluyor..."
    & $pythonPath -m venv "$VenvDir"
    Write-Success "Sanal ortam başarıyla oluşturuldu."
} else {
    Write-Success "Sanal ortam (venv) mevcut."
}

Write-Step "Gerekli kütüphaneler (FastAPI, Uvicorn, Pydantic) kontrol edilip yükleniyor..."
& "$VenvPython" -m pip install --upgrade pip --quiet
& "$VenvPython" -m pip install -r "$ProjectDir\requirements.txt" --quiet
Write-Success "Tüm Python kütüphaneleri güncel ve hazır!"
Write-Host ""

# 5. Cloudflared (Tünel Executable) Kontrolü
Write-Step "4/5: Cloudflare Tunnel (cloudflared.exe) Kontrol Ediliyor..."
$CloudflaredExe = Join-Path $ProjectDir "cloudflared.exe"

if (-not (Test-Path $CloudflaredExe)) {
    Write-Warn "cloudflared.exe bulunamadı! GitHub üzerinden otomatik indiriliyor..."
    $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $cfUrl -OutFile $CloudflaredExe -UseBasicParsing
    Write-Success "cloudflared.exe ana klasöre indirildi ve hazırlandı!"
} else {
    Write-Success "cloudflared.exe hazır."
}
Write-Host ""

# 6. Google Chrome & Masaüstü Kısayolları
Write-Step "5/5: Google Chrome ve Masaüstü Kısayolları Hazırlanıyor..."
$ChromePath1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ChromePath2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$ChromeExe = $null

if (Test-Path $ChromePath1) { $ChromeExe = $ChromePath1 }
elseif (Test-Path $ChromePath2) { $ChromeExe = $ChromePath2 }

if ($ChromeExe) {
    Write-Success "Google Chrome tespit edildi: $ChromeExe"
} else {
    Write-Warn "Google Chrome bulunamadı. Kiosk dokunmatik mod için Chrome yüklenmesi önerilir."
}

# Masaüstüne Kısayol Oluşturma
try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath("Desktop")
    
    # 1. POS Başlat Kısayolu
    $ShortcutPath = Join-Path $DesktopPath "O Ses POS - Kasa Başlat.lnk"
    $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = Join-Path $ProjectDir "run_windows.bat"
    $Shortcut.WorkingDirectory = $ProjectDir
    $Shortcut.Description = "O Ses Çiğköfte POS & Adisyon Sunucusunu Başlatır"
    $Shortcut.Save()
    Write-Success "Masaüstü Kısayolu Oluşturuldu: 'O Ses POS - Kasa Başlat'"

    # 2. Chrome Kiosk Kısayolu (Chrome Varsa)
    if ($ChromeExe) {
        $KioskShortcutPath = Join-Path $DesktopPath "O Ses POS - Kiosk Ekranı.lnk"
        $KioskShortcut = $WScriptShell.CreateShortcut($KioskShortcutPath)
        $KioskShortcut.TargetPath = $ChromeExe
        $KioskShortcut.Arguments = "--kiosk http://localhost:8000 --kiosk-printing"
        $KioskShortcut.Description = "POS Ekranını Dokunmatik Tam Ekran Modunda Açarak Fişleri Otomatik Basar"
        $KioskShortcut.Save()
        Write-Success "Masaüstü Kısayolu Oluşturuldu: 'O Ses POS - Kiosk Ekranı'"
    }
} catch {
    Write-Warn "Masaüstü kısayolları oluşturulurken küçük bir uyarı alındı, ancak kurulum tamamlandı."
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " 🎉 TEBRİKLER! O SES POS TÜM SİSTEM GEREKSİNİMLERİ BAŞARIYLA KURULDU! " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 POS Uygulamasını Başlatmak İçin:" -ForegroundColor Cyan
Write-Host "   1. Masaüstündeki 'O Ses POS - Kasa Başlat' kısayoluna çift tıklayın." -ForegroundColor White
Write-Host "   2. Veya '$ProjectDir\run_windows.bat' dosyasını çalıştırın." -ForegroundColor White
Write-Host ""
Write-Host "📱 QR Masadan Sipariş Tünelini Başlatmak İçin:" -ForegroundColor Cyan
Write-Host "   - '$ProjectDir\run_tunnel_windows.bat' dosyasını çalıştırın." -ForegroundColor White
Write-Host ""

$response = Read-Host "Şimdi POS uygulamasını başlatmak ister misiniz? (E/H)"
if ($response -eq 'E' -or $response -eq 'e') {
    Write-Host "🚀 POS Sunucusu Başlatılıyor..." -ForegroundColor Green
    Start-Process -FilePath "$ProjectDir\run_windows.bat" -WorkingDirectory $ProjectDir
}
