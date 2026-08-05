const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbw97tnD6AOYXNkttgCnQRtg2WpikVw_cXdIYnKdc3lFIdeQ8PrbL1RRGdqMM7KD82ucQg/exec";

// --- MONKEY PATCH FETCH PARA INYECCIÓN Y VALIDACIÓN DE TOKENS ---
let isSessionExpiring = false;

(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        const isGoogleScript = typeof url === 'string' && url.includes('script.google.com');
        
        if (isGoogleScript && options && options.body && typeof options.body === 'string') {
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
        
        try {
            const response = await originalFetch(url, options);
            
            if (isGoogleScript && response.ok) {
                try {
                    const clone = response.clone();
                    const json = await clone.json();
                    if (json && json.session_invalid) {
                        if (!isSessionExpiring) {
                            isSessionExpiring = true;
                            localStorage.removeItem('logged_user');
                            localStorage.removeItem('current_perfil');
                            localStorage.removeItem('current_subperfil');
                            localStorage.removeItem('session_token');
                            
                            Swal.fire({
                                icon: 'warning',
                                title: 'Sesión Expirada',
                                text: json.message || 'Tu sesión ha expirado o no es válida. Por favor, inicia sesión de nuevo.',
                                background: '#151515', color: '#fff',
                                confirmButtonColor: '#1d4ed8',
                                allowOutsideClick: false,
                                allowEscapeKey: false
                            }).then(() => {
                                isSessionExpiring = false;
                                window.location.reload();
                            });
                        }
                        
                        return new Response(JSON.stringify({ status: "error", message: "Sesión inválida" }), {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                } catch (e) {
                    // Ignorar si no es JSON válido
                }
            }
            
            return response;
        } catch (err) {
            if (isGoogleScript) {
                console.warn("Reintentando petición a Google Script tras error de conexión/redirección...", err);
                await new Promise(r => setTimeout(r, 600));
                try {
                    const retryOptions = { ...options };
                    delete retryOptions.signal;
                    return await originalFetch(url, retryOptions);
                } catch (retryErr) {
                    throw retryErr;
                }
            }
            throw err;
        }
    };
})();

function getFirstImage(fotoField) {
    if (!fotoField) return '';
    const parts = String(fotoField).split(',');
    return parts[0].trim();
}

function getOptimizedImageUrl(rawUrl, width = 500) {
    if (!rawUrl || typeof rawUrl !== 'string') return 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    
    let url = rawUrl.trim();
    if (!url) return 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    
    // Si la URL contiene comas, tomar solo la primera imagen
    if (url.includes(',')) {
        url = url.split(',')[0].trim();
    }

    // Transformación para Google Drive Thumbnail API (WebP / JPEG comprimido por CDN de Google)
    let driveId = '';
    const matchId = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
        driveId = matchId[1];
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`;
    }

    // Transformación para Google UserContent (lh3.googleusercontent.com)
    if (url.includes('googleusercontent.com')) {
        const clean = url.split('=')[0];
        return `${clean}=w${width}-rw`;
    }

    // Transformación para Unsplash
    if (url.includes('images.unsplash.com')) {
        if (url.includes('w=')) {
            return url.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, 'q=75');
        }
        return `${url}&w=${width}&q=75&auto=format`;
    }

    return url;
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
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        attempts++;
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "login_client", usuario, password })
            });
            
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`Intento de login ${attempts}/${maxAttempts} falló:`, error);
            if (attempts >= maxAttempts) {
                return { status: "error", message: "No se pudo establecer conexión con la API (" + (error.message || "Failed to fetch") + "). Por favor, reintenta en un momento." };
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
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
    btnAdminOrdersNav: document.getElementById('btn-admin-orders-nav'),
    cartCount: document.getElementById('cart-count'),
    actions: {
        logout: document.querySelectorAll('.action-logout'),
        navCatalogo: document.querySelectorAll('.action-nav-catalogo'),
        navJerseysView: document.querySelectorAll('.action-nav-jerseys-view'),
        navMisPedidosView: document.querySelectorAll('.action-nav-mis-pedidos-view'),
        openCreate: document.querySelectorAll('.action-open-create'),
        openList: document.querySelectorAll('.action-open-list'),
        openClients: document.querySelectorAll('.action-open-clients'),
        openOrders: document.querySelectorAll('.action-open-orders'),
        openExcelOrders: document.querySelectorAll('.action-open-excel-orders')
    },
    local419: {
        wrapper: document.getElementById('local419-menu-wrapper'),
        mobileSection: document.getElementById('mobile-local419-section'),
        actionsPos: document.querySelectorAll('.action-local419-pos'),
        actionsOrdenar: document.querySelectorAll('.action-local419-ordenar'),
        actionsMisPedidos: document.querySelectorAll('.action-local419-mis-pedidos'),
        actionsInventario: document.querySelectorAll('.action-local419-inventario')
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
        filterActivo: document.getElementById('admin-filter-activo'),
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

// --- Control de Sesión por Inactividad (Basado en Date.now() y visibilitychange) ---
let lastActivityTime = Date.now();
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos

function updateLastActivity() {
    lastActivityTime = Date.now();
}

function checkInactivityExpiration() {
    if (!localStorage.getItem('logged_user') || isSessionExpiring) return false;
    
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed >= INACTIVITY_LIMIT_MS) {
        isSessionExpiring = true;
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
            isSessionExpiring = false;
            window.location.reload();
        });
        return true;
    }
    return false;
}

function startInactivityMonitor() {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, updateLastActivity, { passive: true });
    });
    
    // Verificar periódicamente cada 30 segundos si la app está en primer plano
    setInterval(() => {
        checkInactivityExpiration();
    }, 30000);
    
    // Verificar INMEDIATAMENTE cuando el usuario regresa a la pestaña/app en celular
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkInactivityExpiration();
        }
    });
    
    updateLastActivity();
}

function updateUserLoginUI(loggedUser) {
    if (!loggedUser) return;
    
    if (DOM.login && DOM.login.overlay) DOM.login.overlay.classList.add('hidden');
    const userNameText = loggedUser.nombre_completo || loggedUser.usuario || 'Usuario';
    if (DOM.navUserName) DOM.navUserName.textContent = userNameText;
    if (DOM.mobileMenu && DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = userNameText;
    updateUserLogoInitial(userNameText, loggedUser.foto);
    if (DOM.navUserBadge) DOM.navUserBadge.classList.remove('hidden');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    if (navLogoutBtn) {
        navLogoutBtn.classList.remove('hidden');
        navLogoutBtn.classList.add('sm:flex');
    }
    
    if (loggedUser.perfil === "Administrador") {
        if (DOM.perfil && DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.add('hidden');
        if (DOM.perfil && DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.add('hidden');
        if (DOM.admin && DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.remove('hidden');
        if (DOM.mobileMenu && DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.remove('hidden');
        if (DOM.local419 && DOM.local419.wrapper) DOM.local419.wrapper.classList.remove('hidden');
        if (DOM.local419 && DOM.local419.mobileSection) DOM.local419.mobileSection.classList.remove('hidden');
        if (DOM.btnAdminOrdersNav) DOM.btnAdminOrdersNav.classList.remove('hidden');
        
        // Para Administrador: Ocultar los botones sueltos "Ordenar" y "Mis Pedidos" (movidos a Local 419)
        if (DOM.actions && DOM.actions.navJerseysView) DOM.actions.navJerseysView.forEach(btn => btn.classList.add('hidden'));
        if (DOM.actions && DOM.actions.navMisPedidosView) DOM.actions.navMisPedidosView.forEach(btn => btn.classList.add('hidden'));

        const savedSub = localStorage.getItem('current_subperfil') || 'Mayoreo';
        if (DOM.adminSubperfilSelect) {
            DOM.adminSubperfilSelect.classList.remove('hidden');
            DOM.adminSubperfilSelect.value = savedSub;
        }
        if (DOM.mobileMenu && DOM.mobileMenu.adminSubperfilSelect) {
            DOM.mobileMenu.adminSubperfilSelect.value = savedSub;
        }
    } else {
        if (DOM.perfil && DOM.perfil.btnMiPerfilDesktop) DOM.perfil.btnMiPerfilDesktop.classList.remove('hidden');
        if (DOM.perfil && DOM.perfil.btnMiPerfilMobile) DOM.perfil.btnMiPerfilMobile.classList.remove('hidden');
        if (DOM.admin && DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.add('hidden');
        if (DOM.mobileMenu && DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.add('hidden');
        if (DOM.local419 && DOM.local419.wrapper) DOM.local419.wrapper.classList.add('hidden');
        if (DOM.local419 && DOM.local419.mobileSection) DOM.local419.mobileSection.classList.add('hidden');
        if (DOM.btnAdminOrdersNav) DOM.btnAdminOrdersNav.classList.add('hidden');
        if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.classList.add('hidden');
        
        // Para Clientes normales: Mostrar los botones sueltos "Ordenar" y "Mis Pedidos"
        if (DOM.actions && DOM.actions.navJerseysView) DOM.actions.navJerseysView.forEach(btn => btn.classList.remove('hidden'));
        if (DOM.actions && DOM.actions.navMisPedidosView) DOM.actions.navMisPedidosView.forEach(btn => btn.classList.remove('hidden'));
    }
}
window.updateUserLoginUI = updateUserLoginUI;

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
        updateUserLoginUI(loggedUser);
        
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
                
                updateUserLoginUI(user);
                updateBrandTextColor();
                applyProfileView();
            }
        }).catch(err => console.warn("Error al refrescar perfil en segundo plano:", err));
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
    
    // Listeners para Menú Local 419
    if (DOM.local419 && DOM.local419.actionsPos) {
        DOM.local419.actionsPos.forEach(btn => btn.addEventListener('click', () => {
            switchView('jerseys-pedido');
            closemobileMenu();
        }));
    }
    if (DOM.local419 && DOM.local419.actionsOrdenar) {
        DOM.local419.actionsOrdenar.forEach(btn => btn.addEventListener('click', () => {
            switchView('jerseys-pedido');
            closemobileMenu();
        }));
    }
    if (DOM.local419 && DOM.local419.actionsMisPedidos) {
        DOM.local419.actionsMisPedidos.forEach(btn => btn.addEventListener('click', () => {
            if (typeof openUserOrdenesModal === 'function') {
                openUserOrdenesModal();
            } else if (typeof openOrdenesModal === 'function') {
                openOrdenesModal();
            }
            closemobileMenu();
        }));
    }
    if (DOM.local419 && DOM.local419.actionsInventario) {
        DOM.local419.actionsInventario.forEach(btn => btn.addEventListener('click', () => {
            if (typeof openInventario419View === 'function') {
                openInventario419View();
            }
            closemobileMenu();
        }));
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
    
    const btnSaveTallas = document.getElementById('btn-submit-save-tallas');
    if (btnSaveTallas) btnSaveTallas.addEventListener('click', handleSaveBatchTallas);
    
    // Inicializar listeners de Personalizaciones Oficiales
    initOficialPersonalizacionEvents();
    
    // Filtros y paginación
    ['filterSearch', 'filterTipo', 'filterVersion', 'filterGenero', 'filterActivo'].forEach(id => {
        if(DOM.admin[id]) {
            DOM.admin[id].addEventListener('input', () => applyAdminFilters());
            DOM.admin[id].addEventListener('change', () => applyAdminFilters());
        }
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
            
            // Al hacer login exitoso, reiniciamos la marca de tiempo de inactividad
            updateLastActivity();
            
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
            
            updateUserLoginUI(res.data);
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
    // Si allProducts está vacío pero hay productos en la caché local, cargarlos de inmediato
    if (!allProducts || allProducts.length === 0) {
        try {
            const cachedStr = localStorage.getItem('jerseys_products_cache_v5');
            if (cachedStr) {
                const cachedObj = JSON.parse(cachedStr);
                if (cachedObj && Array.isArray(cachedObj.data) && cachedObj.data.length > 0) {
                    allProducts = cachedObj.data;
                }
            }
        } catch(e) {}
    }

    // Volver a renderizar catálogo de productos según el nuevo perfil
    if (allProducts && allProducts.length > 0) {
        renderProductsWithFilters();
    } else {
        renderSkeletons(6);
        if (typeof fetchInitialProducts === 'function') fetchInitialProducts();
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
    const activoSel = DOM.admin.filterActivo ? DOM.admin.filterActivo.value : "all";
    
    adminFilteredProducts = allProducts.filter(p => {
        const isActivoVal = (p.activo === undefined || p.activo === null || p.activo === "" || Number(p.activo) === 1) ? 1 : 0;
        const matchActivo = (activoSel === "all") || (isActivoVal === Number(activoSel));
        const matchName = !term || (p.nombre && p.nombre.toLowerCase().includes(term));
        const matchTipo = !tipo || p.tipo === tipo;
        const matchVersion = !version || p.version === version;
        const matchGenero = !genero || p.genero === genero;
        return matchActivo && matchName && matchTipo && matchVersion && matchGenero;
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
    if(DOM.admin.filterSearch) DOM.admin.filterSearch.value = '';
    if(DOM.admin.filterTipo) DOM.admin.filterTipo.value = '';
    if(DOM.admin.filterVersion) DOM.admin.filterVersion.value = '';
    if(DOM.admin.filterGenero) DOM.admin.filterGenero.value = '';
    if(DOM.admin.filterActivo) DOM.admin.filterActivo.value = 'all';
    
    applyAdminFilters();
    
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
        const isActivo = (producto.activo === undefined || producto.activo === null || producto.activo === "" || Number(producto.activo) === 1);
        
        const statusBadgeHtml = isActivo
            ? `<span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded leading-none">Activo</span>`
            : `<span class="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded leading-none">Inactivo</span>`;

        const tr = document.createElement('tr');
        tr.className = `hover:bg-white/5 transition-colors group ${!isActivo ? 'opacity-65 bg-red-950/10' : ''}`;
        tr.innerHTML = `
            <td class="px-3 py-2">
                <div class="flex items-center gap-3">
                    <img src="${imgUrl}" alt="Foto" class="w-10 h-10 rounded-lg object-cover bg-dark">
                    <div>
                        <div class="font-bold text-white text-xs group-hover:text-navy-400 transition-colors cursor-default leading-tight flex items-center gap-2">
                            ${producto.nombre || 'Sin nombre'}
                            ${statusBadgeHtml}
                        </div>
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
                    ${isActivo 
                        ? `<button class="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 shadow hover:shadow-red-500/30" title="Desactivar / Borrar Lógicamente" onclick="window.handleToggleProductActive('${producto.id}', 0)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                           </button>`
                        : `<button class="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all duration-300 shadow hover:shadow-emerald-500/30" title="Reactivar Jersey" onclick="window.handleToggleProductActive('${producto.id}', 1)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                           </button>`
                    }
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

async function handleToggleProductActive(id, newStatus) {
    const prod = allProducts.find(p => p.id === id);
    const name = prod ? (prod.nombre || id) : id;
    const isDeactivating = (newStatus === 0);

    const confirm = await Swal.fire({
        title: isDeactivating ? '¿Desactivar Jersey?' : '¿Reactivar Jersey?',
        html: isDeactivating
            ? `El jersey <strong class="text-white">${name}</strong> se marcará como <strong class="text-red-400">Inactivo (Activo = 0)</strong> y ya no se mostrará en los catálogos de venta.`
            : `El jersey <strong class="text-white">${name}</strong> se marcará como <strong class="text-emerald-400">Activo (Activo = 1)</strong> y volverá a ser visible en los catálogos de venta.`,
        icon: isDeactivating ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: isDeactivating ? '#ef4444' : '#10b981',
        cancelButtonColor: '#374151',
        confirmButtonText: isDeactivating ? 'Sí, Desactivar' : 'Sí, Reactivar',
        cancelButtonText: 'Cancelar',
        background: '#151515',
        color: '#fff',
        customClass: { popup: 'border border-white/10 rounded-2xl' }
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: isDeactivating ? 'Desactivando...' : 'Reactivando...',
        text: 'Actualizando registro en Google Sheets...',
        allowOutsideClick: false,
        background: '#151515',
        color: '#fff',
        didOpen: () => Swal.showLoading()
    });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete_product',
                id_producto: id,
                activo: newStatus
            })
        });
        const data = await response.json();

        if (data.status === 'success') {
            if (prod) prod.activo = newStatus;

            // Limpiar caché de localStorage para actualizar vista pública inmediatamente
            localStorage.removeItem('jerseys_products_cache_v5');

            applyAdminFilters(true);
            renderProductsWithFilters();

            Swal.fire({
                icon: 'success',
                title: isDeactivating ? 'Jersey Desactivado' : 'Jersey Reactivado',
                text: isDeactivating 
                    ? 'El jersey ha sido desactivado y removido de los catálogos de venta.'
                    : 'El jersey vuelve a estar activo y visible en los catálogos.',
                background: '#151515',
                color: '#fff'
            });
        } else {
            throw new Error(data.message || 'No se pudo actualizar el estado del producto.');
        }
    } catch (err) {
        console.error("Error al cambiar estado activo del producto:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message || 'Ocurrió un problema al comunicarse con el servidor.',
            background: '#151515',
            color: '#fff'
        });
    }
}
window.handleToggleProductActive = handleToggleProductActive;

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
        const fotoStr = producto.foto || producto.imagen || '';
        const initialUrls = fotoStr ? fotoStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (initialUrls.length > 0) {
            DOM.admin.updateFotoPreviewContainer.classList.remove('hidden');
            renderImagePreviews(DOM.admin.updateFotoPreviewContainer, initialUrls);
        } else {
            DOM.admin.updateFotoPreviewContainer.classList.add('hidden');
            DOM.admin.updateFotoPreviewContainer.innerHTML = '';
        }
    }

    // Cargar personalizaciones básicas y oficiales asociadas al producto
    let rawOficial = producto.personalizaciones_oficiales;
    let pConfig = {
        basica_activa: false, basica_precio_menudeo: 0, basica_precio_mayoreo: 0,
        oficial_activa: false, oficial_precio_menudeo: 0, oficial_precio_mayoreo: 0,
        opciones: []
    };

    if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
        pConfig.basica_activa = !!rawOficial.basica_activa;
        pConfig.basica_precio_menudeo = parseFloat(rawOficial.basica_precio_menudeo || 0);
        pConfig.basica_precio_mayoreo = parseFloat(rawOficial.basica_precio_mayoreo || 0);
        pConfig.oficial_activa = !!rawOficial.oficial_activa;
        pConfig.oficial_precio_menudeo = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
        pConfig.oficial_precio_mayoreo = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
        pConfig.opciones = Array.isArray(rawOficial.opciones) ? [...rawOficial.opciones] : [];
    } else if (Array.isArray(rawOficial)) {
        pConfig.oficial_activa = rawOficial.length > 0;
        pConfig.opciones = [...rawOficial];
    }

    updateOficialList = pConfig.opciones;

    const updateWrapper = document.getElementById('update-oficial-wrapper');
    const updateSel = document.getElementById('update-personalizacion');
    const persVal = producto.personalizacion || 'No';
    if (updateSel) updateSel.value = persVal;

    if (persVal === 'Opcional' || persVal === 'Sí') {
        if (updateWrapper) updateWrapper.classList.remove('hidden');
    } else {
        if (updateWrapper) updateWrapper.classList.add('hidden');
    }

    // Tipografía Básica UI
    const chkUpdateBasica = document.getElementById('update-chk-basica');
    const sectionUpdateBasica = document.getElementById('update-basica-section');
    if (chkUpdateBasica) chkUpdateBasica.checked = pConfig.basica_activa;
    if (sectionUpdateBasica) {
        if (pConfig.basica_activa) sectionUpdateBasica.classList.remove('hidden');
        else sectionUpdateBasica.classList.add('hidden');
    }
    if (document.getElementById('update-basica-precio-menudeo')) document.getElementById('update-basica-precio-menudeo').value = pConfig.basica_precio_menudeo;
    if (document.getElementById('update-basica-precio-mayoreo')) document.getElementById('update-basica-precio-mayoreo').value = pConfig.basica_precio_mayoreo;

    // Tipografía Oficial UI
    const chkUpdateOficial = document.getElementById('update-chk-oficial');
    const sectionUpdateOficial = document.getElementById('update-oficial-section');
    if (chkUpdateOficial) chkUpdateOficial.checked = pConfig.oficial_activa;
    if (sectionUpdateOficial) {
        if (pConfig.oficial_activa) sectionUpdateOficial.classList.remove('hidden');
        else sectionUpdateOficial.classList.add('hidden');
    }
    if (document.getElementById('update-oficial-precio-menudeo')) document.getElementById('update-oficial-precio-menudeo').value = pConfig.oficial_precio_menudeo;
    if (document.getElementById('update-oficial-precio-mayoreo')) document.getElementById('update-oficial-precio-mayoreo').value = pConfig.oficial_precio_mayoreo;

    renderUpdateOficialChips();

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
    
    producto.tallas.forEach((t, idx) => {
        const stockActual = t.stock !== undefined ? t.stock : (t.inventario || 0);
        const isNewTag = t.isNew || (t.id_inventario && String(t.id_inventario).startsWith('TEMP_'));
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 bg-dark-200/20 p-2.5 rounded-xl border border-white/5';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-10 bg-dark-200/50 border border-white/5 rounded-lg flex items-center justify-center font-bold text-white text-sm relative">
                    ${t.talla}
                    ${isNewTag ? '<span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[7px] font-extrabold px-1 rounded-full shadow">NUEVA</span>' : ''}
                </div>
                <div>
                    <div class="text-xs text-gray-200 font-semibold">${producto.nombre || ''}</div>
                    <div class="text-[10px] text-gray-500">Categoría: ${t.categoria || producto.genero || 'Adultos'}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <label class="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Stock:</label>
                <input type="number" min="0" value="${stockActual}" class="w-24 bg-dark-200/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white font-semibold input-stock-local-val" data-idx="${idx}">
            </div>
        `;
        DOM.admin.invTallasList.appendChild(div);
    });
    
    // Escuchar cambios locales en las cantidades de existencias
    document.querySelectorAll('.input-stock-local-val').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            const val = parseInt(e.target.value);
            if (!isNaN(idx) && currentJerseyToManage && currentJerseyToManage.tallas && currentJerseyToManage.tallas[idx]) {
                currentJerseyToManage.tallas[idx].stock = isNaN(val) || val < 0 ? 0 : val;
            }
        });
    });
}

function handleAddNewTalla(e) {
    e.preventDefault();
    if (!currentJerseyToManage) return;
    
    const tallaVal = DOM.admin.newTallaVal.value.trim();
    const stockVal = parseInt(DOM.admin.newStockVal.value);
    
    if (!tallaVal) return;
    const finalStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;

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

    if (!currentJerseyToManage.tallas) currentJerseyToManage.tallas = [];

    // Agregar talla a la lista local en memoria sin enviar petición al backend todavía
    currentJerseyToManage.tallas.push({
        id_inventario: 'TEMP_' + Date.now(),
        id_producto: currentJerseyToManage.id,
        talla: tallaVal,
        categoria: currentJerseyToManage.genero || 'Adultos',
        stock: finalStock,
        isNew: true
    });

    // Resetear campos del formulario
    DOM.admin.formAddTalla.reset();

    // Actualizar vista local de tallas inmediatamente
    renderInventorySizes(currentJerseyToManage);
    updateNewTallaSelect(currentJerseyToManage);

    // Notificación informativa
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2500,
        background: '#141416',
        color: '#fff'
    });
    Toast.fire({
        icon: 'info',
        title: `Talla ${tallaVal} agregada al listado. Presiona "Actualizar Datos" para guardar.`
    });
}

async function handleSaveBatchTallas() {
    if (!currentJerseyToManage) return;

    const btnSubmit = document.getElementById('btn-submit-save-tallas');
    if (!btnSubmit) return;
    const originalContent = btnSubmit.innerHTML;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Guardando Datos...</span>
    `;

    try {
        const payload = {
            action: "save_batch_tallas",
            token: localStorage.getItem('session_token') || '',
            id_playera: currentJerseyToManage.id,
            genero: currentJerseyToManage.genero,
            tallas: (currentJerseyToManage.tallas || []).map(t => ({
                id_inventario: t.id_inventario,
                talla: t.talla,
                stock: t.stock !== undefined ? t.stock : (t.inventario || 0),
                categoria: t.categoria || currentJerseyToManage.genero || 'Adultos'
            }))
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
                title: '¡Datos Actualizados!',
                text: 'Se han guardado todas las tallas y existencias correctamente.',
                background: '#151515', color: '#fff',
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'border border-white/10 rounded-2xl' }
            });

            // Refrescar inventario principal en fondo
            await fetchInitialProducts();

            // Sincronizar referencia local del producto
            const updatedProduct = allProducts.find(p => p.id === currentJerseyToManage.id);
            if (updatedProduct) {
                currentJerseyToManage = updatedProduct;
                renderInventorySizes(updatedProduct);
                updateNewTallaSelect(updatedProduct);
                renderAdminTable();
            }
        } else {
            throw new Error(data.message || 'Error al guardar los datos.');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Guardado',
            text: error.message,
            background: '#151515',
            color: '#fff',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
    }
}
window.handleSaveBatchTallas = handleSaveBatchTallas;

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
    
    const inputFoto = DOM.admin.updateFotoUrl ? DOM.admin.updateFotoUrl.value.trim() : '';
    const fotoUrl = inputFoto || (currentJerseyToManage ? (currentJerseyToManage.foto || currentJerseyToManage.imagen || '') : '');

    const payload = {
        action: "update",
        token: localStorage.getItem('session_token') || '',
        id: currentJerseyToManage.id,
        nombre: nombreVal,
        tipo: tipoVal,
        version: versionVal,
        genero: generoVal,
        personalizacion: personalizacionVal,
        precio_Menudeo: pMenudeo,
        precio_mayoreo: pMayoreo,
        precio_mayoreo_super: pMayoreoSuper,
        foto: fotoUrl,
        personalizaciones_oficiales: {
            basica_activa: !!(document.getElementById('update-chk-basica') && document.getElementById('update-chk-basica').checked),
            basica_precio_menudeo: parseFloat(document.getElementById('update-basica-precio-menudeo')?.value) || 0,
            basica_precio_mayoreo: parseFloat(document.getElementById('update-basica-precio-mayoreo')?.value) || 0,
            oficial_activa: !!(document.getElementById('update-chk-oficial') && document.getElementById('update-chk-oficial').checked),
            oficial_precio_menudeo: parseFloat(document.getElementById('update-oficial-precio-menudeo')?.value) || 0,
            oficial_precio_mayoreo: parseFloat(document.getElementById('update-oficial-precio-mayoreo')?.value) || 0,
            opciones: updateOficialList
        }
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
            
            // Refrescar data de productos silenciando resets innecesarios
            await fetchInitialProducts(true);
            
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
        Swal.fire({icon: 'error', title: 'Error al Actualizar', text: error.message, background: '#151515', color: '#fff'});
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
    }
}

// ==========================================
// GESTIÓN DE PERSONALIZACIONES OFICIALES (CREAR / EDITAR JERSEY)
// ==========================================
let createOficialList = [];
let updateOficialList = [];

function initOficialPersonalizacionEvents() {
    const createSel = document.getElementById('create-personalizacion');
    const createWrapper = document.getElementById('create-oficial-wrapper');
    const createChkBasica = document.getElementById('create-chk-basica');
    const createSectionBasica = document.getElementById('create-basica-section');
    const createChkOficial = document.getElementById('create-chk-oficial');
    const createSectionOficial = document.getElementById('create-oficial-section');
    const btnAddCreate = document.getElementById('btn-add-create-oficial');

    if (createSel && createWrapper) {
        createSel.addEventListener('change', () => {
            const val = createSel.value;
            if (val === 'Opcional' || val === 'Sí') {
                createWrapper.classList.remove('hidden');
            } else {
                createWrapper.classList.add('hidden');
                if (createChkBasica) createChkBasica.checked = false;
                if (createSectionBasica) createSectionBasica.classList.add('hidden');
                if (createChkOficial) createChkOficial.checked = false;
                if (createSectionOficial) createSectionOficial.classList.add('hidden');
            }
        });
    }

    if (createChkBasica && createSectionBasica) {
        createChkBasica.addEventListener('change', () => {
            if (createChkBasica.checked) {
                createSectionBasica.classList.remove('hidden');
            } else {
                createSectionBasica.classList.add('hidden');
            }
        });
    }

    if (createChkOficial && createSectionOficial) {
        createChkOficial.addEventListener('change', () => {
            if (createChkOficial.checked) {
                createSectionOficial.classList.remove('hidden');
            } else {
                createSectionOficial.classList.add('hidden');
            }
        });
    }

    if (btnAddCreate) {
        btnAddCreate.addEventListener('click', () => {
            const nomEl = document.getElementById('create-oficial-nombre');
            const numEl = document.getElementById('create-oficial-numero');
            const nom = nomEl ? nomEl.value.trim().toUpperCase() : '';
            const num = numEl ? numEl.value.trim().toUpperCase() : '';
            if (nom || num) {
                createOficialList.push({ nombre: nom, numero: num });
                if (nomEl) nomEl.value = '';
                if (numEl) numEl.value = '';
                renderCreateOficialChips();
            }
        });
    }

    const updateSel = document.getElementById('update-personalizacion');
    const updateWrapper = document.getElementById('update-oficial-wrapper');
    const updateChkBasica = document.getElementById('update-chk-basica');
    const updateSectionBasica = document.getElementById('update-basica-section');
    const updateChkOficial = document.getElementById('update-chk-oficial');
    const updateSectionOficial = document.getElementById('update-oficial-section');
    const btnAddUpdate = document.getElementById('btn-add-update-oficial');

    if (updateSel && updateWrapper) {
        updateSel.addEventListener('change', () => {
            const val = updateSel.value;
            if (val === 'Opcional' || val === 'Sí') {
                updateWrapper.classList.remove('hidden');
            } else {
                updateWrapper.classList.add('hidden');
                if (updateChkBasica) updateChkBasica.checked = false;
                if (updateSectionBasica) updateSectionBasica.classList.add('hidden');
                if (updateChkOficial) updateChkOficial.checked = false;
                if (updateSectionOficial) updateSectionOficial.classList.add('hidden');
            }
        });
    }

    if (updateChkBasica && updateSectionBasica) {
        updateChkBasica.addEventListener('change', () => {
            if (updateChkBasica.checked) {
                updateSectionBasica.classList.remove('hidden');
            } else {
                updateSectionBasica.classList.add('hidden');
            }
        });
    }

    if (updateChkOficial && updateSectionOficial) {
        updateChkOficial.addEventListener('change', () => {
            if (updateChkOficial.checked) {
                updateSectionOficial.classList.remove('hidden');
            } else {
                updateSectionOficial.classList.add('hidden');
            }
        });
    }

    if (btnAddUpdate) {
        btnAddUpdate.addEventListener('click', () => {
            const nomEl = document.getElementById('update-oficial-nombre');
            const numEl = document.getElementById('update-oficial-numero');
            const nom = nomEl ? nomEl.value.trim().toUpperCase() : '';
            const num = numEl ? numEl.value.trim().toUpperCase() : '';
            if (nom || num) {
                updateOficialList.push({ nombre: nom, numero: num });
                if (nomEl) nomEl.value = '';
                if (numEl) numEl.value = '';
                renderUpdateOficialChips();
            }
        });
    }
}

function renderCreateOficialChips() {
    const container = document.getElementById('create-oficial-container');
    if (!container) return;
    container.innerHTML = '';
    createOficialList.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-bold font-mono';
        chip.innerHTML = `<span>${item.nombre} ${item.numero ? '#' + item.numero : ''}</span>
            <button type="button" onclick="removeCreateOficialChip(${index})" class="text-amber-400 hover:text-red-400 transition-colors font-bold ml-1">✕</button>`;
        container.appendChild(chip);
    });
}

window.removeCreateOficialChip = function(index) {
    createOficialList.splice(index, 1);
    renderCreateOficialChips();
};

function renderUpdateOficialChips() {
    const container = document.getElementById('update-oficial-container');
    if (!container) return;
    container.innerHTML = '';
    updateOficialList.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-bold font-mono';
        chip.innerHTML = `<span>${item.nombre} ${item.numero ? '#' + item.numero : ''}</span>
            <button type="button" onclick="removeUpdateOficialChip(${index})" class="text-amber-400 hover:text-red-400 transition-colors font-bold ml-1">✕</button>`;
        container.appendChild(chip);
    });
}

window.removeUpdateOficialChip = function(index) {
    updateOficialList.splice(index, 1);
    renderUpdateOficialChips();
};

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
    
    createOficialList = [];
    renderCreateOficialChips();
    const createWrapper = document.getElementById('create-oficial-wrapper');
    const createChk = document.getElementById('create-chk-oficial');
    const createSection = document.getElementById('create-oficial-section');
    if (createWrapper) createWrapper.classList.add('hidden');
    if (createChk) createChk.checked = false;
    if (createSection) createSection.classList.add('hidden');

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
        createOficialList = [];
        renderCreateOficialChips();
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
        personalizaciones_oficiales: {
            basica_activa: !!(document.getElementById('create-chk-basica') && document.getElementById('create-chk-basica').checked),
            basica_precio_menudeo: parseFloat(document.getElementById('create-basica-precio-menudeo')?.value) || 0,
            basica_precio_mayoreo: parseFloat(document.getElementById('create-basica-precio-mayoreo')?.value) || 0,
            oficial_activa: !!(document.getElementById('create-chk-oficial') && document.getElementById('create-chk-oficial').checked),
            oficial_precio_menudeo: parseFloat(document.getElementById('create-oficial-precio-menudeo')?.value) || 0,
            oficial_precio_mayoreo: parseFloat(document.getElementById('create-oficial-precio-mayoreo')?.value) || 0,
            opciones: createOficialList
        },
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
    
    if (force) {
        localStorage.removeItem(CACHE_KEY);
        renderSkeletons(6);
    }
    
    let cachedProducts = null;
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && Array.isArray(cachedObj.data) && cachedObj.data.length > 0) {
                cachedProducts = cachedObj.data;
            }
        }
    } catch (e) {}
    
    if (cachedProducts && !force) {
        // Cargar instantáneamente del caché (0ms delay) sin pantalla gris
        allProducts = cachedProducts;
        renderProductsWithFilters();
        
        // Revalidar en segundo plano silenciosamente
        revalidateProductsBackground(CACHE_KEY);
    } else {
        // Cargar de la API de forma síncrona mostrando animación de carga únicamente en la primera visita absoluta
        renderSkeletons(6);
        await loadProductsFromApi(CACHE_KEY);
    }
}

async function loadProductsFromApi(cacheKey) {
    renderSkeletons(8);
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
    if (!allProducts || allProducts.length === 0) {
        renderSkeletons(6);
        return;
    }

    // Filtrar únicamente los productos activos (Activo = 1 o vacío) para la vista pública de catálogo
    const activeProductsOnly = (allProducts || []).filter(p => p.activo === undefined || p.activo === null || p.activo === "" || Number(p.activo) === 1);

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
        
        const filtrados = activeProductsOnly.filter(p => {
            let match = true;
            if (nombreQ && !(p.nombre || '').toLowerCase().includes(nombreQ)) match = false;
            if (tipoQ && p.tipo !== tipoQ) match = false;
            if (versionQ && p.version !== versionQ) match = false;
            if (generoQ && p.genero !== generoQ) match = false;
            return match;
        });
        renderLocalProducts(filtrados);
    } else {
        renderLocalProducts(activeProductsOnly);
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
        const activeProductsOnly = (allProducts || []).filter(p => p.activo === undefined || p.activo === null || p.activo === "" || Number(p.activo) === 1);
        const nombreQ = DOM.filters.nombre.value.trim().toLowerCase();
        const tipoQ = DOM.filters.tipo.value;
        const versionQ = DOM.filters.version.value;
        const generoQ = DOM.filters.genero.value;
        
        const filtrados = activeProductsOnly.filter(p => {
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

let currentRenderToken = 0;

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

    const token = ++currentRenderToken;
    const CHUNK_SIZE = 20; // 20 tarjetas por lote para renderizado instantáneo <16ms
    let index = 0;

    function renderNextChunk() {
        if (token !== currentRenderToken) return; // Detener si se inició una nueva renderización
        
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + CHUNK_SIZE, productos.length);
        
        for (let i = index; i < end; i++) {
            fragment.appendChild(createProductCard(productos[i]));
        }
        
        DOM.grid.appendChild(fragment);
        index = end;
        
        if (index < productos.length) {
            requestAnimationFrame(renderNextChunk);
        }
    }

    renderNextChunk();
}

function createProductCard(producto) {
    const article = document.createElement('article');
    article.className = 'group bg-dark-100 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-white/5 hover:border-navy-400/40 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] relative overflow-hidden';
    
    const images = (producto.foto || producto.imagen || '').split(',').map(u => u.trim()).filter(Boolean);
    let currentImgIdx = 0;
    
    const rawImg = images[currentImgIdx] || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    const imgUrl = getOptimizedImageUrl(rawImg, 500);
    
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
            <img src="${imgUrl}" alt="${producto.nombre || 'Jersey'}" class="product-card-img w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out ${(isAgotado || isProximamente) ? 'grayscale opacity-60' : ''}" loading="lazy" decoding="async">
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
        imgEl.src = getOptimizedImageUrl(images[currentImgIdx], 500);
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
    const loggedUserStr = localStorage.getItem('logged_user');
    let isAdmin = false;
    try {
        if (loggedUserStr) {
            const u = JSON.parse(loggedUserStr);
            isAdmin = (u && u.perfil === "Administrador");
        }
    } catch (e) {}

    if (view === 'mis-jerseys') {
        if (DOM.actions && DOM.actions.navCatalogo) {
            DOM.actions.navCatalogo.forEach(btn => btn.className = "action-nav-catalogo w-full text-left px-4 py-2 text-sm text-white bg-navy-500/20 rounded-lg transition-colors flex items-center gap-2");
        }
        if (DOM.actions && DOM.actions.navJerseysView) {
            DOM.actions.navJerseysView.forEach(btn => btn.className = `action-nav-jerseys-view text-xs sm:text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-white/5 ${isAdmin ? 'hidden' : ''}`);
        }
    } else if (view === 'jerseys-pedido') {
        if (DOM.actions && DOM.actions.navCatalogo) {
            DOM.actions.navCatalogo.forEach(btn => btn.className = "action-nav-catalogo w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-navy-500/20 rounded-lg transition-colors flex items-center gap-2");
        }
        if (DOM.actions && DOM.actions.navJerseysView) {
            DOM.actions.navJerseysView.forEach(btn => btn.className = `action-nav-jerseys-view text-xs sm:text-sm font-semibold text-white transition-colors flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10 ${isAdmin ? 'hidden' : ''}`);
        }
    }
    renderLocalProducts(allProducts);
}

function updatePersonalizacionDropdown(producto) {
    const sel = DOM.pedido.personalizacion;
    if (!sel || !producto) return;
    
    let rawOficial = producto.personalizaciones_oficiales;
    let basicaActiva = false;
    let oficialActiva = false;
    let basicaPriceMenudeo = 0, basicaPriceMayoreo = 0;
    let oficialPriceMenudeo = 0, oficialPriceMayoreo = 0;
    
    if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
        basicaActiva = (rawOficial.basica_activa !== undefined) ? !!rawOficial.basica_activa : true;
        basicaPriceMenudeo = parseFloat(rawOficial.basica_precio_menudeo || 0);
        basicaPriceMayoreo = parseFloat(rawOficial.basica_precio_mayoreo || 0);
        
        oficialActiva = (rawOficial.oficial_activa !== undefined) ? !!rawOficial.oficial_activa : true;
        oficialPriceMenudeo = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
        oficialPriceMayoreo = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
    } else if (Array.isArray(rawOficial)) {
        basicaActiva = true;
        oficialActiva = rawOficial.length > 0;
    } else {
        basicaActiva = true;
        oficialActiva = true;
    }
    
    let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
    if (profileToUse === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(profileToUse);

    const priceBasica = isMayoreo ? basicaPriceMayoreo : basicaPriceMenudeo;
    const priceOficial = isMayoreo ? oficialPriceMayoreo : oficialPriceMenudeo;

    const persConfig = String(producto.personalizacion || 'No').trim().toLowerCase();
    const allowsCustomization = (persConfig === 'si' || persConfig === 'sí' || persConfig === 'opcional');
    
    sel.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = 'PERS-NONE';
    optNone.textContent = 'Ninguna';
    sel.appendChild(optNone);
    
    if (allowsCustomization) {
        if (basicaActiva) {
            const optBasica = document.createElement('option');
            optBasica.value = 'PERS-BASICA';
            optBasica.textContent = `Personalización Básica${priceBasica > 0 ? ' (+$' + priceBasica.toFixed(2) + ')' : ''}`;
            sel.appendChild(optBasica);
        }
        if (oficialActiva) {
            const optOficial = document.createElement('option');
            optOficial.value = 'PERS-OFICIAL';
            optOficial.textContent = `Personalización Oficial${priceOficial > 0 ? ' (+$' + priceOficial.toFixed(2) + ')' : ''}`;
            sel.appendChild(optOficial);
        }
    }
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
    
    // Seleccionar personalización por defecto según la configuración del jersey
    if (DOM.pedido.personalizacion) {
        updatePersonalizacionDropdown(producto);
        
        const persConfig = String(producto.personalizacion || 'No').trim().toLowerCase();
        const allowsCustomization = (persConfig === 'si' || persConfig === 'sí' || persConfig === 'opcional');
        
        if (allowsCustomization) {
            DOM.pedido.personalizacion.disabled = false;
            DOM.pedido.personalizacion.className = "w-full bg-dark-200/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-navy-400 text-white cursor-pointer transition-all";
            DOM.pedido.personalizacion.value = "PERS-NONE";
        } else {
            DOM.pedido.personalizacion.disabled = true;
            DOM.pedido.personalizacion.className = "w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed opacity-60 transition-all";
            DOM.pedido.personalizacion.value = "PERS-NONE";
        }

        // Rellenar selector de Opciones Oficiales si el jersey cuenta con ellas
        const oficialContainer = document.getElementById('pedido-oficial-container');
        const oficialSelect = document.getElementById('pedido-personalizacion-oficial');
        
        let oficialObj = producto.personalizaciones_oficiales;
        let oficiales = [];
        if (oficialObj && !Array.isArray(oficialObj) && typeof oficialObj === 'object') {
            oficiales = Array.isArray(oficialObj.opciones) ? oficialObj.opciones : [];
        } else if (Array.isArray(oficialObj)) {
            oficiales = oficialObj;
        }

        if (oficialContainer && oficialSelect) {
            if (oficiales.length > 0 && allowsCustomization) {
                oficialSelect.innerHTML = '<option value="">-- Selecciona Personalización Oficial --</option>';
                oficiales.forEach(o => {
                    const label = `${o.nombre} ${o.numero ? '#' + o.numero : ''}`.trim();
                    const opt = document.createElement('option');
                    opt.value = label;
                    opt.textContent = label;
                    oficialSelect.appendChild(opt);
                });
                
                oficialSelect.onchange = () => {
                    const val = oficialSelect.value;
                    const customInput = document.getElementById('pedido-custom-text');
                    if (customInput && val) {
                        customInput.value = val;
                    }
                    handlePedidoPersonalizacionChange();
                };
            } else {
                oficialContainer.classList.add('hidden');
                oficialSelect.innerHTML = '';
            }
        }

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
        const oficialContainer = document.getElementById('pedido-oficial-container');
        if (oficialContainer) oficialContainer.classList.add('hidden');
        currentJerseyForPedido = null;
        if (DOM.cart.modal.classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
    }, 300);
}

function handlePedidoPersonalizacionChange() {
    if (!DOM.pedido.personalizacion || !currentJerseyForPedido) return;
    
    const val = DOM.pedido.personalizacion.value;
    const isCustomized = (val !== "PERS-NONE");
    
    const oficialContainer = document.getElementById('pedido-oficial-container');
    const oficialSelect = document.getElementById('pedido-personalizacion-oficial');
    const customTextContainer = DOM.pedido.customTextContainer;
    
    let rawOficial = currentJerseyForPedido.personalizaciones_oficiales;
    let basicaPriceMenudeo = 0, basicaPriceMayoreo = 0;
    let oficialPriceMenudeo = 0, oficialPriceMayoreo = 0;
    let opcionesOficiales = [];
    
    if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
        basicaPriceMenudeo = parseFloat(rawOficial.basica_precio_menudeo || 0);
        basicaPriceMayoreo = parseFloat(rawOficial.basica_precio_mayoreo || 0);
        oficialPriceMenudeo = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
        oficialPriceMayoreo = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
        opcionesOficiales = Array.isArray(rawOficial.opciones) ? rawOficial.opciones : [];
    } else if (Array.isArray(rawOficial)) {
        opcionesOficiales = rawOficial;
    }
    
    let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
    if (profileToUse === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(profileToUse);
    let price = 0;

    if (val === 'PERS-NONE') {
        if (oficialContainer) oficialContainer.classList.add('hidden');
        if (customTextContainer) customTextContainer.classList.add('hidden');
        price = 0;
    } else if (val === 'PERS-BASICA') {
        if (oficialContainer) oficialContainer.classList.add('hidden');
        if (customTextContainer) customTextContainer.classList.remove('hidden');
        price = isMayoreo ? basicaPriceMayoreo : basicaPriceMenudeo;
    } else if (val === 'PERS-OFICIAL') {
        // Oficial: SOLO mostrar el selector de jugadores, NO el campo de texto libre
        if (customTextContainer) customTextContainer.classList.add('hidden');
        if (DOM.pedido.customText) { DOM.pedido.customText.value = ''; DOM.pedido.customText.removeAttribute('required'); }
        if (opcionesOficiales.length > 0 && oficialContainer) {
            oficialContainer.classList.remove('hidden');
        } else if (oficialContainer) {
            oficialContainer.classList.add('hidden');
        }
        price = isMayoreo ? oficialPriceMayoreo : oficialPriceMenudeo;
    }
    
    if (DOM.pedido.personalizacionPrecio) {
        if (!isCustomized) {
            DOM.pedido.personalizacionPrecio.textContent = `Sin costo adicional`;
            DOM.pedido.personalizacionPrecio.className = 'text-xs text-gray-400 mt-1.5';
        } else if (price > 0) {
            DOM.pedido.personalizacionPrecio.textContent = `Costo de personalización (${isMayoreo ? 'Mayoreo' : 'Menudeo'}): +$${price.toFixed(2)}`;
            DOM.pedido.personalizacionPrecio.className = 'text-xs text-amber-400 font-semibold mt-1.5';
        } else {
            DOM.pedido.personalizacionPrecio.textContent = `Sin costo adicional`;
            DOM.pedido.personalizacionPrecio.className = 'text-xs text-gray-400 mt-1.5';
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
    
    if (val === 'PERS-BASICA') {
        DOM.pedido.customText.setAttribute('required', 'true');
    } else {
        DOM.pedido.customText.removeAttribute('required');
    }
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
    
    const oficialSelect = document.getElementById('pedido-personalizacion-oficial');
    const oficialContainer = document.getElementById('pedido-oficial-container');
    const selectedOficialText = (oficialSelect && oficialContainer && !oficialContainer.classList.contains('hidden')) ? oficialSelect.value.trim() : '';
    const cleanCustomText = selectedPersId === 'PERS-NONE' ? '' : (selectedOficialText || customText);
    
    // Obtener precio de la personalización (Básica u Oficial) según perfil
    let finalPersPrice = 0;
    let rawOficial = currentJerseyForPedido ? currentJerseyForPedido.personalizaciones_oficiales : null;
    let basicaPriceMenudeo = 0, basicaPriceMayoreo = 0;
    let oficialPriceMenudeo = 0, oficialPriceMayoreo = 0;
    
    if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
        basicaPriceMenudeo = parseFloat(rawOficial.basica_precio_menudeo || 0);
        basicaPriceMayoreo = parseFloat(rawOficial.basica_precio_mayoreo || 0);
        oficialPriceMenudeo = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
        oficialPriceMayoreo = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
    }

    let activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    if (activeProfile === "Administrador") {
        activeProfile = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(activeProfile);

    if (selectedPersId === 'PERS-BASICA') {
        finalPersPrice = isMayoreo ? basicaPriceMayoreo : basicaPriceMenudeo;
    } else if (selectedPersId === 'PERS-OFICIAL') {
        finalPersPrice = isMayoreo ? oficialPriceMayoreo : oficialPriceMenudeo;
    }
    
    // Buscar si ya existe un artículo idéntico en el carrito para agruparlo
    const existingItem = cart.find(item => 
        item.producto.id === currentJerseyForPedido.id && 
        item.talla === selectedTalla && 
        item.personalizacionId === selectedPersId && 
        item.texto_personalizado === cleanCustomText
    );
    
    if (existingItem) {
        existingItem.cantidad += selectedQty;
        existingItem.personalizacionPrecio = finalPersPrice;
    } else {
        cart.push({
            producto: currentJerseyForPedido,
            talla: selectedTalla,
            cantidad: selectedQty,
            personalizacionId: selectedPersId,
            texto_personalizado: cleanCustomText,
            personalizacionPrecio: finalPersPrice,
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
    
    const user = (typeof localStorage !== 'undefined' && localStorage.getItem('logged_user')) 
        ? JSON.parse(localStorage.getItem('logged_user')) 
        : null;
        
    const isClienteSuperAutorizado = user ? (Number(user.super_mayoreo_activo) === 1) : (esPerfilSuperMayoreo(profile) || profile === 'Administrador');
    
    let applySuper = false;
    
    // REGLA SÚPER MAYOREO EXCLUSIVA:
    // 1. Aplica ÚNICAMENTE si SuperMayoreoActivo = 1 en la hoja Clientes.
    // 2. Si el cliente ya tiene el perfil Súper Mayoreo vigente O si su carrito alcanza 10+ piezas de versión Jugador, TODOS los productos cambian a precio de Súper Mayoreo.
    if (isSuperMayoreoActivo && isClienteSuperAutorizado) {
        const totalJugador = cart.filter(i => i.producto && String(i.producto.version || '').trim().toLowerCase() === 'jugador')
                                 .reduce((sum, i) => sum + i.cantidad, 0);
        
        if (esPerfilSuperMayoreo(profile) || totalJugador >= 10) {
            applySuper = true;
        }
    }
    
    if (applySuper && producto.precio_mayoreo_super) {
        basePrice = parseFloat(producto.precio_mayoreo_super);
    } else if (esPerfilMayoreoOMas(profile)) {
        basePrice = parseFloat(producto.precio_mayoreo || 0);
    } else {
        basePrice = parseFloat(producto.precio_Menudeo || producto.precio_menudeo || 0);
    }
    
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
        
        if (item.personalizacionPrecio !== undefined && item.personalizacionPrecio !== null && Number(item.personalizacionPrecio) > 0) {
            persPrice = parseFloat(item.personalizacionPrecio);
            persName = item.texto_personalizado ? `Oficial (${item.texto_personalizado})` : "Oficial";
        } else if (item.personalizacionId !== 'PERS-NONE') {
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
        
        const rawImg = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        const imgUrl = getOptimizedImageUrl(rawImg, 150);
        
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
        if (item.personalizacionPrecio !== undefined && item.personalizacionPrecio !== null && Number(item.personalizacionPrecio) > 0) {
            persPrice = parseFloat(item.personalizacionPrecio);
        } else if (item.personalizacionId !== 'PERS-NONE') {
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
                user.super_mayoreo_activo = data.actualizacion_perfil.super_mayoreo_activo;
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
                if (item.personalizacionPrecio !== undefined && item.personalizacionPrecio !== null && Number(item.personalizacionPrecio) > 0) {
                    persPrice = parseFloat(item.personalizacionPrecio);
                    persName = item.texto_personalizado ? `Oficial (${item.texto_personalizado})` : "Oficial";
                } else if (item.personalizacionId !== 'PERS-NONE') {
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
    
    // Configurar footer de acciones (Traspasar a Local 419)
    const footerContainer = document.getElementById('admin-order-details-footer');
    if (footerContainer) {
        const isDisponibleParaRecoger = (orden.estatus && String(orden.estatus).toLowerCase().includes('disponible') && String(orden.estatus).toLowerCase().includes('recoger'));
        const isTraspasado = orden.estatus === 'Traspasado a Local 419';
        
        if (isDisponibleParaRecoger) {
            footerContainer.innerHTML = `
                <div class="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Orden lista para traspasar existencias a Local 419
                </div>
                <button onclick="traspasarOrdenALocal419('${orden.id_orden}')" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    Traspasar a inventario de local
                </button>`;
            footerContainer.classList.remove('hidden');
        } else if (isTraspasado) {
            footerContainer.innerHTML = `
                <div class="w-full text-center text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-xl flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Esta orden ya fue traspasada al inventario de Local 419
                </div>`;
            footerContainer.classList.remove('hidden');
        } else {
            footerContainer.innerHTML = '';
            footerContainer.classList.add('hidden');
        }
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

window.traspasarOrdenALocal419 = async function(id_orden) {
    const result = await Swal.fire({
        title: '¿Traspasar a Inventario Local 419?',
        text: `Se transferirán todas las piezas y tallas del pedido ${id_orden} directamente a las tablas Playeras419 e Inventario_Tallas419.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, traspasar ahora',
        cancelButtonText: 'Cancelar',
        background: '#151515',
        color: '#ffffff',
        customClass: { popup: 'border border-amber-500/30 rounded-2xl' }
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Procesando traspaso...',
        text: 'Actualizando existencias en Local 419',
        allowOutsideClick: false,
        background: '#151515',
        color: '#ffffff',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'traspasar_orden_a_419',
                id_orden: id_orden,
                token: localStorage.getItem('session_token') || ''
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Traspaso Completado',
                text: data.message || `La orden ${id_orden} ha sido traspasada con éxito al inventario de Local 419.`,
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#f59e0b'
            });

            // Cerrar modal de detalles y refrescar órdenes
            const modal = document.getElementById('admin-order-details-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
            if (typeof fetchOrdenes === 'function') fetchOrdenes();
            if (typeof fetchProducts419 === 'function') fetchProducts419(true);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error en el Traspaso',
                text: data.message || 'No se pudo completar el traspaso al inventario del Local 419.',
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#ef4444'
            });
        }
    } catch (err) {
        console.error('Error al traspasar orden:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: 'Ocurrió un fallo al comunicarse con el servidor.',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
        });
    }
};

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
    if (estatusNormalizado.includes("entregada - paqueteria") || estatusNormalizado.includes("paqueteria")) {
        const { value: trackingNum } = await Swal.fire({
            title: 'Número de Guía',
            text: 'Por favor, ingresa el número de guía / rastreo de la paquetería:',
            input: 'text',
            inputPlaceholder: 'Ej. DHL123456789 / Estafeta987654321',
            showCancelButton: true,
            confirmButtonColor: '#1d4ed8',
            cancelButtonColor: '#3f3f46',
            confirmButtonText: 'Guardar y Continuar',
            cancelButtonText: 'Cancelar',
            background: '#151515', color: '#fff',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
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
        trackingGuide = trackingNum.trim();
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
            
            const targetOrden = currentOrdenes.find(o => String(o.id_orden).trim() === id) 
                || allFetchedOrdenes.find(o => String(o.id_orden).trim() === id)
                || ordenOriginal;
            
            // El teléfono viene directamente en la orden como telefono_cliente o telefono
            let rawPhone = targetOrden?.telefono_cliente || targetOrden?.telefono || targetOrden?.celular;
            
            // Si no está, intentamos el catálogo de clientes
            if (!rawPhone) {
                const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(targetOrden?.id_cliente)) : null;
                rawPhone = clientObj ? (clientObj.telefono_cliente || clientObj.telefono || clientObj.celular) : null;
            }
            
            let finalPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
            if (finalPhone && finalPhone.length === 10) {
                finalPhone = '52' + finalPhone;
            }
            
            // Si no se encontró teléfono registrado, solicitarlo al administrador
            if (!finalPhone) {
                const { value: manualPhone } = await Swal.fire({
                    title: 'Notificar por WhatsApp',
                    text: `No se encontró teléfono registrado para la orden ${id_orden}. Ingresa el número de WhatsApp del cliente:`,
                    input: 'text',
                    inputPlaceholder: 'Ej. 5512345678',
                    showCancelButton: true,
                    confirmButtonColor: '#25D366',
                    confirmButtonText: 'Enviar WhatsApp',
                    cancelButtonText: 'Omitir Notificación',
                    background: '#151515', color: '#fff'
                });
                if (manualPhone) {
                    let clean = manualPhone.replace(/\D/g, '');
                    if (clean.length === 10) clean = '52' + clean;
                    if (clean) finalPhone = clean;
                }
            }
            
            if (finalPhone) {
                let nombreCorto = 'Cliente';
                if (targetOrden?.nombre_cliente) {
                    nombreCorto = targetOrden.nombre_cliente.split(' ')[0];
                }
                
                const mensajeGuia = trackingGuide ? `\n\n📦 *Número de Guía / Rastreo:* ${trackingGuide}` : '';
                const waText = encodeURIComponent(`*Actualización de Pedido* 🚚\n\nHola ${nombreCorto},\nEl estatus de tu orden *${id_orden}* ha cambiado a: *${nuevo_estatus}*.${mensajeGuia}\n\n¡Gracias por tu preferencia!`);
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
        const m = document.getElementById('user-ordenes-modal');
        if (m) m.classList.add('hidden');
        document.body.style.overflow = '';
    });

    document.getElementById('close-user-order-details-modal')?.addEventListener('click', () => {
        const m = document.getElementById('user-order-details-modal');
        if (m) m.classList.add('hidden');
    });
    
    // Si queremos cerrar con click fuera
    document.getElementById('user-ordenes-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'user-ordenes-modal') {
            e.target.classList.add('hidden');
            document.body.style.overflow = '';
        }
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
    document.body.style.overflow = 'hidden';
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
    
    const isImageType = file.type && file.type.startsWith('image/');
    const isImageExt = file.name && file.name.match(/\.(jpg|jpeg|png|webp|heic|heif|gif|bmp|tiff|avif)$/i);
    if (file.type && !isImageType && !isImageExt) {
        Swal.fire({ icon: 'error', title: 'Archivo Inválido', text: 'Por favor selecciona un archivo de imagen.', background: '#151515', color: '#fff' });
        return;
    }
    
    if (DOM.excelOrders.inputs.fotoInfo) {
        DOM.excelOrders.inputs.fotoInfo.textContent = file.name || 'Imagen cargada';
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
        img.onerror = function() {
            // Fallback si la imagen no se puede renderizar en canvas (ej. formatos nativos Safari)
            currentUploadedImageBase64 = rawBase64;
            if (DOM.excelOrders.inputs.imgPreview) {
                DOM.excelOrders.inputs.imgPreview.src = rawBase64;
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
    
    const isImageType = file.type && file.type.startsWith('image/');
    const isImageExt = file.name && file.name.match(/\.(jpg|jpeg|png|webp|heic|heif|gif|bmp|tiff|avif)$/i);
    if (file.type && !isImageType && !isImageExt) {
        Swal.fire({ icon: 'error', title: 'Archivo Inválido', text: 'Por favor selecciona un archivo de imagen para el parche.', background: '#151515', color: '#fff' });
        return;
    }
    
    const infoEl = document.getElementById('excel-pedido-patch-foto-info');
    if (infoEl) infoEl.textContent = file.name || 'Parche cargado';
    
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
        img.onerror = function() {
            currentUploadedPatchBase64 = rawBase64;
            const preview = document.getElementById('excel-pedido-patch-img-preview');
            const container = document.getElementById('excel-pedido-patch-img-preview-container');
            if (preview) preview.src = rawBase64;
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
    
    // Auto-scroll al final del contenedor para visualizar inmediatamente la prenda agregada
    const scrollBox = document.getElementById('excel-pedido-list-scroll-container');
    if (scrollBox) {
        setTimeout(() => {
            scrollBox.scrollTop = scrollBox.scrollHeight;
        }, 50);
    }
}

function prepareCleanImageForExcel(dataUrl) {
    return new Promise((resolve) => {
        if (!dataUrl) return resolve(null);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const w = img.naturalWidth || img.width || 300;
                const h = img.naturalHeight || img.height || 400;
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve({
                    base64: jpegUrl.split(',')[1],
                    extension: 'jpeg',
                    width: w,
                    height: h
                });
            } catch(e) {
                const clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                resolve({ base64: clean, extension: 'jpeg', width: 300, height: 400 });
            }
        };
        img.onerror = () => {
            const clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve({ base64: clean, extension: 'jpeg', width: 300, height: 400 });
        };
        img.src = dataUrl;
    });
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
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Procesando fotos e imágenes...`;
    
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
                    patch: item.patch || '',
                    remark: item.remark || '-',
                    items: []
                };
            }
            grouped[key].items.push(item);
        });
        
        // Re-codificar e higienizar imágenes a formato estándar JPEG vía Canvas (100% compatible con visores móviles)
        const preparedImagesMap = {};
        await Promise.all(Object.keys(grouped).map(async (code) => {
            const prod = grouped[code];
            if (prod.foto) {
                preparedImagesMap[code] = await prepareCleanImageForExcel(prod.foto);
            }
            if (prod.patch) {
                preparedImagesMap[code + '_patch'] = await prepareCleanImageForExcel(prod.patch);
            }
        }));
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pedido');
        
        worksheet.columns = [
            { header: 'Code', key: 'code', width: 18 },
            { header: 'Image', key: 'image', width: 28 },
            { header: 'Remark', key: 'remark', width: 24 },
            { header: 'size', key: 'size', width: 10 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Name', key: 'name', width: 18 },
            { header: 'Number', key: 'number', width: 12 },
            { header: 'patch', key: 'patch', width: 18 },
            { header: 'Unit Price ($)', key: 'unit_price_aux', width: 16 },
            { header: 'Unit Price ($)', key: 'unit_price_usd', width: 16 },
            { header: 'Total($)', key: 'total', width: 16 }
        ];
        
        // Estilo de cabeceras (COLOR AMARILLO #FFFF00)
        const headerRow = worksheet.getRow(1);
        headerRow.height = 32;
        headerRow.eachCell((cell) => {
            cell.font = { name: '宋体', bold: true, color: { argb: 'FF000000' }, size: 11 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        
        let currentRow = 2;
        
        for (const code of Object.keys(grouped)) {
            const prod = grouped[code];
            const numRows = prod.items.length;
            const rowStart = currentRow;
            const rowEnd = currentRow + numRows - 1;
            
            // Garantizar altura suficiente para la celda combinada (mínimo 105pt para 1 fila)
            const targetBlockHeightPt = Math.max(105, numRows * 38);
            const singleRowHeightPt = Math.max(35, targetBlockHeightPt / numRows);
            
            for (let idx = 0; idx < numRows; idx++) {
                const item = prod.items[idx];
                const price = Number(item.price) || 0;
                
                const row = worksheet.getRow(currentRow);
                row.height = singleRowHeightPt;
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
            
            const cellA = worksheet.getCell(`A${rowStart}`);
            cellA.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cellA.font = { name: '宋体', bold: true, size: 10 };
            
            const cellC = worksheet.getCell(`C${rowStart}`);
            cellC.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cellC.font = { name: '宋体', size: 10 };
            
            // Conversión precisa de puntos Excel a píxeles (1pt = 1.333px a 96 DPI)
            const totalBlockHeightPx = Math.round(targetBlockHeightPt * 1.3333);
            const colWidthPx = 200; // Ancho en píxeles aproximado de columna B (width: 28)
            
            const prepFoto = preparedImagesMap[code];
            if (prepFoto && prepFoto.base64) {
                try {
                    const imageId = workbook.addImage({
                        base64: prepFoto.base64,
                        extension: prepFoto.extension || 'jpeg'
                    });
                    
                    // Margen de seguridad interno para evitar que toque los bordes superior/inferior de la celda
                    const maxBoxW = colWidthPx - 24; // 176px máx
                    const maxBoxH = totalBlockHeightPx - 24; // Mínimo 16px de espacio libre vertical
                    
                    // Escalar preservando la relación de aspecto exacta de la foto
                    const scale = Math.min(maxBoxW / prepFoto.width, maxBoxH / prepFoto.height);
                    const finalW = Math.max(25, Math.round(prepFoto.width * scale));
                    const finalH = Math.max(25, Math.round(prepFoto.height * scale));
                    
                    // Fracción exacta de desplazamiento para centrar la imagen en la celda B
                    const colCenterOffset = Math.max(0.01, ((colWidthPx - finalW) / 2) / colWidthPx);
                    const rowCenterOffset = Math.max(0.01, ((totalBlockHeightPx - finalH) / 2) / totalBlockHeightPx);
                    
                    worksheet.addImage(imageId, {
                        tl: { col: 1.0 + colCenterOffset, row: (rowStart - 1.0) + rowCenterOffset },
                        ext: { width: finalW, height: finalH },
                        editAs: 'oneCell'
                    });
                } catch (imgError) {
                    console.error("Error al procesar imagen limpia para Excel:", imgError);
                }
            }
            
            const prepPatch = preparedImagesMap[code + '_patch'];
            if (prepPatch && prepPatch.base64) {
                if (numRows > 1) {
                    worksheet.mergeCells(`H${rowStart}:H${rowEnd}`);
                }
                const cellH = worksheet.getCell(`H${rowStart}`);
                cellH.alignment = { vertical: 'middle', horizontal: 'center' };
                
                try {
                    const patchImageId = workbook.addImage({
                        base64: prepPatch.base64,
                        extension: prepPatch.extension || 'jpeg'
                    });
                    
                    const patchColWidthPx = 130;
                    const pMaxBoxW = patchColWidthPx - 16;
                    const pMaxBoxH = totalBlockHeightPx - 16;
                    
                    const pScale = Math.min(pMaxBoxW / prepPatch.width, pMaxBoxH / prepPatch.height, 0.8);
                    const pFinalW = Math.max(15, Math.round(prepPatch.width * pScale));
                    const pFinalH = Math.max(15, Math.round(prepPatch.height * pScale));
                    
                    const pColCenterOffset = Math.max(0.01, ((patchColWidthPx - pFinalW) / 2) / patchColWidthPx);
                    const pRowCenterOffset = Math.max(0.01, ((totalBlockHeightPx - pFinalH) / 2) / totalBlockHeightPx);

                    worksheet.addImage(patchImageId, {
                        tl: { col: 7.0 + pColCenterOffset, row: (rowStart - 1.0) + pRowCenterOffset },
                        ext: { width: pFinalW, height: pFinalH },
                        editAs: 'oneCell'
                    });
                } catch (patchImgError) {
                    console.error("Error al procesar parche limpio para Excel:", patchImgError);
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
        
        // Convertir buffer a base64 Data URL para compatibilidad total con celulares (iOS Safari y Android)
        let binaryStr = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binaryStr += String.fromCharCode(bytes[i]);
        }
        const base64Excel = window.btoa(binaryStr);
        const dataUrlExcel = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Excel;
        
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Intentar descarga automática en escritorio
        try {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch(autoErr) {
            console.warn("Descarga automática bloqueada por el navegador móvil:", autoErr);
        }
        
        // Guardar también el pedido en Google Sheets con número de foto (no_foto)
        const folioSupplier = 'PROV-' + Date.now() + Math.random().toString(36).substring(2, 5).toUpperCase();
        try {
            const supplierItems = [];
            let photoNum = 1;
            for (const code of Object.keys(grouped)) {
                const prod = grouped[code];
                prod.items.forEach(item => {
                    supplierItems.push({
                        no_foto: photoNum,
                        id_producto: item.id_producto || '',
                        equipo: item.remark || '',
                        foto: item.foto || '',
                        remark: item.remark || '',
                        size: item.size || '',
                        qty: item.qty || 0,
                        name: item.name || '',
                        number: item.number || '',
                        patch: item.patch || ''
                    });
                });
                photoNum++;
            }
            
            const fechaCentroMx = new Intl.DateTimeFormat('es-MX', {
                timeZone: 'America/Mexico_City',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(new Date());
            
            const supplierPayload = {
                action: 'save_supplier_order',
                id_pedido_proveedor: folioSupplier,
                fecha: fechaCentroMx,
                items: supplierItems
            };
            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(supplierPayload)
            }).catch(err => console.error("Error al guardar pedido en Google Sheets:", err));
        } catch (saveErr) {
            console.error("Error al estructurar pedido proveedor:", saveErr);
        }
        
        // Mostrar modal interactivo con botón directo de descarga para celulares (evita bloqueos de pop-up en iOS/Android)
        Swal.fire({
            icon: 'success',
            title: '¡Excel Generado con Éxito!',
            html: `
                <div class="text-center space-y-3 py-2">
                    <p class="text-xs sm:text-sm text-gray-300">
                        Folio: <strong class="text-white font-mono">${folioSupplier}</strong> | Total: <strong class="text-emerald-400 font-bold">${calculatedTotalQty} pcs</strong>
                    </p>
                    <p class="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-lg text-left">
                        📱 <strong>Si estás en un celular (iPhone o Android):</strong> Presiona el botón verde a continuación para guardar el archivo Excel directamente en tu dispositivo.
                    </p>
                    <div class="pt-2 flex flex-col gap-2">
                        <a href="${dataUrlExcel}" download="${fileName}" class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            📥 Toca aquí para Descargar ${fileName}
                        </a>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#151515',
            color: '#fff'
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

// =========================================================================
// MÓDULO: GESTIÓN DE PEDIDOS A PROVEEDOR & INGESTA / MIGRACIÓN A STOCK
// =========================================================================

let allSupplierOrders = [];
let currentSupplierOrderEditing = null;

async function openSupplierOrdersModal() {
    const modal = document.getElementById('admin-supplier-orders-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const box = modal.children[0];
        if (box) box.classList.remove('scale-95');
    }, 10);
    
    if (typeof allProducts === 'undefined' || !allProducts || allProducts.length === 0) {
        if (window.fetchInitialProducts) await window.fetchInitialProducts();
    }
    window.allProducts = allProducts;
    
    loadSupplierOrders();
}
window.openSupplierOrdersModal = openSupplierOrdersModal;

function closeSupplierOrdersModal() {
    const modal = document.getElementById('admin-supplier-orders-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = modal.children[0];
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}
window.closeSupplierOrdersModal = closeSupplierOrdersModal;

async function loadSupplierOrders() {
    const tbody = document.getElementById('supplier-orders-tbody');
    const emptyState = document.getElementById('supplier-orders-empty');
    
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400"><div class="w-8 h-8 border-4 border-navy-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>Cargando pedidos a proveedor...</td></tr>`;
    if (emptyState) emptyState.classList.add('hidden');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_supplier_orders' })
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            allSupplierOrders = data.orders || [];
            renderSupplierOrdersList(allSupplierOrders);
        } else {
            throw new Error(data.message || 'Error al obtener pedidos a proveedor');
        }
    } catch (error) {
        console.error("Error al cargar pedidos a proveedor:", error);
        if (tbody) tbody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No se pudieron cargar los pedidos. Intenta nuevamente.';
        }
    }
}
window.loadSupplierOrders = loadSupplierOrders;

function filterSupplierOrders() {
    const filterFolio = (document.getElementById('admin-supplier-filtro-folio')?.value || '').trim().toLowerCase();
    const filterStatus = (document.getElementById('admin-supplier-filtro-estatus')?.value || '').trim();
    
    let filtered = allSupplierOrders.filter(order => {
        const matchFolio = !filterFolio || String(order.id_pedido_proveedor).toLowerCase().includes(filterFolio);
        const matchStatus = !filterStatus || order.estatus === filterStatus;
        return matchFolio && matchStatus;
    });
    
    renderSupplierOrdersList(filtered);
}
window.filterSupplierOrders = filterSupplierOrders;

function renderSupplierOrdersList(orders) {
    const tbody = document.getElementById('supplier-orders-tbody');
    const emptyState = document.getElementById('supplier-orders-empty');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-white/5 hover:bg-white/5 transition-colors';
        
        const isMigrated = (order.estatus === 'Ingresado a Stock');
        const isParcial = (order.estatus === 'Parcial');
        const badgeColor = isMigrated 
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
            : (isParcial 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30');
            
        let formattedDate = String(order.fecha || '-');
        if (formattedDate.includes('T') || formattedDate.includes('Z')) {
            try {
                const d = new Date(order.fecha);
                formattedDate = d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
            } catch(e) {}
        }
        
        tr.innerHTML = `
            <td class="p-3.5 font-mono font-bold text-white">${order.id_pedido_proveedor}</td>
            <td class="p-3.5 text-gray-400 text-[11px]">${formattedDate}</td>
            <td class="p-3.5 text-gray-200 font-bold text-center">${order.total_piezas} pcs</td>
            <td class="p-3.5">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeColor}">${order.estatus || 'Pendiente'}</span>
            </td>
            <td class="p-3.5 text-center">
                <button type="button" onclick="window.openSupplierOrderDetailsModal('${order.id_pedido_proveedor}')" class="px-3 py-1.5 rounded-lg ${isMigrated ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} font-bold transition-all text-[11px] inline-flex items-center gap-1.5 shadow">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    ${isMigrated ? 'Ver Detalle' : 'Asignar e Ingresar a Stock'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function openSupplierOrderDetailsModal(folio) {
    const order = allSupplierOrders.find(o => String(o.id_pedido_proveedor) === String(folio));
    if (!order) {
        Swal.fire({ icon: 'error', title: 'Pedido no encontrado', text: 'No se encontraron los datos del pedido ' + folio, background: '#151515', color: '#fff' });
        return;
    }
    
    if (typeof allProducts === 'undefined' || !allProducts || allProducts.length === 0) {
        if (window.fetchInitialProducts) await window.fetchInitialProducts();
    }
    window.allProducts = allProducts;
    
    currentSupplierOrderEditing = order;
    
    const modal = document.getElementById('admin-supplier-order-details-modal');
    if (!modal) return;
    
    const folioEl = document.getElementById('supplier-detail-folio');
    if (folioEl) folioEl.textContent = order.id_pedido_proveedor;
    
    const badgeEl = document.getElementById('supplier-detail-status-badge');
    const isMigrated = (order.estatus === 'Ingresado a Stock');
    const isParcial = (order.estatus === 'Parcial');
    if (badgeEl) {
        badgeEl.textContent = order.estatus || 'Pendiente';
        badgeEl.className = isMigrated ? 'text-emerald-400 font-bold' : (isParcial ? 'text-cyan-400 font-bold' : 'text-yellow-400 font-bold');
    }
    
    const confirmBtn = document.getElementById('btn-confirm-supplier-stock-migration');
    if (confirmBtn) {
        confirmBtn.disabled = isMigrated;
        if (isMigrated) {
            confirmBtn.innerHTML = `✓ Ya Ingresado a Stock`;
            confirmBtn.className = `px-6 py-2.5 rounded-xl bg-white/10 text-gray-500 font-bold cursor-not-allowed text-xs flex items-center gap-2`;
        } else {
            confirmBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Confirmar e Ingresar a Stock`;
            confirmBtn.className = `px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow hover:shadow-emerald-500/20 active:scale-[0.98] text-xs flex items-center gap-2`;
        }
    }
    
    renderSupplierItemAssignments(order);
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const box = modal.children[0];
        if (box) box.classList.remove('scale-95');
    }, 10);
}
window.openSupplierOrderDetailsModal = openSupplierOrderDetailsModal;

function closeSupplierOrderDetailsModal() {
    const modal = document.getElementById('admin-supplier-order-details-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = modal.children[0];
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}
window.closeSupplierOrderDetailsModal = closeSupplierOrderDetailsModal;

function renderSupplierItemAssignments(order) {
    const container = document.getElementById('supplier-detail-items-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Agrupar ítems por no_foto / foto / remark para presentar tarjetas agrupadas por jersey
    const groupedItems = {};
    order.items.forEach((item, itemIdx) => {
        const photoNo = item.no_foto || (Object.keys(groupedItems).length + 1);
        const key = item.no_foto ? `Foto_${item.no_foto}` : (item.foto || item.remark || `Item_${itemIdx}`);
        if (!groupedItems[key]) {
            groupedItems[key] = {
                no_foto: photoNo,
                remark: item.remark,
                foto: item.foto,
                id_producto: item.id_producto || '',
                tallasQty: {},
                tallasStatus: {},
                isMigrated: (order.estatus === 'Ingresado a Stock'),
                items: []
            };
        }
        groupedItems[key].items.push(item);
        const s = item.size || item.talla || 'Única';
        groupedItems[key].tallasQty[s] = (groupedItems[key].tallasQty[s] || 0) + (Number(item.qty || item.cantidad) || 0);
        groupedItems[key].tallasStatus[s] = item.estatus || order.estatus;
    });
    
    // Guardar referencia en el objeto global para confirmSupplierStockMigration
    currentSupplierOrderEditing._groupedItems = groupedItems;
    
    // Obtener la lista de productos del catálogo de la memoria global
    const catalogProducts = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
    
    Object.keys(groupedItems).forEach((groupKey, idx) => {
        const group = groupedItems[groupKey];
        
        const card = document.createElement('div');
        card.className = 'bg-dark-200/40 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4';
        
        let tallasBadgesHtml = '';
        let allGroupMigrated = true;

        Object.keys(group.tallasQty).forEach(sz => {
            const pendingQty = group.tallasQty[sz];
            const szStatus = group.tallasStatus[sz];
            const isSizeMigrated = group.isMigrated || (szStatus === 'Ingresado a Stock');
            
            if (!isSizeMigrated) {
                allGroupMigrated = false;
            }

            if (isSizeMigrated) {
                tallasBadgesHtml += `
                    <div class="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-500/30 p-1.5 rounded-lg my-0.5 opacity-90" title="Registro ya Ingresado a Stock (No modificable)">
                        <span class="text-emerald-400 text-xs font-mono font-bold">${sz}:</span>
                        <input type="number" id="supplier-qty-input-${idx}-${sz}" data-size="${sz}" data-pending="${pendingQty}" value="${pendingQty}" disabled class="w-14 bg-dark-200/90 border border-white/10 text-gray-400 font-bold text-xs rounded px-1.5 py-0.5 text-center cursor-not-allowed">
                        <span class="text-[9px] text-emerald-400 font-bold font-mono">✓ Ingresado</span>
                    </div>
                `;
            } else {
                tallasBadgesHtml += `
                    <div class="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1.5 rounded-lg my-0.5">
                        <span class="text-gray-300 text-xs font-mono font-bold">${sz}:</span>
                        <input type="number" id="supplier-qty-input-${idx}-${sz}" data-size="${sz}" data-pending="${pendingQty}" value="${pendingQty}" min="0" max="${pendingQty}" class="w-14 bg-dark-100 border border-white/10 text-emerald-400 font-bold text-xs rounded px-1.5 py-0.5 text-center focus:border-emerald-400 focus:outline-none">
                        <span class="text-[9px] text-gray-400 font-mono">/ ${pendingQty} pend.</span>
                    </div>
                `;
            }
        });
        
        // Crear opciones para el select de catálogo
        let selectOptionsHtml = `<option value="">-- Seleccionar Playera del Catálogo (${catalogProducts.length} disponib.) --</option>`;
        catalogProducts.forEach(prod => {
            const pId = prod.id_producto || prod.id || prod.code || '';
            const isSelected = String(pId) === String(group.id_producto);
            const teamTitle = prod.nombre || prod.equipo || prod.titulo || 'Jersey del Catálogo';
            const verGen = [prod.tipo, prod.version, prod.genero].filter(Boolean).join(' ');
            const displayLabel = verGen ? `${teamTitle} (${verGen})` : teamTitle;
            selectOptionsHtml += `<option value="${pId}" ${isSelected ? 'selected' : ''}>${displayLabel}</option>`;
        });
        
        const isSelectDisabled = allGroupMigrated ? 'disabled' : '';
        const selectClass = allGroupMigrated 
            ? 'w-full bg-dark-200/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed opacity-75' 
            : 'w-full bg-dark-100 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-navy-400 text-white cursor-pointer';

        card.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <!-- Columna Izquierda: Datos solicitados al Proveedor -->
                <div class="md:col-span-6 space-y-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                    <div class="flex justify-between items-center border-b border-white/5 pb-1 flex-wrap gap-1">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] border border-emerald-500/30">Foto #${group.no_foto}</span>
                            Solicitado a Proveedor
                        </span>
                        ${allGroupMigrated 
                            ? `<span class="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">✓ Ingresado a Stock</span>` 
                            : `<span class="text-[9px] text-emerald-400 font-bold">Modifica si llegaron menos</span>`
                        }
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="w-14 h-14 flex-shrink-0 bg-dark-100 border border-white/10 rounded-lg overflow-hidden p-0.5 mt-1">
                            ${group.foto ? `<img src="${group.foto}" class="w-full h-full object-contain">` : `<div class="w-full h-full flex items-center justify-center text-[8px] text-gray-600">Sin foto</div>`}
                        </div>
                        <div class="flex-grow">
                            <div class="text-xs font-bold text-white mb-1.5">${group.remark}</div>
                            <div class="flex flex-wrap gap-1.5">${tallasBadgesHtml}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Columna Derecha: Selección e Previsualización del Catálogo -->
                <div class="md:col-span-6 space-y-3">
                    <div>
                        <label class="block text-[10px] font-bold text-navy-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Conectar con Producto del Catálogo (Stock)</span>
                            ${allGroupMigrated ? `<span class="text-emerald-400 text-[9px] font-mono font-bold">✓ VINCULADO E INGRESADO</span>` : ''}
                        </label>
                        <div class="space-y-1.5">
                            ${!allGroupMigrated ? `
                            <div class="relative">
                                <input type="text" id="supplier-item-search-${idx}" oninput="window.filterSupplierCatalogSelect(${idx}, this.value)" placeholder="🔍 Filtrar por nombre, tipo o versión (ej. Tigres, Local, Jugador)..." class="w-full bg-dark-100/90 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-navy-400 text-white placeholder-gray-500 transition-colors">
                                <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>` : ''}
                            <select id="supplier-item-select-${idx}" data-group-key="${groupKey}" ${isSelectDisabled} onchange="window.handleSupplierProductSelectChange(${idx}, this.value)" class="${selectClass}">
                                ${selectOptionsHtml}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Tarjeta de Previsualización Visual de la Playera -->
                    <div id="supplier-item-preview-card-${idx}" class="transition-all duration-300">
                        <!-- Se puebla dinámicamente -->
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
        
        // Disparar render inicial si ya tenía id_producto pre-seleccionado
        if (group.id_producto) {
            handleSupplierProductSelectChange(idx, group.id_producto);
        } else {
            handleSupplierProductSelectChange(idx, '');
        }
    });
}

function removeAccentsAndSpecialChars(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
window.removeAccentsAndSpecialChars = removeAccentsAndSpecialChars;

function filterSupplierCatalogSelect(idx, searchText) {
    const select = document.getElementById(`supplier-item-select-${idx}`);
    if (!select) return;
    
    const catalogProducts = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
    const cleanQuery = removeAccentsAndSpecialChars(searchText);
    
    const currentVal = select.value;
    
    const filtered = catalogProducts.filter(prod => {
        if (!cleanQuery) return true;
        const title = removeAccentsAndSpecialChars(prod.nombre || prod.equipo || prod.titulo || '');
        const verGen = removeAccentsAndSpecialChars([prod.tipo, prod.version, prod.genero].filter(Boolean).join(' '));
        const fullTarget = (title + ' ' + verGen).trim();
        
        const queryWords = cleanQuery.split(' ').filter(Boolean);
        return queryWords.every(word => fullTarget.includes(word));
    });
    
    let optionsHtml = `<option value="">-- ${cleanQuery ? `Coincidencias (${filtered.length})` : `Seleccionar Playera del Catálogo (${catalogProducts.length} disponib.)`} --</option>`;
    
    filtered.forEach(prod => {
        const pId = prod.id_producto || prod.id || prod.code || '';
        const isSelected = String(pId) === String(currentVal);
        const teamTitle = prod.nombre || prod.equipo || prod.titulo || 'Jersey del Catálogo';
        const verGen = [prod.tipo, prod.version, prod.genero].filter(Boolean).join(' ');
        const displayLabel = verGen ? `${teamTitle} (${verGen})` : teamTitle;
        optionsHtml += `<option value="${pId}" ${isSelected ? 'selected' : ''}>${displayLabel}</option>`;
    });
    
    select.innerHTML = optionsHtml;
    
    // Auto-seleccionar si hay coincidencia única para máxima rapidez
    if (filtered.length === 1 && cleanQuery.length >= 2) {
        const singleId = filtered[0].id_producto || filtered[0].id || filtered[0].code;
        select.value = singleId;
        handleSupplierProductSelectChange(idx, singleId);
    }
}
window.filterSupplierCatalogSelect = filterSupplierCatalogSelect;

function handleSupplierProductSelectChange(idx, selectedId) {
    const cardContainer = document.getElementById(`supplier-item-preview-card-${idx}`);
    if (!cardContainer) return;
    
    if (!selectedId) {
        cardContainer.innerHTML = `
            <div class="p-3 bg-dark-100/50 border border-dashed border-white/10 rounded-xl text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Selecciona el producto del catálogo para verificar la playera.
            </div>
        `;
        return;
    }
    
    const catalogProducts = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
    const prod = catalogProducts.find(p => String(p.id_producto || p.id || p.code) === String(selectedId));
    
    if (!prod) {
        cardContainer.innerHTML = `<div class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">Producto no encontrado en inventario local.</div>`;
        return;
    }
    
    const prodImg = (prod.foto || prod.imagen || '').split(',')[0] || '';
    const teamTitle = prod.nombre || prod.equipo || prod.titulo || 'Jersey del Catálogo';
    const verGen = [prod.tipo, prod.version, prod.genero].filter(Boolean).join(' ');
    const prodId = prod.id_producto || prod.id || prod.code || '';
    
    // Obtener tallas actuales en el catálogo
    let stockBadges = '';
    if (Array.isArray(prod.tallas)) {
        prod.tallas.forEach(t => {
            const val = t.stock !== undefined ? t.stock : t.inventario;
            stockBadges += `<span class="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px] text-emerald-400 font-mono font-bold mr-1">${t.talla}: ${val}</span>`;
        });
    } else {
        const tallasDict = prod.tallas || prod.stock || {};
        Object.keys(tallasDict).forEach(sz => {
            stockBadges += `<span class="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px] text-emerald-400 font-mono font-bold mr-1">${sz}: ${tallasDict[sz]}</span>`;
        });
    }
    if (!stockBadges) stockBadges = '<span class="text-[10px] text-gray-500">Sin registro de tallas</span>';
    
    cardContainer.innerHTML = `
        <div class="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 relative">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 flex-shrink-0 bg-dark-200 border border-white/10 rounded-lg overflow-hidden p-0.5">
                    ${prodImg ? `<img src="${prodImg}" class="w-full h-full object-contain">` : `<div class="w-full h-full flex items-center justify-center text-[8px] text-gray-500">Sin foto</div>`}
                </div>
                <div class="min-w-0 flex-grow">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-bold text-white truncate">${teamTitle}</span>
                        <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            Verificado
                        </span>
                    </div>
                    <div class="text-[10px] text-gray-400 truncate">${verGen || 'Catálogo'} | ID: <strong class="text-gray-200 font-mono">${prodId}</strong></div>
                </div>
            </div>
            <div class="pt-2 border-t border-white/5">
                <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stock Actual en Catálogo:</div>
                <div class="flex flex-wrap gap-1">${stockBadges}</div>
            </div>
        </div>
    `;
}
window.handleSupplierProductSelectChange = handleSupplierProductSelectChange;

async function confirmSupplierStockMigration() {
    if (!currentSupplierOrderEditing) return;
    
    const folio = currentSupplierOrderEditing.id_pedido_proveedor;
    const groupedItems = currentSupplierOrderEditing._groupedItems || {};
    const groupKeys = Object.keys(groupedItems);
    
    // Recopilar asignaciones de id_producto para cada grupo de prendas
    const assignments = [];
    const container = document.getElementById('supplier-detail-items-container');
    if (!container) return;
    
    const selectElements = container.querySelectorAll('select[id^="supplier-item-select-"]');
    let hasUnassigned = false;
    let totalReceivedInThisIngress = 0;
    
    selectElements.forEach((sel, idx) => {
        const selectedId = sel.value;
        const groupKey = groupKeys[idx];
        const group = groupedItems[groupKey];
        
        if (!selectedId) {
            hasUnassigned = true;
        } else if (group && group.tallasQty) {
            const tallasReceived = {};
            const tallasRemaining = {};
            
            Object.keys(group.tallasQty).forEach(sz => {
                const pendingQty = Number(group.tallasQty[sz]) || 0;
                const inputEl = document.getElementById(`supplier-qty-input-${idx}-${sz}`);
                
                // Si el input está deshabilitado, ya fue ingresado a stock anteriormente -> Omitir
                if (inputEl && inputEl.disabled) return;

                const val = Number(inputEl?.value);
                const receivedQty = (isNaN(val) || val < 0) ? pendingQty : Math.min(pendingQty, val);
                
                tallasReceived[sz] = receivedQty;
                tallasRemaining[sz] = Math.max(0, pendingQty - receivedQty);
                totalReceivedInThisIngress += receivedQty;
            });
            
            assignments.push({
                no_foto: group.no_foto || (idx + 1),
                id_producto: selectedId,
                groupKey: groupKey,
                foto: group.foto || '',
                remark: group.remark || '',
                tallas_received: tallasReceived,
                tallas_remaining: tallasRemaining
            });
        }
    });
    
    if (hasUnassigned) {
        const result = await Swal.fire({
            title: '¿Continuar con prendas sin asignar?',
            text: 'Algunas prendas no tienen un ID de producto seleccionado. Solo las prendas asignadas se sumarán al stock del catálogo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#1d4ed8',
            cancelButtonColor: '#3f3f46',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Asignar faltantes',
            background: '#151515', color: '#fff'
        });
        if (!result.isConfirmed) return;
    }
    
    if (assignments.length === 0 || totalReceivedInThisIngress === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin piezas recibidas', text: 'Ingresa al menos 1 pieza recibida en los campos para poder actualizar el inventario.', background: '#151515', color: '#fff' });
        return;
    }
    
    try {
        Swal.fire({ title: 'Actualizando Inventario...', text: 'Sumando piezas recibidas al stock de catálogo...', allowOutsideClick: false, background: '#151515', color: '#fff', didOpen: () => { Swal.showLoading(); }});
        
        const payload = {
            action: 'migrate_supplier_order_to_stock',
            id_pedido_proveedor: folio,
            assignments: assignments
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const finalStatus = data.final_status || 'Ingresado a Stock';
            const isCompleted = (finalStatus === 'Ingresado a Stock');
            
            await Swal.fire({
                icon: 'success',
                title: isCompleted ? '¡Pedido Completado e Ingresado!' : '¡Ingreso Parcial Registrado!',
                text: isCompleted 
                    ? `Se sumaron ${totalReceivedInThisIngress} piezas al stock y el pedido ${folio} ha sido marcado como COMPLETADO.` 
                    : `Se sumaron ${totalReceivedInThisIngress} piezas al stock. El pedido ${folio} permanece PENDIENTE/PARCIAL por las piezas restantes.`,
                background: '#151515', color: '#fff',
                confirmButtonColor: '#10b981'
            });
            
            closeSupplierOrderDetailsModal();
            loadSupplierOrders();
            
            // Recargar catálogo de la app si está disponible
            if (window.loadCatalog) window.loadCatalog();
        } else {
            throw new Error(data.message || 'Error al migrar al stock');
        }
    } catch (err) {
        console.error("Error al migrar pedido a stock:", err);
        Swal.fire({ icon: 'error', title: 'Error de Ingesta', text: err.message || 'No se pudo actualizar el inventario.', background: '#151515', color: '#fff' });
    }
}
window.confirmSupplierStockMigration = confirmSupplierStockMigration;

// ==========================================
// MÓDULO DE INVENTARIO INDEPENDIENTE LOCAL 419
// ==========================================
let allProducts419 = [];
let isLocal419Loading = false;

async function fetchProducts419(force = false) {
    if (isLocal419Loading && !force) return;
    isLocal419Loading = true;
    
    const gridContainer = document.getElementById('local419-inventario-grid');
    if (gridContainer) {
        gridContainer.innerHTML = Array(8).fill(0).map(() => `
            <div class="bg-[#141416] rounded-2xl p-4 border border-white/5 animate-pulse flex flex-col justify-between h-[440px]">
                <div class="w-full h-56 bg-white/5 rounded-xl mb-4 relative overflow-hidden flex items-center justify-center">
                    <div class="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="space-y-3">
                    <div class="h-4 bg-white/10 rounded-md w-3/4"></div>
                    <div class="flex gap-2">
                        <div class="h-3 bg-white/5 rounded-md w-12"></div>
                        <div class="h-3 bg-white/5 rounded-md w-12"></div>
                        <div class="h-3 bg-white/5 rounded-md w-12"></div>
                    </div>
                    <div class="h-6 bg-amber-500/10 border border-amber-500/20 rounded-lg w-28"></div>
                    <div class="pt-2 flex gap-1.5">
                        <div class="w-10 h-10 bg-white/5 rounded-lg border border-white/5"></div>
                        <div class="w-10 h-10 bg-white/5 rounded-lg border border-white/5"></div>
                        <div class="w-10 h-10 bg-white/5 rounded-lg border border-white/5"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'search',
                origen: '419',
                filtros: { nombre: "", tipo: "", version: "", genero: "" }
            })
        });

        const data = await response.json();
        let productsData = [];

        if (Array.isArray(data)) {
            productsData = data;
        } else if (data && data.status === 'success') {
            productsData = data.data || data.productos || [];
        }

        allProducts419 = productsData;
        renderInventario419Grid(allProducts419);
    } catch (err) {
        console.error('Error al cargar inventario de Local 419:', err);
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="col-span-full text-center py-12 bg-[#141416] rounded-2xl border border-red-500/20 p-6">
                    <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3"></i>
                    <p class="text-gray-300 font-semibold text-base mb-4">Error al cargar existencias del Local 419.</p>
                    <button onclick="fetchProducts419(true)" class="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 text-xs">
                        <i class="fa-solid fa-rotate-right mr-2"></i> Reintentar Carga
                    </button>
                </div>
            `;
        }
    } finally {
        isLocal419Loading = false;
    }
}
window.fetchProducts419 = fetchProducts419;

function renderInventario419Grid(products) {
    const gridContainer = document.getElementById('local419-inventario-grid');
    if (!gridContainer) return;

    const searchTerm = (document.getElementById('inv419-search-input')?.value || '').toLowerCase().trim();
    const filtered = (products || []).filter(p => {
        if (!searchTerm) return true;
        const targetStr = `${p.equipo || ''} ${p.nombre || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''}`.toLowerCase();
        return targetStr.includes(searchTerm);
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 italic">No se encontraron productos registrados en el inventario del Local 419.</div>`;
        return;
    }

    gridContainer.innerHTML = filtered.map(prod => {
        const rawImg = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const imgUrl = getOptimizedImageUrl(rawImg, 400);
        const equipoNombre = (prod.nombre || prod.equipo || 'JERSEY DESCONOCIDO').toUpperCase();
        const tipo = (prod.tipo || 'DESCONOCIDO').toUpperCase();
        const version = (prod.version || 'REGULAR').toUpperCase();
        const genero = (prod.genero || 'HOMBRE').toUpperCase();
        const precio = Number(prod.precio_menudeo || prod.precio || 0);

        // Extraer arreglo de tallas del producto
        const tallasArray = Array.isArray(prod.tallas) ? prod.tallas : [];
        let sizeBoxesHtml = '';

        if (tallasArray.length > 0) {
            sizeBoxesHtml = tallasArray.map(tObj => {
                const sz = (tObj.talla || '').toUpperCase();
                const cant = Number(tObj.stock || 0);
                const hasStock = cant > 0;
                
                const boxStyle = hasStock
                    ? 'bg-[#222226] text-white border-white/10 hover:border-amber-400'
                    : 'bg-white/5 text-gray-500 border-white/5 opacity-60';

                const badgeBg = hasStock ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300';

                return `
                <div class="relative group/size cursor-pointer" onclick="editLocal419SizeStockPrompt('${prod.id}', '${sz}', ${cant})" title="Editar stock de talla ${sz}">
                    <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center font-bold text-xs ${boxStyle} transition-all shadow-sm">
                        ${sz}
                    </div>
                    <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full ${badgeBg} text-[10px] font-extrabold flex items-center justify-center shadow-md border border-dark-100">
                        ${cant}
                    </span>
                </div>`;
            }).join('');
        }

        const addTallaBtn = `
        <div class="relative cursor-pointer" onclick="addNewLocal419SizePrompt('${prod.id}', '${genero.replace(/'/g, "\\'")}')" title="Agregar Talla">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-sm font-bold transition-all shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
            </div>
        </div>`;

        return `
        <div class="bg-[#141416] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between hover:border-amber-500/40 transition-all duration-300 shadow-xl shadow-black/40 group relative">
            <div>
                <!-- Imagen con relación de aspecto estilo catálogo -->
                <div class="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-3 bg-dark-300 border border-white/5">
                    <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${equipoNombre}">
                    <div class="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent opacity-60"></div>
                </div>

                <!-- Título del Jersey -->
                <h3 class="font-bold text-white text-sm sm:text-base leading-snug uppercase mb-2 line-clamp-2 min-h-[2.5rem]">
                    ${equipoNombre}
                </h3>
                
                <!-- ID de Referencia -->
                <div class="text-[10px] text-gray-500 font-mono mb-2">ID: ${prod.id}</div>

                <!-- Insignias de detalles -->
                <div class="flex flex-wrap gap-1.5 mb-3">
                    <span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px] font-bold tracking-wider uppercase border border-white/10">${tipo}</span>
                    <span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px] font-bold tracking-wider uppercase border border-white/10">${version}</span>
                    <span class="px-2 py-0.5 rounded-md bg-blue-900/30 text-blue-400 text-[10px] font-bold tracking-wider uppercase border border-blue-500/20">${genero}</span>
                </div>

                <!-- Precio -->
                <div class="bg-dark-300/80 rounded-xl px-3 py-2 border border-white/5 flex items-center justify-between mb-3.5">
                    <span class="text-xs text-gray-400 font-medium">Precio:</span>
                    <span class="text-sm font-bold text-blue-400">$${precio.toFixed(2)}</span>
                </div>
            </div>

            <!-- Sección de Tallas y Existencias Local 419 -->
            <div class="pt-3 border-t border-white/5">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Existencias 419:</div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${sizeBoxesHtml}
                    ${addTallaBtn}
                </div>
            </div>
        </div>`;
    }).join('');
}
window.renderInventario419Grid = renderInventario419Grid;
window.renderInventario419Table = renderInventario419Grid; // Compatibilidad alias

async function updateLocal419SizeStock(id_playera, talla, nuevaCantidad) {
    const cantNum = parseInt(nuevaCantidad, 10);
    if (isNaN(cantNum) || cantNum < 0) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'update_stock_talla',
                origen: '419',
                id_playera: id_playera,
                talla: talla,
                cantidad: cantNum,
                token: localStorage.getItem('session_token') || ''
            })
        });

        const data = await response.json();
        if (data.status === 'success') {
            const prod = allProducts419.find(p => String(p.id) === String(id_playera));
            if (prod) {
                if (Array.isArray(prod.tallas)) {
                    const item = prod.tallas.find(x => String(x.talla).trim().toUpperCase() === String(talla).trim().toUpperCase());
                    if (item) item.stock = cantNum;
                    else prod.tallas.push({ talla: talla, stock: cantNum, id_inventario: '' });
                }
                if (prod.tallas_stock) {
                    prod.tallas_stock[talla] = cantNum;
                }
            }
            const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, background: '#151515', color: '#fff' });
            toast.fire({ icon: 'success', title: `Stock 419 (${talla}): ${cantNum} pzas` });
        } else {
            throw new Error(data.message || 'No se pudo actualizar el stock en Local 419');
        }
    } catch (err) {
        console.error('Error al actualizar stock 419:', err);
        Swal.fire({ icon: 'error', title: 'Error al actualizar', text: err.message, background: '#151515', color: '#fff' });
    }
}
window.updateLocal419SizeStock = updateLocal419SizeStock;

async function editLocal419SizeStockPrompt(id_playera, talla, cantActual) {
    const { value: nuevaCant } = await Swal.fire({
        title: `Editar Stock Talla ${talla} (Local 419)`,
        input: 'number',
        inputLabel: 'Ingresa la nueva cantidad en existencia:',
        inputValue: cantActual,
        inputAttributes: { min: '0', step: '1' },
        showCancelButton: true,
        confirmButtonText: 'Actualizar Stock',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#3f3f46',
        background: '#151515', color: '#fff'
    });

    if (nuevaCant !== undefined && nuevaCant !== null && nuevaCant !== "") {
        await updateLocal419SizeStock(id_playera, talla, nuevaCant);
        fetchProducts419(true);
    }
}
window.editLocal419SizeStockPrompt = editLocal419SizeStockPrompt;

async function addNewLocal419SizePrompt(id_playera, genero) {
    const listTallas = (typeof getTallasForGender === 'function') ? getTallasForGender(genero) : ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '14', '16', '18', '20', '22', '24', '26', '28'];
    const optionsHtml = listTallas.map(t => `<option value="${t}">${t}</option>`).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Agregar Talla al Local 419',
        html: `
            <div class="flex flex-col gap-3 text-left">
                <div>
                    <label class="text-xs text-gray-400 font-semibold mb-1 block">Selecciona la Talla:</label>
                    <select id="swal-talla-select" class="w-full bg-dark-100 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-400">${optionsHtml}</select>
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-semibold mb-1 block">Cantidad Inicial en Local 419:</label>
                    <input id="swal-cant-input" type="number" min="0" value="1" class="w-full bg-dark-100 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-400">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Talla',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#3f3f46',
        background: '#151515', color: '#fff',
        preConfirm: () => {
            return {
                talla: document.getElementById('swal-talla-select').value,
                cantidad: document.getElementById('swal-cant-input').value
            };
        }
    });

    if (formValues && formValues.talla) {
        await updateLocal419SizeStock(id_playera, formValues.talla, formValues.cantidad);
        fetchProducts419(true);
    }
}
window.addNewLocal419SizePrompt = addNewLocal419SizePrompt;

function openInventario419View() {
    const modal = document.getElementById('local419-inventario-modal');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    fetchProducts419();
}
window.openInventario419View = openInventario419View;

function closeInventario419View() {
    const modal = document.getElementById('local419-inventario-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    } else {
        document.body.style.overflow = '';
    }
}
window.closeInventario419View = closeInventario419View;

// Event Listeners Delegados para las Opciones de Local 419
document.addEventListener('click', (e) => {
    const posBtn = e.target.closest('.action-local419-pos');
    if (posBtn) {
        closeInventario419View();
        if (typeof switchView === 'function') switchView('jerseys-pedido');
        if (typeof closemobileMenu === 'function') closemobileMenu();
        return;
    }

    const ordenarBtn = e.target.closest('.action-local419-ordenar');
    if (ordenarBtn) {
        closeInventario419View();
        if (typeof switchView === 'function') switchView('jerseys-pedido');
        if (typeof closemobileMenu === 'function') closemobileMenu();
        return;
    }

    const misPedidosBtn = e.target.closest('.action-local419-mis-pedidos');
    if (misPedidosBtn) {
        closeInventario419View();
        if (typeof openUserOrdenesModal === 'function') openUserOrdenesModal();
        else if (typeof openOrdenesModal === 'function') openOrdenesModal();
        if (typeof closemobileMenu === 'function') closemobileMenu();
        return;
    }

    const inventarioBtn = e.target.closest('.action-local419-inventario');
    if (inventarioBtn) {
        if (typeof openInventario419View === 'function') openInventario419View();
        if (typeof closemobileMenu === 'function') closemobileMenu();
        return;
    }
});

// Event Listeners para la Vista de Inventario 419
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-local419-inventario-modal');
    if (closeBtn) {
        closeBtn.onclick = () => closeInventario419View();
    }

    const btnLocal419Menu = document.getElementById('btn-local419-menu');
    if (btnLocal419Menu) {
        btnLocal419Menu.onclick = (e) => {
            e.preventDefault();
            openInventario419View();
        };
    }

    const refreshBtn = document.getElementById('btn-refresh-inv419');
    if (refreshBtn) {
        refreshBtn.onclick = () => fetchProducts419(true);
    }

    const searchInput = document.getElementById('inv419-search-input');
    if (searchInput) {
        searchInput.oninput = () => renderInventario419Grid(allProducts419);
    }
});







