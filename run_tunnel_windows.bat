@echo off
title "Cloudflare Tunnel - O Ses Cigkofte QR Menu"

cd /d "%~dp0"

echo ============================================================
echo Cloudflare Tunnel Otomatik Baslatici
echo ============================================================

IF NOT EXIST "%~dp0cloudflared.exe" (
    echo 'cloudflared.exe' bulunamadi, indiriliyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0cloudflared.exe'"
    echo Cloudflare surucusu indirildi!
)

echo.
echo Cloudflare HTTPS Tuneli Aciliyor...
echo Masadan QR Siparis Sistemi Aktif!
echo ============================================================
echo.

del /f /q tunnel.log 2>nul
start /b "" "%~dp0cloudflared.exe" tunnel --url http://localhost:8000 > tunnel.log 2>&1

echo Canli baglanti linki bekleniyor (en fazla 15 sn)...
powershell -Command "$url=''; for ($i=0; $i -lt 15; $i++) { Start-Sleep -Seconds 1; if (Test-Path tunnel.log) { $m = Select-String -Path tunnel.log -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | ForEach-Object { $_.Matches.Value } | Where-Object { $_ -notlike '*api.trycloudflare.com*' } | Select-Object -Last 1; if ($m) { $url = $m; break; } } }; if ($url) { Write-Host '============================================================'; Write-Host ('Canli QR Linkiniz: ' + $url + '/qr'); Write-Host '============================================================'; try { Invoke-RestMethod -Uri 'http://localhost:8000/api/tunnel-url' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{url=$url; active=$true}) | Out-Null } catch {} } else { Write-Host 'Tunel arka planda devam ediyor.' }"

echo.
echo Tunel arka planda calisiyor. Kapatmak icin bu pencereyi kapatin.
pause
