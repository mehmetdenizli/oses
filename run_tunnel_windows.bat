@echo off
chcp 65001 > nul
title Cloudflare Tunnel - O Ses Çiğköfte QR Menü

echo ============================================================
echo 🌩️ Cloudflare Tunnel (HTTPS) Otomatik Başlatıcı
echo ============================================================

cd /d "%~dp0"

IF NOT EXIST "cloudflared.exe" (
    echo 📥 'cloudflared.exe' indiriliyor, lütfen bekleyin...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    echo ✅ Cloudflare sürücüsü indirildi!
)

echo.
echo 🚀 Cloudflare Ücretsiz HTTPS Tüneli Açılıyor...
echo 📱 Müşteriler 4G/5G Hücresel İnternet ile Sipariş Verebilir!
echo ============================================================
echo.

cloudflared.exe tunnel --url http://localhost:8000 2>&1 | powershell -Command "$input | Tee-Object -FilePath 'tunnel.log'"

pause
