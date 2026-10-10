# ==============================================================================
# O Ses Cigkofte POS - Windows Otomatik Kaldirma (Uninstall) Sihirbazi
# ==============================================================================

$ErrorActionPreference = "Continue"

try {
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Write-Header {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "       O SES CIGKOFTE POS - WINDOWS KALDIRMA (UNINSTALL) ARACI         " -ForegroundColor Yellow
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

Write-Header

$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = Split-Path -Parent $InstallerDir
Set-Location $ProjectDir
Write-Step "Proje Klasoru: $ProjectDir"
Write-Host ""

# 1. Arka Plandaki Tum POS ve Cloudflare Sureclerini Kapatma
Write-Step "1/5: Arka Plandaki Sunucu ve Tunel Surecleri Durduruluyor..."

# Cloudflared kapat
try {
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Success "Cloudflare tuneli (cloudflared.exe) durduruldu."
} catch {}

# Port 8000 dinleyen sureci kapat
try {
    $connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Success "Port 8000 uzerindeki POS sunucusu (PID: $($conn.OwningProcess)) durduruldu."
    }
} catch {
    # Fallback netstat
    $netstat = netstat -ano | Select-String ":8000" | Select-String "LISTENING"
    foreach ($line in $netstat) {
        $parts = $line.Line -split '\s+'
        $pidToKill = $parts[-1]
        if ($pidToKill -match '^\d+$') {
            Stop-Process -Id [int]$pidToKill -Force -ErrorAction SilentlyContinue
            Write-Success "Port 8000 uzerindeki sunucu durduruldu (PID: $pidToKill)."
        }
    }
}

# Venv icindeki python surecleri
try {
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*$ProjectDir*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Success "Proje dizinindeki Python calistiricilari durduruldu."
} catch {}
Write-Host ""

# 2. Windows Gorev Zamanlayicisi (Task Scheduler) Kaydini Silme
Write-Step "2/5: Windows Gorev Zamanlayicisi (OsesPOS_AutoServer) Temizleniyor..."
try {
    schtasks /Delete /TN "OsesPOS_AutoServer" /F 2>$null | Out-Null
    Write-Success "Gorev Zamanlayicisi kaydi silindi."
} catch {
    Write-Warn "Gorev Zamanlayicisi kaydi zaten yok veya kaldirilamadi."
}
Write-Host ""

# 3. Windows Baslangic (Startup) Klasorundeki Otomatik Baslatici Kisayolunu Silme
Write-Step "3/5: Windows Baslangic Klasoru (Startup) Temizleniyor..."
try {
    $startupPaths = @(
        [System.Environment]::GetFolderPath("Startup"),
        [System.Environment]::GetFolderPath("CommonStartup")
    )
    foreach ($sDir in $startupPaths) {
        if (Test-Path $sDir) {
            $sFile = Join-Path $sDir "OsesPOS_AutoStart.lnk"
            if (Test-Path $sFile) {
                Remove-Item $sFile -Force -ErrorAction SilentlyContinue
                Write-Success "Baslangic klasorundeki '$sFile' silindi."
            }
        }
    }
} catch {
    Write-Warn "Baslangic kisayolu silinirken uyari: $_"
}
Write-Host ""

# 4. Masaustu Kisayollarini Silme
Write-Step "4/5: Masaustu Kisayollari Temizleniyor..."
try {
    $desktopPaths = @(
        [System.Environment]::GetFolderPath("Desktop"),
        [System.Environment]::GetFolderPath("CommonDesktopDirectory")
    )
    foreach ($dPath in $desktopPaths) {
        if (Test-Path $dPath) {
            Get-ChildItem -Path $dPath -Filter "O Ses POS*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
                Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                Write-Success "Masaustunden silindi: $($_.Name)"
            }
        }
    }
    
    # run_background_windows.vbs dosyasini da temizle
    $vbsPath = Join-Path $ProjectDir "run_background_windows.vbs"
    if (Test-Path $vbsPath) {
        Remove-Item $vbsPath -Force -ErrorAction SilentlyContinue
        Write-Success "run_background_windows.vbs dosyasi temizlendi."
    }
} catch {
    Write-Warn "Masaustu kisayollari silinirken uyari: $_"
}
Write-Host ""

# 5. Sanal Ortam (venv) ve Indirilen Dosyalari Temizleme Secenegi
Write-Step "5/5: Disk Temizligi ve Kaldirma Secenekleri..."
Write-Host ""

$delVenv = Read-Host "Python Sanal Ortamini (venv) ve indirilen cloudflared.exe dosyasini silmek ister misiniz? (E/H)"
if ($delVenv -eq 'E' -or $delVenv -eq 'e') {
    $venvDir = Join-Path $ProjectDir "venv"
    if (Test-Path $venvDir) {
        Write-Step "venv klasoru siliniyor (biraz surebilir)..."
        Remove-Item $venvDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "venv sanal ortami silindi."
    }
    $cfExe = Join-Path $ProjectDir "cloudflared.exe"
    if (Test-Path $cfExe) {
        Remove-Item $cfExe -Force -ErrorAction SilentlyContinue
        Write-Success "cloudflared.exe silindi."
    }
    $tunnelLog = Join-Path $ProjectDir "tunnel.log"
    if (Test-Path $tunnelLog) {
        Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  TEBRIKLER! O SES POS SISTEMI WINDOWS'TAN BASARIYLA KALDIRILDI!      " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Tum arka plan surecleri kapatildi, baslangic ayarlari ve kisayollar silindi." -ForegroundColor White
Write-Host ""
