/**
 * O Ses Çiğköfte POS & Adisyon Sistemi - SPA Application Logic
 */

class POSApp {
  constructor() {
    this.categories = [];
    this.products = [];
    this.optionGroups = [];
    this.activeCategory = 'ALL';
    this.orderType = 'PAKET'; // 'PAKET' or 'MASA' (Salon)
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

    // Admin Security PIN state
    this.isAdminUnlocked = false;
    this.adminSessionExpiry = 0; // Timestamp for 30-minute admin session memory
    this.pendingAdminAction = null;
    this.currentPinInput = '';

    this.init();
  }

  async init() {
    await this.fetchStoreSettings();
    await this.fetchCategories();
    await this.fetchProducts();
    await this.fetchOptions();
    await this.fetchOpenOrders();
    this.renderCategoryTabs();
    this.renderProductGrid();
    this.renderCart();
    this.startQROrderAutoPrintPoller();
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.msExitFullscreen) document.msExitFullscreen();
        }
      }
      if (e.key === 'F11' || e.code === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
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
    this.showToast(`Sipariş Tarifesi Değişti: ${type === 'MASA' ? '🍽️ MASA (Salon)' : '📦 PAKET'}`, 'info');
  }

  // --- Rendering POS Interface ---

  renderCategoryTabs() {
    const container = document.getElementById('category-tabs-container');
    if (!container) return;

    let html = `
      <button class="category-tab ${this.orderType === 'PAKET' ? 'active' : ''}" style="${this.orderType === 'PAKET' ? 'background: linear-gradient(135deg, #10B981 0%, #059669 100%); color:white; font-weight:800;' : 'background:#E2E8F0; color:#334155; font-weight:700;'}" onclick="app.setOrderType('PAKET')">
        📦 PAKET
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

      const iconHtml = p.image_url
        ? `<div class="product-icon" style="background:transparent; padding:0; overflow:hidden;"><img src="${p.image_url}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" /></div>`
        : `<div class="product-icon">${p.image_symbol || '🌶️'}</div>`;

      html += `
        <div class="product-card" onclick="app.handleProductClick(${p.id})">
          <div class="product-header">
            ${iconHtml}
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

  deleteCustomer(phone) {
    this.requireAdminAuth(() => this._deleteCustomerInternal(phone), 'Müşteri Kaydı Silme');
  }

  async _deleteCustomerInternal(phone) {
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
      const url = query ? `/api/customers/search?q=${encodeURIComponent(query)}` : '/api/customers/search';
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
          const isCancelled = o.order_status === 'IPTAL';
          html += `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--primary-red);">${o.order_number}</strong> 
                <span class="customer-badge" style="background:#333; color:white;">${o.source}</span> 
                <span style="font-size:0.8rem; color:#666;">${o.created_at}</span>
                <div style="font-size:0.85rem; font-weight:600;">👤 ${o.customer_name} (${o.payment_method})</div>
                ${isCancelled ? `<span style="font-size:0.75rem; color:#DC2626; font-weight:800; background:#FEE2E2; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:2px;">❌ İPTAL EDİLDİ</span>` : ''}
              </div>
              <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                <div style="font-weight:900; font-size:1.1rem; font-family:var(--font-mono); ${isCancelled ? 'color:#94A3B8; text-decoration:line-through;' : ''}">₺${o.total_amount.toFixed(2)}</div>
                <div style="display:flex; gap:4px;">
                  <button class="btn-secondary" style="padding:3px 8px; font-size:0.75rem;" onclick="app.reprintOrder(${o.id})">🖨️ Fiş Bas</button>
                  ${!isCancelled ? `<button class="btn-secondary" style="padding:3px 8px; font-size:0.75rem; color:#DC2626; border-color:#FCA5A5; background:#FEF2F2;" onclick="app.cancelCompletedOrder(${o.id})">❌ İptal</button>` : ''}
                </div>
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

  openAdminProductsModal() {
    this.requireAdminAuth(() => {
      this.openModal('modal-admin-products');
      this.switchAdminTab('products');
    }, 'Ürün & Opsiyon Yönetimi');
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
        const iconHtml = p.image_url
          ? `<img src="${p.image_url}" style="width:30px; height:30px; border-radius:6px; object-fit:cover; vertical-align:middle; margin-right:6px;" />`
          : `<span style="margin-right:6px; font-size:1.1rem;">${p.image_symbol || '🌶️'}</span>`;

        html += `
          <tr>
            <td><strong>${iconHtml} ${p.name}</strong></td>
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
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px; background:#3B82F6; color:white;" onclick="app.openCropperForProduct(${p.id})">
                📸 Görsel
              </button>
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

  quickUpdatePrice(productId, newPrice, priceType = 'price') {
    this.requireAdminAuth(() => this._quickUpdatePriceInternal(productId, newPrice, priceType), 'Fiyat Güncelleme');
  }

  async _quickUpdatePriceInternal(productId, newPrice, priceType = 'price') {
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
    document.getElementById('edit-p-image-url').value = '';
    document.getElementById('edit-p-image-preview').innerHTML = '🌯';
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

    const imgUrl = product.image_url || '';
    document.getElementById('edit-p-image-url').value = imgUrl;
    document.getElementById('edit-p-image-preview').innerHTML = imgUrl
      ? `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" />`
      : (product.image_symbol || '🌶️');

    document.getElementById('edit-p-has-options').checked = product.has_options === 1;
    document.getElementById('edit-p-is-active').checked = product.is_active === 1;

    this.populateCategorySelect(product.category_id);
    this.openModal('modal-edit-product');
  }

  clearEditProductImage() {
    document.getElementById('edit-p-image-url').value = '';
    const icon = document.getElementById('edit-p-icon').value || '🌯';
    document.getElementById('edit-p-image-preview').innerHTML = icon;
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
    const imageUrl = document.getElementById('edit-p-image-url').value.trim() || null;
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
      image_url: imageUrl,
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

  resetMenuToDefault() {
    this.requireAdminAuth(() => this._resetMenuToDefaultInternal(), 'Menü Sıfırlama');
  }

  async _resetMenuToDefaultInternal() {
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

    // If payment method is Credit Card and GMP-3 POS integration is enabled, send amount to inPOS m530
    if (this.paymentMethod === 'KREDI_KART' && this.storeSettings && this.storeSettings.gmp3_enabled !== '0') {
      this.triggerGmp3Payment(totalAmount, () => this._submitOrderInternal(subtotal, discountAmount, totalAmount));
      return;
    }

    await this._submitOrderInternal(subtotal, discountAmount, totalAmount);
  }

  async triggerGmp3Payment(totalAmount, onSuccess) {
    const amountEl = document.getElementById('gmp3-modal-amount');
    const statusEl = document.getElementById('gmp3-modal-status');
    const spinner = document.getElementById('gmp3-modal-spinner');

    if (amountEl) amountEl.innerText = `₺${totalAmount.toFixed(2)}`;
    if (statusEl) statusEl.innerText = 'inPOS m530 cihazına tutar aktarılıyor... Lütfen kartı cihaza okutun.';
    if (spinner) spinner.style.display = 'block';

    this.openModal('modal-gmp3-pos');

    try {
      const res = await fetch('/api/gmp3/send-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          payment_type: 'KREDI_KART'
        })
      });
      const data = await res.json();

      if (data.status === 'success') {
        if (statusEl) statusEl.innerText = '✅ Ödeme Başarılı! Sipariş tamamlanıyor...';
        if (spinner) spinner.style.display = 'none';
        this.showToast('inPOS m530 Ödemesi Alındı! 💳✅', 'success');
        setTimeout(() => {
          this.closeModal('modal-gmp3-pos');
          onSuccess();
        }, 600);
      } else {
        if (statusEl) statusEl.innerText = `❌ ${data.message || 'Ödeme Başarısız'}`;
        if (spinner) spinner.style.display = 'none';
        this.showToast(data.message || 'inPOS m530 ödeme hatası!', 'error');
      }
    } catch (err) {
      if (statusEl) statusEl.innerText = '❌ inPOS m530 cihazına ulaşılamadı!';
      if (spinner) spinner.style.display = 'none';
      this.showToast('inPOS m530 iletişim hatası', 'error');
    }
  }

  cancelGmp3Payment() {
    this.closeModal('modal-gmp3-pos');
    this.showToast('inPOS m530 ödeme işlemi iptal edildi.', 'info');
  }

  async _submitOrderInternal(subtotal, discountAmount, totalAmount) {
    const orderPayload = {
      customer_phone: this.activeCustomer ? this.activeCustomer.phone : null,
      customer_name: this.activeCustomer ? this.activeCustomer.name : 'Paket Müşterisi',
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

  async printDraftReceipt() {
    if (!this.cart || this.cart.length === 0) {
      this.showToast('Yazdırılacak ürün sepetinizde yok!', 'error');
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
    let discountAmount = 0;
    if (this.discount.type === 'PERCENT') discountAmount = (subtotal * this.discount.value) / 100;
    else if (this.discount.type === 'TL') discountAmount = Math.min(subtotal, this.discount.value);
    else if (this.discount.type === 'IKRAM') discountAmount = subtotal;

    const totalAmount = Math.max(0, subtotal - discountAmount);

    const orderPayload = {
      customer_phone: this.activeCustomer ? this.activeCustomer.phone : null,
      customer_name: this.activeCustomer ? this.activeCustomer.name : (this.orderType === 'MASA' ? 'Açık Masa Adisyonu' : 'Paket Müşterisi'),
      customer_address: this.activeCustomer ? this.activeCustomer.address : '',
      source: 'KASA',
      order_type: this.orderType,
      subtotal: subtotal,
      discount_amount: discountAmount,
      discount_type: this.discount.type,
      total_amount: totalAmount,
      payment_method: 'ÖDEME BEKLİYOR',
      order_status: 'BEKLIYOR',
      note: 'YEMEK ÖNCESİ ARA ADİSYON (ÖDEMESİZ)',
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
      const createdOrder = await res.json();

      this.printReceipt(createdOrder);
      this.showToast(`Masa Siparişi #${createdOrder.order_number} açıldı ve Mutfak Fişi basıldı! 📄🖨️`, 'success');

      this.cart = [];
      this.discount = { type: 'NONE', value: 0 };
      this.renderCart();
      this.fetchOpenOrders();

    } catch (err) {
      this.showToast('Mutfak fişi oluşturulurken hata!', 'error');
    }
  }

  // --- AÇIK MASALAR VE BEKLEYEN ADİSYONLAR YÖNETİMİ ---

  async fetchOpenOrders() {
    try {
      const res = await fetch('/api/orders/open');
      const orders = await res.json();
      const badgeCount = document.getElementById('open-orders-count-badge');
      if (badgeCount) badgeCount.innerText = orders ? orders.length : 0;
      this.renderMiniOpenTables(orders);
      return orders;
    } catch (err) {
      console.error('Açık adisyonlar yükleme hatası:', err);
      return [];
    }
  }

  renderMiniOpenTables(orders) {
    const miniContainer = document.getElementById('mini-open-tables-container');
    if (!miniContainer) return;

    if (!orders || orders.length === 0) {
      miniContainer.innerHTML = `
        <div style="font-size: 0.75rem; color: #94A3B8; text-align: center; padding: 4px 0;">
          Açık masa bulunmuyor (Tümü Kapalı)
        </div>
      `;
      return;
    }

    const miniList = orders.slice(0, 3);
    let html = '';

    miniList.forEach(o => {
      const tableName = o.customer_name || `Masa #${o.id}`;
      html += `
        <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 6px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem;">
          <div style="font-weight: 700; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tableName}">
            🍽️ ${tableName}
          </div>
          <div style="font-weight: 800; color: #4ADE80;">
            ₺${o.total_amount.toFixed(2)}
          </div>
          <div style="display: flex; gap: 4px;">
            <button type="button" style="background: #2563EB; color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" onclick="app.editOpenOrder(${o.id})" title="Sepete Al & Düzenle">✏️</button>
            <button type="button" style="background: #EF4444; color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" onclick="app.cancelOpenOrder(${o.id})" title="Masayı İptal Et">❌</button>
            <button type="button" style="background: #10B981; color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" onclick="app.checkoutOpenOrder(${o.id}, 'NAKIT', ${o.total_amount})" title="Nakit İle Kapat">💵</button>
            <button type="button" style="background: #3B82F6; color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" onclick="app.checkoutOpenOrder(${o.id}, 'KREDI_KART', ${o.total_amount})" title="Kredi Kartı (inPOS m530)">💳</button>
            <button type="button" style="background: #64748B; color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" onclick="app.reprintOrder(${o.id})" title="Fiş Yazdır">🖨️</button>
          </div>
        </div>
      `;
    });

    if (orders.length > 3) {
      html += `
        <div style="text-align: center; font-size: 0.72rem; color: #F59E0B; cursor: pointer; font-weight: 700; margin-top: 2px;" onclick="app.openOpenOrdersModal()">
          + ${orders.length - 3} masa daha var (Tümünü Göster) ➔
        </div>
      `;
    }

    miniContainer.innerHTML = html;
  }

  async openOpenOrdersModal() {
    const orders = await this.fetchOpenOrders();
    this.renderOpenOrdersList(orders);
    this.openModal('modal-open-orders');
  }

  renderOpenOrdersList(orders) {
    const container = document.getElementById('open-orders-list-container');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94A3B8;">
          <div style="font-size: 3rem; margin-bottom: 8px;">🍽️</div>
          <div style="font-size: 1.1rem; font-weight: 700;">Açık masa veya bekleyen adisyon bulunmuyor.</div>
        </div>
      `;
      return;
    }

    let html = '';
    orders.forEach(o => {
      let itemsListHtml = '';
      o.items.forEach(item => {
        itemsListHtml += `<div style="font-size: 0.82rem; color: #334155;">• ${item.quantity}x ${item.product_name} (${item.total_price.toFixed(2)} TL)</div>`;
      });

      const tableName = o.customer_name || `Masa #${o.id}`;

      html += `
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">
            <div>
              <span style="font-weight: 800; font-size: 1.05rem; color: #0F172A;">🍽️ ${tableName}</span>
              <span style="font-size: 0.78rem; color: #64748B; margin-left: 8px;">(Sipariş No: ${o.order_number})</span>
            </div>
            <div style="font-weight: 800; font-size: 1.25rem; color: #D32F2F;">
              ₺${o.total_amount.toFixed(2)}
            </div>
          </div>
          <div>
            ${itemsListHtml}
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 4px;">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; color: #DC2626; border-color: #FCA5A5; background: #FEF2F2;" onclick="app.cancelOpenOrder(${o.id})">❌ Masayı İptal Et</button>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; color: #1D4ED8; border-color: #93C5FD; background: #EFF6FF;" onclick="app.editOpenOrder(${o.id})">✏️ Sepete Yükle & Düzenle</button>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.reprintOrder(${o.id})">🖨️ Fiş Yazdır</button>
            <button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #10B981;" onclick="app.checkoutOpenOrder(${o.id}, 'NAKIT', ${o.total_amount})">💵 Nakit İle Kapat</button>
            <button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #3B82F6;" onclick="app.checkoutOpenOrder(${o.id}, 'KREDI_KART', ${o.total_amount})">💳 Kredi Kartı (inPOS m530)</button>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; color: #D97706;" onclick="app.checkoutOpenOrder(${o.id}, 'VERESIYE', ${o.total_amount})">📝 Veresiye Kapat</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async checkoutOpenOrder(orderId, paymentMethod, totalAmount) {
    if (paymentMethod === 'KREDI_KART' && this.storeSettings && this.storeSettings.gmp3_enabled !== '0') {
      this.triggerGmp3Payment(totalAmount, () => this._checkoutOpenOrderInternal(orderId, paymentMethod));
      return;
    }
    await this._checkoutOpenOrderInternal(orderId, paymentMethod);
  }

  async _checkoutOpenOrderInternal(orderId, paymentMethod) {
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod })
      });
      const order = await res.json();
      this.showToast(`Masa Siparişi #${order.order_number} kapatıldı ve ödeme alındı! 💳✅`, 'success');
      const orders = await this.fetchOpenOrders();
      this.renderOpenOrdersList(orders);
    } catch (err) {
      this.showToast('Masa kapatılırken hata!', 'error');
    }
  }

  async cancelOpenOrder(orderId) {
    if (!confirm('Bu masa siparişini tamamen iptal etmek istediğinizden emin misiniz?\n\n(Açık adisyon silinecek ve ciroya yansımayacaktır)')) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'İptal edilemedi');

      this.showToast('Masa siparişi başarıyla iptal edildi! ❌', 'info');
      const orders = await this.fetchOpenOrders();
      this.renderOpenOrdersList(orders);
    } catch (err) {
      this.showToast(err.message || 'Sipariş iptal edilirken hata oluştu!', 'error');
    }
  }

  async editOpenOrder(orderId) {
    if (this.cart && this.cart.length > 0) {
      if (!confirm('Şu anda satış sepetinizde ürünler var. Açık masayı sepete yüklemek mevcut sepetinizi temizleyecektir. Devam edilsin mi?')) {
        return;
      }
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Sipariş detayları alınamadı');
      const order = await res.json();

      // Açık siparişi iptal ediyoruz ki mükerrer kayıt oluşmasın
      await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });

      // Ürünleri satış sepetine yükle
      this.cart = (order.items || []).map(item => ({
        cartItemId: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: item.product_id,
        productName: item.product_name,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        optionsSummary: item.options_summary || '',
        totalPrice: item.total_price
      }));

      // Müşteri / Masa bilgilerini geri yükle
      if (order.customer_phone) {
        this.activeCustomer = {
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.customer_address
        };
        const custDisplay = document.getElementById('selected-customer-display');
        if (custDisplay) {
          custDisplay.innerHTML = `👤 ${order.customer_name} <button class="btn-clear-customer" onclick="app.clearCustomer()">✕</button>`;
        }
      } else {
        this.activeCustomer = null;
      }

      this.orderType = order.order_type || 'MASA';
      this.tableNumber = order.customer_address || order.customer_name || 'Masa 1';

      const noteInput = document.getElementById('order-note-input');
      if (noteInput && order.note) {
        noteInput.value = order.note.replace(' [İPTAL EDİLDİ]', '').replace(' [Müşteri İptal Etti]', '');
      }

      this.renderCart();
      this.closeModal('modal-open-orders');
      await this.fetchOpenOrders();

      this.showToast(`Masa (${order.customer_name}) sepete yüklendi. İstediğiniz değişikliği yapıp siparişi güncelleyebilirsiniz! ✏️`, 'success');

    } catch (err) {
      this.showToast('Sipariş düzenleme moduna alınırken hata!', 'error');
    }
  }

  async cancelCompletedOrder(orderId) {
    if (!confirm('Bu adisyonu iptal etmek istediğinizden emin misiniz?\n\n(Bu işlem siparişi iptal durumuna getirecek ve gün sonu cirosundan düşecektir)')) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'İptal edilemedi');

      this.showToast('Sipariş iptal edildi ve cirodan düşüldü! ❌', 'info');
      this.switchReportSubtab('orders');
      this.fetchDailyReport();
    } catch (err) {
      this.showToast(err.message || 'Sipariş iptal edilirken hata oluştu!', 'error');
    }
  }

  printReceipt(order) {
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    const dateFormatted = order.created_at || new Date().toLocaleString('tr-TR');
    let paymentLabel = order.payment_method;
    if (order.payment_method === 'NAKIT') paymentLabel = 'NAKİT';
    else if (order.payment_method === 'KREDI_KART') paymentLabel = 'KREDİ KART';
    else if (order.payment_method === 'VERESIYE') paymentLabel = 'VERESİYE / AÇIK HESAP';

    let itemsHtml = '';
    order.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td style="width:14%; text-align:left; font-weight:900;">${item.quantity}x</td>
          <td style="width:58%; text-align:left;">
            <div style="font-weight:900;">${item.product_name}</div>
            ${item.options_summary ? `<div class="receipt-item-options">↳ ${item.options_summary}</div>` : ''}
          </td>
          <td style="width:28%; text-align:right; font-weight:900;">₺${item.total_price.toFixed(2)}</td>
        </tr>
      `;
    });

    const hasCustomer = order.customer_name && order.customer_name !== 'Paket Müşterisi';
    const orderTypeLabel = (order.order_type === 'MASA' || order.order_type === 'SALON') ? '🍽️ MASA (Salon)' : '📦 PAKET';

    const storeTitle = (this.storeSettings && this.storeSettings.store_name) ? this.storeSettings.store_name : 'OSES BAĞLAR';
    const storeSubtitle = (this.storeSettings && this.storeSettings.store_subtitle) ? this.storeSettings.store_subtitle : 'LEZZETİN ADRESİNE HOŞGELDİNİZ';

    const storePhone = (this.storeSettings && this.storeSettings.store_phone) ? this.storeSettings.store_phone : '0551 575 32 00';

    printArea.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-logo-title">${storeTitle}</div>
        <div class="receipt-sub">${storeSubtitle}</div>
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
            <th style="width:14%; text-align:left;">ADET</th>
            <th style="width:58%; text-align:left;">ÜRÜN</th>
            <th style="width:28%; text-align:right;">TUTAR</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="receipt-totals">
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
        <div class="receipt-total-row payment-type-row" style="margin-top:4px;">
          <span>Ödeme Türü:</span>
          <strong>${paymentLabel}</strong>
        </div>
      </div>

      <div class="receipt-footer">
        <div class="receipt-order-phone">📞 SİPARİŞ HATTI: ${storePhone}</div>
        <div class="receipt-footer-title">AFİYET OLSUN!</div>
        <div class="receipt-footer-sub">Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz.</div>
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

        this.fetchOpenOrders();
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
              ${o.customer_phone ? `<span style="font-size:0.8rem; color:#475569; margin-left:8px; font-weight:600; background:#FEF3C7; padding:2px 8px; border-radius:6px; display:inline-block;">📞 ${o.customer_phone}</span>` : ''}
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
    this.qrMode = this.qrMode || 'custom';
    this.tunnelState = {
      active: false,
      url: null,
      local_ip: null,
      local_url: null,
      loading: false
    };

    await this.fetchTunnelStatus();

    if (this.tunnelState.active && this.tunnelState.url) {
      this.syncActiveTunnelToVercel(this.tunnelState.url);
    }

    const modeSelect = document.getElementById('qr-mode-select');
    if (modeSelect) modeSelect.value = this.qrMode;

    this.renderQRConnectionStatus();
    this.updateQRGeneratorPreview();
    this.openModal('modal-qr-generator');
  }

  async syncActiveTunnelToVercel(tunnelUrl) {
    let customDomain = (this.storeSettings && this.storeSettings.qr_custom_domain) || localStorage.getItem('oses_qr_domain') || 'https://osesbaglar.onrender.com';
    if (customDomain.includes('vercel.app')) {
      customDomain = 'https://osesbaglar.onrender.com';
      localStorage.setItem('oses_qr_domain', customDomain);
    }
    if (!customDomain || !tunnelUrl) return;
    try {
      const cleanDomain = customDomain.split('?')[0].replace(/\/+$/, '');
      await fetch(`${cleanDomain}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: tunnelUrl })
      });
      console.log('✅ Vercel yönlendirici senkronize edildi:', tunnelUrl);
    } catch (e) {
      console.warn('Vercel senkronizasyon uyarısı:', e);
    }
  }

  async fetchTunnelStatus() {
    try {
      const res = await fetch('/api/tunnel-url');
      const data = await res.json();
      this.tunnelState = {
        active: !!data.active,
        url: data.url || null,
        local_ip: data.local_ip || '127.0.0.1',
        local_url: data.local_url || `http://${window.location.hostname}:8000/qr`,
        loading: false
      };
    } catch (e) {
      console.error('Tunnel status error:', e);
    }
  }

  async startCloudflareTunnel() {
    this.tunnelState.loading = true;
    this.renderQRConnectionStatus();
    this.showToast('🚀 Cloudflare tüneli başlatılıyor, lütfen bekleyin...', 'info');

    try {
      const res = await fetch('/api/tunnel-start', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.data && data.data.url) {
        this.tunnelState.active = true;
        this.tunnelState.url = data.data.url;
        this.tunnelState.loading = false;
        await this.syncActiveTunnelToVercel(this.tunnelState.url);
        this.showToast('✅ Canlı tünel hazır! Vercel ve karekod güncellendi.', 'success');
      } else {
        throw new Error(data.detail || data.message || 'Tünel başlatılamadı');
      }
    } catch (err) {
      this.tunnelState.loading = false;
      this.tunnelState.active = false;
      this.showToast(`Hata: ${err.message}`, 'error');
    }

    this.renderQRConnectionStatus();
    this.updateQRGeneratorPreview();
  }

  async stopCloudflareTunnel() {
    this.showToast('Tünel kapatılıyor...', 'info');
    try {
      await fetch('/api/tunnel-stop', { method: 'POST' });
      this.tunnelState.active = false;
      this.tunnelState.url = null;
      this.showToast('Tünel durduruldu.', 'info');
    } catch (e) { }

    this.renderQRConnectionStatus();
    this.updateQRGeneratorPreview();
  }

  onQRModeChange() {
    const modeSelect = document.getElementById('qr-mode-select');
    if (modeSelect) {
      this.qrMode = modeSelect.value;
    }
    this.renderQRConnectionStatus();
    this.updateQRGeneratorPreview();
  }

  renderQRConnectionStatus() {
    const box = document.getElementById('qr-connection-status-box');
    if (!box) return;

    if (this.qrMode === 'custom') {
      let savedDomain = (this.storeSettings && this.storeSettings.qr_custom_domain) || localStorage.getItem('oses_qr_domain') || 'https://osesbaglar.onrender.com';
      if (savedDomain.includes('vercel.app')) {
        savedDomain = 'https://osesbaglar.onrender.com';
        localStorage.setItem('oses_qr_domain', savedDomain);
      }
      box.innerHTML = `
        <div style="background: #ECFDF5; border: 1px solid #6EE7B7; padding: 12px 14px; border-radius: 12px; text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <div style="font-weight: 800; color: #065F46; font-size: 0.92rem;">🔒 Ömür Boyu Sabit Adres (Render .com)</div>
            <span style="background: #10B981; color: white; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 20px;">SABİT & KALICI</span>
          </div>
          <div style="font-size: 0.78rem; color: #047857; margin-bottom: 6px;">
            Sonu <strong>.com</strong> ile biter, Xiaomi dahil tüm telefonlar doğrudan web sitesi olarak açar.
          </div>
          <input type="text" id="qr-custom-domain" class="form-input" style="padding: 7px 10px; font-size: 0.85rem; width: 100%; font-weight: 700; color: #065F46;" value="${savedDomain}" oninput="app.updateQRGeneratorPreview()" />
          
          <div style="margin-top: 10px; border-top: 1px dashed #A7F3D0; padding-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-size: 0.78rem; color: #065F46;">
              ${this.tunnelState.active ? `🟢 <strong>Canlı Kasa Köprüsü Aktif:</strong> <span style="font-size:0.72rem; color:#047857;">${this.tunnelState.url}</span>` : `🔴 <strong>Kasa Köprüsü Kapalı:</strong> Müşterilerin 4G ile bağlanabilmesi için tüneli açın.`}
            </div>
            ${!this.tunnelState.active ? `<button class="btn-primary" style="padding: 5px 12px; font-size: 0.78rem; background: #EF4444; white-space: nowrap;" onclick="app.startCloudflareTunnel()">🚀 Tüneli Başlat</button>` : `<button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; white-space: nowrap;" onclick="app.stopCloudflareTunnel()">⏹️ Durdur</button>`}
          </div>
        </div>
      `;
    } else if (this.qrMode === 'tunnel') {
      if (this.tunnelState.loading) {
        box.innerHTML = `
          <div style="background: #FEF3C7; border: 1px solid #F59E0B; padding: 10px 14px; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 800; color: #92400E; font-size: 0.88rem;">⏳ Canlı Cloudflare Tüneli Açılıyor...</div>
              <div style="font-size: 0.76rem; color: #B45309;">Genel internet bağlantı adresi alınıyor (yaklaşık 5 sn).</div>
            </div>
            <div style="font-size: 1.2rem;">⏳</div>
          </div>
        `;
      } else if (this.tunnelState.active && this.tunnelState.url) {
        box.innerHTML = `
          <div style="background: #ECFDF5; border: 1px solid #6EE7B7; padding: 10px 14px; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="overflow: hidden; flex: 1;">
              <div style="font-weight: 800; color: #065F46; font-size: 0.88rem;">🟢 Canlı İnternet Tüneli Aktif (4G/5G Uyumlu)</div>
              <div style="font-size: 0.76rem; color: #047857; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${this.tunnelState.url}</div>
            </div>
            <button class="btn-secondary" style="padding: 5px 12px; font-size: 0.78rem; white-space: nowrap;" onclick="app.stopCloudflareTunnel()">⏹️ Kapat</button>
          </div>
        `;
      } else {
        box.innerHTML = `
          <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 10px 14px; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 800; color: #991B1B; font-size: 0.88rem;">🔴 Canlı İnternet Tüneli Kapalı</div>
              <div style="font-size: 0.76rem; color: #B91C1C;">Müşterilerin 4G/5G ile açabilmesi için tüneli başlatın veya Wi-Fi moduna geçin.</div>
            </div>
            <button class="btn-primary" style="padding: 6px 12px; font-size: 0.82rem; background: #EF4444; white-space: nowrap;" onclick="app.startCloudflareTunnel()">🚀 Tüneli Başlat</button>
          </div>
        `;
      }
    } else if (this.qrMode === 'wifi') {
      const ip = (this.tunnelState && this.tunnelState.local_ip) ? this.tunnelState.local_ip : window.location.hostname;
      box.innerHTML = `
        <div style="background: #EFF6FF; border: 1px solid #93C5FD; padding: 10px 14px; border-radius: 10px; text-align: left;">
          <div style="font-weight: 800; color: #1E40AF; font-size: 0.88rem;">📶 Dükkan Wi-Fi Ağı (Yerel Bağlantı)</div>
          <div style="font-size: 0.76rem; color: #2563EB;">Müşteri veya personel telefonu dükkan Wi-Fi'ına bağlıyken <strong>tünelsiz ve anında</strong> çalışır.</div>
          <div style="font-size: 0.76rem; color: #64748B; margin-top: 3px;">Kasa Yerel Adresi: <strong>http://${ip}:8000/qr</strong></div>
        </div>
      `;
    }
  }

  getQRTargetUrl(tableName) {
    if (this.qrMode === 'custom') {
      const customDomainInput = document.getElementById('qr-custom-domain');
      let base = customDomainInput && customDomainInput.value.trim() ? customDomainInput.value.trim() : ((this.storeSettings && this.storeSettings.qr_custom_domain) || localStorage.getItem('oses_qr_domain') || 'https://osesbaglar.onrender.com');
      if (base.includes('vercel.app')) {
        base = 'https://osesbaglar.onrender.com';
        localStorage.setItem('oses_qr_domain', base);
      }
      if (base) {
        localStorage.setItem('oses_qr_domain', base);
        base = base.split('?')[0].replace(/\/+$/, '');
        if (!base.endsWith('/qr')) base = `${base}/qr`;
        return `${base}?masa=${encodeURIComponent(tableName)}`;
      }
    }

    if (this.qrMode === 'wifi') {
      const ip = (this.tunnelState && this.tunnelState.local_ip) ? this.tunnelState.local_ip : window.location.hostname;
      return `http://${ip}:8000/qr?masa=${encodeURIComponent(tableName)}`;
    }

    // Default: Tunnel mode
    if (this.tunnelState && this.tunnelState.active && this.tunnelState.url) {
      let base = this.tunnelState.url.split('?')[0].replace(/\/+$/, '');
      if (!base.endsWith('/qr')) base = `${base}/qr`;
      return `${base}?masa=${encodeURIComponent(tableName)}`;
    }

    // Fallback to custom Render .com domain if available
    const fallbackDomain = (this.storeSettings && this.storeSettings.qr_custom_domain) || 'https://osesbaglar.onrender.com';
    return `${fallbackDomain}/qr?masa=${encodeURIComponent(tableName)}`;
  }

  updateQRGeneratorPreview() {
    const tableSelect = document.getElementById('qr-table-select');
    const selectedTable = tableSelect ? tableSelect.value : 'Masa1';
    const qrUrl = this.getQRTargetUrl(selectedTable);

    this.activeQRUrl = qrUrl;
    this.activeQRTableName = selectedTable;

    const imgContainer = document.getElementById('qr-code-img-container');
    const urlText = document.getElementById('qr-url-text');

    if (urlText) urlText.innerText = qrUrl;
    if (imgContainer) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=15&data=${encodeURIComponent(qrUrl)}`;
      imgContainer.innerHTML = `
        <img src="${qrApiUrl}" alt="QR Menü" style="width:200px; height:200px; border-radius:8px; display:block; margin:0 auto;" />
        <div style="margin-top:10px; background:#F8FAFC; border:1px solid #CBD5E1; border-radius:10px; padding:10px; text-align:left; font-size:0.77rem; line-height:1.45; color:#334155;">
          <div style="font-weight:800; color:#0F172A; margin-bottom:4px; display:flex; align-items:center; gap:5px;">
            <span>📱</span> <span>MÜŞTERİ KULLANIM & KOPYALAMA REHBERİ:</span>
          </div>
          <div style="margin-bottom:3px;">
            • <strong>Normal Kamera:</strong> Kamerayı karekoda tutun, ekranda çıkan <u>linke / baloncuga</u> dokunun.
          </div>
          <div style="color:#92400E; background:#FEF3C7; padding:5px 8px; border-radius:6px; margin-top:4px; font-weight:600;">
            ⚠️ <strong>Xiaomi veya "Metin (T) / Ara" çıkan telefonlarda:</strong><br>
            Alttaki <strong>"Metni Kopyala"</strong> butonuna basın, Chrome veya Safari tarayıcınıza yapıştırarak menüyü hemen açın. <em>(Google'da aratmayın)</em>
          </div>
        </div>
      `;
    }
  }

  printQRCodeSticker() {
    const tableName = this.activeQRTableName || 'Masa 1';
    const qrUrl = this.activeQRUrl || this.getQRTargetUrl(tableName);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=15&data=${encodeURIComponent(qrUrl)}`;

    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div style="font-family: sans-serif; text-align: center; padding: 20px; width: 80mm; margin: 0 auto; border: 2px dashed #000;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 2px;">🌶️ O SES ÇİĞKÖFTE</h2>
        <div style="font-size: 1.2rem; font-weight: 800; color: #D32F2F; margin: 6px 0; background: #F8FAFC; padding: 6px; border-radius: 8px;">
          🪑 ${tableName.toUpperCase()}
        </div>
        <p style="font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">📱 KAREKOD İLE MASADAN SİPARİŞ</p>
        <img src="${qrApiUrl}" style="width: 170px; height: 170px; margin: 6px 0;" />
        <p style="font-size: 0.72rem; font-weight: 700; margin-top: 2px; word-break: break-all; color: #D32F2F;">${qrUrl}</p>
        
        <div style="margin-top: 8px; border-top: 1px dashed #64748B; padding-top: 6px; font-size: 0.74rem; color: #1E293B; line-height: 1.35; text-align: left; background: #F8FAFC; padding: 6px 8px; border-radius: 6px;">
          <p style="font-weight: 800; color: #0F172A; text-align: center; margin-bottom: 3px;">📲 NASIL SİPARİŞ VERİLİR?</p>
          <p>1. Kameranızı karekoda tutun ve çıkan <strong>linke</strong> dokunun.</p>
          <p>2. Ekranda "Metin (T)" çıkarsa <strong>"Metni Kopyala"</strong> deyip tarayıcınıza (Chrome/Safari) yapıştırın.</p>
        </div>
      </div>
    `;

    window.print();
  }

  printAllTableQRStickers() {
    const tables = ['Masa1', 'Masa2', 'Masa3', 'Masa4', 'Masa5', 'Masa6', 'Masa7', 'Masa8', 'Masa9', 'Masa10', 'Tezgah'];
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    let html = '';
    tables.forEach(table => {
      const qrUrl = this.getQRTargetUrl(table);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=15&data=${encodeURIComponent(qrUrl)}`;
      html += `
        <div style="font-family: sans-serif; text-align: center; padding: 20px; width: 80mm; margin: 0 auto 20px auto; border: 2px dashed #000; page-break-after: always;">
          <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 2px;">🌶️ O SES ÇİĞKÖFTE</h2>
          <div style="font-size: 1.2rem; font-weight: 800; color: #D32F2F; margin: 6px 0; background: #F8FAFC; padding: 6px; border-radius: 8px;">
            🪑 ${table.toUpperCase()}
          </div>
          <p style="font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">📱 KAREKOD İLE MASADAN SİPARİŞ</p>
          <img src="${qrApiUrl}" style="width: 170px; height: 170px; margin: 6px 0;" />
          <p style="font-size: 0.72rem; font-weight: 700; margin-top: 2px; word-break: break-all; color: #D32F2F;">${qrUrl}</p>
          
          <div style="margin-top: 8px; border-top: 1px dashed #64748B; padding-top: 6px; font-size: 0.74rem; color: #1E293B; line-height: 1.35; text-align: left; background: #F8FAFC; padding: 6px 8px; border-radius: 6px;">
            <p style="font-weight: 800; color: #0F172A; text-align: center; margin-bottom: 3px;">📲 NASIL SİPARİŞ VERİLİR?</p>
            <p>1. Kameranızı karekoda tutun ve çıkan <strong>linke</strong> dokunun.</p>
            <p>2. Ekranda "Metin (T)" çıkarsa <strong>"Metni Kopyala"</strong> deyip tarayıcınıza (Chrome/Safari) yapıştırın.</p>
          </div>
        </div>
      `;
    });

    printArea.innerHTML = html;
    window.print();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  resetToHome() {
    this.activeCategory = 'ALL';
    this.clearSelectedCustomer();
    const input = document.getElementById('customer-phone-input');
    if (input) input.value = '';
    this.renderCategoryTabs();
    this.renderProductGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.showToast('Ana sayfaya dönüldü 🏠', 'info');
  }

  // --- ADMIN SECURITY & PIN PROTECTION SYSTEM ---

  isAdminSessionActive() {
    return Date.now() < this.adminSessionExpiry;
  }

  unlockAdminSession(minutes = 30) {
    this.adminSessionExpiry = Date.now() + (minutes * 60 * 1000);
    this.updateAdminSessionUI();
  }

  lockAdminSession() {
    this.adminSessionExpiry = 0;
    this.updateAdminSessionUI();
    this.showToast('Yönetici oturumu kilitlendi 🔒', 'info');
  }

  toggleAdminSessionManual() {
    if (this.isAdminSessionActive()) {
      this.lockAdminSession();
    } else {
      this.requireAdminAuth(() => {
        this.showToast('Yönetici oturumu açıldı (30 Dk yetkili) 🔓', 'success');
      }, 'Yönetici Oturumu Açma');
    }
  }

  updateAdminSessionUI() {
    const badge = document.getElementById('admin-session-badge');
    if (!badge) return;

    if (this.isAdminSessionActive()) {
      const remainingMins = Math.ceil((this.adminSessionExpiry - Date.now()) / 60000);
      badge.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
      badge.style.border = '1px solid rgba(255, 255, 255, 0.3)';
      badge.style.color = '#FFFFFF';
      badge.innerHTML = `🔓 Yetkili (${remainingMins} dk)`;
    } else {
      badge.style.background = 'rgba(239, 68, 68, 0.25)';
      badge.style.border = '1px solid rgba(239, 68, 68, 0.5)';
      badge.style.color = '#FCA5A5';
      badge.innerHTML = `🔒 Kilitli`;
    }
  }

  requireAdminAuth(actionCallback, actionName = 'Yönetici Korumalı İşlem') {
    if (this.isAdminSessionActive()) {
      if (typeof actionCallback === 'function') actionCallback();
      return;
    }

    this.pendingAdminAction = actionCallback;
    this.currentPinInput = '';

    const input = document.getElementById('pin-lock-input');
    if (input) input.value = '';

    const subtitleEl = document.getElementById('pin-modal-subtitle');
    if (subtitleEl) {
      subtitleEl.innerHTML = `Lütfen <strong>"${actionName}"</strong> işlemi için Yönetici Şifrenizi girin:`;
    }

    this.openModal('modal-pin-lock');

    setTimeout(() => {
      if (input) input.focus();
    }, 150);
  }

  syncPinTextInput(val) {
    this.currentPinInput = val;
  }

  appendPinDigit(digit) {
    if (this.currentPinInput.length < 16) {
      this.currentPinInput += digit;
      const input = document.getElementById('pin-lock-input');
      if (input) input.value = this.currentPinInput;
    }
  }

  deletePinDigit() {
    if (this.currentPinInput.length > 0) {
      this.currentPinInput = this.currentPinInput.slice(0, -1);
      const input = document.getElementById('pin-lock-input');
      if (input) input.value = this.currentPinInput;
    }
  }

  clearPinInput() {
    this.currentPinInput = '';
    const input = document.getElementById('pin-lock-input');
    if (input) input.value = '';
  }

  async submitPinVerification() {
    const input = document.getElementById('pin-lock-input');
    const pin = input ? input.value : this.currentPinInput;

    if (!pin) {
      this.showToast('Lütfen şifrenizi girin.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
      });
      const data = await res.json();

      if (data.status === 'success' && data.valid) {
        this.unlockAdminSession(30);
        this.closeModal('modal-pin-lock');
        this.clearPinInput();
        this.showToast('Yönetici oturumu açıldı! (30 Dakika Geçerli) 🔓', 'success');
        if (typeof this.pendingAdminAction === 'function') {
          const cb = this.pendingAdminAction;
          this.pendingAdminAction = null;
          cb();
        }
      } else {
        this.showToast('Hatalı Yönetici Şifresi! 🔒', 'error');
        this.clearPinInput();
      }
    } catch (err) {
      this.showToast('Şifre doğrulama hatası', 'error');
    }
  }

  openChangePinModal() {
    const currInput = document.getElementById('pin-change-current');
    const newInput = document.getElementById('pin-change-new');
    const confirmInput = document.getElementById('pin-change-confirm');
    if (currInput) currInput.value = '';
    if (newInput) newInput.value = '';
    if (confirmInput) confirmInput.value = '';
    this.openModal('modal-change-pin');
  }

  async submitChangePin() {
    const currentPin = document.getElementById('pin-change-current')?.value || '';
    const newPin = document.getElementById('pin-change-new')?.value || '';
    const confirmPin = document.getElementById('pin-change-confirm')?.value || '';

    if (!currentPin) {
      this.showToast('Lütfen mevcut şifrenizi girin.', 'error');
      return;
    }
    if (!newPin || newPin.length < 4) {
      this.showToast('Yeni şifre en az 4 karakter olmalıdır.', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      this.showToast('Yeni şifreler uyuşmuyor!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        this.showToast('Yönetici şifreniz başarıyla güncellendi! 🔑', 'success');
        this.closeModal('modal-change-pin');
        this.fetchStoreSettings();
      } else {
        this.showToast(data.detail || data.message || 'Şifre değiştirilemedi!', 'error');
      }
    } catch (err) {
      this.showToast('Şifre değiştirme sırasında hata oluştu.', 'error');
    }
  }

  async resetAdminPinToDefault() {
    if (!confirm('Yönetici şifreniz varsayılan şifreye sıfırlansın mı?')) {
      return;
    }

    try {
      const res = await fetch('/api/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        this.showToast('Yönetici şifresi varsayılana sıfırlandı! 🔄', 'success');
        this.fetchStoreSettings();
      } else {
        this.showToast(data.detail || data.message || 'Şifre sıfırlanamadı!', 'error');
      }
    } catch (err) {
      this.showToast('Şifre sıfırlama sırasında hata oluştu.', 'error');
    }
  }

  // --- BRAND & STORE SETTINGS MANAGEMENT ---

  async fetchStoreSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      this.storeSettings = data || {};
      this.applyStoreSettings();
    } catch (err) {
      console.error('Ayarlar yükleme hatası:', err);
    }
  }

  applyStoreSettings() {
    if (!this.storeSettings) return;

    const nameEl = document.getElementById('header-store-name');
    const subEl = document.getElementById('header-store-subtitle');
    const logoContainer = document.getElementById('header-brand-logo-container');

    if (nameEl && this.storeSettings.store_name) {
      nameEl.innerText = this.storeSettings.store_name;
    }
    if (subEl && this.storeSettings.store_subtitle) {
      subEl.innerText = this.storeSettings.store_subtitle;
    }
    if (logoContainer) {
      if (this.storeSettings.store_logo_url) {
        logoContainer.innerHTML = `<img src="${this.storeSettings.store_logo_url}" style="height:38px; max-width:130px; object-fit:contain; border-radius:6px; vertical-align:middle;" />`;
      } else {
        logoContainer.innerHTML = '🌶️';
      }
    }
  }

  openStoreSettingsModal() {
    this.requireAdminAuth(() => this._openStoreSettingsModalInternal(), 'Marka & Logo Ayarları');
  }

  toggleGmp3SettingsUI(val) {
    const ipBox = document.getElementById('gmp3-ip-box');
    const serialBox = document.getElementById('gmp3-serial-box');
    if (ipBox) ipBox.style.display = (val === 'IP') ? 'flex' : 'none';
    if (serialBox) serialBox.style.display = (val === 'SERIAL') ? 'block' : 'none';
  }

  _openStoreSettingsModalInternal() {
    const nameInput = document.getElementById('setting-store-name');
    const subInput = document.getElementById('setting-store-subtitle');
    const previewBox = document.getElementById('setting-logo-preview-box');

    const connTypeSelect = document.getElementById('setting-gmp3-conn-type');
    const ipInput = document.getElementById('setting-gmp3-ip');
    const portInput = document.getElementById('setting-gmp3-port');
    const comInput = document.getElementById('setting-gmp3-com');

    if (nameInput) nameInput.value = this.storeSettings.store_name || 'O SES ÇİĞKÖFTE';
    if (subInput) subInput.value = this.storeSettings.store_subtitle || 'HIZLI KASA & ADİSYON POS';

    if (connTypeSelect) connTypeSelect.value = this.storeSettings.gmp3_connection_type || 'SIMULATION';
    if (ipInput) ipInput.value = this.storeSettings.gmp3_ip || '192.168.1.100';
    if (portInput) portInput.value = this.storeSettings.gmp3_port || '9090';
    if (comInput) comInput.value = this.storeSettings.gmp3_com_port || 'COM3';

    this.toggleGmp3SettingsUI(this.storeSettings.gmp3_connection_type || 'SIMULATION');

    if (previewBox) {
      if (this.storeSettings.store_logo_url) {
        previewBox.innerHTML = `<img src="${this.storeSettings.store_logo_url}" style="max-width:100%; max-height:100%; object-fit:contain;" />`;
      } else {
        previewBox.innerHTML = '🌶️';
      }
    }

    this.openModal('modal-store-settings');
  }

  async saveStoreSettings(notify = true) {
    const storeName = document.getElementById('setting-store-name')?.value.trim() || 'O SES ÇİĞKÖFTE';
    const storeSubtitle = document.getElementById('setting-store-subtitle')?.value.trim() || 'HIZLI KASA & ADİSYON POS';
    const logoUrl = this.storeSettings.store_logo_url || '';

    const connType = document.getElementById('setting-gmp3-conn-type')?.value || 'SIMULATION';
    const ipVal = document.getElementById('setting-gmp3-ip')?.value.trim() || '192.168.1.100';
    const portVal = document.getElementById('setting-gmp3-port')?.value.trim() || '9090';
    const comVal = document.getElementById('setting-gmp3-com')?.value.trim() || 'COM3';

    const payload = {
      store_name: storeName,
      store_subtitle: storeSubtitle,
      store_logo_url: logoUrl,
      gmp3_enabled: "1",
      gmp3_connection_type: connType,
      gmp3_ip: ipVal,
      gmp3_port: portVal,
      gmp3_com_port: comVal
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      this.storeSettings = data;
      this.applyStoreSettings();
      if (notify) {
        this.showToast('Ayarlar ve inPOS m530 entegrasyonu kaydedildi!', 'success');
        this.closeModal('modal-store-settings');
      }
    } catch (err) {
      this.showToast('Ayarlar kaydedilemedi.', 'error');
    }
  }

  removeStoreLogo() {
    this.storeSettings.store_logo_url = '';
    const previewBox = document.getElementById('setting-logo-preview-box');
    if (previewBox) previewBox.innerHTML = '🌶️';
  }

  // --- INTERACTIVE CANVAS IMAGE CROPPER & STUDIO ENGINE ---

  openCropperForLogo() {
    this.cropperState = {
      targetType: 'LOGO',
      productId: null,
      image: null,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0
    };
    this.resetCropperUI('Marka Logosu Düzenleme Studio');
    this.openModal('modal-image-cropper');
  }

  openCropperForProduct(productId) {
    this.cropperState = {
      targetType: 'PRODUCT',
      productId: productId,
      image: null,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0
    };
    this.resetCropperUI('Ürün Fotoğrafı Düzenleme Studio');
    this.openModal('modal-image-cropper');
  }

  openCropperForCurrentEditProduct() {
    const pId = document.getElementById('edit-p-id')?.value;
    this.cropperState = {
      targetType: 'PRODUCT_FORM',
      productId: pId ? parseInt(pId) : null,
      image: null,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0
    };
    this.resetCropperUI('Ürün Fotoğrafı Düzenleme Studio');
    this.openModal('modal-image-cropper');
  }

  resetCropperUI(title) {
    const titleEl = document.getElementById('cropper-modal-title');
    if (titleEl) titleEl.innerText = `📸 ${title}`;

    document.getElementById('cropper-workspace').style.display = 'none';
    document.getElementById('cropper-placeholder').style.display = 'block';
    document.getElementById('cropper-save-btn').disabled = true;
    document.getElementById('cropper-file-input').value = '';
  }

  handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.cropperState.image = img;
        this.cropperState.scale = 1.0;
        this.cropperState.offsetX = 0;
        this.cropperState.offsetY = 0;
        this.cropperState.rotation = 0;

        document.getElementById('cropper-workspace').style.display = 'block';
        document.getElementById('cropper-placeholder').style.display = 'none';
        document.getElementById('cropper-save-btn').disabled = false;
        document.getElementById('cropper-zoom-slider').value = 1.0;
        document.getElementById('cropper-zoom-text').innerText = '1.0x';

        this.renderCropperCanvas();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  renderCropperCanvas() {
    const canvas = document.getElementById('cropper-canvas');
    if (!canvas || !this.cropperState || !this.cropperState.image) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const img = this.cropperState.image;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Center translation
    ctx.translate(width / 2 + this.cropperState.offsetX, height / 2 + this.cropperState.offsetY);
    ctx.rotate((this.cropperState.rotation * Math.PI) / 180);
    ctx.scale(this.cropperState.scale, this.cropperState.scale);

    // Aspect ratio fit
    const imgAspect = img.width / img.height;
    let drawW = width;
    let drawH = height;
    if (imgAspect > 1) {
      drawH = width / imgAspect;
    } else {
      drawW = height * imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  startCropperDrag(e) {
    if (!this.cropperState || !this.cropperState.image) return;
    this.cropperState.isDragging = true;
    this.cropperState.dragStartX = e.clientX;
    this.cropperState.dragStartY = e.clientY;
    const box = document.getElementById('cropper-canvas-box');
    if (box) box.style.cursor = 'grabbing';
  }

  doCropperDrag(e) {
    if (!this.cropperState || !this.cropperState.isDragging) return;
    const dx = e.clientX - this.cropperState.dragStartX;
    const dy = e.clientY - this.cropperState.dragStartY;
    this.cropperState.dragStartX = e.clientX;
    this.cropperState.dragStartY = e.clientY;
    this.cropperState.offsetX += dx;
    this.cropperState.offsetY += dy;
    this.renderCropperCanvas();
  }

  stopCropperDrag() {
    if (this.cropperState) {
      this.cropperState.isDragging = false;
      const box = document.getElementById('cropper-canvas-box');
      if (box) box.style.cursor = 'grab';
    }
  }

  handleCropperWheel(e) {
    e.preventDefault();
    if (!this.cropperState || !this.cropperState.image) return;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    let newZoom = Math.min(Math.max(this.cropperState.scale + delta, 0.2), 4.0);
    this.updateCropperZoom(newZoom);
    const slider = document.getElementById('cropper-zoom-slider');
    if (slider) slider.value = newZoom;
  }

  updateCropperZoom(zoomVal) {
    if (!this.cropperState) return;
    this.cropperState.scale = parseFloat(zoomVal);
    const textEl = document.getElementById('cropper-zoom-text');
    if (textEl) textEl.innerText = `${parseFloat(zoomVal).toFixed(1)}x`;
    this.renderCropperCanvas();
  }

  rotateCropperImage(deg) {
    if (!this.cropperState) return;
    this.cropperState.rotation = (this.cropperState.rotation + deg) % 360;
    this.renderCropperCanvas();
  }

  async removeCropperTargetImage() {
    if (!this.cropperState) return;

    if (this.cropperState.targetType === 'LOGO') {
      this.removeStoreLogo();
      await this.saveStoreSettings(false);
      this.showToast('Marka logosu kaldırıldı.', 'info');
    } else if (this.cropperState.targetType === 'PRODUCT' && this.cropperState.productId) {
      await fetch(`/api/products/${this.cropperState.productId}/image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: '' })
      });
      await this.fetchProducts();
      this.renderProductGrid();
      await this.renderAdminProductsTable();
      this.showToast('Ürün fotoğrafı silindi.', 'info');
    } else if (this.cropperState.targetType === 'PRODUCT_FORM') {
      this.clearEditProductImage();
      this.showToast('Fotoğraf kaldırıldı.', 'info');
    }

    this.closeModal('modal-image-cropper');
  }

  async saveCroppedImage() {
    const canvas = document.getElementById('cropper-canvas');
    if (!canvas || !this.cropperState || !this.cropperState.image) return;

    const dataUrl = canvas.toDataURL('image/png', 0.9);

    try {
      this.showToast('Görsel sunucuya işleniyor...', 'info');
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: dataUrl })
      });
      const data = await res.json();

      if (data.status === 'success' && data.url) {
        const uploadedUrl = data.url;

        if (this.cropperState.targetType === 'LOGO') {
          this.storeSettings.store_logo_url = uploadedUrl;
          const box = document.getElementById('setting-logo-preview-box');
          if (box) box.innerHTML = `<img src="${uploadedUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />`;
          await this.saveStoreSettings(false);
          this.showToast('Marka logosu güncellendi!', 'success');
        } else if (this.cropperState.targetType === 'PRODUCT' && this.cropperState.productId) {
          await fetch(`/api/products/${this.cropperState.productId}/image`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: uploadedUrl })
          });
          await this.fetchProducts();
          this.renderProductGrid();
          await this.renderAdminProductsTable();
          this.showToast('Ürün fotoğrafı güncellendi!', 'success');
        } else if (this.cropperState.targetType === 'PRODUCT_FORM') {
          const input = document.getElementById('edit-p-image-url');
          if (input) input.value = uploadedUrl;
          const preview = document.getElementById('edit-p-image-preview');
          if (preview) preview.innerHTML = `<img src="${uploadedUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" />`;
          this.showToast('Görsel forma eklendi!', 'success');
        }

        this.closeModal('modal-image-cropper');
      } else {
        this.showToast('Görsel yüklenemedi.', 'error');
      }
    } catch (err) {
      this.showToast('Yükleme hatası oluştu.', 'error');
    }
  }
}

// Global App Instance
const app = new POSApp();
