import sqlite3
from pathlib import Path
from datetime import datetime
import re

# Cross-platform safe path initialization
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "oses_pos.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Müşteri Kayıt Defteri (Telefon ID'li)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        notes TEXT,
        total_orders INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    """)

    # Kategoriler
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER DEFAULT 0
    );
    """)

    # Ürünler
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        price_masa REAL DEFAULT 0.0,
        unit TEXT DEFAULT 'Adet',
        image_symbol TEXT,
        is_active INTEGER DEFAULT 1,
        has_options INTEGER DEFAULT 1,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    );
    """)

    try:
        cursor.execute("ALTER TABLE products ADD COLUMN price_masa REAL DEFAULT 0.0")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
    except Exception:
        pass

    cursor.execute("UPDATE products SET price_masa = price WHERE price_masa IS NULL OR price_masa = 0.0")

    # Store Settings (İşletme Adı, Logo URL, Alt Başlık vb.)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS store_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)

    # Seed default store settings if empty
    cursor.execute("SELECT COUNT(*) FROM store_settings")
    if cursor.fetchone()[0] == 0:
        default_settings = [
            ("store_name", "OSES BAĞLAR"),
            ("store_subtitle", "LEZZETİN ADRESİNE HOŞGELDİNİZ"),
            ("store_phone", "0551 575 32 00"),
            ("store_logo_url", ""),
            ("admin_pin", "oses1234"),
            ("gmp3_enabled", "1"),
            ("gmp3_connection_type", "SIMULATION"),
            ("gmp3_ip", "192.168.1.100"),
            ("gmp3_port", "9090"),
            ("gmp3_com_port", "COM3")
        ]
        for k, v in default_settings:
            cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", (k, v))
    else:
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('admin_pin', 'oses1234')")
        cursor.execute("UPDATE store_settings SET value = 'oses1234' WHERE key = 'admin_pin' AND value = '1234'")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('gmp3_enabled', '1')")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('gmp3_connection_type', 'SIMULATION')")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('gmp3_ip', '192.168.1.100')")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('gmp3_port', '9090')")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('gmp3_com_port', 'COM3')")
        cursor.execute("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('qr_custom_domain', 'https://osesbaglar.onrender.com')")
        cursor.execute("UPDATE store_settings SET value = 'https://osesbaglar.onrender.com' WHERE key = 'qr_custom_domain' AND (value LIKE '%vercel.app%' OR value = '')")

    # Opsiyon Grupları (Garnitür ücretsiz limiti ve aşım ücreti kuralı)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS option_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        type TEXT DEFAULT 'MULTIPLE',
        free_limit INTEGER DEFAULT 0,
        extra_fee REAL DEFAULT 0.0,
        sort_order INTEGER DEFAULT 0
    );
    """)

    # Opsiyon Seçenekleri (Sos/Ekstra özel fiyat farkı)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS option_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        extra_price REAL DEFAULT 0.0,
        is_default INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES option_groups (id) ON DELETE CASCADE
    );
    """)

    # Siparişler (source: 'KASA', 'GETIR', 'TRENDYOL', 'MIGROS', order_type: 'PAKET', 'MASA')
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_phone TEXT,
        customer_name TEXT,
        customer_address TEXT,
        source TEXT DEFAULT 'KASA',
        order_type TEXT DEFAULT 'PAKET',
        subtotal REAL NOT NULL,
        discount_amount REAL DEFAULT 0.0,
        discount_type TEXT DEFAULT 'NONE',
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'ODENDI',
        order_status TEXT DEFAULT 'TAMAMLANDI',
        note TEXT,
        is_printed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_phone) REFERENCES customers (phone)
    );
    """)

    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN is_printed INTEGER DEFAULT 0")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'PAKET'")
    except Exception:
        pass

    cursor.execute("UPDATE categories SET name = 'Çiğ Köfteler' WHERE name = 'Dürümler & Paketler'")

    # Sipariş Kalemleri
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        options_summary TEXT,
        total_price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Seed initial data ONLY if categories table is empty (fresh database)
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        seed_default_data(conn)

    # Seed option groups if empty
    cursor.execute("SELECT COUNT(*) FROM option_groups")
    if cursor.fetchone()[0] == 0:
        reset_options_to_default(conn)

    # Seed default customers if empty (for fresh Windows/Mac installs)
    cursor.execute("SELECT COUNT(*) FROM customers")
    if cursor.fetchone()[0] == 0:
        seed_default_customers(conn)

    conn.close()

def seed_default_customers(conn):
    cursor = conn.cursor()
    sample_customers = [
        ("05321002030", "Ahmet Yılmaz", "Atatürk Mah. Karanfil Sok. No: 14 D: 3, Kadıköy / İstanbul", "Acısız tercih ediyor, zile basmayın bebek uyuyor.", 5),
        ("05559876543", "Ayşe Demir", "Moda Cad. Güneş Apt. No: 82/4, Kadıköy", "Bol nar ekşisi ve ekstra limon istiyor.", 3),
        ("05370606585", "Mehmet Denizli", "İnönü Mah. Ortahisar / Trabzon", "Müdür / Yönetici", 12),
        ("05440001122", "Kapsamlı Test Müşterisi", "Moda Cad. No: 50 Kadıköy", "Veresiye defterine yaz", 14),
        ("05515753200", "Sipariş Hattı Müşterisi", "Kahraman Maraş Cad. No:36/A Trabzon", "Hızlı paket servis", 8)
    ]
    for phone, name, addr, notes, orders in sample_customers:
        cursor.execute("""
            INSERT OR IGNORE INTO customers (phone, name, address, notes, total_orders)
            VALUES (?, ?, ?, ?, ?)
        """, (phone, name, addr, notes, orders))
    conn.commit()

def seed_default_data(conn):
    cursor = conn.cursor()

    categories_data = [
        ("Çiğ Köfteler", "🌯", 1),
        ("İçecekler", "🥤", 2),
        ("Tatlılar", "🍰", 3),
        ("Ekstralar & Soslar", "🌶️", 4)
    ]

    for cat_name, icon, sort_order in categories_data:
        cursor.execute("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", (cat_name, icon, sort_order))

    reset_products_to_menu(conn)
    reset_options_to_default(conn)

def reset_products_to_menu(conn):
    cursor = conn.cursor()

    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM categories")

    categories_data = [
        ("Çiğ Köfteler", "🌯", 1),
        ("İçecekler", "🥤", 2),
        ("Tatlılar", "🍰", 3),
        ("Ekstralar & Soslar", "🌶️", 4)
    ]

    for cat_name, icon, sort_order in categories_data:
        cursor.execute("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", (cat_name, icon, sort_order))

    cursor.execute("SELECT id, name FROM categories")
    cat_map = {row["name"]: row["id"] for row in cursor.fetchall()}

    products_data = [
        # Çiğ Köfteler (Paket Fiyatı, Masa Fiyatı)
        (cat_map["Çiğ Köfteler"], "DÜRÜM", "100 gr çiğ köfte, lavaş, yeşillik", 140.0, 150.0, "Adet", "🌯", 1, 1),
        (cat_map["Çiğ Köfteler"], "ULTRA DÜRÜM", "120 gr çiğ köfte, lavaş, yeşillik", 150.0, 160.0, "Adet", "🌯", 1, 1),
        (cat_map["Çiğ Köfteler"], "MEGA DÜRÜM", "150 gr çiğ köfte, lavaş, yeşillik", 190.0, 200.0, "Adet", "🌯", 1, 1),
        (cat_map["Çiğ Köfteler"], "DUBLE DÜRÜM", "180 gr çiğ köfte, lavaş, yeşillik", 230.0, 250.0, "Adet", "🌯", 1, 1),
        (cat_map["Çiğ Köfteler"], "ÇİĞ DİLİM", "100 gr çiğ köfte, lavaş, yeşillik", 160.0, 170.0, "Adet", "🫓", 1, 1),
        (cat_map["Çiğ Köfteler"], "DORİTOSLU ÇİĞ DİLİM", "100 gr çiğ köfte, Doritos, lavaş, yeşillik", 180.0, 190.0, "Adet", "🌮", 1, 1),
        (cat_map["Çiğ Köfteler"], "KÜÇÜK PAKET", "300 gr çiğ köfte, 2 adet lavaş, yeşillik, 1 acı sos, 1 çiğköfte sos", 270.0, 290.0, "Paket", "🥗", 1, 1),
        (cat_map["Çiğ Köfteler"], "ORTA PAKET", "500 gr çiğ köfte, 4 adet lavaş, yeşillik, 2 acı sos, 2 çiğköfte sos", 440.0, 470.0, "Paket", "🥗", 1, 1),
        (cat_map["Çiğ Köfteler"], "AVANTAJ PAKET", "600 gr çiğ köfte, 4 adet lavaş, yeşillik, 1 acı sos, 1 çiğköfte sos", 500.0, 530.0, "Paket", "🍱", 1, 1),
        (cat_map["Çiğ Köfteler"], "BÜYÜK PAKET", "750 gr çiğ köfte, 6 adet lavaş, yeşillik, 3 acı sos, 3 çiğköfte sos", 600.0, 640.0, "Paket", "🍱", 1, 1),
        (cat_map["Çiğ Köfteler"], "AİLE BOYU PAKET", "1 kg çiğ köfte, 8 adet lavaş, yeşillik, 3 acı sos, 3 çiğköfte sos", 750.0, 800.0, "Paket", "👑", 1, 1),

        # İçecekler
        (cat_map["İçecekler"], "Su", "Doğal kaynak suyu 0.5L", 20.0, 20.0, "Şişe", "💧", 1, 0),
        (cat_map["İçecekler"], "Küçük Ayran", "Küçük boy taze ayran", 40.0, 45.0, "Adet", "🥛", 1, 0),
        (cat_map["İçecekler"], "Büyük Ayran", "Büyük boy taze ayran", 50.0, 55.0, "Adet", "🥛", 1, 0),
        (cat_map["İçecekler"], "Acılı Ayran", "Özel baharatlı acılı ayran", 60.0, 65.0, "Adet", "🥛", 1, 0),
        (cat_map["İçecekler"], "Naneli Ayran", "Taze naneli ferahlatıcı ayran", 60.0, 65.0, "Adet", "🥛", 1, 0),
        (cat_map["İçecekler"], "Ekşi Ayran", "Geleneksel ekşi yayık ayranı", 60.0, 65.0, "Adet", "🥛", 1, 0),
        (cat_map["İçecekler"], "Kola", "Soğuk kutu kola 330ml", 80.0, 85.0, "Kutu", "🥤", 1, 0),
        (cat_map["İçecekler"], "Ice Tea", "Soğuk çay 330ml", 80.0, 85.0, "Kutu", "🍹", 1, 0),
        (cat_map["İçecekler"], "Fanta", "Portakallı gazlı içecek 330ml", 80.0, 85.0, "Kutu", "🍊", 1, 0),
        (cat_map["İçecekler"], "Şalgam", "Adana usulü şalgam suyu", 40.0, 45.0, "Şişe", "🍷", 1, 0),
        (cat_map["İçecekler"], "Maden Suyu", "Sade maden suyu (Soda)", 40.0, 45.0, "Şişe", "🍾", 1, 0),
        (cat_map["İçecekler"], "Turşu Suyu", "Geleneksel lezzetli turşu suyu", 40.0, 45.0, "Bardak", "🥒", 1, 0),
        (cat_map["İçecekler"], "Litrelik Ayran", "1 Litre aile boyu ayran", 100.0, 110.0, "Şişe", "🥛", 1, 0),
        (cat_map["İçecekler"], "Litrelik Kola", "1 Litre soğuk kola", 100.0, 110.0, "Şişe", "🥤", 1, 0),

        # Tatlılar
        (cat_map["Tatlılar"], "Kazandibi", "Geleneksel sütlü kazandibi tatlısı", 70.0, 75.0, "Porsiyon", "🍮", 1, 0),
        (cat_map["Tatlılar"], "Sütlaç", "Fırınlanmış lezzetli ev sütlacı", 70.0, 75.0, "Porsiyon", "🍨", 1, 0),
        (cat_map["Tatlılar"], "Profiterol", "Çikolata soslu taze profiterol", 70.0, 75.0, "Porsiyon", "🧁", 1, 0),
        (cat_map["Tatlılar"], "Supangle", "Yoğun çikolatalı nefis supangle", 70.0, 75.0, "Porsiyon", "🍰", 1, 0),
        (cat_map["Tatlılar"], "Şam Tatlısı", "Antep fıstıklı şerbetli Şam tatlısı", 70.0, 75.0, "Dilim", "🥧", 1, 0),

        # Ekstralar & Soslar
        (cat_map["Ekstralar & Soslar"], "Doritos Farkı", "Dürüme ek çıtır Doritos ilavesi", 20.0, 20.0, "Porsiyon", "🧀", 1, 0),
        (cat_map["Ekstralar & Soslar"], "Ekstra Lavaş", "Taze yumuşak ekstra lavaş ekmeği", 10.0, 10.0, "Adet", "🫓", 1, 0),
        (cat_map["Ekstralar & Soslar"], "Acı Sos 1 kg", "O Ses özel acı sos (1 Kg Şişe)", 200.0, 200.0, "Şişe", "🌶️", 1, 0),
        (cat_map["Ekstralar & Soslar"], "Çiğköfte Sosu 1 kg", "O Ses özel çiğköfte nar ekşili sosu (1 Kg Şişe)", 200.0, 200.0, "Şişe", "🍾", 1, 0),
        (cat_map["Ekstralar & Soslar"], "Burger Sos 750 ml", "Özel gurme burger sosu (750 ml)", 200.0, 200.0, "Şişe", "🥫", 1, 0)
    ]

    for cat_id, name, desc, price, price_m, unit, icon, active, has_opt in products_data:
        cursor.execute("""
            INSERT INTO products (category_id, name, description, price, price_masa, unit, image_symbol, is_active, has_options)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (cat_id, name, desc, price, price_m, unit, icon, active, has_opt))

    conn.commit()

def reset_options_to_default(conn):
    cursor = conn.cursor()

    cursor.execute("DELETE FROM option_items")
    cursor.execute("DELETE FROM option_groups")

    # Group 1: Acı Seviyesi
    cursor.execute("""
        INSERT INTO option_groups (name, icon, type, free_limit, extra_fee, sort_order)
        VALUES ('🔥 ACI SEVİYESİ SEÇİMİ', '🔥', 'SINGLE', 0, 0.0, 1)
    """)
    aci_group_id = cursor.lastrowid

    aci_items = [
        ("Az Acılı", 0.0, 1, 1),
        ("Orta Acılı", 0.0, 0, 2),
        ("Bol Acılı", 0.0, 0, 3),
        ("Acısız", 0.0, 0, 4)
    ]
    for name, price, is_def, sort in aci_items:
        cursor.execute("INSERT INTO option_items (group_id, name, extra_price, is_default, sort_order) VALUES (?, ?, ?, ?, ?)", (aci_group_id, name, price, is_def, sort))

    # Group 2: Yeşillik & Garnitür
    cursor.execute("""
        INSERT INTO option_groups (name, icon, type, free_limit, extra_fee, sort_order)
        VALUES ('🥬 YEŞİLLİK & GARNİTÜR TERCİHLERİ', '🥬', 'MULTIPLE', 4, 10.0, 2)
    """)
    garnitur_group_id = cursor.lastrowid

    garnitur_items = [
        ("Marul", 0.0, 1, 1),
        ("Maydanoz", 0.0, 1, 2),
        ("Nane", 0.0, 1, 3),
        ("Limon", 0.0, 1, 4),
        ("Turşu", 0.0, 0, 5),
        ("Roka", 0.0, 0, 6),
        ("Kornişon Turşu", 0.0, 0, 7)
    ]
    for name, price, is_def, sort in garnitur_items:
        cursor.execute("INSERT INTO option_items (group_id, name, extra_price, is_default, sort_order) VALUES (?, ?, ?, ?, ?)", (garnitur_group_id, name, price, is_def, sort))

    # Group 3: Sos & Ekstralar
    cursor.execute("""
        INSERT INTO option_groups (name, icon, type, free_limit, extra_fee, sort_order)
        VALUES ('🍾 SOS & EKSTRALAR', '🍾', 'MULTIPLE', 0, 0.0, 3)
    """)
    sos_group_id = cursor.lastrowid

    sos_items = [
        ("Nar Ekşisi", 0.0, 1, 1),
        ("Bol Nar Ekşisi", 15.0, 0, 2),
        ("Acı Sos", 15.0, 0, 3),
        ("Çift Lavaş", 15.0, 0, 4),
        ("Doritos İlavesi", 20.0, 0, 5),
        ("Burger Sos", 20.0, 0, 6)
    ]
    for name, price, is_def, sort in sos_items:
        cursor.execute("INSERT INTO option_items (group_id, name, extra_price, is_default, sort_order) VALUES (?, ?, ?, ?, ?)", (sos_group_id, name, price, is_def, sort))

    conn.commit()

# --- Helper Functions for Option Groups & Items Management ---

def get_option_groups_with_items():
    conn = get_db_connection()
    groups = conn.execute("SELECT * FROM option_groups ORDER BY sort_order ASC").fetchall()
    
    res = []
    for g in groups:
        gd = dict(g)
        items = conn.execute("SELECT * FROM option_items WHERE group_id = ? ORDER BY sort_order ASC, id ASC", (gd["id"],)).fetchall()
        gd["items"] = [dict(i) for i in items]
        res.append(gd)

    conn.close()
    return res

def update_option_group(group_id: int, data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE option_groups
        SET name = ?, free_limit = ?, extra_fee = ?
        WHERE id = ?
    """, (
        data.get("name"),
        int(data.get("free_limit", 0)),
        float(data.get("extra_fee", 0.0)),
        group_id
    ))
    conn.commit()
    conn.close()
    return get_option_groups_with_items()

def create_option_item(data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO option_items (group_id, name, extra_price, is_default, sort_order)
        VALUES (?, ?, ?, ?, ?)
    """, (
        int(data.get("group_id")),
        data.get("name"),
        float(data.get("extra_price", 0.0)),
        int(data.get("is_default", 0)),
        int(data.get("sort_order", 99))
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "status": "success"}

def update_option_item(item_id: int, data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE option_items
        SET name = ?, extra_price = ?, is_default = ?
        WHERE id = ?
    """, (
        data.get("name"),
        float(data.get("extra_price", 0.0)),
        int(data.get("is_default", 0)),
        item_id
    ))
    conn.commit()
    conn.close()
    return {"status": "success"}

def delete_option_item(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM option_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# --- Categories & Products Helpers ---

def get_categories():
    conn = get_db_connection()
    categories = conn.execute("SELECT * FROM categories ORDER BY sort_order ASC").fetchall()
    conn.close()
    return [dict(row) for row in categories]

def get_products(category_id=None, include_inactive=False):
    conn = get_db_connection()
    query = "SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE 1=1"
    params = []

    if category_id:
        query += " AND p.category_id = ?"
        params.append(category_id)

    if not include_inactive:
        query += " AND p.is_active = 1"

    query += " ORDER BY p.category_id, p.id ASC"

    products = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in products]

def create_product(p_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    price = float(p_data.get("price", 0.0))
    price_masa = float(p_data.get("price_masa")) if p_data.get("price_masa") is not None else price
    if price_masa == 0.0:
        price_masa = price

    cursor.execute("""
        INSERT INTO products (category_id, name, description, price, price_masa, unit, image_symbol, is_active, has_options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        int(p_data.get("category_id")),
        p_data.get("name"),
        p_data.get("description", ""),
        price,
        price_masa,
        p_data.get("unit", "Adet"),
        p_data.get("image_symbol", "🌶️"),
        int(p_data.get("is_active", 1)),
        int(p_data.get("has_options", 1))
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_product_by_id(new_id)

def update_product(product_id: int, p_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    price = float(p_data.get("price", 0.0))
    price_masa = float(p_data.get("price_masa")) if p_data.get("price_masa") is not None else price
    if price_masa == 0.0:
        price_masa = price

    cursor.execute("""
        UPDATE products
        SET category_id = ?, name = ?, description = ?, price = ?, price_masa = ?, unit = ?, image_symbol = ?, is_active = ?, has_options = ?
        WHERE id = ?
    """, (
        int(p_data.get("category_id")),
        p_data.get("name"),
        p_data.get("description", ""),
        price,
        price_masa,
        p_data.get("unit", "Adet"),
        p_data.get("image_symbol", "🌶️"),
        int(p_data.get("is_active", 1)),
        int(p_data.get("has_options", 1)),
        product_id
    ))
    conn.commit()
    conn.close()
    return get_product_by_id(product_id)

def update_product_price(product_id: int, new_price: float, new_price_masa: float = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if new_price_masa is not None:
        cursor.execute("UPDATE products SET price = ?, price_masa = ? WHERE id = ?", (float(new_price), float(new_price_masa), product_id))
    else:
        cursor.execute("UPDATE products SET price = ? WHERE id = ?", (float(new_price), product_id))
    conn.commit()
    conn.close()
    return get_product_by_id(product_id)

def delete_product(product_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Ürün #{product_id} silindi."}

def get_product_by_id(product_id: int):
    conn = get_db_connection()
    p = conn.execute("SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?", (product_id,)).fetchone()
    conn.close()
    return dict(p) if p else None

# --- Customer CRUD Helpers ---

def get_customer_by_phone(phone: str):
    conn = get_db_connection()
    clean_phone = "".join(filter(str.isdigit, phone or ""))
    customer = conn.execute("SELECT * FROM customers WHERE phone = ?", (clean_phone,)).fetchone()
    conn.close()
    return dict(customer) if customer else None

def save_customer(phone: str, name: str, address: str = "", notes: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    clean_phone = "".join(filter(str.isdigit, phone or ""))
    
    existing = cursor.execute("SELECT phone, total_orders FROM customers WHERE phone = ?", (clean_phone,)).fetchone()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if existing:
        cursor.execute("""
            UPDATE customers 
            SET name = ?, address = ?, notes = ?, updated_at = ?
            WHERE phone = ?
        """, (name, address, notes, now_str, clean_phone))
    else:
        cursor.execute("""
            INSERT INTO customers (phone, name, address, notes, total_orders, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
        """, (clean_phone, name, address, notes, now_str, now_str))

    conn.commit()
    conn.close()
    return get_customer_by_phone(clean_phone)

def update_customer(old_phone: str, phone: str, name: str, address: str = "", notes: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    clean_old = "".join(filter(str.isdigit, old_phone or ""))
    clean_new = "".join(filter(str.isdigit, phone or ""))
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if clean_old != clean_new:
        cursor.execute("""
            UPDATE customers 
            SET phone = ?, name = ?, address = ?, notes = ?, updated_at = ?
            WHERE phone = ?
        """, (clean_new, name, address, notes, now_str, clean_old))
    else:
        cursor.execute("""
            UPDATE customers 
            SET name = ?, address = ?, notes = ?, updated_at = ?
            WHERE phone = ?
        """, (name, address, notes, now_str, clean_old))

    conn.commit()
    conn.close()
    return get_customer_by_phone(clean_new)

def delete_customer(phone: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    clean_phone = "".join(filter(str.isdigit, phone or ""))
    cursor.execute("DELETE FROM customers WHERE phone = ?", (clean_phone,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Müşteri {clean_phone} silindi."}

def search_customers(query: str = ""):
    conn = get_db_connection()
    clean_query = query.strip() if query else ""

    if not clean_query:
        rows = conn.execute("SELECT * FROM customers ORDER BY total_orders DESC, created_at DESC LIMIT 50").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    digits_only = "".join(filter(str.isdigit, clean_query))

    if digits_only:
        rows = conn.execute("SELECT * FROM customers WHERE phone LIKE ? OR name LIKE ? ORDER BY total_orders DESC LIMIT 30", (f"%{digits_only}%", f"%{clean_query}%")).fetchall()
    else:
        rows = conn.execute("SELECT * FROM customers WHERE name LIKE ? ORDER BY total_orders DESC LIMIT 30", (f"%{clean_query}%",)).fetchall()
    
    conn.close()
    return [dict(r) for r in rows]

def generate_order_number():
    date_str = datetime.now().strftime("%Y%m%d")
    conn = get_db_connection()
    row = conn.execute("SELECT COUNT(*) FROM orders WHERE order_number LIKE ?", (f"OS-{date_str}-%",)).fetchone()
    conn.close()
    count = (row[0] if row else 0) + 1
    return f"OS-{date_str}-{count:04d}"

def calculate_verified_order_pricing(cursor, order_data: dict):
    source = order_data.get("source", "KASA")
    order_type = order_data.get("order_type", "PAKET")
    raw_items = order_data.get("items", [])

    # Veritabanındaki ücretli opsiyon kalemlerini çek
    opt_items_rows = cursor.execute("SELECT name, extra_price FROM option_items WHERE extra_price > 0").fetchall()
    extra_options_map = {row["name"].strip().lower(): float(row["extra_price"]) for row in opt_items_rows}

    verified_items = []
    calculated_subtotal = 0.0

    for item in raw_items:
        p_id = item.get("product_id")
        p_row = cursor.execute("SELECT id, name, price, price_masa FROM products WHERE id = ?", (p_id,)).fetchone()

        if p_row:
            product_name = p_row["name"]
            # Masa veya Paket fiyatlandırması
            if order_type == "MASA" and p_row["price_masa"] and float(p_row["price_masa"]) > 0:
                base_price = float(p_row["price_masa"])
            else:
                base_price = float(p_row["price"])
        else:
            if source in ["TRENDYOL", "GETIR", "MIGROS"]:
                base_price = float(item.get("unit_price", 0.0))
                product_name = item.get("product_name") or "Dış Sipariş Ürünü"
            else:
                raise ValueError(f"Geçersiz veya bulunamayan ürün ID: {p_id}")

        # Seçilen opsiyonların fiyatını doğrula
        options_summary = (item.get("options_summary") or "").strip()
        extra_price_total = 0.0

        if options_summary:
            # 1. Tanımlı opsiyon adı özette geçiyor mu?
            for opt_name, opt_fee in extra_options_map.items():
                if opt_name in options_summary.lower():
                    extra_price_total += opt_fee

            # 2. Opsiyon aşım ücreti veya dinamik ek ücret tag'leri (+₺XX.XX)
            regex_matches = re.findall(r'\(\+₺([0-9]+(?:\.[0-9]+)?)\)', options_summary)
            if regex_matches:
                parsed_extras = sum(float(m) for m in regex_matches)
                extra_price_total = max(extra_price_total, parsed_extras)

        verified_unit_price = round(base_price + extra_price_total, 2)
        quantity = max(1, int(item.get("quantity", 1)))
        verified_total_price = round(verified_unit_price * quantity, 2)

        calculated_subtotal += verified_total_price

        verified_items.append({
            "product_id": p_id,
            "product_name": product_name,
            "unit_price": verified_unit_price,
            "quantity": quantity,
            "options_summary": options_summary,
            "total_price": verified_total_price
        })

    calculated_subtotal = round(calculated_subtotal, 2)

    # İndirim doğrulaması
    discount_amount = 0.0
    discount_type = order_data.get("discount_type", "NONE")

    if source == "KAREKOD_MUSTERI":
        # Karekod müşterisi indirim uygulayamaz
        discount_amount = 0.0
        discount_type = "NONE"
    else:
        if discount_type == "IKRAM":
            discount_amount = calculated_subtotal
        elif discount_type in ["PERCENT", "TL"]:
            req_discount = float(order_data.get("discount_amount", 0.0))
            discount_amount = min(calculated_subtotal, max(0.0, req_discount))
        else:
            discount_amount = 0.0
            discount_type = "NONE"

    calculated_total_amount = max(0.0, round(calculated_subtotal - discount_amount, 2))

    return {
        "items": verified_items,
        "subtotal": calculated_subtotal,
        "discount_amount": discount_amount,
        "discount_type": discount_type,
        "total_amount": calculated_total_amount
    }

def create_order(order_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Sunucu taraflı güvenli fiyat ve tutar hesaplaması
    pricing = calculate_verified_order_pricing(cursor, order_data)
    items = pricing["items"]
    subtotal = pricing["subtotal"]
    discount_amount = pricing["discount_amount"]
    discount_type = pricing["discount_type"]
    total_amount = pricing["total_amount"]

    order_num = generate_order_number()
    phone = "".join(filter(str.isdigit, order_data.get("customer_phone") or "")) if order_data.get("customer_phone") else None
    c_name = order_data.get("customer_name", "")
    c_address = order_data.get("customer_address", "")
    source = order_data.get("source", "KASA")
    order_type = order_data.get("order_type", "PAKET")
    payment_method = order_data.get("payment_method", "NAKIT")
    note = order_data.get("note", "")

    if phone and c_name:
        existing_c = cursor.execute("SELECT total_orders FROM customers WHERE phone = ?", (phone,)).fetchone()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if existing_c:
            cursor.execute("""
                UPDATE customers 
                SET name = ?, address = ?, notes = ?, total_orders = total_orders + 1, updated_at = ?
                WHERE phone = ?
            """, (c_name, c_address, note or "", now_str, phone))
        else:
            cursor.execute("""
                INSERT INTO customers (phone, name, address, notes, total_orders, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (phone, c_name, c_address, note or "", now_str, now_str))

    if order_data.get("order_status"):
        order_status = order_data.get("order_status")
    elif payment_method == 'ÖDEME BEKLİYOR' or source == 'KAREKOD_MUSTERI':
        order_status = 'BEKLIYOR'
    else:
        order_status = 'TAMAMLANDI'

    cursor.execute("""
        INSERT INTO orders (
            order_number, customer_phone, customer_name, customer_address, source, order_type,
            subtotal, discount_amount, discount_type, total_amount, payment_method, note, order_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (order_num, phone, c_name, c_address, source, order_type, subtotal, discount_amount, discount_type, total_amount, payment_method, note, order_status))

    order_id = cursor.lastrowid

    for item in items:
        cursor.execute("""
            INSERT INTO order_items (
                order_id, product_id, product_name, unit_price, quantity, options_summary, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id,
            item["product_id"],
            item["product_name"],
            item["unit_price"],
            item["quantity"],
            item["options_summary"],
            item["total_price"]
        ))

    conn.commit()
    conn.close()

    return get_order_details(order_id)

def get_order_details(order_id: int):
    conn = get_db_connection()
    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return None
    
    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    conn.close()

    result = dict(order)
    result["items"] = [dict(i) for i in items]
    return result

def get_orders(limit=30, source=None, date_str=None, month_str=None, start_date=None, end_date=None):
    conn = get_db_connection()
    query = "SELECT * FROM orders WHERE 1=1"
    params = []

    if source:
        query += " AND source = ?"
        params.append(source)

    if date_str:
        query += " AND DATE(created_at) = DATE(?)"
        params.append(date_str)
    elif month_str:
        query += " AND strftime('%Y-%m', created_at) = ?"
        params.append(month_str)
    elif start_date and end_date:
        query += " AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)"
        params.extend([start_date, end_date])

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    orders = conn.execute(query, params).fetchall()

    res = []
    for o in orders:
        od = dict(o)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (od["id"],)).fetchall()
        od["items"] = [dict(i) for i in items]
        res.append(od)

    conn.close()
    return res

def get_analytics_report(period='daily', date_str=None, month_str=None, start_date=None, end_date=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    where_clause = "WHERE (order_status IS NULL OR order_status != 'IPTAL')"
    params = []

    if period == 'daily':
        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")
        where_clause += " AND DATE(created_at) = DATE(?)"
        params.append(date_str)
    elif period == 'monthly':
        if not month_str:
            month_str = datetime.now().strftime("%Y-%m")
        where_clause += " AND strftime('%Y-%m', created_at) = ?"
        params.append(month_str)
    elif period == 'custom' and start_date and end_date:
        where_clause += " AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)"
        params.extend([start_date, end_date])

    cursor.execute(f"""
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_amount), 0.0) as total_revenue,
            COALESCE(SUM(subtotal), 0.0) as gross_subtotal,
            COALESCE(SUM(CASE WHEN payment_method = 'NAKIT' THEN total_amount ELSE 0 END), 0.0) as cash_total,
            COALESCE(SUM(CASE WHEN payment_method = 'KREDI_KART' THEN total_amount ELSE 0 END), 0.0) as card_total,
            COALESCE(SUM(CASE WHEN payment_method = 'VERESIYE' THEN total_amount ELSE 0 END), 0.0) as open_account_total,
            COALESCE(SUM(discount_amount), 0.0) as total_discounts
        FROM orders
        {where_clause}
    """, params)
    
    stats = dict(cursor.fetchone())

    total_orders = stats.get("total_orders", 0)
    total_revenue = stats.get("total_revenue", 0.0)
    stats["avg_order_value"] = (total_revenue / total_orders) if total_orders > 0 else 0.0

    cursor.execute(f"""
        SELECT source, COUNT(*) as count, COALESCE(SUM(total_amount), 0.0) as revenue
        FROM orders
        {where_clause}
        GROUP BY source
    """, params)
    sources = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT 
            oi.product_name,
            COALESCE(p.unit, 'Adet') as unit,
            COALESCE(c.name, 'Genel') as category_name,
            SUM(oi.quantity) as total_qty,
            SUM(oi.total_price) as total_product_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        {where_clause.replace('created_at', 'o.created_at')}
        GROUP BY oi.product_name
        ORDER BY total_qty DESC, total_product_revenue DESC
    """, params)
    top_products = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT 
            discount_type,
            COUNT(*) as count,
            COALESCE(SUM(discount_amount), 0.0) as total_discount_amount
        FROM orders
        {where_clause}
        AND discount_amount > 0
        GROUP BY discount_type
    """, params)
    discounts_breakdown = [dict(r) for r in cursor.fetchall()]

    conn.close()

    stats["sources"] = sources
    stats["top_products"] = top_products
    stats["discounts_breakdown"] = discounts_breakdown
    stats["period"] = period
    stats["date"] = date_str
    stats["month"] = month_str

    return stats

def get_pending_qr_orders():
    conn = get_db_connection()
    orders = conn.execute("""
        SELECT * FROM orders 
        WHERE source = 'KAREKOD_MUSTERI' AND order_status = 'BEKLIYOR'
        ORDER BY id ASC
    """).fetchall()

    res = []
    for o in orders:
        od = dict(o)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (od["id"],)).fetchall()
        od["items"] = [dict(i) for i in items]
        res.append(od)

    conn.close()
    return res

def get_unprinted_qr_orders():
    conn = get_db_connection()
    orders = conn.execute("""
        SELECT * FROM orders 
        WHERE source = 'KAREKOD_MUSTERI' AND (is_printed IS NULL OR is_printed = 0) AND (order_status IS NULL OR order_status != 'IPTAL')
        ORDER BY id ASC
    """).fetchall()

    res = []
    for o in orders:
        od = dict(o)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (od["id"],)).fetchall()
        od["items"] = [dict(i) for i in items]
        res.append(od)

    conn.close()
    return res

def mark_order_printed(order_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE orders SET is_printed = 1 WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    return get_order_details(order_id)

def get_open_orders():
    conn = get_db_connection()
    orders = conn.execute("""
        SELECT * FROM orders 
        WHERE order_status = 'BEKLIYOR'
        ORDER BY id ASC
    """).fetchall()

    res = []
    for o in orders:
        od = dict(o)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (od["id"],)).fetchall()
        od["items"] = [dict(i) for i in items]
        res.append(od)

    conn.close()
    return res

def checkout_open_order(order_id: int, payment_method: str = "NAKIT"):
    conn = get_db_connection()
    conn.execute("""
        UPDATE orders 
        SET order_status = 'TAMAMLANDI', payment_status = 'ODENDI', payment_method = ?, is_printed = 1
        WHERE id = ?
    """, (payment_method, order_id))
    conn.commit()
    conn.close()
    return get_order_details(order_id)

def approve_qr_order(order_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE orders SET order_status = 'TAMAMLANDI', is_printed = 1 WHERE id = ?", (order_id,))
    conn.close()
    return get_order_details(order_id)

def reject_qr_order(order_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE orders SET order_status = 'IPTAL' WHERE id = ?", (order_id,))
    conn.close()
    return {"status": "success", "message": f"Sipariş #{order_id} reddedildi."}

def cancel_order(order_id: int, reason: str = "IPTAL"):
    conn = get_db_connection()
    row = conn.execute("SELECT id, order_status, order_number FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not row:
        conn.close()
        return {"status": "error", "message": "Sipariş bulunamadı"}
    
    conn.execute("""
        UPDATE orders 
        SET order_status = 'IPTAL',
            note = CASE 
                WHEN note IS NULL OR note = '' THEN '[İPTAL EDİLDİ]' 
                ELSE note || ' [İPTAL EDİLDİ]' 
            END
        WHERE id = ?
    """, (order_id,))
    conn.close()
    return {"status": "success", "message": f"Sipariş #{row['order_number']} başarıyla iptal edildi."}

def cancel_customer_qr_order(order_id: int):
    conn = get_db_connection()
    row = conn.execute("SELECT id, order_status, order_number, is_printed FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not row:
        conn.close()
        return {"status": "error", "message": "Sipariş bulunamadı"}
    
    if row["order_status"] != "BEKLIYOR" or row["is_printed"] == 1:
        conn.close()
        return {
            "status": "error", 
            "message": "Siparişinizin fişi yazdırılıp hazırlanmaya başladığı için iptal edilemez. Lütfen görevliye danışınız."
        }
    
    conn.execute("""
        UPDATE orders 
        SET order_status = 'IPTAL',
            note = CASE 
                WHEN note IS NULL OR note = '' THEN '[MÜŞTERİ İPTAL ETTİ]' 
                ELSE note || ' [MÜŞTERİ İPTAL ETTİ]' 
            END
        WHERE id = ?
    """, (order_id,))
    conn.close()
    return {"status": "success", "message": f"Sipariş #{row['order_number']} başarıyla iptal edildi."}


def update_product_image(product_id: int, image_url: str):
    conn = get_db_connection()
    conn.execute("UPDATE products SET image_url = ? WHERE id = ?", (image_url, product_id))
    conn.close()
    return get_product_by_id(product_id)

def get_store_settings():
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM store_settings").fetchall()
    conn.close()
    res = {
        "store_name": "O SES ÇİĞKÖFTE",
        "store_subtitle": "HIZLI KASA & ADİSYON POS",
        "store_logo_url": "",
        "admin_pin": "oses1234"
    }
    for r in rows:
        res[r["key"]] = r["value"]
    return res

def update_store_settings(settings: dict):
    conn = get_db_connection()
    for k, v in settings.items():
        if v is not None:
            conn.execute("""
                INSERT INTO store_settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (str(k), str(v)))
    conn.close()
    return get_store_settings()
