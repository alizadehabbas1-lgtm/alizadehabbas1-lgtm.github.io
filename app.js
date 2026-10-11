// ============================================================
//  خرجینه - اپلیکیشن مدیریت هزینه خانگی
//  نسخه 3.2 - با تراز افراد و نمودار
// ============================================================

// ============================================================
//  PWA
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('✅ SW ثبت شد'))
            .catch(err => console.log('❌ خطا:', err));
    });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn')?.classList.add('show');
});

function installApp() {
    if (!deferredPrompt) {
        showToast('ℹ️ از منوی مرورگر ← Add to Home Screen', 'info');
        return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(r => {
        if (r.outcome === 'accepted') showToast('✅ اپ نصب شد!', 'success');
        deferredPrompt = null;
    });
}

window.addEventListener('appinstalled', () => {
    showToast('🎉 اپ نصب شد!', 'success');
    document.getElementById('installBtn')?.classList.remove('show');
});

function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    if (banner) {
        if (navigator.onLine) banner.classList.remove('show');
        else banner.classList.add('show');
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ============================================================
//  متغیرها
// ============================================================
const STORAGE_KEY = 'kharijineh_data_v3';
const CATEGORIES_KEY = 'kharijineh_categories_v3';
const USER_KEY = 'kharijineh_user_v3';

let transactions = [];
let categories = [];
let nextId = 1;
let currentTab = 'all';
let deleteTargetId = null;
let currentUser = '';
let deviceName = '';
let balanceChartInstance = null;

// ============================================================
//  دسته‌بندی‌های پیش‌فرض
// ============================================================
const DEFAULT_CATEGORIES = [
    { id: 'food', name: 'خوراک', type: 'expense', icon: '🍔', parentId: null },
    { id: 'food_fruit', name: 'میوه و سبزیجات', type: 'expense', icon: '🍎', parentId: 'food' },
    { id: 'food_meat', name: 'گوشت و مرغ', type: 'expense', icon: '🍗', parentId: 'food' },
    { id: 'food_dairy', name: 'لبنیات', type: 'expense', icon: '🥛', parentId: 'food' },
    { id: 'food_bread', name: 'نان و غلات', type: 'expense', icon: '🍞', parentId: 'food' },
    { id: 'food_restaurant', name: 'رستوران', type: 'expense', icon: '🍽️', parentId: 'food' },
    
    { id: 'transport', name: 'حمل‌ونقل', type: 'expense', icon: '🚕', parentId: null },
    { id: 'transport_fuel', name: 'بنزین', type: 'expense', icon: '⛽', parentId: 'transport' },
    { id: 'transport_repair', name: 'تعمیر ماشین', type: 'expense', icon: '🔧', parentId: 'transport' },
    { id: 'transport_taxi', name: 'تاکسی', type: 'expense', icon: '🚖', parentId: 'transport' },
    { id: 'transport_parking', name: 'پارکینگ', type: 'expense', icon: '🅿️', parentId: 'transport' },
    { id: 'transport_insurance', name: 'بیمه ماشین', type: 'expense', icon: '🛡️', parentId: 'transport' },
    
    { id: 'bills', name: 'قبوض', type: 'expense', icon: '📄', parentId: null },
    { id: 'bills_electric', name: 'برق', type: 'expense', icon: '💡', parentId: 'bills' },
    { id: 'bills_gas', name: 'گاز', type: 'expense', icon: '🔥', parentId: 'bills' },
    { id: 'bills_water', name: 'آب', type: 'expense', icon: '💧', parentId: 'bills' },
    { id: 'bills_phone', name: 'تلفن و موبایل', type: 'expense', icon: '📱', parentId: 'bills' },
    { id: 'bills_internet', name: 'اینترنت', type: 'expense', icon: '🌐', parentId: 'bills' },
    
    { id: 'home', name: 'خانه', type: 'expense', icon: '🏠', parentId: null },
    { id: 'home_rent', name: 'اجاره', type: 'expense', icon: '🔑', parentId: 'home' },
    { id: 'home_repair', name: 'تعمیرات', type: 'expense', icon: '🛠️', parentId: 'home' },
    { id: 'home_furniture', name: 'لوازم خانه', type: 'expense', icon: '🛋️', parentId: 'home' },
    
    { id: 'medical', name: 'درمان', type: 'expense', icon: '💊', parentId: null },
    { id: 'medical_doctor', name: 'دکتر', type: 'expense', icon: '👨‍⚕️', parentId: 'medical' },
    { id: 'medical_medicine', name: 'دارو', type: 'expense', icon: '💊', parentId: 'medical' },
    { id: 'medical_hospital', name: 'بیمارستان', type: 'expense', icon: '🏥', parentId: 'medical' },
    
    { id: 'clothes', name: 'پوشاک', type: 'expense', icon: '👕', parentId: null },
    { id: 'education', name: 'آموزش', type: 'expense', icon: '📚', parentId: null },
    { id: 'fun', name: 'سرگرمی', type: 'expense', icon: '🎮', parentId: null },
    { id: 'travel', name: 'سفر', type: 'expense', icon: '✈️', parentId: null },
    { id: 'other_expense', name: 'سایر هزینه‌ها', type: 'expense', icon: '💸', parentId: null },
    
    { id: 'salary', name: 'حقوق', type: 'income', icon: '💼', parentId: null },
    { id: 'salary_main', name: 'حقوق اصلی', type: 'income', icon: '💵', parentId: 'salary' },
    { id: 'salary_bonus', name: 'پاداش', type: 'income', icon: '🎁', parentId: 'salary' },
    { id: 'salary_overtime', name: 'اضافه کار', type: 'income', icon: '⏰', parentId: 'salary' },
    
    { id: 'business', name: 'کسب و کار', type: 'income', icon: '🏪', parentId: null },
    { id: 'business_sale', name: 'فروش', type: 'income', icon: '🛒', parentId: 'business' },
    { id: 'business_service', name: 'خدمات', type: 'income', icon: '🔧', parentId: 'business' },
    
    { id: 'investment', name: 'سرمایه‌گذاری', type: 'income', icon: '📈', parentId: null },
    { id: 'gift_income', name: 'هدیه', type: 'income', icon: '🎁', parentId: null },
    { id: 'other_income', name: 'سایر درآمدها', type: 'income', icon: '💰', parentId: null },
];

// ============================================================
//  تاریخ شمسی
// ============================================================
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
               Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        jy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
}

function todayJalali() {
    const now = new Date();
    const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function todayJalaliForFile() {
    const now = new Date();
    const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

function currentJalaliMonth() {
    const now = new Date();
    const { jy, jm } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return `${jy}/${String(jm).padStart(2, '0')}`;
}

function toEnglishDigits(str) {
    if (!str) return '';
    const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
    return String(str).replace(/[۰-۹]/g, d => map[d]);
}

function formatAmount(amount) {
    const num = Math.abs(parseFloat(amount) || 0);
    return num.toLocaleString('en-US');
}

function generateUUID() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ============================================================
//  بارگذاری و ذخیره
// ============================================================
function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.transactions) {
                transactions = data.transactions.map(t => {
                    if (!t.uuid) t.uuid = generateUUID();
                    if (!t.owner) t.owner = 'نامشخص';
                    return t;
                });
                nextId = data.nextId || 1;
            }
        }
        const savedCats = localStorage.getItem(CATEGORIES_KEY);
        categories = savedCats ? JSON.parse(savedCats) : [...DEFAULT_CATEGORIES];
        if (!savedCats) saveCategories();
        
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedUser) {
            const u = JSON.parse(savedUser);
            currentUser = u.name || '';
            deviceName = u.device || '';
        }
    } catch(e) {
        console.error('خطا:', e);
        categories = [...DEFAULT_CATEGORIES];
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, nextId }));
        return true;
    } catch(e) {
        showToast('❌ خطا در ذخیره', 'error');
        return false;
    }
}

function saveCategories() {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

function saveUserData() {
    localStorage.setItem(USER_KEY, JSON.stringify({ name: currentUser, device: deviceName }));
}

// ============================================================
//  دسته‌بندی: کمکی‌ها
// ============================================================
function getMainCategories(type) {
    return categories.filter(c => c.type === type && !c.parentId);
}

function getSubCategories(parentId) {
    return categories.filter(c => c.parentId === parentId);
}

function getCategoryById(id) {
    return categories.find(c => c.id === id);
}

function getCategoryFullName(catId) {
    if (!catId) return '';
    const cat = getCategoryById(catId);
    if (!cat) return '';
    if (cat.parentId) {
        const parent = getCategoryById(cat.parentId);
        if (parent) return `${parent.name} → ${cat.name}`;
    }
    return cat.name;
}

// ============================================================
//  رندر
// ============================================================
function renderTransactions() {
    let listId = 'transactionList';
    let searchId = 'searchInput';
    if (currentTab === 'income') { listId = 'transactionListIncome'; searchId = 'searchInputIncome'; }
    else if (currentTab === 'expense') { listId = 'transactionListExpense'; searchId = 'searchInputExpense'; }
    
    const container = document.getElementById(listId);
    if (!container) return;
    
    const search = (document.getElementById(searchId)?.value || '').trim().toLowerCase();
    
    let filtered = transactions;
    if (currentTab === 'income') filtered = filtered.filter(t => t.type === 'income');
    else if (currentTab === 'expense') filtered = filtered.filter(t => t.type === 'expense');
    
    if (search) {
        filtered = filtered.filter(t => {
            const catName = getCategoryFullName(t.category).toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const owner = (t.owner || '').toLowerCase();
            return catName.includes(search) || desc.includes(search) || owner.includes(search) || String(t.amount).includes(search);
        });
    }
    
    filtered.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><div>هنوز تراکنشی ثبت نشده</div></div>`;
        return;
    }
    
    container.innerHTML = filtered.map(t => {
        const cat = getCategoryById(t.category);
        const icon = cat ? cat.icon : (t.type === 'income' ? '💰' : '💸');
        const title = cat ? cat.name : 'بدون دسته';
        const sign = t.type === 'income' ? '+' : '-';
        const itemClass = t.type === 'income' ? 'income' : '';
        const ownerTag = t.owner && t.owner !== 'نامشخص' ? `<span class="owner-tag">👤 ${t.owner}</span>` : '';
        let subTag = '';
        if (cat && cat.parentId) {
            const parent = getCategoryById(cat.parentId);
            if (parent) subTag = `<span class="sub-tag">${parent.icon} ${parent.name}</span>`;
        }
        
        return `
            <div class="transaction-item ${itemClass}">
                <div class="t-icon">${icon}</div>
                <div class="t-info">
                    <div class="t-title">${title} ${subTag} ${ownerTag}</div>
                    <div class="t-desc">${t.date}${t.description ? ' - ' + t.description : ''}</div>
                </div>
                <div class="t-amount">${sign}${formatAmount(t.amount)}</div>
                <div class="t-actions">
                    <button class="edit-btn" onclick="editTransaction(${t.id})">✏️</button>
                    <button class="delete-btn" onclick="openDeleteModal(${t.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateSummary() {
    const currentMonth = currentJalaliMonth();
    let income = 0, expense = 0;
    transactions.forEach(t => {
        if (t.date && t.date.startsWith(currentMonth)) {
            if (t.type === 'income') income += parseFloat(t.amount) || 0;
            else expense += parseFloat(t.amount) || 0;
        }
    });
    const balance = income - expense;
    document.getElementById('summaryIncome').textContent = formatAmount(income);
    document.getElementById('summaryExpense').textContent = formatAmount(expense);
    const balEl = document.getElementById('summaryBalance');
    balEl.textContent = formatAmount(balance);
    balEl.classList.toggle('negative', balance < 0);
}

// ============================================================
//  تب‌ها
// ============================================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    if (tab === 'report') renderReport();
    else if (tab === 'settings') renderSettings();
    else renderTransactions();
}

// ============================================================
//  Modal تراکنش
// ============================================================
function openTransactionModal(editId = null) {
    const modal = document.getElementById('transactionModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('transactionForm');
    const editIdInput = document.getElementById('editId');
    
    form.reset();
    document.getElementById('date').value = todayJalali();
    document.getElementById('owner').value = currentUser || '';
    
    if (editId) {
        const t = transactions.find(x => x.id === editId);
        if (!t) { showToast('❌ پیدا نشد', 'error'); return; }
        title.textContent = '✏️ ویرایش تراکنش';
        editIdInput.value = editId;
        document.getElementById('amount').value = t.amount;
        document.getElementById('date').value = t.date;
        document.getElementById('description').value = t.description || '';
        document.getElementById('owner').value = t.owner || '';
        const radio = document.querySelector(`input[name="type"][value="${t.type}"]`);
        if (radio) radio.checked = true;
        updateTypeToggle();
        document.getElementById('category').value = t.category || '';
        onCategoryChange();
        const cat = getCategoryById(t.category);
        if (cat && cat.parentId) {
            document.getElementById('subcategory').value = t.category;
        }
    } else {
        title.textContent = '➕ تراکنش جدید';
        editIdInput.value = '';
        document.querySelector('input[name="type"][value="expense"]').checked = true;
        updateTypeToggle();
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('amount').focus(), 200);
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.body.style.overflow = '';
}

function updateTypeToggle() {
    const type = document.querySelector('input[name="type"]:checked')?.value || 'expense';
    document.getElementById('typeExpense').classList.toggle('selected', type === 'expense');
    document.getElementById('typeIncome').classList.toggle('selected', type === 'income');
    populateCategoryDropdown(type);
}

function populateCategoryDropdown(type) {
    const select = document.getElementById('category');
    const currentValue = select.value;
    const mains = getMainCategories(type);
    select.innerHTML = '<option value="">— انتخاب کنید —</option>' +
        mains.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    if (currentValue) select.value = currentValue;
}

function onCategoryChange() {
    const catId = document.getElementById('category').value;
    const subGroup = document.getElementById('subcategoryGroup');
    const subSelect = document.getElementById('subcategory');
    
    if (!catId) {
        subGroup.style.display = 'none';
        return;
    }
    
    const subs = getSubCategories(catId);
    if (subs.length > 0) {
        subGroup.style.display = 'block';
        subSelect.innerHTML = '<option value="">— بدون زیرشاخه —</option>' +
            subs.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    } else {
        subGroup.style.display = 'none';
    }
}

// ============================================================
//  ذخیره تراکنش
// ============================================================
function saveTransaction(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editId').value;
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseFloat(toEnglishDigits(document.getElementById('amount').value)) || 0;
    let date = toEnglishDigits(document.getElementById('date').value.trim());
    const description = document.getElementById('description').value.trim();
    const owner = document.getElementById('owner').value.trim() || currentUser || 'نامشخص';
    
    let category = document.getElementById('category').value;
    const subcat = document.getElementById('subcategory').value;
    if (subcat) category = subcat;
    
    if (!amount || amount <= 0) { showToast('❌ مبلغ را وارد کنید', 'error'); return; }
    if (!date) { showToast('❌ تاریخ را وارد کنید', 'error'); return; }
    
    const parts = date.split('/');
    if (parts.length === 3) {
        date = `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    }
    
    if (editId) {
        const t = transactions.find(x => x.id === parseInt(editId));
        if (t) {
            t.type = type; t.amount = amount; t.date = date;
            t.description = description; t.category = category; t.owner = owner;
            t.updatedAt = new Date().toISOString();
            showToast('✅ ویرایش شد', 'success');
        }
    } else {
        transactions.push({
            id: nextId++, uuid: generateUUID(),
            type, amount, date, description, category, owner,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        showToast('✅ ذخیره شد', 'success');
    }
    
    saveData();
    renderTransactions();
    updateSummary();
    closeTransactionModal();
}

function editTransaction(id) {
    openTransactionModal(id);
}

// ============================================================
//  حذف
// ============================================================
function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.add('active');
}
function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.remove('active');
}
function confirmDelete() {
    if (!deleteTargetId) return;
    const idx = transactions.findIndex(t => t.id === deleteTargetId);
    if (idx >= 0) {
        transactions.splice(idx, 1);
        saveData();
        renderTransactions();
        updateSummary();
        showToast('🗑️ حذف شد', 'info');
    }
    closeDeleteModal();
}

// ============================================================
//  کاربر
// ============================================================
function openUserModal() {
    document.getElementById('userNameInput').value = currentUser || '';
    document.getElementById('deviceNameInput').value = deviceName || '';
    document.getElementById('userModal').classList.add('active');
}
function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}
function saveUser() {
    const name = document.getElementById('userNameInput').value.trim();
    const device = document.getElementById('deviceNameInput').value.trim();
    if (!name) { showToast('❌ نام را وارد کنید', 'error'); return; }
    currentUser = name;
    deviceName = device;
    saveUserData();
    updateUserBadge();
    closeUserModal();
    showToast(`✅ خوش آمدی ${name}!`, 'success');
}
function updateUserBadge() {
    const el = document.getElementById('currentUser');
    if (el) el.textContent = currentUser || 'تنظیم';
}

// ============================================================
//  پشتیبان
// ============================================================
function buildFileName() {
    const parts = ['kharijineh'];
    if (currentUser) parts.push(currentUser.replace(/\s+/g, '-'));
    if (deviceName) parts.push(deviceName.replace(/\s+/g, '-'));
    parts.push(todayJalaliForFile());
    return parts.join('_') + '.json';
}

function downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function backupData() {
    if (transactions.length === 0) {
        showToast('⚠️ داده‌ای وجود ندارد', 'error');
        return;
    }
    const data = {
        transactions, categories, nextId,
        backupDate: new Date().toISOString(),
        backupDateJalali: todayJalali(),
        backupBy: currentUser || 'نامشخص',
        device: deviceName || 'نامشخص',
        app: 'kharijineh', version: 3.2,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, buildFileName());
    showToast(`✅ پشتیبان ذخیره شد (${transactions.length} تراکنش + ${categories.length} دسته)`, 'success');
}

async function shareData() {
    if (transactions.length === 0) {
        showToast('⚠️ داده‌ای وجود ندارد', 'error');
        return;
    }
    
    const data = {
        transactions, categories, nextId,
        backupDate: new Date().toISOString(),
        backupDateJalali: todayJalali(),
        backupBy: currentUser || 'نامشخص',
        device: deviceName || 'نامشخص',
        app: 'kharijineh', version: 3.2,
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    const fileName = buildFileName();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName)] })) {
        try {
            await navigator.share({
                files: [new File([blob], fileName, { type: 'application/json' })],
                title: 'خرجینه - پشتیبان',
                text: `پشتیبان خرجینه - ${currentUser || ''} - ${todayJalali()}`,
            });
            showToast('✅ فایل ارسال شد', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                downloadFile(blob, fileName);
                showToast('📥 فایل دانلود شد', 'info');
            }
        }
    } else {
        downloadFile(blob, fileName);
        showToast('📥 فایل دانلود شد — از روبیکا/واتساپ بفرست', 'info');
    }
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.transactions || data.transactions.length === 0) {
                showToast('❌ فایل نامعتبر', 'error'); return;
            }
            if (confirm(`⚠️ ${data.transactions.length} تراکنش جایگزین شود؟`)) {
                transactions = data.transactions.map(t => {
                    if (!t.uuid) t.uuid = generateUUID();
                    if (!t.owner) t.owner = 'نامشخص';
                    return t;
                });
                nextId = data.nextId || Math.max(...transactions.map(t => t.id), 0) + 1;
                if (data.categories) { categories = data.categories; saveCategories(); }
                saveData();
                renderTransactions();
                updateSummary();
                showToast(`✅ ${data.transactions.length} تراکنش + ${categories.length} دسته بازیابی شد`, 'success');
            }
        } catch(err) {
            showToast('❌ خطا: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (transactions.length === 0) { showToast('⚠️ خالی است', 'error'); return; }
    if (confirm(`⚠️ همه‌ی ${transactions.length} تراکنش پاک شود؟`)) {
        transactions = [];
        nextId = 1;
        saveData();
        renderTransactions();
        updateSummary();
        showToast('🗑️ پاک شد', 'info');
    }
}

// ============================================================
//  ادغام
// ============================================================
function mergeData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.transactions || importedData.transactions.length === 0) {
                showToast('❌ فایل نامعتبر', 'error'); return;
            }
            const imported = importedData.transactions.map(t => {
                if (!t.uuid) t.uuid = generateUUID();
                if (!t.owner) t.owner = importedData.backupBy || 'نامشخص';
                return t;
            });
            
            const importedCats = importedData.categories || [];
            const analysis = analyzeMerge(imported, importedCats);
            showMergePreview(analysis, imported, importedData);
        } catch(err) {
            showToast('❌ خطا: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function analyzeMerge(imported, importedCategories) {
    const newItems = [], updateItems = [], duplicates = [];
    
    imported.forEach(imp => {
        const existing = transactions.find(t => t.uuid === imp.uuid);
        if (!existing) newItems.push(imp);
        else {
            const impTime = new Date(imp.updatedAt || imp.createdAt || 0).getTime();
            const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            if (impTime > exTime) updateItems.push({ existing, imported: imp });
            else duplicates.push(imp);
        }
    });
    
    const importedCats = [];
    const newCats = [];
    const updatedCats = [];
    
    if (importedCategories && importedCategories.length > 0) {
        importedCategories.forEach(impCat => {
            const existing = categories.find(c => c.id === impCat.id);
            if (!existing) {
                importedCats.push(impCat);
                newCats.push(impCat);
            } else {
                if (impCat.name !== existing.name || 
                    impCat.icon !== existing.icon || 
                    impCat.parentId !== existing.parentId ||
                    impCat.type !== existing.type) {
                    importedCats.push(impCat);
                    updatedCats.push({ existing, imported: impCat });
                }
            }
        });
    }
    
    return { 
        newItems, updateItems, duplicates, 
        importedCategories: importedCats,
        newCats, updatedCats
    };
}

function showMergePreview(analysis, imported, importedData) {
    const { newItems, updateItems, duplicates, newCats, updatedCats } = analysis;
    
    const byOwner = {};
    newItems.forEach(t => {
        const o = t.owner || 'نامشخص';
        if (!byOwner[o]) byOwner[o] = 0;
        byOwner[o]++;
    });
    
    let ownerHtml = '';
    const ownerEntries = Object.entries(byOwner);
    if (ownerEntries.length > 0) {
        ownerHtml = `
            <div style="background:#EEF2FF;border-radius:10px;padding:10px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:bold;color:#4F46E5;margin-bottom:6px;">
                    👥 تراکنش‌های جدید به تفکیک افراد:
                </div>
                ${ownerEntries.map(([name, count]) => `
                    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
                        <span>👤 ${name}</span>
                        <strong>${count} تراکنش</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    let catHtml = '';
    if ((newCats && newCats.length > 0) || (updatedCats && updatedCats.length > 0)) {
        catHtml = `
            <div style="background:#F0FDF4;border-radius:10px;padding:10px;margin-bottom:10px;border-right:4px solid #10B981;">
                <div style="font-size:12px;font-weight:bold;color:#065F46;margin-bottom:6px;">
                    📂 دسته‌بندی‌ها:
                </div>
                ${newCats && newCats.length > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
                        <span>🆕 دسته‌های جدید:</span>
                        <strong style="color:#27ae60;">${newCats.length}</strong>
                    </div>
                ` : ''}
                ${updatedCats && updatedCats.length > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
                        <span>✏️ دسته‌های به‌روزرسانی:</span>
                        <strong style="color:#f39c12;">${updatedCats.length}</strong>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    const fromInfo = importedData.backupBy ? 
        `<div style="background:#FEF3C7;border-radius:8px;padding:8px;margin-bottom:10px;font-size:12px;">
            📦 این فایل از طرف: <strong>${importedData.backupBy}</strong>
            ${importedData.device ? ' - دستگاه: <strong>' + importedData.device + '</strong>' : ''}
            ${importedData.backupDateJalali ? '<br>📅 تاریخ: ' + importedData.backupDateJalali : ''}
        </div>` : '';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'mergeModal';
    modal.innerHTML = `
        <div class="modal-box" style="max-width:500px;">
            <div class="modal-header">
                <h2>🔀 ادغام داده‌ها</h2>
                <button class="close-btn" onclick="closeMergeModal()">✕</button>
            </div>
            ${fromInfo}
            <div style="background:#f8f9fa;border-radius:12px;padding:12px;margin-bottom:12px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div style="background:white;border-radius:8px;padding:10px;text-align:center;">
                        <div style="font-size:10px;color:#7f8c8d;">داده‌های فعلی</div>
                        <div style="font-size:18px;font-weight:bold;color:#3498db;">${transactions.length}</div>
                    </div>
                    <div style="background:white;border-radius:8px;padding:10px;text-align:center;">
                        <div style="font-size:10px;color:#7f8c8d;">داده‌های فایل</div>
                        <div style="font-size:18px;font-weight:bold;color:#9b59b6;">${imported.length}</div>
                    </div>
                </div>
                <div style="background:white;border-radius:8px;padding:10px;">
                    <div style="display:flex;justify-content:space-between;padding:4px 0;">
                        <span style="font-size:12px;">🆕 تراکنش جدید:</span>
                        <strong style="color:#27ae60;">${newItems.length}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:4px 0;">
                        <span style="font-size:12px;">✏️ به‌روزرسانی:</span>
                        <strong style="color:#f39c12;">${updateItems.length}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:4px 0;">
                        <span style="font-size:12px;">👥 تکراری:</span>
                        <strong style="color:#95a5a6;">${duplicates.length}</strong>
                    </div>
                    ${newCats && newCats.length > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;">
                        <span style="font-size:12px;">📂 دسته جدید:</span>
                        <strong style="color:#10B981;">${newCats.length}</strong>
                    </div>
                    ` : ''}
                </div>
            </div>
            ${ownerHtml}
            ${catHtml}
            <div class="btn-row">
                <button onclick="confirmMerge()" style="background:#4F46E5;color:white;">🔀 ادغام کن</button>
                <button onclick="closeMergeModal()" style="background:#95a5a6;color:white;">✕ انصراف</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    window.pendingImportData = imported;
    window.pendingAnalysis = analysis;
}

function closeMergeModal() {
    document.getElementById('mergeModal')?.remove();
    window.pendingImportData = null;
    window.pendingAnalysis = null;
}

function confirmMerge() {
    const imported = window.pendingImportData;
    const analysis = window.pendingAnalysis;
    if (!imported || !analysis) return;
    
    localStorage.setItem('kharijineh_auto_backup_' + Date.now(), 
        JSON.stringify({ transactions, categories, nextId }));
    
    let added = 0, updated = 0;
    let catAdded = 0, catUpdated = 0;
    
    if (analysis.importedCategories && analysis.importedCategories.length > 0) {
        analysis.importedCategories.forEach(impCat => {
            const existing = categories.find(c => c.id === impCat.id);
            if (!existing) {
                categories.push(impCat);
                catAdded++;
            } else {
                existing.name = impCat.name;
                existing.icon = impCat.icon;
                existing.parentId = impCat.parentId;
                existing.type = impCat.type;
                catUpdated++;
            }
        });
        saveCategories();
    }
    
    analysis.newItems.forEach(t => {
        if (!t.uuid) t.uuid = generateUUID();
        if (!t.id) t.id = nextId++;
        else if (t.id >= nextId) nextId = t.id + 1;
        transactions.push(t);
        added++;
    });
    
    analysis.updateItems.forEach(({ existing, imported }) => {
        Object.assign(existing, imported);
        updated++;
    });
    
    saveData();
    renderTransactions();
    updateSummary();
    renderSettings();
    closeMergeModal();
    setTimeout(() => showMergeResult(added, updated, analysis.duplicates.length, catAdded, catUpdated), 200);
}

function showMergeResult(added, updated, duplicates, catAdded = 0, catUpdated = 0) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'mergeResultModal';
    modal.innerHTML = `
        <div class="modal-box" style="max-width:400px;">
            <div class="modal-header">
                <h2>✅ ادغام انجام شد</h2>
                <button class="close-btn" onclick="document.getElementById('mergeResultModal').remove()">✕</button>
            </div>
            <div style="text-align:center;padding:16px 0;">
                <div style="font-size:50px;margin-bottom:12px;">🎉</div>
                <div style="background:#f8f9fa;border-radius:12px;padding:14px;text-align:right;">
                    <div style="font-size:11px;font-weight:bold;color:#7f8c8d;margin-bottom:6px;">📊 تراکنش‌ها:</div>
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ecf0f1;">
                        <span>🆕 اضافه شده:</span><strong style="color:#27ae60;">${added}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ecf0f1;">
                        <span>✏️ به‌روزرسانی:</span><strong style="color:#3498db;">${updated}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ecf0f1;">
                        <span>👥 تکراری:</span><strong style="color:#95a5a6;">${duplicates}</strong>
                    </div>
                    ${(catAdded > 0 || catUpdated > 0) ? `
                    <div style="font-size:11px;font-weight:bold;color:#7f8c8d;margin-top:10px;margin-bottom:6px;">📂 دسته‌بندی‌ها:</div>
                    ${catAdded > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ecf0f1;">
                        <span>🆕 اضافه شده:</span><strong style="color:#10B981;">${catAdded}</strong>
                    </div>
                    ` : ''}
                    ${catUpdated > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ecf0f1;">
                        <span>✏️ به‌روزرسانی:</span><strong style="color:#f39c12;">${catUpdated}</strong>
                    </div>
                    ` : ''}
                    ` : ''}
                    <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:bold;margin-top:8px;border-top:2px solid #ecf0f1;">
                        <span>📊 مجموع تراکنش‌ها:</span><strong style="color:#4F46E5;">${transactions.length}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:bold;font-size:12px;">
                        <span>📂 مجموع دسته‌ها:</span><strong style="color:#4F46E5;">${categories.length}</strong>
                    </div>
                </div>
            </div>
            <div class="btn-row">
                <button onclick="document.getElementById('mergeResultModal').remove()" style="background:#4F46E5;color:white;width:100%;">✅ بستن</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================================
//  گزارش پیشرفته
// ============================================================
let reportFilters = {
    dateFrom: '',
    dateTo: '',
    owner: '',
    type: 'all',
};

function renderReport() {
    const container = document.getElementById('reportContainer');
    if (!container) return;
    
    // destroy chart if exists
    if (balanceChartInstance) {
        balanceChartInstance.destroy();
        balanceChartInstance = null;
    }
    
    const filtered = applyReportFilters(transactions);
    
    let totalIncome = 0, totalExpense = 0;
    const byPerson = {};
    const byCategory = {};
    
    filtered.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const owner = t.owner || 'نامشخص';
        
        if (!byPerson[owner]) byPerson[owner] = { income: 0, expense: 0, count: 0 };
        byPerson[owner].count++;
        
        if (t.type === 'income') {
            totalIncome += amt;
            byPerson[owner].income += amt;
        } else {
            totalExpense += amt;
            byPerson[owner].expense += amt;
        }
        
        if (t.category) {
            if (!byCategory[t.category]) byCategory[t.category] = { total: 0, count: 0 };
            byCategory[t.category].total += amt;
            byCategory[t.category].count++;
        }
    });
    
    const totalBalance = totalIncome - totalExpense;
    const personsSorted = Object.entries(byPerson).sort((a, b) => 
        (b[1].income + b[1].expense) - (a[1].income + a[1].expense)
    );
    const categoriesSorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
    
    const allOwners = [...new Set(transactions.map(t => t.owner || 'نامشخص'))].sort();
    
    let html = '';
    
    // ==========================================
    // فیلترها
    // ==========================================
    html += `
        <div class="report-section">
            <h3>🔍 فیلترها</h3>
            <div class="form-group">
                <label>از تاریخ (شمسی)</label>
                <input type="text" id="filterDateFrom" placeholder="1403/01/01" value="${reportFilters.dateFrom}">
            </div>
            <div class="form-group">
                <label>تا تاریخ (شمسی)</label>
                <input type="text" id="filterDateTo" placeholder="1403/12/29" value="${reportFilters.dateTo}">
            </div>
            <div class="form-group">
                <label>عضو</label>
                <select id="filterOwner">
                    <option value="">همه اعضا</option>
                    ${allOwners.map(o => `<option value="${o}" ${reportFilters.owner === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>نوع</label>
                <select id="filterType">
                    <option value="all" ${reportFilters.type === 'all' ? 'selected' : ''}>همه</option>
                    <option value="income" ${reportFilters.type === 'income' ? 'selected' : ''}>درآمد</option>
                    <option value="expense" ${reportFilters.type === 'expense' ? 'selected' : ''}>هزینه</option>
                </select>
            </div>
            <div class="btn-row">
                <button onclick="applyFilters()" style="background:#4F46E5;color:white;">اعمال فیلتر</button>
                <button onclick="resetFilters()" style="background:#95a5a6;color:white;">حذف فیلتر</button>
            </div>
        </div>
    `;
    
    // ==========================================
    // خلاصه کل
    // ==========================================
    html += `
        <div class="report-summary">
            <div class="report-summary-item inc">
                <div class="lbl">📈 کل درآمد</div>
                <div class="val">${formatAmount(totalIncome)}</div>
            </div>
            <div class="report-summary-item exp">
                <div class="lbl">📉 کل هزینه</div>
                <div class="val">${formatAmount(totalExpense)}</div>
            </div>
            <div class="report-summary-item bal">
                <div class="lbl">💎 مانده کل</div>
                <div class="val">${formatAmount(totalBalance)}</div>
            </div>
        </div>
    `;
    
    // ==========================================
    // تراز هر نفر
    // ==========================================
    if (personsSorted.length > 0) {
        html += `<div class="report-section"><h3>⚖️ تراز افراد</h3>`;
        
        personsSorted.forEach(([name, data]) => {
            const balance = data.income - data.expense;
            let balanceClass = 'zero';
            if (balance > 0) balanceClass = 'positive';
            else if (balance < 0) balanceClass = 'negative';
            
            const initial = name.charAt(0).toUpperCase();
            
            html += `
                <div class="balance-card ${balanceClass}">
                    <div class="b-person">
                        <div class="b-avatar">${initial}</div>
                        <div>
                            <div class="b-name">👤 ${name}</div>
                            <div class="b-stats">${data.count} تراکنش</div>
                        </div>
                    </div>
                    <div class="b-amounts">
                        <div class="b-row">
                            <span class="b-label">درآمد</span>
                            <span class="b-income">+${formatAmount(data.income)}</span>
                        </div>
                        <div class="b-row">
                            <span class="b-label">هزینه</span>
                            <span class="b-expense">-${formatAmount(data.expense)}</span>
                        </div>
                        <div class="b-balance ${balanceClass}">
                            ${balance >= 0 ? '+' : '-'}${formatAmount(balance)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        // جمع کل
        html += `
            <div class="balance-total">
                <h4>📊 جمع کل</h4>
                <div class="total-row">
                    <span>📈 کل درآمد</span>
                    <span class="val">+${formatAmount(totalIncome)}</span>
                </div>
                <div class="total-row">
                    <span>📉 کل هزینه</span>
                    <span class="val">-${formatAmount(totalExpense)}</span>
                </div>
                <div class="total-balance">
                    <span>💎 مانده کل</span>
                    <span class="val">${totalBalance >= 0 ? '+' : '-'}${formatAmount(totalBalance)}</span>
                </div>
            </div>
        `;
        
        html += `</div>`;
    }
    
    // ==========================================
    // نمودار تراز افراد
    // ==========================================
    if (personsSorted.length > 0) {
        html += `
            <div class="chart-container">
                <h3>📊 نمودار تراز افراد</h3>
                <canvas id="balanceChart"></canvas>
            </div>
        `;
    }
    
    // ==========================================
    // گزارش دسته‌بندی
    // ==========================================
    if (categoriesSorted.length > 0) {
        html += `<div class="report-section"><h3>📂 گزارش به تفکیک دسته‌بندی</h3>`;
        categoriesSorted.forEach(([catId, data]) => {
            const cat = getCategoryById(catId);
            if (!cat) return;
            const fullName = getCategoryFullName(catId);
            html += `
                <div class="report-row">
                    <div class="person-name">${cat.icon} ${fullName} <span style="font-size:10px;color:#95a5a6;">(${data.count})</span></div>
                    <div class="amounts">
                        <span class="expense-amt">${formatAmount(data.total)}</span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // ==========================================
    // دکمه پرینت
    // ==========================================
    html += `
        <div class="report-section" style="text-align:center;">
            <button onclick="printReport()" style="background:#27ae60;color:white;padding:12px 24px;border:none;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;">
                🖨️ پرینت گزارش
            </button>
        </div>
    `;
    
    if (filtered.length === 0) {
        html += `<div class="empty-state"><div class="icon">📊</div><div>داده‌ای برای نمایش نیست</div></div>`;
    }
    
    container.innerHTML = html;
    
    // ==========================================
    // رسم نمودار
    // ==========================================
    if (personsSorted.length > 0 && document.getElementById('balanceChart')) {
        drawBalanceChart(personsSorted);
    }
}

function drawBalanceChart(personsSorted) {
    const ctx = document.getElementById('balanceChart');
    if (!ctx) return;
    
    // چک کن Chart.js لود شده یا نه
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js لود نشده');
        // بارگذاری Chart.js
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => drawBalanceChart(personsSorted);
        document.head.appendChild(script);
        return;
    }
    
    const labels = personsSorted.map(([name]) => name);
    const balances = personsSorted.map(([, data]) => data.income - data.expense);
    const colors = balances.map(b => b >= 0 ? '#10B981' : '#EF4444');
    
    balanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'تراز (تومان)',
                data: balances,
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            return (val >= 0 ? '+' : '-') + Math.abs(val).toLocaleString('en-US');
                        }
                    },
                    rtl: true,
                    textDirection: 'rtl',
                    titleFont: { family: 'Tahoma' },
                    bodyFont: { family: 'Tahoma' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { family: 'Tahoma', size: 10 },
                        callback: function(value) {
                            if (Math.abs(value) >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            }
                            if (Math.abs(value) >= 1000) {
                                return (value / 1000).toFixed(0) + 'K';
                            }
                            return value;
                        }
                    },
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    ticks: { font: { family: 'Tahoma', size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function applyReportFilters(data) {
    return data.filter(t => {
        if (reportFilters.dateFrom && t.date < reportFilters.dateFrom) return false;
        if (reportFilters.dateTo && t.date > reportFilters.dateTo) return false;
        if (reportFilters.owner && (t.owner || 'نامشخص') !== reportFilters.owner) return false;
        if (reportFilters.type !== 'all' && t.type !== reportFilters.type) return false;
        return true;
    });
}

function applyFilters() {
    reportFilters.dateFrom = document.getElementById('filterDateFrom').value.trim();
    reportFilters.dateTo = document.getElementById('filterDateTo').value.trim();
    reportFilters.owner = document.getElementById('filterOwner').value;
    reportFilters.type = document.getElementById('filterType').value;
    renderReport();
}

function resetFilters() {
    reportFilters = { dateFrom: '', dateTo: '', owner: '', type: 'all' };
    renderReport();
}

// ============================================================
//  پرینت گزارش
// ============================================================
function printReport() {
    const reportContent = document.getElementById('reportContainer').cloneNode(true);
    
    const filterSection = reportContent.querySelector('.report-section:first-child');
    if (filterSection && filterSection.innerHTML.includes('فیلترها')) {
        filterSection.remove();
    }
    
    // حذف نمودار (چون در پنجره‌ی جدید رسم نمی‌شه)
    const chartContainer = reportContent.querySelector('.chart-container');
    if (chartContainer) chartContainer.remove();
    
    const printBtn = reportContent.querySelector('button');
    if (printBtn && printBtn.textContent.includes('پرینت')) {
        printBtn.parentElement.remove();
    }
    
    const title = `
        <div style="text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #4F46E5;">
            <h1 style="font-size:22px;color:#2c3e50;margin:0;">💰 خرجینه</h1>
            <p style="font-size:12px;color:#7f8c8d;margin:5px 0 0 0;">گزارش مالی</p>
            <p style="font-size:11px;color:#7f8c8d;margin:3px 0 0 0;">تاریخ چاپ: ${todayJalali()}</p>
            ${currentUser ? '<p style="font-size:11px;color:#7f8c8d;margin:3px 0 0 0;">کاربر: ' + currentUser + '</p>' : ''}
        </div>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>گزارش خرجینه - ${todayJalali()}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tahoma', 'Segoe UI', sans-serif; }
                body { direction: rtl; padding: 20px; background: white; color: #000; }
                .report-section { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 15px; page-break-inside: avoid; }
                .report-section h3 { font-size: 14px; color: #000; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #000; }
                .report-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
                .report-row:last-child { border-bottom: none; }
                .report-row .person-name { font-weight: bold; color: #000; }
                .report-row .amounts { display: flex; gap: 8px; direction: ltr; font-size: 11px; }
                .report-row .expense-amt { color: #EF4444; font-weight: bold; }
                .report-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 15px; }
                .report-summary-item { background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
                .report-summary-item .lbl { font-size: 10px; color: #7f8c8d; }
                .report-summary-item .val { font-size: 14px; font-weight: bold; margin-top: 3px; direction: ltr; }
                .report-summary-item.inc .val { color: #10B981; }
                .report-summary-item.exp .val { color: #EF4444; }
                .report-summary-item.bal .val { color: #4F46E5; }
                
                /* تراز */
                .balance-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-right: 4px solid #4F46E5; }
                .balance-card.positive { border-right-color: #10B981; }
                .balance-card.negative { border-right-color: #EF4444; }
                .balance-card .b-avatar { width: 36px; height: 36px; border-radius: 50%; background: #4F46E5; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; }
                .balance-card .b-name { font-weight: bold; font-size: 13px; }
                .balance-card .b-stats { font-size: 10px; color: #7f8c8d; }
                .balance-card .b-income { color: #10B981; font-weight: bold; font-size: 12px; direction: ltr; }
                .balance-card .b-expense { color: #EF4444; font-weight: bold; font-size: 12px; direction: ltr; }
                .balance-card .b-balance { font-weight: bold; font-size: 13px; padding: 3px 8px; border-radius: 6px; direction: ltr; }
                .balance-card .b-balance.positive { color: #10B981; background: #D1FAE5; }
                .balance-card .b-balance.negative { color: #EF4444; background: #FEE2E2; }
                .balance-total { background: #4F46E5; color: white; border-radius: 8px; padding: 12px; margin-top: 10px; }
                .balance-total h4 { font-size: 12px; margin-bottom: 8px; }
                .balance-total .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
                .balance-total .total-balance { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.3); display: flex; justify-content: space-between; font-weight: bold; }
                
                .footer-print { text-align: center; font-size: 10px; color: #666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
                @media print { body { padding: 10px; } .report-section { page-break-inside: avoid; } }
            </style>
        </head>
        <body>
            ${title}
            ${reportContent.innerHTML}
            <div class="footer-print">
                این گزارش توسط اپلیکیشن خرجینه ساخته شده است • ${todayJalali()}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 300);
    };
}

// ============================================================
//  تنظیمات
// ============================================================
function renderSettings() {
    const container = document.getElementById('settingsContainer');
    if (!container) return;
    
    const expenseCats = categories.filter(c => c.type === 'expense' && !c.parentId);
    const incomeCats = categories.filter(c => c.type === 'income' && !c.parentId);
    
    let html = `
        <div class="settings-section">
            <h3>👤 اطلاعات کاربر</h3>
            <button onclick="openUserModal()" style="width:100%;padding:10px;background:#4F46E5;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-family:inherit;margin-bottom:8px;">
                ✏️ ویرایش نام کاربر
            </button>
            <div style="font-size:12px;color:#7f8c8d;text-align:center;">
                نام فعلی: <strong>${currentUser || 'تنظیم نشده'}</strong>
            </div>
        </div>
        
        <div class="settings-section">
            <h3>💸 دسته‌های هزینه</h3>
            <button onclick="openCategoryModal(null, 'expense')" style="width:100%;padding:8px;background:#EF4444;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:inherit;margin-bottom:10px;font-size:12px;">
                ➕ افزودن دسته هزینه
            </button>
    `;
    
    expenseCats.forEach(cat => {
        const subs = getSubCategories(cat.id);
        html += renderCategoryItem(cat, subs);
    });
    
    html += `</div>`;
    
    html += `
        <div class="settings-section">
            <h3>💰 دسته‌های درآمد</h3>
            <button onclick="openCategoryModal(null, 'income')" style="width:100%;padding:8px;background:#10B981;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:inherit;margin-bottom:10px;font-size:12px;">
                ➕ افزودن دسته درآمد
            </button>
    `;
    
    incomeCats.forEach(cat => {
        const subs = getSubCategories(cat.id);
        html += renderCategoryItem(cat, subs);
    });
    
    html += `</div>`;
    
    container.innerHTML = html;
}

function renderCategoryItem(cat, subs) {
    let html = `
        <div class="category-item ${cat.type}">
            <div class="cat-info">
                <div class="cat-icon">${cat.icon}</div>
                <div class="cat-details">
                    <div class="cat-name">${cat.name}</div>
                    <div class="cat-type">${subs.length > 0 ? subs.length + ' زیرشاخه' : 'بدون زیرشاخه'}</div>
                </div>
            </div>
            <div class="cat-actions">
                <button class="edit-btn" onclick="openSubCategoryModal('${cat.id}')" title="افزودن زیرشاخه">➕</button>
                <button class="edit-btn" onclick="openCategoryModal('${cat.id}')" title="ویرایش">✏️</button>
                <button class="delete-btn" onclick="deleteCategory('${cat.id}')" title="حذف">🗑️</button>
            </div>
        </div>
    `;
    
    if (subs.length > 0) {
        html += `<div class="subcategory-list">`;
        subs.forEach(sub => {
            html += `
                <div class="subcategory-item">
                    <span>${sub.icon} ${sub.name}</span>
                    <div>
                        <button onclick="openCategoryModal('${sub.id}')" title="ویرایش">✏️</button>
                        <button onclick="deleteCategory('${sub.id}')" title="حذف">🗑️</button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    return html;
}

function openCategoryModal(catId, presetType) {
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    const parentGroup = document.getElementById('parentCatGroup');
    const parentSelect = document.getElementById('catParent');
    
    form.reset();
    document.getElementById('editCatId').value = '';
    document.getElementById('catIcon').value = '📁';
    parentGroup.style.display = 'block';
    
    const allMains = categories.filter(c => !c.parentId);
    parentSelect.innerHTML = '<option value="">— دسته اصلی —</option>' +
        allMains.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    
    if (catId) {
        const cat = getCategoryById(catId);
        if (!cat) return;
        title.textContent = '✏️ ویرایش دسته';
        document.getElementById('editCatId').value = catId;
        document.getElementById('catName').value = cat.name;
        document.getElementById('catType').value = cat.type;
        document.getElementById('catIcon').value = cat.icon;
        document.getElementById('catParent').value = cat.parentId || '';
    } else {
        title.textContent = '➕ دسته جدید';
        if (presetType) document.getElementById('catType').value = presetType;
    }
    
    modal.classList.add('active');
}

function openSubCategoryModal(parentId) {
    openCategoryModal(null);
    setTimeout(() => {
        document.getElementById('catParent').value = parentId;
        const parent = getCategoryById(parentId);
        if (parent) document.getElementById('catType').value = parent.type;
        document.getElementById('catName').focus();
    }, 100);
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

function saveCategory(event) {
    event.preventDefault();
    const editId = document.getElementById('editCatId').value;
    const name = document.getElementById('catName').value.trim();
    const type = document.getElementById('catType').value;
    const icon = document.getElementById('catIcon').value.trim() || '📁';
    const parentId = document.getElementById('catParent').value || null;
    
    if (!name) { showToast('❌ نام را وارد کنید', 'error'); return; }
    
    if (editId) {
        const cat = getCategoryById(editId);
        if (cat) {
            cat.name = name; cat.type = type; cat.icon = icon; cat.parentId = parentId;
            showToast('✅ ویرایش شد', 'success');
        }
    } else {
        const newId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        categories.push({ id: newId, name, type, icon, parentId });
        showToast('✅ اضافه شد', 'success');
    }
    
    saveCategories();
    closeCategoryModal();
    renderSettings();
}

function deleteCategory(catId) {
    const cat = getCategoryById(catId);
    if (!cat) return;
    
    const used = transactions.filter(t => t.category === catId).length;
    if (used > 0) {
        showToast(`⚠️ این دسته در ${used} تراکنش استفاده شده`, 'error');
        return;
    }
    
    if (!confirm(`حذف "${cat.name}"؟`)) return;
    
    categories = categories.filter(c => c.id !== catId && c.parentId !== catId);
    saveCategories();
    renderSettings();
    showToast('🗑️ حذف شد', 'info');
}

// ============================================================
//  Toast
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ============================================================
//  مقداردهی اولیه
// ============================================================
loadData();
renderTransactions();
updateSummary();
updateUserBadge();

document.getElementById('transactionModal').addEventListener('click', function(e) {
    if (e.target === this) closeTransactionModal();
});
document.getElementById('deleteModal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
});
document.getElementById('userModal').addEventListener('click', function(e) {
    if (e.target === this) closeUserModal();
});
document.getElementById('categoryModal').addEventListener('click', function(e) {
    if (e.target === this) closeCategoryModal();
});

if (!currentUser) {
    setTimeout(() => {
        openUserModal();
        showToast('👤 لطفاً اسم خودت رو وارد کن', 'info');
    }, 500);
}

console.log('💰 خرجینه v3.2 آماده است');
console.log(`📊 تراکنش‌ها: ${transactions.length}`);
console.log(`📂 دسته‌ها: ${categories.length}`);