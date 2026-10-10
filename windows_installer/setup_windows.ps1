# ==============================================================================
# O Ses Cigkofte POS - Windows Otomatik Sistem Kurucu
# ==============================================================================

$ErrorActionPreference = "Stop"

try {
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Write-Header {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "    O SES CIGKOFTE POS - WINDOWS SISTEM KONTROL VE KURULUM SIHIRBAZI   " -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host ""
}

function Write-Step ($message) {
    Write-Host "[*] $message" -ForegroundColor Cyan
}

function Write-Success ($message) {
    Write-Host "   [OK] $message" -ForegroundColor Green
}

function Write-Warn ($message) {
    Write-Host "   [!] $message" -ForegroundColor Yellow
}

function Write-Err ($message) {
    Write-Host "   [HATA] $message" -ForegroundColor Red
}

Write-Header

# 1. Proje Kok Dizinini Tespit Etme
$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = Split-Path -Parent $InstallerDir
Set-Location $ProjectDir
Write-Step "Proje Klasoru: $ProjectDir"
Write-Host ""

# 2. Yonetici (Administrator) Izni Kontrolu
Write-Step "1/6: Yonetici (Administrator) Izinleri Kontrol Ediliyor..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Script yonetici haklariyla calistirilmadi. Otomatik Gorev Zamanlayici ayari icin yonetici izni gerekebilir."
} else {
    Write-Success "Yonetici izinleri aktif."
}
Write-Host ""

# Onceki Calisan Servisleri Temizleme (Dosya kilitlenmelerini onlemek icin)
try {
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} catch {}


# 3. Python 3.9+ Kontrolu ve Otomatik Kurulumu
Write-Step "2/6: Python 3 Incelemesi Yapiliyor..."
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
} catch {}

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
    Write-Warn "Python 3 (v3.9 veya ustü) bulunamadi! Otomatik kurulum baslatiliyor..."
    $pythonInstallerUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $tempInstaller = "$env:TEMP\python-3.11.9-amd64.exe"
    
    Write-Step "Python 3.11 Indiriliyor (python.org)..."
    Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $tempInstaller -UseBasicParsing
    
    Write-Step "Python Sessizce Kuruluyor (PATH'e ekleniyor)..."
    Start-Process -FilePath $tempInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
    
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Remove-Item $tempInstaller -ErrorAction SilentlyContinue
    $pythonPath = "python"
    Write-Success "Python 3.11 basariyla kuruldu ve PATH'e eklendi!"
}
Write-Host ""

# 4. Python Sanal Ortam (venv) ve Bagimliliklar (requirements.txt)
Write-Step "3/6: Python Sanal Ortami ve Paket Bagimliliklari Kontrol Ediliyor..."
$VenvDir = Join-Path $ProjectDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvDir)) {
    Write-Step "Sanal ortam (venv) olusturuluyor..."
    & $pythonPath -m venv "$VenvDir"
    Write-Success "Sanal ortam basariyla olusturuldu."
} else {
    Write-Success "Sanal ortam (venv) mevcut."
}

Write-Step "Gerekli kutuphaneler (FastAPI, Uvicorn, Pydantic) kontrol edilip yukleniyor..."
& "$VenvPython" -m pip install --upgrade pip --quiet
& "$VenvPython" -m pip install -r "$ProjectDir\requirements.txt" --quiet
Write-Success "Tum Python kutuphaneleri guncel ve hazir!"
Write-Host ""

# 5. Cloudflared (Tunel Executable) Kontrolu
Write-Step "4/6: Cloudflare Tunnel (cloudflared.exe) Kontrol Ediliyor..."
$CloudflaredExe = Join-Path $ProjectDir "cloudflared.exe"

if (-not (Test-Path $CloudflaredExe)) {
    Write-Warn "cloudflared.exe bulunamadi! GitHub uzerinden otomatik indiriliyor..."
    $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $cfUrl -OutFile $CloudflaredExe -UseBasicParsing
    Write-Success "cloudflared.exe ana klasore indirildi ve hazirlandi!"
} else {
    Write-Success "cloudflared.exe hazir."
}
Write-Host ""

# 6. Google Chrome & Masaustu Kisayollari
Write-Step "5/6: Google Chrome ve Masaustu Kisayollari Hazirlaniyor..."
$ChromePath1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ChromePath2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$ChromeExe = $null

if (Test-Path $ChromePath1) { $ChromeExe = $ChromePath1 }
elseif (Test-Path $ChromePath2) { $ChromeExe = $ChromePath2 }

if ($ChromeExe) {
    Write-Success "Google Chrome tespit edildi: $ChromeExe"
} else {
    Write-Warn "Google Chrome bulunamadi."
}

# Arka planda gizli calistirici VBScript olusturma
$VbsScriptPath = Join-Path $ProjectDir "run_background_windows.vbs"
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$ProjectDir\run_windows.bat" & chr(34), 0
WshShell.Run chr(34) & "$ProjectDir\run_tunnel_windows.bat" & chr(34), 0
Set WshShell = Nothing
"@
[System.IO.File]::WriteAllText($VbsScriptPath, $VbsContent)

# Masaustune Kisayol Olusturma
try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath("Desktop")
    
    # 1. Arka Plan Baslat (Gizli Sunucu)
    $BgShortcutPath = Join-Path $DesktopPath "O Ses POS - Arka Planda Baslat.lnk"
    $BgShortcut = $WScriptShell.CreateShortcut($BgShortcutPath)
    $BgShortcut.TargetPath = "wscript.exe"
    $BgShortcut.Arguments = "`"$VbsScriptPath`""
    $BgShortcut.WorkingDirectory = $ProjectDir
    $BgShortcut.Description = "Siyah komut penceresi acilmadan POS sunucusunu arka planda gizlice calistirir."
    $BgShortcut.Save()
    Write-Success "Masaustu Kisayolu Olusturuldu: 'O Ses POS - Arka Planda Baslat'"

    # 2. Chrome Pencereli App Modu (Ekran Kaplar, Pencere Butonlari Var)
    if ($ChromeExe) {
        $AppShortcutPath = Join-Path $DesktopPath "O Ses POS - Kasa Ekrani (Pencereli App).lnk"
        $AppShortcut = $WScriptShell.CreateShortcut($AppShortcutPath)
        $AppShortcut.TargetPath = $ChromeExe
        $AppShortcut.Arguments = "--app=http://localhost:8000 --start-maximized --kiosk-printing"
        $AppShortcut.Description = "POS Ekranini masaustu uygulamasi gibi acar (Kucult / Kapat butonlari aktif)."
        $AppShortcut.Save()
        Write-Success "Masaustu Kisayolu Olusturuldu: 'O Ses POS - Kasa Ekrani (Pencereli App)'"

        # 3. Kiosk Tam Ekran Modu (Kasa Kilitli Mod)
        $KioskShortcutPath = Join-Path $DesktopPath "O Ses POS - Kasa Ekrani (Tam Ekran Kiosk).lnk"
        $KioskShortcut = $WScriptShell.CreateShortcut($KioskShortcutPath)
        $KioskShortcut.TargetPath = $ChromeExe
        $KioskShortcut.Arguments = "--kiosk http://localhost:8000 --kiosk-printing"
        $KioskShortcut.Description = "Kasa dokunmatik ekranlar icin kilitli tam ekran modunda acar."
        $KioskShortcut.Save()
        Write-Success "Masaustu Kisayolu Olusturuldu: 'O Ses POS - Kasa Ekrani (Tam Ekran Kiosk)'"
    }

    # 4. Sunucuyu ve Tuneli Durdur Kisayolu
    $StopShortcutPath = Join-Path $DesktopPath "O Ses POS - Sunucuyu Durdur.lnk"
    $StopShortcut = $WScriptShell.CreateShortcut($StopShortcutPath)
    $StopShortcut.TargetPath = Join-Path $ProjectDir "stop_windows.bat"
    $StopShortcut.WorkingDirectory = $ProjectDir
    $StopShortcut.Description = "Arka planda calisan POS sunucusunu ve Cloudflare tunelini tek tikla kapatir."
    $StopShortcut.Save()
    Write-Success "Masaustu Kisayolu Olusturuldu: 'O Ses POS - Sunucuyu Durdur'"

    # 5. Sistemi Kaldir (Uninstall) Kisayolu
    $UninstallShortcutPath = Join-Path $DesktopPath "O Ses POS - Kaldir (Uninstall).lnk"
    $UninstallShortcut = $WScriptShell.CreateShortcut($UninstallShortcutPath)
    $UninstallShortcut.TargetPath = Join-Path $InstallerDir "uninstall_windows.bat"
    $UninstallShortcut.WorkingDirectory = $InstallerDir
    $UninstallShortcut.Description = "O Ses POS sistemini, otomatik baslatmayi ve kisayollari Windows'tan tamamen kaldirir."
    $UninstallShortcut.Save()
    Write-Success "Masaustu Kisayolu Olusturuldu: 'O Ses POS - Kaldir (Uninstall)'"
} catch {
    Write-Warn "Masaustu kisayollari olusturulurken kucuk bir uyari alindi."
}
Write-Host ""

# 7. Otomatik Arka Plan & Elektrik Kesintisi Otomatik Baslatma Yapilandirmasi
Write-Step "6/6: Windows Acilisinda Otomatik Arka Plan Servis Ayarlari Yapilandiriliyor..."

# Startup (Baslangic) Klasorune Kisayol Ekleme
try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $StartupFolder = [System.Environment]::GetFolderPath("Startup")
    $StartupShortcutPath = Join-Path $StartupFolder "OsesPOS_AutoStart.lnk"
    $StartupShortcut = $WScriptShell.CreateShortcut($StartupShortcutPath)
    $StartupShortcut.TargetPath = "wscript.exe"
    $StartupShortcut.Arguments = "`"$VbsScriptPath`""
    $StartupShortcut.WorkingDirectory = $ProjectDir
    $StartupShortcut.Description = "O Ses POS Sunucusu ve Tuneli Otomatik Baslatici"
    $StartupShortcut.Save()
    Write-Success "Windows Baslangic Klasorune (Startup) eklendi!"
} catch {
    Write-Warn "Startup klasorune kisayol eklenirken bir uyari olustu: $_"
}

# Windows Gorev Zamanlayicisi (Task Scheduler) Kaydi
if ($isAdmin) {
    try {
        $TaskName = "OsesPOS_AutoServer"
        schtasks /Delete /TN $TaskName /F 2>$null
        $schCmd = "schtasks /Create /TN `"$TaskName`" /TR `"wscript.exe `\`"$VbsScriptPath`\`"`" /SC ONLOGON /RL HIGHEST /F"
        Invoke-Expression $schCmd | Out-Null
        Write-Success "Windows Gorev Zamanlayicisina ($TaskName) eklendi!"
    } catch {}
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "   TEBRIKLER! O SES POS SISTEMI VE OTOMATIK BASLATMA AYARLANDI!       " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

$response = Read-Host "Simdi POS uygulamasini arka planda baslatmak ister misiniz? (E/H)"
if ($response -eq 'E' -or $response -eq 'e') {
    Write-Host "[+] POS Sunucusu ve Tunel Arka Planda Gizlice Baslatiliyor..." -ForegroundColor Green
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$VbsScriptPath`"" -WorkingDirectory $ProjectDir
}
