#!/bin/bash
# Executable launcher for macOS Cloudflare Tunnel
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo "🌩️ Cloudflare Tunnel Başlatılıyor (O Ses POS QR Menü)"
echo "============================================================"

CMD="cloudflared"
if [ -f "./cloudflared" ]; then
    CMD="./cloudflared"
fi

echo "🚀 Cloudflare Ücretsiz HTTPS Tüneli Açılıyor (http://localhost:8000 -> HTTPS)..."
$CMD tunnel --url http://localhost:8000 2>&1 | tee tunnel.log &

sleep 4
URL=$(grep -o "https://[a-zA-Z0-9-]*\.trycloudflare\.com" tunnel.log | tail -n 1)

if [ -n "$URL" ]; then
    echo "============================================================"
    echo "✅ Canlı HTTPS QR Menü Adresiniz Üretildi!"
    echo "🔗 Bağlantı: $URL/qr"
    echo "============================================================"
    curl -s -X POST http://localhost:8000/api/tunnel-url -H "Content-Type: application/json" -d "{\"url\":\"$URL\",\"active\":true}"

    # Vercel Smart Redirector ping (if VERCEL_URL is set in environment or config)
    if [ -n "$VERCEL_URL" ]; then
        echo "🚀 Vercel Sabit QR Kod Yönlendirmesi Güncelleniyor..."
        curl -s -X POST "$VERCEL_URL/api/update" -H "Content-Type: application/json" -d "{\"target_url\":\"$URL\"}"
    fi
fi

wait
