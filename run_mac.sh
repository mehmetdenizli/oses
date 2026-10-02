#!/bin/bash
echo "============================================================"
echo "🌶️  O Ses Çiğköfte POS & Adisyon Sistemi - macOS Başlatıcı"
echo "============================================================"

# Navigate to script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Detect working python binary
PYTHON_CMD="python3"
if [ -f "/usr/bin/python3" ]; then
    PYTHON_CMD="/usr/bin/python3"
fi

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "📦 Sanal ortam (venv) oluşturuluyor..."
    $PYTHON_CMD -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "📥 Gerekli paketler kontrol ediliyor..."
pip install -r requirements.txt

# Run main application
echo "🚀 POS Sunucusu başlatılıyor (http://0.0.0.0:8000)..."
python main.py
