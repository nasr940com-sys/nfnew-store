// ============================================================
// NF Store — storefront logic
// ============================================================

let allProducts = [];
let allCategories = [];
let activeCategory = 'all';
let cart = JSON.parse(localStorage.getItem('nf_cart') || '[]');
let settings = {};

const fmt = (n) => Number(n).toFixed(3) + ' ر.ع';

function saveCart() {
  localStorage.setItem('nf_cart', JSON.stringify(cart));
  renderCart();
}

// ---------- Load data ----------
async function loadStore() {
  const [{ data: categories }, { data: products }, { data: settingsRow }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('store_settings').select('*').eq('id', 1).single(),
  ]);

  allCategories = categories || [];
  allProducts = products || [];
  settings = settingsRow || {};

  renderCategoryNav();
  renderProducts();
  applySettings();
}

function applySettings() {
  const wa = document.getElementById('whatsappLink');
  if (settings.whatsapp_number) {
    wa.href = `https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`;
  } else {
    wa.style.display = 'none';
  }

  const bankInfo = document.getElementById('bankInfo');
  bankInfo.innerHTML = `
    <div><span>البنك</span><b>${settings.bank_name || '—'}</b></div>
    <div><span>اسم الحساب</span><b>${settings.bank_account_name || '—'}</b></div>
    <div><span>الآيبان</span><b>${settings.bank_iban || '—'}</b></div>
  `;

  const onlineLink = document.getElementById('onlinePayLink');
  if (settings.online_payment_link) {
    onlineLink.href = settings.online_payment_link;
  }
}

// ---------- Render ----------
function renderCategoryNav() {
  const nav = document.getElementById('categoryNav');
  nav.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'nav-pill' + (activeCategory === 'all' ? ' active' : '');
  allBtn.textContent = 'الكل';
  allBtn.onclick = () => { activeCategory = 'all'; renderCategoryNav(); renderProducts(); };
  nav.appendChild(allBtn);

  allCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'nav-pill' + (activeCategory === cat.id ? ' active' : '');
    btn.textContent = cat.name;
    btn.onclick = () => { activeCategory = cat.id; renderCategoryNav(); renderProducts(); };
    nav.appendChild(btn);
  });
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const list = activeCategory === 'all'
    ? allProducts
    : allProducts.filter(p => p.category_id === activeCategory);

  grid.innerHTML = '';
  empty.hidden = list.length > 0;

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-img">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">`
          : `<span class="product-img-fallback">${p.name.slice(0,2)}</span>`}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
        <div class="product-price-row">
          <span class="price">${fmt(p.price_omr)}</span>
          ${p.compare_at_price_omr ? `<span class="price-compare">${fmt(p.compare_at_price_omr)}</span>` : ''}
        </div>
        <button class="add-to-cart-btn" ${p.stock <= 0 ? 'disabled' : ''}>
          ${p.stock <= 0 ? 'غير متوفر' : 'إضافة للسلة'}
        </button>
      </div>
    `;
    card.querySelector('.add-to-cart-btn').onclick = () => addToCart(p);
    grid.appendChild(card);
  });
}

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price_omr, qty: 1 });
  }
  saveCart();
  openCart();
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const countEl = document.getElementById('cartCount');

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  countEl.textContent = totalQty;
  totalEl.textContent = fmt(total);

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">سلتك فارغة</p>';
    return;
  }

  itemsEl.innerHTML = '';
  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" data-action="dec">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" data-action="inc">+</button>
      </div>
    `;
    row.querySelector('[data-action="dec"]').onclick = () => changeQty(item.id, -1);
    row.querySelector('[data-action="inc"]').onclick = () => changeQty(item.id, 1);
    itemsEl.appendChild(row);
  });
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
}

// ---------- Cart drawer ----------
const overlay = document.getElementById('overlay');
const cartPanel = document.getElementById('cartPanel');

function openCart() {
  cartPanel.hidden = false;
  overlay.hidden = false;
}
function closeCart() {
  cartPanel.hidden = true;
  overlay.hidden = true;
}
document.getElementById('cartBtn').onclick = openCart;
document.getElementById('closeCart').onclick = closeCart;
overlay.onclick = closeCart;

// ---------- Checkout modal ----------
const checkoutOverlay = document.getElementById('checkoutOverlay');
const checkoutModal = document.getElementById('checkoutModal');

document.getElementById('checkoutBtn').onclick = () => {
  if (cart.length === 0) return;
  closeCart();
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  document.getElementById('checkoutTotal').textContent = fmt(total);
  checkoutModal.hidden = false;
  checkoutOverlay.hidden = false;
};

function closeCheckout() {
  checkoutModal.hidden = true;
  checkoutOverlay.hidden = true;
}
document.getElementById('closeCheckout').onclick = closeCheckout;
checkoutOverlay.onclick = closeCheckout;

// Toggle payment method sections
document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
  radio.onchange = () => {
    document.getElementById('bankDetails').hidden = radio.value !== 'bank_transfer' || !radio.checked;
    document.getElementById('onlineDetails').hidden = radio.value !== 'online_link' || !radio.checked;
  };
});

// ---------- Submit order ----------
document.getElementById('checkoutForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('submitOrderBtn');
  const errorEl = document.getElementById('checkoutError');
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري الإرسال...';

  try {
    const formData = new FormData(form);
    const paymentMethod = formData.get('payment_method');
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

    let proofUrl = null;
    const proofFile = document.getElementById('proofInput').files[0];
    if (paymentMethod === 'bank_transfer' && proofFile) {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile);
      if (uploadError) throw new Error('تعذر رفع ملف الإيصال. حاول مرة ثانية.');
      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
      proofUrl = urlData.publicUrl;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: formData.get('customer_name'),
        customer_phone: formData.get('customer_phone'),
        customer_email: formData.get('customer_email') || null,
        payment_method: paymentMethod,
        proof_url: proofUrl,
        reference_note: paymentMethod === 'online_link' ? formData.get('reference_note') : null,
        total_omr: total,
      })
      .select()
      .single();

    if (orderError) throw new Error('تعذر إنشاء الطلب. حاول مرة ثانية.');

    const items = cart.map(i => ({
      order_id: order.id,
      product_id: i.id,
      product_name: i.name,
      unit_price_omr: i.price,
      quantity: i.qty,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(items);
    if (itemsError) throw new Error('تم إنشاء الطلب لكن حدث خطأ بإضافة المنتجات. تواصل معنا.');

    // Success
    cart = [];
    saveCart();
    closeCheckout();
    form.reset();
    document.getElementById('successOrderNumber').textContent = order.order_number;
    document.getElementById('successModal').hidden = false;
    document.getElementById('successOverlay').hidden = false;

  } catch (err) {
    errorEl.textContent = err.message || 'حدث خطأ غير متوقع. حاول مرة ثانية.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'تأكيد الطلب';
  }
};

document.getElementById('closeSuccess').onclick = () => {
  document.getElementById('successModal').hidden = true;
  document.getElementById('successOverlay').hidden = true;
};

// ---------- Init ----------
renderCart();
loadStore();
