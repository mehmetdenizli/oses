@echo off
title "Cloudflare Tunnel - O Ses Cigkofte QR Menu"

cd /d "%~dp0"

echo ============================================================
echo Cloudflare Tunnel Otomatik Baslatici
echo ============================================================

IF NOT EXIST "cloudflared.exe" (
    echo 'cloudflared.exe' bulunamadi, indiriliyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    echo Cloudflare surucusu indirildi!
)

echo.
echo Cloudflare HTTPS Tuneli Aciliyor...
echo Masadan QR Siparis Sistemi Aktif!
echo ============================================================
echo.

cloudflared.exe tunnel --url http://localhost:8000

pause
