@echo off
title "O Ses POS - Sunuculari Durdur"
cd /d "%~dp0"

echo ============================================================
echo   O SES CIGKOFTE POS - ARKA PLAN SERVISLERINI DURDURUCU
echo ============================================================
echo.

echo [*] 1/3: Cloudflare tuneli (cloudflared.exe) durduruluyor...
taskkill /F /IM cloudflared.exe >nul 2>&1
powershell -NoProfile -Command "Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo    [OK] Cloudflare tuneli durduruldu.

echo [*] 2/3: Port 8000 Kasa POS sunucusu tespit ediliyor...
powershell -NoProfile -Command "try { Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo    [OK] Port 8000 POS sunucusu durduruldu.

echo [*] 3/3: Arka plan venv Python surecleri temizleniyor...
powershell -NoProfile -Command "Get-Process -Name python,pythonw -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*%~dp0*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo    [OK] Python arka plan surecleri kapatildi.

echo.
echo ============================================================
echo   [TAMAMLANDI] Tum O Ses POS arka plan servisleri durduruldu!
echo ============================================================
echo.
echo Kapatmak icin herhangi bir tusa basin veya pencere 5 sn sonra kapanacaktir.
timeout /t 5 >nul
exit /b 0
