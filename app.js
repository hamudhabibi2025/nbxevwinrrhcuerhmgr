// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzMrK1bhOoUg5YLRBQPBck0piYJj-2WRseJsV5ehYcCsrsf-tXhdDY6bCtCKfeL0EfNVg/exec'; 
// =========================================================================

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv;
let currentPage = 'home';
let globalValidPemain = []; 
let globalValidOfficial = []; 

// --- SESSION TIMER LOGIC ---
let sessionTimer;
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 menit dalam milidetik

function startSessionTimer() {
    // Hapus timer lama jika ada
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    showToast("Sesi Anda akan berakhir dalam 30 menit.", 'info');
    sessionTimer = setTimeout(lockUserInterface, SESSION_DURATION_MS);
}

function lockUserInterface() {
    const lockOverlay = document.createElement('div');
    lockOverlay.id = 'lock-overlay';
    lockOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 1060; /* Lebih tinggi dari loading-overlay */
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        text-align: center;
        font-size: 1.5rem;
    `;
    lockOverlay.innerHTML = `
        <h3>🚫 Akses Terkunci 🚫</h3>
        <p>Batas waktu sesi 30 menit telah berakhir.</p>
        <p>Silakan **Refresh Halaman** untuk memulai sesi baru dan memberi giliran pengguna lain.</p>
        <button class="btn btn-primary mt-3" onclick="window.location.reload();">Refresh Sekarang</button>
    `;
    
    document.body.appendChild(lockOverlay);
    
    // Hapus data pengguna dari sessionStorage agar saat refresh harus login lagi
    sessionStorage.removeItem('currentUser'); 
    
    showToast("Waktu sesi Anda telah berakhir. Harap refresh halaman.", 'danger');
}


// --- CORE UTILITIES ---

function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('liveToast');
    const toastBody = document.getElementById('toast-body');
    
    toast.className = `toast align-items-center text-white border-0 ${isSuccess ? 'bg-success' : 'bg-danger'}`;
    toastBody.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // Hapus header data URI ("data:image/jpeg;base64,")
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function previewImage(event, previewId) {
    const reader = new FileReader();
    reader.onload = function(){
        const output = document.getElementById(previewId);
        output.src = reader.result;
    }
    reader.readAsDataURL(event.target.files[0]);
}

function calculateAge(dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

// Fungsi ini tidak lagi digunakan untuk validasi backend, tapi tetap ada jika diperlukan di frontend
function isEditable(timestamp, userType) {
    // Backend (Code gs.txt) kini mengatur batas waktu 3 hari. 
    // Frontend hanya perlu menunjukkan status (seperti di notifikasi)
    if (userType === 'ADMIN_PUSAT') return true;
    // Cek 10 hari (dulu 1 jam, kini 10 hari seperti di notifikasi lama)
    const timeDiff = new Date().getTime() - new Date(timestamp).getTime();
    return timeDiff < 10 * 24 * 60 * 60 * 1000;
}

function showModalForm(title, formHtml, onSubmitFunction, customFooterHtml = '') {
    const modalId = 'genericModal';
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();
    
    const defaultFooter = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
        <button type="submit" class="btn btn-primary" id="modalSubmitButton">Simpan</button>
    `;
    const footerContent = customFooterHtml || defaultFooter;

    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        
<h5 class="modal-title" id="${modalId}Label">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="generic-form">
                        <div class="modal-body row g-3">
  
                            ${formHtml}
                        </div>
                        <div class="modal-footer justify-content-between">
                        
    ${footerContent}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    if (onSubmitFunction) {
        const formElement = document.getElementById('generic-form');
        if (formElement) formElement.addEventListener('submit', onSubmitFunction);
    }
    
    return { modal, modalElement };
}

function showConfirmationModal(message, onConfirm) {
    const modalHtml = `
        <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        
<h5 class="modal-title" id="confirmModalLabel">Konfirmasi Aksi</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${message}
    
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-danger" id="confirmButton">Ya, Lanjutkan</button>
      
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById('confirmModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    document.getElementById('confirmButton').onclick = () => {
        modal.hide();
        onConfirm();
    };

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
}

// --- CORE LOGIC (APPS SCRIPT COMMUNICATION) ---

async function callAppsScript(action, params = {}) {
    const finalParams = new URLSearchParams({
        action: action,
        user: JSON.stringify(currentUser),
        ...params
    });
    showLoading();
    
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: finalParams,
        });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const result = await response.json();
        hideLoading();
        
        if (result && !result.success) {
            showToast(result.message || 'Terjadi kesalahan pada server.', false);
        }
        
        // Perbarui timer sesi setiap kali komunikasi berhasil
        if (result && result.success && action !== 'CHECK_AUTH') {
            startSessionTimer();
        }

        return result;
    } catch (error) {
        hideLoading();
        showToast(`Komunikasi Gagal: ${error.message}. Pastikan URL API sudah benar.`, false);
        return { success: false, message: error.message };
    }
}

async function handleGenericFormSubmit(e, crudAction, fileFields, callback) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const modalElement = form.closest('.modal');
    const modal = modalElement ? bootstrap.Modal.getInstance(modalElement) : null;
    const isUpdate = data.action === 'UPDATE';
    
    if (crudAction === 'CRUD_USERLIST' && isUpdate && !data.password) {
        delete data.password;
    }

    showLoading();

    // --- 1. PROSES UPLOAD GAMBAR KE IMGBB VIA APPS SCRIPT ---
    let uploadSuccess = true;
    for (const fieldName of fileFields) {
        const fileInput = document.getElementById(fieldName);
        // Nama kolom di Sheet: Ambil bagian sebelum '_file'
        const sheetFieldName = fieldName.replace('_file', '');
        if (fileInput && fileInput.files.length > 0) {
            const base64Data = await fileToBase64(fileInput.files[0]);
            // Panggil Apps Script untuk meneruskan Base64 ke ImgBB
            const uploadResult = await callAppsScript('UPLOAD_IMAGE', { base64Data });
            if (!uploadResult || !uploadResult.success) {
                hideLoading();
                showToast(uploadResult.message || `Gagal mengupload file untuk ${fieldName}.`, false);
                uploadSuccess = false;
                break;
            }
            
            let uploadedUrl = uploadResult.url;
            // ✅ PERBAIKAN DOMAIN IMGBB: Ganti domain pendek menjadi domain panjang yang berfungsi
            if (uploadedUrl && uploadedUrl.includes('https://i.ibb.co/')) {
                uploadedUrl = uploadedUrl.replace('https://i.ibb.co/', 'https://i.ibb.co.com/');
            }

            // Simpan URL yang sudah diperbaiki ke data yang akan dikirim ke Apps Script
            data[sheetFieldName] = uploadedUrl;
        } else if (isUpdate) {
            // Jika update dan tidak ada file baru, pertahankan URL lama yang ada di input hidden
            data[sheetFieldName] = data[sheetFieldName] ||
''; 
        }
    }

    if (!uploadSuccess) return;
    // --- 2. HAPUS FIELD ID INPUT TAMBAHAN (untuk CREATE) ---
    if (data.id_pemain_input) {
        data.id_pemain = data.id_pemain_input;
        delete data.id_pemain_input;
    }
    if (data.id_official_input) {
        data.id_official = data.id_official_input;
        delete data.id_official_input;
    }
    
    // --- 3. PANGGIL CRUD APPS SCRIPT ---
    const result = await callAppsScript(crudAction, { data: JSON.stringify(data) });
    hideLoading();

    if (result && result.success) {
        if (modal) modal.hide();
        showToast(result.message);
        callback();
    } else if (result) {
        showToast(result.message, false);
    }
}


// --- APP FLOW & AUTHENTICATION ---

function renderApp() {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        renderAppLayout(currentUser.type_users);
    } else {
        renderLoginPage();
    }
}

function renderLoginPage() {
    appContainer.innerHTML = `
        <div id="login-page">
            <div id="login-form">
                <h4 class="text-center mb-4 text-primary"><i class="fas fa-futbol me-2"></i>Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM)</h4>
                <form id="auth-form">
                    <div class="mb-3">
     
                        <label for="username" class="form-label">Username</label>
                        <input type="text" class="form-control" id="username" name="username" required>
                    </div>
                    <div class="mb-3">
         
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Login</button>
          
                </form>
            </div>
        </div>
    `;
    document.getElementById('auth-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const result = await callAppsScript('CHECK_AUTH', data);
    if (result && result.success) {
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        currentUser = result.user;
        renderApp();
    } else if (result) {
        showToast(result.message, false);
    }
}

function handleLogout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    renderApp();
}

// --- MODIFIKASI FUNGSI INTI UNTUK TATA LETAK BARU (BOTTOM NAV) ---

function renderAppLayout(userType) {
    const user = currentUser; 
    
    // Header (Navbar Atas)
    const navHtml = `
        <nav id="main-navbar" class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
            <div class="container-fluid">
                <a class="navbar-brand" href="#" onclick="renderPage('home');">
                    <img id="pssi-logo" src="https://upload.wikimedia.org/wikipedia/id/thumb/7/7b/Logo_PSSI.svg/1200px-Logo_PSSI.svg.png" alt="PSSI Logo" class="pssi-logo"> 
                    SIPAKEM
                </a>
                <div class="d-flex align-items-center">
                    <span class="navbar-user-info me-2 d-none d-sm-block">${user.username} (${userType.replace('_', ' ')})</span>
                    <button class="btn btn-outline-danger btn-sm" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> Keluar
                    </button>
                </div>
            </div>
        </nav>
    `;

    // Konten Utama
    const contentHtml = `
        <div id="main-content">
            </div>
    `;

    appContainer.innerHTML = navHtml + contentHtml;
    contentDiv = document.getElementById('main-content');
    
    // Render Navigasi Bawah
    renderBottomNav(userType);
    renderPage(currentPage); // Memuat halaman pertama (default 'home')

    // Mulai timer sesi setelah layout dimuat
    startSessionTimer(); 
}

// --- FUNGSI BARU UNTUK NAVIGASI BAWAH ---

function renderBottomNav(userType) {
    const bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) return; 

    bottomNav.innerHTML = '';
    
    let menuItems = [];

    // Tentukan menu berdasarkan jenis pengguna
    if (userType === 'ADMIN_PUSAT') {
        menuItems = [
            { id: 'home', icon: 'fas fa-home', label: 'Home' },
            { id: 'profil', icon: 'fas fa-building', label: 'Klub' },
            { id: 'list_kompetisi', icon: 'fas fa-trophy', label: 'Kompetisi' },
            // Statistik tidak ada halamannya, diganti ke Pemain untuk akses cepat
            { id: 'pemain', icon: 'fas fa-running', label: 'Pemain' }, 
            { id: 'setting', icon: 'fas fa-cog', label: 'Pengaturan' },
        ];
    } else if (userType.startsWith('ADMIN_KLUB')) {
        menuItems = [
            { id: 'home', icon: 'fas fa-home', label: 'Home' },
            { id: 'profil', icon: 'fas fa-shield-alt', label: 'Klub' },
            { id: 'pemain', icon: 'fas fa-running', label: 'Pemain' },
            { id: 'kompetisi', icon: 'fas fa-file-signature', label: 'Registrasi' },
            // Official dipindahkan ke menu "Klub" atau Pengaturan karena keterbatasan ruang di mobile
            { id: 'official', icon: 'fas fa-chalkboard-teacher', label: 'Official' },
        ];
    } else {
        // Fallback
        menuItems = [
            { id: 'home', icon: 'fas fa-home', label: 'Home' },
            { id: 'list_kompetisi', icon: 'fas fa-trophy', label: 'Kompetisi' },
        ];
    }

    menuItems.forEach(item => {
        const isActive = currentPage === item.id ? 'active' : '';
        const itemHtml = `
            <a href="#" class="nav-item-bottom ${isActive}" onclick="renderPage('${item.id}')">
                <i class="${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        `;
        bottomNav.innerHTML += itemHtml;
    });

    bottomNav.style.display = 'flex'; // Tampilkan bottom nav setelah di-render
}


function renderPage(pageId, ...args) {
    // 1. Set current page
    currentPage = pageId;
    if (contentDiv) contentDiv.innerHTML = '';
    
    // 2. Update active status in bottom nav
    const navItems = document.querySelectorAll('#bottom-nav .nav-item-bottom');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(`'${pageId}'`)) {
            item.classList.add('active');
        }
    });

    // 3. Render content
    if (pageId === 'home') renderHome();
    else if (pageId === 'profil') renderProfil();
    else if (pageId === 'pemain') renderPemain();
    else if (pageId === 'official') renderOfficial();
    else if (pageId === 'kompetisi' || pageId === 'list_kompetisi') renderKompetisi();
    else if (pageId === 'setting') renderSetting();
    else if (pageId === 'prakompetisi') renderPrakompetisi(args[0]);
    else contentDiv.innerHTML = `<h2>Halaman Tidak Ditemukan</h2>`;
}

// --- NAVIGASI HOME ---
// ... (loadBanners, renderHome, loadClubNotifications, loadAdminPusatNotifications)

async function loadBanners() {
    const result = await callAppsScript('GET_BANNERS');
    const inner = document.getElementById('banner-inner');
    inner.innerHTML = '';

    if (!result || !result.success || Object.keys(result.data).length === 0) {
        inner.innerHTML = `<div class="carousel-item active"><div class="alert alert-warning text-center">Tidak ada banner terdaftar.</div></div>`;
        return;
    }

    let first = true;
    let hasContent = false;
    for (let i = 1; i <= 3; i++) {
        const url = result.data[`url_banner${i}`];
        if (url) {
            inner.innerHTML += `
                <div class="carousel-item ${first ? 'active' : ''}">
                    <img src="${url}" class="d-block w-100 rounded" style="height: 250px; object-fit: cover;"
alt="Banner ${i}">
                </div>
            `;
            first = false;
            hasContent = true;
        }
    }
     if (!hasContent) {
        inner.innerHTML = `<div class="carousel-item active"><div class="alert alert-info text-center">Tidak ada gambar banner.</div></div>`;
    }
}

async function renderHome() {
    const clubInfo = await callAppsScript('GET_PROFIL_KLUB');
    const profilKlub = clubInfo && clubInfo.success && !Array.isArray(clubInfo.data) ? clubInfo.data : null;
    contentDiv.innerHTML = `
        <h2><i class="fas fa-home me-2"></i>Dashboard Klub</h2>
        <div id="home-alerts"></div>
        <div class="row g-4 mt-3">
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-primary text-white"><i class="fas fa-shield-alt me-2"></i>Status Profil Klub</div>
      
                    <div class="card-body" id="club-status-card">
                        ${profilKlub ?
`
                            <h5 class="card-title">${profilKlub.nama_klub}</h5>
                            <p class="card-text">
                                ID Klub: ${profilKlub.id_klub}<br>
        
                                Alamat: ${profilKlub.alamat_klub ||
'-'}<br>
                                Nama Manajer: ${profilKlub.nama_manajer ||
'-'}
                            </p>
                            <span class="badge bg-success"><i class="fas fa-check-circle me-1"></i> Profil Lengkap</span>
                            <button class="btn btn-sm btn-outline-primary float-end" onclick="renderPage('profil')">Lihat Detail</button>
   
                         ` : currentUser.type_users.startsWith('ADMIN_KLUB') ?
`
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i> Peringatan: Profil Klub Anda belum terdaftar!
</div>
                            <button class="btn btn-danger w-100" onclick="renderPage('profil')">Daftarkan Profil Klub Sekarang</button>
                        ` : `
                            <div class="alert alert-info">
         
                               <i class="fas fa-info-circle me-2"></i> Admin Pusat memiliki akses penuh ke semua data klub.
</div>
                            <button class="btn btn-primary w-100" onclick="renderPage('profil')">Lihat Semua Klub</button>
                        `}
                    </div>
                </div>
      
            </div>
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-info text-dark"><i class="fas fa-bell me-2"></i>Pembaruan & Notifikasi</div>
                    <div class="card-body" id="notification-card">
            
                        <ul class="list-group list-group-flush" id="notification-list">
                            <li class="list-group-item text-muted">Memuat notifikasi...</li>
                        </ul>
                    </div>
          
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h4><i class="fas fa-images me-2"></i>Info Terbaru</h4>
            <div id="banner-carousel" class="carousel slide" data-bs-ride="carousel">
                <div class="carousel-inner" id="banner-inner">
               
                     <p class="text-center p-5"><i class="fas fa-spinner fa-spin me-2"></i>Memuat banner...</p>
                </div>
                <button class="carousel-control-prev" type="button" data-bs-target="#banner-carousel" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
         
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#banner-carousel" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
            </div>
  
        </div>
    `;
    
    loadBanners();
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        loadClubNotifications();
    } else if (currentUser.type_users === 'ADMIN_PUSAT') {
        loadAdminPusatNotifications();
    }
}

async function loadClubNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = '';
    
    const pemainResult = await callAppsScript('GET_PEMAIN');
    const officialResult = await callAppsScript('GET_OFFICIAL');
    const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;
    
    let recentChanges = 0;
    if (pemainResult && pemainResult.success) {
        // Notifikasi untuk batas waktu 3 hari (72 jam)
        const lockTime = 3 * 24 * 60 * 60 * 1000;
        pemainResult.data.filter(p => p.id_klub === currentUser.id_klub && (now - new Date(p.time_stamp).getTime() < lockTime)).forEach(p => {
             list.innerHTML += `<li class="list-group-item list-group-item-warning"><i class="fas fa-edit me-2"></i> Pemain ${p.nama_pemain} hanya bisa di Edit/Hapus dalam **3 hari** dari waktu terakhir diubah.</li>`;
            recentChanges++;
        });
    }

    if (officialResult && officialResult.success) {
        const lockTime = 3 * 24 * 60 * 60 * 1000;
        officialResult.data.filter(o => o.id_klub === currentUser.id_klub && (now - new Date(o.time_stamp).getTime() < lockTime)).forEach(o => {
            list.innerHTML += `<li class="list-group-item list-group-item-warning"><i class="fas fa-edit me-2"></i> Official ${o.nama_official} hanya bisa di Edit/Hapus dalam **3 hari** dari waktu terakhir diubah.</li>`;
            recentChanges++;
        });
    }

    if (kompetisiResult && kompetisiResult.success) {
        kompetisiResult.data.forEach(k => {
            const startDate = new Date(k.tanggal_awal_pendaftaran).getTime();
            const endDate = new Date(k.tanggal_akhir_pendaftaran).getTime();
            if (now >= startDate && now <= endDate) {
                list.innerHTML += `<li class="list-group-item list-group-item-success"><i class="fas fa-trophy me-2"></i> Pendaftaran ${k.nama_kompetisi} telah dibuka!</li>`;
   
                recentChanges++;
            }
        });
    }

    if (recentChanges === 0) {
        list.innerHTML = `<li class="list-group-item text-success"><i class="fas fa-check me-2"></i> Semua data Anda stabil.
Tidak ada pembaruan mendesak.</li>`;
    }
}

function loadAdminPusatNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = `
        <li class="list-group-item text-primary"><i class="fas fa-star me-2"></i> Selamat datang kembali, Admin Pusat.</li>
        <li class="list-group-item"><i class="fas fa-cog me-2"></i> Akses penuh ke Setting (Banner & Userlist) dan CRUD Kompetisi.</li>
        <li class="list-group-item text-muted"><i class="fas fa-search me-2"></i> Lihat data klub dan pemain di menu terkait.</li>
    `;
}

// --- NAVIGASI PROFIL KLUB ---
async function renderProfil() {
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        renderAllKlubList();
    } else {
        renderKlubForm();
    }
}

async function renderKlubForm() {
    const isNew = !currentUser.id_klub;
    let klubData = {};
    if (!isNew) {
        const result = await callAppsScript('GET_PROFIL_KLUB');
        if (result.success) {
            klubData = result.data;
        }
    }

    contentDiv.innerHTML = `
        <h2><i class="fas fa-shield-alt me-2"></i>${isNew ? 'Daftar' : 'Edit'} Profil Klub</h2>
        <div class="card shadow-sm mt-3">
            <div class="card-body">
                <form id="profil-klub-form">
                    <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
                    <input type="hidden" name="id_klub" value="${klubData.id_klub || currentUser.id_klub}">
                    <input type="hidden" name="logo_klub" id="logo_klub" value="${klubData.logo_klub || ''}">
                    
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="nama_klub" class="form-label">Nama Klub</label>
                            <input type="text" class="form-control" id="nama_klub" name="nama_klub" value="${klubData.nama_klub || ''}" required>
                        </div>
                        <div class="col-md-6">
                            <label for="nama_manajer" class="form-label">Nama Manajer</label>
                            <input type="text" class="form-control" id="nama_manajer" name="nama_manajer" value="${klubData.nama_manajer || ''}" required>
                        </div>
                        <div class="col-12">
                            <label for="alamat_klub" class="form-label">Alamat Klub</label>
                            <textarea class="form-control" id="alamat_klub" name="alamat_klub">${klubData.alamat_klub || ''}</textarea>
                        </div>
                        <div class="col-md-6">
                            <label for="tahun_berdiri" class="form-label">Tahun Berdiri</label>
                            <input type="number" class="form-control" id="tahun_berdiri" name="tahun_berdiri" value="${klubData.tahun_berdiri || ''}" max="${new Date().getFullYear()}" placeholder="Contoh: 2000">
                        </div>
                        <div class="col-md-6">
                            <label for="logo_klub_file" class="form-label">Logo Klub</label>
                            <input type="file" class="form-control" id="logo_klub_file" name="logo_klub_file" accept="image/*" onchange="previewImage(event, 'logo-preview')" ${isNew ? 'required' : ''}>
                        </div>
                        <div class="col-12 text-center">
                            <img id="logo-preview" src="${klubData.logo_klub || 'https://via.placeholder.com/150?text=Logo+Klub'}" alt="Preview Logo" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
                        </div>
                        <div class="col-12">
                            <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i>Simpan Profil</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('profil-klub-form').addEventListener('submit', (e) => 
        handleGenericFormSubmit(e, 'CRUD_PROFIL_KLUB', ['logo_klub_file'], renderKlubForm)
    );
}

async function renderAllKlubList() {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-building me-2"></i>Daftar Semua Profil Klub</h2>
        <div class="table-responsive mt-3">
            <table class="table table-striped table-hover" id="klub-list-table">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Logo</th>
                        <th>Nama Klub</th>
                        <th>ID Klub</th>
                        <th>Manajer</th>
                        <th>Tahun Berdiri</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const tbody = document.querySelector('#klub-list-table tbody');
    tbody.innerHTML = '';

    if (result && result.success && Array.isArray(result.data)) {
        result.data.forEach(klub => {
            tbody.innerHTML += `
                <tr>
                    <td><img src="${klub.logo_klub || 'https://via.placeholder.com/30'}" alt="Logo" style="width: 30px; height: 30px; object-fit: cover;"></td>
                    <td>${klub.nama_klub}</td>
                    <td>${klub.id_klub}</td>
                    <td>${klub.nama_manajer || '-'}</td>
                    <td>${klub.tahun_berdiri || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-info text-white" onclick="showKlubDetailAdmin('${klub.id_klub}')">Detail</button>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Tidak ada data klub ditemukan.</td></tr>`;
    }
}

async function showKlubDetailAdmin(idKlub) {
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const klub = result.data.find(k => k.id_klub === idKlub);

    if (!klub) {
        showToast('Klub tidak ditemukan.', false);
        return;
    }
    
    const detailHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${klub.logo_klub || 'https://via.placeholder.com/150?text=No+Logo'}" alt="Logo Klub" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
        </div>
        <div class="col-md-6"><strong>Nama Klub:</strong> ${klub.nama_klub}</div>
        <div class="col-md-6"><strong>ID Klub:</strong> ${klub.id_klub}</div>
        <div class="col-md-6"><strong>Nama Manajer:</strong> ${klub.nama_manajer || '-'}</div>
        <div class="col-md-6"><strong>Tahun Berdiri:</strong> ${klub.tahun_berdiri || '-'}</div>
        <div class="col-12"><strong>Alamat:</strong> ${klub.alamat_klub || '-'}</div>
        <div class="col-12 mt-3">
             <button class="btn btn-sm btn-primary" onclick="renderPage('pemain', '${idKlub}')"><i class="fas fa-running me-1"></i> Lihat Pemain</button>
             <button class="btn btn-sm btn-secondary" onclick="renderPage('official', '${idKlub}')"><i class="fas fa-users me-1"></i> Lihat Official</button>
        </div>
    `;

    showModalForm(`Detail Klub: ${klub.nama_klub}`, detailHtml, null, '');
}

// --- NAVIGASI PEMAIN ---
async function renderPemain() {
    const isKlubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
    const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-running me-2"></i>Data Pemain</h2>
        <div class="d-flex justify-content-between align-items-center mt-3 mb-3">
            <input type="text" class="form-control w-50" id="search-pemain" onkeyup="filterPemainList()" placeholder="Cari Nama/ID Pemain...">
            ${isKlubAdmin ? `<button class="btn btn-primary" onclick="openPemainForm()"><i class="fas fa-plus me-2"></i>Tambah Pemain</button>` : ''}
        </div>
        <div class="table-responsive">
            <table class="table table-striped table-hover" id="pemain-list-table">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Foto</th>
                        <th>ID Pemain</th>
                        <th>Nama</th>
                        <th>Posisi</th>
                        <th>Tgl Lahir / Umur</th>
                        ${isPusatAdmin ? '<th>Klub</th>' : ''}
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="${isPusatAdmin ? 7 : 6}" class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    loadPemainList();
}

async function loadPemainList() {
    const result = await callAppsScript('GET_PEMAIN');
    const tbody = document.querySelector('#pemain-list-table tbody');
    tbody.innerHTML = '';
    
    if (result && result.success && Array.isArray(result.data)) {
        globalValidPemain = result.data; // Simpan data global untuk filtering

        // Filter berdasarkan admin klub atau tampilkan semua untuk admin pusat
        const dataToDisplay = currentUser.type_users.startsWith('ADMIN_KLUB')
            ? result.data.filter(p => p.id_klub === currentUser.id_klub)
            : result.data;

        dataToDisplay.forEach(pemain => {
            const age = calculateAge(pemain.tanggal_lahir);
            const isKlubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
            const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
            const isLocked = isKlubAdmin && !isEditable(pemain.time_stamp, currentUser.type_users);

            tbody.innerHTML += `
                <tr data-nama="${pemain.nama_pemain}" data-id="${pemain.id_pemain}" data-klub="${pemain.nama_klub || ''}">
                    <td><img src="${pemain.foto_pemain || 'https://via.placeholder.com/30'}" alt="Foto" style="width: 30px; height: 30px; object-fit: cover;"></td>
                    <td>${pemain.id_pemain}</td>
                    <td>${pemain.nama_pemain}</td>
                    <td>${pemain.posisi}</td>
                    <td>${pemain.tanggal_lahir} (${age} thn)</td>
                    ${isPusatAdmin ? `<td>${pemain.id_klub}</td>` : ''}
                    <td>
                        <button class="btn btn-sm btn-info text-white" onclick="showPemainDetail('${pemain.id_pemain}')"><i class="fas fa-eye"></i></button>
                        ${isKlubAdmin ? `
                            <button class="btn btn-sm btn-warning ${isLocked ? 'disabled' : ''}" onclick="openPemainForm('${pemain.id_pemain}')" ${isLocked ? 'disabled title="Melebihi batas 3 hari edit"' : ''}><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger ${isLocked ? 'disabled' : ''}" onclick="confirmDeletePemain('${pemain.id_pemain}', '${pemain.nama_pemain}')" ${isLocked ? 'disabled title="Melebihi batas 3 hari edit"' : ''}><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
    } else {
        const colspan = currentUser.type_users === 'ADMIN_PUSAT' ? 7 : 6;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Tidak ada data pemain ditemukan.</td></tr>`;
    }
}

function filterPemainList() {
    const input = document.getElementById('search-pemain');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('pemain-list-table');
    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) {
        const nama = tr[i].getAttribute('data-nama');
        const id = tr[i].getAttribute('data-id');
        if (nama || id) {
            if (nama.toUpperCase().indexOf(filter) > -1 || id.indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

async function getPemainDetail(id) {
    // Cari detail pemain dari global data
    return globalValidPemain.find(p => p.id_pemain === id) || {};
}

async function openPemainForm(id_pemain = null) {
    let data = { id_pemain: id_pemain, action: 'CREATE' };
    let isNew = true;

    if (id_pemain) {
        data = await getPemainDetail(id_pemain);
        data.action = 'UPDATE';
        isNew = false;
    }

    const formHtml = `
        ${isNew ? `
            <div class="col-md-12">
                <label for="id_pemain_input" class="form-label">ID Pemain (16 Digit Angka)</label>
                <input type="number" class="form-control" id="id_pemain_input" name="id_pemain_input" required>
            </div>
            ` : `
            <div class="col-md-6">
                <label class="form-label">ID Pemain</label>
                <input type="text" class="form-control" value="${data.id_pemain}" readonly>
                <input type="hidden" name="id_pemain" value="${data.id_pemain}">
            </div>
            <div class="col-md-6">
                <label class="form-label">Terakhir Diubah</label>
                <input type="text" class="form-control" value="${new Date(data.time_stamp).toLocaleString()}" readonly>
            </div>
        `}
        <div class="col-md-6">
            <label for="nama_pemain" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama_pemain" name="nama_pemain" value="${data.nama_pemain || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="posisi" class="form-label">Posisi</label>
            <select class="form-select" id="posisi" name="posisi" required>
                <option value="">Pilih Posisi</option>
                ${['GK', 'CB', 'LB', 'RB', 'CM', 'AM', 'LW', 'RW', 'ST'].map(p => `<option value="${p}" ${data.posisi === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="no_punggung" class="form-label">No. Punggung</label>
            <input type="number" class="form-control" id="no_punggung" name="no_punggung" value="${data.no_punggung || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="ktp_pemain_file" class="form-label">Foto KTP/Akte</label>
            <input type="file" class="form-control" id="ktp_pemain_file" name="ktp_pemain_file" accept="image/*" onchange="previewImage(event, 'ktp-preview')" ${isNew ? 'required' : ''}>
            <input type="hidden" name="ktp_pemain" value="${data.ktp_pemain || ''}">
            <small class="text-muted">${data.ktp_pemain ? 'File sudah ada' : ''}</small>
        </div>
        <div class="col-md-6">
            <label for="foto_pemain_file" class="form-label">Foto Pemain (Wajah)</label>
            <input type="file" class="form-control" id="foto_pemain_file" name="foto_pemain_file" accept="image/*" onchange="previewImage(event, 'foto-preview')" ${isNew ? 'required' : ''}>
            <input type="hidden" name="foto_pemain" value="${data.foto_pemain || ''}">
             <small class="text-muted">${data.foto_pemain ? 'File sudah ada' : ''}</small>
        </div>
        <div class="col-12 text-center row mt-3">
            <div class="col-md-6">
                <p class="mb-1">Preview KTP/Akte</p>
                <img id="ktp-preview" src="${data.ktp_pemain || 'https://via.placeholder.com/150?text=KTP'}" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            </div>
            <div class="col-md-6">
                <p class="mb-1">Preview Foto Wajah</p>
                <img id="foto-preview" src="${data.foto_pemain || 'https://via.placeholder.com/150?text=Foto'}" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            </div>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Pemain`, formHtml, handlePemainFormSubmit);
}

async function handlePemainFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PEMAIN', ['ktp_pemain_file', 'foto_pemain_file'], renderPemain);
}

async function showPemainDetail(id) {
    const pemain = await getPemainDetail(id);
    if (!pemain || !pemain.id_pemain) { showToast('Pemain tidak ditemukan.', false); return; }

    const detailHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${pemain.foto_pemain || 'https://via.placeholder.com/150?text=No+Foto'}" alt="Foto Pemain" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
        </div>
        <div class="col-md-6"><strong>ID Pemain:</strong> ${pemain.id_pemain}</div>
        <div class="col-md-6"><strong>Nama Lengkap:</strong> ${pemain.nama_pemain}</div>
        <div class="col-md-6"><strong>Tanggal Lahir:</strong> ${pemain.tanggal_lahir} (${calculateAge(pemain.tanggal_lahir)} thn)</div>
        <div class="col-md-6"><strong>Posisi:</strong> ${pemain.posisi}</div>
        <div class="col-md-6"><strong>No. Punggung:</strong> ${pemain.no_punggung}</div>
        <div class="col-md-6"><strong>ID Klub:</strong> ${pemain.id_klub}</div>
        <div class="col-12 mt-3">
            <strong>Dokumen KTP/Akte:</strong> 
            <a href="${pemain.ktp_pemain}" target="_blank" class="btn btn-sm btn-outline-primary ms-2"><i class="fas fa-file-image me-1"></i> Lihat Dokumen</a>
        </div>
    `;

    showModalForm(`Detail Pemain: ${pemain.nama_pemain}`, detailHtml, null, '');
}

function confirmDeletePemain(id, nama) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pemain **${nama}** (ID: ${id})?`, async () => {
        const data = { action: 'DELETE', id_pemain: id };
        const result = await callAppsScript('CRUD_PEMAIN', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderPemain();
        }
    });
}

// --- NAVIGASI OFFICIAL ---
async function renderOfficial() {
    const isKlubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
    const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-users me-2"></i>Data Official</h2>
        <div class="d-flex justify-content-between align-items-center mt-3 mb-3">
            <input type="text" class="form-control w-50" id="search-official" onkeyup="filterOfficialList()" placeholder="Cari Nama/ID Official...">
            ${isKlubAdmin ? `<button class="btn btn-primary" onclick="openOfficialForm()"><i class="fas fa-plus me-2"></i>Tambah Official</button>` : ''}
        </div>
        <div class="table-responsive">
            <table class="table table-striped table-hover" id="official-list-table">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Foto</th>
                        <th>ID Official</th>
                        <th>Nama</th>
                        <th>Jabatan</th>
                        <th>Tgl Lahir / Umur</th>
                        ${isPusatAdmin ? '<th>Klub</th>' : ''}
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="${isPusatAdmin ? 7 : 6}" class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    loadOfficialList();
}

async function loadOfficialList() {
    const result = await callAppsScript('GET_OFFICIAL');
    const tbody = document.querySelector('#official-list-table tbody');
    tbody.innerHTML = '';
    
    if (result && result.success && Array.isArray(result.data)) {
        globalValidOfficial = result.data; // Simpan data global untuk filtering

        const dataToDisplay = currentUser.type_users.startsWith('ADMIN_KLUB')
            ? result.data.filter(o => o.id_klub === currentUser.id_klub)
            : result.data;

        dataToDisplay.forEach(official => {
            const age = calculateAge(official.tanggal_lahir);
            const isKlubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
            const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
            const isLocked = isKlubAdmin && !isEditable(official.time_stamp, currentUser.type_users);

            tbody.innerHTML += `
                <tr data-nama="${official.nama_official}" data-id="${official.id_official}" data-klub="${official.nama_klub || ''}">
                    <td><img src="${official.foto_official || 'https://via.placeholder.com/30'}" alt="Foto" style="width: 30px; height: 30px; object-fit: cover;"></td>
                    <td>${official.id_official}</td>
                    <td>${official.nama_official}</td>
                    <td>${official.jabatan}</td>
                    <td>${official.tanggal_lahir} (${age} thn)</td>
                    ${isPusatAdmin ? `<td>${official.id_klub}</td>` : ''}
                    <td>
                        <button class="btn btn-sm btn-info text-white" onclick="showOfficialDetail('${official.id_official}')"><i class="fas fa-eye"></i></button>
                        ${isKlubAdmin ? `
                            <button class="btn btn-sm btn-warning ${isLocked ? 'disabled' : ''}" onclick="openOfficialForm('${official.id_official}')" ${isLocked ? 'disabled title="Melebihi batas 3 hari edit"' : ''}><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger ${isLocked ? 'disabled' : ''}" onclick="confirmDeleteOfficial('${official.id_official}', '${official.nama_official}')" ${isLocked ? 'disabled title="Melebihi batas 3 hari edit"' : ''}><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
    } else {
        const colspan = currentUser.type_users === 'ADMIN_PUSAT' ? 7 : 6;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Tidak ada data official ditemukan.</td></tr>`;
    }
}

function filterOfficialList() {
    const input = document.getElementById('search-official');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('official-list-table');
    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) {
        const nama = tr[i].getAttribute('data-nama');
        const id = tr[i].getAttribute('data-id');
        if (nama || id) {
            if (nama.toUpperCase().indexOf(filter) > -1 || id.indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

async function getOfficialDetail(id) {
    return globalValidOfficial.find(o => o.id_official === id) || {};
}

async function openOfficialForm(id_official = null) {
    let data = { id_official: id_official, action: 'CREATE' };
    let isNew = true;

    if (id_official) {
        data = await getOfficialDetail(id_official);
        data.action = 'UPDATE';
        isNew = false;
    }

    const formHtml = `
        ${isNew ? `
            <div class="col-md-12">
                <label for="id_official_input" class="form-label">ID Official (16 Digit Angka)</label>
                <input type="number" class="form-control" id="id_official_input" name="id_official_input" required>
            </div>
            ` : `
            <div class="col-md-6">
                <label class="form-label">ID Official</label>
                <input type="text" class="form-control" value="${data.id_official}" readonly>
                <input type="hidden" name="id_official" value="${data.id_official}">
            </div>
            <div class="col-md-6">
                <label class="form-label">Terakhir Diubah</label>
                <input type="text" class="form-control" value="${new Date(data.time_stamp).toLocaleString()}" readonly>
            </div>
        `}
        <div class="col-md-6">
            <label for="nama_official" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama_official" name="nama_official" value="${data.nama_official || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="jabatan" class="form-label">Jabatan</label>
            <input type="text" class="form-control" id="jabatan" name="jabatan" value="${data.jabatan || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="lisensi" class="form-label">Lisensi/Sertifikat</label>
            <input type="text" class="form-control" id="lisensi" name="lisensi" value="${data.lisensi || ''}">
        </div>
        <div class="col-md-6">
            <label for="ktp_official_file" class="form-label">Foto KTP/Akte</label>
            <input type="file" class="form-control" id="ktp_official_file" name="ktp_official_file" accept="image/*" onchange="previewImage(event, 'ktp-preview')" ${isNew ? 'required' : ''}>
            <input type="hidden" name="ktp_official" value="${data.ktp_official || ''}">
            <small class="text-muted">${data.ktp_official ? 'File sudah ada' : ''}</small>
        </div>
        <div class="col-md-6">
            <label for="foto_official_file" class="form-label">Foto Official (Wajah)</label>
            <input type="file" class="form-control" id="foto_official_file" name="foto_official_file" accept="image/*" onchange="previewImage(event, 'foto-preview')" ${isNew ? 'required' : ''}>
            <input type="hidden" name="foto_official" value="${data.foto_official || ''}">
             <small class="text-muted">${data.foto_official ? 'File sudah ada' : ''}</small>
        </div>
        <div class="col-12 text-center row mt-3">
            <div class="col-md-6">
                <p class="mb-1">Preview KTP/Akte</p>
                <img id="ktp-preview" src="${data.ktp_official || 'https://via.placeholder.com/150?text=KTP'}" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            </div>
            <div class="col-md-6">
                <p class="mb-1">Preview Foto Wajah</p>
                <img id="foto-preview" src="${data.foto_official || 'https://via.placeholder.com/150?text=Foto'}" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            </div>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Official`, formHtml, handleOfficialFormSubmit);
}

async function handleOfficialFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_OFFICIAL', ['ktp_official_file', 'foto_official_file'], renderOfficial);
}

async function showOfficialDetail(id) {
    const official = await getOfficialDetail(id);
    if (!official || !official.id_official) { showToast('Official tidak ditemukan.', false); return; }

    const detailHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${official.foto_official || 'https://via.placeholder.com/150?text=No+Foto'}" alt="Foto Official" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
        </div>
        <div class="col-md-6"><strong>ID Official:</strong> ${official.id_official}</div>
        <div class="col-md-6"><strong>Nama Lengkap:</strong> ${official.nama_official}</div>
        <div class="col-md-6"><strong>Tanggal Lahir:</strong> ${official.tanggal_lahir} (${calculateAge(official.tanggal_lahir)} thn)</div>
        <div class="col-md-6"><strong>Jabatan:</strong> ${official.jabatan}</div>
        <div class="col-md-6"><strong>Lisensi:</strong> ${official.lisensi || '-'}</div>
        <div class="col-md-6"><strong>ID Klub:</strong> ${official.id_klub}</div>
        <div class="col-12 mt-3">
            <strong>Dokumen KTP/Akte:</strong> 
            <a href="${official.ktp_official}" target="_blank" class="btn btn-sm btn-outline-primary ms-2"><i class="fas fa-file-image me-1"></i> Lihat Dokumen</a>
        </div>
    `;

    showModalForm(`Detail Official: ${official.nama_official}`, detailHtml, null, '');
}

function confirmDeleteOfficial(id, nama) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus official **${nama}** (ID: ${id})?`, async () => {
        const data = { action: 'DELETE', id_official: id };
        const result = await callAppsScript('CRUD_OFFICIAL', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderOfficial();
        }
    });
}

// --- NAVIGASI KOMPETISI & PRAKOMPETISI ---
async function renderKompetisi() {
    const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-trophy me-2"></i>Daftar Kompetisi</h2>
        ${isPusatAdmin ? `<button class="btn btn-primary my-3" onclick="openKompetisiForm()"><i class="fas fa-plus me-2"></i>Tambah Kompetisi</button>` : ''}
        <div class="table-responsive">
            <table class="table table-striped table-hover" id="kompetisi-list-table">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>ID</th>
                        <th>Nama Kompetisi</th>
                        <th>Usia Maks.</th>
                        <th>Periode Pendaftaran</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    loadKompetisiList();
}

async function loadKompetisiList() {
    const result = await callAppsScript('GET_LIST_KOMPETISI');
    const tbody = document.querySelector('#kompetisi-list-table tbody');
    tbody.innerHTML = '';
    const now = new Date().getTime();
    
    if (result && result.success && Array.isArray(result.data)) {
        result.data.forEach(k => {
            const start = new Date(k.tanggal_awal_pendaftaran).getTime();
            const end = new Date(k.tanggal_akhir_pendaftaran).getTime();
            let status = '';
            
            if (now < start) {
                status = `<span class="badge bg-warning">Segera Dibuka</span>`;
            } else if (now >= start && now <= end) {
                status = `<span class="badge bg-success">Pendaftaran Buka</span>`;
            } else {
                status = `<span class="badge bg-danger">Pendaftaran Tutup</span>`;
            }
            
            const isPusatAdmin = currentUser.type_users === 'ADMIN_PUSAT';
            const isKlubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');

            tbody.innerHTML += `
                <tr>
                    <td>${k.id_kompetisi}</td>
                    <td>${k.nama_kompetisi}</td>
                    <td>U-${k.umur_maksimal}</td>
                    <td>${k.tanggal_awal_pendaftaran} s/d ${k.tanggal_akhir_pendaftaran}</td>
                    <td>${status}</td>
                    <td>
                        ${isKlubAdmin && now >= start && now <= end ? 
                            `<button class="btn btn-sm btn-primary" onclick="renderPrakompetisi('${k.id_kompetisi}')"><i class="fas fa-file-signature me-1"></i> Daftar</button>` : ''}
                        ${isPusatAdmin ? `
                            <button class="btn btn-sm btn-warning text-white" onclick="openKompetisiForm('${k.id_kompetisi}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="confirmDeleteKompetisi('${k.id_kompetisi}', '${k.nama_kompetisi}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Tidak ada data kompetisi ditemukan.</td></tr>`;
    }
}

async function openKompetisiForm(id_kompetisi = null) {
    let data = { id_kompetisi: id_kompetisi, action: 'CREATE' };
    let isNew = true;

    if (id_kompetisi) {
        const result = await callAppsScript('GET_LIST_KOMPETISI');
        data = result.data.find(k => k.id_kompetisi === id_kompetisi) || data;
        data.action = 'UPDATE';
        isNew = false;
    }

    const formHtml = `
        <input type="hidden" name="id_kompetisi" value="${data.id_kompetisi || ''}">
        <input type="hidden" name="action" value="${data.action}">
        
        <div class="col-md-6">
            <label for="nama_kompetisi" class="form-label">Nama Kompetisi</label>
            <input type="text" class="form-control" id="nama_kompetisi" name="nama_kompetisi" value="${data.nama_kompetisi || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="umur_maksimal" class="form-label">Usia Maksimal (U-)</label>
            <input type="number" class="form-control" id="umur_maksimal" name="umur_maksimal" value="${data.umur_maksimal || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_awal_pendaftaran" class="form-label">Tgl Awal Pendaftaran</label>
            <input type="date" class="form-control" id="tanggal_awal_pendaftaran" name="tanggal_awal_pendaftaran" value="${data.tanggal_awal_pendaftaran || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_akhir_pendaftaran" class="form-label">Tgl Akhir Pendaftaran</label>
            <input type="date" class="form-control" id="tanggal_akhir_pendaftaran" name="tanggal_akhir_pendaftaran" value="${data.tanggal_akhir_pendaftaran || ''}" required>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit);
}

async function handleKompetisiFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_LIST_KOMPETISI', [], renderKompetisi);
}

function confirmDeleteKompetisi(id, nama) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus kompetisi **${nama}** (ID: ${id})?`, async () => {
        const data = { action: 'DELETE', id_kompetisi: id };
        const result = await callAppsScript('CRUD_LIST_KOMPETISI', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderKompetisi();
        }
    });
}

// --- NAVIGASI PRAKOMPETISI (REGISTRASI) ---
async function renderPrakompetisi(idKompetisi) {
    if (!idKompetisi) {
        const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
        if (kompetisiResult && kompetisiResult.success && Array.isArray(kompetisiResult.data)) {
            const now = new Date().getTime();
            const openKompetisi = kompetisiResult.data.filter(k => 
                now >= new Date(k.tanggal_awal_pendaftaran).getTime() && 
                now <= new Date(k.tanggal_akhir_pendaftaran).getTime()
            );
            
            if (openKompetisi.length > 0) {
                idKompetisi = openKompetisi[0].id_kompetisi;
            } else {
                contentDiv.innerHTML = `<div class="alert alert-info mt-3"><i class="fas fa-info-circle me-2"></i> Tidak ada kompetisi yang sedang membuka pendaftaran saat ini.</div>`;
                return;
            }
        } else {
            contentDiv.innerHTML = `<div class="alert alert-warning mt-3"><i class="fas fa-exclamation-triangle me-2"></i> Gagal memuat daftar kompetisi.</div>`;
            return;
        }
    }

    const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
    const kompetisi = kompetisiResult.data.find(k => k.id_kompetisi === idKompetisi);
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-file-signature me-2"></i>Registrasi: ${kompetisi.nama_kompetisi} (U-${kompetisi.umur_maksimal})</h2>
        <input type="hidden" id="current-comp-id" value="${idKompetisi}">
        
        <ul class="nav nav-tabs" id="prakompetisi-tab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="pemain-tab" data-bs-toggle="tab" data-bs-target="#pemain-content" type="button" role="tab" aria-controls="pemain-content" aria-selected="true"><i class="fas fa-running me-1"></i> Pemain</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="official-tab" data-bs-toggle="tab" data-bs-target="#official-content" type="button" role="tab" aria-controls="official-content" aria-selected="false"><i class="fas fa-users me-1"></i> Official</button>
            </li>
        </ul>
        <div class="tab-content" id="prakompetisi-tab-content">
            <div class="tab-pane fade show active" id="pemain-content" role="tabpanel" aria-labelledby="pemain-tab">
                <div class="mt-3" id="pemain-form-container">Memuat form pemain...</div>
            </div>
            <div class="tab-pane fade" id="official-content" role="tabpanel" aria-labelledby="official-tab">
                <div class="mt-3" id="official-form-container">Memuat form official...</div>
            </div>
        </div>
    `;

    loadPemainPrakompetisi(idKompetisi);
    document.getElementById('official-tab').addEventListener('shown.bs.tab', () => {
        loadOfficialPrakompetisi(idKompetisi);
    });
}

// === Prakompetisi Pemain ===
async function loadPemainPrakompetisi(idKompetisi) {
    const [filterResult, registerResult] = await Promise.all([
        callAppsScript('GET_FILTERED_PEMAIN', { id_kompetisi: idKompetisi }),
        callAppsScript('GET_REGISTERED_PEMAIN', { id_kompetisi: idKompetisi })
    ]);
    
    const availablePemain = filterResult.success ? filterResult.data.filter(p => p.id_klub === currentUser.id_klub) : [];
    const registeredPemain = registerResult.success ? registerResult.data : [];

    // Jika sudah terdaftar, gunakan data terdaftar. Jika tidak, sediakan 25 baris kosong.
    let listPemain = registeredPemain.length > 0 ? registeredPemain : Array(25).fill({}); 
    // Jika data terdaftar kurang dari 25, tambahkan baris kosong
    if (registeredPemain.length < 25) {
        listPemain = listPemain.concat(Array(25 - registeredPemain.length).fill({}));
    }

    const formContainer = document.getElementById('pemain-form-container');
    formContainer.innerHTML = `
        <p class="alert alert-info">Pemain yang muncul di dropdown adalah pemain yang terdaftar di klub Anda dan **memenuhi batas usia (U-${(await callAppsScript('GET_LIST_KOMPETISI')).data.find(k => k.id_kompetisi === idKompetisi).umur_maksimal})**.</p>
        <form id="prakompetisi-pemain-form" class="mb-4">
            <input type="hidden" name="id_kompetisi" value="${idKompetisi}">
            <div class="table-responsive">
                <table class="table table-bordered" id="pemain-registration-table">
                    <thead class="table-secondary">
                        <tr>
                            <th width="5%">No.</th>
                            <th width="30%">Nama Pemain (Wajib)</th>
                            <th width="15%">No. Punggung (Wajib)</th>
                            <th width="15%">Posisi (Wajib)</th>
                            <th width="20%">ID Pemain (Otomatis)</th>
                            <th width="15%">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="pemain-rows"></tbody>
                </table>
            </div>
            <p class="text-muted">Total terdaftar: <span id="pemain-count">0</span> dari 25</p>
            <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-secondary me-2" onclick="addRowPemainPrakompetisi('${idKompetisi}')"><i class="fas fa-plus"></i> Tambah Baris</button>
                <button type="submit" class="btn btn-success"><i class="fas fa-save me-2"></i>Simpan Registrasi Pemain</button>
            </div>
        </form>
    `;

    const tbody = document.getElementById('pemain-rows');
    tbody.innerHTML = '';
    
    listPemain.forEach((pemain, index) => {
        addRowPemainPrakompetisi(idKompetisi, index + 1, pemain, availablePemain);
    });

    document.getElementById('prakompetisi-pemain-form').addEventListener('submit', savePemainPrakompetisi);
}

function addRowPemainPrakompetisi(idKompetisi, index, data = {}, availablePemain = globalValidPemain.filter(p => p.id_klub === currentUser.id_klub)) {
    const tbody = document.getElementById('pemain-rows');
    const newIndex = index || tbody.children.length + 1;
    const playerId = data.id_pemain || '';
    
    // Pastikan data pemain yang sudah terdaftar ada di list available (jika ID-nya valid)
    const currentPemain = playerId ? availablePemain.find(p => p.id_pemain === playerId) || {} : {};

    const row = document.createElement('tr');
    row.id = `pemain-row-${newIndex}`;
    row.innerHTML = `
        <td>${newIndex}.</td>
        <td>
            <select class="form-select form-select-sm player-select" name="pemain_id_${newIndex}" 
                    onchange="updatePemainInfo(this, ${newIndex}, 'pemain')">
                <option value="">-- Pilih Pemain --</option>
                ${availablePemain.map(p => `
                    <option value="${p.id_pemain}" 
                            data-posisi="${p.posisi || ''}" 
                            data-nopunggung="${p.no_punggung || ''}" 
                            data-nama="${p.nama_pemain}"
                            ${playerId === p.id_pemain ? 'selected' : ''}>
                        ${p.nama_pemain} (No. ${p.no_punggung || '-'})
                    </option>
                `).join('')}
                ${playerId && !availablePemain.find(p => p.id_pemain === playerId) ? 
                    `<option value="${playerId}" selected class="text-danger">${data.nama_pemain || 'ID Invalid'}</option>` : ''}
            </select>
            <input type="hidden" class="player-nama-input" name="nama_pemain_${newIndex}" value="${data.nama_pemain || ''}">
        </td>
        <td><input type="number" class="form-control form-control-sm player-nopunggung" name="no_punggung_${newIndex}" value="${data.no_punggung || ''}" required></td>
        <td><input type="text" class="form-control form-control-sm player-posisi" name="posisi_${newIndex}" value="${data.posisi || ''}" required></td>
        <td><input type="text" class="form-control form-control-sm player-id-display" value="${playerId}" readonly></td>
        <td>
            <button type="button" class="btn btn-sm btn-danger" onclick="removeRow(${newIndex}, 'pemain')"><i class="fas fa-times"></i></button>
        </td>
    `;
    tbody.appendChild(row);
    document.getElementById('pemain-count').textContent = tbody.children.length;

    // Pastikan info terisi jika ini adalah data lama
    if(playerId && !currentPemain.nama_pemain) {
        // Jika pemain terdaftar tapi tidak di list filtered (mungkin batas usia berubah), biarkan datanya
        row.querySelector('.player-select').classList.add('is-invalid');
    }
}

function updatePemainInfo(selectElement, index, type) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const row = document.getElementById(`${type}-row-${index}`);

    if (selectedOption.value) {
        row.querySelector(`.${type}-id-display`).value = selectedOption.value;
        row.querySelector(`.${type}-nama-input`).value = selectedOption.getAttribute('data-nama');
        row.querySelector(`.${type}-nopunggung`).value = selectedOption.getAttribute('data-nopunggung') || '';
        row.querySelector(`.${type}-posisi`).value = selectedOption.getAttribute('data-posisi') || '';
        selectElement.classList.remove('is-invalid');
    } else {
        // Clear fields if option is "-- Pilih Pemain --"
        row.querySelector(`.${type}-id-display`).value = '';
        row.querySelector(`.${type}-nama-input`).value = '';
        row.querySelector(`.${type}-nopunggung`).value = '';
        row.querySelector(`.${type}-posisi`).value = '';
    }
}

function removeRow(index, type) {
    const row = document.getElementById(`${type}-row-${index}`);
    if (row) {
        row.remove();
        // Update count
        document.getElementById(`${type}-count`).textContent = document.getElementById(`${type}-rows`).children.length;
    }
}

async function savePemainPrakompetisi(e) {
    e.preventDefault();
    const form = e.target;
    const idKompetisi = form.querySelector('input[name="id_kompetisi"]').value;
    const rows = document.getElementById('pemain-rows').children;
    const entries = [];
    
    showLoading();

    for (const row of rows) {
        const select = row.querySelector('.player-select');
        const id = select.value;
        
        if (id) {
            const index = row.id.split('-').pop();
            const nama = row.querySelector(`input[name="nama_pemain_${index}"]`).value;
            const nopunggung = row.querySelector(`input[name="no_punggung_${index}"]`).value;
            const posisi = row.querySelector(`input[name="posisi_${index}"]`).value;

            if (!nama || !nopunggung || !posisi) {
                hideLoading();
                showToast(`Data pemain di baris ${index} tidak lengkap.`, false);
                return;
            }
            
            entries.push({
                id_pemain: id,
                nama_pemain: nama,
                no_punggung: nopunggung,
                posisi: posisi
            });
        }
    }

    if (entries.length > 25) {
         hideLoading();
         showToast("Maksimal 25 pemain yang dapat didaftarkan.", false);
         return;
    }

    const result = await callAppsScript('SAVE_PEMAIN_PRAKOMPETISI', { 
        id_kompetisi: idKompetisi, 
        entries: JSON.stringify(entries) 
    });
    
    hideLoading();
    if (result && result.success) {
        showToast(result.message);
        loadPemainPrakompetisi(idKompetisi); // Reload data
    } else if (result) {
        showToast(result.message, false);
    }
}

// === Prakompetisi Official ===
async function loadOfficialPrakompetisi(idKompetisi) {
    const registerResult = await callAppsScript('GET_REGISTERED_OFFICIAL', { id_kompetisi: idKompetisi });
    
    const availableOfficial = globalValidOfficial.filter(o => o.id_klub === currentUser.id_klub);
    const registeredOfficial = registerResult.success ? registerResult.data : [];

    let listOfficial = registeredOfficial.length > 0 ? registeredOfficial : Array(10).fill({}); 
    if (registeredOfficial.length < 10) {
        listOfficial = listOfficial.concat(Array(10 - registeredOfficial.length).fill({}));
    }

    const formContainer = document.getElementById('official-form-container');
    formContainer.innerHTML = `
        <p class="alert alert-info">Pilih Official yang terdaftar di klub Anda untuk registrasi kompetisi. Maksimal 10 Official.</p>
        <form id="prakompetisi-official-form" class="mb-4">
            <input type="hidden" name="id_kompetisi" value="${idKompetisi}">
            <div class="table-responsive">
                <table class="table table-bordered" id="official-registration-table">
                    <thead class="table-secondary">
                        <tr>
                            <th width="5%">No.</th>
                            <th width="40%">Nama Official (Wajib)</th>
                            <th width="30%">Jabatan (Otomatis)</th>
                            <th width="25%">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="official-rows"></tbody>
                </table>
            </div>
            <p class="text-muted">Total terdaftar: <span id="official-count">0</span> dari 10</p>
            <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-secondary me-2" onclick="addRowOfficialPrakompetisi('${idKompetisi}')"><i class="fas fa-plus"></i> Tambah Baris</button>
                <button type="submit" class="btn btn-success"><i class="fas fa-save me-2"></i>Simpan Registrasi Official</button>
            </div>
        </form>
    `;

    const tbody = document.getElementById('official-rows');
    tbody.innerHTML = '';
    
    listOfficial.forEach((official, index) => {
        addRowOfficialPrakompetisi(idKompetisi, index + 1, official, availableOfficial);
    });

    document.getElementById('prakompetisi-official-form').addEventListener('submit', saveOfficialPrakompetisi);
}

function addRowOfficialPrakompetisi(idKompetisi, index, data = {}, availableOfficial = globalValidOfficial.filter(o => o.id_klub === currentUser.id_klub)) {
    const tbody = document.getElementById('official-rows');
    const newIndex = index || tbody.children.length + 1;
    const officialId = data.id_official || '';
    
    const row = document.createElement('tr');
    row.id = `official-row-${newIndex}`;
    row.innerHTML = `
        <td>${newIndex}.</td>
        <td>
            <select class="form-select form-select-sm official-select" name="official_id_${newIndex}" 
                    onchange="updateOfficialInfo(this, ${newIndex}, 'official')">
                <option value="">-- Pilih Official --</option>
                ${availableOfficial.map(o => `
                    <option value="${o.id_official}" 
                            data-jabatan="${o.jabatan || ''}" 
                            data-nama="${o.nama_official}"
                            ${officialId === o.id_official ? 'selected' : ''}>
                        ${o.nama_official} (${o.jabatan || '-'})
                    </option>
                `).join('')}
                ${officialId && !availableOfficial.find(o => o.id_official === officialId) ? 
                    `<option value="${officialId}" selected class="text-danger">${data.nama_official || 'ID Invalid'}</option>` : ''}
            </select>
            <input type="hidden" class="official-nama-input" name="nama_official_${newIndex}" value="${data.nama_official || ''}">
        </td>
        <td><input type="text" class="form-control form-control-sm official-jabatan" name="jabatan_${newIndex}" value="${data.jabatan || ''}" readonly required></td>
        <td>
            <button type="button" class="btn btn-sm btn-danger" onclick="removeRow(${newIndex}, 'official')"><i class="fas fa-times"></i></button>
        </td>
    `;
    tbody.appendChild(row);
    document.getElementById('official-count').textContent = tbody.children.length;
}

async function saveOfficialPrakompetisi(e) {
    e.preventDefault();
    const form = e.target;
    const idKompetisi = form.querySelector('input[name="id_kompetisi"]').value;
    const rows = document.getElementById('official-rows').children;
    const entries = [];
    
    showLoading();

    for (const row of rows) {
        const select = row.querySelector('.official-select');
        const id = select.value;
        
        if (id) {
            const index = row.id.split('-').pop();
            const nama = row.querySelector(`input[name="nama_official_${index}"]`).value;
            const jabatan = row.querySelector(`input[name="jabatan_${index}"]`).value;

            if (!nama || !jabatan) {
                hideLoading();
                showToast(`Data official di baris ${index} tidak lengkap.`, false);
                return;
            }
            
            entries.push({
                id_official: id,
                nama_official: nama,
                jabatan: jabatan
            });
        }
    }
    
    if (entries.length > 10) {
         hideLoading();
         showToast("Maksimal 10 official yang dapat didaftarkan.", false);
         return;
    }

    const result = await callAppsScript('SAVE_OFFICIAL_PRAKOMPETISI', { 
        id_kompetisi: idKompetisi, 
        entries: JSON.stringify(entries) 
    });
    
    hideLoading();
    if (result && result.success) {
        showToast(result.message);
        loadOfficialPrakompetisi(idKompetisi); // Reload data
    } else if (result) {
        showToast(result.message, false);
    }
}

// --- NAVIGASI PENGATURAN (ADMIN PUSAT) ---
function renderSetting() {
    if (currentUser.type_users !== 'ADMIN_PUSAT') {
        contentDiv.innerHTML = `<div class="alert alert-danger mt-3">Akses Ditolak. Halaman ini hanya untuk Admin Pusat.</div>`;
        return;
    }
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-cog me-2"></i>Pengaturan Sistem</h2>
        <ul class="nav nav-tabs mt-3" id="setting-tab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="banner-tab" data-bs-toggle="tab" data-bs-target="#banner-content" type="button" role="tab" aria-controls="banner-content" aria-selected="true">Banner Info</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="userlist-tab" data-bs-toggle="tab" data-bs-target="#userlist-content" type="button" role="tab" aria-controls="userlist-content" aria-selected="false">Manajemen Pengguna</button>
            </li>
        </ul>
        <div class="tab-content card p-3" id="setting-tab-content">
            <div class="tab-pane fade show active" id="banner-content" role="tabpanel" aria-labelledby="banner-tab">
                <div id="banner-setting-container">Memuat...</div>
            </div>
            <div class="tab-pane fade" id="userlist-content" role="tabpanel" aria-labelledby="userlist-tab">
                <div id="userlist-setting-container">Memuat...</div>
            </div>
        </div>
    `;
    
    loadBannerSetting();
    document.getElementById('userlist-tab').addEventListener('shown.bs.tab', loadUserlistSetting);
}

// === Banner Setting ===
async function loadBannerSetting() {
    const container = document.getElementById('banner-setting-container');
    const result = await callAppsScript('GET_BANNERS');
    const data = result && result.success ? result.data : {};
    
    container.innerHTML = `
        <form id="banner-form" class="row g-3">
            <p class="text-muted">Atur 3 URL gambar banner yang akan tampil di halaman utama (Dashboard).</p>
            ${[1, 2, 3].map(i => `
                <div class="col-md-4">
                    <label for="url_banner${i}" class="form-label">URL Banner ${i}</label>
                    <input type="text" class="form-control" id="url_banner${i}" name="url_banner${i}" value="${data[`url_banner${i}`] || ''}">
                    <a href="${data[`url_banner${i}`] || '#'}" target="_blank" class="text-sm d-block mt-1">Lihat</a>
                </div>
            `).join('')}
            <div class="col-12 mt-4">
                <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i>Simpan Pengaturan Banner</button>
            </div>
        </form>
    `;
    
    document.getElementById('banner-form').addEventListener('submit', handleBannerFormSubmit);
}

async function handleBannerFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const result = await callAppsScript('CRUD_BANNER', { data: JSON.stringify(data) });
    
    if (result && result.success) {
        showToast(result.message);
        loadBannerSetting(); // Reload form
        loadBanners(); // Reload banner di Home
    } else if (result) {
        showToast(result.message, false);
    }
}

// === Userlist Setting ===
async function loadUserlistSetting() {
    const container = document.getElementById('userlist-setting-container');
    container.innerHTML = `<button class="btn btn-primary mb-3" onclick="openUserlistForm()"><i class="fas fa-user-plus me-2"></i>Tambah Pengguna</button>`;
    
    const tableHtml = `
        <div class="table-responsive">
            <table class="table table-striped table-hover" id="userlist-table">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Username</th>
                        <th>Tipe Pengguna</th>
                        <th>ID Klub</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML += tableHtml;

    const result = await callAppsScript('GET_USERLIST');
    const tbody = document.querySelector('#userlist-table tbody');
    tbody.innerHTML = '';
    
    if (result && result.success && Array.isArray(result.data)) {
        result.data.forEach(user => {
            tbody.innerHTML += `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.type_users}</td>
                    <td>${user.id_klub || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning text-white" onclick="openUserlistForm('${user.username}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${user.username}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data pengguna ditemukan.</td></tr>`;
    }
}

async function openUserlistForm(username = null) {
    let data = { username: username, action: 'CREATE' };
    let isNew = true;

    if (username) {
        const result = await callAppsScript('GET_USERLIST');
        data = result.data.find(u => u.username === username) || data;
        data.action = 'UPDATE';
        isNew = false;
    }

    const typeOptions = ['ADMIN_PUSAT', 'ADMIN_KLUB'];

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        
        <div class="col-md-6">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" ${isNew ? 'required' : 'readonly'}>
        </div>
        <div class="col-md-6">
            <label for="password" class="form-label">Password ${isNew ? '(Wajib)' : '(Kosongkan jika tidak diubah)'}</label>
            <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-6">
            <label for="type_users" class="form-label">Tipe Pengguna</label>
            <select class="form-select" id="type_users" name="type_users" required>
                ${typeOptions.map(t => `<option value="${t}" ${data.type_users === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="id_klub" class="form-label">ID Klub (Wajib untuk ADMIN_KLUB)</label>
            <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub || ''}">
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pengguna`, formHtml, handleUserlistFormSubmit);
}

async function handleUserlistFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_USERLIST', [], loadUserlistSetting);
}

function confirmDeleteUserlist(username) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pengguna **${username}**?`, async () => {
        const data = { action: 'DELETE', username: username };
        const result = await callAppsScript('CRUD_USERLIST', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadUserlistSetting();
        }
    });
}

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', renderApp);
