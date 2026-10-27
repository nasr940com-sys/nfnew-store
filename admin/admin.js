// ============================================================
// NF Store — admin dashboard logic
// ============================================================

const fmt = (n) => Number(n).toFixed(3) + ' ر.ع';
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ar-OM', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let currentOrders = [];
let currentProducts = [];
let currentCategories = [];
let orderFilter = 'all';

// ---------- Auth guard ----------
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .single();

  if (!adminRow) {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  initDashboard();
})();

document.getElementById('logoutBtn').onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
};

// ---------- Tab switching ----------
document.querySelectorAll('.admin-nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-tab').forEach(t => t.hidden = true);
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  };
});

// ---------- Init ----------
async function initDashboard() {
  await Promise.all([loadOrders(), loadProducts(), loadCategories(), loadSettings()]);
}

// ============================================================
// ORDERS
// ============================================================
async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  currentOrders = data || [];
  renderOrders();
}

function renderOrders() {
  const list = document.getElementById('ordersList');
  const filtered = orderFilter === 'all'
    ? currentOrders
    : currentOrders.filter(o => o.payment_status === orderFilter);

  const pendingCount = currentOrders.filter(o => o.payment_status === 'pending' || o.payment_status === 'under_review').length;
  const badge = document.getElementById('pendingBadge');
  if (pendingCount > 0) { badge.textContent = pendingCount; badge.hidden = false; } else { badge.hidden = true; }

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-dim);text-align:center;padding:40px 0;">ما فيه طلبات</p>';
    return;
  }

  filtered.forEach(order => {
    const statusLabels = { pending: 'قيد الانتظار', under_review: 'قيد المراجعة', confirmed: 'مؤكد', rejected: 'مرفوض' };
    const row = document.createElement('div');
    row.className = 'order-row';
    row.innerHTML = `
      <div class="order-main">
        <span class="order-number">${order.order_number}</span>
        <span class="order-customer">${order.customer_name} — ${order.customer_phone}</span>
      </div>
      <div class="order-meta">
        <span class="badge badge-${order.payment_status === 'pending' ? 'pending' : order.payment_status === 'under_review' ? 'review' : order.payment_status === 'confirmed' ? 'confirmed' : 'rejected'}">${statusLabels[order.payment_status]}</span>
        <span class="order-total">${fmt(order.total_omr)}</span>
        <span class="order-date">${fmtDate(order.created_at)}</span>
      </div>
    `;
    row.onclick = () => openOrderDetail(order);
    list.appendChild(row);
  });
}

document.querySelectorAll('#orderFilters .filter-pill').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#orderFilters .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderFilter = btn.dataset.filter;
    renderOrders();
  };
});

function openOrderDetail(order) {
  document.getElementById('orderModalTitle').textContent = `طلب ${order.order_number}`;
  const body = document.getElementById('orderModalBody');

  const itemsHtml = order.order_items.map(i => `
    <div class="order-item-row">
      <span>${i.product_name} × ${i.quantity}</span>
      <span>${fmt(i.unit_price_omr * i.quantity)}</span>
    </div>
  `).join('');

  const paymentMethodLabel = order.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'دفع إلكتروني';

  body.innerHTML = `
    <div class="order-detail-section">
      <h4>بيانات العميل</h4>
      <div class="order-detail-row"><span>الاسم</span><b>${order.customer_name}</b></div>
      <div class="order-detail-row"><span>الهاتف</span><b>${order.customer_phone}</b></div>
      ${order.customer_email ? `<div class="order-detail-row"><span>البريد</span><b>${order.customer_email}</b></div>` : ''}
    </div>
    <div class="order-detail-section">
      <h4>المنتجات</h4>
      <div class="order-items-list">${itemsHtml}</div>
    </div>
    <div class="order-detail-section">
      <h4>الدفع</h4>
      <div class="order-detail-row"><span>الطريقة</span><b>${paymentMethodLabel}</b></div>
      <div class="order-detail-row"><span>الإجمالي</span><b>${fmt(order.total_omr)}</b></div>
      ${order.reference_note ? `<div class="order-detail-row"><span>رقم العملية</span><b>${order.reference_note}</b></div>` : ''}
      ${order.proof_url ? `<a href="${order.proof_url}" target="_blank" class="proof-link">عرض إيصال التحويل ↗</a>` : ''}
    </div>
    <div class="status-actions">
      <button class="status-btn confirm" data-status="confirmed">تأكيد الدفع</button>
      <button class="status-btn reject" data-status="rejected">رفض</button>
      <button class="status-btn" data-status="under_review">قيد المراجعة</button>
      ${order.order_status !== 'delivered' ? '<button class="status-btn deliver" data-order-status="delivered">تم التسليم</button>' : ''}
    </div>
  `;

  body.querySelectorAll('[data-status]').forEach(btn => {
    btn.onclick = async () => {
      await supabase.from('orders').update({ payment_status: btn.dataset.status }).eq('id', order.id);
      closeOrderModal();
      loadOrders();
    };
  });
  body.querySelectorAll('[data-order-status]').forEach(btn => {
    btn.onclick = async () => {
      await supabase.from('orders').update({ order_status: btn.dataset.orderStatus }).eq('id', order.id);
      closeOrderModal();
      loadOrders();
    };
  });

  document.getElementById('orderModal').hidden = false;
  document.getElementById('orderOverlay').hidden = false;
}

function closeOrderModal() {
  document.getElementById('orderModal').hidden = true;
  document.getElementById('orderOverlay').hidden = true;
}
document.getElementById('closeOrderModal').onclick = closeOrderModal;
document.getElementById('orderOverlay').onclick = closeOrderModal;

// ============================================================
// PRODUCTS
// ============================================================
async function loadProducts() {
  const { data } = await supabase.from('products').select('*, categories(name)').order('sort_order');
  currentProducts = data || [];
  renderProducts();
}

function renderProducts() {
  const table = document.getElementById('productsTable');
  table.innerHTML = '';
  if (currentProducts.length === 0) {
    table.innerHTML = '<p style="color:var(--ink-dim);text-align:center;padding:40px 0;">ما فيه منتجات بعد</p>';
    return;
  }
  currentProducts.forEach(p => {
    const row = document.createElement('div');
    row.className = 'table-row';
    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : '';
    row.innerHTML = `
      <div class="table-row-main">
        <span class="table-row-name">${p.name}</span>
        <span class="table-row-sub">${p.categories?.name || 'بدون فئة'} · ${fmt(p.price_omr)} · <span class="${stockClass}">مخزون: ${p.stock}</span></span>
      </div>
      ${!p.is_active ? '<span class="inactive-tag">غير نشط</span>' : ''}
    `;
    row.onclick = () => openProductModal(p);
    table.appendChild(row);
  });
}

function populateCategorySelect() {
  const select = document.getElementById('categorySelect');
  select.innerHTML = '<option value="">بدون فئة</option>' +
    currentCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openProductModal(product = null) {
  populateCategorySelect();
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('productModalTitle').textContent = product ? 'تعديل المنتج' : 'منتج جديد';
  document.getElementById('deleteProductBtn').hidden = !product;

  if (product) {
    form.id.value = product.id;
    form.name.value = product.name;
    form.description.value = product.description || '';
    form.category_id.value = product.category_id || '';
    form.price_omr.value = product.price_omr;
    form.compare_at_price_omr.value = product.compare_at_price_omr || '';
    form.stock.value = product.stock;
    form.image_url.value = product.image_url || '';
    form.is_active.checked = product.is_active;
  }

  document.getElementById('productModal').hidden = false;
  document.getElementById('productOverlay').hidden = false;
}

function closeProductModal() {
  document.getElementById('productModal').hidden = true;
  document.getElementById('productOverlay').hidden = true;
}
document.getElementById('addProductBtn').onclick = () => openProductModal();
document.getElementById('closeProductModal').onclick = closeProductModal;
document.getElementById('productOverlay').onclick = closeProductModal;

document.getElementById('productForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const id = formData.get('id');

  const payload = {
    name: formData.get('name'),
    description: formData.get('description') || null,
    category_id: formData.get('category_id') || null,
    price_omr: parseFloat(formData.get('price_omr')),
    compare_at_price_omr: formData.get('compare_at_price_omr') ? parseFloat(formData.get('compare_at_price_omr')) : null,
    stock: parseInt(formData.get('stock')),
    image_url: formData.get('image_url') || null,
    is_active: formData.get('is_active') === 'on',
  };

  if (id) {
    await supabase.from('products').update(payload).eq('id', id);
  } else {
    await supabase.from('products').insert(payload);
  }

  closeProductModal();
  loadProducts();
};

document.getElementById('deleteProductBtn').onclick = async () => {
  const id = document.getElementById('productForm').id.value;
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  await supabase.from('products').delete().eq('id', id);
  closeProductModal();
  loadProducts();
};

// ============================================================
// CATEGORIES
// ============================================================
async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  currentCategories = data || [];
  renderCategories();
}

function renderCategories() {
  const table = document.getElementById('categoriesTable');
  table.innerHTML = '';
  if (currentCategories.length === 0) {
    table.innerHTML = '<p style="color:var(--ink-dim);text-align:center;padding:40px 0;">ما فيه فئات بعد</p>';
    return;
  }
  currentCategories.forEach(c => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div class="table-row-main">
        <span class="table-row-name">${c.name}</span>
        <span class="table-row-sub">ترتيب: ${c.sort_order}</span>
      </div>
    `;
    row.onclick = () => openCategoryModal(c);
    table.appendChild(row);
  });
}

function slugify(text) {
  return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '') || `cat-${Date.now()}`;
}

function openCategoryModal(category = null) {
  const form = document.getElementById('categoryForm');
  form.reset();
  document.getElementById('categoryModalTitle').textContent = category ? 'تعديل الفئة' : 'فئة جديدة';
  document.getElementById('deleteCategoryBtn').hidden = !category;

  if (category) {
    form.id.value = category.id;
    form.name.value = category.name;
    form.sort_order.value = category.sort_order;
  }

  document.getElementById('categoryModal').hidden = false;
  document.getElementById('categoryOverlay').hidden = false;
}

function closeCategoryModal() {
  document.getElementById('categoryModal').hidden = true;
  document.getElementById('categoryOverlay').hidden = true;
}
document.getElementById('addCategoryBtn').onclick = () => openCategoryModal();
document.getElementById('closeCategoryModal').onclick = closeCategoryModal;
document.getElementById('categoryOverlay').onclick = closeCategoryModal;

document.getElementById('categoryForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const id = formData.get('id');
  const name = formData.get('name');

  const payload = {
    name,
    slug: slugify(name),
    sort_order: parseInt(formData.get('sort_order')) || 0,
  };

  if (id) {
    delete payload.slug; // don't change slug on edit (keeps links stable)
    await supabase.from('categories').update(payload).eq('id', id);
  } else {
    await supabase.from('categories').insert(payload);
  }

  closeCategoryModal();
  loadCategories();
};

document.getElementById('deleteCategoryBtn').onclick = async () => {
  const id = document.getElementById('categoryForm').id.value;
  if (!confirm('هل أنت متأكد من حذف هذه الفئة؟ المنتجات بداخلها بتصير بدون فئة.')) return;
  await supabase.from('categories').delete().eq('id', id);
  closeCategoryModal();
  loadCategories();
};

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings() {
  const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single();
  if (!data) return;
  const form = document.getElementById('settingsForm');
  form.bank_name.value = data.bank_name || '';
  form.bank_account_name.value = data.bank_account_name || '';
  form.bank_iban.value = data.bank_iban || '';
  form.online_payment_link.value = data.online_payment_link || '';
  form.whatsapp_number.value = data.whatsapp_number || '';
  form.instagram_handle.value = data.instagram_handle || '';
}

document.getElementById('settingsForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());

  await supabase.from('store_settings').update(payload).eq('id', 1);

  const savedMsg = document.getElementById('settingsSaved');
  savedMsg.hidden = false;
  setTimeout(() => savedMsg.hidden = true, 2000);
};
