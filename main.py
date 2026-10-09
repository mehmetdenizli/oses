from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
from contextlib import asynccontextmanager
import subprocess
import threading
import socket
import re
import sys
import os
import time
import json
import urllib.request
import database
from gmp3_driver import GMP3Driver

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    # Reset stale tunnel status on boot
    tunnel_file = STATIC_DIR / "tunnel_url.json"
    try:
        tunnel_file.write_text(json.dumps({"url": None, "active": False}), encoding="utf-8")
    except Exception:
        pass
    yield
    stop_tunnel_process()

app = FastAPI(
    title="O Ses Çiğköfte POS & Adisyon Sistemi",
    description="Cross-platform FastAPI + SQLite POS backend for Touchscreen PC and Mobile devices",
    version="1.4.0",
    lifespan=lifespan
)

# Allow CORS for mobile phones and local network clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---

class ProductCreateUpdateSchema(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = ""
    price: float = Field(gt=0)
    price_masa: Optional[float] = None
    unit: Optional[str] = "Adet"
    image_symbol: Optional[str] = "🌶️"
    image_url: Optional[str] = None
    is_active: Optional[int] = 1
    has_options: Optional[int] = 1

class ImageUploadSchema(BaseModel):
    image_data: str # Base64 data URL or raw string
    filename: Optional[str] = "upload.png"

class ProductImageUpdateSchema(BaseModel):
    image_url: Optional[str] = ""

class StoreSettingsSchema(BaseModel):
    store_name: Optional[str] = "O SES ÇİĞKÖFTE"
    store_subtitle: Optional[str] = "HIZLI KASA & ADİSYON POS"
    store_logo_url: Optional[str] = ""
    admin_pin: Optional[str] = "oses1234"
    gmp3_enabled: Optional[str] = "1"
    gmp3_connection_type: Optional[str] = "SIMULATION"
    gmp3_ip: Optional[str] = "192.168.1.100"
    gmp3_port: Optional[str] = "9090"
    gmp3_com_port: Optional[str] = "COM3"

class GMP3PaymentRequestSchema(BaseModel):
    amount: float = Field(gt=0)
    order_id: Optional[str] = ""
    payment_type: Optional[str] = "KREDI_KART"

class VerifyPinSchema(BaseModel):
    pin: str

class ChangePinSchema(BaseModel):
    current_pin: str
    new_pin: str

class PriceUpdateSchema(BaseModel):
    price: float = Field(gt=0)
    price_masa: Optional[float] = None

class OptionGroupUpdateSchema(BaseModel):
    name: str
    free_limit: int = 0
    extra_fee: float = 0.0

class OptionItemSchema(BaseModel):
    group_id: int
    name: str
    extra_price: float = 0.0
    is_default: int = 0
    sort_order: int = 99

class OptionItemUpdateSchema(BaseModel):
    name: str
    extra_price: float = 0.0
    is_default: int = 0

class CustomerCreate(BaseModel):
    phone: str
    name: str
    address: Optional[str] = ""
    notes: Optional[str] = ""

class CustomerUpdateSchema(BaseModel):
    phone: str
    name: str
    address: Optional[str] = ""
    notes: Optional[str] = ""

class OrderItemSchema(BaseModel):
    product_id: int
    product_name: str
    unit_price: float
    quantity: int = Field(gt=0, default=1)
    options_summary: Optional[str] = ""
    total_price: float

class OrderCreateSchema(BaseModel):
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    source: Optional[str] = "KASA"  # 'KASA', 'GETIR', 'TRENDYOL', 'MIGROS', 'KAREKOD_MUSTERI'
    order_type: Optional[str] = "PAKET"  # 'PAKET', 'MASA'
    subtotal: float
    discount_amount: float = 0.0
    discount_type: Optional[str] = "NONE"  # 'NONE', 'TL', 'PERCENT', 'IKRAM'
    total_amount: float
    payment_method: str  # 'NAKIT', 'KREDI_KART', 'VERESIYE'
    order_status: Optional[str] = None
    note: Optional[str] = ""
    items: List[OrderItemSchema]

class CheckoutOpenOrderSchema(BaseModel):
    payment_method: str = "NAKIT"

class ExternalOrderSchema(BaseModel):
    source: str  # 'TRENDYOL', 'GETIR', 'MIGROS'
    external_order_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_address: str
    note: Optional[str] = ""
    payment_method: Optional[str] = "KREDI_KART"
    items: List[OrderItemSchema]
    total_amount: float

# --- API Endpoints ---

@app.get("/api/categories")
def get_categories():
    return database.get_categories()

@app.get("/api/products")
def get_products(category_id: Optional[int] = None, include_inactive: bool = False):
    return database.get_products(category_id=category_id, include_inactive=include_inactive)

# --- Option Groups & Items Endpoints ---

@app.get("/api/options")
def get_options():
    return database.get_option_groups_with_items()

@app.put("/api/options/groups/{group_id}")
def update_group(group_id: int, data: OptionGroupUpdateSchema):
    return database.update_option_group(group_id, data.dict())

@app.post("/api/options/items")
def create_item(item: OptionItemSchema):
    return database.create_option_item(item.dict())

@app.put("/api/options/items/{item_id}")
def update_item(item_id: int, item: OptionItemUpdateSchema):
    return database.update_option_item(item_id, item.dict())

@app.delete("/api/options/items/{item_id}")
def delete_item(item_id: int):
    return database.delete_option_item(item_id)

@app.post("/api/admin/reset-options")
def reset_options():
    conn = database.get_db_connection()
    database.reset_options_to_default(conn)
    conn.close()
    return {"status": "success", "message": "Opsiyonlar ve fiyat kuralları varsayılana sıfırlandı."}

# --- Product & Price Management Endpoints ---

@app.post("/api/products")
def create_product(product: ProductCreateUpdateSchema):
    return database.create_product(product.dict())

@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductCreateUpdateSchema):
    existing = database.get_product_by_id(product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return database.update_product(product_id, product.dict())

@app.patch("/api/products/{product_id}/price")
def update_price(product_id: int, data: PriceUpdateSchema):
    existing = database.get_product_by_id(product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return database.update_product_price(product_id, data.price, data.price_masa)

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    existing = database.get_product_by_id(product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return database.delete_product(product_id)

@app.post("/api/admin/reset-menu")
def reset_menu():
    conn = database.get_db_connection()
    database.reset_products_to_menu(conn)
    conn.close()
    return {"status": "success", "message": "Menü ve fiyatlar orijinal 25. Yıl menüsüne sıfırlandı."}

# --- Customer Endpoints ---

@app.get("/api/customers/search")
def search_customers(q: Optional[str] = ""):
    return database.search_customers(q or "")

@app.get("/api/customers/{phone}")
def get_customer(phone: str):
    customer = database.get_customer_by_phone(phone)
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return customer

@app.post("/api/customers")
def create_or_update_customer(data: CustomerCreate):
    return database.save_customer(data.phone, data.name, data.address, data.notes)

@app.put("/api/customers/{phone}")
def update_customer(phone: str, data: CustomerUpdateSchema):
    existing = database.get_customer_by_phone(phone)
    if not existing:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return database.update_customer(phone, data.phone, data.name, data.address, data.notes)

@app.delete("/api/customers/{phone}")
def delete_customer(phone: str):
    existing = database.get_customer_by_phone(phone)
    if not existing:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return database.delete_customer(phone)

# --- Order Endpoints ---

@app.post("/api/orders")
def submit_order(order: OrderCreateSchema):
    if not order.items:
        raise HTTPException(status_code=400, detail="Sipariş sepeti boş olamaz!")
    
    order_dict = order.dict()
    result = database.create_order(order_dict)
    return result

@app.get("/api/orders")
def list_orders(
    limit: int = 30,
    source: Optional[str] = None,
    date: Optional[str] = None,
    month: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    return database.get_orders(
        limit=limit,
        source=source,
        date_str=date,
        month_str=month,
        start_date=start_date,
        end_date=end_date
    )

@app.get("/api/orders/pending-qr-approvals")
def get_pending_qr_approvals():
    return database.get_pending_qr_orders()

@app.get("/api/orders/open")
def get_open_orders_route():
    return database.get_open_orders()

@app.post("/api/orders/{order_id}/checkout")
def checkout_open_order_route(order_id: int, payload: CheckoutOpenOrderSchema):
    return database.checkout_open_order(order_id, payload.payment_method)

@app.post("/api/orders/{order_id}/approve")
def approve_qr_order(order_id: int):
    return database.approve_qr_order(order_id)

@app.post("/api/orders/{order_id}/reject")
def reject_qr_order(order_id: int):
    return database.reject_qr_order(order_id)

@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    order = database.get_order_details(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    return order

# --- External Integration Endpoint ---

@app.post("/api/external/orders")
def create_external_order(order: ExternalOrderSchema):
    source_clean = order.source.upper()
    if source_clean not in ["TRENDYOL", "GETIR", "MIGROS", "PHONE"]:
        source_clean = "TRENDYOL"

    subtotal = sum(item.total_price for item in order.items)

    pos_order = {
        "customer_phone": order.customer_phone,
        "customer_name": f"[{source_clean}] {order.customer_name}",
        "customer_address": order.customer_address,
        "source": source_clean,
        "subtotal": subtotal,
        "discount_amount": 0.0,
        "discount_type": "NONE",
        "total_amount": order.total_amount,
        "payment_method": order.payment_method or "KREDI_KART",
        "note": f"Dış Sipariş No: {order.external_order_id or 'N/A'} - Not: {order.note or ''}",
        "items": [item.dict() for item in order.items]
    }

    result = database.create_order(pos_order)
    return {
        "status": "success",
        "message": f"{source_clean} siparişi başarıyla adisyona işlendi.",
        "order": result
    }

# --- Analytics & Reporting Endpoints ---

@app.get("/api/stats/daily")
def daily_stats(date: Optional[str] = None):
    return database.get_analytics_report(period='daily', date_str=date)

@app.get("/api/stats/analytics")
def analytics_report(
    period: str = "daily",
    date: Optional[str] = None,
    month: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    return database.get_analytics_report(
        period=period,
        date_str=date,
        month_str=month,
        start_date=start_date,
        end_date=end_date
    )

# --- Static File Serving ---
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- Cloudflare Tunnel Management ---

tunnel_process = None
tunnel_info = {
    "url": None,
    "active": False,
    "started_at": None,
    "error": None
}

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def find_cloudflared_binary():
    if sys.platform == 'win32':
        win_bin = BASE_DIR / 'cloudflared.exe'
        if win_bin.exists():
            return str(win_bin)
    else:
        mac_bin = BASE_DIR / 'cloudflared'
        if mac_bin.exists() and os.access(mac_bin, os.X_OK):
            return str(mac_bin)
    import shutil
    cmd = shutil.which('cloudflared')
    if cmd:
        return cmd
    return None

def download_cloudflared_if_needed():
    existing = find_cloudflared_binary()
    if existing:
        return existing
    if sys.platform == 'win32':
        dest = BASE_DIR / "cloudflared.exe"
        try:
            url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
            urllib.request.urlretrieve(url, str(dest))
            return str(dest)
        except Exception as e:
            print("cloudflared download failed:", e)
            return None
    return None

def start_tunnel_process():
    global tunnel_process, tunnel_info
    if tunnel_process and tunnel_process.poll() is None and tunnel_info["active"] and tunnel_info["url"]:
        return {"status": "already_running", "data": tunnel_info}

    binary = download_cloudflared_if_needed()
    if not binary:
        tunnel_info["active"] = False
        tunnel_info["error"] = "cloudflared dosyası bulunamadı!"
        return {"status": "error", "message": tunnel_info["error"]}

    try:
        if tunnel_process:
            try:
                tunnel_process.terminate()
            except Exception:
                pass

        tunnel_info["active"] = False
        tunnel_info["url"] = None
        tunnel_info["error"] = None

        proc = subprocess.Popen(
            [binary, 'tunnel', '--url', 'http://127.0.0.1:8000'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        tunnel_process = proc

        detected_url = None
        start_time = time.time()
        while time.time() - start_time < 15:
            if proc.poll() is not None:
                break
            line = proc.stderr.readline()
            if not line:
                time.sleep(0.2)
                continue
            m = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if m and 'api.trycloudflare.com' not in m.group(0):
                detected_url = m.group(0)
                break

        if detected_url:
            tunnel_info["url"] = detected_url
            tunnel_info["active"] = True
            tunnel_info["started_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            tunnel_info["error"] = None

            tunnel_file = STATIC_DIR / "tunnel_url.json"
            tunnel_file.write_text(json.dumps(tunnel_info), encoding="utf-8")

            def _drain():
                try:
                    for _ in proc.stderr:
                        pass
                except Exception:
                    pass
            threading.Thread(target=_drain, daemon=True).start()

            return {"status": "success", "data": tunnel_info}
        else:
            tunnel_info["active"] = False
            tunnel_info["error"] = "Tünel linki 15 saniyede alınamadı."
            return {"status": "error", "message": tunnel_info["error"]}

    except Exception as e:
        tunnel_info["active"] = False
        tunnel_info["error"] = str(e)
        return {"status": "error", "message": str(e)}

def stop_tunnel_process():
    global tunnel_process, tunnel_info
    if tunnel_process:
        try:
            tunnel_process.terminate()
            tunnel_process.wait(timeout=2)
        except Exception:
            try:
                tunnel_process.kill()
            except Exception:
                pass
        tunnel_process = None

    tunnel_info["active"] = False
    tunnel_info["url"] = None
    tunnel_file = STATIC_DIR / "tunnel_url.json"
    try:
        tunnel_file.write_text(json.dumps(tunnel_info), encoding="utf-8")
    except Exception:
        pass
    return {"status": "stopped", "data": tunnel_info}

@app.get("/api/tunnel-url")
def get_tunnel_status():
    local_ip = get_local_ip()
    is_running = False
    if tunnel_process and tunnel_process.poll() is None:
        is_running = True
    elif tunnel_info.get("active") and tunnel_info.get("url"):
        is_running = True

    return {
        "url": tunnel_info.get("url") if is_running else None,
        "active": is_running,
        "local_ip": local_ip,
        "local_url": f"http://{local_ip}:8000/qr",
        "has_binary": find_cloudflared_binary() is not None,
        "error": tunnel_info.get("error")
    }

@app.post("/api/tunnel-url")
async def save_tunnel_url(request: Request):
    data = await request.json()
    global tunnel_info
    tunnel_info["url"] = data.get("url")
    tunnel_info["active"] = data.get("active", True)
    tunnel_info["error"] = None
    tunnel_file = STATIC_DIR / "tunnel_url.json"
    tunnel_file.write_text(json.dumps(tunnel_info), encoding="utf-8")
    return {"status": "success", "data": tunnel_info}

@app.post("/api/tunnel-start")
def api_start_tunnel():
    res = start_tunnel_process()
    if res.get("status") == "error":
        raise HTTPException(status_code=500, detail=res.get("message", "Tünel başlatılamadı"))
    return res

@app.post("/api/tunnel-stop")
def api_stop_tunnel():
    return stop_tunnel_process()

# --- Store Settings & Image Upload Endpoints ---

@app.get("/api/settings")
def get_settings():
    return database.get_store_settings()

@app.post("/api/settings")
def update_settings(payload: StoreSettingsSchema):
    return database.update_store_settings(payload.model_dump())

@app.post("/api/verify-pin")
def verify_admin_pin(payload: VerifyPinSchema):
    settings = database.get_store_settings()
    stored_pin = settings.get("admin_pin", "oses1234")
    if payload.pin.strip() == stored_pin.strip():
        return {"status": "success", "valid": True}
    return {"status": "error", "valid": False, "message": "Geçersiz Yönetici PIN Kodu!"}

@app.post("/api/change-pin")
def change_admin_pin(payload: ChangePinSchema):
    settings = database.get_store_settings()
    stored_pin = settings.get("admin_pin", "oses1234")
    if payload.current_pin.strip() != stored_pin.strip():
        raise HTTPException(status_code=400, detail="Mevcut yönetici şifreniz hatalı!")
    
    if not payload.new_pin.strip() or len(payload.new_pin.strip()) < 4:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 4 karakter olmalıdır!")

    database.update_store_settings({"admin_pin": payload.new_pin.strip()})
    return {"status": "success", "message": "Yönetici şifreniz başarıyla değiştirildi!"}

@app.post("/api/reset-pin")
def reset_admin_pin():
    database.update_store_settings({"admin_pin": "oses1234"})
    return {"status": "success", "message": "Yönetici şifresi varsayılan 'oses1234' olarak sıfırlandı!"}

# --- inPOS m530 & GMP-3 Payment Terminal Endpoints ---

@app.post("/api/gmp3/send-payment")
def send_gmp3_payment(payload: GMP3PaymentRequestSchema):
    settings = database.get_store_settings()
    conn_type = settings.get("gmp3_connection_type", "SIMULATION")
    ip = settings.get("gmp3_ip", "192.168.1.100")
    port = settings.get("gmp3_port", "9090")
    com_port = settings.get("gmp3_com_port", "COM3")

    driver = GMP3Driver(connection_type=conn_type, ip=ip, port=port, com_port=com_port)
    res = driver.send_payment(payload.amount, payload.order_id, payload.payment_type)
    return res

@app.get("/api/gmp3/status")
def get_gmp3_status():
    settings = database.get_store_settings()
    conn_type = settings.get("gmp3_connection_type", "SIMULATION")
    ip = settings.get("gmp3_ip", "192.168.1.100")
    port = settings.get("gmp3_port", "9090")
    com_port = settings.get("gmp3_com_port", "COM3")

    driver = GMP3Driver(connection_type=conn_type, ip=ip, port=port, com_port=com_port)
    return driver.check_status()

@app.patch("/api/products/{product_id}/image")
def update_product_image_route(product_id: int, payload: ProductImageUpdateSchema):
    return database.update_product_image(product_id, payload.image_url)

@app.post("/api/upload/image")
def upload_image(payload: ImageUploadSchema):
    try:
        import base64
        import uuid

        uploads_dir = STATIC_DIR / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)

        img_data = payload.image_data
        file_ext = ".png"

        if "," in img_data:
            header, img_data = img_data.split(",", 1)
            if "jpeg" in header or "jpg" in header:
                file_ext = ".jpg"
            elif "webp" in header:
                file_ext = ".webp"

        binary_data = base64.b64decode(img_data)
        filename = f"img_{uuid.uuid4().hex[:10]}{file_ext}"
        filepath = uploads_dir / filename

        with open(filepath, "wb") as f:
            f.write(binary_data)

        url = f"/static/uploads/{filename}"
        return {"status": "success", "url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Görsel yükleme hatası: {str(e)}")

@app.get("/qr")
def serve_qr_menu():
    qr_path = STATIC_DIR / "qr.html"
    if qr_path.exists():
        return FileResponse(str(qr_path))
    return {"message": "QR Menü yüklenemedi."}

@app.get("/")
def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "O Ses Çiğköfte POS API sunucusu çalışıyor."}

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 O Ses Çiğköfte POS & Adisyon Sistemi Başlatılıyor...")
    print("📍 Yerel Kasa Erişimi: http://localhost:8000")
    print("📱 Mobil / Wifi Erişimi: http://<YEREL_IP>:8000")
    print("=" * 60)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
