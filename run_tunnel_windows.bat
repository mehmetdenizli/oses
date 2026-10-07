@echo off
chcp 65001 > nul
title "Cloudflare Tunnel - O Ses Cigkofte QR Menu"

cd /d "%~dp0"

echo ============================================================
echo 🌩️ Cloudflare Tunnel Otomatik Başlatıcı
echo ============================================================

IF NOT EXIST "cloudflared.exe" (
    echo 'cloudflared.exe' bulunamadı, indiriliyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    echo Cloudflare sürücüsü indirildi!
)

echo.
echo 🚀 Cloudflare HTTPS Tüneli Açılıyor...
echo 📱 Masadan QR Sipariş Sistemi Aktif!
echo ============================================================
echo.

cloudflared.exe tunnel --url http://localhost:8000

pause
