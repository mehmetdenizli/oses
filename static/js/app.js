/**
 * O Ses Çiğköfte POS & Adisyon Sistemi - SPA Application Logic
 */

class POSApp {
  constructor() {
    this.categories = [];
    this.products = [];
    this.optionGroups = [];
    this.activeCategory = 'ALL';
    this.orderType = 'PAKET'; // 'PAKET' (Gel-Al) or 'MASA' (Salon)
    this.cart = [];
    this.activeCustomer = null;
    this.discount = { type: 'NONE', value: 0 };
    this.paymentMethod = 'NAKIT';

    // Analytics state
    this.reportPeriod = 'daily';
    this.reportSubtab = 'products';

    // Pending state for options modal
    this.pendingProduct = null;
    this.selectedOptionsState = {};

    this.init();
  }

  async init() {
    await this.fetchCategories();
    await this.fetchProducts();
    await this.fetchOptions();
    this.renderCategoryTabs();
    this.renderProductGrid();
    this.renderCart();
    this.startQROrderAutoPrintPoller();
  }

  // --- API Fetches ---

  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      this.categories = await res.json();
    } catch (err) {
      this.showToast('Kategoriler yüklenirken hata oluştu', 'error');
    }
  }

  async fetchProducts() {
    try {
      const res = await fetch('/api/products');
      this.products = await res.json();
    } catch (err) {
      this.showToast('Ürünler yüklenirken hata oluştu', 'error');
    }
  }

  async fetchOptions() {
    try {
      const res = await fetch('/api/options');
      this.optionGroups = await res.json();
    } catch (err) {
      this.showToast('Opsiyonlar yüklenirken hata oluştu', 'error');
    }
  }

  // --- Price & Order Mode Helpers ---

  getProductPrice(product) {
    if (!product) return 0;
    if (this.orderType === 'MASA') {
      return (product.price_masa && product.price_masa > 0) ? product.price_masa : product.price;
    }
    return product.price;
  }

  setOrderType(type) {
    this.orderType = type;
    this.renderCategoryTabs();
    this.renderProductGrid();
    this.showToast(`Sipariş Tarifesi Değişti: ${type === 'MASA' ? '🍽️ MASA (Salon)' : '📦 PAKET (Gel-Al)'}`, 'info');
  }

  // --- Rendering POS Interface ---

  renderCategoryTabs() {
    const container = document.getElementById('category-tabs-container');
    if (!container) return;

    let html = `
      <button class="category-tab ${this.orderType === 'PAKET' ? 'active' : ''}" style="${this.orderType === 'PAKET' ? 'background: linear-gradient(135deg, #10B981 0%, #059669 100%); color:white; font-weight:800;' : 'background:#E2E8F0; color:#334155; font-weight:700;'}" onclick="app.setOrderType('PAKET')">
        📦 PAKET (Gel-Al)
      </button>
      <button class="category-tab ${this.orderType === 'MASA' ? 'active' : ''}" style="${this.orderType === 'MASA' ? 'background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color:white; font-weight:800;' : 'background:#E2E8F0; color:#334155; font-weight:700;'}" onclick="app.setOrderType('MASA')">
        🍽️ MASA (Salon)
      </button>
    `;

    this.categories.forEach(cat => {
      const isActive = this.activeCategory === cat.id;
      html += `
        <button class="category-tab ${isActive ? 'active' : ''}" onclick="app.filterCategory(${cat.id})">
          ${cat.icon || '📌'} ${cat.name}
        </button>
      `;
    });

    html += `
      <button class="category-tab ${this.activeCategory === 'ALL' ? 'active' : ''}" onclick="app.filterCategory('ALL')">
        ✨ Tüm Ürünler
      </button>
    `;

    container.innerHTML = html;
  }

  filterCategory(catId) {
    this.activeCategory = catId;
    this.renderCategoryTabs();
    this.renderProductGrid();
  }

  renderProductGrid() {
    const container = document.getElementById('product-grid-container');
    if (!container) return;

    const filtered = this.activeCategory === 'ALL'
      ? this.products
      : this.products.filter(p => p.category_id === this.activeCategory);

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #888;">Bu kategoride ürün bulunamadı.</div>`;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const hasOpts = p.has_options === 1;
      const currentPrice = this.getProductPrice(p);
      const modeBadge = this.orderType === 'MASA' 
        ? `<span class="product-badge-opt" style="background:#DBEAFE; color:#1E40AF;">🍽️ Masa</span>`
        : `<span class="product-badge-opt" style="background:#D1FAE5; color:#065F46;">📦 Paket</span>`;

      html += `
        <div class="product-card" onclick="app.handleProductClick(${p.id})">
          <div class="product-header">
            <div class="product-icon">${p.image_symbol || '🌶️'}</div>
            ${modeBadge}
            ${hasOpts ? `<span class="product-badge-opt">Opsiyonlu</span>` : ''}
          </div>
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.description || ''}</div>
          <div class="product-footer">
            <div>
              <span class="product-price">₺${currentPrice.toFixed(2)}</span>
              <span class="product-unit">/ ${p.unit}</span>
            </div>
            <button class="btn-add-touch">+</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // --- Dynamic Product Options Modal ---

  handleProductClick(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const currentPrice = this.getProductPrice(product);

    if (product.has_options === 1) {
      this.openOptionsModal(product);
    } else {
      this.addToCart(product, '', currentPrice);
      this.showToast(`${product.name} sepete eklendi (₺${currentPrice.toFixed(2)})`, 'success');
    }
  }

  openOptionsModal(product) {
    this.pendingProduct = product;
    document.getElementById('opt-modal-product-name').innerText = `${product.image_symbol || '🌶️'} ${product.name} Opsiyonları`;
    document.getElementById('opt-custom-note').value = '';

    this.selectedOptionsState = {};
    this.optionGroups.forEach(group => {
      this.selectedOptionsState[group.id] = new Set();
      group.items.forEach(item => {
        if (item.is_default === 1) {
          this.selectedOptionsState[group.id].add(item.id);
        }
      });
    });

    this.renderDynamicOptionGroups();
    this.recalculateModalTotalPrice();
    this.openModal('modal-options');
  }

  renderDynamicOptionGroups() {
    const container = document.getElementById('options-dynamic-groups-container');
    if (!container) return;

    let html = '';
    this.optionGroups.forEach(group => {
      const selectedSet = this.selectedOptionsState[group.id] || new Set();

      let infoBadge = '';
      if (group.type === 'MULTIPLE' && group.free_limit > 0) {
        infoBadge = `<small style="color: var(--primary-red); font-weight:700; margin-left: 6px;">(İlk ${group.free_limit} Seçim Ücretsiz - Aşım: +₺${group.extra_fee.toFixed(2)}/Adet)</small>`;
      }

      html += `
        <div class="option-group-title">
          ${group.icon || '📌'} ${group.name} ${infoBadge}
        </div>
        <div class="option-buttons-grid">
      `;

      group.items.forEach(item => {
        const isSelected = selectedSet.has(item.id);
        let priceTag = item.extra_price > 0 ? ` (+₺${item.extra_price.toFixed(2)})` : '';

        if (group.type === 'SINGLE') {
          html += `
            <button class="opt-btn ${isSelected ? 'active' : ''}" onclick="app.toggleSelectOption(${group.id}, ${item.id}, 'SINGLE')">
              ${item.name}${priceTag}
            </button>
          `;
        } else {
          html += `
            <button class="opt-check-btn ${isSelected ? 'checked' : ''}" onclick="app.toggleSelectOption(${group.id}, ${item.id}, 'MULTIPLE')">
              ${isSelected ? '✓ ' : '+ '} ${item.name}${priceTag}
            </button>
          `;
        }
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  }

  toggleSelectOption(groupId, itemId, type) {
    if (!this.selectedOptionsState[groupId]) {
      this.selectedOptionsState[groupId] = new Set();
    }

    const set = this.selectedOptionsState[groupId];

    if (type === 'SINGLE') {
      set.clear();
      set.add(itemId);
    } else {
      if (set.has(itemId)) {
        set.delete(itemId);
      } else {
        set.add(itemId);
      }
    }

    this.renderDynamicOptionGroups();
    this.recalculateModalTotalPrice();
  }

  recalculateModalTotalPrice() {
    if (!this.pendingProduct) return;

    let basePrice = this.getProductPrice(this.pendingProduct);
    let extraFeeTotal = 0.0;

    this.optionGroups.forEach(group => {
      const selectedSet = this.selectedOptionsState[group.id] || new Set();

      group.items.forEach(item => {
        if (selectedSet.has(item.id) && item.extra_price > 0) {
          extraFeeTotal += item.extra_price;
        }
      });

      if (group.type === 'MULTIPLE' && group.free_limit > 0 && group.extra_fee > 0) {
        const selectedCount = selectedSet.size;
        if (selectedCount > group.free_limit) {
          const exceedingCount = selectedCount - group.free_limit;
          extraFeeTotal += (exceedingCount * group.extra_fee);
        }
      }
    });

    const finalUnitPrice = basePrice + extraFeeTotal;

    document.getElementById('opt-base-price-disp').innerText = `₺${basePrice.toFixed(2)}`;
    document.getElementById('opt-extra-fee-disp').innerText = extraFeeTotal > 0 ? `(+₺${extraFeeTotal.toFixed(2)} Ekstra)` : '(Ekstra Ücret Yok)';
    document.getElementById('opt-total-calc-disp').innerText = `TOPLAM: ₺${finalUnitPrice.toFixed(2)}`;

    return { basePrice, extraFeeTotal, finalUnitPrice };
  }

  confirmAddWithOptions() {
    if (!this.pendingProduct) return;

    const { extraFeeTotal, finalUnitPrice } = this.recalculateModalTotalPrice();

    let optNames = [];
    this.optionGroups.forEach(group => {
      const selectedSet = this.selectedOptionsState[group.id] || new Set();
      group.items.forEach(item => {
        if (selectedSet.has(item.id)) {
          let nameStr = item.name;
          if (item.extra_price > 0) nameStr += ` (+₺${item.extra_price.toFixed(2)})`;
          optNames.push(nameStr);
        }
      });
    });

    const customNote = document.getElementById('opt-custom-note').value.trim();
    if (customNote) {
      optNames.push(`Not: ${customNote}`);
    }

    if (extraFeeTotal > 0) {
      optNames.push(`(+₺${extraFeeTotal.toFixed(2)} Ekstra Fark)`);
    }

    const optionsSummary = optNames.join(', ');
    this.addToCart(this.pendingProduct, optionsSummary, finalUnitPrice);
    this.closeModal('modal-options');
    this.showToast(`${this.pendingProduct.name} sepete eklendi (₺${finalUnitPrice.toFixed(2)})`, 'success');
  }

  // --- Cart Management ---

  addToCart(product, optionsSummary = '', unitPrice = null) {
    const finalUnitPrice = unitPrice !== null ? unitPrice : this.getProductPrice(product);

    const existingIndex = this.cart.findIndex(
      item => item.productId === product.id && item.optionsSummary === optionsSummary && item.unitPrice === finalUnitPrice
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
      this.cart[existingIndex].totalPrice = this.cart[existingIndex].quantity * this.cart[existingIndex].unitPrice;
    } else {
      this.cart.push({
        cartItemId: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: product.id,
        productName: product.name,
        unitPrice: finalUnitPrice,
        quantity: 1,
        optionsSummary: optionsSummary,
        totalPrice: finalUnitPrice
      });
    }

    this.renderCart();
  }

  updateQty(cartItemId, delta) {
    const item = this.cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeFromCart(cartItemId);
    } else {
      item.totalPrice = item.quantity * item.unitPrice;
      this.renderCart();
    }
  }

  removeFromCart(cartItemId) {
    this.cart = this.cart.filter(i => i.cartItemId !== cartItemId);
    this.renderCart();
  }

  clearCart() {
    if (this.cart.length === 0) return;
    this.cart = [];
    this.discount = { type: 'NONE', value: 0 };
    this.renderCart();
    this.showToast('Sepet temizlendi');
  }

  renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🌶️</div>
          <div>Henüz sepete ürün eklenmedi.</div>
          <small style="color: #94A3B8;">Sol taraftaki menüden ürün kartlarına tıklayarak adisyona ekleyebilirsiniz.</small>
        </div>
      `;
      this.updateCartTotals();
      return;
    }

    let html = '';
    this.cart.forEach(item => {
      html += `
        <div class="cart-item">
          <div class="cart-item-main">
            <span class="cart-item-name">${item.productName}</span>
            <span class="cart-item-price">₺${item.totalPrice.toFixed(2)}</span>
          </div>
          ${item.optionsSummary ? `<div class="cart-item-options">📌 ${item.optionsSummary}</div>` : ''}
          <div class="cart-item-actions">
            <div class="qty-controls">
              <button class="btn-qty" onclick="app.updateQty('${item.cartItemId}', -1)">-</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="btn-qty" onclick="app.updateQty('${item.cartItemId}', 1)">+</button>
            </div>
            <button class="btn-remove-item" onclick="app.removeFromCart('${item.cartItemId}')">Sil</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.updateCartTotals();
  }

  // --- Discounts & Payments ---

  setDiscount(type, val = 0) {
    this.discount = { type, value: val };

    ['disc-none', 'disc-10', 'disc-20', 'disc-custom', 'disc-ikram'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    if (type === 'NONE') document.getElementById('disc-none')?.classList.add('active');
    else if (type === 'PERCENT' && val === 10) document.getElementById('disc-10')?.classList.add('active');
    else if (type === 'PERCENT' && val === 20) document.getElementById('disc-20')?.classList.add('active');
    else if (type === 'IKRAM') document.getElementById('disc-ikram')?.classList.add('active');
    else document.getElementById('disc-custom')?.classList.add('active');

    this.updateCartTotals();
  }

  promptCustomDiscount() {
    const input = prompt('İndirim Tutarı (TL) Girin:', '15');
    if (input !== null) {
      const amount = parseFloat(input);
      if (!isNaN(amount) && amount > 0) {
        this.setDiscount('TL', amount);
      }
    }
  }

  setPaymentMethod(method) {
    this.paymentMethod = method;
    ['pay-nakit', 'pay-kredi', 'pay-veresiye'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    if (method === 'NAKIT') document.getElementById('pay-nakit')?.classList.add('active');
    else if (method === 'KREDI_KART') document.getElementById('pay-kredi')?.classList.add('active');
    else if (method === 'VERESIYE') document.getElementById('pay-veresiye')?.classList.add('active');
  }

  updateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
    let discountAmount = 0;

    if (this.discount.type === 'PERCENT') {
      discountAmount = (subtotal * this.discount.value) / 100;
    } else if (this.discount.type === 'TL') {
      discountAmount = Math.min(subtotal, this.discount.value);
    } else if (this.discount.type === 'IKRAM') {
      discountAmount = subtotal;
    }

    const total = Math.max(0, subtotal - discountAmount);

    document.getElementById('subtotal-val').innerText = `₺${subtotal.toFixed(2)}`;
    document.getElementById('total-val').innerText = `₺${total.toFixed(2)}`;

    const discRow = document.getElementById('discount-row');
    if (discountAmount > 0) {
      discRow.style.display = 'flex';
      let label = 'İndirim:';
      if (this.discount.type === 'PERCENT') label = `İndirim (%${this.discount.value}):`;
      else if (this.discount.type === 'IKRAM') label = '🎁 İkram (%100):';
      else label = `İndirim (${this.discount.value} TL):`;

      document.getElementById('discount-label').innerText = label;
      document.getElementById('discount-val').innerText = `-₺${discountAmount.toFixed(2)}`;
    } else {
      discRow.style.display = 'none';
    }

    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
      btnCheckout.disabled = this.cart.length === 0;
    }
  }

  // --- CUSTOMER MANAGEMENT & DIRECTORY (Müşteri Kayıt Defteri Ekleme/Düzenleme/Silme) ---

  async searchOrSelectCustomer() {
    const inputEl = document.getElementById('customer-phone-input');
    const query = inputEl ? inputEl.value.trim() : '';

    if (!query) {
      this.openCustomerListModal();
      return;
    }

    const cleanPhone = query.replace(/\D/g, '');

    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
      const results = await res.json();

      if (results.length === 1 && results[0].phone === cleanPhone) {
        this.selectCustomer(results[0]);
        this.showToast(`Müşteri bağlandı: ${results[0].name}`, 'success');
      } else if (results.length > 0) {
        this.openCustomerListModal(query);
      } else {
        this.openNewCustomerFormFromDir(cleanPhone);
      }
    } catch (err) {
      this.showToast('Müşteri arama hatası', 'error');
    }
  }

  selectCustomer(customer) {
    this.activeCustomer = customer;
    const card = document.getElementById('active-customer-box');
    if (card) {
      document.getElementById('cust-card-name').innerText = customer.name;
      document.getElementById('cust-card-phone').innerText = customer.phone;
      document.getElementById('cust-card-addr').innerText = customer.address || 'Adres Girilmedi';
      document.getElementById('cust-card-badge').innerText = `${customer.total_orders || 0} Sipariş`;
      card.style.display = 'flex';
    }
  }

  clearSelectedCustomer() {
    this.activeCustomer = null;
    const card = document.getElementById('active-customer-box');
    if (card) card.style.display = 'none';
    const inputEl = document.getElementById('customer-phone-input');
    if (inputEl) inputEl.value = '';
  }

  openNewCustomerFormFromDir(phonePrefill = '') {
    document.getElementById('cust-modal-title').innerText = '👤 Yeni Müşteri Ekle';
    document.getElementById('edit-cust-old-phone').value = '';
    document.getElementById('new-cust-phone').value = phonePrefill;
    document.getElementById('new-cust-phone').readOnly = false;
    document.getElementById('new-cust-name').value = '';
    document.getElementById('new-cust-address').value = '';
    document.getElementById('new-cust-notes').value = '';

    this.openModal('modal-customer');
  }

  async openEditCustomerModal(phone) {
    try {
      const res = await fetch(`/api/customers/${phone}`);
      const customer = await res.json();

      document.getElementById('cust-modal-title').innerText = '✏️ Müşteri Bilgilerini Düzenle';
      document.getElementById('edit-cust-old-phone').value = customer.phone;
      document.getElementById('new-cust-phone').value = customer.phone;
      document.getElementById('new-cust-phone').readOnly = false;
      document.getElementById('new-cust-name').value = customer.name;
      document.getElementById('new-cust-address').value = customer.address || '';
      document.getElementById('new-cust-notes').value = customer.notes || '';

      this.openModal('modal-customer');
    } catch (err) {
      this.showToast('Müşteri bilgisi yükleme hatası', 'error');
    }
  }

  async saveNewCustomer() {
    const oldPhone = document.getElementById('edit-cust-old-phone').value;
    const phone = document.getElementById('new-cust-phone').value.trim();
    const name = document.getElementById('new-cust-name').value.trim();
    const address = document.getElementById('new-cust-address').value.trim();
    const notes = document.getElementById('new-cust-notes').value.trim();

    if (!phone || !name) {
      alert('Lütfen telefon ve müşteri adını doldurun!');
      return;
    }

    try {
      let res;
      if (oldPhone) {
        // Update customer
        res = await fetch(`/api/customers/${oldPhone}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name, address, notes })
        });
      } else {
        // Create customer
        res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name, address, notes })
        });
      }

      if (!res.ok) throw new Error('Kaydedilemedi');

      const customer = await res.json();
      this.selectCustomer(customer);
      this.closeModal('modal-customer');
      this.showToast('Müşteri kaydı başarıyla güncellendi!', 'success');

      // Refresh directory list if open
      const searchInput = document.getElementById('cust-dir-search');
      if (searchInput) {
        this.renderCustomerDirectory(searchInput.value);
      }
    } catch (err) {
      this.showToast('Müşteri kaydetme hatası', 'error');
    }
  }

  async deleteCustomer(phone) {
    if (!confirm(`${phone} numaralı müşteriyi silmek istediğinizden emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/customers/${phone}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Silinemedi');

      this.showToast('Müşteri silindi.', 'success');

      // If deleted active customer, clear from card
      if (this.activeCustomer && this.activeCustomer.phone === phone) {
        this.clearSelectedCustomer();
      }

      const searchInput = document.getElementById('cust-dir-search');
      this.renderCustomerDirectory(searchInput ? searchInput.value : '');

    } catch (err) {
      this.showToast('Müşteri silme hatası', 'error');
    }
  }

  async openCustomerListModal(initialQuery = '') {
    this.openModal('modal-customer-list');
    const searchInput = document.getElementById('cust-dir-search');
    if (searchInput) {
      searchInput.value = initialQuery;
      this.renderCustomerDirectory(initialQuery);
    }
  }

  async renderCustomerDirectory(query = '') {
    const container = document.getElementById('cust-dir-list-container');
    if (!container) return;

    try {
      const url = query ? `/api/customers/search?q=${encodeURIComponent(query)}` : '/api/customers/search?q=0';
      const res = await fetch(url);
      const list = await res.json();

      if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#777;">Kayıtlı müşteri bulunamadı.</div>`;
        return;
      }

      let html = '';
      list.forEach(c => {
        html += `
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px 16px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex: 1; padding-right: 12px;">
              <div style="font-weight:700; font-size:1.05rem; color: var(--primary-red); display:flex; align-items:center; gap:8px;">
                ${c.name} 
                <span class="customer-badge">${c.total_orders} Sipariş</span>
              </div>
              <div style="font-family: var(--font-mono); font-size:0.9rem; color:#444; font-weight:700; margin-top:2px;">📞 ${c.phone}</div>
              <div style="font-size:0.85rem; color:#666; margin-top:2px;">📍 ${c.address || 'Adres girilmedi'}</div>
              ${c.notes ? `<div style="font-size:0.8rem; color:var(--primary-red); margin-top:2px; font-weight:600;">📝 Not: ${c.notes}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; min-width:110px;">
              <button class="btn-primary" style="padding:6px 10px; font-size:0.85rem;" onclick="app.selectCustomerFromList('${c.phone}')">
                Sepete Seç
              </button>
              <div style="display:flex; gap:4px;">
                <button class="btn-secondary" style="flex:1; padding:4px 6px; font-size:0.75rem;" onclick="app.openEditCustomerModal('${c.phone}')">
                  ✏️ Düzenle
                </button>
                <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem; color:#D32F2F;" onclick="app.deleteCustomer('${c.phone}')">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div style="color:red; text-align:center;">Hata oluştu.</div>`;
    }
  }

  async selectCustomerFromList(phone) {
    const res = await fetch(`/api/customers/${phone}`);
    const customer = await res.json();
    this.selectCustomer(customer);
    this.closeModal('modal-customer-list');
  }

  // --- ANALYTICS & REPORTING SYSTEM ---

  async openDailyStatsModal() {
    this.openModal('modal-daily-stats');
    this.switchReportPeriod('daily');
  }

  switchReportPeriod(period) {
    this.reportPeriod = period;

    ['report-period-btn-daily', 'report-period-btn-monthly', 'report-period-btn-custom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const customBox = document.getElementById('report-custom-date-box');

    if (period === 'daily') {
      document.getElementById('report-period-btn-daily')?.classList.add('active');
      if (customBox) customBox.style.display = 'none';
    } else if (period === 'monthly') {
      document.getElementById('report-period-btn-monthly')?.classList.add('active');
      if (customBox) customBox.style.display = 'none';
    } else {
      document.getElementById('report-period-btn-custom')?.classList.add('active');
      if (customBox) customBox.style.display = 'flex';

      const today = new Date().toISOString().split('T')[0];
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      document.getElementById('report-start-date').value = past;
      document.getElementById('report-end-date').value = today;
    }

    this.loadAnalyticsReport();
  }

  applyCustomReportDates() {
    this.loadAnalyticsReport();
  }

  switchReportSubtab(subtab) {
    this.reportSubtab = subtab;

    ['products', 'sources', 'discounts', 'orders'].forEach(st => {
      const btn = document.getElementById(`report-subtab-btn-${st}`);
      const content = document.getElementById(`report-subtab-${st}`);
      if (btn) btn.classList.toggle('active', st === subtab);
      if (content) content.style.display = st === subtab ? 'block' : 'none';
    });

    this.renderReportSubtabContent();
  }

  async loadAnalyticsReport() {
    let url = `/api/stats/analytics?period=${this.reportPeriod}`;

    if (this.reportPeriod === 'custom') {
      const start = document.getElementById('report-start-date').value;
      const end = document.getElementById('report-end-date').value;
      url += `&start_date=${start}&end_date=${end}`;
    }

    try {
      const res = await fetch(url);
      this.currentReportData = await res.json();

      this.renderReportKpiCards();
      this.renderReportSubtabContent();
    } catch (err) {
      this.showToast('Rapor verisi yüklenirken hata!', 'error');
    }
  }

  renderReportKpiCards() {
    const data = this.currentReportData;
    if (!data) return;

    const cardsContainer = document.getElementById('stats-summary-cards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = `
      <div style="background:#E3F2FD; border:1px solid #90CAF9; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#1565C0; font-weight:700;">Toplam Net Ciro</small>
        <div style="font-size:1.3rem; font-weight:900; color:#0D47A1;">₺${data.total_revenue.toFixed(2)}</div>
      </div>
      <div style="background:#E8F5E9; border:1px solid #A5D6A7; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#2E7D32; font-weight:700;">Nakit Satışlar</small>
        <div style="font-size:1.3rem; font-weight:900; color:#1B5E20;">₺${data.cash_total.toFixed(2)}</div>
      </div>
      <div style="background:#FFF3E0; border:1px solid #FFCC80; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#EF6C00; font-weight:700;">Kredi Kartı Satışları</small>
        <div style="font-size:1.3rem; font-weight:900; color:#E65100;">₺${data.card_total.toFixed(2)}</div>
      </div>
      <div style="background:#FFEBEE; border:1px solid #FFCDD2; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#C62828; font-weight:700;">Sipariş Adedi</small>
        <div style="font-size:1.3rem; font-weight:900; color:#B71C1C;">${data.total_orders} Adet</div>
      </div>
      <div style="background:#F3E5F5; border:1px solid #CE93D8; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#7B1FA2; font-weight:700;">Ortalama Sepet (AOV)</small>
        <div style="font-size:1.2rem; font-weight:900; color:#4A148C;">₺${data.avg_order_value.toFixed(2)}</div>
      </div>
      <div style="background:#FFF8E1; border:1px solid #FFE082; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#F57F17; font-weight:700;">Toplam İndirim</small>
        <div style="font-size:1.2rem; font-weight:900; color:#E65100;">₺${data.total_discounts.toFixed(2)}</div>
      </div>
      <div style="background:#ECEFF1; border:1px solid #B0BEC5; padding:10px; border-radius:8px; text-align:center;">
        <small style="color:#37474F; font-weight:700;">Veresiye / Açık Hesap</small>
        <div style="font-size:1.2rem; font-weight:900; color:#263238;">₺${data.open_account_total.toFixed(2)}</div>
      </div>
    `;
  }

  renderReportSubtabContent() {
    const data = this.currentReportData;
    if (!data) return;

    if (this.reportSubtab === 'products') {
      const tbody = document.getElementById('report-top-products-tbody');
      if (!tbody) return;

      if (!data.top_products || data.top_products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Bu periyotta satılan ürün verisi bulunamadı.</td></tr>`;
        return;
      }

      let html = '';
      data.top_products.forEach((p, idx) => {
        html += `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${p.product_name}</strong></td>
            <td><small>${p.category_name}</small></td>
            <td style="text-align:center;"><span class="customer-badge" style="background:var(--primary-red); color:white;">${p.total_qty} ${p.unit}</span></td>
            <td style="text-align:right; font-weight:900; font-family:var(--font-mono); color:var(--primary-red);">₺${p.total_product_revenue.toFixed(2)}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
    else if (this.reportSubtab === 'sources') {
      const container = document.getElementById('report-sources-container');
      if (!container) return;

      if (!data.sources || data.sources.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#888;">Sipariş kaynağı bulunamadı.</div>`;
        return;
      }

      let html = '';
      data.sources.forEach(s => {
        html += `
          <div style="background:#F8FAFC; border:1.5px solid #CBD5E1; padding:14px; border-radius:10px; text-align:center;">
            <div style="font-weight:800; color:var(--dark-bg); font-size:1.1rem; margin-bottom:4px;">${s.source}</div>
            <div style="font-size:0.85rem; color:#555; margin-bottom:8px;">${s.count} Sipariş</div>
            <div style="font-size:1.3rem; font-weight:900; color:var(--primary-red); font-family:var(--font-mono);">₺${s.revenue.toFixed(2)}</div>
          </div>
        `;
      });
      container.innerHTML = html;
    }
    else if (this.reportSubtab === 'discounts') {
      const container = document.getElementById('report-discounts-container');
      if (!container) return;

      if (!data.discounts_breakdown || data.discounts_breakdown.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Bu periyotta uygulanan indirim bulunmamaktadır.</div>`;
        return;
      }

      let html = '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">';
      data.discounts_breakdown.forEach(d => {
        let label = d.discount_type === 'PERCENT' ? '% İndirimler' : (d.discount_type === 'IKRAM' ? '🎁 İkramlar (%100)' : 'Özel TL İndirimleri');
        html += `
          <div style="background:#FFF8E1; border:1px solid #FFE082; padding:14px; border-radius:10px; text-align:center;">
            <div style="font-weight:800; color:#F57F17; margin-bottom:4px;">${label}</div>
            <div style="font-size:0.85rem; color:#555; margin-bottom:8px;">${d.count} Adet Siparişte</div>
            <div style="font-size:1.2rem; font-weight:900; color:#E65100; font-family:var(--font-mono);">-₺${d.total_discount_amount.toFixed(2)}</div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    }
    else if (this.reportSubtab === 'orders') {
      this.loadRecentOrdersForReport();
    }
  }

  async loadRecentOrdersForReport() {
    let url = `/api/orders?limit=30`;
    if (this.reportPeriod === 'daily') url += `&date=${this.currentReportData?.date || ''}`;
    else if (this.reportPeriod === 'monthly') url += `&month=${this.currentReportData?.month || ''}`;

    try {
      const res = await fetch(url);
      const orders = await res.json();

      const ordersList = document.getElementById('recent-orders-list');
      if (ordersList) {
        if (orders.length === 0) {
          ordersList.innerHTML = `<div style="text-align:center; padding:20px;">Bu periyotta sipariş kaydı bulunmamaktadır.</div>`;
          return;
        }

        let html = '';
        orders.forEach(o => {
          html += `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--primary-red);">${o.order_number}</strong> 
                <span class="customer-badge" style="background:#333; color:white;">${o.source}</span> 
                <span style="font-size:0.8rem; color:#666;">${o.created_at}</span>
                <div style="font-size:0.85rem; font-weight:600;">👤 ${o.customer_name} (${o.payment_method})</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900; font-size:1.1rem; font-family:var(--font-mono);">₺${o.total_amount.toFixed(2)}</div>
                <button class="btn-secondary" style="padding:3px 8px; font-size:0.75rem;" onclick="app.reprintOrder(${o.id})">🖨️ Fiş Bas</button>
              </div>
            </div>
          `;
        });
        ordersList.innerHTML = html;
      }
    } catch (err) {
      this.showToast('Sipariş geçmişi yükleme hatası', 'error');
    }
  }

  // --- PRODUCT & PRICE & OPTIONS MANAGEMENT ---

  async openAdminProductsModal() {
    this.openModal('modal-admin-products');
    this.switchAdminTab('products');
  }

  switchAdminTab(tabName) {
    const pTab = document.getElementById('admin-tab-products');
    const oTab = document.getElementById('admin-tab-options');
    const pBtn = document.getElementById('admin-tab-btn-products');
    const oBtn = document.getElementById('admin-tab-btn-options');

    if (tabName === 'products') {
      pTab.style.display = 'block';
      oTab.style.display = 'none';
      pBtn.classList.add('active');
      oBtn.classList.remove('active');
      this.renderAdminProductsTable();
    } else {
      pTab.style.display = 'none';
      oTab.style.display = 'block';
      pBtn.classList.remove('active');
      oBtn.classList.add('active');
      this.renderAdminOptionsManagement();
    }
  }

  async renderAdminProductsTable() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/products?include_inactive=true');
      const allProducts = await res.json();

      let html = '';
      allProducts.forEach(p => {
        const isActive = p.is_active === 1;
        const priceMasaVal = (p.price_masa && p.price_masa > 0) ? p.price_masa : p.price;
        html += `
          <tr>
            <td><strong>${p.image_symbol || '🌶️'} ${p.name}</strong></td>
            <td><small>${p.category_name}</small></td>
            <td><small style="color:#666;">${p.description || '-'}</small></td>
            <td>
              <div class="price-input-group">
                <span>₺</span>
                <input 
                  type="number" 
                  step="0.5"
                  class="price-input" 
                  value="${p.price}" 
                  onchange="app.quickUpdatePrice(${p.id}, this.value, 'price')"
                />
              </div>
            </td>
            <td>
              <div class="price-input-group">
                <span style="color:#1E40AF;">₺</span>
                <input 
                  type="number" 
                  step="0.5"
                  class="price-input" 
                  style="color:#1E40AF; font-weight:700;"
                  value="${priceMasaVal}" 
                  onchange="app.quickUpdatePrice(${p.id}, this.value, 'price_masa')"
                />
              </div>
            </td>
            <td>
              <span class="${isActive ? 'badge-active' : 'badge-inactive'}">
                ${isActive ? 'Aktif' : 'Pasif'}
              </span>
            </td>
            <td style="text-align: center;">
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px;" onclick="app.openEditProductModal(${p.id})">
                ✏️ Düzenle
              </button>
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: #D32F2F;" onclick="app.deleteProduct(${p.id})">
                🗑️
              </button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Ürünler yüklenirken hata oluştu.</td></tr>`;
    }
  }

  async renderAdminOptionsManagement() {
    const container = document.getElementById('admin-options-management-container');
    if (!container) return;

    await this.fetchOptions();

    let html = '';
    this.optionGroups.forEach(group => {
      const isGarnitur = group.type === 'MULTIPLE' && group.name.includes('YEŞİLLİK');

      html += `
        <div style="background:#F8FAFC; border:1.5px solid var(--light-border); border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="font-weight:800; color:var(--dark-bg);">${group.icon || '📌'} ${group.name}</h4>
          </div>

          ${isGarnitur ? `
          <div style="background:#FFF8E1; border:1px solid #FFE082; padding:10px; border-radius:8px; margin-bottom:12px; display:flex; gap:12px; align-items:center;">
            <div style="flex:1;">
              <label style="font-size:0.8rem; font-weight:800;">Ücretsiz Garnitür Limiti (Adet):</label>
              <input type="number" id="group-free-limit-${group.id}" class="form-input" style="padding:4px 8px; font-weight:800;" value="${group.free_limit}" />
            </div>
            <div style="flex:1;">
              <label style="font-size:0.8rem; font-weight:800;">Limit Aşım Birim Ücreti (₺):</label>
              <input type="number" step="0.5" id="group-extra-fee-${group.id}" class="form-input" style="padding:4px 8px; font-weight:800;" value="${group.extra_fee}" />
            </div>
            <button class="btn-primary" style="padding:6px 12px; font-size:0.85rem; margin-top:16px;" onclick="app.saveGroupRule(${group.id}, '${group.name}')">
              💾 Kuralı Kaydet
            </button>
          </div>
          ` : ''}

          <table class="admin-table" style="background:white; border-radius:8px; overflow:hidden;">
            <thead>
              <tr>
                <th>Seçenek Adı</th>
                <th style="width:140px;">Ekstra Fiyat (₺)</th>
                <th style="width:120px; text-align:center;">Varsayılan</th>
                <th style="width:100px; text-align:center;">İşlem</th>
              </tr>
            </thead>
            <tbody>
      `;

      group.items.forEach(item => {
        html += `
          <tr>
            <td>
              <input type="text" id="item-name-${item.id}" class="form-input" style="padding:4px 8px; font-weight:700;" value="${item.name}" />
            </td>
            <td>
              <div class="price-input-group">
                <span>₺</span>
                <input type="number" step="0.5" id="item-price-${item.id}" class="price-input" value="${item.extra_price}" />
              </div>
            </td>
            <td style="text-align:center;">
              <input type="checkbox" id="item-def-${item.id}" ${item.is_default === 1 ? 'checked' : ''} />
            </td>
            <td style="text-align:center;">
              <button class="btn-primary" style="padding:3px 8px; font-size:0.75rem; margin-right:4px;" onclick="app.saveOptionItem(${item.id})">💾</button>
              <button class="btn-secondary" style="padding:3px 8px; font-size:0.75rem; color:red;" onclick="app.deleteOptionItem(${item.id})">🗑️</button>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
          <button class="btn-secondary" style="margin-top:8px; font-size:0.85rem;" onclick="app.promptAddOptionItem(${group.id})">
            ➕ Bu Gruba Yeni Seçenek Ekle
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async saveGroupRule(groupId, groupName) {
    const freeLimit = parseInt(document.getElementById(`group-free-limit-${groupId}`).value);
    const extraFee = parseFloat(document.getElementById(`group-extra-fee-${groupId}`).value);

    try {
      const res = await fetch(`/api/options/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, free_limit: freeLimit, extra_fee: extraFee })
      });
      if (!res.ok) throw new Error('Hata');
      this.showToast('Garnitür kuralı güncellendi!', 'success');
      await this.fetchOptions();
    } catch (err) {
      this.showToast('Kural güncelleme hatası', 'error');
    }
  }

  async saveOptionItem(itemId) {
    const name = document.getElementById(`item-name-${itemId}`).value.trim();
    const extraPrice = parseFloat(document.getElementById(`item-price-${itemId}`).value);
    const isDefault = document.getElementById(`item-def-${itemId}`).checked ? 1 : 0;

    try {
      const res = await fetch(`/api/options/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, extra_price: extraPrice, is_default: isDefault })
      });
      if (!res.ok) throw new Error('Hata');
      this.showToast('Opsiyon seçeneği kaydedildi!', 'success');
      await this.fetchOptions();
    } catch (err) {
      this.showToast('Kaydetme hatası', 'error');
    }
  }

  async deleteOptionItem(itemId) {
    if (!confirm('Bu seçeneği silmek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch(`/api/options/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Hata');
      this.showToast('Opsiyon silindi.', 'success');
      await this.renderAdminOptionsManagement();
    } catch (err) {
      this.showToast('Silme hatası', 'error');
    }
  }

  async promptAddOptionItem(groupId) {
    const name = prompt('Yeni Seçenek / Sos Adını Girin (Örn: Roka, Özel Cevizli Sos):');
    if (!name) return;

    const priceInput = prompt('Ekstra Ücret (TL) Girin (Ücretsiz için 0):', '0');
    const extraPrice = parseFloat(priceInput) || 0.0;

    try {
      const res = await fetch('/api/options/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, name, extra_price: extraPrice, is_default: 0, sort_order: 99 })
      });
      if (!res.ok) throw new Error('Hata');
      this.showToast('Yeni seçenek eklendi!', 'success');
      await this.renderAdminOptionsManagement();
    } catch (err) {
      this.showToast('Ekleme hatası', 'error');
    }
  }

  async quickUpdatePrice(productId, newPrice, priceType = 'price') {
    const priceVal = parseFloat(newPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert('Görünür bir fiyat girin!');
      return;
    }

    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const payload = {
      price: priceType === 'price' ? priceVal : product.price,
      price_masa: priceType === 'price_masa' ? priceVal : (product.price_masa || product.price)
    };

    try {
      const res = await fetch(`/api/products/${productId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Fiyat güncellenemedi');

      this.showToast('Fiyat başarıyla güncellendi! 💰', 'success');
      await this.fetchProducts();
      this.renderProductGrid();
    } catch (err) {
      this.showToast('Fiyat güncelleme hatası', 'error');
    }
  }

  openNewProductModal() {
    document.getElementById('edit-product-modal-title').innerText = '➕ Yeni Ürün Ekle';
    document.getElementById('edit-p-id').value = '';
    document.getElementById('edit-p-name').value = '';
    document.getElementById('edit-p-price').value = '';
    document.getElementById('edit-p-price-masa').value = '';
    document.getElementById('edit-p-desc').value = '';
    document.getElementById('edit-p-unit').value = 'Adet';
    document.getElementById('edit-p-icon').value = '🌯';
    document.getElementById('edit-p-has-options').checked = true;
    document.getElementById('edit-p-is-active').checked = true;

    this.populateCategorySelect();
    this.openModal('modal-edit-product');
  }

  async openEditProductModal(productId) {
    document.getElementById('edit-product-modal-title').innerText = '✏️ Ürün Düzenle';
    const product = this.products.find(p => p.id === productId) || await (await fetch(`/api/products?include_inactive=true`)).json().then(list => list.find(p => p.id === productId));

    if (!product) return;

    document.getElementById('edit-p-id').value = product.id;
    document.getElementById('edit-p-name').value = product.name;
    document.getElementById('edit-p-price').value = product.price;
    document.getElementById('edit-p-price-masa').value = product.price_masa || product.price;
    document.getElementById('edit-p-desc').value = product.description || '';
    document.getElementById('edit-p-unit').value = product.unit || 'Adet';
    document.getElementById('edit-p-icon').value = product.image_symbol || '🌶️';
    document.getElementById('edit-p-has-options').checked = product.has_options === 1;
    document.getElementById('edit-p-is-active').checked = product.is_active === 1;

    this.populateCategorySelect(product.category_id);
    this.openModal('modal-edit-product');
  }

  populateCategorySelect(selectedCategoryId = null) {
    const select = document.getElementById('edit-p-category');
    if (!select) return;

    let html = '';
    this.categories.forEach(c => {
      html += `<option value="${c.id}" ${c.id === selectedCategoryId ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>`;
    });
    select.innerHTML = html;
  }

  async saveProductForm() {
    const pId = document.getElementById('edit-p-id').value;
    const catId = parseInt(document.getElementById('edit-p-category').value);
    const name = document.getElementById('edit-p-name').value.trim();
    const price = parseFloat(document.getElementById('edit-p-price').value);
    const priceMasa = parseFloat(document.getElementById('edit-p-price-masa').value) || price;
    const desc = document.getElementById('edit-p-desc').value.trim();
    const unit = document.getElementById('edit-p-unit').value.trim() || 'Adet';
    const icon = document.getElementById('edit-p-icon').value.trim() || '🌶️';
    const hasOptions = document.getElementById('edit-p-has-options').checked ? 1 : 0;
    const isActive = document.getElementById('edit-p-is-active').checked ? 1 : 0;

    if (!name || isNaN(price) || price <= 0) {
      alert('Lütfen geçerli bir ürün adı ve paket fiyatı girin!');
      return;
    }

    const payload = {
      category_id: catId,
      name: name,
      description: desc,
      price: price,
      price_masa: priceMasa,
      unit: unit,
      image_symbol: icon,
      is_active: isActive,
      has_options: hasOptions
    };

    try {
      let res;
      if (pId) {
        res = await fetch(`/api/products/${pId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Ürün kaydedilemedi');

      this.closeModal('modal-edit-product');
      this.showToast('Ürün başarıyla kaydedildi!', 'success');
      await this.fetchProducts();
      this.renderProductGrid();
      this.renderAdminProductsTable();
    } catch (err) {
      this.showToast('Ürün kaydetme hatası', 'error');
    }
  }

  async deleteProduct(productId) {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Silinemedi');

      this.showToast('Ürün silindi.', 'success');
      await this.fetchProducts();
      this.renderProductGrid();
      await this.renderAdminProductsTable();
    } catch (err) {
      this.showToast('Ürün silme hatası', 'error');
    }
  }

  async resetMenuToDefault() {
    if (!confirm('Tüm menü ve fiyatlar orijinal O Ses 25. Yıl fiyat listesine sıfırlanacak. Onaylıyor musunuz?')) return;

    try {
      const res = await fetch('/api/admin/reset-menu', { method: 'POST' });
      const data = await res.json();

      this.showToast(data.message, 'success');
      await this.fetchCategories();
      await this.fetchProducts();
      this.renderCategoryTabs();
      this.renderProductGrid();
      await this.renderAdminProductsTable();
    } catch (err) {
      this.showToast('Sıfırlama hatası', 'error');
    }
  }

  // --- Order Submission & 80mm Printing ---

  async completeAndPrintOrder() {
    if (this.cart.length === 0) {
      alert('Sepetiniz boş! Lütfen adisyona ürün ekleyin.');
      return;
    }

    const subtotal = this.cart.reduce((sum, i) => sum + i.totalPrice, 0);
    let discountAmount = 0;
    if (this.discount.type === 'PERCENT') discountAmount = (subtotal * this.discount.value) / 100;
    else if (this.discount.type === 'TL') discountAmount = Math.min(subtotal, this.discount.value);
    else if (this.discount.type === 'IKRAM') discountAmount = subtotal;

    const totalAmount = Math.max(0, subtotal - discountAmount);

    const orderPayload = {
      customer_phone: this.activeCustomer ? this.activeCustomer.phone : null,
      customer_name: this.activeCustomer ? this.activeCustomer.name : 'Tezgah / Gel-Al Müşterisi',
      customer_address: this.activeCustomer ? this.activeCustomer.address : '',
      source: 'KASA',
      order_type: this.orderType,
      subtotal: subtotal,
      discount_amount: discountAmount,
      discount_type: this.discount.type,
      total_amount: totalAmount,
      payment_method: this.paymentMethod,
      note: this.activeCustomer ? this.activeCustomer.notes : '',
      items: this.cart.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        options_summary: item.optionsSummary,
        total_price: item.totalPrice
      }))
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) throw new Error('Sipariş oluşturulamadı');

      const createdOrder = await res.json();

      this.printReceipt(createdOrder);

      this.showToast(`Sipariş #${createdOrder.order_number} başarıyla tamamlandı!`, 'success');

      if (this.activeCustomer) {
        this.activeCustomer.total_orders = (this.activeCustomer.total_orders || 0) + 1;
        this.selectCustomer(this.activeCustomer);
      }

      this.cart = [];
      this.discount = { type: 'NONE', value: 0 };
      this.renderCart();

    } catch (err) {
      this.showToast('Sipariş kaydı oluşturulurken hata!', 'error');
    }
  }

  // --- 80mm Thermal Receipt Generator ---

  printReceipt(order) {
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    const dateFormatted = order.created_at || new Date().toLocaleString('tr-TR');
    const paymentLabel = order.payment_method === 'NAKIT' ? 'NAKİT' : (order.payment_method === 'KREDI_KART' ? 'KREDİ KART' : 'VERESİYE / AÇIK HESAP');

    let itemsHtml = '';
    order.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td style="width:10%; text-align:left;">${item.quantity}x</td>
          <td style="width:65%;">
            ${item.product_name}
            ${item.options_summary ? `<div class="receipt-item-options">* ${item.options_summary}</div>` : ''}
          </td>
          <td style="width:25%; text-align:right;">₺${item.total_price.toFixed(2)}</td>
        </tr>
      `;
    });

    const hasCustomer = order.customer_name && order.customer_name !== 'Tezgah / Gel-Al Müşterisi';
    const orderTypeLabel = (order.order_type === 'MASA' || order.order_type === 'SALON') ? '🍽️ MASA (Salon)' : '📦 PAKET (Gel-Al)';

    printArea.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-logo-title">O SES ÇİĞKÖFTE</div>
        <div class="receipt-sub">LEZZETİN ADRESİ - KASA FİŞİ</div>
      </div>

      <div class="receipt-meta">
        <div class="receipt-meta-row"><span>Sipariş No:</span> <strong>${order.order_number}</strong></div>
        <div class="receipt-meta-row"><span>Tarih/Saat:</span> <span>${dateFormatted}</span></div>
        <div class="receipt-meta-row"><span>Sipariş Türü:</span> <strong>${orderTypeLabel}</strong></div>
        <div class="receipt-meta-row"><span>Kaynak:</span> <strong>${order.source}</strong></div>
      </div>

      ${hasCustomer ? `
      <div class="receipt-customer-box">
        <div class="receipt-customer-title">MÜŞTERİ BİLGİLERİ:</div>
        <div><strong>${order.customer_name}</strong></div>
        <div>Tel: ${order.customer_phone || '-'}</div>
        ${order.customer_address ? `<div>Adres: ${order.customer_address}</div>` : ''}
        ${order.note ? `<div>Not: ${order.note}</div>` : ''}
      </div>
      ` : ''}

      <table class="receipt-items-table">
        <thead>
          <tr>
            <th style="text-align:left;">Adet</th>
            <th style="text-align:left;">Ürün / Opsiyon</th>
            <th style="text-align:right;">Tutar</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="receipt-totals">
        <div class="receipt-total-row">
          <span>Ara Toplam:</span>
          <span>₺${order.subtotal.toFixed(2)}</span>
        </div>
        ${order.discount_amount > 0 ? `
        <div class="receipt-total-row">
          <span>İndirim Tutarı:</span>
          <span>-₺${order.discount_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="receipt-total-row grand-total">
          <span>TOPLAM:</span>
          <span>₺${order.total_amount.toFixed(2)}</span>
        </div>
        <div class="receipt-total-row" style="margin-top:4px;">
          <span>Ödeme Türü:</span>
          <strong>${paymentLabel}</strong>
        </div>
      </div>

      <div class="receipt-footer">
        <div>AFİYET OLSUN!</div>
        <div style="font-weight:normal; font-size:9px; margin-top:2px;">Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz.</div>
      </div>
    `;

    setTimeout(() => {
      window.print();
    }, 150);
  }

  async reprintOrder(orderId) {
    const res = await fetch(`/api/orders/${orderId}`);
    const order = await res.json();
    this.printReceipt(order);
  }

  // --- External Order Simulator ---

  openExternalOrderModal() {
    this.openModal('modal-external-order');
  }

  async simulateExternalOrder() {
    const source = document.getElementById('ext-source').value;
    const name = document.getElementById('ext-name').value;
    const phone = document.getElementById('ext-phone').value;
    const address = document.getElementById('ext-address').value;
    const preset = document.getElementById('ext-preset').value;

    let items = [];
    let total = 240.0;

    if (preset === '1') {
      items = [
        { product_id: 3, product_name: 'MEGA DÜRÜM', unit_price: 190.0, quantity: 1, options_summary: 'Bol Acılı, Nane Yok', total_price: 190.0 },
        { product_id: 14, product_name: 'Büyük Ayran', unit_price: 50.0, quantity: 1, options_summary: '', total_price: 50.0 }
      ];
      total = 240.0;
    } else if (preset === '2') {
      items = [
        { product_id: 8, product_name: 'ORTA PAKET', unit_price: 440.0, quantity: 1, options_summary: 'Göbek marul bol olsun', total_price: 440.0 },
        { product_id: 20, product_name: 'Şalgam', unit_price: 40.0, quantity: 2, options_summary: '', total_price: 80.0 }
      ];
      total = 520.0;
    } else {
      items = [
        { product_id: 11, product_name: 'AİLE BOYU PAKET', unit_price: 750.0, quantity: 1, options_summary: 'Çift soslu', total_price: 750.0 },
        { product_id: 24, product_name: 'Litrelik Kola', unit_price: 100.0, quantity: 1, options_summary: '', total_price: 100.0 }
      ];
      total = 850.0;
    }

    const payload = {
      source: source,
      external_order_id: 'EXT-' + Math.floor(100000 + Math.random() * 900000),
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      note: 'Dış kurye kapıda teslim edecek.',
      payment_method: 'KREDI_KART',
      items: items,
      total_amount: total
    };

    try {
      const res = await fetch('/api/external/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      this.closeModal('modal-external-order');
      this.showToast(`🛵 Entegre Sipariş Geldi! (${source} - #${data.order.order_number})`, 'success');

      this.printReceipt(data.order);

    } catch (err) {
      this.showToast('Dış sipariş entegrasyon hatası', 'error');
    }
  }

  // --- Utility Helpers ---

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- QR Self-Ordering Auto-Print & QR Generator Methods ---

  startQROrderAutoPrintPoller() {
    this.lastPendingCount = 0;
    setInterval(async () => {
      try {
        const res = await fetch('/api/orders/pending-qr-approvals');
        if (!res.ok) return;
        const pendingOrders = await res.json();

        const badge = document.getElementById('qr-pending-badge');
        const countSpan = document.getElementById('qr-pending-count');

        if (pendingOrders && pendingOrders.length > 0) {
          if (badge) badge.style.display = 'inline-flex';
          if (countSpan) countSpan.innerText = pendingOrders.length;

          if (pendingOrders.length > this.lastPendingCount) {
            this.playNotificationBeep();
            this.showToast(`📱 YENİ KAREKOD SİPARİŞİ! (${pendingOrders.length} Onay Bekliyor)`, 'success');
          }
          this.lastPendingCount = pendingOrders.length;

          const modal = document.getElementById('modal-qr-approval');
          if (modal && modal.classList.contains('active')) {
            this.renderQRPendingOrders(pendingOrders);
          }

        } else {
          if (badge) badge.style.display = 'none';
          this.lastPendingCount = 0;
        }
      } catch (err) {
        // Silent catch
      }
    }, 3000);
  }

  async openQRPendingModal() {
    this.openModal('modal-qr-approval');
    try {
      const res = await fetch('/api/orders/pending-qr-approvals');
      const pendingOrders = await res.json();
      this.renderQRPendingOrders(pendingOrders);
    } catch (e) {
      this.showToast('Bekleyen siparişler yüklenemedi', 'error');
    }
  }

  renderQRPendingOrders(orders) {
    const container = document.getElementById('qr-pending-orders-container');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748B;">Bekleyen Karekod siparişi bulunmuyor.</div>`;
      return;
    }

    let html = '';
    orders.forEach(o => {
      let itemsHtml = '';
      (o.items || []).forEach(i => {
        itemsHtml += `
          <div style="font-size:0.85rem; padding: 2px 0;">
            • <strong>${i.quantity}x ${i.product_name}</strong> - ₺${i.total_price.toFixed(2)}
            ${i.options_summary ? `<div style="color:#64748B; font-size:0.75rem; padding-left:10px;">${i.options_summary}</div>` : ''}
          </div>
        `;
      });

      html += `
        <div style="background: #FFFBEB; border: 1.5px solid #F59E0B; border-radius: 14px; padding: 14px; margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #FCD34D; padding-bottom: 8px; margin-bottom: 8px;">
            <div>
              <span style="font-weight:800; font-size:1.05rem; color:#B45309;">${o.customer_name || 'Karekod Müşterisi'}</span>
              <span class="customer-badge" style="background:#F59E0B; color:white; margin-left:6px;">${o.order_number}</span>
            </div>
            <div style="font-weight:800; font-size:1.2rem; color:var(--primary-red);">₺${o.total_amount.toFixed(2)}</div>
          </div>
          <div style="margin-bottom: 10px;">${itemsHtml}</div>
          ${o.note ? `<div style="font-size:0.8rem; color:#B45309; font-weight:700; margin-bottom:10px;">📝 ${o.note}</div>` : ''}
          <div style="display:flex; gap:8px;">
            <button class="btn-primary" style="flex:2; background:#059669; font-size:0.9rem;" onclick="app.approveQROrder(${o.id})">
              ✅ ONAYLA VE FİŞ BASTIR
            </button>
            <button class="btn-secondary" style="flex:1; color:#D32F2F; border-color:#FCA5A5; font-size:0.85rem;" onclick="app.rejectQROrder(${o.id})">
              ❌ REDDET / İPTAL ET
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async approveQROrder(orderId) {
    try {
      const res = await fetch(`/api/orders/${orderId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Onaylanamadı');
      const approvedOrder = await res.json();

      this.showToast(`Sipariş #${approvedOrder.order_number} onaylandı ve basılıyor!`, 'success');
      this.printReceipt(approvedOrder);

      const fetchRes = await fetch('/api/orders/pending-qr-approvals');
      const pendingOrders = await fetchRes.json();
      this.renderQRPendingOrders(pendingOrders);
      if (pendingOrders.length === 0) this.closeModal('modal-qr-approval');

    } catch (e) {
      this.showToast('Sipariş onaylama hatası', 'error');
    }
  }

  async rejectQROrder(orderId) {
    if (!confirm('Bu siparişi reddetmek/iptal etmek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Reddedilemedi');

      this.showToast(`Sipariş #${orderId} reddedildi.`, 'info');
      const fetchRes = await fetch('/api/orders/pending-qr-approvals');
      const pendingOrders = await fetchRes.json();
      this.renderQRPendingOrders(pendingOrders);
      if (pendingOrders.length === 0) this.closeModal('modal-qr-approval');

    } catch (e) {
      this.showToast('Sipariş reddetme hatası', 'error');
    }
  }

  playNotificationBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) { }
  }

  async openQRGeneratorModal() {
    let qrUrl = `${window.location.protocol}//${window.location.host}/qr`;

    try {
      const res = await fetch('/api/tunnel-url');
      const data = await res.json();
      if (data && data.url) {
        qrUrl = data.url.endsWith('/qr') ? data.url : `${data.url}/qr`;
      }
    } catch (e) { }

    this.activeQRUrl = qrUrl;

    const imgContainer = document.getElementById('qr-code-img-container');
    const urlText = document.getElementById('qr-url-text');

    if (urlText) urlText.innerText = qrUrl;
    if (imgContainer) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;
      imgContainer.innerHTML = `<img src="${qrApiUrl}" alt="QR Menü" style="width:200px; height:200px; border-radius:8px;" />`;
    }

    this.openModal('modal-qr-generator');
  }

  printQRCodeSticker() {
    const qrUrl = this.activeQRUrl || `${window.location.protocol}//${window.location.host}/qr`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`;

    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div style="font-family: sans-serif; text-align: center; padding: 20px; width: 80mm; margin: 0 auto; border: 2px dashed #000;">
        <h2 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 4px;">🌶️ O SES ÇİĞKÖFTE</h2>
        <p style="font-size: 0.85rem; font-weight: 700; margin-bottom: 10px;">📱 KAREKOD İLE MASADAN SİPARİŞ</p>
        <img src="${qrApiUrl}" style="width: 180px; height: 180px; margin: 10px 0;" />
        <p style="font-size: 0.8rem; margin-top: 8px;">Kameranız ile QR kodu okutarak hızlıca sipariş verebilirsiniz!</p>
        <p style="font-size: 0.75rem; font-weight: 700; margin-top: 4px; word-break: break-all;">${qrUrl}</p>
      </div>
    `;

    window.print();
  }
}

// Global App Instance
const app = new POSApp();
