const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbwULvs_KrTTGdq0s1J5OOgRKF3r8iGqgqKDoGZYcVNlEIGO7UOABejoBY67qVJhEVU0oQ/exec";

// --- MONKEY PATCH FETCH PARA INYECCIÓN Y VALIDACIÓN DE TOKENS ---
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        if (typeof url === 'string' && url.includes('script.google.com') && options && options.body && typeof options.body === 'string') {
            try {
                const data = JSON.parse(options.body);
                if (data && typeof data === 'object' && !data.token) {
                    data.token = localStorage.getItem('session_token') || '';
                    options.body = JSON.stringify(data);
                }
            } catch (e) {
                console.error("Error al interceptar petición de API:", e);
            }
        }
        
        const response = await originalFetch(url, options);
        
        if (typeof url === 'string' && url.includes('script.google.com') && response.ok) {
            try {
                const clone = response.clone();
                const json = await clone.json();
                if (json && json.session_invalid) {
                    localStorage.removeItem('logged_user');
                    localStorage.removeItem('current_perfil');
                    localStorage.removeItem('session_token');
                    
                    Swal.fire({
                        icon: 'warning',
                        title: 'Sesión Expirada',
                        text: json.message || 'Tu sesión ha expirado o no es válida. Por favor, inicia sesión de nuevo.',
                        background: '#151515', color: '#fff',
                        confirmButtonColor: '#1d4ed8'
                    }).then(() => {
                        window.location.reload();
                    });
                    
                    return new Response(JSON.stringify({ status: "error", message: "Sesión inválida" }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (e) {
                // Ignorar si no es JSON válido o no clonable
            }
        }
        
        return response;
    };
})();

function getFirstImage(fotoField) {
    if (!fotoField) return '';
    const parts = String(fotoField).split(',');
    return parts[0].trim();
}

async function get_configs() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "get_configs" })
        });
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Error al obtener configuraciones:", error);
        return null;
    }
}

async function get_personalizations() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "get_personalizations" })
        });
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Error al obtener personalizaciones:", error);
        return null;
    }
}

async function search(filtros = { nombre: "", tipo: "", version: "", genero: "" }) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "search", filtros })
        });
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Error al buscar productos:", error);
        return [];
    }
}

async function login_client(usuario, password) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "login_client", usuario, password })
        });
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Error en login:", error);
        return { status: "error", message: "Error de conexión: " + error.message };
    }
}
async function uploadImageToDrive(base64Data, fileName) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "upload_image", image_data: base64Data, file_name: fileName })
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Error al subir imagen a Drive:", error);
        return { status: "error", message: "Error al conectar para subir imagen." };
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews(container, imagesArray) {
    if (!container) return;
    container.innerHTML = '';
    const urls = (Array.isArray(imagesArray) ? imagesArray : [imagesArray]).map(u => String(u || '').trim()).filter(Boolean);
    if (urls.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    if (urls.length === 1) {
        const img = document.createElement('img');
        img.src = urls[0];
        img.className = 'h-32 rounded-lg border border-white/10 object-contain bg-dark col-span-4 w-full';
        img.id = 'preview-foto';
        img.alt = 'Preview';
        container.appendChild(img);
    } else {
        urls.forEach((url, i) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-dark group h-20 w-20 flex-shrink-0';
            
            const img = document.createElement('img');
            img.src = url;
            img.className = 'w-full h-full object-cover';
            img.alt = `Preview ${i + 1}`;
            
            wrapper.appendChild(img);
            container.appendChild(wrapper);
        });
    }
}
// --- FIN DE api.js ---

// --- INICIO DE app.js ---
const DOM = {
    login: {
        overlay: document.getElementById('login-overlay'),
        form: document.getElementById('form-login'),
        usuario: document.getElementById('login-usuario'),
        password: document.getElementById('login-password'),
        btnSubmit: document.getElementById('btn-submit-login')
    },
    navUserBadge: document.getElementById('nav-user-badge'),
    navUserName: document.getElementById('nav-user-name'),
    headerLogoBadge: document.getElementById('header-logo-badge'),
    mobileHeaderLogoBadge: document.getElementById('mobile-header-logo-badge'),
    adminSubperfilSelect: document.getElementById('admin-subperfil-select'),
    btnOpenCart: document.getElementById('btn-open-cart'),
    cartCount: document.getElementById('cart-count'),
    actions: {
        logout: document.querySelectorAll('.action-logout'),
        navCatalogo: document.querySelectorAll('.action-nav-catalogo'),
        navJerseysView: document.querySelectorAll('.action-nav-jerseys-view'),
        openCreate: document.querySelectorAll('.action-open-create'),
        openList: document.querySelectorAll('.action-open-list'),
        openClients: document.querySelectorAll('.action-open-clients'),
        openOrders: document.querySelectorAll('.action-open-orders'),
        openExcelOrders: document.querySelectorAll('.action-open-excel-orders')
    },
    mobileMenu: {
        toggleBtn: document.getElementById('btn-mobile-menu-toggle'),
        closeBtn: document.getElementById('btn-close-mobile-menu'),
        overlay: document.getElementById('mobile-menu-overlay'),
        drawer: document.getElementById('mobile-menu-drawer'),
        userName: document.getElementById('mobile-nav-user-name'),
        adminSection: document.getElementById('mobile-admin-section'),
        adminSubperfilSelect: document.getElementById('mobile-admin-subperfil-select')
    },
    cart: {
        modal: document.getElementById('cart-modal'),
        closeBtn: document.getElementById('close-cart-modal'),
        loggedName: document.getElementById('cart-logged-name'),
        loggedPerfil: document.getElementById('cart-logged-perfil'),
        itemsContainer: document.getElementById('cart-items-container'),
        emptyMessage: document.getElementById('cart-empty-message'),
        subtotalVal: document.getElementById('cart-subtotal-val'),
        personalizacionesVal: document.getElementById('cart-personalizaciones-val'),
        totalVal: document.getElementById('cart-total-val'),
        btnEmpty: document.getElementById('btn-empty-cart'),
        btnSubmit: document.getElementById('btn-submit-order')
    },
    pedido: {
        modal: document.getElementById('add-to-pedido-modal'),
        closeBtn: document.getElementById('close-pedido-modal'),
        form: document.getElementById('form-add-to-pedido'),
        talla: document.getElementById('pedido-talla'),
        cantidad: document.getElementById('pedido-cantidad'),
        personalizacion: document.getElementById('pedido-personalizacion'),
        personalizacionPrecio: document.getElementById('pedido-personalizacion-precio'),
        personalizacionRegla: document.getElementById('pedido-personalizacion-regla'),
        customTextContainer: document.getElementById('pedido-custom-text-container'),
        customText: document.getElementById('pedido-custom-text'),
        stockInfo: document.getElementById('pedido-stock-info'),
        img: document.getElementById('pedido-modal-img'),
        name: document.getElementById('pedido-modal-jersey-name'),
        desc: document.getElementById('pedido-modal-jersey-desc'),
        btnCancel: document.getElementById('btn-cancel-pedido')
    },
    grid: document.getElementById('products-grid'),
    emptyState: document.getElementById('empty-state'),
    resultsCount: document.getElementById('results-count'),
    skeletonTemplate: document.getElementById('skeleton-template'),
    filters: {
        nombre: document.getElementById('filter-nombre'),
        genero: document.getElementById('filter-genero'),
        version: document.getElementById('filter-version'),
        tipo: document.getElementById('filter-tipo')
    },
    btnAplicar: document.getElementById('btn-aplicar'),
    filtrosContainer: document.getElementById('container-filtros'),
    btnToggleFiltros: document.getElementById('btn-toggle-filters'),
    iconToggleFiltros: document.getElementById('icon-toggle-filters'),
    modal: {
        overlay: document.getElementById('image-modal'),
        img: document.getElementById('modal-image'),
        closeBtn: document.getElementById('close-modal')
    },
    admin: {
        createModal: document.getElementById('admin-create-modal'),
        closeCreateModal: document.getElementById('close-create-modal'),
        listModal: document.getElementById('admin-list-modal'),
        closeListModal: document.getElementById('close-list-modal'),
        invModal: document.getElementById('admin-inventory-modal'),
        closeInvModal: document.getElementById('close-inventory-modal'),
        invImg: document.getElementById('inv-modal-img'),
        invTitle: document.getElementById('inv-modal-title'),
        invId: document.getElementById('inv-modal-id'),
        invTallasList: document.getElementById('inv-tallas-list'),
        btnCancelCreate: document.getElementById('btn-cancel-create'),
        formCreate: document.getElementById('form-create-product'),
        tallasContainer: document.getElementById('tallas-container'),
        btnAddTalla: document.getElementById('btn-add-talla'),
        createSelects: {
            tipo: document.getElementById('create-tipo'),
            version: document.getElementById('create-version'),
            genero: document.getElementById('create-genero')
        },
        fotoInput: document.getElementById('create-foto'),
        fotoPreview: document.getElementById('preview-foto'),
        createFotoFile: document.getElementById('create-foto-file'),
        createFotoFileInfo: document.getElementById('create-foto-file-info'),
        fotoPreviewContainer: document.getElementById('preview-foto-container'),
        newTallaVal: document.getElementById('new-talla-val'),
        newStockVal: document.getElementById('new-stock-val'),
        formAddTalla: document.getElementById('form-add-talla'),
        precioMenudeo: document.getElementById('create-precio-menudeo'),
        precioMayoreo: document.getElementById('create-precio-mayoreo'),
        precioMayoreoSuper: document.getElementById('create-precio-mayoreo-super'),
        formUpdatePrecios: document.getElementById('form-update-precios'),
        updateNombre: document.getElementById('update-nombre'),
        updateSelects: {
            tipo: document.getElementById('update-tipo'),
            version: document.getElementById('update-version'),
            genero: document.getElementById('update-genero'),
            personalizacion: document.getElementById('update-personalizacion')
        },
        updateFotoUrl: document.getElementById('update-foto-url'),
        updateFotoFile: document.getElementById('update-foto-file'),
        updateFotoFileInfo: document.getElementById('update-foto-file-info'),
        updateFotoPreviewContainer: document.getElementById('update-preview-foto-container'),
        updatePrecioMenudeo: document.getElementById('update-precio-menudeo'),
        updatePrecioMayoreo: document.getElementById('update-precio-mayoreo'),
        updatePrecioMayoreoSuper: document.getElementById('update-precio-mayoreo-super'),
        filterSearch: document.getElementById('admin-filter-search'),
        filterTipo: document.getElementById('admin-filter-tipo'),
        filterVersion: document.getElementById('admin-filter-version'),
        filterGenero: document.getElementById('admin-filter-genero'),
        pagePrev: document.getElementById('admin-page-prev'),
        pageNext: document.getElementById('admin-page-next'),
        pageInfo: document.getElementById('admin-pagination-info'),
        tableBody: document.getElementById('admin-table-body'),
        listEmpty: document.getElementById('admin-list-empty'),
        adminMenúuWrapper: document.getElementById('admin-menu-wrapper'),
        clientsModal: document.getElementById('admin-clients-modal'),
        closeClientsModal: document.getElementById('close-clients-modal'),
        clientFilterSearch: document.getElementById('client-filter-search'),
        btnOpenCreateClient: document.getElementById('btn-open-create-client'),
        clientTableBody: document.getElementById('client-table-body'),
        clientListEmpty: document.getElementById('client-list-empty'),
        clientPagePrev: document.getElementById('client-page-prev'),
        clientPageNext: document.getElementById('client-page-next'),
        clientPageInfo: document.getElementById('client-pagination-info'),
        clientFormModal: document.getElementById('admin-client-form-modal'),
        closeClientFormModal: document.getElementById('close-client-form-modal'),
        clientFormTitle: document.getElementById('client-form-title'),
        formClient: document.getElementById('form-client'),
        btnCancelClient: document.getElementById('btn-cancel-client'),
        clientInputs: {
            nombre: document.getElementById('client-nombre'),
            telefono: document.getElementById('client-telefono'),
            usuario: document.getElementById('client-usuario'),
            password: document.getElementById('client-password'),
            perfil: document.getElementById('client-perfil'),
            calle: document.getElementById('client-calle'),
            numero: document.getElementById('client-numero'),
            colonia: document.getElementById('client-colonia'),
            municipio: document.getElementById('client-municipio'),
            cp: document.getElementById('client-cp'),
            referencias: document.getElementById('client-referencias')
        },
        Ordenes: {
            modal: document.getElementById('admin-ordenes-modal'),
            closeBtn: document.getElementById('close-ordenes-modal'),
            btnBuscar: document.getElementById('btn-admin-ordenes-buscar'),
            filtros: {
                nombre: document.getElementById('admin-ordenes-filtro-nombre'),
                id: document.getElementById('admin-ordenes-filtro-id'),
                estatus: document.getElementById('admin-ordenes-filtro-estatus')
            },
            listContainer: document.getElementById('admin-ordenes-list'),
            emptyState: document.getElementById('admin-ordenes-empty'),
            loadingState: document.getElementById('admin-ordenes-loading')
        },
        excelOrders: {
            modal: document.getElementById('admin-excel-orders-modal'),
            closeBtn: document.getElementById('close-excel-orders-modal'),
            form: document.getElementById('form-excel-pedido-nuevo'),
            inputs: {
                code: document.getElementById('excel-pedido-code'),
                foto: document.getElementById('excel-pedido-foto'),
                fotoInfo: document.getElementById('excel-pedido-foto-info'),
                imgPreviewContainer: document.getElementById('excel-pedido-img-preview-container'),
                imgPreview: document.getElementById('excel-pedido-img-preview'),
                imgClear: document.getElementById('excel-pedido-img-clear'),
                version: document.getElementById('excel-pedido-version'),
                genero: document.getElementById('excel-pedido-genero'),
                size: document.getElementById('excel-pedido-size'),
                qty: document.getElementById('excel-pedido-qty'),
                name: document.getElementById('excel-pedido-name'),
                number: document.getElementById('excel-pedido-number'),
                patch: document.getElementById('excel-pedido-patch'),
                price: document.getElementById('excel-pedido-price')
            },
            tableBody: document.getElementById('excel-pedido-table-body'),
            tableEmpty: document.getElementById('excel-pedido-table-empty'),
            countBadge: document.getElementById('excel-pedido-count-badge'),
            totalQty: document.getElementById('excel-pedido-total-qty'),
            btnDescargar: document.getElementById('btn-excel-pedido-descargar')
        }
    },
    perfil: {
        modal: document.getElementById('user-perfil-modal'),
        closeBtn: document.getElementById('close-user-perfil-modal'),
        btnCancel: document.getElementById('btn-cancel-perfil'),
        btnMiPerfilDesktop: document.getElementById('btn-mi-perfil-desktop'),
        btnMiPerfilMobile: document.getElementById('btn-mi-perfil-mobile'),
        form: document.getElementById('form-user-perfil'),
        avatarPreview: document.getElementById('perfil-avatar-preview'),
        inputFile: document.getElementById('perfil-input-file'),
        inputs: {
            nombre: document.getElementById('perfil-nombre'),
            telefono: document.getElementById('perfil-telefono'),
            usuario: document.getElementById('perfil-usuario'),
            password: document.getElementById('perfil-password'),
            calle: document.getElementById('perfil-calle'),
            numero: document.getElementById('perfil-numero'),
            colonia: document.getElementById('perfil-colonia'),
            municipio: document.getElementById('perfil-municipio'),
            cp: document.getElementById('perfil-cp'),
            referencias: document.getElementById('perfil-referencias')
        }
    }
};

let currentJerseyToManage = null;
let adminCurrentPage = 1;
const adminItemsPerPage = 5;
let adminFilteredProducts = [];

let isFirstLoad = true;
let allProducts = []; // Para búsqueda local

let allClients = [];
let clientsFiltered = [];
let clientCurrentPage = 1;
const clientsPerPage = 5;
let configTallasHombre = [];
let configTallasDama = [];
let configTallasNino = [];
let editingClientId = null;

// Variables de estado del Carrito y Pedidos
let currentView = "mis-jerseys"; // "mis-jerseys" o "jerseys-pedido"
let cart = []; // Artículos en el carrito
let allPersonalizaciones = []; // Catálogo de personalizaciones
let reglasMayoreoSuper = { piezas_jugador: 10, piezas_fan: 15 };
let reglasEnvio = [];
const defaultPersonalizaciones = [
    { id: "PERS-001", nombre: "Pers 22 Cm", precio_Menudeo: 70, precio_mayoreo: 100 },
    { id: "PERS-002", nombre: "Pers 26.5 Cm", precio_Menudeo: 85, precio_mayoreo: 120 },
    { id: "PERS-003", nombre: "Pers 26.5 Cm y 10 Cm (Atras y Adelante)", precio_Menudeo: 95, precio_mayoreo: 130 },
    { id: "PERS-004", nombre: "Personalizacion Oficial (Atras y Adelante)", precio_Menudeo: 125, precio_mayoreo: 150 }
];
let currentJerseyForPedido = null; // Jersey activo para configurar en el modal


function getGenderColorClass(genero) {
    const gen = (genero || '').toLowerCase();
    if (gen.includes('hombre')) {
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    } else if (gen.includes('niño') || gen.includes('unisex')) {
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else if (gen.includes('mujer') || gen.includes('dama')) {
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
    return 'bg-white/5 text-gray-400 border-white/10';
}

function updateUserLogoInitial(username, imgUrl) {
    const headerBadge = DOM.headerLogoBadge;
    const mobileBadge = DOM.mobileHeaderLogoBadge;
    
    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    const isSuper = isSuperMayoreoActivo && esPerfilSuperMayoreo(activeProfile);
    
    const bgClass = isSuper ? 'bg-amber-500' : 'bg-navy-500';
    const oldBgClass = isSuper ? 'bg-navy-500' : 'bg-amber-500';
    
    if (imgUrl && String(imgUrl).trim().startsWith('http')) {
        const urlClean = String(imgUrl).trim();
        if (headerBadge) {
            headerBadge.classList.remove('bg-navy-500', 'bg-amber-500');
            headerBadge.innerHTML = `<img src="${urlClean}" class="w-full h-full object-cover shadow-inner z-10" alt="Avatar">`;
        }
        if (mobileBadge) {
            mobileBadge.classList.remove('bg-navy-500', 'bg-amber-500');
            mobileBadge.innerHTML = `<img src="${urlClean}" class="w-full h-full object-cover shadow-inner z-10" alt="Avatar">`;
        }
    } else {
        const letter = (username && username.trim().length > 0) 
            ? username.trim().charAt(0).toUpperCase() 
            : 'J';
        if (headerBadge) {
            headerBadge.classList.remove(oldBgClass);
            headerBadge.classList.add(bgClass);
            headerBadge.innerHTML = '';
            headerBadge.textContent = letter;
        }
        if (mobileBadge) {
            mobileBadge.classList.remove(oldBgClass);
            mobileBadge.classList.add(bgClass);
            mobileBadge.innerHTML = '';
            mobileBadge.textContent = letter;
        }
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
}

function abrirWhatsAppAutomatico(waUrl) {
    if (isMobileDevice()) {
        try {
            const newWindow = window.open(waUrl, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                window.location.href = waUrl;
            }
        } catch (e) {
            window.location.href = waUrl;
        }
    } else {
        window.open(waUrl, '_blank');
    }
}

function esPerfilSuperMayoreo(profile) {
    if (!profile) return false;
    const norm = String(profile).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return norm === 'super mayoreo' || norm === 'mayoreo super';
}

function esPerfilMayoreoOMas(profile) {
    if (!profile) return false;
    const norm = String(profile).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return norm === 'mayoreo' || norm === 'super mayoreo' || norm === 'mayoreo super';
}

function updateBrandTextColor() {
    const brandSpan = document.getElementById('brand-text-span');
    
    const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    
    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let profile = activeProfile;
    if (activeProfile === "Administrador") {
        profile = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    
    const isSuper = isSuperMayoreoActivo && esPerfilSuperMayoreo(profile);
    
    // Activar o desactivar el tema dorado en todo el cuerpo del documento (body)
    document.body.classList.toggle('theme-super-mayoreo', isSuper);
    
    if (brandSpan) {
        if (isSuper) {
            brandSpan.classList.remove('text-navy-400');
            brandSpan.classList.add('text-amber-400', 'font-semibold');
        } else {
            brandSpan.classList.add('text-navy-400');
            brandSpan.classList.remove('text-amber-400', 'font-semibold');
        }
    }
    
    // Cambiar color de fondo y glow del badge del logo del header
    const headerBadge = document.getElementById('header-logo-badge');
    if (headerBadge) {
        if (isSuper) {
            headerBadge.classList.remove('bg-navy-500', 'shadow-[0_0_15px_rgba(59,130,246,0.4)]');
            headerBadge.classList.add('bg-amber-500', 'shadow-[0_0_15px_rgba(245,158,11,0.5)]');
        } else {
            headerBadge.classList.remove('bg-amber-500', 'shadow-[0_0_15px_rgba(245,158,11,0.5)]');
            headerBadge.classList.add('bg-navy-500', 'shadow-[0_0_15px_rgba(59,130,246,0.4)]');
        }
    }

    const mobileHeaderBadge = document.getElementById('mobile-header-logo-badge');
    if (mobileHeaderBadge) {
        if (isSuper) {
            mobileHeaderBadge.classList.remove('bg-navy-500');
            mobileHeaderBadge.classList.add('bg-amber-500');
        } else {
            mobileHeaderBadge.classList.remove('bg-amber-500');
            mobileHeaderBadge.classList.add('bg-navy-500');
        }
    }
    
    // Forzar actualización de iniciales de usuario también
    const loggedUserStr = localStorage.getItem('logged_user');
    if (loggedUserStr) {
        const u = JSON.parse(loggedUserStr);
        updateUserLogoInitial(u.nombre_completo || u.usuario || 'Usuario', u.foto);
    }
}

// --- Control de Sesión por Inactividad ---
let inactivityTimer = null;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    
    // Solo inicia el contador si hay un usuario logueado
    if (localStorage.getItem('logged_user')) {
        inactivityTimer = setTimeout(() => {
            // Se agotó el tiempo
            localStorage.removeItem('logged_user');
            localStorage.removeItem('current_perfil');
            localStorage.removeItem('current_subperfil');
            localStorage.removeItem('session_token');
            
            Swal.fire({
                icon: 'warning',
                title: 'Sesión Expirada',
                text: 'Tu sesión se ha cerrado por inactividad. Por favor, inicia sesión de nuevo.',
                background: '#151515', color: '#fff',
                confirmButtonColor: '#1d4ed8',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                window.location.reload();
            });
        }, INACTIVITY_LIMIT_MS);
    }
}

function startInactivityMonitor() {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    // Iniciar el timer por primera vez
    resetInactivityTimer();
}

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    startInactivityMonitor();
    
    const loggedUserStr = localStorage.getItem('logged_user');
    let loggedUser = null;
    try {
        if (loggedUserStr) {
            loggedUser = JSON.parse(loggedUserStr);
        }
    } catch (e) {
        console.warn("Sesión corrupta detectada, limpiando credenciales:", e);
        localStorage.removeItem('logged_user');
        localStorage.removeItem('current_perfil');
        localStorage.removeItem('session_token');
    }
    
    if (!loggedUser) {
        DOM.login.overlay.classList.remove('hidden');
        DOM.login.form.addEventListener('submit', handleLoginSubmit);
    } else {
        DOM.login.overlay.classList.add('hidden');
        const userNameText = loggedUser.nombre_completo || loggedUser.usuario || 'Usuario';
        DOM.navUserName.textContent = userNameText;
        if (DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = userNameText;
        updateUserLogoInitial(userNameText, loggedUser.foto);
        DOM.navUserBadge.classList.remove('hidden');
        const navLogoutBtn = document.getElementById('nav-logout-btn');
        if (navLogoutBtn) {
            navLogoutBtn.classList.remove('hidden');
            navLogoutBtn.classList.add('sm:flex');
        }
        if (loggedUser.perfil === "Administrador") {
            if (DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.add('hidden');
            if (DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.add('hidden');
            if (DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.remove('hidden');
            if (DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.remove('hidden');
            const savedSub = localStorage.getItem('current_subperfil') || 'Mayoreo';
            if (DOM.adminSubperfilSelect) {
                DOM.adminSubperfilSelect.classList.remove('hidden');
                DOM.adminSubperfilSelect.value = savedSub;
            }
            if (DOM.mobileMenu.adminSubperfilSelect) {
                DOM.mobileMenu.adminSubperfilSelect.value = savedSub;
            }
        } else {
            if (DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.remove('hidden');
            if (DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.remove('hidden');
            if (DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.add('hidden');
            if (DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.add('hidden');
            if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.classList.add('hidden');
            
            // Refrescar perfil del usuario en segundo plano
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "get_client_profile", token: localStorage.getItem('session_token') || '' })
            }).then(r => r.json()).then(resData => {
                if (resData && resData.status === 'success' && resData.data) {
                    const user = resData.data;
                    localStorage.setItem('logged_user', JSON.stringify(user));
                    localStorage.setItem('current_perfil', user.perfil || 'Menudeo');
                    
                    const userNameText = user.nombre_completo || user.usuario || 'Usuario';
                    DOM.navUserName.textContent = userNameText;
                    if (DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = userNameText;
                    updateUserLogoInitial(userNameText, user.foto);
                    updateBrandTextColor();
                    applyProfileView();
                }
            }).catch(err => console.warn("Error al refrescar perfil en segundo plano:", err));
        }
    }

    renderSkeletons(6);
    
    // Cargar catálogos y catálogo de productos en paralelo (concurrencia)
    await Promise.all([
        loadCatalogs(),
        fetchInitialProducts()
    ]);
    
    updateBrandTextColor();
    
    // Cargar la lista de clientes en segundo plano al iniciar la app
    ensureClientsLoaded();
    
    // Listeners de Vistas del Header (Navegación)
    if (DOM.actions.logout) DOM.actions.logout.forEach(btn => btn.addEventListener('click', handleLogout));
    if (DOM.actions.navCatalogo) DOM.actions.navCatalogo.forEach(btn => btn.addEventListener('click', () => { switchView('mis-jerseys'); closemobileMenu(); }));
    if (DOM.actions.navJerseysView) DOM.actions.navJerseysView.forEach(btn => btn.addEventListener('click', () => { switchView('jerseys-pedido'); closemobileMenu(); }));
    if (DOM.btnOpenCart) {
        DOM.btnOpenCart.addEventListener('click', openCartModal);
    }

    function handleSubperfilChange(e) {
        const val = e.target.value;
        if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.value = val;
        if (DOM.mobileMenu.adminSubperfilSelect) DOM.mobileMenu.adminSubperfilSelect.value = val;
        localStorage.setItem('current_subperfil', val);
        applyProfileView();
        updateBrandTextColor();
    }
    if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.addEventListener('change', handleSubperfilChange);
    if (DOM.mobileMenu.adminSubperfilSelect) DOM.mobileMenu.adminSubperfilSelect.addEventListener('change', handleSubperfilChange);

    // Mobile Menúu Toggle
    if (DOM.mobileMenu.toggleBtn) {
        DOM.mobileMenu.toggleBtn.addEventListener('click', () => {
            if (DOM.mobileMenu.overlay) DOM.mobileMenu.overlay.classList.remove('hidden');
            setTimeout(() => {
                if (DOM.mobileMenu.overlay) DOM.mobileMenu.overlay.classList.remove('opacity-0');
                if (DOM.mobileMenu.drawer) DOM.mobileMenu.drawer.classList.remove('translate-x-full');
            }, 10);
        });
    }
    if (DOM.mobileMenu.closeBtn) DOM.mobileMenu.closeBtn.addEventListener('click', closemobileMenu);
    if (DOM.mobileMenu.overlay) {
        DOM.mobileMenu.overlay.addEventListener('click', (e) => {
            if (e.target === DOM.mobileMenu.overlay) closemobileMenu();
        });
    }

    function closemobileMenu() {
        if (!DOM.mobileMenu.overlay) return;
        DOM.mobileMenu.overlay.classList.add('opacity-0');
        if (DOM.mobileMenu.drawer) DOM.mobileMenu.drawer.classList.add('translate-x-full');
        setTimeout(() => {
            DOM.mobileMenu.overlay.classList.add('hidden');
        }, 300);
    }
    window.closemobileMenu = closemobileMenu;
    
    // Listeners del Modal de Carrito/Orden
    if (DOM.cart.closeBtn) DOM.cart.closeBtn.addEventListener('click', closeCartModal);
    if (DOM.cart.btnEmpty) DOM.cart.btnEmpty.addEventListener('click', emptyCart);
    if (DOM.cart.btnSubmit) DOM.cart.btnSubmit.addEventListener('click', submitOrder);
    if (DOM.cart.selectCliente) DOM.cart.selectCliente.addEventListener('change', handleCartClientChange);
    
    const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
    if (cartEnvioCheckbox) cartEnvioCheckbox.addEventListener('change', renderCartItems);
    
    // Listeners del Modal de Agregar a mi Pedido
    if (DOM.pedido.closeBtn) DOM.pedido.closeBtn.addEventListener('click', closePedidoModal);
    if (DOM.pedido.btnCancel) DOM.pedido.btnCancel.addEventListener('click', closePedidoModal);
    if (DOM.pedido.form) DOM.pedido.form.addEventListener('submit', handleAddToPedidoSubmit);
    if (DOM.pedido.personalizacion) DOM.pedido.personalizacion.addEventListener('change', handlePedidoPersonalizacionChange);
    if (DOM.pedido.talla) DOM.pedido.talla.addEventListener('change', handlePedidoTallaChange);
    if (DOM.pedido.cantidad) {
        DOM.pedido.cantidad.addEventListener('input', () => {
            const max = parseInt(DOM.pedido.cantidad.max);
            let val = parseInt(DOM.pedido.cantidad.value);
            if (!isNaN(max) && !isNaN(val) && val > max) {
                DOM.pedido.cantidad.value = max;
            }
        });
    }

    DOM.btnAplicar.addEventListener('click', handleLocalSearch);
    DOM.filters.nombre.addEventListener('input', handleLocalSearch);
    
    if (DOM.btnToggleFiltros) {
        DOM.btnToggleFiltros.addEventListener('click', toggleFiltros);
    }

    // Búsqueda automática al ¿¿Cambiar cualquier select
    DOM.filters.version.addEventListener('change', handleLocalSearch);
    DOM.filters.tipo.addEventListener('change', handleLocalSearch);
    DOM.filters.genero.addEventListener('change', handleLocalSearch);
    
    if (DOM.modal.closeBtn) DOM.modal.closeBtn.addEventListener('click', closeModal);
    if (DOM.modal.overlay) {
        DOM.modal.overlay.addEventListener('click', (e) => {
            if (e.target === DOM.modal.overlay) closeModal();
        });
        
        const modalPrevBtn = document.getElementById('modal-prev-btn');
        const modalNextBtn = document.getElementById('modal-next-btn');
        if (modalPrevBtn) {
            modalPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (modalImages.length <= 1) return;
                modalCurrentIndex = (modalCurrentIndex - 1 + modalImages.length) % modalImages.length;
                DOM.modal.img.src = modalImages[modalCurrentIndex];
            });
        }
        if (modalNextBtn) {
            modalNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (modalImages.length <= 1) return;
                modalCurrentIndex = (modalCurrentIndex + 1) % modalImages.length;
                DOM.modal.img.src = modalImages[modalCurrentIndex];
            });
        }
        
        // Navegación por teclado
        window.addEventListener('keydown', (e) => {
            if (!DOM.modal.overlay || DOM.modal.overlay.classList.contains('hidden')) return;
            if (e.key === 'ArrowLeft') {
                if (modalImages.length <= 1) return;
                modalCurrentIndex = (modalCurrentIndex - 1 + modalImages.length) % modalImages.length;
                DOM.modal.img.src = modalImages[modalCurrentIndex];
            } else if (e.key === 'ArrowRight') {
                if (modalImages.length <= 1) return;
                modalCurrentIndex = (modalCurrentIndex + 1) % modalImages.length;
                DOM.modal.img.src = modalImages[modalCurrentIndex];
            }
        });
    }
    
    // Eventos de Admin
    if (DOM.actions.openCreate) DOM.actions.openCreate.forEach(btn => btn.addEventListener('click', () => { openCreateModal(); closemobileMenu(); }));
    if (DOM.admin.closeCreateModal) DOM.admin.closeCreateModal.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnCancelCreate) DOM.admin.btnCancelCreate.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnAddTalla) DOM.admin.btnAddTalla.addEventListener('click', addTallaField);
    if (DOM.admin.formCreate) DOM.admin.formCreate.addEventListener('submit', handleCreateProduct);
    if (DOM.admin.createSelects.genero) {
        DOM.admin.createSelects.genero.addEventListener('change', () => {
            const selects = DOM.admin.tallasContainer.querySelectorAll('.talla-val');
            const optionsHtml = getTallasOptionsHtml();
            selects.forEach(select => {
                const prevValue = select.value;
                select.innerHTML = optionsHtml;
                if (Array.from(select.options).some(opt => opt.value === prevValue)) {
                    select.value = prevValue;
                }
            });
        });
    }
    if (DOM.actions.openList) DOM.actions.openList.forEach(btn => btn.addEventListener('click', () => { openListModal(); closemobileMenu(); }));
    if (DOM.admin.closeListModal) DOM.admin.closeListModal.addEventListener('click', closeListModal);
    
    if (DOM.admin.closeInvModal) DOM.admin.closeInvModal.addEventListener('click', closeInventoryModal);
    if (DOM.admin.formAddTalla) DOM.admin.formAddTalla.addEventListener('submit', handleAddNewTalla);
    if (DOM.admin.formUpdatePrecios) DOM.admin.formUpdatePrecios.addEventListener('submit', handleUpdatePrecios);
    
    // Filtros y paginación
    ['filterSearch', 'filterTipo', 'filterVersion', 'filterGenero'].forEach(id => {
        if(DOM.admin[id]) DOM.admin[id].addEventListener('input', applyAdminFilters);
    });
    if(DOM.admin.pagePrev) DOM.admin.pagePrev.addEventListener('click', () => { if(adminCurrentPage>1) {adminCurrentPage--; renderAdminTable();} });
    if(DOM.admin.pageNext) DOM.admin.pageNext.addEventListener('click', () => { if(adminCurrentPage*adminItemsPerPage < adminFilteredProducts.length) {adminCurrentPage++; renderAdminTable();} });

    if (DOM.admin.fotoInput) {
        DOM.admin.fotoInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const urls = val ? val.split(',') : [];
            renderImagePreviews(DOM.admin.fotoPreviewContainer, urls);
        });
    }

    if (DOM.admin.createFotoFile) {
        DOM.admin.createFotoFile.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {
                DOM.admin.createFotoFileInfo.textContent = 'Sin archivos seleccionados';
                DOM.admin.createFotoFileInfo.className = 'text-xs text-gray-400';
                DOM.admin.fotoInput.value = '';
                renderImagePreviews(DOM.admin.fotoPreviewContainer, []);
                return;
            }
            
            DOM.admin.createFotoFileInfo.textContent = `Subiendo ${files.length} archivo(s)...`;
            DOM.admin.createFotoFileInfo.className = 'text-xs text-amber-400 font-semibold animate-pulse';
            
            DOM.admin.fotoPreviewContainer.classList.remove('hidden');
            DOM.admin.fotoPreviewContainer.innerHTML = `
                <div class="col-span-4 flex flex-col items-center justify-center p-6 bg-dark-200/50 rounded-xl border border-white/5 w-full">
                    <svg class="animate-spin h-8 w-8 text-navy-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="text-xs text-gray-400">Guardando imagen...</span>
                </div>
            `;
            
            const urls = [];
            let uploadSuccess = true;
            for (const file of files) {
                try {
                    const base64 = await readFileAsBase64(file);
                    const uploadRes = await uploadImageToDrive(base64, file.name);
                    if (uploadRes.status === 'success') {
                        urls.push(uploadRes.url);
                    } else {
                        throw new Error(uploadRes.message || "Error al subir");
                    }
                } catch (err) {
                    uploadSuccess = false;
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al subir imagen',
                        text: `No se pudo subir "${file.name}". Detalle: ${err.message}`,
                        background: '#151515', color: '#fff',
                        confirmButtonColor: '#ef4444'
                    });
                    break;
                }
            }
            
            if (uploadSuccess && urls.length > 0) {
                const fotoUrl = urls.join(',');
                DOM.admin.fotoInput.value = fotoUrl;
                DOM.admin.createFotoFileInfo.textContent = `${urls.length} archivo(s) subido(s) con éxito`;
                DOM.admin.createFotoFileInfo.className = 'text-xs text-green-400 font-semibold';
                renderImagePreviews(DOM.admin.fotoPreviewContainer, urls);
            } else {
                DOM.admin.fotoInput.value = '';
                DOM.admin.createFotoFileInfo.textContent = 'Error al subir';
                DOM.admin.createFotoFileInfo.className = 'text-xs text-red-400 font-semibold';
                DOM.admin.fotoPreviewContainer.classList.add('hidden');
                DOM.admin.fotoPreviewContainer.innerHTML = '';
            }
        });
    }

    if (DOM.admin.updateFotoFile) {
        DOM.admin.updateFotoFile.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {
                DOM.admin.updateFotoFileInfo.textContent = 'Sin archivos';
                DOM.admin.updateFotoFileInfo.className = 'text-[10px] text-gray-400';
                DOM.admin.updateFotoUrl.value = '';
                if (DOM.admin.invImg && currentJerseyToManage) {
                    DOM.admin.invImg.src = getFirstImage(currentJerseyToManage.foto || currentJerseyToManage.imagen);
                }
                if (DOM.admin.updateFotoPreviewContainer && currentJerseyToManage) {
                    const originalUrls = (currentJerseyToManage.foto || currentJerseyToManage.imagen) ? (currentJerseyToManage.foto || currentJerseyToManage.imagen).split(',') : [];
                    renderImagePreviews(DOM.admin.updateFotoPreviewContainer, originalUrls);
                }
                return;
            }
            
            if (DOM.admin.invImg) {
                DOM.admin.invImg.classList.add('opacity-40');
            }
            if (DOM.admin.updateFotoPreviewContainer) {
                DOM.admin.updateFotoPreviewContainer.classList.remove('hidden');
                DOM.admin.updateFotoPreviewContainer.innerHTML = `
                    <div class="col-span-4 flex items-center justify-center p-4 bg-dark-200/50 rounded-xl border border-white/5 w-full">
                        <svg class="animate-spin h-5 w-5 text-navy-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span class="text-xs text-gray-400">Guardando imagen...</span>
                    </div>
                `;
            }
            
            const urls = [];
            let uploadSuccess = true;
            for (const file of files) {
                try {
                    const base64 = await readFileAsBase64(file);
                    const uploadRes = await uploadImageToDrive(base64, file.name);
                    if (uploadRes.status === 'success') {
                        urls.push(uploadRes.url);
                    } else {
                        throw new Error(uploadRes.message || "Error al subir");
                    }
                } catch (err) {
                    uploadSuccess = false;
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al subir',
                        text: `Error al subir "${file.name}": ${err.message}`,
                        background: '#151515', color: '#fff',
                        confirmButtonColor: '#ef4444'
                    });
                    break;
                }
            }
            
            if (DOM.admin.invImg) {
                DOM.admin.invImg.classList.remove('opacity-40');
            }
            
            if (uploadSuccess && urls.length > 0) {
                const fotoUrl = urls.join(',');
                DOM.admin.updateFotoUrl.value = fotoUrl;
                DOM.admin.updateFotoFileInfo.textContent = `${urls.length} archivo(s) subido(s)`;
                DOM.admin.updateFotoFileInfo.className = 'text-[10px] text-green-400 font-semibold';
                if (DOM.admin.invImg) {
                    DOM.admin.invImg.src = urls[0];
                }
                if (DOM.admin.updateFotoPreviewContainer) {
                    renderImagePreviews(DOM.admin.updateFotoPreviewContainer, urls);
                }
            } else {
                DOM.admin.updateFotoUrl.value = '';
                DOM.admin.updateFotoFileInfo.textContent = 'Error al subir';
                DOM.admin.updateFotoFileInfo.className = 'text-[10px] text-red-400 font-semibold';
                if (DOM.admin.invImg && currentJerseyToManage) {
                    DOM.admin.invImg.src = getFirstImage(currentJerseyToManage.foto || currentJerseyToManage.imagen);
                }
                if (DOM.admin.updateFotoPreviewContainer && currentJerseyToManage) {
                    const originalUrls = (currentJerseyToManage.foto || currentJerseyToManage.imagen) ? (currentJerseyToManage.foto || currentJerseyToManage.imagen).split(',') : [];
                    renderImagePreviews(DOM.admin.updateFotoPreviewContainer, originalUrls);
                }
            }
        });
    }

    // Eventos de Perfil y Clientes
    if (DOM.actions.openClients) DOM.actions.openClients.forEach(btn => btn.addEventListener('click', () => { openClientsModal(); closemobileMenu(); }));
    if (DOM.admin.closeClientsModal) DOM.admin.closeClientsModal.addEventListener('click', closeClientsModal);
    if (DOM.admin.btnOpenCreateClient) DOM.admin.btnOpenCreateClient.addEventListener('click', () => openClientFormModal());
    
    // Eventos de Óórdenes
    if (DOM.actions.openOrders) DOM.actions.openOrders.forEach(btn => btn.addEventListener('click', () => { openOrdenesModal(); closemobileMenu(); }));
    if (DOM.admin.Ordenes?.closeBtn) DOM.admin.Ordenes.closeBtn.addEventListener('click', closeOrdenesModal);
    if (DOM.admin.Ordenes?.btnBuscar) DOM.admin.Ordenes.btnBuscar.addEventListener('click', handleSearchOrdenes);
    

    if (DOM.admin.Ordenes?.filtros?.nombre) DOM.admin.Ordenes.filtros.nombre.addEventListener('input', handleSearchOrdenes);
    if (DOM.admin.Ordenes?.filtros?.id) DOM.admin.Ordenes.filtros.id.addEventListener('input', handleSearchOrdenes);
    if (DOM.admin.Ordenes?.filtros?.estatus) DOM.admin.Ordenes.filtros.estatus.addEventListener('change', handleSearchOrdenes);
    
    // Eventos de Crear Pedido (Excel)
    if (DOM.actions.openExcelOrders) DOM.actions.openExcelOrders.forEach(btn => btn.addEventListener('click', () => { openExcelOrdersModal(); closemobileMenu(); }));
    if (DOM.excelOrders?.closeBtn) DOM.excelOrders.closeBtn.addEventListener('click', closeExcelOrdersModal);
    if (DOM.excelOrders?.form) DOM.excelOrders.form.addEventListener('submit', handleAddManualItemExcel);
    if (DOM.excelOrders?.inputs?.genero) DOM.excelOrders.inputs.genero.addEventListener('change', handleExcelGenderChange);
    if (DOM.excelOrders?.inputs?.foto) DOM.excelOrders.inputs.foto.addEventListener('change', handleExcelPhotoChange);
    if (DOM.excelOrders?.inputs?.imgClear) DOM.excelOrders.inputs.imgClear.addEventListener('click', handleExcelPhotoClear);
    if (DOM.excelOrders?.btnDescargar) DOM.excelOrders.btnDescargar.addEventListener('click', generateExcelFromManualItems);
    
    const OrdenesPagePrev = document.getElementById('admin-ordenes-page-prev');
    const OrdenesPageNext = document.getElementById('admin-ordenes-page-next');
    const OrdenesPerPageSelect = document.getElementById('admin-ordenes-per-page');
    if (OrdenesPagePrev) OrdenesPagePrev.addEventListener('click', () => { if (OrdenesCurrentPage > 1) { OrdenesCurrentPage--; renderOrdenes(); } });
    if (OrdenesPageNext) OrdenesPageNext.addEventListener('click', () => { if (OrdenesCurrentPage * OrdenesPerPage < currentOrdenes.length) { OrdenesCurrentPage++; renderOrdenes(); } });
    if (OrdenesPerPageSelect) {
        OrdenesPerPageSelect.addEventListener('change', (e) => {
            OrdenesPerPage = parseInt(e.target.value) || 5;
            OrdenesCurrentPage = 1;
            renderOrdenes();
        });
    }
    
    if (DOM.admin.closeClientFormModal) DOM.admin.closeClientFormModal.addEventListener('click', closeClientFormModal);
    if (DOM.admin.btnCancelClient) DOM.admin.btnCancelClient.addEventListener('click', closeClientFormModal);
    if (DOM.admin.formClient) DOM.admin.formClient.addEventListener('submit', handleSaveClient);
    if (DOM.admin.clientFilterSearch) DOM.admin.clientFilterSearch.addEventListener('input', applyClientFilters);
    if (DOM.admin.clientPagePrev) DOM.admin.clientPagePrev.addEventListener('click', () => { if (clientCurrentPage > 1) { clientCurrentPage--; renderClientsTable(); } });
    if (DOM.admin.clientPageNext) DOM.admin.clientPageNext.addEventListener('click', () => { if (clientCurrentPage * clientsPerPage < clientsFiltered.length) { clientCurrentPage++; renderClientsTable(); } });
    
    // Toggle visibilidad de contraseña de cliente
    const btnToggleClientPass = document.getElementById('btn-toggle-client-pass');
    if (btnToggleClientPass) {
        btnToggleClientPass.addEventListener('click', () => {
            const passInput = DOM.admin.clientInputs.password;
            if (passInput) {
                const isPass = passInput.type === 'password';
                passInput.type = isPass ? 'text' : 'password';
                btnToggleClientPass.innerHTML = isPass 
                    ? `<svg class="w-4 h-4 eye-off-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path></svg>`
                    : `<svg class="w-4 h-4 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`;
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOM.modal.overlay.classList.contains('hidden')) closeModal();
        if (e.key === 'Escape' && !DOM.admin.createModal.classList.contains('hidden')) closeCreateModal();
        if (e.key === 'Escape' && DOM.admin.invModal && !DOM.admin.invModal.classList.contains('hidden')) closeInventoryModal();
        if (e.key === 'Escape' && DOM.admin.listModal && !DOM.admin.listModal.classList.contains('hidden') && DOM.admin.invModal.classList.contains('hidden')) closeListModal();
        if (e.key === 'Escape' && DOM.admin.clientsModal && !DOM.admin.clientsModal.classList.contains('hidden') && DOM.admin.clientFormModal.classList.contains('hidden')) closeClientsModal();
        if (e.key === 'Escape' && DOM.admin.clientFormModal && !DOM.admin.clientFormModal.classList.contains('hidden')) closeClientFormModal();
        if (e.key === 'Escape' && DOM.pedido.modal && !DOM.pedido.modal.classList.contains('hidden')) closePedidoModal();
        if (e.key === 'Escape' && DOM.cart.modal && !DOM.cart.modal.classList.contains('hidden')) closeCartModal();
    });
    
    // Aplicar estilos de la vista inicial
    switchView(currentView);
}

function toggleFiltros() {
    const isHidden = DOM.filtrosContainer.classList.contains('hidden');
    if (isHidden) {
        DOM.filtrosContainer.classList.remove('hidden');
        DOM.iconToggleFiltros.classList.remove('-rotate-90');
        DOM.iconToggleFiltros.classList.add('rotate-0');
    } else {
        DOM.filtrosContainer.classList.add('hidden');
        DOM.iconToggleFiltros.classList.remove('rotate-0');
        DOM.iconToggleFiltros.classList.add('-rotate-90');
    }
}

let modalImages = [];
let modalCurrentIndex = 0;

function openModal(imgUrl, imagesArray = [], currentIndex = 0) {
    if (!DOM.modal.overlay) return;
    DOM.modal.img.src = imgUrl;
    DOM.modal.overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        DOM.modal.overlay.classList.remove('opacity-0');
        DOM.modal.img.classList.remove('scale-95');
        DOM.modal.img.classList.add('scale-100');
    });
    document.body.style.overflow = 'hidden';

    modalImages = imagesArray;
    modalCurrentIndex = currentIndex;

    const prevBtn = document.getElementById('modal-prev-btn');
    const nextBtn = document.getElementById('modal-next-btn');
    if (prevBtn && nextBtn) {
        if (modalImages.length > 1) {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.remove('hidden');
        } else {
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
        }
    }
}

function closeModal() {
    if (!DOM.modal.overlay) return;
    DOM.modal.overlay.classList.add('opacity-0');
    DOM.modal.img.classList.remove('scale-100');
    DOM.modal.img.classList.add('scale-95');
    setTimeout(() => {
        DOM.modal.overlay.classList.add('hidden');
        DOM.modal.img.src = '';
        document.body.style.overflow = '';
        
        // Limpiar variables del carrusel del modal
        modalImages = [];
        modalCurrentIndex = 0;
    }, 300);
}

async function loadCatalogs() {
    let configs = null;
    let pers = null;
    const CACHE_KEY = 'jerseys_configs_v18';
    const PERS_CACHE_KEY = 'jerseys_personalizations_v10';
    const CACHE_TTL = 60 * 60 * 1000; // 1 hora
    
    // 1. Intentar cargar del localStorage
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TTL)) {
                configs = cachedObj.data;
            }
        }
    } catch (e) {}
    
    try {
        const cachedPersStr = localStorage.getItem(PERS_CACHE_KEY);
        if (cachedPersStr) {
            const cachedPersObj = JSON.parse(cachedPersStr);
            if (cachedPersObj && cachedPersObj.timestamp && (Date.now() - cachedPersObj.timestamp < CACHE_TTL)) {
                pers = cachedPersObj.data;
            }
        }
    } catch (e) {}
    
    // 2. Solicitar en paralelo lo que falte
    let configsPromise = null;
    let persPromise = null;
    
    if (!configs) {
        configsPromise = get_configs();
    }
    if (!pers) {
        persPromise = get_personalizations();
    }
    
    if (configsPromise || persPromise) {
        try {
            const [configsRes, persRes] = await Promise.all([
                configsPromise ? configsPromise : Promise.resolve(null),
                persPromise ? persPromise : Promise.resolve(null)
            ]);
            
            if (configsRes) {
                configs = configsRes;
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: configsRes, timestamp: Date.now() }));
                } catch (e) {}
            }
            
            if (persRes && persRes.status === 'success' && Array.isArray(persRes.data)) {
                pers = persRes.data;
                try {
                    localStorage.setItem(PERS_CACHE_KEY, JSON.stringify({ data: pers, timestamp: Date.now() }));
                } catch (e) {}
            }
        } catch (err) {
            console.error("Error al cargar catálogos desde la API en paralelo:", err);
        }
    }
    
    // 3. Procesar datos de personalizaciones
    if (pers && pers.length > 0) {
        allPersonalizaciones = pers.map(p => ({
            id: p.id_personalizacion || p.id,
            nombre: p.concepto || p.nombre || '',
            precio_Menudeo: parseFloat((p.precio_Menudeo !== undefined && p.precio_Menudeo !== "") ? p.precio_Menudeo : (p.precio || 0)),
            precio_mayoreo: parseFloat((p.precio_mayoreo !== undefined && p.precio_mayoreo !== "") ? p.precio_mayoreo : (p.precio || 0))
        }));
    } else {
        allPersonalizaciones = defaultPersonalizaciones;
    }
    
    // 4. Determinar si los datos en caché o de la API son válidos y poblar selects
    const getValidData = (obj) => {
        if (!obj) return null;
        const candidate = obj.configuraciones || obj.data || obj;
        if (!candidate) return null;
        
        const tipos = candidate.tipos || candidate.tipo;
        const versiones = candidate.versiones || candidate.version;
        const generos = candidate.generos || candidate.genero;
        const perfiles = candidate.perfiles || [];
        const categorias = candidate.categorias || [];
        const personalizaciones = candidate.personalizaciones || candidate.personalizacion || [];
        const reglas_mayoreo_super = candidate.reglas_mayoreo_super || null;
        const estatus_ordenes = candidate.estatus_ordenes || candidate.estatus_Ordenes || candidate.estatus || null;
        const tallas_hombre = candidate.tallas_hombre || [];
        const tallas_dama = candidate.tallas_dama || [];
        const tallas_nino = candidate.tallas_nino || [];
        const reglas_envio = candidate.reglas_envio || [];
        
        if (Array.isArray(tipos) && Array.isArray(versiones) && Array.isArray(generos)) {
            return { tipos, versiones, generos, perfiles, categorias, personalizaciones, reglas_mayoreo_super, estatus_ordenes, reglas_envio, tallas_hombre, tallas_dama, tallas_nino };
        }
        return null;
    };
    
    const validData = getValidData(configs);
    if (validData) {
        if (validData.reglas_mayoreo_super) reglasMayoreoSuper = validData.reglas_mayoreo_super;
        if (validData.reglas_envio) reglasEnvio = validData.reglas_envio;
        populateSelects(validData);
    } else {
        console.error("No se pudieron cargar las configuraciones de los filtros desde la API ni del caché local.");
    }
}
function populateDropdown(selectEl, items, defaultText) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${defaultText}</option>`;
    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = typeof item === 'object' ? item.id : item;
            option.textContent = typeof item === 'object' ? (item.precio > 0 ? `${item.nombre} (+$${parseFloat(item.precio).toFixed(2)})` : item.nombre) : item;
            selectEl.appendChild(option);
        });
    }
}

function populateSelects(data) {
    if (!data) return;
    
    configTallasHombre = data.tallas_hombre || [];
    configTallasDama = data.tallas_dama || [];
    configTallasNino = data.tallas_nino || [];
    
    const tipos = data.tipos || [];
    const versiones = data.versiones || [];
    const generos = data.generos || [];
    const perfiles = (data.perfiles && data.perfiles.length > 0) ? data.perfiles : ["Menudeo", "Mayoreo", "Administrador"];
    const estatusList = data.estatus_ordenes || ['Pendiente', 'Enviado', 'Entregado', 'Cancelada'];
    window.OrdenesEstatusList = estatusList;
    
    // Poblar select de personalización en modal de pedidos
    updatePersonalizacionDropdown();
    
    // Selects del Home
    populateDropdown(DOM.filters.tipo, tipos, "Tipo (Todos)");
    populateDropdown(DOM.filters.version, versiones, "Versión (Todas)");
    populateDropdown(DOM.filters.genero, generos, "Género (Todos)");

    // Selects del Modal de Creación
    if(DOM.admin.createSelects.tipo) populateDropdown(DOM.admin.createSelects.tipo, tipos, "Selecciona tipo");
    if(DOM.admin.createSelects.version) populateDropdown(DOM.admin.createSelects.version, versiones, "Selecciona versión");
    if(DOM.admin.createSelects.genero) populateDropdown(DOM.admin.createSelects.genero, generos, "Selecciona género");
    
    // Selects del Modal de Edición (Actualización)
    if(DOM.admin.updateSelects && DOM.admin.updateSelects.tipo) populateDropdown(DOM.admin.updateSelects.tipo, tipos, "Selecciona tipo");
    if(DOM.admin.updateSelects && DOM.admin.updateSelects.version) populateDropdown(DOM.admin.updateSelects.version, versiones, "Selecciona versión");
    if(DOM.admin.updateSelects && DOM.admin.updateSelects.genero) populateDropdown(DOM.admin.updateSelects.genero, generos, "Selecciona género");
    
    // Selects de los filtros de Administración
    if(DOM.admin.filterTipo) populateDropdown(DOM.admin.filterTipo, tipos, "Tipo (Todos)");
    if(DOM.admin.filterVersion) populateDropdown(DOM.admin.filterVersion, versiones, "Versión (Todas)");
    if(DOM.admin.filterGenero) populateDropdown(DOM.admin.filterGenero, generos, "Género (Todos)");

    // Perfiles
    if(DOM.admin.selectPerfil) {
        populateDropdown(DOM.admin.selectPerfil, perfiles, "Selecciona perfil");
        // quitará la opción vacía por defecto
        const defaultOpt = DOM.admin.selectPerfil.querySelector('option[value=""]');
        if (defaultOpt) defaultOpt.remove();
    }
    if(DOM.admin.clientInputs.perfil) populateDropdown(DOM.admin.clientInputs.perfil, ["Menudeo", "Mayoreo"], "Selecciona perfil");
    
    // Estatus de Órdenes
    if (DOM.admin.Ordenes && DOM.admin.Ordenes.filtros.estatus) {
        populateDropdown(DOM.admin.Ordenes.filtros.estatus, estatusList, "Todos los Estatus");
    }
    const userFilterStatus = document.getElementById('user-filter-status');
    if (userFilterStatus) {
        populateDropdown(userFilterStatus, estatusList, "Todos los Estatus");
    }
}

function handleLogout() {
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: "¿Estás seguro que deseas cerrar sesión? Perderás los artículos en tu carrito no guardado.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1d4ed8',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
        background: '#151515',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('logged_user');
            localStorage.removeItem('current_perfil');
            localStorage.removeItem('session_token');
            window.location.reload();
        }
    });
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const usuario = DOM.login.usuario.value.trim();
    const password = DOM.login.password.value.trim();
    
    if (!usuario || !password) return;
    
    const btn = DOM.login.btnSubmit;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Ingresando...`;
    btn.disabled = true;
    
    try {
        const res = await login_client(usuario, password);
        
        if (res.status === 'success' && res.data) {
            if (res.data.activo !== undefined && Number(res.data.activo) === 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Cuenta Inactiva',
                    text: 'Tu cuenta de cliente está inactiva. Por favor, contacta al administrador para activarla.',
                    background: '#151515', color: '#fff',
                    confirmButtonColor: '#ef4444'
                });
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }
            localStorage.setItem('logged_user', JSON.stringify(res.data));
            localStorage.setItem('current_perfil', res.data.perfil || 'Menudeo');
            localStorage.setItem('session_token', res.data.token || '');
            
            // 🧼 Limpiar caché de configuraciones para forzar la carga de datos frescos
            localStorage.removeItem('jerseys_configs_v18');
            localStorage.removeItem('jerseys_personalizations_v10');
            
            // Al hacer login exitoso, reiniciamos el contador de inactividad
            resetInactivityTimer();
            
            // Recargar configuraciones frescas de la API e inventario en paralelo
            await Promise.all([
                loadCatalogs(),
                fetchInitialProducts(true)
            ]);
            
            updateBrandTextColor();
            
            DOM.login.overlay.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                DOM.login.overlay.classList.add('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
            
            const userNameText = res.data.nombre_completo || res.data.usuario || 'Usuario';
            DOM.navUserName.textContent = userNameText;
            if (DOM.mobileMenu && DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = userNameText;
            updateUserLogoInitial(userNameText, res.data.foto);
            if (DOM.navUserBadge) DOM.navUserBadge.classList.remove('hidden');
            const navLogoutBtn = document.getElementById('nav-logout-btn');
            if (navLogoutBtn) {
                navLogoutBtn.classList.remove('hidden');
                navLogoutBtn.classList.add('sm:flex');
            }
            
            // 🌟 Alerta premium de Súper Mayoreo
            if (esPerfilSuperMayoreo(res.data.perfil)) {
                let fechaVigencia = 'Vencimiento no configurado';
                if (res.data.super_mayoreo_exp) {
                    try {
                        const d = new Date(res.data.super_mayoreo_exp);
                        fechaVigencia = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    } catch (e) {}
                }
                
                const acum = Number(res.data.super_mayoreo_acum || 0);
                const faltan = Math.max(0, 10 - acum);
                
                let requirementHtml = '';
                if (faltan > 0) {
                    requirementHtml = `🔁 <strong>Para conservar tu precio:</strong> Llevas acumuladas <strong class="text-emerald-400">${acum}</strong> playeras en tu ciclo actual. Te faltan <strong class="text-amber-400 font-mono">${faltan}</strong> playeras más antes de la fecha de vencimiento para renovar tus beneficios por otros 6 días.`;
                } else {
                    requirementHtml = `✨ <strong>¡Meta de renovación cumplida!</strong> Llevas acumuladas <strong class="text-emerald-400">${acum}</strong> playeras. Ya tienes asegurado tu beneficio de Súper Mayoreo para el siguiente ciclo.`;
                }
                
                Swal.fire({
                    icon: 'info',
                    title: `🌟 ¡Bienvenido, ${userNameText}!`,
                    html: `
                        <div class="text-left space-y-2.5 text-xs text-gray-300">
                            <p>Tienes activo el perfil de <strong class="text-amber-400">Súper Mayoreo</strong> con precios preferenciales exclusivos.</p>
                            <p>📅 <strong>Vigencia:</strong> hasta el <span class="text-white font-mono underline">${fechaVigencia}</span>.</p>
                            <p>${requirementHtml}</p>
                        </div>
                    `,
                    background: '#151515',
                    color: '#ffffff',
                    confirmButtonColor: '#d97706',
                    confirmButtonText: '¡Excelente!'
                });
            } else if (res.data.perfil !== "Administrador") {
                Swal.fire({
                    title: '¡Acceso Correcto!',
                    text: `Bienvenido de nuevo, ${userNameText}.`,
                    icon: 'success',
                    background: '#151515',
                    color: '#ffffff',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            
            if (res.data.perfil === "Administrador") {
                if (DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.add('hidden');
                if (DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.add('hidden');
                if (DOM.admin && DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.remove('hidden');
                if (DOM.mobileMenu && DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.remove('hidden');
                const savedSub = localStorage.getItem('current_subperfil') || 'Mayoreo';
                if (DOM.adminSubperfilSelect) {
                    DOM.adminSubperfilSelect.classList.remove('hidden');
                    DOM.adminSubperfilSelect.value = savedSub;
                }
                if (DOM.mobileMenu && DOM.mobileMenu.adminSubperfilSelect) {
                    DOM.mobileMenu.adminSubperfilSelect.value = savedSub;
                }
            } else {
                if (DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.remove('hidden');
                if (DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.remove('hidden');
                if (DOM.admin && DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.add('hidden');
                if (DOM.mobileMenu && DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.add('hidden');
                if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.classList.add('hidden');
            }
            
            applyProfileView();
        } else {
            Swal.fire({
                title: 'Error de Acceso',
                text: res.message || 'Usuario o contraseña incorrectos.',
                icon: 'error',
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#1d4ed8'
            });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({
            title: 'Error de Conexión',
            html: `<div class="text-left text-xs space-y-1 text-gray-300">
                <p>Ocurrió un problema al intentar iniciar sesión.</p>
                <p class="text-red-400 font-mono">Detalle: ${err.message || String(err)}</p>
                ${err.stack ? `<pre class="bg-black/40 p-2 rounded text-[10px] overflow-x-auto text-gray-400 max-h-24 select-text">${err.stack.split('\n').slice(0, 2).join('\n')}</pre>` : ''}
            </div>`,
            icon: 'error',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function applyProfileView() {
    // Volver a renderizar catálogo de productos según perfil
    if (allProducts && allProducts.length > 0) {
        renderLocalProducts(allProducts);
    }
    
    // Actualizar precios de personalización del modal
    updatePersonalizacionDropdown();
    
    // Actualizar precios en el carrito
    renderCartItems();
}

function renderInitialLoader() {
    DOM.grid.innerHTML = `
        <div class="col-span-1 sm:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-24 text-center min-h-[50vh]">
            <div class="relative w-20 h-20 mb-6">
                <div class="absolute inset-0 border-t-2 border-b-2 border-navy-500 border-solid rounded-full animate-spin"></div>
                <div class="absolute inset-2 border-l-2 border-r-2 border-navy-400 border-solid rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                <div class="absolute inset-0 flex items-center justify-center text-navy-400 font-bold text-xs">J</div>
            </div>
            <h3 class="text-lg font-medium text-white tracking-widest uppercase">Inicializando Sistema</h3>
            <p class="text-gray-500 mt-2 text-sm">Cargando catálogos y configuraciones...</p>
        </div>
    `;
    DOM.emptyState.classList.add('hidden');
    DOM.resultsCount.classList.add('hidden');
}

function renderSkeletons(count) {
    DOM.grid.innerHTML = '';
    DOM.emptyState.classList.add('hidden');
    DOM.resultsCount.classList.add('hidden');
    
    for (let i = 0; i < count; i++) {
        const clone = DOM.skeletonTemplate.content.cloneNode(true);
        DOM.grid.appendChild(clone);
    }
}

// --- FUNCIONES DE ADMINISTRACIÓN ---

function applyAdminFilters(keepPage = false) {
    const term = DOM.admin.filterSearch.value.toLowerCase();
    const tipo = DOM.admin.filterTipo.value;
    const version = DOM.admin.filterVersion.value;
    const genero = DOM.admin.filterGenero.value;
    
    adminFilteredProducts = allProducts.filter(p => {
        const matchName = !term || (p.nombre && p.nombre.toLowerCase().includes(term));
        const matchTipo = !tipo || p.tipo === tipo;
        const matchVersion = !version || p.version === version;
        const matchGenero = !genero || p.genero === genero;
        return matchName && matchTipo && matchVersion && matchGenero;
    });
    
    if (keepPage === true) {
        // Asegurarnos de no estar fuera de rango
        const totalItems = adminFilteredProducts.length;
        const totalPages = Math.ceil(totalItems / adminItemsPerPage) || 1;
        if (adminCurrentPage > totalPages) {
            adminCurrentPage = totalPages;
        }
    } else {
        adminCurrentPage = 1;
    }
    renderAdminTable();
}

function openListModal() {
    adminFilteredProducts = [...allProducts];
    adminCurrentPage = 1;
    
    if(DOM.admin.filterSearch) DOM.admin.filterSearch.value = '';
    if(DOM.admin.filterTipo) DOM.admin.filterTipo.value = '';
    if(DOM.admin.filterVersion) DOM.admin.filterVersion.value = '';
    if(DOM.admin.filterGenero) DOM.admin.filterGenero.value = '';
    
    DOM.admin.listModal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.admin.listModal.offsetWidth;
    DOM.admin.listModal.classList.remove('opacity-0');
    DOM.admin.listModal.querySelector('.transform').classList.remove('scale-95');
    DOM.admin.listModal.querySelector('.transform').classList.add('scale-100');
    document.body.style.overflow = 'hidden';
    
    renderAdminTable();
}

function closeListModal() {
    DOM.admin.listModal.classList.add('opacity-0');
    DOM.admin.listModal.querySelector('.transform').classList.remove('scale-100');
    DOM.admin.listModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.listModal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

function renderAdminTable() {
    DOM.admin.tableBody.innerHTML = '';
    
    if (!adminFilteredProducts || adminFilteredProducts.length === 0) {
        DOM.admin.listEmpty.classList.remove('hidden');
        DOM.admin.tableBody.closest('div.overflow-x-auto').classList.add('hidden');
        DOM.admin.pageInfo.parentElement.classList.add('hidden');
        return;
    }
    
    DOM.admin.listEmpty.classList.add('hidden');
    DOM.admin.tableBody.closest('div.overflow-x-auto').classList.remove('hidden');
    DOM.admin.pageInfo.parentElement.classList.remove('hidden');
    
    const totalItems = adminFilteredProducts.length;
    const totalPages = Math.ceil(totalItems / adminItemsPerPage);
    const startIndex = (adminCurrentPage - 1) * adminItemsPerPage;
    const endIndex = Math.min(startIndex + adminItemsPerPage, totalItems);
    
    const paginatedItems = adminFilteredProducts.slice(startIndex, endIndex);
    
    DOM.admin.pageInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems}`;
    DOM.admin.pagePrev.disabled = adminCurrentPage === 1;
    DOM.admin.pageNext.disabled = adminCurrentPage === totalPages;
    
    paginatedItems.forEach(producto => {
        let totalStock = 0;
        if (producto.tallas && Array.isArray(producto.tallas)) {
            producto.tallas.forEach(t => {
                totalStock += parseInt(t.stock !== undefined ? t.stock : t.inventario) || 0;
            });
        }
        
        const imgUrl = getFirstImage(producto.foto || producto.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        
        const colorGenero = getGenderColorClass(producto.genero);
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors group';
        tr.innerHTML = `
            <td class="px-3 py-2">
                <div class="flex items-center gap-3">
                    <img src="${imgUrl}" alt="Foto" class="w-10 h-10 rounded-lg object-cover bg-dark">
                    <div>
                        <div class="font-bold text-white text-xs group-hover:text-navy-400 transition-colors cursor-default leading-tight">${producto.nombre || 'Sin nombre'}</div>
                        <div class="text-[9px] font-mono text-gray-500 mt-0.5">ID: ${producto.id || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-3 py-2">
                <div class="flex flex-row flex-wrap gap-1 max-w-[180px]">
                    <span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/10 leading-none">${producto.version || '-'}</span>
                    <span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 px-1.5 py-0.5 rounded border border-white/10 leading-none">${producto.tipo || '-'}</span>
                    <span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider ${colorGenero} px-1.5 py-0.5 rounded border leading-none">${producto.genero || '-'}</span>
                </div>
            </td>
            <td class="px-3 py-2 text-center">
                <div class="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md font-bold text-xs ${totalStock > 0 ? 'bg-dark-200 text-white border border-white/10 shadow-inner' : 'bg-red-500/10 text-red-500 border border-red-500/20'} leading-none">
                    ${totalStock}
                </div>
            </td>
            <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button class="p-1.5 rounded-md bg-navy-500/10 hover:bg-navy-500 text-navy-400 hover:text-white transition-all duration-300 shadow hover:shadow-navy-500/30 btn-manage-inv" title="Gestionar Inventario" data-id="${producto.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 shadow hover:shadow-red-500/30" title="¿¿¿Eliminar Jersey" onclick="Swal.fire({icon:'info', title:'Próximamente', text:'Función de ¿¿¿Eliminar en desarrollo', background:'#151515', color:'#fff', confirmButtonColor:'#1d4ed8', customClass: {popup: 'border border-white/10 rounded-2xl'}})">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        DOM.admin.tableBody.appendChild(tr);
    });
    
    // Asignar eventos de gestión
    document.querySelectorAll('.btn-manage-inv').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const producto = allProducts.find(p => p.id === id);
            if(producto) openInventoryModal(producto);
        });
    });
}

function updateNewTallaSelect(producto) {
    if (DOM.admin.newTallaVal) {
        const tallas = getTallasForGender(producto.genero);
        const existentes = (producto.tallas || []).map(t => String(t.talla).trim().toUpperCase());
        const disponibles = tallas.filter(t => !existentes.includes(t.trim().toUpperCase()));
        
        if (disponibles.length === 0) {
            DOM.admin.newTallaVal.innerHTML = '<option value="" disabled selected>Sin tallas disponibles</option>';
        } else {
            DOM.admin.newTallaVal.innerHTML = '<option value="" disabled selected>Elige talla...</option>' + 
                disponibles.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    }
}

function openInventoryModal(producto) {
    currentJerseyToManage = producto;
    DOM.admin.invTitle.textContent = producto.nombre;
    DOM.admin.invId.textContent = `ID: ${producto.id}`;
    DOM.admin.invImg.src = getFirstImage(producto.foto || producto.imagen) || '';
    
    // Inyectar etiquetas del producto en el encabezado del modal
    const tagsContainer = document.getElementById('inv-modal-tags');
    if (tagsContainer) {
        let tagsHtml = '';
        if (producto.version) {
            tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 rounded-md border border-white/10 backdrop-blur-sm">${producto.version}</span>`;
        }
        if (producto.tipo) {
            tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 rounded-md border border-white/10 backdrop-blur-sm">${producto.tipo}</span>`;
        }
        if (producto.genero) {
            const colorGen = getGenderColorClass(producto.genero);
            tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${colorGen} rounded-md border backdrop-blur-sm">${producto.genero}</span>`;
        }
        tagsContainer.innerHTML = tagsHtml;
    }
    
    renderInventorySizes(producto);

    if (DOM.admin.updateNombre) DOM.admin.updateNombre.value = producto.nombre || '';
    if (DOM.admin.updateSelects) {
        if (DOM.admin.updateSelects.tipo) DOM.admin.updateSelects.tipo.value = producto.tipo || '';
        if (DOM.admin.updateSelects.version) DOM.admin.updateSelects.version.value = producto.version || '';
        if (DOM.admin.updateSelects.genero) DOM.admin.updateSelects.genero.value = producto.genero || '';
        if (DOM.admin.updateSelects.personalizacion) DOM.admin.updateSelects.personalizacion.value = producto.personalizacion || 'No';
    }

    if (DOM.admin.updatePrecioMenudeo) DOM.admin.updatePrecioMenudeo.value = producto.precio_menudeo || 0;
    if (DOM.admin.updatePrecioMayoreo) DOM.admin.updatePrecioMayoreo.value = producto.precio_mayoreo || 0;
    if (DOM.admin.updatePrecioMayoreoSuper) DOM.admin.updatePrecioMayoreoSuper.value = producto.precio_mayoreo_super || 0;
    if (DOM.admin.updateFotoUrl) DOM.admin.updateFotoUrl.value = producto.foto || producto.imagen || '';
    if (DOM.admin.updateFotoPreviewContainer) {
        const initialUrls = (producto.foto || producto.imagen) ? (producto.foto || producto.imagen).split(',') : [];
        renderImagePreviews(DOM.admin.updateFotoPreviewContainer, initialUrls);
    }

    updateNewTallaSelect(producto);
    
    DOM.admin.invModal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.admin.invModal.offsetWidth;
    DOM.admin.invModal.classList.remove('opacity-0');
    DOM.admin.invModal.querySelector('.transform').classList.remove('scale-95');
    DOM.admin.invModal.querySelector('.transform').classList.add('scale-100');
}

function closeInventoryModal() {
    DOM.admin.invModal.classList.add('opacity-0');
    DOM.admin.invModal.querySelector('.transform').classList.remove('scale-100');
    DOM.admin.invModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.invModal.classList.add('hidden');
        DOM.admin.formAddTalla.reset();
        if (DOM.admin.formUpdatePrecios) DOM.admin.formUpdatePrecios.reset();
        if (DOM.admin.updateFotoFileInfo) {
            DOM.admin.updateFotoFileInfo.textContent = 'Sin archivos';
        }
        currentJerseyToManage = null;
    }, 300);
}

function renderInventorySizes(producto) {
    DOM.admin.invTallasList.innerHTML = '';
    
    if (!producto.tallas || producto.tallas.length === 0) {
        DOM.admin.invTallasList.innerHTML = '<p class="text-xs text-gray-500 py-2">No hay tallas registradas.</p>';
        return;
    }
    
    producto.tallas.forEach(t => {
        const stockActual = t.stock !== undefined ? t.stock : t.inventario;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3 bg-dark-200/20 p-2 rounded-lg border border-white/5';
        div.innerHTML = `
            <div class="w-12 h-10 bg-dark-200/50 rounded flex items-center justify-center font-bold text-white text-sm">${t.talla}</div>
            <div class="flex-grow">
                <div class="text-xs text-gray-400 hidden">ID: <span class="font-mono text-gray-500">${t.id_inventario || 'N/A'}</span></div>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" min="0" value="${stockActual}" class="w-20 bg-dark-200 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white input-update-stock" data-id="${t.id_inventario}">
                <button type="button" class="px-3 py-1.5 rounded-lg bg-navy-500/20 text-navy-400 hover:bg-navy-500 hover:text-white transition-colors text-xs font-semibold btn-update-stock" data-id="${t.id_inventario}">
                    Actualizar
                </button>
            </div>
        `;
        DOM.admin.invTallasList.appendChild(div);
    });
    
    // Eventos para actualizar stock
    document.querySelectorAll('.btn-update-stock').forEach(btn => {
        btn.addEventListener('click', handleUpdateStock);
    });
}

async function handleUpdateStock(e) {
    const btn = e.currentTarget;
    const idInv = btn.getAttribute('data-id');
    const input = document.querySelector(`.input-update-stock[data-id="${idInv}"]`);
    const nuevoStock = parseInt(input.value);
    
    if (isNaN(nuevoStock) || nuevoStock < 0 || !idInv) return;
    
    const originalText = btn.innerText;
    btn.innerText = '...';
    btn.disabled = true;
    input.disabled = true;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'update_stock',
                id_inventario: idInv,
                nuevo_stock: nuevoStock
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            btn.classList.replace('bg-navy-500/20', 'bg-green-500/20');
            btn.classList.replace('text-navy-400', 'text-green-400');
            btn.innerText = '✓';
            
            // Actualizar localmente
            if(currentJerseyToManage) {
                const t = currentJerseyToManage.tallas.find(x => x.id_inventario === idInv);
                if(t) t.stock = nuevoStock;
                // Refrescar tabla si es visible
                renderAdminTable(); 
                // Refrescar el catálogo de fondo para reflejar el nuevo stock en las cards
                handleLocalSearch();
            }
            
            setTimeout(() => {
                btn.classList.replace('bg-green-500/20', 'bg-navy-500/20');
                btn.classList.replace('text-green-400', 'text-navy-400');
                btn.innerText = originalText;
            }, 2000);
        } else {
            throw new Error(data.message || 'Error desconocido');
        }
    } catch (error) {
        Swal.fire({icon: 'error', title: 'Error', text: error.message, background: '#151515', color: '#fff'});
        btn.innerText = originalText;
    } finally {
        btn.disabled = false;
        input.disabled = false;
    }
}

async function handleAddNewTalla(e) {
    e.preventDefault();
    if (!currentJerseyToManage) return;
    
    const btnSubmit = document.getElementById('btn-submit-new-talla');
    const originalContent = btnSubmit.innerHTML;
    
    const tallaVal = DOM.admin.newTallaVal.value.trim();
    const stockVal = parseInt(DOM.admin.newStockVal.value) || 0;

    // Validar duplicados (máximo de 2 veces la misma talla)
    const existingCount = (currentJerseyToManage.tallas || []).filter(t => t.talla.trim().toUpperCase() === tallaVal.toUpperCase()).length;
    if (existingCount >= 2) {
        Swal.fire({
            icon: 'warning',
            title: 'Talla repetida',
            text: `No puedes agregar la misma talla más de 2 veces en este jersey (Talla: ${tallaVal}).`,
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        return;
    }
    
    const payload = {
        action: "create",
        id: currentJerseyToManage.id,
        id_producto: currentJerseyToManage.id,
        nombre: currentJerseyToManage.nombre,
        tipo: currentJerseyToManage.tipo,
        version: currentJerseyToManage.version,
        genero: currentJerseyToManage.genero,
        personalizacion: currentJerseyToManage.personalizacion,
        foto: currentJerseyToManage.foto || currentJerseyToManage.imagen,
        precio_Menudeo: parseFloat(currentJerseyToManage.precio_Menudeo || currentJerseyToManage.precio_menudeo) || 0,
        precio_menudeo: parseFloat(currentJerseyToManage.precio_Menudeo || currentJerseyToManage.precio_menudeo) || 0,
        precio_mayoreo: parseFloat(currentJerseyToManage.precio_mayoreo) || 0,
        precio_mayoreo_super: parseFloat(currentJerseyToManage.precio_mayoreo_super) || 0,
        tallas: [
            {
                talla: tallaVal,
                id_producto: currentJerseyToManage.id,
                categoria: currentJerseyToManage.genero,
                stock: stockVal
            }
        ]
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Cargando...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Talla Añadida',
                text: `La talla ${tallaVal} ha sido agregada a la playera.`,
                background: '#151515', color: '#fff',
                timer: 2000,
                showConfirmButton: false
            });
            DOM.admin.formAddTalla.reset();
            // Refrescar data en segundo plano (esto actualizará allProducts y el listado si está abierto)
            await fetchInitialProducts();
            // Buscar la playera actualizada para refrescar el modal de inventario
            const updatedProduct = allProducts.find(p => p.id === currentJerseyToManage.id);
            if (updatedProduct) {
                currentJerseyToManage = updatedProduct;
                renderInventorySizes(updatedProduct);
                updateNewTallaSelect(updatedProduct);
            }
        } else {
            throw new Error(data.message || 'Error desconocido');
        }
    } catch (error) {
        Swal.fire({icon: 'error', title: 'Error', text: error.message, background: '#151515', color: '#fff'});
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
    }
}

async function handleUpdatePrecios(e) {
    e.preventDefault();
    if (!currentJerseyToManage) return;
    
    const btnSubmit = document.getElementById('btn-submit-update-precios');
    const originalContent = btnSubmit.innerHTML;
    
    const pMenudeo = parseFloat(DOM.admin.updatePrecioMenudeo.value) || 0;
    const pMayoreo = parseFloat(DOM.admin.updatePrecioMayoreo.value) || 0;
    const pMayoreoSuper = parseFloat(DOM.admin.updatePrecioMayoreoSuper.value) || 0;
    
    const nombreVal = DOM.admin.updateNombre ? DOM.admin.updateNombre.value.trim() : '';
    const tipoVal = DOM.admin.updateSelects && DOM.admin.updateSelects.tipo ? DOM.admin.updateSelects.tipo.value : '';
    const versionVal = DOM.admin.updateSelects && DOM.admin.updateSelects.version ? DOM.admin.updateSelects.version.value : '';
    const generoVal = DOM.admin.updateSelects && DOM.admin.updateSelects.genero ? DOM.admin.updateSelects.genero.value : '';
    const personalizacionVal = DOM.admin.updateSelects && DOM.admin.updateSelects.personalizacion ? DOM.admin.updateSelects.personalizacion.value : '';
    
    const fotoUrl = DOM.admin.updateFotoUrl ? DOM.admin.updateFotoUrl.value.trim() : '';

    const payload = {
        action: "update",
        id: currentJerseyToManage.id,
        nombre: nombreVal,
        tipo: tipoVal,
        version: versionVal,
        genero: generoVal,
        personalizacion: personalizacionVal,
        precio_Menudeo: pMenudeo,
        precio_mayoreo: pMayoreo,
        precio_mayoreo_super: pMayoreoSuper,
        foto: fotoUrl
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Actualizando...`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Datos Actualizados',
                text: 'Los datos del jersey han sido actualizados con éxito.',
                background: '#151515', color: '#fff',
                timer: 2000,
                showConfirmButton: false
            });
            
            if (DOM.admin.updateFotoFile) {
                DOM.admin.updateFotoFile.value = '';
            }
            if (DOM.admin.updateFotoFileInfo) {
                DOM.admin.updateFotoFileInfo.textContent = 'Sin archivos';
            }
            
            // Refrescar data en segundo plano
            await fetchInitialProducts();
            
            // Buscar la playera actualizada
            const updatedProduct = allProducts.find(p => p.id === currentJerseyToManage.id);
            if (updatedProduct) {
                currentJerseyToManage = updatedProduct;
                DOM.admin.invTitle.textContent = updatedProduct.nombre;
                
                // Inyectar etiquetas actualizadas
                const tagsContainer = document.getElementById('inv-modal-tags');
                if (tagsContainer) {
                    let tagsHtml = '';
                    if (updatedProduct.version) {
                        tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 rounded-md border border-white/10 backdrop-blur-sm">${updatedProduct.version}</span>`;
                    }
                    if (updatedProduct.tipo) {
                        tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 rounded-md border border-white/10 backdrop-blur-sm">${updatedProduct.tipo}</span>`;
                    }
                    if (updatedProduct.genero) {
                        const colorGen = getGenderColorClass(updatedProduct.genero);
                        tagsHtml += `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${colorGen} rounded-md border backdrop-blur-sm">${updatedProduct.genero}</span>`;
                    }
                    tagsContainer.innerHTML = tagsHtml;
                }
            }
        } else {
            throw new Error(data.message || 'Error al actualizar precios');
        }
    } catch (error) {
        Swal.fire({icon: 'error', title: 'Error', text: error.message, background: '#151515', color: '#fff'});
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
    }
}

function openCreateModal() {
    DOM.admin.createModal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    // Forzar redibujo
    void DOM.admin.createModal.offsetWidth;
    DOM.admin.createModal.classList.remove('opacity-0');
    DOM.admin.createModal.querySelector('.transform').classList.remove('scale-95');
    DOM.admin.createModal.querySelector('.transform').classList.add('scale-100');
    document.body.style.overflow = 'hidden';
    
    // Si no hay tallas, agregar una por defecto
    if (DOM.admin.tallasContainer.children.length === 0) {
        addTallaField();
    }
}

function closeCreateModal() {
    DOM.admin.createModal.classList.add('opacity-0');
    DOM.admin.createModal.querySelector('.transform').classList.remove('scale-100');
    DOM.admin.createModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.createModal.classList.add('hidden');
        document.body.style.overflow = '';
        DOM.admin.formCreate.reset();
        if (DOM.admin.createFotoFileInfo) {
            DOM.admin.createFotoFileInfo.textContent = 'Sin archivos seleccionados';
        }
        DOM.admin.fotoPreviewContainer.classList.add('hidden');
        DOM.admin.tallasContainer.innerHTML = '';
    }, 300);
}

function getTallasForGender(gender) {
    const gen = String(gender || '').trim().toLowerCase();
    if (gen.includes('hombre') || gen.includes('caballero') || gen.includes('mens') || gen.includes('men') || gen === 'h') return configTallasHombre;
    if (gen.includes('mujer') || gen.includes('dama') || gen.includes('womens') || gen.includes('women') || gen === 'm' || gen === 'd') return configTallasDama;
    if (gen.includes('niño') || gen.includes('nino') || gen.includes('niña') || gen.includes('nina') || gen.includes('kids') || gen.includes('kid') || gen.includes('unisex') || gen === '') return configTallasNino;
    return [];
}

function getTallasForSelectedGender() {
    if (!DOM.admin.createSelects.genero) return [];
    return getTallasForGender(DOM.admin.createSelects.genero.value);
}

function getTallasOptionsHtml() {
    const tallas = getTallasForSelectedGender();
    if (tallas.length === 0) {
        return `<option value="" disabled selected>Elige género primero</option>`;
    }
    return tallas.map(t => `<option value="${t}">${t}</option>`).join('');
}

function addTallaField() {
    const id = Date.now();
    const optionsHtml = getTallasOptionsHtml();
    const html = `
        <div class="flex gap-3 items-end bg-dark-200/30 p-3 rounded-xl border border-white/5 talla-item" id="talla-${id}">
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Talla</label>
                <select required class="talla-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white cursor-pointer pr-8">
                    ${optionsHtml}
                </select>
            </div>
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Stock</label>
                <input type="number" required min="0" placeholder="0" class="stock-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white">
            </div>
            <button type="button" onclick="document.getElementById('talla-${id}').remove()" class="bg-red-500/10 text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors h-[38px] flex items-center justify-center" title="Eliminar talla">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `;
    DOM.admin.tallasContainer.insertAdjacentHTML('beforeend', html);
}

async function handleCreateProduct(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-create');
    const originalText = btnSubmit.innerHTML;
    
    // Obtener tallas
    const tallasElements = DOM.admin.tallasContainer.querySelectorAll('.talla-item');
    const tallas = [];
    const generoSeleccionado = DOM.admin.createSelects.genero.value;

    tallasElements.forEach(el => {
        tallas.push({
            talla: el.querySelector('.talla-val').value.trim(),
            categoria: generoSeleccionado,
            stock: parseInt(el.querySelector('.stock-val').value) || 0
        });
    });

    // Validar duplicados (máximo de 2 veces la misma talla)
    const counts = {};
    let duplicateTalla = null;
    for (const t of tallas) {
        counts[t.talla] = (counts[t.talla] || 0) + 1;
        if (counts[t.talla] > 2) {
            duplicateTalla = t.talla;
            break;
        }
    }

    if (duplicateTalla) {
        Swal.fire({
            icon: 'warning',
            title: 'Talla repetida',
            text: `No puedes agregar la misma talla más de 2 veces en el jersey (Talla: ${duplicateTalla}).`,
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        return;
    }

    if (tallas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos incompletos',
            text: 'Debes agregar al menos una talla al inventario.',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        return;
    }

    const fotoUrl = DOM.admin.fotoInput.value.trim();
    if (!fotoUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Imagen requerida',
            text: 'Debes seleccionar al menos una imagen para el jersey.',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        return;
    }

    const payload = {
        action: "create",
        nombre: document.getElementById('create-nombre').value.trim(),
        tipo: DOM.admin.createSelects.tipo.value,
        version: DOM.admin.createSelects.version.value,
        genero: DOM.admin.createSelects.genero.value,
        personalizacion: document.getElementById('create-personalizacion').value,
        foto: fotoUrl,
        precio_Menudeo: parseFloat(DOM.admin.precioMenudeo.value) || 0,
        precio_mayoreo: parseFloat(DOM.admin.precioMayoreo.value) || 0,
        precio_mayoreo_super: parseFloat(DOM.admin.precioMayoreoSuper.value) || 0,
        tallas: tallas
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando...`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Error HTTP " + response.status);
        const data = await response.json();
        
        if (data.status === 'success') {
            const result = await Swal.fire({
                icon: 'success',
                title: '¡Playera Creada!',
                html: `<span class="text-gray-300">${data.message || 'La playera se ha agregado correctamente al catálogo.'}</span><br><br><span class="text-xs bg-navy-500/20 text-navy-400 px-3 py-1 rounded-lg border border-navy-500/30 font-mono tracking-wider">ID: ${data.id}</span>`,
                background: '#151515',
                color: '#ffffff',
                showCancelButton: true,
                confirmButtonColor: '#1d4ed8',
                confirmButtonText: 'Excelente',
                cancelButtonColor: '#334155',
                cancelButtonText: 'Agregar otra playera',
                customClass: { popup: 'border border-white/10 rounded-2xl shadow-2xl shadow-navy-500/20' }
            });
            
            if (DOM.admin.createFotoFile) {
                DOM.admin.createFotoFile.value = '';
            }
            if (DOM.admin.createFotoFileInfo) {
                DOM.admin.createFotoFileInfo.textContent = 'Sin archivos seleccionados';
            }
            
            fetchInitialProducts(); // Recargar productos para incluir el nuevo
            
            if (result.isConfirmed) {
                closeCreateModal();
            } else {
                DOM.admin.formCreate.reset();
                DOM.admin.fotoPreviewContainer.classList.add('hidden');
                DOM.admin.tallasContainer.innerHTML = '';
                addTallaField();
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: data.message || 'Error desconocido',
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#ef4444',
                customClass: { popup: 'border border-white/10 rounded-2xl shadow-2xl shadow-red-500/10' }
            });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'Ocurrió un problema al guardar el producto. Verifica tu conexión e intenta de nuevo.',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

async function fetchInitialProducts(force = false) {
    const CACHE_KEY = 'jerseys_products_cache_v5';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    
    if (force) {
        localStorage.removeItem(CACHE_KEY);
    }
    
    let cachedProducts = null;
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TTL)) {
                cachedProducts = cachedObj.data;
            }
        }
    } catch (e) {}
    
    if (cachedProducts) {
        // Cargar instantáneamente del caché
        allProducts = cachedProducts;
        renderProductsWithFilters();
        
        // Revalidar en segundo plano silenciosamente
        revalidateProductsBackground(CACHE_KEY);
    } else {
        // Cargar de la API de forma síncrona
        await loadProductsFromApi(CACHE_KEY);
    }
}

async function loadProductsFromApi(cacheKey) {
    const filtros = { nombre: "", tipo: "", version: "", genero: "" };
    try {
        const response = await search(filtros);
        let productsData = [];
        if (Array.isArray(response)) {
            productsData = response;
        } else if (response && response.status === 'success') {
            productsData = response.data || response.productos || [];
        }
        
        allProducts = productsData;
        
        // Guardar en caché
        try {
            const wrapper = { data: productsData, timestamp: Date.now() };
            localStorage.setItem(cacheKey, JSON.stringify(wrapper));
        } catch (e) {}
        
        renderProductsWithFilters();
    } catch (err) {
        console.error("Error al cargar productos de la API:", err);
    }
}

async function revalidateProductsBackground(cacheKey) {
    const filtros = { nombre: "", tipo: "", version: "", genero: "" };
    try {
        const response = await search(filtros);
        let productsData = [];
        if (Array.isArray(response)) {
            productsData = response;
        } else if (response && response.status === 'success') {
            productsData = response.data || response.productos || [];
        }
        
        // Guardar en caché
        try {
            const wrapper = { data: productsData, timestamp: Date.now() };
            localStorage.setItem(cacheKey, JSON.stringify(wrapper));
        } catch (e) {}
        
        // Solo actualizar silenciosamente en pantalla si el usuario no tiene modal abierto
        const isUserActive = document.getElementById('add-to-pedido-modal')?.classList.contains('hidden') === false;
                             
        if (!isUserActive) {
            allProducts = productsData;
            renderProductsWithFilters();
        }
    } catch (err) {
        console.warn("Error en revalidación de productos en segundo plano:", err);
    }
}

function renderProductsWithFilters() {
    // Aplicar filtros locales de búsqueda si existen
    const hasActiveFilters = (DOM.filters.nombre && DOM.filters.nombre.value.trim() !== "") ||
                             (DOM.filters.tipo && DOM.filters.tipo.value !== "") ||
                             (DOM.filters.version && DOM.filters.version.value !== "") ||
                             (DOM.filters.genero && DOM.filters.genero.value !== "");
                             
    if (hasActiveFilters) {
        const nombreQ = DOM.filters.nombre ? DOM.filters.nombre.value.trim().toLowerCase() : "";
        const tipoQ = DOM.filters.tipo ? DOM.filters.tipo.value : "";
        const versionQ = DOM.filters.version ? DOM.filters.version.value : "";
        const generoQ = DOM.filters.genero ? DOM.filters.genero.value : "";
        
        const filtrados = allProducts.filter(p => {
            let match = true;
            if (nombreQ && !(p.nombre || '').toLowerCase().includes(nombreQ)) match = false;
            if (tipoQ && p.tipo !== tipoQ) match = false;
            if (versionQ && p.version !== versionQ) match = false;
            if (generoQ && p.genero !== generoQ) match = false;
            return match;
        });
        renderLocalProducts(filtrados);
    } else {
        renderLocalProducts(allProducts);
    }
    
    // Si el modal de administración de lista está abierto, actualizar sus filtros e interfaz conservando la página
    if (DOM.admin.listModal && !DOM.admin.listModal.classList.contains('hidden')) {
        applyAdminFilters(true);
    }
}

function handleLocalSearch() {
    renderSkeletons(6);
    
    const originalText = DOM.btnAplicar.innerText;
    DOM.btnAplicar.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Filtrando...`;
    DOM.btnAplicar.disabled = true;
    DOM.btnAplicar.classList.add('opacity-75', 'cursor-not-allowed');
    
    // Simulamos un pequeño retraso para mostrar la animación visual de que se está filtrando
    setTimeout(() => {
        const nombreQ = DOM.filters.nombre.value.trim().toLowerCase();
        const tipoQ = DOM.filters.tipo.value;
        const versionQ = DOM.filters.version.value;
        const generoQ = DOM.filters.genero.value;
        
        const filtrados = allProducts.filter(p => {
            let match = true;
            if (nombreQ && !(p.nombre || '').toLowerCase().includes(nombreQ)) match = false;
            if (tipoQ && p.tipo !== tipoQ) match = false;
            if (versionQ && p.version !== versionQ) match = false;
            if (generoQ && p.genero !== generoQ) match = false;
            return match;
        });
        
        renderLocalProducts(filtrados);
        
        DOM.btnAplicar.innerText = originalText;
        DOM.btnAplicar.disabled = false;
        DOM.btnAplicar.classList.remove('opacity-75', 'cursor-not-allowed');
    }, 300);
}

function renderLocalProducts(productos) {
    DOM.grid.innerHTML = '';
    DOM.resultsCount.classList.remove('hidden');
    
    if (!productos || productos.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        DOM.resultsCount.textContent = '0 resultados';
        isFirstLoad = false;
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    isFirstLoad = false;
    DOM.resultsCount.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;
    productos.forEach(producto => DOM.grid.appendChild(createProductCard(producto)));
}

function createProductCard(producto) {
    const article = document.createElement('article');
    article.className = 'group bg-dark-100 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-white/5 hover:border-navy-400/40 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] relative overflow-hidden';
    
    const images = (producto.foto || producto.imagen || '').split(',').map(u => u.trim()).filter(Boolean);
    let currentImgIdx = 0;
    
    const imgUrl = images[currentImgIdx] || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    
    let tagsHtml = '<div class="flex flex-wrap gap-1 sm:gap-2 mb-1.5 sm:mb-3 z-10 relative">';
    if (producto.version) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 rounded-md border border-white/10 backdrop-blur-sm">${producto.version}</span>`;
    if (producto.tipo) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 rounded-md border border-white/10 backdrop-blur-sm">${producto.tipo}</span>`;
    if (producto.genero) {
        const colorGen = getGenderColorClass(producto.genero);
        tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${colorGen} rounded-md border backdrop-blur-sm">${producto.genero}</span>`;
    }
    tagsHtml += '</div>';

    let tallasHtml = '';
    let totalStock = 0;
    const hasSizes = Array.isArray(producto.tallas) && producto.tallas.length > 0;

    const isAdmin = (localStorage.getItem('current_perfil') === "Administrador" && currentView === "mis-jerseys");

    if (hasSizes) {
        tallasHtml = '<div class="flex flex-wrap gap-1 sm:gap-2 mt-2 pt-2 z-10 relative">';
        producto.tallas.forEach(t => {
            const stockVal = t.stock !== undefined ? t.stock : t.inventario;
            if (stockVal > 0) totalStock += stockVal;
            const hasStock = stockVal > 0;
            const btnClass = hasStock 
                ? 'bg-dark-200 text-gray-200 border-white/10 hover:border-navy-400 hover:text-navy-400 hover:bg-dark-100 cursor-pointer shadow-sm' 
                : 'bg-dark/50 text-gray-600 border-white/5 line-through opacity-40 cursor-not-allowed';
            
            const adminStockHtml = isAdmin ? `<span class="absolute -top-2 -right-2 bg-navy-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-dark z-20">${stockVal}</span>` : '';

            tallasHtml += `
                <div class="relative">
                    <button type="button" class="talla-btn w-6 h-6 sm:w-9 sm:h-9 rounded-md sm:rounded-lg flex items-center justify-center text-[8px] sm:text-xs font-semibold border transition-all duration-200 ${btnClass}" 
                            data-talla="${t.talla}"
                            ${!hasStock ? 'disabled' : ''} 
                            title="${hasStock ? `Stock: ${stockVal}` : 'Agotado'}">
                        ${t.talla}
                    </button>
                    ${adminStockHtml}
                </div>
            `;
        });
        tallasHtml += '</div>';
    }

    const isProximamente = !hasSizes;
    const isAgotado = hasSizes && totalStock === 0;

    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let profileToUse = activeProfile;
    if (activeProfile === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    
    const hasPrice = (parseFloat(producto.precio_Menudeo || producto.precio_menudeo) > 0) || (parseFloat(producto.precio_mayoreo) > 0) || (parseFloat(producto.precio_mayoreo_super) > 0) || producto.precio;
    let statusTextHtml = '';
    if (hasPrice) {
        const basePrice = getBasePriceForProfile(producto, profileToUse);
        
        const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
        const isSuper = isSuperMayoreoActivo && esPerfilSuperMayoreo(profileToUse);
        const priceColorClass = isSuper ? 'text-amber-400 font-bold' : 'text-navy-400';

        statusTextHtml = `
            <div class="mt-1 mb-2 bg-dark-200/40 border border-white/5 rounded-xl p-1.5 sm:p-2.5 space-y-0.5 sm:space-y-1 text-[9px] sm:text-xs z-10 relative backdrop-blur-sm">
                <div class="flex justify-between items-center text-gray-400">
                    <span class="font-medium">Precio:</span>
                    <span class="font-bold ${priceColorClass}">$${basePrice.toFixed(2)}</span>
                </div>
            </div>
        `;
    } else if (isProximamente) {
        statusTextHtml = `
            <p class="text-xs sm:text-sm font-bold text-amber-500 mb-1 sm:mb-2 z-10 relative flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Próximamente
            </p>
        `;
    } else if (isAgotado) {
        statusTextHtml = `
            <p class="text-xs sm:text-sm font-bold text-red-500 mb-1 sm:mb-2 z-10 relative flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Agotado
            </p>
        `;
    }

    // Imagen overlay banner
    let imageOverlayHtml = '';
    if (isProximamente) {
        imageOverlayHtml = `
            <div class="absolute inset-0 flex items-center justify-center bg-dark/40 backdrop-blur-[2px] z-20">
                <span class="bg-amber-500 text-white px-2 sm:px-5 py-1 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[8px] sm:text-xs border border-amber-400 shadow-xl shadow-amber-500/20 transform -rotate-6">Próximamente</span>
            </div>
        `;
    } else if (isAgotado) {
        imageOverlayHtml = `
            <div class="absolute inset-0 flex items-center justify-center bg-dark/30 backdrop-blur-[2px] z-20">
                <span class="bg-red-500 text-white px-2 sm:px-5 py-1 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[8px] sm:text-xs border border-red-400 shadow-xl shadow-red-500/20 transform -rotate-6">Agotado</span>
            </div>
        `;
    }

    let carouselControlsHtml = '';
    if (images.length > 1) {
        carouselControlsHtml = `
            <button type="button" class="carousel-prev-btn absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button type="button" class="carousel-next-btn absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
            <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-30 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                ${images.map((_, i) => `<span class="carousel-dot w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/40'} transition-all duration-300" data-idx="${i}"></span>`).join('')}
            </div>
        `;
    }

    let bottomSectionHtml = statusTextHtml + tallasHtml;
    if (currentView === 'jerseys-pedido') {
        if (isProximamente || isAgotado) {
            bottomSectionHtml += `<button class="w-full mt-auto mt-3 py-2 rounded-lg bg-dark-200 text-gray-600 font-bold text-[11px] uppercase cursor-not-allowed border border-white/5" disabled>No disponible</button>`;
        } else {
            bottomSectionHtml += `<button class="w-full mt-auto mt-3 py-2 rounded-lg bg-navy-500 hover:bg-navy-400 text-white font-bold text-[11px] uppercase tracking-wider transition-all duration-300 shadow hover:shadow-navy-500/20 active:scale-[0.97] btn-agregar-pedido">Agregar a mi pedido</button>`;
        }
    }

    article.innerHTML = `
        <div class="product-image-container relative w-full aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-4 bg-dark z-10 cursor-pointer">
            <img src="${imgUrl}" alt="${producto.nombre || 'Jersey'}" class="product-card-img w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out ${(isAgotado || isProximamente) ? 'grayscale opacity-60' : ''}" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-dark-100/90 via-dark-100/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500"></div>
            ${imageOverlayHtml}
            ${carouselControlsHtml}
        </div>
        <div class="product-details-container flex flex-col flex-grow cursor-pointer z-10 relative">
            <h3 class="text-[13px] sm:text-lg font-semibold text-white leading-tight mb-1 sm:mb-2 group-hover:text-navy-400 transition-colors line-clamp-2 h-9 sm:h-12">
                ${producto.nombre || 'Jersey Deportivo'}
            </h3>
            ${tagsHtml}
            ${bottomSectionHtml}
        </div>
        
        <div class="absolute inset-0 bg-gradient-to-tr from-navy-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    `;

    let selectedTallaBtn = null;
    let preselectedTalla = null;

    const tallaBtns = article.querySelectorAll('.talla-btn');
    tallaBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar abrir modal
            if (btn.disabled) return;
            
            if (selectedTallaBtn) {
                selectedTallaBtn.classList.remove('bg-navy-500', 'text-white', 'border-navy-500');
                selectedTallaBtn.classList.add('bg-dark-200', 'text-gray-200', 'border-white/10');
            }
            btn.classList.remove('bg-dark-200', 'text-gray-200', 'border-white/10');
            btn.classList.add('bg-navy-500', 'text-white', 'border-navy-500');
            
            selectedTallaBtn = btn;
            preselectedTalla = btn.getAttribute('data-talla');
            
            if (currentView === 'jerseys-pedido') {
                if (!isAgotado && !isProximamente) {
                    openPedidoModal(producto, preselectedTalla);
                }
            }
        });
    });

    const imgEl = article.querySelector('.product-card-img');
    const dots = article.querySelectorAll('.carousel-dot');
    
    const updateImage = (newIdx) => {
        currentImgIdx = newIdx;
        imgEl.src = images[currentImgIdx];
        dots.forEach((dot, idx) => {
            if (idx === currentImgIdx) {
                dot.className = 'carousel-dot w-1.5 h-1.5 rounded-full bg-white transition-all duration-300';
            } else {
                dot.className = 'carousel-dot w-1.5 h-1.5 rounded-full bg-white/40 transition-all duration-300';
            }
        });
    };
    
    const prevBtn = article.querySelector('.carousel-prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIdx = (currentImgIdx - 1 + images.length) % images.length;
            updateImage(newIdx);
        });
    }
    
    const nextBtn = article.querySelector('.carousel-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIdx = (currentImgIdx + 1) % images.length;
            updateImage(newIdx);
        });
    }
    
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(dot.getAttribute('data-idx'));
            updateImage(idx);
        });
    });

    const imgContainer = article.querySelector('.product-image-container');
    if (imgContainer) {
        imgContainer.addEventListener('click', (e) => {
            if (e.target.closest('.carousel-prev-btn') || e.target.closest('.carousel-next-btn') || e.target.closest('.carousel-dot')) {
                return;
            }
            openModal(images[currentImgIdx], images, currentImgIdx);
        });
    }
    
    const detailsContainer = article.querySelector('.product-details-container');
    if (detailsContainer) {
        detailsContainer.addEventListener('click', (e) => {
            if (currentView === 'jerseys-pedido') {
                if (!isAgotado && !isProximamente) {
                    openPedidoModal(producto, preselectedTalla);
                }
            } else {
                const activeProfile = localStorage.getItem('current_perfil') || 'Administrador';
                if (activeProfile === 'Administrador') {
                    openInventoryModal(producto);
                }
            }
        });
    }

    const btnAgregar = article.querySelector('.btn-agregar-pedido');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar doble click en detailsContainer
            openPedidoModal(producto, preselectedTalla);
        });
    }
    
    return article;
}

// --- FUNCIONES DEL CRUD DE CLIENTES ---

async function fetchClients(keepPage = false) {
    renderClientSkeletons(clientsPerPage);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "search_clients", filtros: {} })
        });
        const data = await response.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            // Reversar el arreglo para mostrar los clientes más recientes al inicio del grid
            allClients = data.data.reverse();
        } else {
            console.error("Error al obtener clientes:", data.message);
            allClients = [];
        }
    } catch (error) {
        console.error("Error al consultar clientes:", error);
        allClients = [];
    }
    applyClientFilters(keepPage);
}

function applyClientFilters(keepPage = false) {
    const term = DOM.admin.clientFilterSearch ? DOM.admin.clientFilterSearch.value.trim().toLowerCase() : '';
    
    clientsFiltered = allClients.filter(c => {
        const matchName = !term || (c.nombre_completo && c.nombre_completo.toLowerCase().includes(term));
        const matchUser = !term || (c.usuario && c.usuario.toLowerCase().includes(term));
        return matchName || matchUser;
    });

    if (keepPage === true) {
        const totalItems = clientsFiltered.length;
        const totalPages = Math.ceil(totalItems / clientsPerPage) || 1;
        if (clientCurrentPage > totalPages) {
            clientCurrentPage = totalPages;
        }
    } else {
        clientCurrentPage = 1;
    }
    renderClientsTable();
}

function openClientsModal() {
    DOM.admin.clientsModal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.admin.clientsModal.offsetWidth;
    DOM.admin.clientsModal.classList.remove('opacity-0');
    DOM.admin.clientsModal.querySelector('.transform').classList.remove('scale-95');
    DOM.admin.clientsModal.querySelector('.transform').classList.add('scale-100');
    document.body.style.overflow = 'hidden';
    
    if (DOM.admin.clientFilterSearch) DOM.admin.clientFilterSearch.value = '';
    fetchClients();
}

function closeClientsModal() {
    DOM.admin.clientsModal.classList.add('opacity-0');
    DOM.admin.clientsModal.querySelector('.transform').classList.remove('scale-100');
    DOM.admin.clientsModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.clientsModal.classList.add('hidden');
        if (DOM.admin.invModal.classList.contains('hidden') && DOM.admin.listModal.classList.contains('hidden') && DOM.admin.createModal.classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
    }, 300);
}

function openClientFormModal(client = null) {
    if (client) {
        editingClientId = client.id_cliente;
        DOM.admin.clientFormTitle.textContent = "Editar Cliente";
        DOM.admin.clientInputs.nombre.value = client.nombre_completo || '';
        DOM.admin.clientInputs.telefono.value = client.telefono || '';
        DOM.admin.clientInputs.usuario.value = client.usuario || '';
        DOM.admin.clientInputs.password.value = client.password || '';
        let clientPerfil = client.perfil || '';
        if (clientPerfil === 'Súper Mayoreo' || clientPerfil === 'Mayoreo Súper') {
            clientPerfil = 'Mayoreo';
        }
        DOM.admin.clientInputs.perfil.value = clientPerfil;
        DOM.admin.clientInputs.calle.value = client.calle || '';
        DOM.admin.clientInputs.numero.value = client.numero || '';
        DOM.admin.clientInputs.colonia.value = client.colonia || '';
        DOM.admin.clientInputs.municipio.value = client.municipio || '';
        DOM.admin.clientInputs.cp.value = client.cp || '';
        DOM.admin.clientInputs.referencias.value = client.referencias || '';
        DOM.admin.clientInputs.usuario.disabled = true;
    } else {
        editingClientId = null;
        DOM.admin.clientFormTitle.textContent = "Registrar Nuevo Cliente";
        DOM.admin.formClient.reset();
        DOM.admin.clientInputs.usuario.disabled = false;
        DOM.admin.clientInputs.perfil.value = "Menudeo";
    }
    
    DOM.admin.clientFormModal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.admin.clientFormModal.offsetWidth;
    DOM.admin.clientFormModal.classList.remove('opacity-0');
    DOM.admin.clientFormModal.querySelector('.transform').classList.remove('scale-95');
    DOM.admin.clientFormModal.querySelector('.transform').classList.add('scale-100');
}

function closeClientFormModal() {
    DOM.admin.clientFormModal.classList.add('opacity-0');
    DOM.admin.clientFormModal.querySelector('.transform').classList.remove('scale-100');
    DOM.admin.clientFormModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.clientFormModal.classList.add('hidden');
        DOM.admin.formClient.reset();
        
        // Resetear tipo de contraseña y su icono
        const passInput = DOM.admin.clientInputs.password;
        if (passInput) passInput.type = 'password';
        const btnToggleClientPass = document.getElementById('btn-toggle-client-pass');
        if (btnToggleClientPass) {
            btnToggleClientPass.innerHTML = `<svg class="w-4 h-4 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`;
        }
        
        editingClientId = null;
    }, 300);
}

function renderClientSkeletons(count = 5) {
    DOM.admin.clientTableBody.innerHTML = '';
    DOM.admin.clientListEmpty.classList.add('hidden');
    DOM.admin.clientTableBody.closest('div.overflow-x-auto').classList.remove('hidden');
    if (DOM.admin.clientPageInfo && DOM.admin.clientPageInfo.parentElement) {
        DOM.admin.clientPageInfo.parentElement.classList.add('hidden');
    }
    
    for (let i = 0; i < count; i++) {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-white/5 animate-pulse';
        tr.innerHTML = `
            <td class="px-3 py-3 w-[35%]">
                <div class="space-y-2">
                    <div class="h-3.5 bg-dark-200 rounded-md w-3/4"></div>
                    <div class="h-2 bg-dark-200 rounded-md w-1/2"></div>
                </div>
            </td>
            <td class="px-3 py-3 w-[20%]">
                <div class="h-3 bg-dark-200 rounded-md w-2/3"></div>
            </td>
            <td class="px-3 py-3 w-[15%]">
                <div class="h-5 bg-dark-200 rounded-md w-16"></div>
            </td>
            <td class="px-3 py-3 w-[18%]">
                <div class="h-3 bg-dark-200 rounded-md w-5/6"></div>
            </td>
            <td class="px-3 py-3 w-[12%] text-right">
                <div class="flex justify-end gap-1.5">
                    <div class="w-7 h-7 bg-dark-200 rounded-md"></div>
                    <div class="w-7 h-7 bg-dark-200 rounded-md"></div>
                </div>
            </td>
        `;
        DOM.admin.clientTableBody.appendChild(tr);
    }
}

function renderClientsTable() {
    DOM.admin.clientTableBody.innerHTML = '';
    
    if (!clientsFiltered || clientsFiltered.length === 0) {
        DOM.admin.clientListEmpty.classList.remove('hidden');
        DOM.admin.clientTableBody.closest('div.overflow-x-auto').classList.add('hidden');
        DOM.admin.clientPageInfo.parentElement.classList.add('hidden');
        return;
    }
    
    DOM.admin.clientListEmpty.classList.add('hidden');
    DOM.admin.clientTableBody.closest('div.overflow-x-auto').classList.remove('hidden');
    DOM.admin.clientPageInfo.parentElement.classList.remove('hidden');
    
    const totalItems = clientsFiltered.length;
    const totalPages = Math.ceil(totalItems / clientsPerPage);
    const startIndex = (clientCurrentPage - 1) * clientsPerPage;
    const endIndex = Math.min(startIndex + clientsPerPage, totalItems);
    
    const paginatedItems = clientsFiltered.slice(startIndex, endIndex);
    
    DOM.admin.clientPageInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems}`;
    DOM.admin.clientPagePrev.disabled = clientCurrentPage === 1;
    DOM.admin.clientPageNext.disabled = clientCurrentPage === totalPages;
    
    paginatedItems.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors group';
        
        let clientPerfil = client.perfil || 'Menudeo';
        if (clientPerfil === 'Súper Mayoreo' || clientPerfil === 'Mayoreo Súper') {
            clientPerfil = 'Mayoreo';
        }
        
        let perfilBadgeColor = 'bg-white/5 text-gray-400 border-white/10';
        if (clientPerfil === 'Administrador') {
            perfilBadgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        } else if (clientPerfil === 'Mayoreo') {
            perfilBadgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        } else if (clientPerfil === 'Menudeo') {
            perfilBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        }

        const direccionResumida = client.calle 
            ? `${client.calle} #${client.numero || ''}, Col. ${client.colonia || ''}` 
            : 'Sin dirección';
            
        const isActivo = (client.activo !== 0 && client.activo !== "0");
        const statusBtnClass = isActivo 
            ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white' 
            : 'bg-gray-500/10 hover:bg-gray-500 text-gray-500 hover:text-white';
        const statusBtnTitle = isActivo ? 'Desactivar Cliente' : 'Activar Cliente';
        const statusIcon = isActivo 
            ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8a5 5 0 010 10H8a5 5 0 010-10z"></path><circle cx="16" cy="12" r="3" fill="currentColor"></circle></svg>` 
            : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8a5 5 0 010 10H8a5 5 0 010-10z"></path><circle cx="8" cy="12" r="3" fill="currentColor"></circle></svg>`;

        tr.innerHTML = `
            <td class="px-3 py-2">
                <div>
                    <div class="font-bold text-white text-xs cursor-default leading-tight">${client.nombre_completo || 'Sin Nombre'}</div>
                    <div class="text-[9px] font-mono text-gray-500 mt-0.5">Usuario: ${client.usuario || 'N/A'} | ID: ${client.id_cliente || 'N/A'}</div>
                </div>
            </td>
            <td class="px-3 py-2 text-xs text-gray-300">
                ${client.telefono || '-'}
            </td>
            <td class="px-3 py-2">
                <span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider ${perfilBadgeColor} px-1.5 py-0.5 rounded border leading-none">
                    ${clientPerfil}
                </span>
            </td>
            <td class="px-3 py-2 text-xs text-gray-400 truncate max-w-[200px]" title="${client.calle ? `${client.calle} #${client.numero}, Col. ${client.colonia}, CP ${client.cp}, ${client.municipio}` : ''}">
                ${direccionResumida}
            </td>
            <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button class="p-1.5 rounded-md ${statusBtnClass} transition-all duration-300 shadow btn-toggle-client-status" title="${statusBtnTitle}" data-id="${client.id_cliente}">
                        ${statusIcon}
                    </button>
                    <button class="p-1.5 rounded-md bg-navy-500/10 hover:bg-navy-500 text-navy-400 hover:text-white transition-all duration-300 shadow hover:shadow-navy-500/30 btn-edit-client" title="Editar Cliente" data-id="${client.id_cliente}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 shadow hover:shadow-red-500/30 btn-delete-client" title="¿¿¿Eliminar Cliente" data-id="${client.id_cliente}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        
        DOM.admin.clientTableBody.appendChild(tr);
    });

    // Eventos de botones en la tabla
    document.querySelectorAll('.btn-toggle-client-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleToggleClientStatus(id);
        });
    });

    document.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const client = allClients.find(c => c.id_cliente === id);
            if (client) openClientFormModal(client);
        });
    });

    document.querySelectorAll('.btn-delete-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleDeleteClient(id);
        });
    });
}

async function handleSaveClient(e) {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btn-submit-client');
    const originalText = btnSubmit.innerHTML;
    
    const payload = {
        action: editingClientId ? "update_client" : "create_client",
        nombre_completo: DOM.admin.clientInputs.nombre.value.trim(),
        telefono: DOM.admin.clientInputs.telefono.value.trim(),
        usuario: DOM.admin.clientInputs.usuario.value.trim(),
        password: DOM.admin.clientInputs.password.value,
        perfil: DOM.admin.clientInputs.perfil.value,
        calle: DOM.admin.clientInputs.calle.value.trim(),
        numero: DOM.admin.clientInputs.numero.value.trim(),
        colonia: DOM.admin.clientInputs.colonia.value.trim(),
        municipio: DOM.admin.clientInputs.municipio.value.trim(),
        cp: DOM.admin.clientInputs.cp.value.trim(),
        referencias: DOM.admin.clientInputs.referencias.value.trim()
    };
    
    if (editingClientId) {
        payload.id_cliente = editingClientId;
    }
    
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "Guardando...";
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const isEditing = !!editingClientId;
            Swal.fire({
                icon: 'success',
                title: isEditing ? 'Cliente Actualizado' : 'Cliente Creado',
                text: data.message || 'La operación se realizó con éxito.',
                background: '#151515', color: '#fff',
                timer: 2000,
                showConfirmButton: false
            });
            closeClientFormModal();
            fetchClients(isEditing);
        } else {
            throw new Error(data.message || 'Error en la operación.');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            background: '#151515', color: '#fff'
        });
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

async function handleDeleteClient(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Cliente?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3b82f6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#151515',
        color: '#fff',
        customClass: { popup: 'border border-white/10 rounded-2xl' }
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "delete_client", id_cliente: id })
            });
            const data = await response.json();
            if (data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Eliminado',
                    text: data.message || 'El cliente ha sido eliminado.',
                    background: '#151515', color: '#fff',
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: { popup: 'border border-white/10 rounded-2xl' }
                });
                fetchClients();
            } else {
                throw new Error(data.message || 'Error al eliminar');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                background: '#151515',
                color: '#fff',
                customClass: { popup: 'border border-white/10 rounded-2xl' }
            });
        }
    }
}

async function handleToggleClientStatus(id) {
    const client = allClients.find(c => c.id_cliente === id);
    if (!client) return;
    
    const isActivo = (client.activo !== 0 && client.activo !== "0");
    const nuevoEstado = isActivo ? 0 : 1;
    const accionTexto = isActivo ? "desactivar" : "activar";
    
    const result = await Swal.fire({
        title: `¿${isActivo ? 'Desactivar' : 'Activar'} Cliente?`,
        text: `¿Estás seguro que deseas ${accionTexto} a ${client.nombre_completo || 'este cliente'}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: isActivo ? '#ef4444' : '#10b981',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: `Sí, ${accionTexto}`,
        cancelButtonText: 'Cancelar',
        background: '#151515',
        color: '#ffffff',
        customClass: { popup: 'border border-white/10 rounded-2xl shadow-2xl' }
    });
    
    if (result.isConfirmed) {
        Swal.fire({
            title: 'Procesando...',
            text: 'Actualizando estado del cliente.',
            allowOutsideClick: false,
            showConfirmButton: false,
            background: '#151515',
            color: '#ffffff',
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        try {
            const payload = {
                ...client,
                action: "update_client",
                activo: nuevoEstado
            };
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: `Cliente ${isActivo ? 'Desactivado' : 'Activado'}`,
                    text: `El cliente ha sido ${accionTexto}do con éxito.`,
                    background: '#151515',
                    color: '#ffffff',
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: { popup: 'border border-white/10 rounded-2xl' }
                });
                fetchClients(true); // Recargar manteniendo la página
            } else {
                throw new Error(data.message || 'Error al actualizar el estado.');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                background: '#151515',
                color: '#ffffff',
                customClass: { popup: 'border border-white/10 rounded-2xl' }
            });
        }
    }
}

// --- SISTEMA DE CARRITO Y Ordenes (NUEVA VISTA) ---

function switchView(view) {
    currentView = view;
    if (view === 'mis-jerseys') {
        if (DOM.actions && DOM.actions.navCatalogo) {
            DOM.actions.navCatalogo.forEach(btn => btn.className = "action-nav-catalogo w-full text-left px-4 py-2 text-sm text-white bg-navy-500/20 rounded-lg transition-colors flex items-center gap-2");
        }
        if (DOM.actions && DOM.actions.navJerseysView) {
            DOM.actions.navJerseysView.forEach(btn => btn.className = "action-nav-jerseys-view text-xs sm:text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-white/5");
        }
    } else if (view === 'jerseys-pedido') {
        if (DOM.actions && DOM.actions.navCatalogo) {
            DOM.actions.navCatalogo.forEach(btn => btn.className = "action-nav-catalogo w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-navy-500/20 rounded-lg transition-colors flex items-center gap-2");
        }
        if (DOM.actions && DOM.actions.navJerseysView) {
            DOM.actions.navJerseysView.forEach(btn => btn.className = "action-nav-jerseys-view text-xs sm:text-sm font-semibold text-white transition-colors flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10");
        }
    }
    renderLocalProducts(allProducts);
}

function openPedidoModal(producto, preselectedTalla = null) {
    currentJerseyForPedido = producto;
    
    // Configurar información del modal
    DOM.pedido.name.textContent = producto.nombre || 'Jersey Deportivo';
    let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
    if (profileToUse === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const basePrice = getBasePriceForProfile(producto, profileToUse);
    DOM.pedido.desc.innerHTML = `${producto.genero || '-'} | ${producto.tipo || '-'} | ${producto.version || '-'} | <span class="text-navy-400 font-bold">$${basePrice.toFixed(2)}</span>`;
    DOM.pedido.img.src = getFirstImage(producto.foto || producto.imagen) || '';
    
    // Limpiar y poblar select de tallas con stock disponible
    DOM.pedido.talla.innerHTML = '<option value="" disabled selected>Selecciona talla...</option>';
    let hasAvailableSizes = false;
    
    if (producto.tallas && Array.isArray(producto.tallas)) {
        producto.tallas.forEach(t => {
            const stockVal = t.stock !== undefined ? t.stock : t.inventario;
            if (stockVal > 0) {
                hasAvailableSizes = true;
                const option = document.createElement('option');
                option.value = t.talla;
                option.textContent = t.talla;
                DOM.pedido.talla.appendChild(option);
            }
        });
    }
    
    // Reiniciar campos
    DOM.pedido.cantidad.value = 1;
    DOM.pedido.cantidad.max = 999;
    DOM.pedido.stockInfo.textContent = '';
    
    // Seleccionar personalización por defecto
    if (DOM.pedido.personalizacion) {
        updatePersonalizacionDropdown();
        DOM.pedido.personalizacion.value = "PERS-NONE";
        handlePedidoPersonalizacionChange();
    }
    
    if (preselectedTalla) {
        DOM.pedido.talla.value = preselectedTalla;
        handlePedidoTallaChange();
    }
    
    // Abrir modal con animación
    DOM.pedido.modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.pedido.modal.offsetWidth;
    DOM.pedido.modal.classList.remove('opacity-0');
    DOM.pedido.modal.querySelector('.transform').classList.remove('scale-95');
    DOM.pedido.modal.querySelector('.transform').classList.add('scale-100');
    document.body.style.overflow = 'hidden';
}

function closePedidoModal() {
    DOM.pedido.modal.classList.add('opacity-0');
    DOM.pedido.modal.querySelector('.transform').classList.remove('scale-100');
    DOM.pedido.modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.pedido.modal.classList.add('hidden');
        DOM.pedido.form.reset();
        DOM.pedido.customTextContainer.classList.add('hidden');
        currentJerseyForPedido = null;
        if (DOM.cart.modal.classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
    }, 300);
}

function handlePedidoPersonalizacionChange() {
    const val = DOM.pedido.personalizacion.value;
    const isCustomized = val !== "PERS-NONE";
    
    let price = 0;
    if (isCustomized) {
        let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
        if (profileToUse === "Administrador") {
            profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
        }
        const isMayoreo = esPerfilMayoreoOMas(profileToUse);
        const persObj = allPersonalizaciones.find(x => String(x.id) === String(val)) || defaultPersonalizaciones.find(x => String(x.id) === String(val));
        if (persObj) {
            price = isMayoreo ? parseFloat(persObj.precio_mayoreo || 0) : parseFloat(persObj.precio_Menudeo || 0);
        }
    }
    
    if (DOM.pedido.personalizacionPrecio) {
        if (isCustomized && price > 0) {
            DOM.pedido.personalizacionPrecio.textContent = `Costo de personalización: +$${price.toFixed(2)}`;
        } else {
            DOM.pedido.personalizacionPrecio.textContent = `Sin costo adicional`;
        }
    }
    
    // Regla de cantidad para personalizados
    if (isCustomized) {
        DOM.pedido.cantidad.value = 1;
        DOM.pedido.cantidad.disabled = true;
        DOM.pedido.cantidad.classList.add('opacity-50', 'cursor-not-allowed');
        
        if (DOM.pedido.personalizacionRegla) {
            DOM.pedido.personalizacionRegla.textContent = "* Los jerseys personalizados se agregan de 1 en 1 para configurar cada nombre y número individualmente.";
            DOM.pedido.personalizacionRegla.classList.remove('hidden');
        }
    } else {
        DOM.pedido.cantidad.disabled = false;
        DOM.pedido.cantidad.classList.remove('opacity-50', 'cursor-not-allowed');
        
        if (DOM.pedido.personalizacionRegla) {
            DOM.pedido.personalizacionRegla.textContent = "";
            DOM.pedido.personalizacionRegla.classList.add('hidden');
        }
    }
    
    if (isCustomized) {
        DOM.pedido.customTextContainer.classList.remove('hidden');
        DOM.pedido.customText.setAttribute('required', 'true');
        DOM.pedido.customText.focus();
    } else {
        DOM.pedido.customTextContainer.classList.add('hidden');
        DOM.pedido.customText.value = '';
        DOM.pedido.customText.removeAttribute('required');
    }
}

function updatePersonalizacionDropdown() {
    if (!DOM.pedido.personalizacion) return;
    
    const currentVal = DOM.pedido.personalizacion.value || "PERS-NONE";
    DOM.pedido.personalizacion.innerHTML = '';
    
    const optNinguna = document.createElement('option');
    optNinguna.value = "PERS-NONE";
    optNinguna.textContent = "Ninguna";
    DOM.pedido.personalizacion.appendChild(optNinguna);
    
    let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
    if (profileToUse === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(profileToUse);
    
    allPersonalizaciones.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        const price = isMayoreo ? p.precio_mayoreo : p.precio_Menudeo;
        option.textContent = `${p.nombre} (+$${price.toFixed(2)})`;
        DOM.pedido.personalizacion.appendChild(option);
    });
    
    DOM.pedido.personalizacion.value = currentVal;
}

function handlePedidoTallaChange() {
    if (!currentJerseyForPedido) return;
    const selectedTalla = DOM.pedido.talla.value;
    const tallaObj = currentJerseyForPedido.tallas.find(t => t.talla === selectedTalla);
    
    if (tallaObj) {
        const stockVal = tallaObj.stock !== undefined ? tallaObj.stock : tallaObj.inventario;
        const existingItem = cart.find(item => item.producto.id === currentJerseyForPedido.id && item.talla === selectedTalla);
        const existingQty = existingItem ? existingItem.cantidad : 0;
        const limit = Math.max(0, stockVal - existingQty);
        
        DOM.pedido.cantidad.max = limit;
        if (limit === 0) {
            DOM.pedido.cantidad.value = 0;
            DOM.pedido.stockInfo.textContent = 'Agotado en carrito';
            DOM.pedido.stockInfo.classList.add('text-red-500');
        } else {
            DOM.pedido.stockInfo.textContent = '';
            DOM.pedido.stockInfo.classList.remove('text-red-500');
            if (parseInt(DOM.pedido.cantidad.value) > limit) {
                DOM.pedido.cantidad.value = limit;
            }
            if (parseInt(DOM.pedido.cantidad.value) === 0) {
                DOM.pedido.cantidad.value = 1;
            }
        }
    }
}

function handleAddToPedidoSubmit(e) {
    e.preventDefault();
    if (!currentJerseyForPedido) return;
    
    const selectedTalla = DOM.pedido.talla.value;
    const selectedQty = parseInt(DOM.pedido.cantidad.value) || 1;
    const selectedPersId = DOM.pedido.personalizacion.value;
    const customText = DOM.pedido.customText.value.trim().toUpperCase();
    
    if (!selectedTalla) {
        Swal.fire({ icon: 'warning', title: 'Talla requerida', text: 'Por favor selecciona una talla.', background: '#151515', color: '#fff' });
        return;
    }
    
    // Validar stock disponible
    const tallaObj = currentJerseyForPedido.tallas.find(t => t.talla === selectedTalla);
    const stockVal = tallaObj ? (tallaObj.stock !== undefined ? tallaObj.stock : tallaObj.inventario) : 0;
    
    // Validar acumulando lo que ya está en el carrito para esta talla de este jersey
    const existingQty = cart
        .filter(item => item.producto.id === currentJerseyForPedido.id && item.talla === selectedTalla)
        .reduce((sum, item) => sum + item.cantidad, 0);
        
    if (selectedQty + existingQty > stockVal) {
        if (existingQty > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Stock Insuficiente',
                text: `La cantidad solicitada supera el stock disponible (ya tienes ${existingQty} unidades en tu carrito).`,
                background: '#151515',
                color: '#fff'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Stock Insuficiente',
                text: `La cantidad solicitada supera el stock disponible para esta talla.`,
                background: '#151515',
                color: '#fff'
            });
        }
        return;
    }
    
    const cleanCustomText = selectedPersId === 'PERS-NONE' ? '' : customText;
    
    // Buscar si ya existe un artículo idéntico en el carrito para agruparlo
    const existingItem = cart.find(item => 
        item.producto.id === currentJerseyForPedido.id && 
        item.talla === selectedTalla && 
        item.personalizacionId === selectedPersId && 
        item.texto_personalizado === cleanCustomText
    );
    
    if (existingItem) {
        existingItem.cantidad += selectedQty;
    } else {
        cart.push({
            producto: currentJerseyForPedido,
            talla: selectedTalla,
            cantidad: selectedQty,
            personalizacionId: selectedPersId,
            texto_personalizado: cleanCustomText,
            id_inventario: tallaObj ? (tallaObj.id_inventario || tallaObj.IdInventario || '') : ''
        });
    }
    
    updateCartBadge();
    
    // Alerta de éxito tipo Toast adaptativa para móviles
    Swal.fire({
        icon: 'success',
        title: 'Agregado',
        text: `${currentJerseyForPedido.nombre} añadido.`,
        toast: true,
        position: window.innerWidth < 640 ? 'top' : 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        background: '#1e293b',
        color: '#ffffff',
        customClass: {
            popup: 'rounded-xl shadow-lg border border-white/10'
        }
    });
    
    closePedidoModal();
}

function updateCartBadge() {
    let totalItems = 0;
    cart.forEach(item => {
        totalItems += item.cantidad;
    });
    
    if (DOM.cartCount) {
        DOM.cartCount.textContent = totalItems;
        if (totalItems > 0) {
            DOM.cartCount.classList.remove('scale-0');
            DOM.cartCount.classList.add('scale-100');
            DOM.btnOpenCart.classList.add('text-navy-400');
        } else {
            DOM.cartCount.classList.remove('scale-100');
            DOM.cartCount.classList.add('scale-0');
            DOM.btnOpenCart.classList.remove('text-navy-400');
        }
    }
}

function openCartModal() {
    DOM.cart.modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void DOM.cart.modal.offsetWidth;
    DOM.cart.modal.classList.remove('opacity-0');
    DOM.cart.modal.querySelector('.transform').classList.remove('scale-95');
    DOM.cart.modal.querySelector('.transform').classList.add('scale-100');
    document.body.style.overflow = 'hidden';
    
    // Cargar info del usuario logueado
    const loggedUserStr = localStorage.getItem('logged_user');
    if (loggedUserStr) {
        const loggedUser = JSON.parse(loggedUserStr);
        if (DOM.cart.loggedName) DOM.cart.loggedName.textContent = loggedUser.nombre_completo || loggedUser.usuario;
        if (DOM.cart.loggedPerfil) DOM.cart.loggedPerfil.textContent = loggedUser.perfil || 'Menudeo';
    }
    
    renderCartItems();
}

function closeCartModal() {
    DOM.cart.modal.classList.add('opacity-0');
    DOM.cart.modal.querySelector('.transform').classList.remove('scale-100');
    DOM.cart.modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        DOM.cart.modal.classList.add('hidden');
        
        const isPedidoHidden = DOM.pedido && DOM.pedido.modal && DOM.pedido.modal.classList.contains('hidden');
        const isCreateHidden = DOM.admin && DOM.admin.createModal && DOM.admin.createModal.classList.contains('hidden');
        const isListHidden = DOM.admin && DOM.admin.listModal ? DOM.admin.listModal.classList.contains('hidden') : true;

        if (isPedidoHidden && isCreateHidden && isListHidden) {
            document.body.style.overflow = '';
        }
    }, 300);
}

async function ensureClientsLoaded() {
    // Ya no es necesario cargar clientes para el carrito porque usamos el usuario logueado
}

function getBasePriceForProfile(producto, profile) {
    let basePrice = 0;
    
    const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    
    let applySuper = false;
    if (isSuperMayoreoActivo) {
        if (esPerfilSuperMayoreo(profile)) {
            applySuper = true;
        } else {
            const totalPiezas = cart.reduce((sum, i) => sum + i.cantidad, 0);
            if (totalPiezas >= 10) {
                applySuper = true;
            } else if (String(profile).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === 'mayoreo') {
                const totalJugador = cart.filter(i => i.producto.version === 'Jugador').reduce((sum, i) => sum + i.cantidad, 0);
                const totalFan = cart.filter(i => i.producto.version === 'Aficionado' || i.producto.version === 'Fan').reduce((sum, i) => sum + i.cantidad, 0);
                
                if (producto.version === 'Jugador' && totalJugador >= (reglasMayoreoSuper.piezas_jugador || 10)) applySuper = true;
                if ((producto.version === 'Aficionado' || producto.version === 'Fan') && totalFan >= (reglasMayoreoSuper.piezas_fan || 15)) applySuper = true;
            }
        }
    }
    
    if (applySuper && producto.precio_mayoreo_super) {
        basePrice = parseFloat(producto.precio_mayoreo_super);
    } else if (esPerfilMayoreoOMas(profile)) {
        basePrice = parseFloat(producto.precio_mayoreo || 0);
    } else {
        basePrice = parseFloat(producto.precio_Menudeo || producto.precio_menudeo || 0);
    }
    
    // Soporte para productos con esquema de precio tradicional / compatibilidad hacia atrás
    if (basePrice === 0 && producto.precio) {
        basePrice = parseFloat(producto.precio || 0);
    }
    return basePrice;
}

function renderCartItems() {
    DOM.cart.itemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        DOM.cart.emptyMessage.classList.remove('hidden');
        DOM.cart.itemsContainer.classList.add('hidden');
        DOM.cart.subtotalVal.textContent = '$0.00';
        DOM.cart.personalizacionesVal.textContent = '$0.00';
        DOM.cart.totalVal.textContent = '$0.00';
        const envioRow = document.getElementById('cart-envio-row');
        if (envioRow) envioRow.classList.add('hidden');
        return;
    }
    
    DOM.cart.emptyMessage.classList.add('hidden');
    DOM.cart.itemsContainer.classList.remove('hidden');
    
    // Obtener perfil del cliente logueado
    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let clientProfile = activeProfile;
    if (activeProfile === "Administrador") {
        clientProfile = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    
    let subtotal = 0;
    let personalizacionesTotal = 0;
    
    cart.forEach((item, index) => {
        const prod = item.producto;
        const basePrice = getBasePriceForProfile(prod, clientProfile);
        
        // Obtener coste de personalización
        let persPrice = 0;
        let persName = "Ninguna";
        const isMayoreo = esPerfilMayoreoOMas(clientProfile);
        if (item.personalizacionId !== 'PERS-NONE') {
            const persObj = allPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId)) || defaultPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId));
            if (persObj) {
                persPrice = isMayoreo ? parseFloat(persObj.precio_mayoreo || 0) : parseFloat(persObj.precio_Menudeo || 0);
                persName = persObj.nombre;
            }
        }
        
        const finalUnitPrice = basePrice + persPrice;
        const itemTotal = finalUnitPrice * item.cantidad;
        
        subtotal += basePrice * item.cantidad;
        personalizacionesTotal += persPrice * item.cantidad;
        
        const imgUrl = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-3 bg-dark-200/20 p-2.5 rounded-xl border border-white/5 group';
        itemDiv.innerHTML = `
            <img src="${imgUrl}" alt="Foto" class="w-12 h-12 rounded-lg object-cover bg-dark flex-shrink-0">
            <div class="flex-grow min-w-0">
                <h4 class="font-bold text-white text-xs truncate leading-tight">${prod.nombre}</h4>
                <div class="text-[9px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">
                    ${prod.genero || '-'} | ${prod.tipo || '-'} | ${prod.version || '-'}
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5">
                    Talla: <span class="text-gray-300 font-semibold">${item.talla}</span> | 
                    Cant: <span class="text-gray-300 font-semibold">${item.cantidad}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5">
                    Pers: <span class="text-navy-400 font-semibold">${persName}</span>
                    ${item.texto_personalizado ? ` | <span class="text-emerald-400 font-mono">"${item.texto_personalizado}"</span>` : ''}
                </div>
            </div>
            <div class="text-right flex-shrink-0 min-w-[70px]">
                <div class="font-bold text-white text-xs">$${itemTotal.toFixed(2)}</div>
                <div class="text-[9px] text-gray-500 mt-0.5">$${finalUnitPrice.toFixed(2)} c/u</div>
            </div>
            <button onclick="removeCartItem(${index})" class="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors" title="¿¿¿Eliminar artículo">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        DOM.cart.itemsContainer.appendChild(itemDiv);
    });
    
    let totalPieces = cart.reduce((sum, item) => sum + item.cantidad, 0);
    let shippingCost = 0;
    
    const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
    const envioRow = document.getElementById('cart-envio-row');
    const envioVal = document.getElementById('cart-envio-val');
    
    if (cartEnvioCheckbox && cartEnvioCheckbox.checked) {
        const rule = reglasEnvio.find(r => totalPieces >= r.min_piezas && totalPieces <= r.max_piezas);
        if (rule) {
            shippingCost = parseFloat(rule.costo_envio || 0);
        }
        
        if (envioRow) {
            envioRow.classList.remove('hidden');
            envioRow.style.display = 'flex'; // Ensure it overrides any styles
            
            if (shippingCost === 0) {
                envioVal.textContent = "Gratis";
                envioVal.classList.add('text-emerald-400');
                envioVal.classList.remove('text-white');
            } else {
                envioVal.textContent = `$${shippingCost.toFixed(2)}`;
                envioVal.classList.remove('text-emerald-400');
                envioVal.classList.add('text-white');
            }
        }
    } else {
        if (envioRow) {
            envioRow.classList.add('hidden');
            envioRow.style.display = 'none';
        }
    }
    
    const grandTotal = subtotal + personalizacionesTotal + shippingCost;
    DOM.cart.subtotalVal.textContent = `$${subtotal.toFixed(2)}`;
    DOM.cart.personalizacionesVal.textContent = `$${personalizacionesTotal.toFixed(2)}`;
    DOM.cart.totalVal.textContent = `$${grandTotal.toFixed(2)}`;
}

window.removeCartItem = function(index) {
    cart.splice(index, 1);
    updateCartBadge();
    renderCartItems();
};

function emptyCart(confirm = true) {
    if (cart.length === 0) return;
    
    const clearAction = () => {
        cart = [];
        updateCartBadge();
        renderCartItems();
        Swal.fire({
            icon: 'info',
            title: 'Carrito Vaciado',
            text: 'Tu pedido ha sido vaciado.',
            timer: 1500,
            showConfirmButton: false,
            background: '#151515', color: '#fff'
        });
    };
    
    if (confirm === true) {
        Swal.fire({
            title: '¿Vaciar el pedido?',
            text: 'Se ¿¿¿Eliminarán todos los jerseys de tu carrito.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#222222',
            confirmButtonText: 'Sí, vaciar',
            cancelButtonText: 'Cancelar',
            background: '#151515', color: '#fff',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        }).then((result) => {
            if (result.isConfirmed) {
                clearAction();
            }
        });
    } else {
        clearAction();
    }
}

async function submitOrder() {
    if (cart.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Pedido Vacío', text: 'Tu pedido no contiene artículos.', background: '#151515', color: '#fff' });
        return;
    }
    
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) {
        Swal.fire({ icon: 'warning', title: 'No Autenticado', text: 'Por favor inicia sesión para completar tu pedido.', background: '#151515', color: '#fff' });
        return;
    }
    
    const loggedUser = JSON.parse(loggedUserStr);
    const selectedClientId = loggedUser.id_cliente;
    
    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let profile = activeProfile;
    if (activeProfile === "Administrador") {
        profile = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(profile);
    
    // Construir lista de artículos con precios calculados para el payload
    const articulos = cart.map(item => {
        const basePrice = getBasePriceForProfile(item.producto, profile);
        
        let persPrice = 0;
        if (item.personalizacionId !== 'PERS-NONE') {
            const persObj = allPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId)) || defaultPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId));
            if (persObj) {
                persPrice = isMayoreo ? parseFloat(persObj.precio_mayoreo || 0) : parseFloat(persObj.precio_Menudeo || 0);
            }
        }
        
        const finalPrice = basePrice + persPrice;
        
        return {
            id_producto: item.producto.id,
            categoria: item.producto.genero || 'Adulto',
            talla: item.talla,
            cantidad: item.cantidad,
            id_personalizacion: item.personalizacionId,
            texto_personalizado: item.texto_personalizado,
            precio_unitario_final: finalPrice,
            id_inventario: item.id_inventario || ''
        };
    });
    
    const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
    const envio_domicilio = cartEnvioCheckbox && cartEnvioCheckbox.checked;
    
    let totalPieces = cart.reduce((sum, item) => sum + item.cantidad, 0);
    let shippingCost = 0;
    if (envio_domicilio) {
        const rule = reglasEnvio.find(r => totalPieces >= r.min_piezas && totalPieces <= r.max_piezas);
        if (rule) shippingCost = parseFloat(rule.costo_envio || 0);
    }

    const payload = {
        action: "create_order",
        token: localStorage.getItem('session_token') || '',
        id_cliente: selectedClientId,
        tipo_precio_aplicado: profile,
        articulos: articulos,
        envio: envio_domicilio,
        costo_envio: shippingCost
    };
    
    // Mostrar spinner de carga
    Swal.fire({
        title: 'Procesando Pedido',
        text: 'Por favor espera un momento...',
        allowOutsideClick: false,
        background: '#151515', color: '#fff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            if (data.actualizacion_perfil) {
                const user = JSON.parse(localStorage.getItem('logged_user'));
                user.perfil = data.actualizacion_perfil.perfil;
                user.super_mayoreo_exp = data.actualizacion_perfil.super_mayoreo_exp;
                user.super_mayoreo_acum = data.actualizacion_perfil.super_mayoreo_acum;
                localStorage.setItem('logged_user', JSON.stringify(user));
                localStorage.setItem('current_perfil', user.perfil);
                updateBrandTextColor();
            }
            
            // Generar HTML de recibo de compra
            let subtotal = 0;
            let totalQty = 0;
            let articulosHtml = '';
            
            cart.forEach(item => {
                const basePrice = getBasePriceForProfile(item.producto, profile);
                
                let persPrice = 0;
                let persName = "Ninguna";
                if (item.personalizacionId !== 'PERS-NONE') {
                    const persObj = allPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId)) || defaultPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId));
                    if (persObj) {
                        persPrice = isMayoreo ? parseFloat(persObj.precio_mayoreo || 0) : parseFloat(persObj.precio_Menudeo || 0);
                        persName = persObj.nombre;
                    }
                }
                
                const finalUnitPrice = basePrice + persPrice;
                const itemTotal = finalUnitPrice * item.cantidad;
                
                subtotal += itemTotal;
                totalQty += item.cantidad;
                
                articulosHtml += `
                    <div class="flex flex-col py-1.5 border-b border-white/5">
                        <div class="flex justify-between text-xs">
                            <div class="truncate pr-4 flex-1">
                                <span class="font-bold text-gray-300">${item.cantidad}x</span> ${item.producto.nombre} (${item.talla})
                                <div class="text-[9px] text-gray-500 font-medium uppercase mt-0.5">${item.producto.genero || '-'} | ${item.producto.tipo || '-'} | ${item.producto.version || '-'}</div>
                            </div>
                            <div class="text-right font-mono text-gray-300">$${itemTotal.toFixed(2)}</div>
                        </div>
                        <div class="flex justify-between text-[9px] text-gray-500 mt-0.5 pl-5">
                            <div>
                                Base: $${basePrice.toFixed(2)} ${persPrice > 0 ? `+ Personalización (${persName}): $${persPrice.toFixed(2)}` : ''}
                                ${item.texto_personalizado ? `<span class="text-emerald-500 font-semibold block mt-0.5">"${item.texto_personalizado}"</span>` : ''}
                            </div>
                            <div class="text-right font-mono">$${finalUnitPrice.toFixed(2)} c/u</div>
                        </div>
                    </div>
                `;
            });
            
            const orderIdStr = data.id_orden || data.id || data.order_id || 'Generado';
            const receiptHtml = `
                <div class="text-center text-gray-400 font-mono text-sm tracking-wider mb-4 border border-white/10 rounded-lg py-2 bg-dark-200/50">
                    ID Orden: <span class="text-white">${orderIdStr}</span>
                </div>
                <div class="text-left space-y-4 text-sm mt-3 border-t border-white/10 pt-3">
                    <div class="grid grid-cols-2 text-xs text-gray-400 gap-1">
                        <div><strong>Cliente:</strong> ${loggedUser.nombre_completo}</div>
                        <div><strong>Cantidad total:</strong> ${totalQty} playeras</div>
                    </div>
                    
                    <div class="space-y-1">
                        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Desglose de Artículos:</div>
                        ${articulosHtml}
                    </div>
                    
                    <div class="flex justify-between text-base border-t border-white/10 pt-3 font-bold">
                        <span>Subtotal:</span>
                        <span class="text-white">$${subtotal.toFixed(2)}</span>
                    </div>
                    ${shippingCost > 0 || envio_domicilio ? `
                    <div class="flex justify-between text-sm pt-1">
                        <span>Costo de Envío:</span>
                        <span class="${shippingCost === 0 ? 'text-emerald-400' : 'text-white'}">${shippingCost === 0 ? 'Gratis' : '$' + shippingCost.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="flex justify-between text-lg border-t border-white/10 mt-2 pt-2 font-bold">
                        <span>Total de la Orden:</span>
                        <span class="text-emerald-400">$${(subtotal + shippingCost).toFixed(2)}</span>
                    </div>
                </div>
            `;
            const waText = encodeURIComponent(
                `*¡Hola! Acabo de realizar un nuevo pedido* 🛒👕\n\n` +
                `*ID de Orden:* ${orderIdStr}\n` +
                `*Total de Jerseys:* ${totalQty} piezas\n` +
                (envio_domicilio ? `*Costo de Envío:* ${shippingCost === 0 ? 'Gratis' : '$' + shippingCost.toFixed(2)}\n` : '') +
                `*Total a Pagar:* $${(subtotal + shippingCost).toFixed(2)}\n\n` +
                `Quedo en espera de la confirmación. ¡Muchas gracias!`
            );
            const waUrl = `https://wa.me/5218132698182?text=${waText}`;
            
            Swal.fire({
                icon: 'success',
                title: '¡Pedido Realizado!',
                html: receiptHtml,
                background: '#151515', color: '#fff',
                confirmButtonColor: '#1d4ed8',
                confirmButtonText: 'Entendido',
                customClass: { popup: 'border border-white/10 rounded-2xl max-w-md shadow-2xl shadow-emerald-500/5' }
            });

            // 🚀 Abrir WhatsApp automáticamente
            abrirWhatsAppAutomatico(waUrl);
            
            // Vaciar carrito
            cart = [];
            updateCartBadge();
            
            // Resetear checkbox de envío a domicilio y actualizar interfaz del carrito
            const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
            if (cartEnvioCheckbox) cartEnvioCheckbox.checked = false;
            renderCartItems();
            
            closeCartModal();
            
            // Recargar productos en background para actualizar inventarios/stock
            fetchInitialProducts();
            
            // Recargar historial de órdenes del cliente para que aparezcan en su historial
            fetchUserOrdenes(true).then(() => {
                renderUserOrdenesList();
            });
            
            // Si el administrador está logueado, actualizar caché global de órdenes
            if (typeof fetchOrdenes === 'function') {
                fetchOrdenes();
            }
        } else if (data.status === 'stock_conflict') {
            let listHtml = '<div class="space-y-2 border-y border-white/10 py-3 my-3 text-xs">';
            data.conflictos.forEach(c => {
                const dispText = c.disponible > 0 ? `Quedan ${c.disponible} pzas` : 'Agotado';
                listHtml += `
                    <div class="flex justify-between items-center text-gray-300">
                        <div class="truncate pr-4 flex-1 text-left">
                            <strong>${c.nombre}</strong> (${c.talla})
                            <div class="text-[10px] text-gray-500">Solicitado: ${c.solicitado}</div>
                        </div>
                        <div class="font-semibold ${c.disponible > 0 ? 'text-amber-400' : 'text-red-400'}">${dispText}</div>
                    </div>
                `;
            });
            listHtml += '</div>';
            
            Swal.fire({
                icon: 'warning',
                title: 'Conflicto de Stock',
                html: `
                    <div class="text-left text-xs space-y-2 text-gray-300">
                        <p>Algunos productos en tu carrito ya no están disponibles en la cantidad solicitada debido a compras recientes de otros usuarios:</p>
                        ${listHtml}
                        <p class="text-[10px] text-gray-400">¿Deseas ajustar automáticamente tu pedido al stock disponible?</p>
                    </div>
                `,
                background: '#151515', color: '#fff',
                showCancelButton: true,
                confirmButtonColor: '#d97706',
                cancelButtonColor: '#374151',
                confirmButtonText: 'Sí, ajustar',
                cancelButtonText: 'No, revisar carrito',
                customClass: { popup: 'border border-white/10 rounded-2xl max-w-sm' }
            }).then((result) => {
                if (result.isConfirmed) {
                    data.conflictos.forEach(conf => {
                        const itemIdx = cart.findIndex(i => String(i.id_inventario) === String(conf.id_inventario));
                        if (itemIdx !== -1) {
                            if (conf.disponible > 0) {
                                cart[itemIdx].cantidad = conf.disponible;
                            } else {
                                cart.splice(itemIdx, 1);
                            }
                        }
                    });
                    
                    localStorage.setItem('cart', JSON.stringify(cart));
                    updateCartBadge();
                    renderCartItems();
                    
                    // Abrir el carrito con las nuevas piezas y totales actualizados para confirmación manual
                    openCartModal();
                } else {
                    data.conflictos.forEach(conf => {
                        if (conf.disponible <= 0) {
                            const itemIdx = cart.findIndex(i => String(i.id_inventario) === String(conf.id_inventario));
                            if (itemIdx !== -1) {
                                cart.splice(itemIdx, 1);
                            }
                        }
                    });
                    localStorage.setItem('cart', JSON.stringify(cart));
                    updateCartBadge();
                    renderCartItems();
                    
                    // Abrir el carrito para revisión manual
                    openCartModal();
                }
            });
        } else {
            throw new Error(data.message || 'Error desconocido al registrar pedido.');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: error.message || 'Ocurrió un problema de conexión al guardar el pedido.',
            background: '#151515', color: '#fff',
            confirmButtonColor: '#ef4444'
        });
    }
}

// --- Óórdenes / PEDIDOS ---

let currentOrdenes = []; // Guarda las óórdenes actuales cargadas
let allFetchedOrdenes = []; // Guarda todas las óórdenes originales
let OrdenesCurrentPage = 1;
let OrdenesPerPage = 5;

function openOrdenesModal() {
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) return;
    const loggedUser = JSON.parse(loggedUserStr);
    if (loggedUser.perfil !== 'Administrador') return;

    DOM.admin.Ordenes.modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    // Animar entrada
    setTimeout(() => {
        DOM.admin.Ordenes.modal.classList.remove('opacity-0');
        DOM.admin.Ordenes.modal.querySelector('.bg-dark-100').classList.remove('scale-95');
    }, 10);
    // Limpiar filtros al abrir
    DOM.admin.Ordenes.filtros.nombre.value = '';
    DOM.admin.Ordenes.filtros.id.value = '';
    DOM.admin.Ordenes.filtros.estatus.value = '';
    
    // Buscar historial completo inicialmente
    fetchOrdenes();
}

function closeOrdenesModal() {
    DOM.admin.Ordenes.modal.classList.add('opacity-0');
    DOM.admin.Ordenes.modal.querySelector('.bg-dark-100').classList.add('scale-95');
    setTimeout(() => {
        DOM.admin.Ordenes.modal.classList.add('hidden');
    }, 300);
}

function handleSearchOrdenes() {
    const nombre = DOM.admin.Ordenes.filtros.nombre.value.trim().toLowerCase();
    const id = DOM.admin.Ordenes.filtros.id.value.trim().toLowerCase();
    const estatus = DOM.admin.Ordenes.filtros.estatus.value;
    
    currentOrdenes = allFetchedOrdenes.filter(orden => {
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        const nombreCliente = (orden.nombre_cliente || (clientObj ? clientObj.nombre_completo : null) || orden.id_cliente || '').toLowerCase();
        
        const matchNombre = !nombre || nombreCliente.includes(nombre);
        const matchId = !id || orden.id_orden.toLowerCase().includes(id);
        const matchEstatus = !estatus || orden.estatus === estatus;
        
        return matchNombre && matchId && matchEstatus;
    });
    
    OrdenesCurrentPage = 1;
    renderOrdenes();
}

async function fetchOrdenes() {
    DOM.admin.Ordenes.listContainer.innerHTML = '';
    DOM.admin.Ordenes.emptyState.classList.add('hidden');
    DOM.admin.Ordenes.loadingState.classList.remove('hidden');
    
    const payload = { action: 'search_orders' };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        DOM.admin.Ordenes.loadingState.classList.add('hidden');
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
            allFetchedOrdenes = result.data;
            handleSearchOrdenes();
        } else {
            allFetchedOrdenes = [];
            currentOrdenes = [];
            DOM.admin.Ordenes.emptyState.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error fetching óórdenes:', error);
        DOM.admin.Ordenes.loadingState.classList.add('hidden');
        Swal.fire({ icon: 'error', title: 'Error de Red', text: 'No se pudieron cargar las óórdenes.', background: '#151515', color: '#fff' });
    }
}

function renderOrdenes() {
    const container = DOM.admin.Ordenes.listContainer;
    if (container) container.innerHTML = '';
    
    const paginationEl = document.getElementById('admin-ordenes-pagination');
    const pageInfoEl = document.getElementById('admin-ordenes-page-info');
    
    let ordersToRender = currentOrdenes;
    
    if (currentOrdenes.length > OrdenesPerPage) {
        if (paginationEl) {
            paginationEl.classList.remove('hidden');
            paginationEl.classList.add('flex');
        }
        const start = (OrdenesCurrentPage - 1) * OrdenesPerPage;
        const end = Math.min(start + OrdenesPerPage, currentOrdenes.length);
        if (pageInfoEl) pageInfoEl.textContent = `Mostrando ${start + 1} - ${end} de ${currentOrdenes.length}`;
        
        ordersToRender = currentOrdenes.slice(start, start + OrdenesPerPage);
    } else {
        if (paginationEl) {
            paginationEl.classList.add('hidden');
            paginationEl.classList.remove('flex');
        }
    }
    
    ordersToRender.forEach(orden => {
        const dateObj = new Date(orden.fecha);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let totalPiezas = 0;
        let articulosHtml = '';
        if (orden.articulos_carrito && orden.articulos_carrito.length > 0) {
            articulosHtml = orden.articulos_carrito.map(art => {
                totalPiezas += Number(art.cantidad) || 0;
                
                // Lookup product in adminProducts or productsData
                let prod = {};
                if (art.id_playera && typeof art.id_playera === 'object') {
                    prod = art.id_playera;
                } else {
                    const prodId = art.id_producto || art.id_playera;
                    prod = (window.adminFilteredProducts && window.adminFilteredProducts.find(p => String(p.id) === String(prodId))) 
                        || (window.productsData && window.productsData.find(p => String(p.id) === String(prodId))) 
                        || {};
                }
                
                const imgUrl = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
                const nombre = prod.nombre || `Producto ${art.id_producto || (art.id_playera && art.id_playera.id) || 'Desconocido'}`;
                const genero = prod.genero || '-';
                const tipo = prod.tipo || '-';
                const version = prod.version || '-';
                
                const itemTotal = Number(art.subtotal_renglon);
                const unitPrice = Number(art.precio_unitario_final) || (itemTotal / Number(art.cantidad));
                
                let persName = art.texto_personalizado ? 'Sí' : 'Ninguna';
                if (art.id_personalizacion && typeof art.id_personalizacion === 'object') {
                    if (art.id_personalizacion.id_personalizacion !== 'PERS-NONE' && art.id_personalizacion.concepto) {
                        persName = art.id_personalizacion.concepto;
                    } else {
                        persName = 'Ninguna';
                    }
                } else if (art.id_personalizacion && art.id_personalizacion !== 'PERS-NONE') {
                    const pObj = (window.allPersonalizaciones && window.allPersonalizaciones.find(x => String(x.id) === String(art.id_personalizacion))) 
                        || (window.defaultPersonalizaciones && window.defaultPersonalizaciones.find(x => String(x.id) === String(art.id_personalizacion)));
                    if (pObj) persName = pObj.nombre;
                }

                return `
        <div class="flex items-center gap-3 bg-dark-200/20 p-2.5 rounded-xl border border-white/5 mb-2 last:mb-0">
            <img src="${imgUrl}" alt="Foto" class="w-12 h-12 rounded-lg object-cover bg-dark flex-shrink-0">
            <div class="flex-grow min-w-0">
                <h4 class="font-bold text-white text-xs truncate leading-tight">${nombre}</h4>
                <div class="text-[9px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">
                    ${genero} | ${tipo} | ${version}
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5">
                    Talla: <span class="text-gray-300 font-semibold">${art.talla}</span> | 
                    Cant: <span class="text-gray-300 font-semibold">${art.cantidad}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5">
                    Pers: <span class="text-navy-400 font-semibold">${persName}</span>
                    ${art.texto_personalizado ? ` | <span class="text-emerald-400 font-mono">"${art.texto_personalizado}"</span>` : ''}
                </div>
            </div>
            <div class="text-right flex-shrink-0 min-w-[70px]">
                <div class="font-bold text-white text-xs">$${itemTotal.toFixed(2)}</div>
                <div class="text-[9px] text-gray-500 mt-0.5">$${unitPrice.toFixed(2)} c/u</div>
            </div>
        </div>`;
            }).join('');
        } else {
            articulosHtml = '<div class="text-xs text-gray-500 italic">Sin detalles de artículos</div>';
        }
        
        let estatusColorClass = 'bg-gray-500/20 text-gray-400 border border-gray-500/20';
        switch (orden.estatus) {
            case 'Pendiente': estatusColorClass = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'; break;
            case 'Revisando': estatusColorClass = 'bg-purple-500/20 text-purple-400 border border-purple-500/20'; break;
            case 'Disponible - Para recoger': estatusColorClass = 'bg-teal-500/20 text-teal-400 border border-teal-500/20'; break;
            case 'Disponible - Para enviar': estatusColorClass = 'bg-blue-500/20 text-blue-400 border border-blue-500/20'; break;
            case 'Entregada - Paqueteria':
            case 'Finalizada': estatusColorClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'; break;
            case 'Cancelada': estatusColorClass = 'bg-red-500/20 text-red-400 border border-red-500/20'; break;
        }
        
        const estatusOptionsHtml = (window.OrdenesEstatusList || ['Pendiente', 'Enviado', 'Entregado', 'Cancelada'])
            .map(e => `<option value="${e}">${e}</option>`)
            .join('');
            
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        const finalNombreCliente = orden.nombre_cliente || (clientObj ? clientObj.nombre_completo : null) || orden.id_cliente || 'Cliente Desconocido';
        
        const cardHtml = `
            <div class="bg-dark-100 border border-white/10 rounded-xl overflow-hidden shadow-sm hover:border-navy-500/50 transition-colors">
                <!-- Encabezado de Orden -->
                <div onclick="openOrderDetailsModal('${orden.id_orden}')" class="p-4 bg-dark-200/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-dark-200/70 transition-colors relative group">
                    <div class="flex-grow">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-mono text-sm font-bold text-white">${orden.id_orden}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${estatusColorClass}">${orden.estatus}</span>
                        </div>
                        <div class="text-xs text-gray-400">
                            <strong>${finalNombreCliente}</strong> <span class="mx-1">|</span> ${dateStr} <span class="mx-1">|</span> <span class="text-white font-semibold">${totalPiezas} piezas</span>
                        </div>
                    </div>
                        <div class="text-base text-emerald-400 font-black whitespace-nowrap">$${Number(orden.total_neto !== undefined ? orden.total_neto : (Number(orden.gran_total || 0) + (Number(orden.envio_costo) || 0))).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

window.openOrderDetailsModal = function(id_orden) {
    const orden = currentOrdenes.find(o => o.id_orden === id_orden);
    if (!orden) return;

    // Auto-cancelar si no tiene artículos en el detalle
    if ((!orden.articulos_carrito || orden.articulos_carrito.length === 0) && orden.estatus !== 'Cancelada') {
        Swal.fire({
            title: 'Pedido sin detalles',
            text: 'Este pedido no contiene artículos registrados. Se marcará automáticamente como Cancelada.',
            icon: 'info',
            background: '#151515',
            color: '#fff',
            confirmButtonColor: '#1d4ed8',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'update_order_status',
                id_orden: id_orden,
                nuevo_estatus: 'Cancelada',
                guia: ''
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success') {
                fetchOrdenes().then(() => {
                    openOrderDetailsModal(id_orden);
                });
            }
        }).catch(err => console.error('Error al auto-cancelar pedido sin detalles:', err));
    }
    
    let articulosHtml = '';
    if (orden.articulos_carrito && orden.articulos_carrito.length > 0) {
        articulosHtml = orden.articulos_carrito.map(art => {
            let prod = {};
            if (art.id_playera && typeof art.id_playera === 'object') {
                prod = art.id_playera;
            } else {
                const prodId = art.id_producto || art.id_playera;
                prod = (window.adminFilteredProducts && window.adminFilteredProducts.find(p => String(p.id) === String(prodId))) 
                    || (window.productsData && window.productsData.find(p => String(p.id) === String(prodId))) 
                    || {};
            }
            
            const imgUrl = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
            const nombre = prod.nombre || `Producto ${art.id_producto || (art.id_playera && art.id_playera.id) || 'Desconocido'}`;
            const genero = prod.genero || '-';
            const tipo = prod.tipo || '-';
            const version = prod.version || '-';
            const itemTotal = Number(art.subtotal_renglon);
            const unitPrice = Number(art.precio_unitario_final) || (itemTotal / Number(art.cantidad));
            
            let persName = art.texto_personalizado ? 'Sí' : '';
            if (art.id_personalizacion && typeof art.id_personalizacion === 'object') {
                if (art.id_personalizacion.id_personalizacion !== 'PERS-NONE' && art.id_personalizacion.concepto) {
                    persName = art.id_personalizacion.concepto;
                } else {
                    persName = '';
                }
            } else if (art.id_personalizacion && art.id_personalizacion !== 'PERS-NONE') {
                const pObj = (window.allPersonalizaciones && window.allPersonalizaciones.find(x => String(x.id) === String(art.id_personalizacion))) 
                    || (window.defaultPersonalizaciones && window.defaultPersonalizaciones.find(x => String(x.id) === String(art.id_personalizacion)));
                if (pObj) persName = pObj.nombre;
            }

            return `
    <div class="flex items-center gap-3 bg-dark-200/40 p-3 rounded-xl border border-white/10 mb-3 last:mb-0 relative group">
        <img src="${imgUrl}" alt="Foto" class="w-16 h-16 rounded-lg object-cover bg-dark flex-shrink-0">
        <div class="flex-grow min-w-0 pr-2">
            <h4 class="font-bold text-white text-sm truncate leading-tight">${nombre}</h4>
            <div class="text-[10px] text-gray-400 mt-1 font-medium uppercase tracking-wider">
                ${genero} | ${tipo} | ${version}
            </div>
            <div class="text-xs text-gray-400 mt-1">
                Talla: <span class="text-gray-200 font-semibold">${art.talla}</span> | 
                Cant: <span class="text-gray-200 font-semibold">${art.cantidad}</span>
            </div>
            ${persName ? `
            <div class="text-xs text-gray-400 mt-1">
                Pers: <span class="text-navy-400 font-semibold">${persName}</span>
            </div>
            ${art.texto_personalizado ? `
            <div class="text-xs text-gray-400 mt-0.5">
                Texto Estampado: <span class="text-emerald-400 font-mono font-bold uppercase">"${art.texto_personalizado}"</span>
            </div>` : ''}` : ''}
        </div>
        <div class="text-right flex-shrink-0 min-w-[70px] flex flex-col justify-between items-end self-stretch py-1">
            ${art.id_detalle ? `
            <button onclick="deleteOrderItem('${orden.id_orden}', '${art.id_detalle}')" class="text-gray-500 hover:text-red-500 transition-colors p-1" title="Eliminar artículo">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
            ` : '<div></div>'}
            <div>
                <div class="font-bold text-white text-sm">$${itemTotal.toFixed(2)}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">$${unitPrice.toFixed(2)} c/u</div>
            </div>
        </div>
    </div>`;
        }).join('');
    } else {
        articulosHtml = '<div class="text-sm text-gray-500 italic text-center py-4">Sin detalles de artículos</div>';
    }

    document.getElementById('admin-order-details-id').textContent = id_orden;
    document.getElementById('admin-order-details-container').innerHTML = articulosHtml;
    
    const phoneElement = document.getElementById('admin-order-details-phone');
    const phoneTextElement = document.getElementById('admin-order-details-phone-text');
    
    // El telefono viene directamente en la orden como telefono_cliente
    let rawPhone = orden.telefono_cliente;
    
    // Si no está en la orden por alguna razón, intentamos buscarlo en el catálogo de clientes
    if (!rawPhone) {
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        rawPhone = clientObj ? (clientObj.telefono_cliente || clientObj.telefono) : null;
    }
    
    let finalPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
    
    if (finalPhone) {
        phoneTextElement.textContent = finalPhone;
        if (phoneElement) {
            phoneElement.classList.remove('hidden');
            phoneElement.classList.remove('opacity-50');
        }
    } else {
        phoneTextElement.textContent = 'Sin teléfono registrado';
        if (phoneElement) {
            phoneElement.classList.remove('hidden');
            phoneElement.classList.add('opacity-50');
        }
    }
    
    // Set status options
    const statusSelect = document.getElementById('admin-order-details-status');
    if (statusSelect) {
        const estatusOptionsHtml = (window.OrdenesEstatusList || ['Pendiente', 'Enviado', 'Entregado', 'Cancelada'])
            .map(e => `<option value="${e}">${e}</option>`)
            .join('');
        statusSelect.innerHTML = `<option value="">Cambiar Estatus...</option>${estatusOptionsHtml}`;
        statusSelect.value = orden.estatus;
    }
    
    const modal = document.getElementById('admin-order-details-modal');
    modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    modal.querySelector('.transform').classList.add('scale-100');
    
    const closeBtn = document.getElementById('close-order-details-modal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.add('opacity-0');
            modal.querySelector('.transform').classList.remove('scale-100');
            modal.querySelector('.transform').classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        };
    }
}

window.deleteOrderItem = async function(id_orden, id_detalle) {
    const orden = currentOrdenes.find(o => o.id_orden === id_orden) || allFetchedOrdenes.find(o => o.id_orden === id_orden);
    const isLastItem = orden && orden.articulos_carrito && orden.articulos_carrito.length === 1;

    const result = await Swal.fire({
        title: isLastItem ? '¿Cancelar orden?' : '¿Eliminar artículo?',
        text: isLastItem 
            ? `Este es el último artículo del pedido. Al eliminarlo, el pedido se marcará como Cancelada pero se conservará en el historial. ¿Deseas continuar?` 
            : `¿Estás seguro de que deseas eliminar este artículo de la orden? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: isLastItem ? 'Sí, cancelar orden' : 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff'
    });
    
    if (!result.isConfirmed) return;
    
    const payload = {
        action: 'delete_order_item',
        id_detalle: id_detalle
    };
    
    try {
        Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, background: '#151515', color: '#fff', didOpen: () => { Swal.showLoading(); }});
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            Swal.fire({ icon: 'success', title: isLastItem ? '¡Orden Cancelada!' : '¡Eliminado!', text: data.message || (isLastItem ? 'La orden ha sido marcada como Cancelada.' : 'Artículo removido del pedido con éxito.'), background: '#151515', color: '#fff', timer: 2000, showConfirmButton: false });
            
            // Re-fetch orders to get the updated totals and items
            await fetchOrdenes();
            fetchInitialProducts(); // 🔄 Refrescar catálogo para liberar stock devuelto
            
            // Re-open modal to reflect changes
            const updatedOrden = allFetchedOrdenes.find(o => o.id_orden === id_orden);
            if (updatedOrden && updatedOrden.articulos_carrito && updatedOrden.articulos_carrito.length > 0) {
                openOrderDetailsModal(id_orden);
            } else {
                // All items were deleted (or soft-deleted), close modal
                document.getElementById('close-order-details-modal')?.click();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo eliminar el artículo.', background: '#151515', color: '#fff' });
        }
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#151515', color: '#fff' });
    }
};

async function updateOrderStatus(id_orden, nuevo_estatus) {
    if (!nuevo_estatus) return;
    
    const selects = document.querySelectorAll(`select[onchange="updateOrderStatus('${id_orden}', this.value)"]`);
    
    const result = await Swal.fire({
        title: '¿Cambiar estatus?',
        text: `¿Estás seguro que deseas marcar la orden ${id_orden} como ${nuevo_estatus}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1d4ed8',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff'
    });
    
    const id = String(id_orden).trim();
    const ordenOriginal = currentOrdenes.find(o => String(o.id_orden).trim() === id) 
        || allFetchedOrdenes.find(o => String(o.id_orden).trim() === id)
        || allUserOrdenesFetched.find(o => String(o.id_orden).trim() === id);

    if (!result.isConfirmed) {
        selects.forEach(sel => sel.value = ordenOriginal ? ordenOriginal.estatus : "");
        const modalSelect = document.getElementById('admin-order-details-status');
        if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
            modalSelect.value = ordenOriginal ? ordenOriginal.estatus : "";
        }
        return;
    }
    
    // Verificar si el pedido tiene envío de forma más tolerante
    const envioSolicitado = ordenOriginal && ordenOriginal.envio_solicitado 
        ? String(ordenOriginal.envio_solicitado).trim().toLowerCase() 
        : "";
        
    const tieneEnvio = ordenOriginal && (
        envioSolicitado.startsWith("s") || // Sí, si, S, Sí (con mala codificación)
        Number(ordenOriginal.envio_costo) > 0 ||
        Number(ordenOriginal.costo_envio) > 0
    );
    
    // Normalizar estatus para evitar problemas de acentos y mayúsculas
    const estatusNormalizado = String(nuevo_estatus).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let trackingGuide = "";
    if (estatusNormalizado === "entregada - paqueteria" && tieneEnvio) {
        const { value: trackingNum } = await Swal.fire({
            title: 'Número de Guía',
            text: 'Por favor, ingresa el número de guía de la paquetería:',
            input: 'text',
            inputPlaceholder: 'Ej. DHL123456789',
            showCancelButton: true,
            confirmButtonColor: '#1d4ed8',
            cancelButtonColor: '#3f3f46',
            confirmButtonText: 'Guardar y Continuar',
            cancelButtonText: 'Cancelar',
            background: '#151515', color: '#fff',
            inputValidator: (value) => {
                if (!value) {
                    return 'Debes ingresar un número de guía para continuar.';
                }
            }
        });
        
        if (!trackingNum) {
            // Cancelar el cambio de estatus y revertir selects
            selects.forEach(sel => sel.value = ordenOriginal ? ordenOriginal.estatus : "");
            const modalSelect = document.getElementById('admin-order-details-status');
            if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
                modalSelect.value = ordenOriginal ? ordenOriginal.estatus : "";
            }
            return;
        }
        trackingGuide = trackingNum;
    }
    
    const payload = {
        action: 'update_order_status',
        id_orden: id_orden,
        nuevo_estatus: nuevo_estatus,
        guia: trackingGuide
    };
    
    try {
        Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, background: '#151515', color: '#fff', didOpen: () => { Swal.showLoading(); }});
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            await Swal.fire({ icon: 'success', title: '¡Actualizado!', text: data.message, background: '#151515', color: '#fff', timer: 1500, showConfirmButton: false });
            
            const ordenOriginal = currentOrdenes.find(o => o.id_orden === id_orden) || allFetchedOrdenes.find(o => o.id_orden === id_orden);
            
            // El telefono viene directamente en la orden como telefono_cliente
            let rawPhone = ordenOriginal?.telefono_cliente;
            
            // Si no está, intentamos el catálogo
            if (!rawPhone) {
                const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(ordenOriginal?.id_cliente)) : null;
                rawPhone = clientObj ? (clientObj.telefono_cliente || clientObj.telefono) : null;
            }
            
            let finalPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
            
            if (finalPhone && finalPhone.length === 10) {
                finalPhone = '52' + finalPhone;
            }
            
            if (finalPhone) {
                let nombreCorto = 'Cliente';
                if (ordenOriginal?.nombre_cliente) {
                    nombreCorto = ordenOriginal.nombre_cliente.split(' ')[0];
                }
                
                const waText = encodeURIComponent(`*Actualización de Pedido* 📦\n\nHola ${nombreCorto},\nEl estatus de tu orden *${id_orden}* ha cambiado a: *${nuevo_estatus}*.\n\n¡Gracias por tu preferencia!`);
                const waUrl = `https://wa.me/${finalPhone}?text=${waText}`;
                
                // 🚀 Abrir WhatsApp automáticamente
                abrirWhatsAppAutomatico(waUrl);
            }
            
            const idx = currentOrdenes.findIndex(o => o.id_orden === id_orden);
            if (idx !== -1) {
                currentOrdenes[idx].estatus = nuevo_estatus;
                renderOrdenes();
            }
        } else {
            throw new Error(data.message || 'Error al actualizar.');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        const ordenOriginal = currentOrdenes.find(o => o.id_orden === id_orden) || allFetchedOrdenes.find(o => o.id_orden === id_orden);
        selects.forEach(sel => sel.value = ordenOriginal ? ordenOriginal.estatus : "");
        const modalSelect = document.getElementById('admin-order-details-status');
        if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
            modalSelect.value = ordenOriginal ? ordenOriginal.estatus : "";
        }
        Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#151515', color: '#fff' });
    }
}

// ============================================================================
// MODULO: MIS PEDIDOS (USUARIO)
// ============================================================================
let allUserOrdenesFetched = [];

setTimeout(() => {
    const btnMisPedidos = document.querySelectorAll('.action-nav-mis-pedidos-view');
    btnMisPedidos.forEach(btn => btn.addEventListener('click', () => {
        openUserOrdenesModal();
    }));

    document.getElementById('close-user-ordenes-modal')?.addEventListener('click', () => {
        document.getElementById('user-ordenes-modal').classList.add('hidden');
    });

    document.getElementById('close-user-order-details-modal')?.addEventListener('click', () => {
        document.getElementById('user-order-details-modal').classList.add('hidden');
    });
    
    // Si queremos cerrar con click fuera
    document.getElementById('user-ordenes-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'user-ordenes-modal') e.target.classList.add('hidden');
    });
    document.getElementById('user-order-details-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'user-order-details-modal') e.target.classList.add('hidden');
    });
    
    // Save changes button
    document.getElementById('btn-save-user-order-changes')?.addEventListener('click', async () => {
        await saveUserOrderChanges();
    });

    // --- VARIABLES DE ESTADO Y LOGICA DE MI PERFIL ---
    let tempPerfilFotoUrl = "";
    
    function openUserPerfilModal() {
        const loggedUserStr = localStorage.getItem('logged_user');
        if (!loggedUserStr) return;
        const user = JSON.parse(loggedUserStr);
        
        // Cargar campos
        DOM.perfil.inputs.nombre.value = user.nombre_completo || "";
        DOM.perfil.inputs.telefono.value = user.telefono || "";
        DOM.perfil.inputs.usuario.value = user.usuario || "";
        DOM.perfil.inputs.password.value = user.password || "";
        DOM.perfil.inputs.calle.value = user.calle || "";
        DOM.perfil.inputs.numero.value = user.numero || "";
        DOM.perfil.inputs.colonia.value = user.colonia || "";
        DOM.perfil.inputs.municipio.value = user.municipio || "";
        DOM.perfil.inputs.cp.value = user.cp || "";
        DOM.perfil.inputs.referencias.value = user.referencias || "";
        
        tempPerfilFotoUrl = user.foto || "";
        updatePerfilAvatarPreview(user.nombre_completo || user.usuario || "U", tempPerfilFotoUrl);
        
        // Mostrar modal con animaciones
        DOM.perfil.modal.classList.remove('hidden');
        setTimeout(() => {
            DOM.perfil.modal.classList.remove('opacity-0');
            DOM.perfil.modal.querySelector('.bg-dark-100').classList.remove('scale-95');
        }, 10);
    }
    
    function closeUserPerfilModal() {
        DOM.perfil.modal.classList.add('opacity-0');
        DOM.perfil.modal.querySelector('.bg-dark-100').classList.add('scale-95');
        setTimeout(() => {
            DOM.perfil.modal.classList.add('hidden');
        }, 300);
    }
    
    function updatePerfilAvatarPreview(name, imgUrl) {
        const preview = DOM.perfil.avatarPreview;
        if (!preview) return;
        
        const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
        const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
        const isSuper = isSuperMayoreoActivo && esPerfilSuperMayoreo(activeProfile);
        const bgClass = isSuper ? 'bg-amber-500' : 'bg-navy-500';

        if (imgUrl && imgUrl.trim().startsWith('http')) {
            preview.classList.remove('bg-navy-500', 'bg-amber-500');
            preview.innerHTML = `<img src="${imgUrl.trim()}" class="w-full h-full object-cover shadow-inner z-10" alt="Avatar">`;
        } else {
            preview.classList.remove('bg-navy-500', 'bg-amber-500');
            preview.classList.add(bgClass);
            const letter = name ? name.trim().charAt(0).toUpperCase() : 'U';
            preview.innerHTML = '';
            preview.textContent = letter;
        }
    }
    
    // Bind buttons
    if (DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.addEventListener('click', openUserPerfilModal);
    if (DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.addEventListener('click', () => {
        openUserPerfilModal();
        closemobileMenu();
    });
    if (DOM.perfil.closeBtn) DOM.perfil.closeBtn.addEventListener('click', closeUserPerfilModal);
    if (DOM.perfil.btnCancel) DOM.perfil.btnCancel.addEventListener('click', closeUserPerfilModal);
    DOM.perfil.modal?.addEventListener('click', (e) => {
        if (e.target.id === 'user-perfil-modal') closeUserPerfilModal();
    });
    
    // File upload change handler
    DOM.perfil.inputFile?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        Swal.fire({
            title: 'Subiendo imagen...',
            text: 'Por favor espera mientras subimos tu foto de perfil.',
            background: '#151515', color: '#fff',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        try {
            const base64Data = await readFileAsBase64(file);
            const fileName = `avatar_${Date.now()}_${file.name}`;
            const res = await uploadImageToDrive(base64Data, fileName);
            
            if (res.status === 'success' && res.url) {
                tempPerfilFotoUrl = res.url;
                const loggedUserStr = localStorage.getItem('logged_user');
                const name = loggedUserStr ? JSON.parse(loggedUserStr).nombre_completo : 'U';
                updatePerfilAvatarPreview(name, tempPerfilFotoUrl);
                
                Swal.fire({
                    icon: 'success',
                    title: '¡Imagen Cargada!',
                    text: 'La foto se subió exitosamente. Recuerda presionar "Guardar Cambios" para completar la actualización de tu perfil.',
                    background: '#151515', color: '#fff',
                    confirmButtonColor: '#1d4ed8'
                });
            } else {
                throw new Error(res.message || 'Error desconocido.');
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Error de carga',
                text: 'Hubo un problema al subir la imagen: ' + err.message,
                background: '#151515', color: '#fff'
            });
        }
    });
    
    // Submit form handler
    DOM.perfil.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const loggedUserStr = localStorage.getItem('logged_user');
        if (!loggedUserStr) return;
        const user = JSON.parse(loggedUserStr);
        
        const submitBtn = document.getElementById('btn-save-perfil');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1"></span> Guardando...';
        
        Swal.fire({
            title: 'Guardando perfil...',
            text: 'Por favor espera mientras actualizamos tus datos y foto de perfil.',
            background: '#151515', color: '#fff',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        const payload = {
            action: 'update_client',
            token: localStorage.getItem('session_token') || '',
            id_cliente: user.id_cliente,
            nombre_completo: DOM.perfil.inputs.nombre.value.trim(),
            telefono: DOM.perfil.inputs.telefono.value.trim(),
            usuario: user.usuario, // mantener el usuario original
            password: DOM.perfil.inputs.password.value.trim(),
            perfil: user.perfil || 'Mayoreo',
            calle: DOM.perfil.inputs.calle.value.trim(),
            numero: DOM.perfil.inputs.numero.value.trim(),
            colonia: DOM.perfil.inputs.colonia.value.trim(),
            municipio: DOM.perfil.inputs.municipio.value.trim(),
            cp: DOM.perfil.inputs.cp.value.trim(),
            referencias: DOM.perfil.inputs.referencias.value.trim(),
            activo: user.activo !== undefined ? user.activo : 1,
            foto: tempPerfilFotoUrl
        };
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // Actualizar localstorage
                user.nombre_completo = payload.nombre_completo;
                user.telefono = payload.telefono;
                user.password = payload.password;
                user.calle = payload.calle;
                user.numero = payload.numero;
                user.colonia = payload.colonia;
                user.municipio = payload.municipio;
                user.cp = payload.cp;
                user.referencias = payload.referencias;
                user.foto = tempPerfilFotoUrl;
                
                localStorage.setItem('logged_user', JSON.stringify(user));
                
                // Actualizar interfaz del header
                const userNameText = user.nombre_completo || user.usuario || 'Usuario';
                DOM.navUserName.textContent = userNameText;
                if (DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = userNameText;
                updateUserLogoInitial(userNameText, tempPerfilFotoUrl);
                
                closeUserPerfilModal();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Perfil Guardado',
                    text: 'Tus datos personales y foto de perfil han sido actualizados con éxito.',
                    background: '#151515', color: '#fff',
                    confirmButtonColor: '#1d4ed8'
                });
            } else {
                throw new Error(data.message || 'Error al actualizar.');
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Error al Guardar',
                text: 'Hubo un problema al guardar los cambios: ' + err.message,
                background: '#151515', color: '#fff'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
});

async function fetchUserOrdenes(force = false) {
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) return null;
    const loggedUser = JSON.parse(loggedUserStr);
    
    // Reuse admin fetch if it exists, otherwise do our own
    // Para simplificar, obtenemos todas las órdenes de este cliente.
    if (allFetchedOrdenes && allFetchedOrdenes.length > 0 && !force) {
        return allFetchedOrdenes.filter(o => String(o.id_cliente).trim() === String(loggedUser.id_cliente).trim());
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "search_orders", filtros: { id_cliente: loggedUser.id_cliente } })
        });
        const data = await response.json();
        if (data.status === "success") {
            allFetchedOrdenes = data.data || [];
            return allFetchedOrdenes.filter(o => String(o.id_cliente).trim() === String(loggedUser.id_cliente).trim());
        } else {
            console.error('Error fetching orders:', data.message);
            return [];
        }
    } catch (e) {
        console.error('Error in fetchUserOrdenes:', e);
        Swal.fire({ icon: 'error', title: 'Error de conexión', text: 'No se pudieron obtener tus pedidos. Por favor, inténtalo de nuevo.', background: '#151515', color: '#fff' });
        return [];
    }
}

async function openUserOrdenesModal() {
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) {
        Swal.fire({ icon: 'warning', title: 'No Autenticado', text: 'Inicia sesión para ver tus pedidos.', background: '#151515', color: '#fff' });
        return;
    }
    
    // Cerrar Menú móvil si está abierto
    if (typeof DOM !== 'undefined' && DOM.mobileMenu) {
        if(DOM.mobileMenu.drawer) DOM.mobileMenu.drawer.classList.add('translate-x-full'); if(DOM.mobileMenu.overlay) { DOM.mobileMenu.overlay.classList.add('opacity-0'); setTimeout(() => DOM.mobileMenu.overlay.classList.add('hidden'), 300); }
    }
    
    const modal = document.getElementById('user-ordenes-modal');
    const loading = document.getElementById('user-ordenes-loading');
    const empty = document.getElementById('user-ordenes-empty');
    const list = document.getElementById('user-ordenes-list');
    
    modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    // pecar opacity in setTimeout para la transición
    setTimeout(() => { modal.classList.remove('opacity-0'); }, 10);
    
    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    if (list) list.innerHTML = '';
    
    allUserOrdenesFetched = await fetchUserOrdenes(true);
    
    loading.classList.add('hidden');
    renderUserOrdenesList();
}

function renderUserOrdenesList() {
    const list = document.getElementById('user-ordenes-list');
    const empty = document.getElementById('user-ordenes-empty');
    
    if (list) list.innerHTML = '';
    
    if (!allUserOrdenesFetched) return;
    
    const filterId = document.getElementById('user-filter-id') ? document.getElementById('user-filter-id').value.trim().toLowerCase() : '';
    const filterStatus = document.getElementById('user-filter-status') ? document.getElementById('user-filter-status').value : '';
    
    let filteredOrders = allUserOrdenesFetched;
    
    if (filterId) {
        filteredOrders = filteredOrders.filter(o => o.id_orden.toLowerCase().includes(filterId));
    }
    
    if (filterStatus) {
        filteredOrders = filteredOrders.filter(o => o.estatus === filterStatus);
    }
    
    if (filteredOrders.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    
    // Sort orders by date desc
    const sortedOrders = [...filteredOrders].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    
    sortedOrders.forEach(orden => {
        const estatusInfo = getEstatusColor(orden.estatus);
        const numItems = orden.articulos_carrito ? orden.articulos_carrito.length : 0;
        
        const card = document.createElement('div');
        card.className = "bg-dark-200/50 border border-white/5 rounded-xl p-4 sm:p-5 hover:border-white/10 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center";
        
        const dateObj = new Date(orden.fecha);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha Inválida';
        
        card.innerHTML = `
            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-3">
                    <h4 class="text-white font-bold text-sm sm:text-base tracking-wide">${orden.id_orden}</h4>
                    <span class="${estatusInfo.bg} ${estatusInfo.text} ${estatusInfo.border} px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">${orden.estatus}</span>
                </div>
                <p class="text-xs text-gray-400 mt-1">${formattedDate}</p>
                <div class="flex items-center gap-3 mt-2 text-xs font-semibold text-gray-300">
                    <span class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>${numItems} artícul${numItems !== 1 ? 'os' : 'o'}</span>
                    <span class="text-gray-600">•</span>
                    <span class="text-emerald-400 font-bold">Total: $${Number(orden.total_neto !== undefined ? orden.total_neto : (Number(orden.gran_total || 0) + (Number(orden.envio_costo) || 0))).toFixed(2)}</span>
                </div>
            </div>
            <div class="w-full sm:w-auto mt-2 sm:mt-0 flex gap-2 justify-end">
                <button onclick="openUserOrderDetailsModal('${orden.id_orden}')" class="flex-grow sm:flex-grow-0 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-colors border border-white/10 flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    Ver Detalle
                </button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Variables temporales para edición
let currentUserOrderEditing = null;
let currentUserOrderEdits = [];

function openUserOrderDetailsModal(id_orden) {
    const orden = allUserOrdenesFetched.find(o => o.id_orden === id_orden);
    if (!orden) return;
    
    currentUserOrderEditing = JSON.parse(JSON.stringify(orden)); // Clon profundo
    currentUserOrderEdits = []; // Limpiar cambios sin guardar
    
    const isEditable = (orden.estatus === 'Pendiente');
    
    const modal = document.getElementById('user-order-details-modal');
    document.getElementById('user-order-details-id').textContent = orden.id_orden;
    
    const statusBadge = document.getElementById('user-order-details-status-badge');
    statusBadge.textContent = orden.estatus;
    const sColor = getEstatusColor(orden.estatus);
    statusBadge.className = `px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${sColor.bg} ${sColor.text} ${sColor.border}`;
    
    if (isEditable) {
        const editWarning = document.getElementById('user-order-edit-warning');
        if (editWarning) editWarning.classList.remove('hidden');
        if (document.getElementById('user-order-locked-warning')) document.getElementById('user-order-locked-warning').classList.add('hidden');
        document.getElementById('btn-save-user-order-changes').classList.remove('hidden');
    } else {
        const editWarning = document.getElementById('user-order-edit-warning');
        if (editWarning) editWarning.classList.add('hidden');
        if (document.getElementById('user-order-locked-warning')) document.getElementById('user-order-locked-warning').classList.remove('hidden');
        document.getElementById('btn-save-user-order-changes').classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
    if (document.getElementById('user-filter-id')) document.getElementById('user-filter-id').value = '';
    if (document.getElementById('user-filter-status')) document.getElementById('user-filter-status').value = '';
    setTimeout(() => { modal.classList.remove('opacity-0'); }, 10);
    
    renderUserOrderDetailsUI();
}

function renderUserOrderDetailsUI() {
    const container = document.getElementById('user-order-details-container');
    if (container) container.innerHTML = '';
    
    if (!currentUserOrderEditing.articulos_carrito || currentUserOrderEditing.articulos_carrito.length === 0) {
        if (container) container.innerHTML = '<p class="text-center text-gray-500 py-8">No hay artículos en esta orden.</p>';
        calculateUserOrderTotals();
        return;
    }
    
    const isEditable = (currentUserOrderEditing.estatus === 'Pendiente');
    
    // Normalizar id_personalizacion si viene como String desde la API
    const orderProfile = currentUserOrderEditing.tipo_precio_aplicado || 'Menudeo';
    const isMayoreo = esPerfilMayoreoOMas(orderProfile);
    currentUserOrderEditing.articulos_carrito.forEach(item => {
        if (item.id_personalizacion && typeof item.id_personalizacion !== 'object') {
            const pId = item.id_personalizacion;
            const pObj = allPersonalizaciones.find(x => String(x.id) === String(pId)) 
                       || defaultPersonalizaciones.find(x => String(x.id) === String(pId));
            if (pObj) {
                item.id_personalizacion = {
                    id_personalizacion: pObj.id,
                    concepto: pObj.nombre,
                    precio: isMayoreo ? parseFloat(pObj.precio_mayoreo || 0) : parseFloat(pObj.precio_Menudeo || 0)
                };
            } else {
                item.id_personalizacion = {
                    id_personalizacion: pId,
                    concepto: pId === 'PERS-001' ? 'Nombre y Número' : 'Personalizado',
                    precio: 0
                };
            }
        }
    });
    
    currentUserOrderEditing.articulos_carrito.forEach((item, index) => {
        const art = document.createElement('div');
        art.className = "bg-dark-100 border border-white/5 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center mb-3 relative overflow-hidden group";
        
        let persConcept = "";
        let persText = "";
        if (item.id_personalizacion && item.id_personalizacion.id_personalizacion && item.id_personalizacion.id_personalizacion !== "PERS-NONE") {
            persConcept = item.id_personalizacion.concepto;
            persText = item.texto_personalizado || "";
        }
        
        let isPersonalized = false;
        if (item.id_personalizacion) {
            let pId = (typeof item.id_personalizacion === 'object') ? item.id_personalizacion.id_personalizacion : item.id_personalizacion;
            if (pId && pId !== "PERS-NONE" && pId !== "Ninguna" && pId !== "") {
                isPersonalized = true;
            }
        }

        // Render view/edit modes
        let quantityHtml = `<span class="text-white font-bold">${item.cantidad}</span>`;
        let actionHtml = '';
        
        if (isEditable) {
            if (isPersonalized) {
                quantityHtml = `
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white">${item.cantidad}</span>
                        <span class="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 ml-2 text-center">(Personalizada)</span>
                    </div>
                `;
            }
            
            actionHtml = `
                <button onclick="removeUserOrderItem(${index})" class="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto sm:ml-auto w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors border border-red-500/20" title="Eliminar artículo">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;
        }
        
        art.innerHTML = `
            <div class="w-16 h-16 sm:w-20 sm:h-20 bg-dark-200 rounded-lg overflow-hidden flex-shrink-0 relative border border-white/5">
                <img src="${getFirstImage(item.id_playera.foto)}" class="w-full h-full object-cover" alt="Jersey">
            </div>
            <div class="flex-grow min-w-0 pr-6 sm:pr-0">
                <h4 class="text-white font-bold text-sm sm:text-base leading-tight truncate">${item.id_playera.nombre}</h4>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span class="text-[10px] text-gray-400 uppercase tracking-wider">${item.id_playera.genero} | ${item.id_playera.tipo} | ${item.id_playera.version}</span>
                </div>
                <div class="flex items-center gap-3 mt-2 text-xs">
                    <div class="flex items-center gap-1"><span class="text-gray-500">Talla:</span><span class="text-white font-bold bg-white/10 px-1.5 rounded">${item.talla}</span></div>
                    <div class="flex items-center gap-1"><span class="text-gray-500">Cant:</span>${quantityHtml}</div>
                </div>
                ${persConcept ? `<div class="mt-1.5 text-xs text-gray-500">Pers: <span class="text-blue-400 font-semibold">${persConcept}</span></div>` : ''}
                ${persConcept && persText ? `<div class="mt-1 text-xs text-gray-500">Texto Estampado: <span class="text-emerald-400 font-mono font-bold uppercase">"${persText}"</span></div>` : ''}
            </div>
            <div class="flex flex-col items-end gap-1 mt-2 sm:mt-0 ml-auto pl-2 border-l border-white/5 sm:border-none">
                <span class="text-white font-bold text-base sm:text-lg">$${item.subtotal_renglon.toFixed(2)}</span>
                <span class="text-gray-500 text-[10px]">C/U $${item.precio_unitario_final.toFixed(2)}</span>
            </div>
            ${actionHtml}
        `;
        container.appendChild(art);
    });
    
    calculateUserOrderTotals();
}

function changeUserOrderItemQty(index, delta) {
    const item = currentUserOrderEditing.articulos_carrito[index];
    const newQty = item.cantidad + delta;
    if (newQty < 1) return;
    
    item.cantidad = newQty;
    item.subtotal_renglon = item.precio_unitario_final * newQty;
    
    // Registrar cambio
    trackUserOrderEdit(item.id_detalle, 'update_qty', newQty);
    
    renderUserOrderDetailsUI();
}

function changeUserOrderItemPersText(index, text) {
    const item = currentUserOrderEditing.articulos_carrito[index];
    item.texto_personalizado = String(text).toUpperCase();
    
    trackUserOrderEdit(item.id_detalle, 'update_pers_text', item.texto_personalizado);
}

function removeUserOrderItem(index) {
    const item = currentUserOrderEditing.articulos_carrito[index];
    
    Swal.fire({
        title: '¿Eliminar artículo?',
        text: "Este artículo se quitará del pedido.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        confirmButtonText: 'S�, ¿¿¿Eliminar',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            trackUserOrderEdit(item.id_detalle, 'delete', null);
            currentUserOrderEditing.articulos_carrito.splice(index, 1);
            renderUserOrderDetailsUI();
        }
    });
}

function trackUserOrderEdit(id_detalle, actionType, value) {
    const existing = currentUserOrderEdits.find(e => e.id_detalle === id_detalle);
    if (existing) {
        if (actionType === 'delete') {
            existing.actionType = 'delete';
        } else if (actionType === 'update_qty') {
            if (existing.actionType !== 'delete') existing.cantidad = value;
        } else if (actionType === 'update_pers_text') {
            if (existing.actionType !== 'delete') existing.texto_personalizado = value;
        }
    } else {
        const edit = { id_detalle, actionType };
        if (actionType === 'update_qty') edit.cantidad = value;
        if (actionType === 'update_pers_text') edit.texto_personalizado = value;
        currentUserOrderEdits.push(edit);
    }
}

function calculateUserOrderTotals() {
    let subJers = 0;
    let totalPers = 0;
    
    if (currentUserOrderEditing.articulos_carrito) {
        currentUserOrderEditing.articulos_carrito.forEach(item => {
            subJers += item.subtotal_renglon;
            
            let itemPersPrice = 0;
            if (item.id_personalizacion) {
                let pId = (typeof item.id_personalizacion === 'object') ? item.id_personalizacion.id_personalizacion : item.id_personalizacion;
                if (pId && pId !== "PERS-NONE" && pId !== "Ninguna" && pId !== "") {
                    if (typeof item.id_personalizacion === 'object' && item.id_personalizacion.precio !== undefined) {
                        itemPersPrice = parseFloat(item.id_personalizacion.precio || 0);
                    } else {
                        const pObj = allPersonalizaciones.find(x => String(x.id) === String(pId)) 
                                   || defaultPersonalizaciones.find(x => String(x.id) === String(pId));
                        if (pObj) {
                            const orderProfile = currentUserOrderEditing.tipo_precio_aplicado || 'Menudeo';
                            const isMayoreo = esPerfilMayoreoOMas(orderProfile);
                            itemPersPrice = isMayoreo ? parseFloat(pObj.precio_mayoreo || 0) : parseFloat(pObj.precio_Menudeo || 0);
                        }
                    }
                }
            }
            totalPers += itemPersPrice * item.cantidad;
        });
    }
    
    const costoEnvio = Number(currentUserOrderEditing.envio_costo !== undefined ? currentUserOrderEditing.envio_costo : (currentUserOrderEditing.costo_envio || 0));
    
    // We update the local object total so it reflects correctly
    currentUserOrderEditing.gran_total = subJers + costoEnvio;
    
    // Excluir la personalización del subtotal de jerseys que se muestra
    const displaySubtotalJerseys = subJers - totalPers;
    
    document.getElementById('user-order-subtotal').textContent = '$' + displaySubtotalJerseys.toFixed(2);
    document.getElementById('user-order-pers-total').textContent = '$' + totalPers.toFixed(2);
    
    const envioRow = document.getElementById('user-order-envio-row');
    const envioVal = document.getElementById('user-order-envio-val');
    if (envioRow && envioVal) {
        if (costoEnvio > 0) {
            envioRow.classList.remove('hidden');
            envioVal.textContent = '$' + costoEnvio.toFixed(2);
        } else {
            envioRow.classList.add('hidden');
        }
    }
    
    document.getElementById('user-order-total').textContent = '$' + (subJers + costoEnvio).toFixed(2);
    
    // Mostrar u ocultar guía de rastreo
    const guiaContainer = document.getElementById('user-order-guia-container');
    const guiaVal = document.getElementById('user-order-guia-val');
    const guiaLink = document.getElementById('user-order-guia-link');
    const btnCopyGuia = document.getElementById('btn-copy-guia');
    
    if (guiaContainer && guiaVal) {
        const trackingNum = currentUserOrderEditing.guia ? String(currentUserOrderEditing.guia).trim() : "";
        if (trackingNum) {
            guiaContainer.classList.remove('hidden');
            guiaVal.textContent = trackingNum;
            
            if (guiaLink) {
                guiaLink.href = `https://hawkportal.lamensajeria.mx/rastreo/${trackingNum}`;
            }
            
            if (btnCopyGuia) {
                btnCopyGuia.onclick = () => {
                    const fullUrl = `https://hawkportal.lamensajeria.mx/rastreo/${trackingNum}`;
                    navigator.clipboard.writeText(fullUrl);
                    Swal.fire({
                        icon: 'success',
                        title: 'Enlace copiado',
                        text: 'Enlace de rastreo copiado al portapapeles',
                        background: '#151515', color: '#fff',
                        timer: 1000, showConfirmButton: false
                    });
                };
            }
        } else {
            guiaContainer.classList.add('hidden');
        }
    }
}

async function saveUserOrderChanges() {
    if (currentUserOrderEdits.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin cambios', text: 'No has realizado ninguna modificación.', background: '#151515', color: '#fff', timer: 1500, showConfirmButton: false });
        return;
    }
    
    Swal.fire({
        title: 'Guardando...',
        text: 'Por favor espera mientras actualizamos tu pedido.',
        background: '#151515', color: '#fff',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        const originalOrder = allUserOrdenesFetched.find(o => o.id_orden === currentUserOrderEditing.id_orden);
        let orderEmptied = false;
        
        for (const edit of currentUserOrderEdits) {
            const originalItem = originalOrder ? originalOrder.articulos_carrito.find(a => a.id_detalle === edit.id_detalle) : null;
            const currentItem = currentUserOrderEditing.articulos_carrito.find(a => a.id_detalle === edit.id_detalle);
            const targetItem = currentItem || originalItem;
            
            if (targetItem) {
                const nueva_cantidad = edit.actionType === 'delete' ? 0 : targetItem.cantidad;
                const categoria = targetItem.id_playera && targetItem.id_playera.genero ? targetItem.id_playera.genero : 'Adulto';
                let id_pers = 'PERS-NONE';
                if (targetItem.id_personalizacion) {
                    if (typeof targetItem.id_personalizacion === 'object' && targetItem.id_personalizacion.id_personalizacion) {
                        id_pers = targetItem.id_personalizacion.id_personalizacion;
                    } else if (typeof targetItem.id_personalizacion === 'string') {
                        id_pers = targetItem.id_personalizacion;
                    }
                }
                const texto_pers = targetItem.texto_personalizado || '';
                
                let action = 'update_order_item_quantity';
                if (edit.actionType === 'delete') {
                    action = 'delete_order_item';
                }
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ 
                        action: action, 
                        id_detalle: edit.id_detalle,
                        categoria: categoria,
                        nueva_cantidad: nueva_cantidad,
                        id_personalizacion: id_pers,
                        texto_personalizado: texto_pers
                    })
                });
                const resData = await response.json();
                if (resData.status === 'error') {
                    Swal.fire({ icon: 'error', title: 'Error', text: resData.message || 'Error al actualizar el artículo.', background: '#151515', color: '#fff' });
                    return;
                }
                if (resData.status !== 'success') {
                    console.error('Error updating order item:', resData);
                }
                if (resData.orden_vaciada) {
                    orderEmptied = true;
                }
            }
        }
        
        Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'Tus cambios se han guardado exitosamente.', background: '#151515', color: '#fff', timer: 2000, showConfirmButton: false });
        
        // Refresh data
        allUserOrdenesFetched = await fetchUserOrdenes(true);
        fetchInitialProducts(); // 🔄 Refrescar catálogo para actualizar stock en tiempo real
        // Refresh global orders if admin cache exists
        if (typeof fetchOrdenes !== 'undefined') {
            fetchOrdenes(); // Fire and forget update global cache
        }
        
        if (orderEmptied) {
            document.getElementById('user-order-details-modal').classList.add('hidden');
        } else {
            // Re-open detail with updated data
            openUserOrderDetailsModal(currentUserOrderEditing.id_orden);
        }
        // Refresh list
        renderUserOrdenesList();
        
    } catch (e) {
        console.error('Error saving order changes:', e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al guardar los cambios.', background: '#151515', color: '#fff' });
    }
}















function getEstatusColor(estatus) {
    switch (estatus) {
        case 'Pendiente': return { color: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/20' };
        case 'Revisando': return { color: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/20' };
        case 'Disponible - Para recoger': return { color: 'teal', bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/20' };
        case 'Disponible - Para enviar': return { color: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/20' };
        case 'Cancelada': return { color: 'red', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/20' };
        default: return { color: 'gray', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/20' };
    }
}

// =========================================================================
// MÓDULO: CREAR PEDIDO (EXPORTAR EXCEL DE PROVEEDOR) - MANUAL FORM
// =========================================================================

let itemsPedidoExcel = [];
let currentUploadedImageBase64 = null;
let currentUploadedImageWidth = 100;
let currentUploadedImageHeight = 100;
let currentUploadedPatchBase64 = null;
let currentUploadedPatchWidth = 100;
let currentUploadedPatchHeight = 100;

function ensureExcelDOM() {
    if (!DOM.excelOrders || !DOM.excelOrders.modal || !DOM.excelOrders.inputs || !DOM.excelOrders.inputs.foto) {
        DOM.excelOrders = {
            modal: document.getElementById('admin-excel-orders-modal'),
            closeBtn: document.getElementById('close-excel-orders-modal'),
            form: document.getElementById('form-excel-pedido-nuevo'),
            inputs: {
                code: document.getElementById('excel-pedido-code'),
                foto: document.getElementById('excel-pedido-foto'),
                fotoInfo: document.getElementById('excel-pedido-foto-info'),
                imgPreviewContainer: document.getElementById('excel-pedido-img-preview-container'),
                imgPreview: document.getElementById('excel-pedido-img-preview'),
                imgClear: document.getElementById('excel-pedido-img-clear'),
                version: document.getElementById('excel-pedido-version'),
                genero: document.getElementById('excel-pedido-genero'),
                size: document.getElementById('excel-pedido-size'),
                qty: document.getElementById('excel-pedido-qty'),
                name: document.getElementById('excel-pedido-name'),
                number: document.getElementById('excel-pedido-number'),
                patch: document.getElementById('excel-pedido-patch-foto'),
                price: document.getElementById('excel-pedido-price')
            },
            tableBody: document.getElementById('excel-pedido-table-body'),
            tableEmpty: document.getElementById('excel-pedido-table-empty'),
            countBadge: document.getElementById('excel-pedido-count-badge'),
            totalQty: document.getElementById('excel-pedido-total-qty'),
            btnDescargar: document.getElementById('btn-excel-pedido-descargar')
        };
    }
}

function openExcelOrdersModal() {
    ensureExcelDOM();

    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) return;
    const loggedUser = JSON.parse(loggedUserStr);
    if (loggedUser.perfil !== 'Administrador') return;

    if (DOM.excelOrders.modal) {
        DOM.excelOrders.modal.classList.remove('hidden');
        setTimeout(() => {
            DOM.excelOrders.modal.classList.remove('opacity-0');
            const modalContainer = DOM.excelOrders.modal.querySelector('.bg-dark-100');
            if (modalContainer) modalContainer.classList.remove('scale-95');
        }, 10);
    }
    
    // Limpiar formulario y temporales
    itemsPedidoExcel = [];
    if (DOM.excelOrders.form) DOM.excelOrders.form.reset();
    handleExcelPhotoClear();
    
    // Poblar selects del formulario desde el catálogo
    const selectVersion = DOM.excelOrders.inputs.version;
    const selectGenero = DOM.excelOrders.inputs.genero;
    
    if (selectVersion) {
        selectVersion.innerHTML = '<option value="" disabled selected>Selecciona versión</option>';
        const filterVersion = DOM.filters.version;
        if (filterVersion) {
            Array.from(filterVersion.options).forEach(opt => {
                if (opt.value !== "") {
                    const newOpt = document.createElement('option');
                    newOpt.value = opt.value;
                    newOpt.textContent = opt.textContent;
                    selectVersion.appendChild(newOpt);
                }
            });
        }
    }
    
    if (selectGenero) {
        selectGenero.innerHTML = '<option value="" disabled selected>Selecciona género</option>';
        const filterGenero = DOM.filters.genero;
        if (filterGenero) {
            Array.from(filterGenero.options).forEach(opt => {
                if (opt.value !== "") {
                    const newOpt = document.createElement('option');
                    newOpt.value = opt.value;
                    newOpt.textContent = opt.textContent;
                    selectGenero.appendChild(newOpt);
                }
            });
        }
    }
    
    // Forzar limpieza de tallas
    if (DOM.excelOrders.inputs.size) {
        DOM.excelOrders.inputs.size.innerHTML = '<option value="" disabled selected>Selecciona género primero</option>';
    }
    
    renderManualExcelItems();
}
window.openExcelOrdersModal = openExcelOrdersModal;

function closeExcelOrdersModal() {
    ensureExcelDOM();
    if (DOM.excelOrders.modal) {
        DOM.excelOrders.modal.classList.add('opacity-0');
        const modalContainer = DOM.excelOrders.modal.querySelector('.bg-dark-100');
        if (modalContainer) modalContainer.classList.add('scale-95');
        setTimeout(() => {
            DOM.excelOrders.modal.classList.add('hidden');
        }, 300);
    }
}
window.closeExcelOrdersModal = closeExcelOrdersModal;

function handleExcelGenderChange(e) {
    ensureExcelDOM();
    const genero = String(e.target.value || '').trim();
    const sizesGrid = document.getElementById('excel-pedido-sizes-grid');
    if (!sizesGrid) return;
    
    sizesGrid.innerHTML = '';
    sizesGrid.className = 'grid grid-cols-2 sm:grid-cols-3 gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5';
    
    let tallas = getTallasForGender(genero);
    
    // Fallback completo e inteligente si las listas del catálogo de tallas están vacías
    if (!tallas || tallas.length === 0) {
        const genLower = genero.toLowerCase();
        if (genLower.includes('hombre') || genLower.includes('caballero') || genLower.includes('mens') || genLower.includes('men') || genLower === 'h') {
            tallas = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        } else if (genLower.includes('dama') || genLower.includes('mujer') || genLower.includes('womens') || genLower.includes('women') || genLower === 'm' || genLower === 'd') {
            tallas = ['S', 'M', 'L', 'XL', '2XL'];
        } else if (genLower.includes('niño') || genLower.includes('nino') || genLower.includes('niña') || genLower.includes('nina') || genLower.includes('kids') || genLower.includes('kid')) {
            tallas = ['2', '4', '6', '8', '10', '12', '14', '16'];
        } else {
            tallas = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        }
    }
    
    tallas.forEach(talla => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between gap-1.5 bg-dark-100/50 px-2 py-1.5 rounded-lg border border-white/5';
        itemDiv.innerHTML = `
            <span class="text-[9px] font-bold text-gray-300 uppercase">${talla}</span>
            <input type="number" min="0" value="0" data-size="${talla}" class="w-12 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-center text-[10px] text-white focus:outline-none focus:border-navy-400 excel-qty-input transition-colors font-mono">
        `;
        sizesGrid.appendChild(itemDiv);
    });
}
window.handleExcelGenderChange = handleExcelGenderChange;

function handleExcelPhotoChange(e) {
    ensureExcelDOM();
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        Swal.fire({ icon: 'error', title: 'Archivo Inválido', text: 'Por favor selecciona un archivo de imagen.', background: '#151515', color: '#fff' });
        return;
    }
    
    if (DOM.excelOrders.inputs.fotoInfo) {
        DOM.excelOrders.inputs.fotoInfo.textContent = file.name;
    }
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        const rawBase64 = evt.target.result;
        
        // Cargar imagen de forma asíncrona para obtener sus dimensiones físicas originales
        const img = new Image();
        img.onload = function() {
            currentUploadedImageWidth = img.naturalWidth || 100;
            currentUploadedImageHeight = img.naturalHeight || 100;
            
            // Crear canvas para normalizar formato a JPEG y reducir tamaño para no inflar el Excel
            const canvas = document.createElement('canvas');
            const maxDim = 300; // tamaño máximo de la miniatura
            let w = currentUploadedImageWidth;
            let h = currentUploadedImageHeight;
            
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((maxDim / w) * h);
                    w = maxDim;
                } else {
                    w = Math.round((maxDim / h) * w);
                    h = maxDim;
                }
            }
            
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            // SIEMPRE convertir a JPEG compatible
            currentUploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.85);
            
            if (DOM.excelOrders.inputs.imgPreview) {
                DOM.excelOrders.inputs.imgPreview.src = currentUploadedImageBase64;
            }
            if (DOM.excelOrders.inputs.imgPreviewContainer) {
                DOM.excelOrders.inputs.imgPreviewContainer.classList.remove('hidden');
            }
        };
        img.src = rawBase64;
    };
    reader.readAsDataURL(file);
}
window.handleExcelPhotoChange = handleExcelPhotoChange;

function handleExcelPhotoClear() {
    ensureExcelDOM();
    currentUploadedImageBase64 = null;
    currentUploadedImageWidth = 100;
    currentUploadedImageHeight = 100;
    if (DOM.excelOrders && DOM.excelOrders.inputs) {
        if (DOM.excelOrders.inputs.foto) DOM.excelOrders.inputs.foto.value = '';
        if (DOM.excelOrders.inputs.fotoInfo) DOM.excelOrders.inputs.fotoInfo.textContent = 'Haz clic o arrastra un archivo aquí';
        if (DOM.excelOrders.inputs.imgPreviewContainer) DOM.excelOrders.inputs.imgPreviewContainer.classList.add('hidden');
        if (DOM.excelOrders.inputs.imgPreview) DOM.excelOrders.inputs.imgPreview.src = '';
    }
}
window.handleExcelPhotoClear = handleExcelPhotoClear;

function handleExcelPatchPhotoChange(e) {
    ensureExcelDOM();
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        Swal.fire({ icon: 'error', title: 'Archivo Inválido', text: 'Por favor selecciona un archivo de imagen para el parche.', background: '#151515', color: '#fff' });
        return;
    }
    
    const infoEl = document.getElementById('excel-pedido-patch-foto-info');
    if (infoEl) infoEl.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        const rawBase64 = evt.target.result;
        
        const img = new Image();
        img.onload = function() {
            currentUploadedPatchWidth = img.naturalWidth || 100;
            currentUploadedPatchHeight = img.naturalHeight || 100;
            
            // Crear canvas para normalizar formato a JPEG y optimizar tamaño del parche
            const canvas = document.createElement('canvas');
            const maxDim = 200; // parches son más chicos, 200px es perfecto
            let w = currentUploadedPatchWidth;
            let h = currentUploadedPatchHeight;
            
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((maxDim / w) * h);
                    w = maxDim;
                } else {
                    w = Math.round((maxDim / h) * w);
                    h = maxDim;
                }
            }
            
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            // Guardar como JPEG compatible
            currentUploadedPatchBase64 = canvas.toDataURL('image/jpeg', 0.85);
            
            const preview = document.getElementById('excel-pedido-patch-img-preview');
            const container = document.getElementById('excel-pedido-patch-img-preview-container');
            if (preview) preview.src = currentUploadedPatchBase64;
            if (container) container.classList.remove('hidden');
        };
        img.src = rawBase64;
    };
    reader.readAsDataURL(file);
}
window.handleExcelPatchPhotoChange = handleExcelPatchPhotoChange;

function handleExcelPatchPhotoClear() {
    ensureExcelDOM();
    currentUploadedPatchBase64 = null;
    currentUploadedPatchWidth = 100;
    currentUploadedPatchHeight = 100;
    
    const input = document.getElementById('excel-pedido-patch-foto');
    if (input) input.value = '';
    const infoEl = document.getElementById('excel-pedido-patch-foto-info');
    if (infoEl) infoEl.textContent = 'Haz clic o arrastra aquí';
    const container = document.getElementById('excel-pedido-patch-img-preview-container');
    if (container) container.classList.add('hidden');
    const preview = document.getElementById('excel-pedido-patch-img-preview');
    if (preview) preview.src = '';
}
window.handleExcelPatchPhotoClear = handleExcelPatchPhotoClear;

function handleAddManualItemExcel(e) {
    ensureExcelDOM();
    if (e) e.preventDefault();
    
    const code = '';
    const version = DOM.excelOrders.inputs.version.value;
    const genero = DOM.excelOrders.inputs.genero.value;
    const name = DOM.excelOrders.inputs.name.value.trim().toUpperCase();
    const number = DOM.excelOrders.inputs.number.value.trim().toUpperCase();
    const patch = currentUploadedPatchBase64 || '';
    const price = 0.00;
    
    // Imagen, versión y género son obligatorios
    if (!currentUploadedImageBase64) {
        Swal.fire({ icon: 'warning', title: 'Imagen requerida', text: 'Por favor selecciona la imagen de la playera que quieres.', background: '#151515', color: '#fff' });
        return;
    }
    if (!version || !genero) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Por favor selecciona la versión y el género.', background: '#151515', color: '#fff' });
        return;
    }
    
    // Obtener todas las tallas seleccionadas del grid con cantidad > 0
    const qtyInputs = document.querySelectorAll('.excel-qty-input');
    const itemsToAdd = [];
    
    qtyInputs.forEach(input => {
        const qtyVal = parseInt(input.value) || 0;
        const sizeVal = input.getAttribute('data-size');
        if (qtyVal > 0 && sizeVal) {
            itemsToAdd.push({
                size: sizeVal,
                qty: qtyVal
            });
        }
    });
    
    if (itemsToAdd.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Tallas requeridas', text: 'Por favor ingresa una cantidad (mayor a 0) en al menos una talla.', background: '#151515', color: '#fff' });
        return;
    }
    
    // Código es opcional (si no se indica, usar '-')
    const finalCode = code || '-';
    
    // Concatena Versión + Género para Remark
    const remark = `${version} ${genero}`;
    
    // Generar un groupKey único para este artículo / lote de tallas
    const groupKey = 'group_' + Date.now() + Math.random().toString(36).substr(2, 9);
    
    // Agregar un registro individual para cada talla ingresada en esta tanda
    itemsToAdd.forEach(sizeItem => {
        const newItem = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            groupKey: groupKey,
            code: finalCode,
            foto: currentUploadedImageBase64 || '',
            fotoWidth: currentUploadedImageWidth || 100,
            fotoHeight: currentUploadedImageHeight || 100,
            remark,
            size: sizeItem.size,
            qty: sizeItem.qty,
            name,
            number,
            patch,
            price
        };
        itemsPedidoExcel.push(newItem);
    });
    
    // Limpiar completamente el formulario tras agregar el artículo (ya que capturó todas sus tallas de una vez)
    resetExcelOrderForm();
    renderManualExcelItems();
}
window.handleAddManualItemExcel = handleAddManualItemExcel;

function toggleExcelOrderDetails(checkbox) {
    const panel = document.getElementById('excel-pedido-details-panel');
    if (panel) {
        if (checkbox.checked) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
}
window.toggleExcelOrderDetails = toggleExcelOrderDetails;

function resetExcelOrderForm() {
    ensureExcelDOM();
    if (DOM.excelOrders.form) DOM.excelOrders.form.reset();
    handleExcelPhotoClear();
    handleExcelPatchPhotoClear();
    
    // Ocultar el panel de personalización opcional y desmarcar el checkbox
    const showDetailsCheckbox = document.getElementById('excel-pedido-show-details');
    if (showDetailsCheckbox) showDetailsCheckbox.checked = false;
    const detailsPanel = document.getElementById('excel-pedido-details-panel');
    if (detailsPanel) detailsPanel.classList.add('hidden');
    
    // Resetear el grid de tallas a su estado inicial
    const sizesGrid = document.getElementById('excel-pedido-sizes-grid');
    if (sizesGrid) {
        sizesGrid.innerHTML = 'Selecciona un género primero para cargar las tallas';
        sizesGrid.className = 'grid grid-cols-1 bg-black/20 p-3 rounded-xl border border-white/5 min-h-[80px] items-center justify-center text-center text-xs text-gray-500';
    }
}
window.resetExcelOrderForm = resetExcelOrderForm;

function deleteManualExcelItem(itemId) {
    itemsPedidoExcel = itemsPedidoExcel.filter(item => item.id !== itemId);
    renderManualExcelItems();
}

function renderManualExcelItems() {
    const tbody = DOM.excelOrders.tableBody;
    const cardsContainer = document.getElementById('excel-pedido-cards-list');
    const emptyState = DOM.excelOrders.tableEmpty;
    const countBadge = DOM.excelOrders.countBadge;
    const totalQtyEl = DOM.excelOrders.totalQty;
    const btnDescargar = DOM.excelOrders.btnDescargar;
    
    if (tbody) tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    let totalQty = 0;
    
    if (itemsPedidoExcel.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (countBadge) countBadge.textContent = '0';
        if (totalQtyEl) totalQtyEl.textContent = '0';
        if (btnDescargar) btnDescargar.disabled = true;
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (countBadge) countBadge.textContent = itemsPedidoExcel.length;
    if (btnDescargar) btnDescargar.disabled = false;
    
    itemsPedidoExcel.forEach(item => {
        totalQty += item.qty;
        
        // 1. Renderizar fila de tabla para Desktop
        if (tbody) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-white/5 hover:bg-white/5 transition-colors';
            
            const tdFoto = document.createElement('td');
            tdFoto.className = 'p-3 align-middle';
            if (item.foto) {
                tdFoto.innerHTML = `<img src="${item.foto}" class="w-10 h-10 object-contain rounded bg-black/40 border border-white/10 p-0.5">`;
            } else {
                tdFoto.innerHTML = `<div class="w-10 h-10 bg-dark-200 border border-white/5 flex items-center justify-center text-[8px] text-gray-600 rounded">Sin foto</div>`;
            }
            
            const tdRemark = document.createElement('td');
            tdRemark.className = 'p-3 text-gray-300 align-middle';
            tdRemark.textContent = item.remark;
            
            const tdTallaQty = document.createElement('td');
            tdTallaQty.className = 'p-3 align-middle';
            tdTallaQty.innerHTML = `
                <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-bold text-[10px]">${item.size}</span>
                <span class="text-gray-500 mx-1">x</span>
                <span class="text-white font-bold">${item.qty}</span>
            `;
            
            const tdPers = document.createElement('td');
            tdPers.className = 'p-3 align-middle';
            let persHtml = '';
            if (item.name) persHtml += `<div class="text-emerald-400 font-mono font-bold text-[9px] uppercase">Name: ${item.name}</div>`;
            if (item.number) persHtml += `<div class="text-emerald-500 font-mono font-bold text-[9px] uppercase">Num: ${item.number}</div>`;
            if (item.patch) {
                persHtml += `
                    <div class="mt-1 flex items-center gap-1.5">
                        <span class="text-gray-400 text-[9px]">Patch:</span>
                        <img src="${item.patch}" class="w-6 h-6 object-contain rounded bg-black/40 border border-white/10 p-0.5">
                    </div>
                `;
            }
            if (!persHtml) persHtml = '<span class="text-gray-600">-</span>';
            tdPers.innerHTML = persHtml;
            
            const tdAccion = document.createElement('td');
            tdAccion.className = 'p-3 text-center align-middle';
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'text-red-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors';
            deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            deleteBtn.addEventListener('click', () => deleteManualExcelItem(item.id));
            tdAccion.appendChild(deleteBtn);
            
            tr.appendChild(tdFoto);
            tr.appendChild(tdRemark);
            tr.appendChild(tdTallaQty);
            tr.appendChild(tdPers);
            tr.appendChild(tdAccion);
            tbody.appendChild(tr);
        }
        
        // 2. Renderizar card para Mobile
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'bg-dark-100/60 border border-white/5 p-3 rounded-xl flex items-center gap-3 relative';
            card.innerHTML = `
                <div class="w-12 h-12 flex-shrink-0 bg-black/40 border border-white/10 rounded overflow-hidden flex items-center justify-center p-0.5">
                    ${item.foto ? `<img src="${item.foto}" class="w-full h-full object-contain">` : `<span class="text-[8px] text-gray-600">Sin foto</span>`}
                </div>
                <div class="flex-grow min-w-0 pr-6">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-bold text-white">${item.remark}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                        <span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-bold">Talla: ${item.size}</span>
                        <span class="text-gray-400">Cant: <strong class="text-white">${item.qty}</strong></span>
                    </div>
                    ${(item.name || item.number || item.patch) ? `
                    <div class="mt-1.5 pt-1.5 border-t border-white/5 text-[9px] space-y-0.5">
                        ${item.name ? `<div class="text-emerald-400 font-mono">NAME: ${item.name}</div>` : ''}
                        ${item.number ? `<div class="text-emerald-500 font-mono">NUM: ${item.number}</div>` : ''}
                        ${item.patch ? `
                        <div class="mt-1 flex items-center gap-1.5">
                            <span class="text-gray-400">PATCH:</span>
                            <img src="${item.patch}" class="w-6 h-6 object-contain rounded bg-black/40 border border-white/10 p-0.5">
                        </div>` : ''}
                    </div>` : ''}
                </div>
            `;
            const deleteBtnMobile = document.createElement('button');
            deleteBtnMobile.type = 'button';
            deleteBtnMobile.className = 'absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded-lg transition-colors';
            deleteBtnMobile.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            deleteBtnMobile.addEventListener('click', () => deleteManualExcelItem(item.id));
            card.appendChild(deleteBtnMobile);
            
            cardsContainer.appendChild(card);
        }
    });
    
    if (totalQtyEl) totalQtyEl.textContent = totalQty;
}

async function generateExcelFromManualItems() {
    ensureExcelDOM();
    if (typeof ExcelJS === 'undefined') {
        Swal.fire({ icon: 'error', title: 'Librería no cargada', text: 'La librería ExcelJS no se encuentra disponible. Por favor recarga la página.', background: '#151515', color: '#fff' });
        return;
    }
    
    if (itemsPedidoExcel.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Pedido vacío', text: 'No hay artículos en el pedido para exportar.', background: '#151515', color: '#fff' });
        return;
    }
    
    const btn = DOM.excelOrders.btnDescargar;
    if (!btn) {
        console.error("Download button not found in DOM");
        return;
    }
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Descargando Excel...`;
    
    try {
        let calculatedTotalQty = 0;
        let calculatedTotalAmount = 0;
        itemsPedidoExcel.forEach(item => {
            calculatedTotalQty += Number(item.qty) || 0;
            calculatedTotalAmount += (Number(item.qty) || 0) * (Number(item.price) || 0);
        });

        const grouped = {};
        itemsPedidoExcel.forEach(item => {
            const key = item.groupKey;
            if (!grouped[key]) {
                grouped[key] = {
                    code: item.code,
                    foto: item.foto || '',
                    fotoWidth: item.fotoWidth || 100,
                    fotoHeight: item.fotoHeight || 100,
                    patch: item.patch || '',
                    remark: item.remark || '-',
                    items: []
                };
            }
            grouped[key].items.push(item);
        });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pedido');
        
        worksheet.columns = [
            { header: 'Code', key: 'code', width: 18 },
            { header: 'Image', key: 'image', width: 22 },
            { header: 'Remark', key: 'remark', width: 22 },
            { header: 'size', key: 'size', width: 10 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Name', key: 'name', width: 18 },
            { header: 'Number', key: 'number', width: 12 },
            { header: 'patch', key: 'patch', width: 14 },
            { header: 'Unit Price ($)', key: 'unit_price_aux', width: 16 },
            { header: 'Unit Price ($)', key: 'unit_price_usd', width: 16 },
            { header: 'Total($)', key: 'total', width: 16 }
        ];
        
        // Estilo de cabeceras (¡COLOR AMARILLO #FFFF00!)
        const headerRow = worksheet.getRow(1);
        headerRow.height = 32;
        headerRow.eachCell((cell) => {
            cell.font = { name: '宋体', bold: true, color: { argb: 'FF000000' }, size: 11 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' } // Amarillo Puro (#FFFF00)
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        
        let currentRow = 2;
        
        for (const code of Object.keys(grouped)) {
            const prod = grouped[code];
            const numRows = prod.items.length;
            const rowStart = currentRow;
            const rowEnd = currentRow + numRows - 1;
            
            const targetBlockHeight = 85;
            const singleRowHeight = Math.max(30, targetBlockHeight / numRows);
            
            for (let idx = 0; idx < numRows; idx++) {
                const item = prod.items[idx];
                const price = Number(item.price) || 0;
                
                const row = worksheet.getRow(currentRow);
                row.height = singleRowHeight;
                row.values = [
                    prod.code,
                    "",
                    prod.remark,
                    item.size,
                    Number(item.qty) || 0,
                    item.name,
                    item.number,
                    "", // Parche (Imagen en columna H)
                    price,
                    price,
                    { formula: `J${currentRow}*E${currentRow}` }
                ];
                
                row.eachCell((cell, colNum) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.font = { name: '宋体', size: 10 };
                    
                    if (colNum === 9 || colNum === 10 || colNum === 11) {
                        cell.numFmt = '$#,##0.00';
                    }
                });
                
                currentRow++;
            }
            
            worksheet.mergeCells(`A${rowStart}:A${rowEnd}`);
            worksheet.mergeCells(`B${rowStart}:B${rowEnd}`);
            worksheet.mergeCells(`C${rowStart}:C${rowEnd}`);
            worksheet.mergeCells(`H${rowStart}:H${rowEnd}`);
            
            const cellA = worksheet.getCell(`A${rowStart}`);
            cellA.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cellA.font = { name: '宋体', bold: true, size: 10 };
            
            const cellC = worksheet.getCell(`C${rowStart}`);
            cellC.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cellC.font = { name: '宋体', size: 10 };
            
            const cellH = worksheet.getCell(`H${rowStart}`);
            cellH.alignment = { vertical: 'middle', horizontal: 'center' };
            
            if (prod.foto) {
                try {
                    const cleanBase64 = prod.foto.replace(/^data:image\/\w+;base64,/, "");
                    let ext = 'png';
                    if (prod.foto.includes('image/jpeg') || prod.foto.includes('image/jpg')) ext = 'jpeg';
                    
                    const imageId = workbook.addImage({
                        base64: cleanBase64,
                        extension: ext
                    });
                    
                    worksheet.addImage(imageId, `B${rowStart}:B${rowEnd}`);
                } catch (imgError) {
                    console.error("Error al procesar imagen local para Excel:", imgError);
                }
            }
            
            if (prod.patch) {
                try {
                    const cleanPatchBase64 = prod.patch.replace(/^data:image\/\w+;base64,/, "");
                    let patchExt = 'png';
                    if (prod.patch.includes('image/jpeg') || prod.patch.includes('image/jpg')) patchExt = 'jpeg';
                    
                    const patchImageId = workbook.addImage({
                        base64: cleanPatchBase64,
                        extension: patchExt
                    });
                    
                    worksheet.addImage(patchImageId, `H${rowStart}:H${rowEnd}`);
                } catch (patchImgError) {
                    console.error("Error al procesar imagen de parche para Excel:", patchImgError);
                }
            }
        }
        
        const totalRow = worksheet.getRow(currentRow);
        totalRow.height = 35;
        
        // Escribir valores directamente en las celdas y asociar el resultado pre-calculado en JS para validar
        totalRow.getCell('B').value = 'total';
        totalRow.getCell('E').value = { formula: `SUM(E2:E${currentRow - 1})`, result: calculatedTotalQty };
        totalRow.getCell('K').value = { formula: `SUM(K2:K${currentRow - 1})`, result: calculatedTotalAmount };
        
        totalRow.eachCell((cell, colNum) => {
            cell.font = { name: '宋体', bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'double', color: { argb: 'FF000000' } }
            };
            
            if (colNum === 11) {
                cell.numFmt = '$#,##0.00';
            }
        });
        
        const cellTotalText = totalRow.getCell(2);
        cellTotalText.alignment = { vertical: 'middle', horizontal: 'center' };
        cellTotalText.font = { name: '宋体', bold: true, size: 11, italic: true };
        
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                if (rowNumber < currentRow) {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                }
            });
        });
        
        const dateObj = new Date();
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const fileName = `${month}-${day} Marco.xlsx`;
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        
        // Mostrar alerta de descarga exitosa informando la sumatoria validada de piezas
        Swal.fire({
            icon: 'success',
            title: '¡Excel de Pedido Descargado!',
            text: `El archivo "${fileName}" se descargó exitosamente con un total de ${calculatedTotalQty} piezas.`,
            background: '#151515', color: '#fff',
            confirmButtonColor: '#1d4ed8'
        });
        
        // Limpiar completamente el formulario y el listado de partidas temporales
        itemsPedidoExcel = [];
        if (DOM.excelOrders.form) DOM.excelOrders.form.reset();
        handleExcelPhotoClear();
        renderManualExcelItems();
        
    } catch (e) {
        console.error("Error al generar Excel:", e);
        Swal.fire({
            icon: 'error',
            title: 'Error de Generación',
            text: e.message || 'No se pudo crear el archivo Excel.',
            background: '#151515', color: '#fff',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
window.generateExcelFromManualItems = generateExcelFromManualItems;






