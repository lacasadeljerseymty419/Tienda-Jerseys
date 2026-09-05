const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbwQaUeO9EnLQCZe5B6juTmRYoGKm443dGYPbpHcbeFpKbvXNYm0akhYoSLc1AM_mVNZ-g/exec";

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

function normalizeText(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
window.normalizeText = normalizeText;

function matchText(fullText, query) {
    if (!query) return true;
    const normQuery = normalizeText(query);
    if (!normQuery) return true;
    const normTarget = normalizeText(fullText);
    const terms = normQuery.split(' ').filter(Boolean);
    return terms.every(term => normTarget.includes(term));
}
window.matchText = matchText;

function getFirstImage(fotoField) {
    if (!fotoField) return '';
    const parts = String(fotoField).split(',');
    return getOptimizedImageUrl(parts[0].trim());
}

function getOptimizedImageUrl(rawUrl, customWidth = null) {
    const isMobile = window.innerWidth < 640;
    const width = customWidth || (isMobile ? 300 : 400);

    if (!rawUrl || typeof rawUrl !== 'string') return `https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=${width}`;
    
    let url = rawUrl.trim();
    if (!url) return `https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=${width}`;
    
    // Si la URL contiene comas, tomar solo la primera imagen
    if (url.includes(',')) {
        url = url.split(',')[0].trim();
    }

    // Extraer ID de archivo de Google Drive / Google UserContent / Google Drive links
    let driveId = '';
    const matchId = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
        driveId = matchId[1];
        // Usar CDN oficial directa de Google Drive para máxima compatibilidad sin bloqueo CORS/referer
        return `https://lh3.googleusercontent.com/d/${driveId}=w${width}`;
    }

    // Transformación para Google UserContent (lh3.googleusercontent.com)
    if (url.includes('googleusercontent.com')) {
        const clean = url.split('=')[0];
        return `${clean}=w${width}`;
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
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}

async function get_personalizations() {
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}

async function search(filtros = { nombre: "", tipo: "", version: "", genero: "" }) {
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
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
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
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
    
    urls.forEach((url, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-dark group h-24 w-24 flex-shrink-0 shadow-md inline-block mr-2 mb-2';
        
        const loader = document.createElement('div');
        loader.className = 'absolute inset-0 flex flex-col items-center justify-center bg-dark-100/90 text-white z-10 transition-opacity duration-300 pointer-events-none';
        loader.innerHTML = `<div class="w-5 h-5 border-2 border-navy-400 border-t-transparent rounded-full animate-spin mb-1"></div><span class="text-[9px] text-gray-300 font-semibold">Cargando...</span>`;
        
        const img = document.createElement('img');
        img.src = getOptimizedImageUrl(url, 300);
        img.className = 'w-full h-full object-cover transition-opacity duration-300 opacity-0';
        img.alt = `Vista previa ${i + 1}`;
        img.onload = () => {
            img.classList.remove('opacity-0');
            loader.classList.add('opacity-0');
            setTimeout(() => { if (loader.parentNode) loader.remove(); }, 300);
        };
        img.onerror = () => {
            loader.innerHTML = `<span class="text-[9px] text-red-400 font-semibold">Error foto</span>`;
        };
        
        wrapper.appendChild(loader);
        wrapper.appendChild(img);
        container.appendChild(wrapper);
    });
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
    cartCountMobile: document.getElementById('cart-count-mobile'),
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
        tipo: document.getElementById('filter-tipo'),
        orden: document.getElementById('filter-orden'),
        precioMin: document.getElementById('filter-precio-min'),
        precioMax: document.getElementById('filter-precio-max')
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
                estatusLabel: document.getElementById('admin-ordenes-estatus-label')
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
let reglasTallaExtra = { costo: 50, tallas: ["4XL", "5XL", "6XL"] };

function getExtraSizePrice(talla) {
    if (!talla || !reglasTallaExtra || !Array.isArray(reglasTallaExtra.tallas)) return 0;
    const normTalla = String(talla).trim().toUpperCase();
    const isExtra = reglasTallaExtra.tallas.some(t => {
        const norm = String(t).trim().toUpperCase();
        return norm === normTalla || norm.replace(/[\s_-]/g, '') === normTalla.replace(/[\s_-]/g, '');
    });
    return isExtra ? (Number(reglasTallaExtra.costo) || 50) : 0;
}
const defaultPersonalizaciones = [
    { id: "PERS-001", nombre: "Pers 22 Cm", precio_Menudeo: 70, precio_mayoreo: 100 },
    { id: "PERS-002", nombre: "Pers 26.5 Cm", precio_Menudeo: 85, precio_mayoreo: 120 },
    { id: "PERS-003", nombre: "Pers 26.5 Cm y 10 Cm (Atras y Adelante)", precio_Menudeo: 95, precio_mayoreo: 130 },
    { id: "PERS-004", nombre: "Personalizacion Oficial (Atras y Adelante)", precio_Menudeo: 125, precio_mayoreo: 150 }
];
let currentJerseyForPedido = null; // Jersey activo para configurar en el modal

function getGenderColorClass(genero) {
    const gen = String(genero || '').toLowerCase();
    if (gen.includes('hombre') || gen.includes('caballero') || gen === 'h') {
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    } else if (gen.includes('niño') || gen.includes('nino') || gen.includes('niña') || gen.includes('nina') || gen.includes('infantil') || gen.includes('kid') || gen.includes('unisex')) {
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else if (gen.includes('mujer') || gen.includes('dama') || gen === 'm' || gen === 'd') {
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

function isLoggedUserVip() {
    try {
        const loggedUserStr = localStorage.getItem('logged_user');
        if (loggedUserStr) {
            const loggedUser = JSON.parse(loggedUserStr);
            const vipVal = loggedUser ? (loggedUser.vip !== undefined ? loggedUser.vip : (loggedUser.VIP !== undefined ? loggedUser.VIP : null)) : null;
            if (vipVal !== null && vipVal !== undefined) {
                const str = String(vipVal).toLowerCase().trim();
                return str === "1" || str === "1.0" || str === "si" || str === "sí" || str === "true" || Number(vipVal) === 1;
            }
        }
    } catch (e) {}
    return false;
}

function esPerfilSuperMayoreo(profile) {
    const isSuperMayoreoActivoGlobal = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    if (!isSuperMayoreoActivoGlobal) return false;

    // Requiere que el cliente sea VIP = 1
    if (!isLoggedUserVip()) return false;

    // Si el usuario tiene super_mayoreo_activo = 1 en sus datos cargados
    try {
        const loggedUserStr = localStorage.getItem('logged_user');
        if (loggedUserStr) {
            const loggedUser = JSON.parse(loggedUserStr);
            if (loggedUser && (loggedUser.perfil === "Administrador" || loggedUser.usuario === "admin")) return false;
            const clientSuperActivoCol = (loggedUser.super_mayoreo_activo !== undefined && loggedUser.super_mayoreo_activo !== null && loggedUser.super_mayoreo_activo !== "") ? Number(loggedUser.super_mayoreo_activo) : 0;
            if (clientSuperActivoCol === 1) return true;
        }
    } catch (e) {}

    // O que su perfil asignado sea "Súper Mayoreo"
    const p = profile || localStorage.getItem('current_perfil');
    if (!p) return false;
    const norm = String(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
    
    const loggedUserStr = localStorage.getItem('logged_user');
    let loggedUser = null;
    try { if (loggedUserStr) loggedUser = JSON.parse(loggedUserStr); } catch (e) {}
    const isAdminUser = loggedUser && (loggedUser.perfil === "Administrador" || loggedUser.usuario === "admin");
    
    let activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    if (isAdminUser) {
        activeProfile = "Administrador";
    } else if (!isSuperMayoreoActivo) {
        activeProfile = "Mayoreo";
        localStorage.setItem('current_perfil', 'Mayoreo');
    }
    
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
    if (loggedUser) {
        updateUserLogoInitial(loggedUser.nombre_completo || loggedUser.usuario || 'Usuario', loggedUser.foto);
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

    // Actualizar insignias de tipo de perfil en nav desktop y menú móvil
    const isSuperMayoreoActivoGlobal = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    let userPerfil = loggedUser.perfil || 'Cliente';
    const isAdminUser = userPerfil === 'Administrador' || loggedUser.usuario === 'admin';

    if (!isAdminUser && !isSuperMayoreoActivoGlobal) {
        userPerfil = 'Mayoreo';
        loggedUser.perfil = 'Mayoreo';
        loggedUser.super_mayoreo_exp = '';
        loggedUser.super_mayoreo_acum = '';
        loggedUser.super_mayoreo_activo = 0;
        localStorage.setItem('logged_user', JSON.stringify(loggedUser));
        localStorage.setItem('current_perfil', 'Mayoreo');
    }

    const profileTag = document.getElementById('nav-user-profile-badge');
    const mobileProfileTag = document.getElementById('mobile-nav-user-profile-badge');
    
    let perfilStyleClass = 'bg-navy-500/20 text-navy-300 border-navy-500/30';
    if (userPerfil === 'Administrador') {
        perfilStyleClass = 'bg-red-500/20 text-red-400 border-red-500/30';
    } else if (typeof esPerfilSuperMayoreo === 'function' && esPerfilSuperMayoreo(userPerfil)) {
        perfilStyleClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
    } else if (userPerfil === 'Mayoreo') {
        perfilStyleClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    } else if (userPerfil === 'Menudeo') {
        perfilStyleClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    
    if (profileTag) {
        profileTag.textContent = userPerfil;
        profileTag.className = `px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${perfilStyleClass}`;
    }
    if (mobileProfileTag) {
        mobileProfileTag.textContent = userPerfil;
        mobileProfileTag.className = `px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${perfilStyleClass} w-max mt-0.5`;
    }

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
        
        // Mantener visibles botones de acción principal
        if (DOM.actions && DOM.actions.navJerseysView) DOM.actions.navJerseysView.forEach(btn => btn.classList.remove('hidden'));
        if (DOM.actions && DOM.actions.navMisPedidosView) DOM.actions.navMisPedidosView.forEach(btn => btn.classList.remove('hidden'));

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
                if (window.filteredProducts && window.filteredProducts.length > 0) {
                    renderProducts(window.filteredProducts);
                }
                
                // Mostrar alerta informativa según reglas
                if (typeof mostrarAlertaSegunReglasSuperMayoreo === 'function') {
                    mostrarAlertaSegunReglasSuperMayoreo(user);
                }
            }
        }).catch(err => console.warn("Error al refrescar perfil en segundo plano:", err));
    }

    // Cargar caché local al instante (<1ms) para renderizado inmediato
    try {
        const cachedStr = localStorage.getItem('jerseys_products_cache_v5');
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && Array.isArray(cachedObj.data) && cachedObj.data.length > 0) {
                allProducts = cachedObj.data;
                renderProductsWithFilters();
            }
        }
    } catch(e) {}

    if (!allProducts || allProducts.length === 0) {
        renderSkeletons(6);
    }
    
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
            if (typeof openPos419Modal === 'function') openPos419Modal();
            closemobileMenu();
        }));
    }
    if (DOM.local419 && DOM.local419.actionsOrdenar) {
        DOM.local419.actionsOrdenar.forEach(btn => btn.addEventListener('click', () => {
            if (typeof closeInventario419View === 'function') closeInventario419View();
            if (typeof closePos419Modal === 'function') closePos419Modal();
            if (typeof switchView === 'function') switchView('jerseys-pedido');
            if (typeof closemobileMenu === 'function') closemobileMenu();
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

    // 📱 Soporte táctil directo para iPad/Tablets/Celulares en menús desplegables
    const btnLocal419 = document.getElementById('btn-local419-menu');
    const btnAdminMenu = document.getElementById('btn-admin-menu');

    function closeAllHeaderDropdowns() {
        document.querySelectorAll('#local419-menu-wrapper > div, #admin-menu-wrapper > div').forEach(dd => {
            if (dd.classList.contains('absolute')) {
                dd.classList.add('opacity-0', 'invisible', 'translate-y-2');
                dd.classList.remove('opacity-100', 'visible', 'translate-y-0');
            }
        });
    }

    function toggleHeaderDropdown(menuBtn) {
        if (!menuBtn) return;
        const wrapper = menuBtn.closest('.relative');
        if (!wrapper) return;
        const dropdown = wrapper.querySelector('.absolute');
        if (!dropdown) return;
        
        const isCurrentlyVisible = dropdown.classList.contains('opacity-100') || !dropdown.classList.contains('opacity-0');
        closeAllHeaderDropdowns();

        if (!isCurrentlyVisible) {
            dropdown.classList.remove('opacity-0', 'invisible', 'translate-y-2');
            dropdown.classList.add('opacity-100', 'visible', 'translate-y-0');
        }
    }

    if (btnLocal419) {
        btnLocal419.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHeaderDropdown(btnLocal419);
        });
    }

    if (btnAdminMenu) {
        btnAdminMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHeaderDropdown(btnAdminMenu);
        });
    }

    document.addEventListener('click', () => closeAllHeaderDropdowns());

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

    // Búsqueda automática al cambiar cualquier select o input de precio
    if (DOM.filters.version) DOM.filters.version.addEventListener('change', handleLocalSearch);
    if (DOM.filters.tipo) DOM.filters.tipo.addEventListener('change', handleLocalSearch);
    if (DOM.filters.genero) DOM.filters.genero.addEventListener('change', handleLocalSearch);
    if (DOM.filters.orden) DOM.filters.orden.addEventListener('change', handleLocalSearch);
    if (DOM.filters.precioMin) DOM.filters.precioMin.addEventListener('input', handleLocalSearch);
    if (DOM.filters.precioMax) DOM.filters.precioMax.addEventListener('input', handleLocalSearch);

    // Event listeners para botones rápidos de rango de precio
    const pricePresetBtns = document.querySelectorAll('.price-preset-btn');
    pricePresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            pricePresetBtns.forEach(b => {
                b.classList.remove('active', 'bg-navy-500/40', 'text-navy-300', 'border-navy-400/50', 'font-bold');
                b.classList.add('bg-dark-200/60', 'text-gray-400', 'border-white/10', 'font-semibold');
            });
            btn.classList.add('active', 'bg-navy-500/40', 'text-navy-300', 'border-navy-400/50', 'font-bold');
            btn.classList.remove('bg-dark-200/60', 'text-gray-400', 'border-white/10', 'font-semibold');

            const minVal = btn.getAttribute('data-min') || '';
            const maxVal = btn.getAttribute('data-max') || '';

            if (DOM.filters.precioMin) DOM.filters.precioMin.value = minVal;
            if (DOM.filters.precioMax) DOM.filters.precioMax.value = maxVal;

            handleLocalSearch();
        });
    });
    
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
            refreshCreateTallasOptions();
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
            
            DOM.admin.createFotoFileInfo.textContent = `⏳ Subiendo ${files.length} imagen(es) al servidor...`;
            DOM.admin.createFotoFileInfo.className = 'text-xs text-amber-400 font-bold animate-pulse';
            
            DOM.admin.fotoPreviewContainer.classList.remove('hidden');
            DOM.admin.fotoPreviewContainer.innerHTML = `
                <div class="col-span-4 flex flex-col items-center justify-center p-6 bg-dark-200/80 rounded-2xl border border-navy-500/40 text-center w-full shadow-2xl">
                    <div class="relative mb-3">
                        <div class="w-10 h-10 border-4 border-navy-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <span class="text-sm font-bold text-white mb-1">Subiendo imagen al servidor de Google Drive...</span>
                    <span class="text-xs text-amber-400 font-semibold animate-pulse">Por favor espera un momento, procesando archivo</span>
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
                DOM.admin.createFotoFileInfo.textContent = `✓ ${urls.length} imagen(es) subida(s) con éxito`;
                DOM.admin.createFotoFileInfo.className = 'text-xs text-green-400 font-semibold';
                renderImagePreviews(DOM.admin.fotoPreviewContainer, urls);
            } else {
                DOM.admin.fotoInput.value = '';
                DOM.admin.createFotoFileInfo.textContent = 'Error al subir imagen';
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
            
            DOM.admin.updateFotoFileInfo.textContent = `⏳ Subiendo ${files.length} imagen(es)...`;
            DOM.admin.updateFotoFileInfo.className = 'text-xs text-amber-400 font-bold animate-pulse';

            if (DOM.admin.invImg) {
                DOM.admin.invImg.classList.add('opacity-40');
            }
            if (DOM.admin.updateFotoPreviewContainer) {
                DOM.admin.updateFotoPreviewContainer.classList.remove('hidden');
                DOM.admin.updateFotoPreviewContainer.innerHTML = `
                    <div class="col-span-4 flex flex-col items-center justify-center p-5 bg-dark-200/80 rounded-2xl border border-navy-500/40 text-center w-full shadow-2xl">
                        <div class="w-8 h-8 border-3 border-navy-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span class="text-xs font-bold text-white mb-0.5">Subiendo nueva imagen a Google Drive...</span>
                        <span class="text-[10px] text-amber-400 font-semibold animate-pulse">Por favor espera</span>
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
    DOM.modal.overlay.style.zIndex = '99999';
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
window.openModal = openModal;

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
window.closeModal = closeModal;

async function loadCatalogs() {
    let configs = null;
    let pers = null;
    const CACHE_KEY = 'jerseys_configs_v19';
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
        let reglas_mayoreo_super = candidate.reglas_mayoreo_super || null;
        if (!reglas_mayoreo_super && candidate.Piezas_Jugador_Mayoreo_Super !== undefined) {
            reglas_mayoreo_super = { piezas_jugador: Number(candidate.Piezas_Jugador_Mayoreo_Super) || 10, piezas_fan: 15, activo: 1 };
        }
        const reglas_talla_extra = candidate.reglas_talla_extra || null;
        let cierre_pedidos = candidate.CierrePedidos || candidate.cierre_pedidos || candidate.cierrePedidos || candidate.Cierre || candidate.cierre || "10:30";
        if (typeof candidate === 'object') {
            Object.keys(candidate).forEach(k => {
                if (k.toLowerCase().replace(/_/g, '') === 'cierrepedidos' || k.toLowerCase() === 'cierre') {
                    if (candidate[k]) cierre_pedidos = String(candidate[k]).trim();
                }
            });
        }

        const estatus_ordenes = candidate.estatus_ordenes || candidate.estatus_Ordenes || candidate.estatus || null;
        const tallas_hombre = candidate.tallas_hombre || [];
        const tallas_dama = candidate.tallas_dama || [];
        const tallas_nino = candidate.tallas_nino || [];
        const reglas_envio = candidate.reglas_envio || [];
        
        if (Array.isArray(tipos) && Array.isArray(versiones) && Array.isArray(generos)) {
            return { tipos, versiones, generos, perfiles, categorias, personalizaciones, reglas_mayoreo_super, reglas_talla_extra, estatus_ordenes, reglas_envio, tallas_hombre, tallas_dama, tallas_nino, cierre_pedidos };
        }
        return null;
    };
    
    const validData = getValidData(configs);
    if (validData) {
        if (validData.reglas_mayoreo_super) reglasMayoreoSuper = validData.reglas_mayoreo_super;
        if (validData.reglas_talla_extra) reglasTallaExtra = validData.reglas_talla_extra;
        if (validData.reglas_envio) reglasEnvio = validData.reglas_envio;
        if (validData.cierre_pedidos) window.cierrePedidos = validData.cierre_pedidos;
        populateSelects(validData);
    } else {
        console.error("No se pudieron cargar las configuraciones de los filtros desde la API ni del caché local.");
    }
}

window.cierrePedidos = "10:30";

function getEstimadoRecojoInfo(customCierre = null) {
    const cierreStr = customCierre || window.cierrePedidos || "10:30";
    let cleanStr = String(cierreStr).trim();
    if (cleanStr.includes('T')) {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
            const h = d.getHours().toString().padStart(2, '0');
            const m = d.getMinutes().toString().padStart(2, '0');
            cleanStr = `${h}:${m}`;
        }
    }

    const partes = cleanStr.split(':');
    const horaCierre = parseInt(partes[0]) || 10;
    const minutoCierre = parseInt(partes[1]) || 30;

    const ahora = new Date();
    const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
    const minutosCierre = horaCierre * 60 + minutoCierre;

    const esMismoDia = minutosActuales <= minutosCierre;

    const fechaMeta = new Date(ahora);
    if (!esMismoDia) {
        fechaMeta.setDate(fechaMeta.getDate() + 1);
    }

    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let fechaFormateada = fechaMeta.toLocaleDateString('es-MX', opcionesFecha);
    fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

    const hora12 = (horaCierre % 12) || 12;
    const ampm = horaCierre >= 12 ? 'PM' : 'AM';
    const horaCierreNice = `${hora12}:${minutoCierre.toString().padStart(2, '0')} ${ampm}`;

    if (esMismoDia) {
        return {
            esMismoDia: true,
            fechaFormateada: fechaFormateada,
            horaCierreNice: horaCierreNice,
            mensajeHtml: `📍 <strong>Estimado cliente:</strong> Al realizar tu pedido antes de las <strong>${horaCierreNice}</strong>, tu pedido estará listo para recoger <strong class="text-emerald-400">HOY (${fechaFormateada})</strong> en tienda.`,
            mensajeWa: `📍 *Aviso de Recojo:* Al realizar tu pedido antes de las ${horaCierreNice}, estará listo para recoger *HOY (${fechaFormateada})* en tienda.`
        };
    } else {
        return {
            esMismoDia: false,
            fechaFormateada: fechaFormateada,
            horaCierreNice: horaCierreNice,
            mensajeHtml: `📍 <strong>Estimado cliente:</strong> Al realizar tu pedido después de las <strong>${horaCierreNice}</strong>, tu pedido estará listo para recoger <strong class="text-amber-400">MAÑANA (${fechaFormateada})</strong> en tienda.`,
            mensajeWa: `📍 *Aviso de Recojo:* Al realizar tu pedido después de las ${horaCierreNice}, estará listo para recoger *MAÑANA (${fechaFormateada})* en tienda.`
        };
    }
}
window.getEstimadoRecojoInfo = getEstimadoRecojoInfo;
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
            
            // Al hacer login exitoso, reiniciamos la marca de tiempo de inactividad
            updateLastActivity();
            updateBrandTextColor();
            
            // 🚀 Cerrar modal de login INMEDIATAMENTE (Sensación de acceso instantáneo <200ms)
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
            
            updateUserLoginUI(res.data);
            applyProfileView();

            // 🌟 Alertas de Súper Mayoreo según Reglas Maestras
            mostrarAlertaSegunReglasSuperMayoreo(res.data);
            
            // 🔄 Recargar configuraciones e inventarios frescos en SEGUNDO PLANO (sin congelar la pantalla)
            Promise.all([
                loadCatalogs(),
                fetchInitialProducts(true)
            ]).catch(err => console.warn("Revalidación de inventario en segundo plano:", err));
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
        console.error("Error en login:", err);
        Swal.fire({
            title: 'Error de Conexión',
            text: 'No se pudo conectar con el servidor. Intenta de nuevo.',
            icon: 'error',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#1d4ed8'
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function mostrarAlertaSegunReglasSuperMayoreo(userData) {
    if (!userData || userData.perfil === "Administrador" || userData.usuario === "admin") return;
    const userNameText = userData.nombre_completo || userData.usuario || 'Usuario';
    
    // Evaluaciones ultra-robustas
    const isSuperActivoGlobal = (reglasMayoreoSuper && reglasMayoreoSuper.activo !== undefined && reglasMayoreoSuper.activo !== null) ? (Number(reglasMayoreoSuper.activo) === 1 || String(reglasMayoreoSuper.activo) === "1" || String(reglasMayoreoSuper.activo).toLowerCase() === "true") : true;
    const clientSuperActivoCol = (userData.super_mayoreo_activo !== undefined && userData.super_mayoreo_activo !== null && userData.super_mayoreo_activo !== "") ? Number(userData.super_mayoreo_activo) : 0;
    
    const vipRaw = userData.vip !== undefined ? userData.vip : (userData.VIP !== undefined ? userData.VIP : (userData.es_vip !== undefined ? userData.es_vip : (userData.is_vip !== undefined ? userData.is_vip : null)));
    const vipVal = String(vipRaw !== null && vipRaw !== undefined ? vipRaw : "").toLowerCase().trim();
    const isVipUser = (
        vipVal === "1" || vipVal === "1.0" || vipVal === "si" || vipVal === "sí" || vipVal === "true" || vipVal === "vip" || vipVal === "v" || vipVal === "x" || 
        Number(vipRaw) === 1 || vipRaw === true || clientSuperActivoCol === 1 || esPerfilSuperMayoreo(userData.perfil)
    );
    
    console.log("🌟 [Súper Mayoreo Login Check]", {
        usuario: userData.usuario,
        vipRaw: userData.vip,
        isVipUser: isVipUser,
        clientSuperActivoCol: clientSuperActivoCol,
        perfil: userData.perfil,
        isSuperActivoGlobal: isSuperActivoGlobal
    });
    
    const hasValidExp = Boolean(userData.super_mayoreo_exp && String(userData.super_mayoreo_exp).trim() !== "" && String(userData.super_mayoreo_exp).trim() !== "null");
    const metaLimit = Number(userData.meta_piezas || reglasMayoreoSuper.piezas_jugador || 100);

    let fechaVigenciaStr = '';
    if (hasValidExp) {
        try {
            const d = new Date(userData.super_mayoreo_exp);
            if (!isNaN(d.getTime())) {
                fechaVigenciaStr = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        } catch (e) {}
    }

    // 🟡 Escenario A: VIP = 1 pero SuperMayoreoActivo (Configuraciones) = 0 -> Tienda deshabilitada globalmente (Silencioso sin notificación)
    if (isVipUser && !isSuperActivoGlobal) {
        return;
    }

    // 🟢 Escenario B: VIP = 1, Global = 1, Cliente SuperMayoreoActivo = 1 Y con Fecha de Expiración Válida -> Notificar perfil asignado
    if (isSuperActivoGlobal && isVipUser && clientSuperActivoCol === 1 && hasValidExp) {
        localStorage.setItem('current_perfil', 'Súper Mayoreo');
        const acum = Number(userData.super_mayoreo_acum || 0);
        const faltan = Math.max(0, metaLimit - acum);
        
        let displayFecha = fechaVigenciaStr;
        if (!displayFecha) {
            const dCalc = new Date();
            dCalc.setDate(dCalc.getDate() + 6);
            displayFecha = dCalc.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        
        let requirementHtml = '';
        if (faltan > 0) {
            requirementHtml = `🔁 <strong>Para renovar tu precio:</strong> Llevas acumuladas <strong class="text-emerald-400">${acum}</strong> playeras versión Jugador en tu ciclo actual. Te faltan <strong class="text-amber-400 font-mono">${faltan}</strong> playeras más antes de la fecha de vencimiento para extender tus beneficios por otros 6 días.`;
        } else {
            requirementHtml = `✨ <strong>¡Meta de renovación cumplida!</strong> Llevas acumuladas <strong class="text-emerald-400">${acum}</strong> playeras. Ya tienes asegurada la renovación de tu beneficio por otros 6 días.`;
        }
        
        Swal.fire({
            icon: 'info',
            title: `🌟 ¡Bienvenido a Súper Mayoreo, ${userNameText}!`,
            html: `
                <div class="text-left space-y-2.5 text-xs text-gray-300">
                    <p>Tienes asignado el perfil de <strong class="text-amber-400 font-bold">Súper Mayoreo</strong> con precios preferenciales exclusivos en toda la tienda.</p>
                    <p>📅 <strong>Fecha de Caducidad / Vencimiento:</strong> <span class="text-white font-mono underline font-bold">${displayFecha}</span></p>
                    <p>${requirementHtml}</p>
                </div>
            `,
            background: '#151515', color: '#ffffff', confirmButtonColor: '#d97706', confirmButtonText: '¡Excelente!'
        });
        return;
    }

    // 🌟 Escenario C: VIP = 1, Global = 1, Cliente SuperMayoreoActivo = 0 -> Notificar que tiene disponible la opción de activar el modo súper mayoreo
    if (isSuperActivoGlobal && isVipUser && clientSuperActivoCol === 0) {
        Swal.fire({
            icon: 'info',
            title: `🌟 ¡Bienvenido VIP, ${userNameText}!`,
            html: `
                <div class="text-left space-y-3 text-xs text-gray-300">
                    <p>Cuentas con beneficio de cliente <strong class="text-amber-400 font-bold">VIP</strong> y tienes disponible la opción de activar el <strong class="text-amber-400 font-bold">Modo Súper Mayoreo</strong>.</p>
                    <div class="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-1.5 text-amber-200">
                        <p class="font-bold text-amber-400 flex items-center gap-1"><span>🎯 ¿Qué necesitas para activarlo?</span></p>
                        <p>Realizar una compra igual o mayor a <strong class="text-white font-mono text-sm font-extrabold">${metaLimit} playeras versión Jugador</strong>.</p>
                    </div>
                    <div class="bg-dark-200/50 p-3 rounded-xl space-y-1.5 border border-white/10">
                        <p class="font-bold text-white flex items-center gap-1"><span>🚀 ¿Cómo funciona?</span></p>
                        <p>Al pasar tu orden a estatus <strong class="text-emerald-400">Disponible o Enviado</strong>, tu perfil cambiará automáticamente a <strong class="text-amber-400 font-bold">Súper Mayoreo por 6 días</strong>, permitiéndote acceder a precios preferenciales exclusivos en todas tus compras y renovar la vigencia acumulando nuevas playeras.</p>
                    </div>
                </div>
            `,
            background: '#151515', color: '#ffffff', confirmButtonColor: '#d97706', confirmButtonText: '¡Entendido!'
        });
        return;
    } else if (isVipUser && (userData.es_beneficio_perdido || userData.beneficio_perdido)) {
        // 🔴 Regla Escenario 4 (Fase C): Expiró sin cumplir la meta -> Notificar pérdida
        Swal.fire({
            icon: 'warning',
            title: `⏰ Beneficio Expirado`,
            html: `
                <div class="text-left space-y-2 text-xs text-gray-300">
                    <p>Hola <strong class="text-white">${userNameText}</strong>, la vigencia de tu perfil de Súper Mayoreo ha expirado por no haber alcanzado la meta acumulada en el ciclo.</p>
                    <p>✨ Como cliente <strong class="text-amber-400">VIP</strong>, puedes volver a desbloquear 6 días de Súper Mayoreo realizando un nuevo pedido de <strong class="text-white font-mono">${metaLimit}</strong> o más playeras versión Jugador.</p>
                </div>
            `,
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#d97706',
            confirmButtonText: 'Entendido'
        });
    } else if (userData.perfil !== "Administrador") {
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
}

function updateAdminMenuVisibility() {
    const loggedUserStr = localStorage.getItem('logged_user');
    let isAdmin = false;
    if (loggedUserStr) {
        try {
            const loggedUser = JSON.parse(loggedUserStr);
            isAdmin = (loggedUser.perfil === 'Administrador' || loggedUser.usuario === 'admin');
        } catch (e) {}
    }

    const adminMenuWrapper = document.getElementById('admin-menu-wrapper');
    const local419MenuWrapper = document.getElementById('local419-menu-wrapper');
    const btnAdminOrdersNav = document.getElementById('btn-admin-orders-nav');

    if (adminMenuWrapper) {
        if (isAdmin) {
            adminMenuWrapper.classList.remove('hidden');
        } else {
            adminMenuWrapper.classList.add('hidden');
        }
    }
    if (local419MenuWrapper) {
        if (isAdmin) {
            local419MenuWrapper.classList.remove('hidden');
        } else {
            local419MenuWrapper.classList.add('hidden');
        }
    }
    if (btnAdminOrdersNav) {
        if (isAdmin) {
            btnAdminOrdersNav.classList.remove('hidden');
            btnAdminOrdersNav.classList.add('2xl:flex');
        } else {
            btnAdminOrdersNav.classList.add('hidden');
            btnAdminOrdersNav.classList.remove('2xl:flex');
        }
    }
}
window.updateAdminMenuVisibility = updateAdminMenuVisibility;

function applyProfileView() {
    // Actualizar visibilidad de elementos exclusivos de Administrador
    updateAdminMenuVisibility();

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
    const term = DOM.admin.filterSearch ? DOM.admin.filterSearch.value : '';
    const tipo = DOM.admin.filterTipo.value;
    const version = DOM.admin.filterVersion.value;
    const genero = DOM.admin.filterGenero.value;
    const activoSel = DOM.admin.filterActivo ? DOM.admin.filterActivo.value : "all";
    
    adminFilteredProducts = allProducts.filter(p => {
        const isActivoVal = (p.activo === undefined || p.activo === null || p.activo === "" || Number(p.activo) === 1) ? 1 : 0;
        const matchActivo = (activoSel === "all") || (isActivoVal === Number(activoSel));
        const targetText = `${p.nombre || ''} ${p.equipo || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''}`;
        const matchName = !term || matchText(targetText, term);
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

function getTallasForGender(genero) {
    const g = String(genero || '').trim().toLowerCase();

    if (g.includes('dama') || g.includes('mujer') || g.includes('women') || g.includes('lady') || g.includes('female')) {
        return (typeof configTallasDama !== 'undefined' && configTallasDama && configTallasDama.length > 0)
            ? configTallasDama
            : ['XS', 'S', 'M', 'L', 'XL', '2XL'];
    }

    if (g.includes('niño') || g.includes('nino') || g.includes('infantil') || g.includes('kid') || g.includes('joven') || g.includes('boy') || g.includes('girl')) {
        return (typeof configTallasNino !== 'undefined' && configTallasNino && configTallasNino.length > 0)
            ? configTallasNino
            : ['14', '16', '18', '20', '22', '24', '26', '28'];
    }

    // Default: Hombre / Adultos / Unisex / Jugador
    return (typeof configTallasHombre !== 'undefined' && configTallasHombre && configTallasHombre.length > 0)
        ? configTallasHombre
        : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
}
window.getTallasForGender = getTallasForGender;

function extractBaseSizeToken(raw) {
    if (!raw) return '';
    let s = String(raw).trim().toUpperCase();
    if (s.includes('(')) {
        s = s.split('(')[0].trim();
    }
    s = s.split(/\s+/)[0].trim();
    return s;
}
window.extractBaseSizeToken = extractBaseSizeToken;

function isSameTalla(tallaA, tallaB) {
    if (!tallaA || !tallaB) return false;
    const strA = String(tallaA).trim().toUpperCase();
    const strB = String(tallaB).trim().toUpperCase();
    if (strA === strB) return true;
    
    const cleanA = strA.replace(/[\s\-_()]/g, '');
    const cleanB = strB.replace(/[\s\-_()]/g, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;

    const tokenA = extractBaseSizeToken(strA);
    const tokenB = extractBaseSizeToken(strB);
    if (tokenA && tokenB && tokenA === tokenB) return true;

    return false;
}
window.isSameTalla = isSameTalla;

function updateNewTallaSelect(producto) {
    if (DOM.admin && DOM.admin.newTallaVal && producto) {
        const tallas = getTallasForGender(producto.genero);
        const existentes = producto.tallas || [];
        const disponibles = tallas.filter(t => {
            const yaExiste = existentes.some(ex => isSameTalla(ex.talla, t));
            return !yaExiste;
        });
        
        if (disponibles.length === 0) {
            DOM.admin.newTallaVal.innerHTML = '<option value="" disabled selected>Todas las tallas agregadas</option>';
        } else {
            DOM.admin.newTallaVal.innerHTML = '<option value="" disabled selected>Elige talla...</option>' + 
                disponibles.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    }
}

function openInventoryModal(producto) {
    currentJerseyToManage = producto;
    if (currentJerseyToManage && Array.isArray(currentJerseyToManage.tallas)) {
        currentJerseyToManage.tallas.forEach(t => {
            if (t.stockOriginal === undefined) {
                t.stockOriginal = t.stock !== undefined ? t.stock : (t.inventario || 0);
            }
        });
    }
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

function removeInventorySizeFromMemory(idx) {
    if (!currentJerseyToManage || !currentJerseyToManage.tallas) return;
    currentJerseyToManage.tallas.splice(idx, 1);
    renderInventorySizes(currentJerseyToManage);
    updateNewTallaSelect(currentJerseyToManage);
}
window.removeInventorySizeFromMemory = removeInventorySizeFromMemory;

function renderInventorySizes(producto) {
    DOM.admin.invTallasList.innerHTML = '';
    
    if (!producto.tallas || producto.tallas.length === 0) {
        DOM.admin.invTallasList.innerHTML = '<p class="text-xs text-gray-500 py-2">No hay tallas registradas.</p>';
        return;
    }
    
    producto.tallas.forEach((t, idx) => {
        const stockActual = t.stock !== undefined ? t.stock : (t.inventario || 0);
        const stockOriginal = t.stockOriginal !== undefined ? t.stockOriginal : stockActual;
        const isNewTag = t.isNew || (t.id_inventario && String(t.id_inventario).startsWith('TEMP_'));
        const displayTalla = String(t.talla || '');
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 bg-dark-200/20 p-2.5 rounded-xl border border-white/5';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-10 bg-dark-200/50 border border-white/5 rounded-lg flex items-center justify-center font-bold text-white text-sm relative">
                    ${displayTalla}
                    ${isNewTag ? '<span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[7px] font-extrabold px-1 rounded-full shadow">NUEVA</span>' : ''}
                </div>
                <div>
                    <div class="text-xs text-gray-200 font-semibold">${producto.nombre || ''}</div>
                    <div class="text-[10px] text-gray-500 flex items-center gap-1.5">
                        <span>Categoría: ${t.categoria || producto.genero || 'Adultos'}</span>
                        ${!isNewTag ? `<span class="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5" title="Cantidad antes de modificar">(Anterior: ${stockOriginal})</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                    <label class="text-[11px] text-gray-400 font-medium uppercase tracking-wider mr-1">Stock:</label>
                    <button type="button" class="btn-stock-minus-gen w-7 h-7 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/30 flex items-center justify-center font-bold text-sm transition-all" data-idx="${idx}" title="Restar 1 pieza">-</button>
                    <input type="number" min="0" value="${stockActual}" class="w-16 bg-dark-200/80 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white font-semibold input-stock-local-val" data-idx="${idx}">
                    <button type="button" class="btn-stock-plus-gen w-7 h-7 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/30 flex items-center justify-center font-bold text-sm transition-all" data-idx="${idx}" title="Sumar 1 pieza">+</button>
                </div>
                <button type="button" onclick="window.removeInventorySizeFromMemory(${idx})" class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors" title="Eliminar talla">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        DOM.admin.invTallasList.appendChild(div);
    });
    
    // Escuchar cambios locales en las cantidades de existencias (input directo)
    document.querySelectorAll('.input-stock-local-val').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            const val = parseInt(e.target.value);
            if (!isNaN(idx) && currentJerseyToManage && currentJerseyToManage.tallas && currentJerseyToManage.tallas[idx]) {
                currentJerseyToManage.tallas[idx].stock = isNaN(val) || val < 0 ? 0 : val;
            }
        });
    });

    // Botones + y - para Inventario General
    document.querySelectorAll('.btn-stock-minus-gen').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const containerEl = DOM.admin.invTallasList;
            const input = containerEl.querySelector(`.input-stock-local-val[data-idx="${idx}"]`);
            if (input) {
                let currentVal = parseInt(input.value) || 0;
                let newVal = Math.max(0, currentVal - 1);
                input.value = newVal;
                if (currentJerseyToManage && currentJerseyToManage.tallas && currentJerseyToManage.tallas[idx]) {
                    currentJerseyToManage.tallas[idx].stock = newVal;
                }
            }
        });
    });

    document.querySelectorAll('.btn-stock-plus-gen').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const containerEl = DOM.admin.invTallasList;
            const input = containerEl.querySelector(`.input-stock-local-val[data-idx="${idx}"]`);
            if (input) {
                let currentVal = parseInt(input.value) || 0;
                let newVal = currentVal + 1;
                input.value = newVal;
                if (currentJerseyToManage && currentJerseyToManage.tallas && currentJerseyToManage.tallas[idx]) {
                    currentJerseyToManage.tallas[idx].stock = newVal;
                }
            }
        });
    });
}

function handleAddNewTalla(e) {
    e.preventDefault();
    if (!currentJerseyToManage) return;
    
    const tallaVal = DOM.admin.newTallaVal && DOM.admin.newTallaVal.value ? String(DOM.admin.newTallaVal.value).trim() : '';
    const stockVal = parseInt(DOM.admin.newStockVal.value);
    
    if (!tallaVal) return;
    const finalStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;

    // Validar duplicados (máximo de 2 veces la misma talla)
    const existingCount = (currentJerseyToManage.tallas || []).filter(t => String(t.talla || '').trim().toUpperCase() === tallaVal.toUpperCase()).length;
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

    // Notificación informativa sin bloqueo de pantalla en celulares
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2500,
        background: '#141416',
        color: '#fff',
        heightAuto: false,
        customClass: {
            container: 'swal2-toast-no-lock'
        }
    });
    Toast.fire({
        icon: 'info',
        title: `Talla ${tallaVal} agregada. Presiona "Actualizar Datos" para guardar.`
    });
}

function addAllStandardTallas() {
    if (!currentJerseyToManage) return;

    const genero = currentJerseyToManage.genero || 'Hombre';
    const tallasGenericas = getTallasForGender(genero);
    const inputStockEl = DOM.admin.newStockVal;
    const stockVal = parseInt(inputStockEl ? inputStockEl.value : 0);
    const finalStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;

    if (!currentJerseyToManage.tallas) currentJerseyToManage.tallas = [];

    let addedCount = 0;
    tallasGenericas.forEach(sz => {
        const existing = currentJerseyToManage.tallas.find(t => isSameTalla(t.talla, sz));
        if (!existing) {
            currentJerseyToManage.tallas.push({
                id_inventario: 'TEMP_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                id_producto: currentJerseyToManage.id,
                talla: sz,
                categoria: currentJerseyToManage.genero || 'Adultos',
                stock: finalStock,
                isNew: true
            });
            addedCount++;
        }
    });

    renderInventorySizes(currentJerseyToManage);
    updateNewTallaSelect(currentJerseyToManage);

    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2500,
        background: '#141416',
        color: '#fff',
        heightAuto: false,
        customClass: {
            container: 'swal2-toast-no-lock'
        }
    });

    if (addedCount > 0) {
        Toast.fire({
            icon: 'success',
            title: `Se añadieron ${addedCount} tallas (${genero}). Presiona "Actualizar Datos" para guardar.`
        });
    } else {
        Toast.fire({
            icon: 'info',
            title: `Todas las tallas para ${genero} ya fueron añadidas.`
        });
    }
}
window.addAllStandardTallas = addAllStandardTallas;

async function handleSaveBatchTallas() {
    if (!currentJerseyToManage) return;

    // Sincronizar existencias leídas directamente de los campos DOM activos antes de guardar
    document.querySelectorAll('.input-stock-local-val').forEach(input => {
        const idx = parseInt(input.getAttribute('data-idx'));
        const val = parseInt(input.value);
        if (!isNaN(idx) && currentJerseyToManage && currentJerseyToManage.tallas && currentJerseyToManage.tallas[idx]) {
            currentJerseyToManage.tallas[idx].stock = isNaN(val) || val < 0 ? 0 : val;
        }
    });

    const btnSubmit = document.getElementById('btn-submit-save-tallas');
    if (!btnSubmit) return;
    const originalContent = btnSubmit.innerHTML;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Guardando Datos...</span>
    `;

    try {
        const is419 = (currentJerseyToManage && (currentJerseyToManage.origen === "419" || currentJerseyToManage.isLocal419)) || !!window.isLocal419Mode;

        const payload = {
            action: "save_batch_tallas",
            origen: is419 ? "419" : "",
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

        if (!response.ok) throw new Error("Error HTTP " + response.status);

        const resText = await response.text();
        let data = null;
        try {
            data = JSON.parse(resText);
        } catch (jsonErr) {
            console.warn("Respuesta de API no fue JSON estándar en save_batch_tallas:", resText);
            if (response.ok || (resText && resText.toLowerCase().includes('success'))) {
                data = { status: 'success', message: 'Se han guardado todas las tallas y existencias correctamente.' };
            } else {
                throw new Error("Error en respuesta del servidor");
            }
        }

        if (data && data.status === 'success') {
            // Limpiar etiquetas temporales para que no aparezca "NUEVA"
            if (currentJerseyToManage.tallas) {
                currentJerseyToManage.tallas.forEach(t => {
                    delete t.isNew;
                });
            }

            // ⚡ Sincronizar inmediatamente la lista local de allProducts y el caché local (0ms de espera)
            const localProduct = allProducts.find(p => p.id === currentJerseyToManage.id);
            if (localProduct) {
                localProduct.tallas = JSON.parse(JSON.stringify(currentJerseyToManage.tallas));
            }
            try {
                localStorage.setItem('jerseys_products_cache_v5', JSON.stringify({ data: allProducts, timestamp: Date.now() }));
            } catch (eCache) {}

            // Si es Local 419, actualizar también allProducts419
            if (typeof allProducts419 !== 'undefined' && Array.isArray(allProducts419)) {
                const prod419 = allProducts419.find(p => p.id === currentJerseyToManage.id);
                if (prod419) {
                    prod419.tallas = JSON.parse(JSON.stringify(currentJerseyToManage.tallas));
                }
            }

            // Actualizar vista local de inmediato con los datos guardados
            renderInventorySizes(currentJerseyToManage);
            updateNewTallaSelect(currentJerseyToManage);
            renderAdminTable();

            Swal.fire({
                icon: 'success',
                title: '¡Datos Actualizados!',
                text: 'Se han guardado todas las tallas y existencias en ' + (is419 ? 'Local 419' : 'el inventario') + ' correctamente.',
                background: '#151515', color: '#fff',
                timer: 1800,
                showConfirmButton: false,
                customClass: { popup: 'border border-white/10 rounded-2xl' }
            });

            // Revalidación silenciosa en segundo plano
            revalidateProductsBackground('jerseys_products_cache_v5');
        } else {
            throw new Error(data.message || 'Error al guardar los datos.');
        }
    } catch (error) {
        let displayErrorMsg = error && error.message ? error.message : 'Ocurrió un error al guardar los datos.';
        if (displayErrorMsg.includes('string did not match') || displayErrorMsg.includes('pattern')) {
            displayErrorMsg = 'No se pudo procesar la respuesta del servidor. Las existencias se guardaron localmente en pantalla.';
        }

        Swal.fire({
            icon: 'error',
            title: 'Error de Guardado',
            text: displayErrorMsg,
            background: '#151515',
            color: '#fff',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
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
    
    const pMenudeo = parseFloat(document.getElementById('update-precio-menudeo')?.value) || parseFloat(DOM.admin.updatePrecioMenudeo?.value) || 0;
    const pMayoreo = parseFloat(document.getElementById('update-precio-mayoreo')?.value) || parseFloat(DOM.admin.updatePrecioMayoreo?.value) || 0;
    const pMayoreoSuper = parseFloat(document.getElementById('update-precio-mayoreo-super')?.value) || parseFloat(DOM.admin.updatePrecioMayoreoSuper?.value) || 0;
    
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
        precio_menudeo: pMenudeo,
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

function refreshCreateTallasOptions() {
    if (!DOM.admin || !DOM.admin.tallasContainer) return;
    const baseTallas = getTallasForSelectedGender();
    const selects = Array.from(DOM.admin.tallasContainer.querySelectorAll('.talla-val'));
    if (selects.length === 0) return;

    const selectedValues = selects.map(s => s.value).filter(Boolean);

    selects.forEach(selectEl => {
        const currentVal = selectEl.value;
        const disponibles = baseTallas.filter(t => t === currentVal || !selectedValues.includes(t));

        if (disponibles.length === 0) {
            selectEl.innerHTML = `<option value="" disabled selected>No hay más tallas</option>`;
            return;
        }

        let valueToSet = currentVal;
        if (!valueToSet || !disponibles.includes(valueToSet)) {
            valueToSet = disponibles[0];
            if (!selectedValues.includes(valueToSet)) {
                selectedValues.push(valueToSet);
            }
        }

        selectEl.innerHTML = disponibles.map(t => `<option value="${t}" ${t === valueToSet ? 'selected' : ''}>${t}</option>`).join('');
        selectEl.value = valueToSet;
    });
}

window.removeCreateTallaRow = function(id) {
    const el = document.getElementById(`talla-${id}`);
    if (el) {
        el.remove();
        refreshCreateTallasOptions();
    }
};

function addTallaField() {
    const baseTallas = getTallasForSelectedGender();
    if (baseTallas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Selecciona Género',
            text: 'Debes elegir primero un género para ver las tallas disponibles.',
            background: '#151515', color: '#fff',
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
        return;
    }

    const selects = Array.from(DOM.admin.tallasContainer.querySelectorAll('.talla-val'));
    const selectedValues = selects.map(s => s.value).filter(Boolean);
    const disponibles = baseTallas.filter(t => !selectedValues.includes(t));

    if (disponibles.length === 0) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 2200,
            background: '#141416',
            color: '#fff',
            heightAuto: false
        });
        Toast.fire({
            icon: 'info',
            title: 'Todas las tallas disponibles ya han sido agregadas.'
        });
        return;
    }

    const id = Date.now();
    const defaultTalla = disponibles[0];

    const html = `
        <div class="flex gap-3 items-end bg-dark-200/30 p-3 rounded-xl border border-white/5 talla-item" id="talla-${id}">
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Talla</label>
                <select required class="talla-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white cursor-pointer pr-8">
                </select>
            </div>
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Stock</label>
                <input type="number" required min="0" value="0" placeholder="0" class="stock-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white">
            </div>
            <button type="button" onclick="window.removeCreateTallaRow('${id}')" class="bg-red-500/10 text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors h-[38px] flex items-center justify-center" title="Eliminar talla">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `;
    DOM.admin.tallasContainer.insertAdjacentHTML('beforeend', html);

    const newRow = document.getElementById(`talla-${id}`);
    const newSelect = newRow.querySelector('.talla-val');
    if (newSelect) {
        newSelect.value = defaultTalla;
        newSelect.addEventListener('change', () => {
            refreshCreateTallasOptions();
        });
    }

    refreshCreateTallasOptions();
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

    const pMenudeo = parseFloat(document.getElementById('create-precio-menudeo')?.value) || (DOM.admin.precioMenudeo ? parseFloat(DOM.admin.precioMenudeo.value) : 0) || 0;
    const pMayoreo = parseFloat(document.getElementById('create-precio-mayoreo')?.value) || (DOM.admin.precioMayoreo ? parseFloat(DOM.admin.precioMayoreo.value) : 0) || 0;
    const pMayoreoSuper = parseFloat(document.getElementById('create-precio-mayoreo-super')?.value) || (DOM.admin.precioMayoreoSuper ? parseFloat(DOM.admin.precioMayoreoSuper.value) : 0) || 0;

    const payload = {
        action: "create",
        nombre: document.getElementById('create-nombre').value.trim(),
        tipo: DOM.admin.createSelects.tipo.value,
        version: DOM.admin.createSelects.version.value,
        genero: DOM.admin.createSelects.genero.value,
        personalizacion: document.getElementById('create-personalizacion').value,
        foto: fotoUrl,
        precio_menudeo: pMenudeo,
        precio_Menudeo: pMenudeo,
        precio_mayoreo: pMayoreo,
        precio_mayoreo_super: pMayoreoSuper,
        personalizaciones_oficiales: {
            basica_activa: !!(document.getElementById('create-chk-basica') && document.getElementById('create-chk-basica').checked),
            basica_precio_menudeo: parseFloat(document.getElementById('create-basica-precio-menudeo')?.value) || 0,
            basica_precio_mayoreo: parseFloat(document.getElementById('create-basica-precio-mayoreo')?.value) || 0,
            oficial_activa: !!(document.getElementById('create-chk-oficial') && document.getElementById('create-chk-oficial').checked),
            oficial_precio_menudeo: parseFloat(document.getElementById('create-oficial-precio-menudeo')?.value) || 0,
            oficial_precio_mayoreo: parseFloat(document.getElementById('create-oficial-precio-mayoreo')?.value) || 0,
            opciones: createOficialList
        },
        fecha_registro: new Date().toISOString(),
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
        
        const resText = await response.text();
        let data = null;
        try {
            data = JSON.parse(resText);
        } catch (jsonErr) {
            console.warn("Respuesta de API no fue JSON estándar:", resText);
            if (response.ok || (resText && resText.toLowerCase().includes('success'))) {
                data = { status: 'success', message: 'La playera se ha agregado correctamente al catálogo.', id: 'OK' };
            } else {
                throw new Error("Error en respuesta del servidor");
            }
        }
        
        if (data && (data.status === 'success' || data.id)) {
            const createdId = data.id || 'JER-NUEVO';
            const result = await Swal.fire({
                icon: 'success',
                title: '¡Playera Creada!',
                html: `<span class="text-gray-300">${data.message || 'La playera se ha agregado correctamente al catálogo.'}</span><br><br><span class="text-xs bg-navy-500/20 text-navy-400 px-3 py-1 rounded-lg border border-navy-500/30 font-mono tracking-wider">ID: ${createdId}</span>`,
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

            // ⚡ Agregar la nueva playera al instante al principio del catálogo en memoria (0ms, sin esqueletos)
            const newProductObj = {
                id: createdId,
                nombre: payload.nombre,
                tipo: payload.tipo,
                version: payload.version,
                genero: payload.genero,
                personalizacion: payload.personalizacion,
                foto: payload.foto,
                precio_menudeo: payload.precio_menudeo,
                precio_Menudeo: payload.precio_Menudeo,
                precio_mayoreo: payload.precio_mayoreo,
                precio_mayoreo_super: payload.precio_mayoreo_super,
                personalizaciones_oficiales: payload.personalizaciones_oficiales,
                fecha_registro: payload.fecha_registro,
                activo: 1,
                tallas: payload.tallas || []
            };

            // Insertar al inicio de la lista local
            allProducts.unshift(newProductObj);

            // Sincronizar en localStorage
            try {
                localStorage.setItem('jerseys_products_cache_v5', JSON.stringify({ data: allProducts, timestamp: Date.now() }));
            } catch (eCache) {}

            // Redibujar la vista inmediatamente sin mostrar esqueletos
            renderProductsWithFilters();

            // Revalidación silenciosa en segundo plano
            revalidateProductsBackground('jerseys_products_cache_v5');
            
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
                title: 'Error de respuesta',
                text: (data && data.message) ? data.message : 'No se pudo verificar la respuesta del servidor.',
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#ef4444',
                customClass: { popup: 'border border-white/10 rounded-2xl shadow-2xl shadow-red-500/10' }
            });
        }
    } catch (error) {
        console.error("Error al crear playera:", error);
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
        const [jerseyRes, artRes] = await Promise.all([
            search(filtros),
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "search_articulos" })
            }).then(r => r.json()).catch(() => ({ status: "error", data: [] }))
        ]);

        let productsData = [];
        if (Array.isArray(jerseyRes)) {
            productsData = jerseyRes;
        } else if (jerseyRes && jerseyRes.status === 'success') {
            productsData = jerseyRes.data || jerseyRes.productos || [];
        }

        let articulosData = [];
        if (artRes && artRes.status === 'success' && Array.isArray(artRes.data)) {
            articulosData = artRes.data.map(art => ({
                id: art.id || art.id_articulo,
                id_articulo: art.id_articulo || art.id,
                nombre: art.nombre,
                version: art.categoria || "Accesorio",
                tipo: art.marca || "Deportivo",
                genero: "Accesorio",
                foto: art.foto,
                precio_menudeo: Number(art.precio_menudeo || 0),
                precio_mayoreo: Number(art.precio_mayoreo || 0),
                precio_mayoreo_super: Number(art.precio_mayoreo || 0),
                precio_Menudeo: Number(art.precio_menudeo || 0),
                precio: Number(art.precio_menudeo || 0),
                activo: art.activo !== undefined ? art.activo : 1,
                es_articulo: true,
                tallas: (art.variantes || []).map(v => ({
                    talla: v.variante || "Unitalla",
                    stock: Number(v.stock) || 0,
                    id_inventario: v.id_inventario
                }))
            }));
        }

        allProducts = [...productsData, ...articulosData];

        try {
            const wrapper = { data: allProducts, timestamp: Date.now() };
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
        const [jerseyRes, artRes] = await Promise.all([
            search(filtros),
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "search_articulos" })
            }).then(r => r.json()).catch(() => ({ status: "error", data: [] }))
        ]);

        let productsData = [];
        if (Array.isArray(jerseyRes)) {
            productsData = jerseyRes;
        } else if (jerseyRes && jerseyRes.status === 'success') {
            productsData = jerseyRes.data || jerseyRes.productos || [];
        }

        let articulosData = [];
        if (artRes && artRes.status === 'success' && Array.isArray(artRes.data)) {
            articulosData = artRes.data.map(art => ({
                id: art.id || art.id_articulo,
                id_articulo: art.id_articulo || art.id,
                nombre: art.nombre,
                version: art.categoria || "Accesorio",
                tipo: art.marca || "Deportivo",
                genero: "Accesorio",
                foto: art.foto,
                precio_menudeo: Number(art.precio_menudeo || 0),
                precio_mayoreo: Number(art.precio_mayoreo || 0),
                precio_mayoreo_super: Number(art.precio_mayoreo || 0),
                precio_Menudeo: Number(art.precio_menudeo || 0),
                precio: Number(art.precio_menudeo || 0),
                activo: art.activo !== undefined ? art.activo : 1,
                es_articulo: true,
                tallas: (art.variantes || []).map(v => ({
                    talla: v.variante || "Unitalla",
                    stock: Number(v.stock) || 0,
                    id_inventario: v.id_inventario
                }))
            }));
        }

        const combined = [...productsData, ...articulosData];

        try {
            const wrapper = { data: combined, timestamp: Date.now() };
            localStorage.setItem(cacheKey, JSON.stringify(wrapper));
        } catch (e) {}

        const isUserActive = document.getElementById('add-to-pedido-modal')?.classList.contains('hidden') === false;

        if (!isUserActive) {
            allProducts = combined;
            renderProductsWithFilters();
        }
    } catch (err) {
        console.warn("Error en revalidación de productos en segundo plano:", err);
    }
}

function getFilteredAndSortedProducts() {
    const activeProductsOnly = (allProducts || []).filter(p => p.activo === undefined || p.activo === null || p.activo === "" || Number(p.activo) === 1);

    const nombreQ = DOM.filters.nombre ? DOM.filters.nombre.value.trim() : "";
    const tipoQ = DOM.filters.tipo ? DOM.filters.tipo.value : "";
    const versionQ = DOM.filters.version ? DOM.filters.version.value : "";
    const generoQ = DOM.filters.genero ? DOM.filters.genero.value : "";
    const ordenQ = DOM.filters.orden ? DOM.filters.orden.value : "";
    const minP = (DOM.filters.precioMin && DOM.filters.precioMin.value !== "") ? parseFloat(DOM.filters.precioMin.value) : null;
    const maxP = (DOM.filters.precioMax && DOM.filters.precioMax.value !== "") ? parseFloat(DOM.filters.precioMax.value) : null;

    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let profileToUse = activeProfile;
    if (activeProfile === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }

    let filtrados = activeProductsOnly.filter(p => {
        let match = true;
        if (tipoQ && p.tipo !== tipoQ) match = false;
        if (versionQ && p.version !== versionQ) match = false;
        if (generoQ && p.genero !== generoQ) match = false;

        if (minP !== null || maxP !== null) {
            const itemPrice = getBasePriceForProfile(p, profileToUse);
            if (minP !== null && !isNaN(minP) && itemPrice < minP) match = false;
            if (maxP !== null && !isNaN(maxP) && itemPrice > maxP) match = false;
        }
        return match;
    });

    if (nombreQ) {
        const scoredItems = [];
        filtrados.forEach(p => {
            const enrichedFields = [
                p.nombre, p.equipo, p.tipo, p.version,
                p.genero, p.jugador, p.temporada, p.categoria,
                p.marca, p.tags, p.id, p.id_producto,
                p.id_playera, p.id_articulo, p.id_inventario, p.comentarios
            ].map(f => (typeof normalizeText === 'function' ? normalizeText(f) : String(f || '').toLowerCase())).join(' ');

            const normQuery = typeof normalizeText === 'function' ? normalizeText(nombreQ) : nombreQ.toLowerCase();
            const queryTokens = normQuery.split(' ').filter(Boolean);
            const normNombre = typeof normalizeText === 'function' ? normalizeText(p.nombre || p.equipo || '') : String(p.nombre || p.equipo || '').toLowerCase();

            let score = 0;
            let matchedCount = 0;

            queryTokens.forEach(token => {
                if (!token) return;
                if (enrichedFields.includes(token)) {
                    matchedCount++;
                    score += 20;
                    if (normNombre.includes(token)) score += 15;
                } else {
                    const tokenClean = token.replace(/[^a-z0-9]/g, '');
                    if (tokenClean && tokenClean.length >= 3 && enrichedFields.includes(tokenClean)) {
                        matchedCount++;
                        score += 10;
                    }
                }
            });

            if (matchedCount === queryTokens.length) score += 50;

            if (matchedCount > 0) {
                scoredItems.push({ product: p, score: score, matchedCount: matchedCount });
            }
        });

        const normQuery = typeof normalizeText === 'function' ? normalizeText(nombreQ) : nombreQ.toLowerCase();
        const totalTokens = normQuery.split(' ').filter(Boolean).length;

        if (totalTokens >= 2) {
            let exactMatches = scoredItems.filter(item => item.matchedCount >= totalTokens);
            if (exactMatches.length === 0 && totalTokens > 2) {
                exactMatches = scoredItems.filter(item => item.matchedCount >= totalTokens - 1);
            }
            if (!ordenQ) exactMatches.sort((a, b) => b.score - a.score);
            filtrados = exactMatches.map(item => item.product);
        } else {
            if (!ordenQ) scoredItems.sort((a, b) => b.score - a.score);
            filtrados = scoredItems.map(item => item.product);
        }
    }

    if (ordenQ === "precio-asc") {
        filtrados.sort((a, b) => getBasePriceForProfile(a, profileToUse) - getBasePriceForProfile(b, profileToUse));
    } else if (ordenQ === "precio-desc") {
        filtrados.sort((a, b) => getBasePriceForProfile(b, profileToUse) - getBasePriceForProfile(a, profileToUse));
    } else if (ordenQ === "nombre-asc") {
        filtrados.sort((a, b) => (a.nombre || a.equipo || '').localeCompare(b.nombre || b.equipo || ''));
    } else if (ordenQ === "nombre-desc") {
        filtrados.sort((a, b) => (b.nombre || b.equipo || '').localeCompare(a.nombre || a.equipo || ''));
    }

    return filtrados;
}

function renderProductsWithFilters() {
    if (!allProducts || allProducts.length === 0) {
        renderSkeletons(6);
        return;
    }

    const filtrados = getFilteredAndSortedProducts();
    renderLocalProducts(filtrados);

    if (DOM.admin.listModal && !DOM.admin.listModal.classList.contains('hidden')) {
        applyAdminFilters(true);
    }
}

let searchDebounceTimer = null;

function handleLocalSearch() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    
    searchDebounceTimer = setTimeout(() => {
        const filtrados = getFilteredAndSortedProducts();
        renderLocalProducts(filtrados);
    }, 40);
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
    const isMobile = typeof isMobileDevice === 'function' ? isMobileDevice() : window.innerWidth < 640;
    const CHUNK_SIZE = isMobile ? 12 : 24; // 12 tarjetas por lote en celulares para inicio ultra-rápido (<10ms)
    let index = 0;

    function renderNextChunk() {
        if (token !== currentRenderToken) return;
        
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + CHUNK_SIZE, productos.length);
        
        for (let i = index; i < end; i++) {
            fragment.appendChild(createProductCard(productos[i], i));
        }
        
        DOM.grid.appendChild(fragment);
        index = end;
        
        if (index < productos.length) {
            requestAnimationFrame(renderNextChunk);
        }
    }

    renderNextChunk();
}

function formatShortTallaLabel(rawTalla) {
    if (!rawTalla) return 'M';
    let str = String(rawTalla).trim();
    if (str.includes('(')) {
        const parts = str.split('(');
        const numPart = parts[0].trim();
        const detailPart = parts[1].replace(')', '').trim();
        const ageMatch = detailPart.match(/(\d+)\s*(?:a|-)\s*(\d+)/i);
        if (ageMatch && numPart) {
            return `${numPart} (${ageMatch[1]}-${ageMatch[2]}A)`;
        }
        const cleanDetail = detailPart.replace(/años|año|anios|anio/gi, 'A').trim();
        return `${numPart} (${cleanDetail})`;
    }
    return str;
}

function createProductCard(producto, cardIndex = 0) {
    const article = document.createElement('article');
    article.className = 'group bg-dark-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 hover:border-navy-400/40 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] relative overflow-hidden';
    
    const images = (producto.foto || producto.imagen || '').split(',').map(u => u.trim()).filter(Boolean);
    let currentImgIdx = 0;
    
    const isMobile = window.innerWidth < 640;
    const thumbWidth = isMobile ? 300 : 400;
    const rawImg = images[currentImgIdx] || `https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=${thumbWidth}`;
    const imgUrl = getOptimizedImageUrl(rawImg, thumbWidth);
    
    const isFirstViewport = cardIndex < (isMobile ? 4 : 8);
    const loadingAttr = isFirstViewport ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async" fetchpriority="low"';
    
    let tagsHtml = '<div class="flex flex-wrap gap-1 sm:gap-2 mb-1.5 sm:mb-3 z-10 relative">';
    if (producto.version) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-dark-200/90 text-gray-400 rounded-md border border-white/10">${producto.version}</span>`;
    if (producto.tipo) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-dark-200/90 text-gray-300 rounded-md border border-white/10">${producto.tipo}</span>`;
    if (producto.genero) {
        const colorGen = getGenderColorClass(producto.genero);
        tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${colorGen} rounded-md border">${producto.genero}</span>`;
    }
    tagsHtml += '</div>';

    let tallasHtml = '';
    let totalStock = 0;
    const hasSizes = Array.isArray(producto.tallas) && producto.tallas.length > 0;

    const isAdmin = (localStorage.getItem('current_perfil') === "Administrador" && currentView === "mis-jerseys");
    const isNinoProd = String(producto.genero || '').toLowerCase().includes('niño') || String(producto.genero || '').toLowerCase().includes('nino');

    if (hasSizes) {
        const sizeSectionHeader = isNinoProd
            ? `<div class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"><span>👶 Tallas de Niño:</span></div>`
            : `<div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">Tallas Disponibles:</div>`;

        tallasHtml = `<div class="mt-2.5 pt-2 border-t border-white/5 z-10 relative">${sizeSectionHeader}<div class="flex flex-wrap gap-1.5 sm:gap-2">`;
        
        producto.tallas.forEach(t => {
            const stockVal = Number(t.stock !== undefined ? t.stock : (t.inventario || 0)) || 0;
            if (stockVal <= 0) return; // 🚫 Ocultar completamente tallas sin existencias (stock <= 0)

            totalStock += stockVal;
            const displayTalla = String(t.talla || '');
            const isKidsSize = isNinoProd || displayTalla.includes('(') || /^\d{2}/.test(displayTalla.trim());
            
            const btnClass = isKidsSize
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-400 hover:text-white hover:bg-emerald-500/20 cursor-pointer shadow-sm'
                : 'bg-dark-200 text-gray-200 border-white/10 hover:border-navy-400 hover:text-navy-400 hover:bg-dark-100 cursor-pointer shadow-sm';

            const adminStockHtml = isAdmin ? `<span class="absolute -top-2 -right-2 bg-navy-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-dark z-20">${stockVal}</span>` : '';

            const shortLabel = formatShortTallaLabel(displayTalla);
            const fullTitle = `${displayTalla} | Stock: ${stockVal}`;
            tallasHtml += `
                <div class="relative">
                    <button type="button" class="talla-btn px-2 sm:px-2.5 h-7 sm:h-8.5 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold leading-none border transition-all duration-200 ${btnClass} whitespace-nowrap shadow-sm" 
                            data-talla="${displayTalla}" 
                            title="${fullTitle}">
                        ${shortLabel}
                    </button>
                    ${adminStockHtml}
                </div>
            `;
        });
        tallasHtml += '</div></div>';
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
        const priceColorClass = isSuperMayoreoActivo && esPerfilSuperMayoreo(profileToUse) ? 'text-amber-400 font-bold' : 'text-navy-400';

        statusTextHtml = `
            <div class="mt-1 mb-2 bg-dark-200/80 border border-white/5 rounded-xl p-1.5 sm:p-2.5 space-y-0.5 sm:space-y-1 text-[9px] sm:text-xs z-10 relative">
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
            <div class="absolute inset-0 flex items-center justify-center bg-dark/60 z-20">
                <span class="bg-amber-500 text-white px-2 sm:px-5 py-1 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[8px] sm:text-xs border border-amber-400 shadow-xl shadow-amber-500/20 transform -rotate-6">Próximamente</span>
            </div>
        `;
    } else if (isAgotado) {
        imageOverlayHtml = `
            <div class="absolute inset-0 flex items-center justify-center bg-dark/50 z-20">
                <span class="bg-red-500 text-white px-2 sm:px-5 py-1 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[8px] sm:text-xs border border-red-400 shadow-xl shadow-red-500/20 transform -rotate-6">Agotado</span>
            </div>
        `;
    }

    let carouselControlsHtml = '';
    if (images.length > 1) {
        carouselControlsHtml = `
            <button type="button" class="carousel-prev-btn absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button type="button" class="carousel-next-btn absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
            <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-30 bg-black/60 px-2 py-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                ${images.map((_, i) => `<span class="carousel-dot w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/40'} transition-all duration-300" data-idx="${i}"></span>`).join('')}
            </div>
        `;
    }

    let bottomSectionHtml = statusTextHtml + tallasHtml;
    if (currentView === 'jerseys-pedido') {
        if (isProximamente || isAgotado) {
            bottomSectionHtml += `<button class="w-full mt-auto mt-3 py-2 rounded-lg bg-dark-200 text-gray-600 font-bold text-[11px] uppercase cursor-not-allowed border border-white/5" disabled>No disponible</button>`;
        } else if (window.isLocal419Mode) {
            bottomSectionHtml += `<button type="button" onclick="window.openPos419Modal()" class="w-full mt-auto mt-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] uppercase tracking-wider transition-all duration-300 shadow hover:shadow-amber-500/20 active:scale-[0.97]">Venta Exprés 419</button>`;
        } else {
            bottomSectionHtml += `<button class="w-full mt-auto mt-3 py-2 rounded-lg bg-navy-500 hover:bg-navy-400 text-white font-bold text-[11px] uppercase tracking-wider transition-all duration-300 shadow hover:shadow-navy-500/20 active:scale-[0.97] btn-agregar-pedido">Agregar a mi pedido</button>`;
        }
    }

    // Insignia de Existencias del Local 419 (EXCLUSIVA PARA ADMINISTRADORES)
    const loggedUserStr = localStorage.getItem('logged_user');
    let loggedUserObj = null;
    try { if (loggedUserStr) loggedUserObj = JSON.parse(loggedUserStr); } catch(e){}
    const isUserAdminRole = activeProfile === 'Administrador' || (loggedUserObj && (
        String(loggedUserObj.perfil || loggedUserObj.rol || '').toLowerCase() === 'administrador' ||
        String(loggedUserObj.perfil || loggedUserObj.rol || '').toLowerCase() === 'admin' ||
        loggedUserObj.is_admin === true
    ));

    let admin419BadgeHtml = '';
    if (isUserAdminRole) {
        const prodId = producto.id || producto.id_playera || producto.id_articulo;
        const prod419 = (allProducts419 || []).find(p => String(p.id || p.id_playera || p.id_articulo).toUpperCase() === String(prodId).toUpperCase());

        if (prod419 && Array.isArray(prod419.tallas) && prod419.tallas.length > 0) {
            const avail419Tallas = prod419.tallas.filter(t => (t.stock !== undefined ? t.stock : t.inventario || 0) > 0);
            const total419Stock = avail419Tallas.reduce((acc, t) => acc + (t.stock !== undefined ? t.stock : t.inventario || 0), 0);

            if (total419Stock > 0) {
                const tallas419Summary = avail419Tallas.map(t => {
                    const stk = t.stock !== undefined ? t.stock : t.inventario || 0;
                    return `${formatShortTallaLabel(t.talla)}:${stk}`;
                }).join(' ');

                admin419BadgeHtml = `
                    <div class="mt-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-bold flex items-center justify-between gap-1 z-20 relative shadow-sm">
                        <span class="truncate" title="Existencias en Local 419: ${tallas419Summary}">🏪 Stock 419: <strong class="text-amber-400">${tallas419Summary}</strong></span>
                    </div>
                `;
            }
        }
    }

    article.innerHTML = `
        <div class="product-image-container relative w-full aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-4 bg-dark z-10 cursor-pointer">
            <img src="${imgUrl}" alt="${producto.nombre || 'Jersey'}" class="product-card-img w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out ${(isAgotado || isProximamente) ? 'grayscale opacity-60' : ''}" ${loadingAttr}>
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
            ${admin419BadgeHtml}
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
                    if (window.isLocal419Mode) {
                        openPos419Modal();
                    } else {
                        openPedidoModal(producto, preselectedTalla);
                    }
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
            const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
            const isAdmin = activeProfile === 'Administrador';
            if (producto.es_articulo && isAdmin) {
                openEditArticuloModal(producto);
            } else {
                openModal(images[currentImgIdx], images, currentImgIdx);
            }
        });
    }
    
    const detailsContainer = article.querySelector('.product-details-container');
    if (detailsContainer) {
        detailsContainer.addEventListener('click', (e) => {
            const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
            const isAdmin = activeProfile === 'Administrador';

            if (currentView === 'jerseys-pedido') {
                if (!isAgotado && !isProximamente) {
                    if (window.isLocal419Mode) {
                        openPos419Modal();
                    } else {
                        openPedidoModal(producto, preselectedTalla);
                    }
                }
            } else {
                if (isAdmin) {
                    if (producto.es_articulo) {
                        openEditArticuloModal(producto);
                    } else {
                        openInventoryModal(producto);
                    }
                }
            }
        });
    }

    const btnAgregar = article.querySelector('.btn-agregar-pedido');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', (e) => {
            e.stopPropagation();
            openPedidoModal(producto, preselectedTalla);
        });
    }
    
    return article;
}

// --- FUNCIONES DEL CRUD DE CLIENTES ---

async function fetchClients(keepPage = false) {
    renderClientSkeletons(clientsPerPage);
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
    applyClientFilters(keepPage);
}

function applyClientFilters(keepPage = false) {
    const term = DOM.admin.clientFilterSearch ? DOM.admin.clientFilterSearch.value : '';
    
    clientsFiltered = allClients.filter(c => {
        const matchName = !term || matchText(c.nombre_completo || '', term);
        const matchUser = !term || matchText(c.usuario || '', term);
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
                    ${(client.fecha_registro || client.fecha_actualizacion) ? `
                    <div class="text-[9px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                        ${client.fecha_registro ? `<span><strong class="text-gray-500">Reg:</strong> ${client.fecha_registro}</span>` : ''}
                        ${client.fecha_actualizacion ? `<span><strong class="text-gray-500">Act:</strong> ${client.fecha_actualizacion}</span>` : ''}
                    </div>` : ''}
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
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

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
        referencias: DOM.admin.clientInputs.referencias.value.trim(),
        fecha_actualizacion: nowStr
    };
    
    if (editingClientId) {
        payload.id_cliente = editingClientId;
    } else {
        payload.fecha_registro = nowStr;
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
                activo: nuevoEstado,
                fecha_actualizacion: new Date().toISOString().replace('T', ' ').substring(0, 19)
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

function getProductId(prod) {
    if (!prod) return '';
    return String(prod.id || prod.ID || prod.id_producto || prod.nombre || '').trim();
}

function findTallaObj(tallas, targetTalla) {
    if (!tallas || !Array.isArray(tallas)) return null;
    const target = String(targetTalla || '').trim().toUpperCase();
    if (!target) return null;
    return tallas.find(t => {
        const sz = String(t.talla !== undefined ? t.talla : (t.Talla !== undefined ? t.Talla : (t.size !== undefined ? t.size : (t.Size !== undefined ? t.Size : '')))).trim().toUpperCase();
        return sz === target;
    }) || null;
}

function getTallaStock(tallaObj) {
    if (!tallaObj) return 999;
    if (tallaObj.stock !== undefined && tallaObj.stock !== null && tallaObj.stock !== '') return Number(tallaObj.stock);
    if (tallaObj.Stock !== undefined && tallaObj.Stock !== null && tallaObj.Stock !== '') return Number(tallaObj.Stock);
    if (tallaObj.inventario !== undefined && tallaObj.inventario !== null && tallaObj.inventario !== '') return Number(tallaObj.inventario);
    if (tallaObj.Inventario !== undefined && tallaObj.Inventario !== null && tallaObj.Inventario !== '') return Number(tallaObj.Inventario);
    return 999;
}

function openPedidoModal(producto, preselectedTalla = null) {
    const posModal = document.getElementById('modal-pos-local419');
    if (posModal && !posModal.classList.contains('hidden')) {
        return;
    }

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
    let matchingPreselectedOption = null;
    
    if (producto.tallas && Array.isArray(producto.tallas)) {
        producto.tallas.forEach(t => {
            const stockVal = getTallaStock(t);
            const sizeName = String(t.talla !== undefined ? t.talla : (t.Talla !== undefined ? t.Talla : '')).trim();
            if (stockVal > 0 && sizeName) {
                hasAvailableSizes = true;
                const option = document.createElement('option');
                option.value = sizeName;
                option.textContent = sizeName;
                DOM.pedido.talla.appendChild(option);
                
                if (preselectedTalla && String(sizeName).trim().toUpperCase() === String(preselectedTalla).trim().toUpperCase()) {
                    matchingPreselectedOption = sizeName;
                }
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
    
    if (matchingPreselectedOption) {
        DOM.pedido.talla.value = matchingPreselectedOption;
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
    const tallaObj = findTallaObj(currentJerseyForPedido.tallas, selectedTalla);
    
    // ⚡ Notificación y desglose de Talla Extra (ej: 4XL, 5XL, 6XL)
    const extraBadge = document.getElementById('pedido-talla-extra-badge');
    const extraNombre = document.getElementById('pedido-talla-extra-nombre');
    const extraCosto = document.getElementById('pedido-talla-extra-costo');

    let profileToUse = localStorage.getItem('current_perfil') || 'Menudeo';
    if (profileToUse === "Administrador") {
        profileToUse = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }

    const basePriceNoExtra = getBasePriceForProfile(currentJerseyForPedido, profileToUse);
    const extraSizePrice = getExtraSizePrice(selectedTalla);
    const finalBasePrice = basePriceNoExtra + extraSizePrice;

    if (extraBadge) {
        if (extraSizePrice > 0) {
            extraBadge.classList.remove('hidden');
            if (extraNombre) extraNombre.textContent = selectedTalla;
            if (extraCosto) extraCosto.textContent = `+ $${extraSizePrice.toFixed(2)} MXN`;
        } else {
            extraBadge.classList.add('hidden');
        }
    }

    if (DOM.pedido.desc) {
        if (extraSizePrice > 0) {
            DOM.pedido.desc.innerHTML = `${currentJerseyForPedido.genero || '-'} | ${currentJerseyForPedido.tipo || '-'} | ${currentJerseyForPedido.version || '-'} | <span class="text-amber-400 font-extrabold">$${finalBasePrice.toFixed(2)} c/u</span> <span class="text-gray-400 text-[10px]">($${basePriceNoExtra.toFixed(2)} + $${extraSizePrice.toFixed(2)} talla extra)</span>`;
        } else {
            DOM.pedido.desc.innerHTML = `${currentJerseyForPedido.genero || '-'} | ${currentJerseyForPedido.tipo || '-'} | ${currentJerseyForPedido.version || '-'} | <span class="text-navy-400 font-bold">$${finalBasePrice.toFixed(2)} c/u</span>`;
        }
    }
    
    if (tallaObj) {
        const stockVal = getTallaStock(tallaObj);
        const existingItem = cart.find(item => item.producto.id === currentJerseyForPedido.id && String(item.talla).trim().toUpperCase() === String(selectedTalla).trim().toUpperCase());
        const existingQty = existingItem ? existingItem.cantidad : 0;
        const limit = Math.max(0, stockVal - existingQty);
        
        DOM.pedido.cantidad.max = limit;
        if (limit === 0 && stockVal > 0) {
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
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!currentJerseyForPedido) return;
    
    const selectedTalla = DOM.pedido.talla ? DOM.pedido.talla.value : '';
    const selectedQty = parseInt(DOM.pedido.cantidad ? DOM.pedido.cantidad.value : 1) || 1;
    const selectedPersId = DOM.pedido.personalizacion ? DOM.pedido.personalizacion.value : 'PERS-NONE';
    const customText = (DOM.pedido.customText && DOM.pedido.customText.value) ? DOM.pedido.customText.value.trim().toUpperCase() : '';
    
    if (!selectedTalla) {
        Swal.fire({ icon: 'warning', title: 'Talla requerida', text: 'Por favor selecciona una talla.', background: '#151515', color: '#fff' });
        return;
    }
    
    const currentProdId = getProductId(currentJerseyForPedido);
    
    // Validar stock disponible de forma ultra-robusta
    const tallaObj = findTallaObj(currentJerseyForPedido.tallas, selectedTalla);
    const stockVal = getTallaStock(tallaObj);
    
    // Validar acumulando lo que ya está en el carrito para esta talla de este jersey
    const existingQty = cart
        .filter(item => getProductId(item.producto) === currentProdId && String(item.talla).trim().toUpperCase() === String(selectedTalla).trim().toUpperCase())
        .reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
        
    if (selectedQty + existingQty > stockVal && stockVal < 999) {
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
        getProductId(item.producto) === currentProdId && 
        String(item.talla).trim().toUpperCase() === String(selectedTalla).trim().toUpperCase() && 
        String(item.personalizacionId || 'PERS-NONE') === String(selectedPersId || 'PERS-NONE') && 
        String(item.texto_personalizado || '').trim() === String(cleanCustomText).trim()
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
        text: `${currentJerseyForPedido.nombre || 'Jersey'} añadido al carrito.`,
        toast: true,
        position: window.innerWidth < 640 ? 'bottom' : 'bottom-end',
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
window.handleAddToPedidoSubmit = handleAddToPedidoSubmit;

function updateCartBadge() {
    let totalItems = 0;
    cart.forEach(item => {
        totalItems += Number(item.cantidad) || 0;
    });
    
    // Actualizar todos los contadores de carrito (Escritorio, Laptops, Celulares y Tablets)
    const cartCountEls = document.querySelectorAll('#cart-count, #cart-count-mobile, .cart-count-badge');
    cartCountEls.forEach(el => {
        if (el) {
            el.textContent = totalItems;
            if (totalItems > 0) {
                el.classList.remove('scale-0', 'hidden');
                el.classList.add('scale-100');
            } else {
                el.classList.remove('scale-100');
                el.classList.add('scale-0');
            }
        }
    });

    if (DOM.btnOpenCart) {
        if (totalItems > 0) {
            DOM.btnOpenCart.classList.add('text-navy-400');
        } else {
            DOM.btnOpenCart.classList.remove('text-navy-400');
        }
    }
}
window.updateCartBadge = updateCartBadge;

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
        if (DOM.cart.loggedPerfil) {
            const isVip = isLoggedUserVip();
            const isSuperMayoreoActivoGlobal = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
            const clientSuperActivoCol = (loggedUser.super_mayoreo_activo !== undefined && loggedUser.super_mayoreo_activo !== null && loggedUser.super_mayoreo_activo !== "") ? Number(loggedUser.super_mayoreo_activo) : 0;
            
            // SÓLO MOSTRAR BADGE "SÚPER MAYOREO" SI TIENE PERFIL SÚPER MAYOREO Y SUPERMAYOREOACTIVO === 1
            const isSuperPerfilActivo = (isSuperMayoreoActivoGlobal && clientSuperActivoCol === 1 && esPerfilSuperMayoreo(loggedUser.perfil));

            let effectivePerfilDisplay = loggedUser.perfil || 'Menudeo';
            if (isSuperPerfilActivo) {
                effectivePerfilDisplay = 'SÚPER MAYOREO';
            } else if (isVip) {
                effectivePerfilDisplay = (loggedUser.perfil || 'Mayoreo') + ' (VIP)';
            }

            DOM.cart.loggedPerfil.textContent = effectivePerfilDisplay.toUpperCase();
            if (isSuperPerfilActivo) {
                DOM.cart.loggedPerfil.className = 'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
            } else if (isVip) {
                DOM.cart.loggedPerfil.className = 'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20';
            } else {
                DOM.cart.loggedPerfil.className = 'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30';
            }
        }
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

function getBasePriceForProfile(producto, profile, talla = null) {
    let basePrice = 0;
    
    const isSuperMayoreoActivo = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    let applySuper = false;
    
    if (isSuperMayoreoActivo) {
        applySuper = esPerfilSuperMayoreo(profile) || profile === 'Administrador';
    }
    
    if (applySuper && producto.precio_mayoreo_super && parseFloat(producto.precio_mayoreo_super) > 0) {
        basePrice = parseFloat(producto.precio_mayoreo_super);
    } else if (esPerfilMayoreoOMas(profile)) {
        basePrice = parseFloat(producto.precio_mayoreo || 0);
    } else {
        basePrice = parseFloat(producto.precio_Menudeo || producto.precio_menudeo || 0);
    }
    
    if (basePrice === 0 && producto.precio) {
        basePrice = parseFloat(producto.precio || 0);
    }

    if (talla) {
        basePrice += getExtraSizePrice(talla);
    }

    return basePrice;
}

function renderCartItems() {
    DOM.cart.itemsContainer.innerHTML = '';
    
    const bannerSuper = document.getElementById('cart-super-mayoreo-banner');
    const reasonSuper = document.getElementById('cart-super-mayoreo-reason');
    const badgeSavingsSuper = document.getElementById('cart-super-mayoreo-badge-savings');
    const rowSuper = document.getElementById('cart-super-mayoreo-row');
    const valSuper = document.getElementById('cart-super-mayoreo-val');

    if (cart.length === 0) {
        DOM.cart.emptyMessage.classList.remove('hidden');
        DOM.cart.itemsContainer.classList.add('hidden');
        DOM.cart.subtotalVal.textContent = '$0.00';
        DOM.cart.personalizacionesVal.textContent = '$0.00';
        DOM.cart.totalVal.textContent = '$0.00';
        const envioRow = document.getElementById('cart-envio-row');
        if (envioRow) envioRow.classList.add('hidden');
        if (bannerSuper) bannerSuper.classList.add('hidden');
        if (rowSuper) rowSuper.classList.add('hidden');
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
    
    // Evaluar si Súper Mayoreo aplica globalmente y en este carrito
    const isSuperMayoreoActivoGlobal = (reglasMayoreoSuper.activo !== undefined) ? Number(reglasMayoreoSuper.activo) === 1 : true;
    const esSuperPorPerfil = esPerfilSuperMayoreo(clientProfile) || clientProfile === 'Administrador';
    const totalJugador = cart.filter(i => {
        const prod = i.producto || i;
        const versionStr = String(prod.version || prod.Version || prod.tipo || '').trim().toLowerCase();
        return versionStr.includes('jugador');
    }).reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
    const limitJugador = Number(reglasMayoreoSuper.piezas_jugador || 100);
    const metaAlcanzadaProximaCompra = totalJugador >= limitJugador;

    // Banner de aviso Súper Mayoreo
    const isVip = isLoggedUserVip();
    const titleSuper = document.getElementById('cart-super-mayoreo-title');
    const loggedUserStr = localStorage.getItem('logged_user');
    const loggedUser = loggedUserStr ? JSON.parse(loggedUserStr) : {};
    const clientSuperActivoCol = (loggedUser.super_mayoreo_activo !== undefined && loggedUser.super_mayoreo_activo !== null && loggedUser.super_mayoreo_activo !== "") ? Number(loggedUser.super_mayoreo_activo) : 0;
    const esSuperMayoreoVigente = (isSuperMayoreoActivoGlobal && clientSuperActivoCol === 1 && esPerfilSuperMayoreo(clientProfile));

    if (bannerSuper) {
        if (isSuperMayoreoActivoGlobal && isVip && (esSuperMayoreoVigente || metaAlcanzadaProximaCompra) && loggedUser.perfil !== "Administrador") {
            bannerSuper.classList.remove('hidden');
            if (esSuperMayoreoVigente) {
                if (titleSuper) titleSuper.textContent = "¡Precios de Súper Mayoreo Aplicados!";
                if (reasonSuper) reasonSuper.textContent = "¡Felicidades! Cuentas con estatus VIP y estás disfrutando de precios de Súper Mayoreo por tu vigencia activa.";
                if (badgeSavingsSuper) {
                    badgeSavingsSuper.classList.remove('hidden');
                    badgeSavingsSuper.textContent = "Ahorro activo";
                }
            } else if (metaAlcanzadaProximaCompra) {
                if (titleSuper) titleSuper.textContent = "🚀 ¡Meta Alcanzada en esta Orden!";
                if (reasonSuper) reasonSuper.innerHTML = `¡Felicidades VIP! Acumulaste <strong class="text-white">${totalJugador} playeras Jugador</strong> (meta: ${limitJugador}). Al pasar esta orden a <strong>Disponible o Enviado</strong>, desbloquearás <strong>6 días de precios de Súper Mayoreo</strong> para tus próximas compras.`;
                if (badgeSavingsSuper) {
                    badgeSavingsSuper.classList.remove('hidden');
                    badgeSavingsSuper.textContent = "Súper Mayoreo Próximo";
                }
            }
        } else {
            // Ocultar banner si no está vigente ni ha alcanzado la meta de piezas versión Jugador en este carrito
            bannerSuper.classList.add('hidden');
        }
    }

    const isSuperMayoreoAplicado = esSuperMayoreoVigente;

    let subtotal = 0;
    let personalizacionesTotal = 0;
    let ahorroTotalSuperMayoreo = 0;
    
    cart.forEach((item, index) => {
        const prod = item.producto;
        const basePrice = getBasePriceForProfile(prod, clientProfile, item.talla);
        const extraSizeCost = getExtraSizePrice(item.talla);
        
        // Precio Mayoreo estándar para comparación de ahorro
        let mayoreoStandardPrice = parseFloat(prod.precio_mayoreo || prod.precio || 0) + extraSizeCost;
        if (mayoreoStandardPrice === extraSizeCost) mayoreoStandardPrice = basePrice;
        
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
        
        // Calcular ahorro por prenda si Súper Mayoreo aplicó y el precio base es menor al Mayoreo convencional
        let tieneAhorroUnitario = false;
        let precioMayoreoOriginal = mayoreoStandardPrice + persPrice;
        if (isSuperMayoreoAplicado && mayoreoStandardPrice > basePrice) {
            tieneAhorroUnitario = true;
            ahorroTotalSuperMayoreo += (mayoreoStandardPrice - basePrice) * item.cantidad;
        }
        
        const rawImg = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        const imgUrl = getOptimizedImageUrl(rawImg, 150);
        
        // Render de bloque de precio por prenda
        let precioBloqueHtml = '';
        if (tieneAhorroUnitario) {
            precioBloqueHtml = `
                <div class="font-bold text-amber-400 text-xs">$${itemTotal.toFixed(2)}</div>
                <div class="text-[9px] mt-0.5 flex flex-col items-end whitespace-nowrap">
                    <span class="line-through text-gray-500 font-medium">$${precioMayoreoOriginal.toFixed(2)} c/u</span>
                    <span class="text-amber-400 font-extrabold">$${finalUnitPrice.toFixed(2)} c/u</span>
                </div>
            `;
        } else {
            precioBloqueHtml = `
                <div class="font-bold text-white text-xs">$${itemTotal.toFixed(2)}</div>
                <div class="text-[9px] text-gray-500 mt-0.5">$${finalUnitPrice.toFixed(2)} c/u</div>
            `;
        }
        
        let tallaItemLabel = `<span class="text-gray-300 font-semibold">${item.talla}</span>`;
        if (extraSizeCost > 0) {
            tallaItemLabel = `<span class="text-amber-400 font-bold">${item.talla} (+$${extraSizeCost.toFixed(2)} Talla Extra)</span>`;
        }
        
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
                    Talla: ${tallaItemLabel} | 
                    Cant: <span class="text-gray-300 font-semibold">${item.cantidad}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5">
                    Pers: <span class="text-navy-400 font-semibold">${persName}</span>
                    ${item.texto_personalizado ? ` | <span class="text-emerald-400 font-mono">"${item.texto_personalizado}"</span>` : ''}
                </div>
            </div>
            <div class="text-right flex-shrink-0 min-w-[85px]">
                ${precioBloqueHtml}
            </div>
            <button onclick="removeCartItem(${index})" class="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0" title="Eliminar artículo">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        DOM.cart.itemsContainer.appendChild(itemDiv);
    });
    
    let totalPieces = cart.reduce((sum, item) => sum + item.cantidad, 0);
    let shippingCost = 0;
    
    const selectedDeliveryRadio = document.querySelector('input[name="cart-tipo-entrega"]:checked');
    const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
    const selectedDelivery = selectedDeliveryRadio ? selectedDeliveryRadio.value : (cartEnvioCheckbox && cartEnvioCheckbox.checked ? 'domicilio' : 'recoleccion');
    
    // Actualizar estilos dinámicos de las tarjetas de tipo de entrega
    const lblDomicilio = document.getElementById('lbl-tipo-domicilio');
    const lblRecoleccion = document.getElementById('lbl-tipo-recoleccion');
    const lblApp = document.getElementById('lbl-tipo-app');
    
    if (lblDomicilio) {
        if (selectedDelivery === 'domicilio') {
            lblDomicilio.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-navy-400/50 bg-navy-500/10 text-white cursor-pointer transition-all shadow-sm';
        } else {
            lblDomicilio.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-white/10 bg-dark-200/50 text-gray-300 hover:text-white cursor-pointer transition-all';
        }
    }
    if (lblRecoleccion) {
        if (selectedDelivery === 'recoleccion') {
            lblRecoleccion.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-300 cursor-pointer transition-all shadow-sm';
        } else {
            lblRecoleccion.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-white/10 bg-dark-200/50 text-gray-300 hover:text-white cursor-pointer transition-all';
        }
    }
    if (lblApp) {
        if (selectedDelivery === 'app') {
            lblApp.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 cursor-pointer transition-all shadow-sm';
        } else {
            lblApp.className = 'tipo-entrega-card relative flex items-center gap-2 p-2.5 rounded-xl border border-white/10 bg-dark-200/50 text-gray-300 hover:text-white cursor-pointer transition-all';
        }
    }

    const envioRow = document.getElementById('cart-envio-row');
    const envioVal = document.getElementById('cart-envio-val');
    
    if (selectedDelivery === 'domicilio') {
        const rule = reglasEnvio.find(r => totalPieces >= r.min_piezas && totalPieces <= r.max_piezas);
        if (rule) {
            shippingCost = parseFloat(rule.costo_envio || 0);
        }
        
        if (envioRow) {
            envioRow.classList.remove('hidden');
            envioRow.style.display = 'flex';
            
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
    
    // Fila de resumen de Ahorro Súper Mayoreo
    if (rowSuper && valSuper) {
        if (isSuperMayoreoAplicado && ahorroTotalSuperMayoreo > 0) {
            rowSuper.classList.remove('hidden');
            valSuper.textContent = `-$${ahorroTotalSuperMayoreo.toFixed(2)}`;
            if (badgeSavingsSuper) badgeSavingsSuper.textContent = `-$${ahorroTotalSuperMayoreo.toFixed(2)} AHORRO`;
        } else {
            rowSuper.classList.add('hidden');
        }
    }
    
    const grandTotal = subtotal + personalizacionesTotal + shippingCost;
    DOM.cart.subtotalVal.textContent = `$${subtotal.toFixed(2)}`;
    DOM.cart.personalizacionesVal.textContent = `$${personalizacionesTotal.toFixed(2)}`;
    DOM.cart.totalVal.textContent = `$${grandTotal.toFixed(2)}`;

    // Banner Estimado de Recojo o Envío
    const pickupBanner = document.getElementById('cart-pickup-estimate-banner');
    const pickupText = document.getElementById('cart-pickup-estimate-text');
    if (selectedDelivery === 'domicilio') {
        if (pickupBanner) pickupBanner.classList.add('hidden');
    } else if (selectedDelivery === 'app') {
        if (pickupBanner) {
            pickupBanner.classList.remove('hidden');
            if (pickupText) {
                pickupText.innerHTML = `
                    <div class="flex items-center gap-1.5 font-bold text-emerald-400">
                        <span>🚗 Envío Express por App (DiDi / Uber / Rappi)</span>
                    </div>
                    <div class="text-[11px] text-gray-300 mt-1">
                        Tu pedido será preparado en Local y la recolección con el chofer de la App se coordinará vía WhatsApp.
                    </div>
                `;
            }
        }
    } else { // Recolección en Local
        if (pickupBanner) {
            const infoRecojo = getEstimadoRecojoInfo();
            pickupBanner.classList.remove('hidden');
            if (pickupText) pickupText.innerHTML = infoRecojo.mensajeHtml;
        }
    }
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
            text: 'Se eliminarán todos los jerseys de tu carrito.',
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

let isSubmittingOrderLock = false;

async function submitOrder() {
    if (isSubmittingOrderLock) return; // 🔒 Evitar envíos duplicados por doble clic
    if (cart.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Pedido Vacío', text: 'Tu pedido no contiene artículos.', background: '#151515', color: '#fff' });
        return;
    }
    
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) {
        Swal.fire({ icon: 'warning', title: 'No Autenticado', text: 'Por favor inicia sesión para completar tu pedido.', background: '#151515', color: '#fff' });
        return;
    }

    isSubmittingOrderLock = true;
    const btnSubmit = document.getElementById('btn-confirm-pedido') || document.getElementById('btn-cart-checkout');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.pointerEvents = 'none';
    }
    
    const loggedUser = JSON.parse(loggedUserStr);
    const selectedClientId = loggedUser.id_cliente;
    
    const activeProfile = localStorage.getItem('current_perfil') || 'Menudeo';
    let profile = activeProfile;
    if (activeProfile === "Administrador") {
        profile = localStorage.getItem('current_subperfil') || 'Mayoreo';
    }
    const isMayoreo = esPerfilMayoreoOMas(profile);
    
    const selectedDeliveryRadio = document.querySelector('input[name="cart-tipo-entrega"]:checked');
    const cartEnvioCheckbox = document.getElementById('cart-envio-domicilio');
    const selectedDelivery = selectedDeliveryRadio ? selectedDeliveryRadio.value : (cartEnvioCheckbox && cartEnvioCheckbox.checked ? 'domicilio' : 'recoleccion');
    const envio_domicilio = selectedDelivery === 'domicilio';

    let deliveryLabelName = 'Recolección en Local 🏪';
    let deliveryLabelWa = '🏪 Recolección en Local';

    if (selectedDelivery === 'domicilio') {
        deliveryLabelName = 'Envío a Domicilio 🏠';
        deliveryLabelWa = '🏠 Envío a Domicilio';
    } else if (selectedDelivery === 'app') {
        deliveryLabelName = 'Envío por App (DiDi / Uber) 🚗';
        deliveryLabelWa = '🚗 Envío por App (DiDi / Uber)';
    }

    // Construir lista de artículos con precios calculados para el payload
    const articulos = cart.map(item => {
        const basePrice = getBasePriceForProfile(item.producto, profile, item.talla);
        
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
        
        let idInv = item.id_inventario || item.IdInventario || item.idInventario || '';
        if (item.producto && Array.isArray(item.producto.tallas)) {
            const tObj = item.producto.tallas.find(t => String(t.talla || t.Talla || t.size || t.Size || '').trim().toUpperCase() === String(item.talla || '').trim().toUpperCase());
            if (tObj) {
                const resolvedId = tObj.id_inventario || tObj.idInventario || tObj.IdInventario || '';
                if (resolvedId) idInv = resolvedId;
            }
        }
        
        return {
            id_producto: item.producto.id,
            nombre: item.producto.nombre || '',
            categoria: item.producto.genero || 'Adulto',
            talla: item.talla,
            cantidad: item.cantidad,
            id_personalizacion: item.personalizacionId,
            texto_personalizado: item.texto_personalizado,
            precio_unitario_final: finalPrice,
            id_inventario: idInv
        };
    });
    const totalPieces = cart.reduce((sum, item) => sum + item.cantidad, 0);
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
        tipo_entrega: selectedDelivery,
        tipo_entrega_label: deliveryLabelName,
        envio: envio_domicilio,
        costo_envio: shippingCost,
        idempotency_key: 'IDEMP-' + selectedClientId + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
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
    
    if (window.startTopLoadingBar) startTopLoadingBar();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // 🔄 Descontar stock en memoria optimista inmediatamente
            try {
                cart.forEach(item => {
                    const pId = String(item.producto?.id || item.id_producto || "").trim().toUpperCase();
                    const sz = String(item.talla || "").trim().toUpperCase();
                    const qty = Number(item.cantidad || 1);

                    const lists = [allProducts, adminFilteredProducts, productsData];
                    lists.forEach(list => {
                        if (Array.isArray(list)) {
                            const prod = list.find(p => String(p.id || p.id_producto || "").trim().toUpperCase() === pId);
                            if (prod && Array.isArray(prod.tallas)) {
                                const tObj = prod.tallas.find(t => String(t.talla || t.Talla || "").trim().toUpperCase() === sz);
                                if (tObj) {
                                    const st = Number(tObj.stock !== undefined ? tObj.stock : (tObj.inventario || 0));
                                    const updated = Math.max(0, st - qty);
                                    tObj.stock = updated;
                                    tObj.inventario = updated;
                                }
                            }
                        }
                    });
                });
                if (typeof renderProductsWithFilters === 'function') renderProductsWithFilters();
            } catch (eStockMem) {
                console.warn("Error descontando stock en memoria:", eStockMem);
            }

            if (data.actualizacion_perfil && isLoggedUserVip()) {
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
            let totalQty = 0;
            let subtotal = 0;
            let articulosHtml = '';
            
            cart.map(item => {
                totalQty += item.cantidad;
                const basePrice = getBasePriceForProfile(item.producto, profile, item.talla);
                let persPrice = 0;
                let persName = 'Ninguna';
                
                if (item.personalizacionPrecio !== undefined && item.personalizacionPrecio !== null && Number(item.personalizacionPrecio) > 0) {
                    persPrice = parseFloat(item.personalizacionPrecio);
                    persName = item.personalizacionNombre || 'Personalizada';
                } else if (item.personalizacionId !== 'PERS-NONE') {
                    const persObj = allPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId)) || defaultPersonalizaciones.find(x => String(x.id) === String(item.personalizacionId));
                    if (persObj) {
                        persPrice = isMayoreo ? parseFloat(persObj.precio_mayoreo || 0) : parseFloat(persObj.precio_Menudeo || 0);
                        persName = persObj.nombre;
                    }
                }
                
                const finalUnitPrice = basePrice + persPrice;
                const itemSubtotal = finalUnitPrice * item.cantidad;
                subtotal += itemSubtotal;
                
                articulosHtml += `
                    <div class="bg-dark-200/50 p-2.5 rounded-lg border border-white/5 text-xs space-y-1">
                        <div class="flex justify-between font-bold text-white">
                            <span>${item.producto.nombre}</span>
                            <span>$${itemSubtotal.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between text-gray-400 text-[11px]">
                            <div>
                                Talla: <span class="text-gray-200 font-semibold">${item.talla}</span> | 
                                Cant: <span class="text-gray-200 font-semibold">${item.cantidad}</span>
                                ${item.personalizacionId !== 'PERS-NONE' ? ` | Pers: <span class="text-navy-400 font-semibold">${persName}</span>` : ''}
                                ${item.texto_personalizado ? ` <span class="text-emerald-400 font-mono">("${item.texto_personalizado}")</span>` : ''}
                            </div>
                            <div class="text-right font-mono">$${finalUnitPrice.toFixed(2)} c/u</div>
                        </div>
                    </div>
                `;
            });
            
            const infoRecojo = getEstimadoRecojoInfo();
            let recojoReceiptHtml = '';
            let recojoWaExtra = '';

            if (selectedDelivery === 'recoleccion') {
                recojoReceiptHtml = `
                    <div class="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed text-left">
                        ${infoRecojo.mensajeHtml}
                    </div>
                `;
                recojoWaExtra = `\n${infoRecojo.mensajeWa}\n`;
            } else if (selectedDelivery === 'app') {
                recojoReceiptHtml = `
                    <div class="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed text-left">
                        <div class="font-bold flex items-center gap-1">🚗 Envío Express por App (DiDi / Uber):</div>
                        <div class="text-[11px] text-gray-300 mt-1">Recogeremos tu pedido en Local para entregarlo al chofer coordinado vía WhatsApp.</div>
                    </div>
                `;
                recojoWaExtra = `\n🚗 *Modalidad:* Envío Express por App (DiDi / Uber)\n`;
            }

            const orderIdStr = data.id_orden || data.id || data.order_id || 'Generado';
            const currentOrigin = window.location.origin;
            const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const statusPageUrl = `${currentOrigin}${currentPath}EstatusOrden.html?id_orden=${encodeURIComponent(orderIdStr)}`;

            const receiptHtml = `
                <div class="text-center text-gray-400 font-mono text-sm tracking-wider mb-4 border border-white/10 rounded-lg py-2 bg-dark-200/50">
                    ID Orden: <span class="text-white">${orderIdStr}</span>
                </div>
                <div class="text-left space-y-4 text-sm mt-3 border-t border-white/10 pt-3">
                    <div class="grid grid-cols-2 text-xs text-gray-400 gap-1.5">
                        <div><strong>Cliente:</strong> ${loggedUser.nombre_completo}</div>
                        <div><strong>Cantidad total:</strong> ${totalQty} playeras</div>
                        <div class="col-span-2 pt-1"><strong>Tipo de Entrega:</strong> <span class="text-amber-300 font-bold">${deliveryLabelName}</span></div>
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
                    ${recojoReceiptHtml}
                    <div class="pt-2 text-center">
                        <a href="${statusPageUrl}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-600/30 hover:bg-navy-600 text-navy-300 hover:text-white border border-navy-500/40 text-xs font-bold transition-all shadow-sm">
                            <span>🔗 Ver Estatus y Rastreo de la Orden</span>
                        </a>
                    </div>
                </div>
            `;
            const waText = encodeURIComponent(
                `*¡Hola! Acabo de realizar un nuevo pedido* 🛒👕\n\n` +
                `*ID de Orden:* ${orderIdStr}\n` +
                `*Cliente:* ${loggedUser.nombre_completo || ''}\n` +
                `*Total de Jerseys:* ${totalQty} piezas\n` +
                `*Tipo de Entrega:* ${deliveryLabelWa}\n` +
                (envio_domicilio ? `*Costo de Envío:* ${shippingCost === 0 ? 'Gratis' : '$' + shippingCost.toFixed(2)}\n` : '') +
                `*Total a Pagar:* $${(subtotal + shippingCost).toFixed(2)}\n` +
                recojoWaExtra + `\n` +
                `🔗 *Consulta el estatus y detalle de tu orden aquí:*\n${statusPageUrl}\n\n` +
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
                        const itemIdx = cart.findIndex(i => 
                            (conf.id_inventario && String(i.id_inventario).trim().toUpperCase() === String(conf.id_inventario).trim().toUpperCase()) ||
                            (getProductId(i.producto).toUpperCase() === String(conf.id_producto || '').trim().toUpperCase() && String(i.talla).trim().toUpperCase() === String(conf.talla || '').trim().toUpperCase())
                        );
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
                            const itemIdx = cart.findIndex(i => 
                                (conf.id_inventario && String(i.id_inventario).trim().toUpperCase() === String(conf.id_inventario).trim().toUpperCase()) ||
                                (getProductId(i.producto).toUpperCase() === String(conf.id_producto || '').trim().toUpperCase() && String(i.talla).trim().toUpperCase() === String(conf.talla || '').trim().toUpperCase())
                            );
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
    } finally {
        isSubmittingOrderLock = false;
        const btnSubmit = document.getElementById('btn-confirm-pedido') || document.getElementById('btn-cart-checkout');
        if (btnSubmit) btnSubmit.disabled = false;
        if (window.finishTopLoadingBar) finishTopLoadingBar();
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
    if (DOM.admin.Ordenes.filtros.nombre) DOM.admin.Ordenes.filtros.nombre.value = '';
    if (DOM.admin.Ordenes.filtros.id) DOM.admin.Ordenes.filtros.id.value = '';
    if (window.toggleAllEstatusCheckboxes) window.toggleAllEstatusCheckboxes(true);
    
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

window.toggleEstatusMultiselectDropdown = function() {
    const dropdown = document.getElementById('admin-ordenes-estatus-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

window.toggleAllEstatusCheckboxes = function(isChecked) {
    const optionChks = document.querySelectorAll('.estatus-option-chk');
    optionChks.forEach(chk => chk.checked = isChecked);
    updateEstatusMultiselectLabel();
};

window.updateEstatusMultiselectLabel = function() {
    const allChks = document.querySelectorAll('.estatus-option-chk');
    const checkedChks = document.querySelectorAll('.estatus-option-chk:checked');
    const masterChk = document.getElementById('estatus-chk-todos');
    const label = document.getElementById('admin-ordenes-estatus-label');

    if (checkedChks.length === allChks.length) {
        if (masterChk) masterChk.checked = true;
        if (label) label.textContent = 'Todos los Estatus';
    } else if (checkedChks.length === 0) {
        if (masterChk) masterChk.checked = false;
        if (label) label.textContent = 'Ninguno seleccionado';
    } else {
        if (masterChk) masterChk.checked = false;
        const selectedNames = Array.from(checkedChks).map(c => c.value);
        if (selectedNames.length <= 2) {
            if (label) label.textContent = selectedNames.join(', ');
        } else {
            if (label) label.textContent = `${selectedNames.length} estatus selec.`;
        }
    }
    handleSearchOrdenes();
};

document.addEventListener('click', function(e) {
    const btn = document.getElementById('btn-admin-ordenes-estatus-toggle');
    const dropdown = document.getElementById('admin-ordenes-estatus-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function handleSearchOrdenes() {
    const nombre = DOM.admin.Ordenes.filtros.nombre ? DOM.admin.Ordenes.filtros.nombre.value : '';
    const id = DOM.admin.Ordenes.filtros.id ? DOM.admin.Ordenes.filtros.id.value : '';
    
    // Obtener estatus seleccionados en el filtro múltiple
    const checkedChks = document.querySelectorAll('.estatus-option-chk:checked');
    const allChks = document.querySelectorAll('.estatus-option-chk');
    const selectedStatuses = Array.from(checkedChks).map(c => c.value);
    const masterChk = document.getElementById('estatus-chk-todos');
    const isAllSelected = (masterChk && masterChk.checked) || checkedChks.length === allChks.length || checkedChks.length === 0;

    currentOrdenes = allFetchedOrdenes.filter(orden => {
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        const nombreCliente = orden.nombre_cliente || (clientObj ? clientObj.nombre_completo : null) || orden.id_cliente || '';
        
        const matchNombre = !nombre || matchText(nombreCliente, nombre);
        const matchId = !id || matchText(orden.id_orden, id);
        
        let matchEstatus = false;
        if (isAllSelected) {
            matchEstatus = true;
        } else {
            matchEstatus = selectedStatuses.some(st => {
                if (orden.estatus === st) return true;
                if (st === 'Enviado - Paqueteria' && (orden.estatus === 'Enviado' || orden.estatus === 'Enviado - Paqueteria')) return true;
                if (st === 'Finalizada' && (orden.estatus === 'Finalizada' || orden.estatus === 'Entregado' || orden.estatus === 'Entregada - Paqueteria')) return true;
                if (st === 'Cancelada' && (orden.estatus === 'Cancelada' || orden.estatus === 'Cancelado')) return true;
                return false;
            });
        }
        
        return matchNombre && matchId && matchEstatus;
    });
    
    OrdenesCurrentPage = 1;
    renderOrdenes();
}

async function fetchOrdenes() {
    if (!DOM.admin || !DOM.admin.Ordenes || !DOM.admin.Ordenes.listContainer) return;
    DOM.admin.Ordenes.listContainer.innerHTML = '';
    if (DOM.admin.Ordenes.emptyState) DOM.admin.Ordenes.emptyState.classList.add('hidden');
    if (DOM.admin.Ordenes.loadingState) DOM.admin.Ordenes.loadingState.classList.remove('hidden');
    
    const payload = { action: 'search_orders' };
    if (window.startTopLoadingBar) startTopLoadingBar();
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Error HTTP " + response.status);
        const result = await response.json();
        
        if (DOM.admin.Ordenes.loadingState) DOM.admin.Ordenes.loadingState.classList.add('hidden');
        
        if (result && result.status === 'success' && Array.isArray(result.data)) {
            allFetchedOrdenes = result.data;
            if (allFetchedOrdenes.length > 0) {
                handleSearchOrdenes();
            } else {
                currentOrdenes = [];
                if (DOM.admin.Ordenes.emptyState) DOM.admin.Ordenes.emptyState.classList.remove('hidden');
                renderOrdenes();
            }
        } else {
            allFetchedOrdenes = [];
            currentOrdenes = [];
            if (DOM.admin.Ordenes.emptyState) DOM.admin.Ordenes.emptyState.classList.remove('hidden');
            renderOrdenes();
        }
    } catch (error) {
        console.warn('Error al obtener órdenes:', error);
        if (DOM.admin.Ordenes.loadingState) DOM.admin.Ordenes.loadingState.classList.add('hidden');
        if (allFetchedOrdenes.length === 0 && DOM.admin.Ordenes.emptyState) {
            DOM.admin.Ordenes.emptyState.classList.remove('hidden');
        }
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}

window.copyToClipboard = function(text, label = 'Copiado') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 1800,
        background: '#151515', color: '#fff'
    });
    Toast.fire({ icon: 'success', title: `📋 ${label}: ${text}` });
};

function isOrdenCancelada(estatus) {
    if (!estatus) return false;
    const est = String(estatus).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return est.includes('cancel') || est.includes('anulad');
}

function parseOrdenFecha(fechaStr) {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date) return isNaN(fechaStr.getTime()) ? null : fechaStr;
    if (typeof fechaStr === 'number') return new Date(fechaStr);
    
    let d = new Date(fechaStr);
    if (!isNaN(d.getTime())) return d;
    
    const str = String(fechaStr).trim();
    if (/^\d+$/.test(str)) {
        d = new Date(Number(str));
        if (!isNaN(d.getTime())) return d;
    }

    const parts = str.split(/[\sT]+/);
    if (parts.length > 0) {
        const dateParts = parts[0].split(/[\/\-]/);
        if (dateParts.length === 3) {
            let day, month, year;
            if (dateParts[0].length === 4) {
                year = parseInt(dateParts[0], 10);
                month = parseInt(dateParts[1], 10) - 1;
                day = parseInt(dateParts[2], 10);
            } else {
                day = parseInt(dateParts[0], 10);
                month = parseInt(dateParts[1], 10) - 1;
                year = parseInt(dateParts[2], 10);
            }
            let hour = 0, min = 0, sec = 0;
            if (parts[1]) {
                const timeParts = parts[1].split(':');
                if (timeParts.length >= 2) {
                    hour = parseInt(timeParts[0], 10) || 0;
                    min = parseInt(timeParts[1], 10) || 0;
                    sec = parseInt(timeParts[2], 10) || 0;
                }
            }
            d = new Date(year, month, day, hour, min, sec);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

function matchesKpiStatusKey(status, key) {
    if (!status) return false;
    const est = String(status).toLowerCase().trim();
    if (isOrdenCancelada(est)) return false;

    switch (key) {
        case 'pendiente':
            return est.includes('pendiente');
        case 'revisando':
            return est.includes('revisando');
        case 'recoger':
            return est.includes('disponible') && est.includes('recoger');
        case 'enviar':
            return est.includes('disponible') && est.includes('enviar');
        case 'enviado':
            return est.includes('enviado') || est.includes('entregada');
        case 'finalizada':
            return est.includes('finalizada');
        default:
            return false;
    }
}

function updateOrderKpis(orders) {
    const list = (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes) && allFetchedOrdenes.length > 0)
        ? allFetchedOrdenes
        : (orders || currentOrdenes || []);

    const now = new Date();
    
    // 1. Rango de la Semana Actual (Lunes 00:00:00 a Domingo 23:59:59)
    const currentDayOfWeek = now.getDay();
    const distToMonday = currentDayOfWeek === 0 ? 6 : (currentDayOfWeek - 1);
    
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999);

    const counts = {
        pendiente: { orders: 0, pieces: 0 },
        revisando: { orders: 0, pieces: 0 },
        recoger: { orders: 0, pieces: 0 },
        enviar: { orders: 0, pieces: 0 },
        enviado: { orders: 0, pieces: 0 },
        finalizada: { orders: 0, pieces: 0 }
    };

    let totalWeekOrders = 0;
    let totalWeekPieces = 0;

    list.forEach(o => {
        // 🚫 Excluir estrictamente órdenes canceladas de las métricas de estatus
        if (isOrdenCancelada(o.estatus)) return;

        const oDate = parseOrdenFecha(o.fecha);
        if (!oDate) return;

        // Pertenece a la semana actual (Lun-Dom)?
        if (oDate >= startOfWeek && oDate <= endOfWeek) {
            let pzs = 0;
            if (Array.isArray(o.articulos_carrito) && o.articulos_carrito.length > 0) {
                o.articulos_carrito.forEach(art => { pzs += (Number(art.cantidad) || 0); });
            } else {
                pzs = Number(o.total_piezas || o.piezas || o.cant_piezas || 0);
            }

            totalWeekOrders++;
            totalWeekPieces += pzs;

            if (matchesKpiStatusKey(o.estatus, 'pendiente')) {
                counts.pendiente.orders++;
                counts.pendiente.pieces += pzs;
            } else if (matchesKpiStatusKey(o.estatus, 'revisando')) {
                counts.revisando.orders++;
                counts.revisando.pieces += pzs;
            } else if (matchesKpiStatusKey(o.estatus, 'recoger')) {
                counts.recoger.orders++;
                counts.recoger.pieces += pzs;
            } else if (matchesKpiStatusKey(o.estatus, 'enviar')) {
                counts.enviar.orders++;
                counts.enviar.pieces += pzs;
            } else if (matchesKpiStatusKey(o.estatus, 'enviado')) {
                counts.enviado.orders++;
                counts.enviado.pieces += pzs;
            } else if (matchesKpiStatusKey(o.estatus, 'finalizada')) {
                counts.finalizada.orders++;
                counts.finalizada.pieces += pzs;
            }
        }
    });

    // Actualizar los 6 indicadores de KPI por estatus de la semana actual (Lun-Dom)
    const keys = ['pendiente', 'revisando', 'recoger', 'enviar', 'enviado', 'finalizada'];
    keys.forEach(key => {
        const elOrders = document.getElementById(`kpi-status-${key}`);
        const elPzs = document.getElementById(`kpi-status-${key}-pzs`);
        if (elOrders) elOrders.textContent = counts[key].orders;
        if (elPzs) elPzs.textContent = `${counts[key].pieces} pzs`;
    });

    // Mantener compatibilidad con legacy IDs si existen en el DOM
    const elWeekOrders = document.getElementById('kpi-orders-week');
    const elWeekPieces = document.getElementById('kpi-pieces-week');
    if (elWeekOrders) elWeekOrders.textContent = totalWeekOrders;
    if (elWeekPieces) elWeekPieces.textContent = totalWeekPieces;
}

let activeKpiFilterType = 'all';

window.filterOrdersByKpi = function(type) {
    if (!allFetchedOrdenes) return;
    
    if (activeKpiFilterType === type && type !== 'all') {
        type = 'all';
    }
    activeKpiFilterType = type;

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const distToMonday = currentDayOfWeek === 0 ? 6 : (currentDayOfWeek - 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999);

    if (type === 'all') {
        currentOrdenes = [...allFetchedOrdenes];
    } else if (type === 'week') {
        currentOrdenes = allFetchedOrdenes.filter(o => {
            if (isOrdenCancelada(o.estatus)) return false;
            const oDate = parseOrdenFecha(o.fecha);
            return oDate && oDate >= startOfWeek && oDate <= endOfWeek;
        });
    } else {
        // Filtrar por estatus específico dentro de la semana actual (Lun-Dom)
        currentOrdenes = allFetchedOrdenes.filter(o => {
            if (isOrdenCancelada(o.estatus)) return false;
            const oDate = parseOrdenFecha(o.fecha);
            if (!oDate || oDate < startOfWeek || oDate > endOfWeek) return false;
            return matchesKpiStatusKey(o.estatus, type);
        });
    }
    
    // Resaltar la tarjeta activa en la UI
    const cardKeys = ['pendiente', 'revisando', 'recoger', 'enviar', 'enviado', 'finalizada'];
    cardKeys.forEach(key => {
        const cardEl = document.getElementById(`kpi-card-${key}`);
        if (cardEl) {
            if (type === key) {
                cardEl.classList.add('ring-2', 'ring-white/80', 'scale-[1.02]');
            } else {
                cardEl.classList.remove('ring-2', 'ring-white/80', 'scale-[1.02]');
            }
        }
    });

    OrdenesCurrentPage = 1;
    renderOrdenes();
};

function renderOrdenes() {
    updateOrderKpis(allFetchedOrdenes);

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
        const dateStr = !isNaN(dateObj.getTime()) 
            ? (dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
            : (orden.fecha || 'Sin fecha');
        
        let totalPiezas = 0;
        if (orden.articulos_carrito && orden.articulos_carrito.length > 0) {
            orden.articulos_carrito.forEach(art => {
                totalPiezas += Number(art.cantidad) || 0;
            });
        }
        
        let estatusColorClass = 'bg-gray-500/10 text-gray-300 border border-gray-500/30';
        let borderLeftClass = 'border-l-4 border-l-gray-500';
        let estatusDotClass = 'bg-gray-400';

        const est = String(orden.estatus || '').toLowerCase();
        if (est.includes('pendiente')) {
            estatusColorClass = 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
            borderLeftClass = 'border-l-4 border-l-amber-500';
            estatusDotClass = 'bg-amber-400';
        } else if (est.includes('revisando')) {
            estatusColorClass = 'bg-purple-500/10 text-purple-300 border border-purple-500/30';
            borderLeftClass = 'border-l-4 border-l-purple-500';
            estatusDotClass = 'bg-purple-400';
        } else if (est.includes('disponible') && est.includes('recoger')) {
            estatusColorClass = 'bg-teal-500/10 text-teal-300 border border-teal-500/30';
            borderLeftClass = 'border-l-4 border-l-teal-500';
            estatusDotClass = 'bg-teal-400';
        } else if (est.includes('disponible') && est.includes('enviar')) {
            estatusColorClass = 'bg-blue-500/10 text-blue-300 border border-blue-500/30';
            borderLeftClass = 'border-l-4 border-l-blue-500';
            estatusDotClass = 'bg-blue-400';
        } else if (est.includes('entregada') || est.includes('finalizada') || est.includes('paqueteria')) {
            estatusColorClass = 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
            borderLeftClass = 'border-l-4 border-l-emerald-500';
            estatusDotClass = 'bg-emerald-400';
        } else if (est.includes('cancelada')) {
            estatusColorClass = 'bg-red-500/15 text-red-400 border border-red-500/30';
            borderLeftClass = 'border-l-4 border-l-red-500';
            estatusDotClass = 'bg-red-400';
        }
        
        const estatusOptionsHtmlSelect = (window.OrdenesEstatusList || ['Pendiente', 'Revisando', 'Disponible - Para recoger', 'Disponible - Para enviar', 'Entregada - Paqueteria', 'Finalizada', 'Cancelada'])
            .map(e => `<option value="${e}" ${e === orden.estatus ? 'selected' : ''}>${e}</option>`)
            .join('');
            
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        const loggedUserObj = localStorage.getItem('logged_user') ? JSON.parse(localStorage.getItem('logged_user')) : null;
        const sessionUserFallback = loggedUserObj ? (loggedUserObj.nombre_completo || loggedUserObj.usuario) : null;

        let rawClientName = (orden.nombre_cliente && orden.nombre_cliente !== 'Cliente Desconocido') ? orden.nombre_cliente : null;
        const finalNombreCliente = rawClientName || (clientObj ? clientObj.nombre_completo : null) || orden.usuario || sessionUserFallback || orden.id_cliente || 'Usuario en Sesión';
        
        const isSurtido419 = String(orden.id_orden).toUpperCase().includes('419') || 
                             orden.origen === '419' || 
                             orden.tipo_precio_aplicado === 'Surtido 419' ||
                             orden.tipo_entrega === 'Local 419';

        const totalNetoNum = isSurtido419 ? 0 : Number(orden.total_neto !== undefined ? orden.total_neto : (Number(orden.gran_total || 0) + (Number(orden.envio_costo) || 0)));
        const isCancelada = est.includes('cancelada');
        
        let priceDisplayHtml = `<span class="text-emerald-400 font-mono text-xs sm:text-sm font-black">$${totalNetoNum.toFixed(2)}</span>`;
        if (isCancelada) {
            priceDisplayHtml = `<span class="line-through text-red-400/80 font-mono text-xs sm:text-sm font-bold" title="Sin cargo">$${totalNetoNum.toFixed(2)}</span>`;
        }

        // Determinar Origen / Entrega
        let origenBadgeHtml = '<span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 text-[9px] font-bold shrink-0">🏪 Recolección</span>';
        const isPos419 = String(orden.id_orden).toUpperCase().startsWith('POS419-') || orden.origen === '419';
        const envioSolicitado = String(orden.envio_solicitado || '').trim().toLowerCase();
        const tieneEnvio = envioSolicitado.startsWith('s') || Number(orden.envio_costo) > 0 || Number(orden.costo_envio) > 0;

        if (isPos419) {
            origenBadgeHtml = '<span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-extrabold shrink-0">💻 POS 419</span>';
        } else if (tieneEnvio) {
            origenBadgeHtml = '<span class="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[9px] font-extrabold shrink-0">🚚 Paquetería</span>';
        }

        const cardHtml = `
            <div class="bg-dark-100/90 border border-white/10 ${borderLeftClass} rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-white/20 transition-all duration-200 group">
                <div class="p-2 sm:px-3 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    
                    <!-- Bloque Izquierdo: ID, Copiar, Origen, Cliente y Metadatos -->
                    <div class="flex flex-wrap items-center gap-2 min-w-0 flex-grow">
                        <!-- ID Copiable -->
                        <button type="button" onclick="window.copyToClipboard('${orden.id_orden}', 'ID de Orden')" class="font-mono text-[11px] sm:text-xs font-black text-white bg-black/50 hover:bg-black/80 px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1 transition-colors cursor-pointer shrink-0" title="Copiar ID de Orden">
                            <span>${orden.id_orden}</span>
                            <svg class="w-3 h-3 text-gray-400 group-hover:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>

                        <!-- Origen Badge -->
                        ${origenBadgeHtml}

                        <!-- Cliente -->
                        <div onclick="openOrderDetailsModal('${orden.id_orden}')" class="flex items-center gap-1 cursor-pointer hover:underline min-w-0">
                            <span class="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title="${finalNombreCliente}">👤 ${finalNombreCliente}</span>
                        </div>

                        <!-- Fecha y Piezas -->
                        <span class="text-[10px] text-gray-400 font-medium hidden lg:inline-flex items-center gap-1">📅 ${dateStr}</span>
                        <span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono font-bold text-[9px] shrink-0">📦 ${totalPiezas} pzs</span>
                    </div>

                    <!-- Bloque Derecho: Selector Estatus, Precio y Detalle -->
                    <div class="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-white/5 w-full md:w-auto">
                        <!-- Estatus Selector Compacto -->
                        <select onchange="updateOrderStatus('${orden.id_orden}', this.value)" onclick="event.stopPropagation()" class="bg-dark-200 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer transition-colors ${estatusColorClass}">
                            ${estatusOptionsHtmlSelect}
                        </select>

                        <!-- Precio -->
                        <div onclick="openOrderDetailsModal('${orden.id_orden}')" class="text-right min-w-[70px] cursor-pointer">
                            ${priceDisplayHtml}
                        </div>

                        <!-- Botón Ver Detalle -->
                        <button type="button" onclick="openOrderDetailsModal('${orden.id_orden}')" class="px-2.5 py-1 rounded-lg bg-navy-500/20 hover:bg-navy-500/50 text-navy-300 hover:text-white border border-navy-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0" title="Ver detalle completo de la orden">
                            <span>👁️</span>
                            <span class="hidden sm:inline">Detalle</span>
                        </button>
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

            const extraCostModal = getExtraSizePrice(art.talla);
            let tallaModalHtml = `<span class="text-gray-200 font-semibold">${art.talla}</span>`;
            if (extraCostModal > 0) {
                tallaModalHtml = `<span class="text-amber-400 font-bold">${art.talla} (+$${extraCostModal.toFixed(2)} Talla Extra)</span>`;
            }

            return `
    <div class="flex items-center gap-3 bg-dark-200/40 p-3 rounded-xl border border-white/10 mb-3 last:mb-0 relative group">
        <img src="${imgUrl}" alt="Foto" onclick="window.openModal('${imgUrl}')" class="w-16 h-16 rounded-lg object-cover bg-dark flex-shrink-0 cursor-pointer hover:scale-105 transition-transform border border-white/10" title="Clic para ver foto en tamaño completo">
        <div class="flex-grow min-w-0 pr-2">
            <h4 class="font-bold text-white text-sm truncate leading-tight">${nombre}</h4>
            <div class="text-[10px] text-gray-400 mt-1 font-medium uppercase tracking-wider">
                ${genero} | ${tipo} | ${version}
            </div>
            <div class="text-xs text-gray-400 mt-1">
                Talla: ${tallaModalHtml} | 
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
        
        // Verificar si el usuario que REALIZÓ el pedido tiene perfil de Administrador
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        const isCreadoPorAdmin = (clientObj && clientObj.perfil === 'Administrador') || 
                                 orden.perfil_cliente === 'Administrador' || 
                                 orden.perfil === 'Administrador' ||
                                 (orden.id_cliente && String(orden.id_cliente).toUpperCase().includes('ADMIN'));

        if (isDisponibleParaRecoger && isCreadoPorAdmin) {
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

async function promptWhatsAppNotification(id_orden, nuevo_estatus, trackingGuide, ordenOriginal) {
    const loggedUserStr = localStorage.getItem('logged_user');
    const loggedUser = loggedUserStr ? JSON.parse(loggedUserStr) : null;
    const currentProfile = localStorage.getItem('current_perfil') || (loggedUser ? loggedUser.perfil : '');
    const isAdmin = (currentProfile === 'Administrador' || currentProfile === 'Admin' || (loggedUser && (loggedUser.perfil === 'Administrador' || loggedUser.perfil === 'Admin')));

    if (!isAdmin) return;

    const id = String(id_orden).trim();
    const targetOrden = (typeof currentOrdenes !== 'undefined' && Array.isArray(currentOrdenes) ? currentOrdenes.find(o => String(o.id_orden).trim() === id) : null) 
        || (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes) ? allFetchedOrdenes.find(o => String(o.id_orden).trim() === id) : null)
        || ordenOriginal;
        
    const clientName = targetOrden?.nombre_cliente || 'Cliente';

    const confirmWa = await Swal.fire({
        title: '📱 Notificación por WhatsApp',
        text: `¿Deseas enviar una notificación por WhatsApp a "${clientName}" sobre la actualización del pedido ${id_orden}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Enviar WhatsApp',
        cancelButtonText: 'No Enviar',
        confirmButtonColor: '#25D366',
        cancelButtonColor: '#4b5563',
        background: '#151515', color: '#fff'
    });

    if (confirmWa.isConfirmed) {
        let rawPhone = targetOrden?.telefono_cliente || targetOrden?.telefono || targetOrden?.celular;
        if (!rawPhone) {
            const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(targetOrden?.id_cliente)) : null;
            rawPhone = clientObj ? (clientObj.telefono_cliente || clientObj.telefono || clientObj.celular) : null;
        }

        let finalPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
        if (finalPhone && finalPhone.length === 10) {
            finalPhone = '52' + finalPhone;
        }

        if (!finalPhone) {
            const { value: manualPhone } = await Swal.fire({
                title: 'WhatsApp no encontrado',
                text: `No se encontró número registrado para la orden ${id_orden}. Ingresa el número de WhatsApp del cliente:`,
                input: 'text',
                inputPlaceholder: 'Ej. 8132698182',
                showCancelButton: true,
                confirmButtonColor: '#25D366',
                confirmButtonText: 'Enviar WhatsApp',
                cancelButtonText: 'Cancelar',
                background: '#151515', color: '#fff'
            });
            if (manualPhone) {
                let clean = manualPhone.replace(/\D/g, '');
                if (clean.length === 10) clean = '52' + clean;
                if (clean) finalPhone = clean;
            }
        }

        if (finalPhone) {
            const nombreCorto = clientName.split(' ')[0];
            const mensajeGuia = trackingGuide ? `\n\n📦 *Número de Guía / Rastreo:* ${trackingGuide}` : '';
            const mensajeHorario = `\n\n⏰ *Horario de entrega:* 12:00 PM a 7:00 PM`;
            const waText = encodeURIComponent(`*Actualización de Pedido* 🚚\n\nHola ${nombreCorto},\nTe informamos que el estatus de tu orden *${id_orden}* ha cambiado a: *${nuevo_estatus}*.${mensajeGuia}${mensajeHorario}\n\n¡Gracias por tu preferencia!`);
            const waUrl = `https://wa.me/${finalPhone}?text=${waText}`;

            if (typeof abrirWhatsAppAutomatico === 'function') {
                abrirWhatsAppAutomatico(waUrl);
            } else {
                window.open(waUrl, '_blank');
            }
        }
    }
}

async function updateOrderStatus(id_orden, nuevo_estatus) {
    if (!nuevo_estatus) return;
    
    const id = String(id_orden).trim();
    const selects = document.querySelectorAll(`select[onchange="updateOrderStatus('${id_orden}', this.value)"]`);
    
    const ordenOriginal = (typeof currentOrdenes !== 'undefined' && Array.isArray(currentOrdenes) ? currentOrdenes.find(o => String(o.id_orden).trim() === id) : null) 
        || (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes) ? allFetchedOrdenes.find(o => String(o.id_orden).trim() === id) : null)
        || (typeof allUserOrdenesFetched !== 'undefined' && Array.isArray(allUserOrdenesFetched) ? allUserOrdenesFetched.find(o => String(o.id_orden).trim() === id) : null);

    const estatusPrevio = ordenOriginal ? ordenOriginal.estatus : "";

    // 1. Confirmación de seguridad únicamente si se cancela la orden
    const isCancelacion = String(nuevo_estatus).toLowerCase() === 'cancelada';
    if (isCancelacion) {
        const result = await Swal.fire({
            title: '¿Cancelar orden?',
            text: `¿Estás seguro que deseas cancelar la orden ${id_orden}? Esto devolverá los artículos al inventario.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#3f3f46',
            confirmButtonText: 'Sí, cancelar orden',
            cancelButtonText: 'No, mantener',
            background: '#151515', color: '#fff'
        });

        if (!result.isConfirmed) {
            selects.forEach(sel => sel.value = estatusPrevio);
            const modalSelect = document.getElementById('admin-order-details-status');
            if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
                modalSelect.value = estatusPrevio;
            }
            return;
        }
    }

    // 2. Si el estatus requiere número de guía (Paquetería)
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
            selects.forEach(sel => sel.value = estatusPrevio);
            const modalSelect = document.getElementById('admin-order-details-status');
            if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
                modalSelect.value = estatusPrevio;
            }
            return;
        }
        trackingGuide = trackingNum.trim();
    }

    // 3. ⚡ ACTUALIZACIÓN OPTIMISTA INMEDIATA EN MEMORIA Y UI (0ms)
    if (ordenOriginal) {
        ordenOriginal.estatus = nuevo_estatus;
        if (trackingGuide) ordenOriginal.guia = trackingGuide;
    }
    const updatesList = [currentOrdenes, allFetchedOrdenes, allUserOrdenesFetched];
    updatesList.forEach(arr => {
        if (Array.isArray(arr)) {
            const found = arr.find(o => String(o.id_orden).trim() === id);
            if (found) {
                found.estatus = nuevo_estatus;
                if (trackingGuide) found.guia = trackingGuide;
            }
        }
    });

    // Actualizar select de modal si está abierto
    const modalSelect = document.getElementById('admin-order-details-status');
    if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
        modalSelect.value = nuevo_estatus;
    }

    // 🔄 Si es cancelación, devolver stock local en memoria de inmediato (0ms)
    if (isCancelacion && ordenOriginal) {
        try {
            if (Array.isArray(ordenOriginal.articulos_carrito)) {
                ordenOriginal.articulos_carrito.forEach(item => {
                    let pId = "";
                    if (item.id_playera && typeof item.id_playera === 'object') {
                        pId = String(item.id_playera.id || item.id_playera.id_producto || "").trim().toUpperCase();
                    } else if (item.id_playera) {
                        pId = String(item.id_playera).trim().toUpperCase();
                    } else if (item.id_producto) {
                        pId = String(item.id_producto).trim().toUpperCase();
                    }
                    const sz = String(item.talla || "").trim().toUpperCase();
                    const qty = Number(item.cantidad || 1);

                    if (pId && sz) {
                        // Devolver stock devuelto ÚNICAMENTE a Bodega General (allProducts)
                        if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
                            const prodGen = allProducts.find(p => String(p.id || p.id_producto || "").trim().toUpperCase() === pId);
                            if (prodGen && Array.isArray(prodGen.tallas)) {
                                const tObj = prodGen.tallas.find(t => String(t.talla || t.Talla || "").trim().toUpperCase() === sz);
                                if (tObj) {
                                    const st = Number(tObj.stock !== undefined ? tObj.stock : (tObj.inventario || 0));
                                    tObj.stock = st + qty;
                                    tObj.inventario = st + qty;
                                }
                            }
                        }
                        // NOTA: El stock de Local 419 NO se incrementa en cancelaciones.
                        // El stock de Local 419 se incrementará ÚNICAMENTE al cambiar el estatus a "Finalizada".
                    }
                });
                if (typeof renderProductsWithFilters === 'function') renderProductsWithFilters();
            }
        } catch (eRest) {
            console.warn("Error devolviendo stock en memoria optimista:", eRest);
        }
    }

    // Refrescar vista de órdenes de inmediato (0ms)
    if (typeof renderOrdenes === 'function') renderOrdenes();

    // Notificación Toast flotante no bloqueante (0ms)
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
    });
    Toast.fire({
        icon: 'success',
        title: `⚡ Orden ${id_orden}`,
        text: `Estatus cambiado a "${nuevo_estatus}"`
    });

    // ⚡ Lanzar inmediatamente el modal de notificación por WhatsApp (0ms latencia) sin esperar respuesta de red
    promptWhatsAppNotification(id_orden, nuevo_estatus, trackingGuide, ordenOriginal);

    // 4. 🌐 PROCESAMIENTO EN SEGUNDO PLANO SIN BLOQUEAR LA PANTALLA
    const payload = {
        action: 'update_order_status',
        id_orden: id_orden,
        nuevo_estatus: nuevo_estatus,
        guia: trackingGuide
    };

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(async (response) => {
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (jsonErr) {
            console.error("Respuesta no válida del servidor:", rawText);
            throw new Error("El servidor devolvió una respuesta inesperada.");
        }

        if (data.status === 'success') {
            if (isCancelacion) {
                if (typeof fetchInitialProducts === 'function') fetchInitialProducts(true);
                if (typeof fetchProducts419 === 'function') fetchProducts419(true);
            }

            const isFinalizada = (String(nuevo_estatus).toLowerCase() === 'finalizada' || String(nuevo_estatus).toLowerCase() === 'completada');
            const is419Order = ordenOriginal && (
                String(ordenOriginal.id_cliente || '').toUpperCase().includes('419') ||
                String(ordenOriginal.tipo_precio_aplicado || '').toLowerCase().includes('419') ||
                String(ordenOriginal.tipo_precio_aplicado || '').toLowerCase().includes('surtido') ||
                String(id_orden).toUpperCase().includes('419')
            );

            if (isFinalizada && is419Order && Array.isArray(ordenOriginal.articulos_carrito)) {
                ordenOriginal.articulos_carrito.forEach(async (item) => {
                    let pId = "";
                    if (item.id_playera && typeof item.id_playera === 'object') {
                        pId = String(item.id_playera.id || item.id_playera.id_producto || "").trim().toUpperCase();
                    } else if (item.id_playera) {
                        pId = String(item.id_playera).trim().toUpperCase();
                    } else if (item.id_producto) {
                        pId = String(item.id_producto).trim().toUpperCase();
                    }
                    const sz = String(item.talla || "").trim().toUpperCase();
                    const qty = Number(item.cantidad || 1);

                    if (pId && sz) {
                        let target419 = (allProducts419 || []).find(p => String(p.id || '').toUpperCase() === pId);
                        let currentSt419 = 0;
                        if (target419 && Array.isArray(target419.tallas)) {
                            let t419 = target419.tallas.find(t => String(t.talla || '').trim().toUpperCase() === sz);
                            if (t419) {
                                currentSt419 = Number(t419.stock !== undefined ? t419.stock : (t419.inventario || 0)) || 0;
                            }
                        }
                        const newStock419 = currentSt419 + qty;
                        try {
                            await updateLocal419SizeStock(pId, sz, newStock419);
                        } catch(eStk) {}
                    }
                });
                if (typeof fetchProducts419 === 'function') fetchProducts419(true);
            }

            if (data.super_mayoreo_procesado) {
                const sm = data.super_mayoreo_procesado;
                const loggedUserStr = localStorage.getItem('logged_user');
                if (loggedUserStr) {
                    try {
                        let loggedUser = JSON.parse(loggedUserStr);
                        if (loggedUser && (String(loggedUser.id) === String(sm.id_cliente) || String(loggedUser.usuario) === String(sm.id_cliente))) {
                            loggedUser.perfil = sm.perfil;
                            loggedUser.super_mayoreo_exp = sm.super_mayoreo_exp;
                            loggedUser.super_mayoreo_acum = sm.super_mayoreo_acum;
                            localStorage.setItem('logged_user', JSON.stringify(loggedUser));
                            localStorage.setItem('current_perfil', sm.perfil);
                            if (typeof updateUserLoginUI === 'function') updateUserLoginUI(loggedUser);
                        }
                    } catch(e) {}
                }
            }
        } else {
            throw new Error(data.message || 'Error al actualizar estatus en servidor.');
        }
    })
    .catch((error) => {
        console.error('Error actualizando estatus:', error);

        // Revertir cambio optimista en memoria
        updatesList.forEach(arr => {
            if (Array.isArray(arr)) {
                const found = arr.find(o => String(o.id_orden).trim() === id);
                if (found) found.estatus = estatusPrevio;
            }
        });
        if (typeof renderOrdenes === 'function') renderOrdenes();

        selects.forEach(sel => sel.value = estatusPrevio);
        const modalSelect = document.getElementById('admin-order-details-status');
        if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
            modalSelect.value = estatusPrevio;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: `No se pudo guardar la orden en el servidor (${error.message}). Se ha revertido el estatus.`,
            background: '#151515', color: '#fff'
        });
    });
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
            foto: tempPerfilFotoUrl,
            fecha_actualizacion: new Date().toISOString().replace('T', ' ').substring(0, 19)
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
    const cacheKey = 'cache_user_ordenes_' + String(loggedUser.id_cliente).trim();

    if (allFetchedOrdenes && allFetchedOrdenes.length > 0 && !force) {
        return allFetchedOrdenes.filter(o => String(o.id_cliente).trim() === String(loggedUser.id_cliente).trim());
    }
    
    if (window.startTopLoadingBar) startTopLoadingBar();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "search_orders", filtros: { id_cliente: loggedUser.id_cliente } })
        });
        const data = await response.json();
        if (data.status === "success") {
            const fetchedList = data.data || [];
            allFetchedOrdenes = fetchedList;
            const clientOrders = fetchedList.filter(o => String(o.id_cliente).trim() === String(loggedUser.id_cliente).trim());
            try {
                localStorage.setItem(cacheKey, JSON.stringify(clientOrders));
            } catch (eCache) {}
            return clientOrders;
        } else {
            console.error('Error fetching orders:', data.message);
            return [];
        }
    } catch (e) {
        console.error('Error in fetchUserOrdenes:', e);
        return [];
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}

async function openUserOrdenesModal() {
    const loggedUserStr = localStorage.getItem('logged_user');
    if (!loggedUserStr) {
        Swal.fire({ icon: 'warning', title: 'No Autenticado', text: 'Inicia sesión para ver tus pedidos.', background: '#151515', color: '#fff' });
        return;
    }
    const loggedUser = JSON.parse(loggedUserStr);
    const cacheKey = 'cache_user_ordenes_' + String(loggedUser.id_cliente).trim();
    
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
    setTimeout(() => { modal.classList.remove('opacity-0'); }, 10);
    
    let hasInstantCache = false;
    try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            const cachedOrders = JSON.parse(cachedRaw);
            if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
                allUserOrdenesFetched = cachedOrders;
                hasInstantCache = true;
                loading.classList.add('hidden');
                empty.classList.add('hidden');
                renderUserOrdenesList();
            }
        }
    } catch (eC) {}

    if (!hasInstantCache) {
        loading.classList.remove('hidden');
        empty.classList.add('hidden');
        if (list) list.innerHTML = '';
    }
    
    // Sincronización en segundo plano (Stale-While-Revalidate)
    fetchUserOrdenes(true).then((freshOrders) => {
        if (freshOrders && Array.isArray(freshOrders)) {
            allUserOrdenesFetched = freshOrders;
            loading.classList.add('hidden');
            renderUserOrdenesList();
        }
    });
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
        
        const isSurtido419User = String(orden.id_orden).toUpperCase().includes('419') || orden.origen === '419' || orden.tipo_precio_aplicado === 'Surtido 419';
        const userOrderTotal = isSurtido419User ? 0 : Number(orden.total_neto !== undefined ? orden.total_neto : (Number(orden.gran_total || 0) + (Number(orden.envio_costo) || 0)));
        
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
                    <span class="text-emerald-400 font-bold">Total: $${userOrderTotal.toFixed(2)}</span>
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
        
        const itemFotoUrl = getFirstImage(item.id_playera ? item.id_playera.foto : (item.foto || ''));
        art.innerHTML = `
            <div class="w-16 h-16 sm:w-20 sm:h-20 bg-dark-200 rounded-lg overflow-hidden flex-shrink-0 relative border border-white/5 cursor-pointer hover:scale-105 transition-transform" onclick="window.openModal('${itemFotoUrl}')" title="Clic para ver foto en tamaño completo">
                <img src="${itemFotoUrl}" class="w-full h-full object-cover" alt="Jersey">
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
    
    if (window.startTopLoadingBar) startTopLoadingBar();
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
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
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

    // Guardar la selección en la estructura local en memoria
    if (currentSupplierOrderEditing && currentSupplierOrderEditing._groupedItems) {
        const groupKeys = Object.keys(currentSupplierOrderEditing._groupedItems);
        const groupKey = groupKeys[idx];
        if (groupKey && currentSupplierOrderEditing._groupedItems[groupKey]) {
            currentSupplierOrderEditing._groupedItems[groupKey].id_producto = selectedId;
        }
    }
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
            
            // Invalidad caché local del catálogo para asegurar datos 100% frescos
            try {
                localStorage.removeItem('jerseys_products_cache_v5');
            } catch (eCache) {}

            // Recargar catálogo de productos en memoria desde el servidor
            if (typeof fetchInitialProducts === 'function') {
                await fetchInitialProducts(true);
            }
            window.allProducts = allProducts;

            // Refrescar vistas en pantalla
            if (typeof renderAdminTable === 'function') {
                renderAdminTable();
            }
            if (typeof renderProductsWithFilters === 'function') {
                renderProductsWithFilters();
            }

            await Swal.fire({
                icon: 'success',
                title: isCompleted ? '¡Pedido Completado e Ingresado!' : '¡Ingreso Parcial Registrado!',
                text: isCompleted 
                    ? `Se sumaron ${totalReceivedInThisIngress} piezas al stock del catálogo y el pedido ${folio} ha sido actualizado a COMPLETADO.` 
                    : `Se sumaron ${totalReceivedInThisIngress} piezas al stock. El pedido ${folio} permanece PENDIENTE/PARCIAL por las piezas restantes.`,
                background: '#151515', color: '#fff',
                confirmButtonColor: '#10b981'
            });
            
            closeSupplierOrderDetailsModal();
            loadSupplierOrders();
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
let ytProgressInterval = null;

function startTopLoadingBar() {
    const bar = document.getElementById('yt-top-loading-bar');
    if (!bar) return;

    if (ytProgressInterval) clearInterval(ytProgressInterval);

    bar.style.transition = 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease';
    bar.style.opacity = '1';
    bar.style.width = '20%';

    let currentProgress = 20;
    ytProgressInterval = setInterval(() => {
        if (currentProgress < 75) {
            currentProgress += Math.random() * 8 + 4;
            bar.style.width = `${Math.min(currentProgress, 75)}%`;
        } else if (currentProgress < 92) {
            currentProgress += Math.random() * 2 + 0.5;
            bar.style.width = `${Math.min(currentProgress, 92)}%`;
        }
    }, 200);
}
window.startTopLoadingBar = startTopLoadingBar;

function finishTopLoadingBar() {
    const bar = document.getElementById('yt-top-loading-bar');
    if (!bar) return;

    if (ytProgressInterval) {
        clearInterval(ytProgressInterval);
        ytProgressInterval = null;
    }

    bar.style.transition = 'width 180ms cubic-bezier(0, 0, 0.2, 1), opacity 250ms ease-out 180ms';
    bar.style.width = '100%';

    setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => {
            bar.style.transition = 'none';
            bar.style.width = '0%';
        }, 300);
    }, 200);
}
window.finishTopLoadingBar = finishTopLoadingBar;

async function fetchProducts419(force = false) {
    if (isLocal419Loading && !force) return;
    
    const gridContainer = document.getElementById('local419-inventario-grid');
    const CACHE_KEY_419 = 'local419_products_cache_v1';

    // ⚡ 1. Carga instantánea desde Caché Local (Stale-While-Revalidate < 15ms)
    if (!force) {
        try {
            const cachedStr = localStorage.getItem(CACHE_KEY_419);
            if (cachedStr) {
                const cachedWrapper = JSON.parse(cachedStr);
                if (cachedWrapper && cachedWrapper.data && Array.isArray(cachedWrapper.data)) {
                    allProducts419 = cachedWrapper.data;
                    renderInventario419Grid(allProducts419);
                }
            }
        } catch (eCache) {}
    }

    // Si no hay nada en pantalla, mostrar esqueletos elegantes de carga
    if ((!allProducts419 || allProducts419.length === 0) && gridContainer) {
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
                    </div>
                    <div class="h-6 bg-amber-500/10 border border-amber-500/20 rounded-lg w-28"></div>
                </div>
            </div>
        `).join('');
    }

    isLocal419Loading = true;
    startTopLoadingBar();

    try {
        const [jerseyRes, artRes] = await Promise.all([
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'search',
                    origen: '419',
                    filtros: { nombre: "", tipo: "", version: "", genero: "" }
                })
            }).then(r => r.json()).catch(() => ({ status: "error", data: [] })),

            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "search_articulos_419" })
            }).then(r => r.json()).catch(() => ({ status: "error", data: [] }))
        ]);

        let productsData = [];
        if (Array.isArray(jerseyRes)) {
            productsData = jerseyRes;
        } else if (jerseyRes && jerseyRes.status === 'success') {
            productsData = jerseyRes.data || jerseyRes.productos || [];
        }

        let articulosData = [];
        if (artRes && artRes.status === 'success' && Array.isArray(artRes.data)) {
            articulosData = artRes.data.map(art => ({
                id: art.id || art.id_articulo,
                id_articulo: art.id_articulo || art.id,
                nombre: art.nombre,
                equipo: art.nombre,
                tipo: art.marca || "Deportivo",
                version: art.categoria || "Accesorio",
                genero: "Accesorio",
                foto: art.foto,
                precio_menudeo: Number(art.precio_menudeo || 0),
                precio_mayoreo: Number(art.precio_mayoreo || 0),
                precio_mayoreo_super: Number(art.precio_mayoreo || 0),
                precio_Menudeo: Number(art.precio_menudeo || 0),
                precio: Number(art.precio_menudeo || 0),
                activo: art.activo !== undefined ? art.activo : 1,
                es_articulo: true,
                tallas: (art.variantes || []).map(v => ({
                    talla: v.variante || "Unitalla",
                    stock: Number(v.stock) || 0,
                    id_inventario: v.id_inventario
                }))
            }));
        }

        allProducts419 = [...productsData, ...articulosData];

        try {
            localStorage.setItem(CACHE_KEY_419, JSON.stringify({ data: allProducts419, timestamp: Date.now() }));
        } catch (eSave) {}

        renderInventario419Grid(allProducts419);
    } catch (err) {
        console.error('Error al cargar inventario de Local 419:', err);
        if ((!allProducts419 || allProducts419.length === 0) && gridContainer) {
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
        finishTopLoadingBar();
    }
}
window.fetchProducts419 = fetchProducts419;

function renderInventario419Grid(products) {
    const gridContainer = document.getElementById('local419-inventario-grid');
    if (!gridContainer) return;

    const searchInput = document.getElementById('inv419-search-input');
    if (searchInput && !searchInput.dataset.hasListener) {
        searchInput.dataset.hasListener = "true";
        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => renderInventario419Grid(allProducts419), 50);
        });
    }

    const searchTerm = searchInput ? searchInput.value : '';
    const filtered = (products || []).filter(p => {
        if (!searchTerm) return true;
        const targetStr = `${p.equipo || ''} ${p.nombre || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''}`;
        return matchText(targetStr, searchTerm);
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 italic">No se encontraron productos registrados en el inventario del Local 419.</div>`;
        return;
    }

    const mainCatalog = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);

    gridContainer.innerHTML = filtered.map(prod => {
        const rawImg = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const imgUrl = getOptimizedImageUrl(rawImg, 400);
        const equipoNombre = (prod.nombre || prod.equipo || 'JERSEY DESCONOCIDO').toUpperCase();
        const tipo = (prod.tipo || 'DESCONOCIDO').toUpperCase();
        const version = (prod.version || 'REGULAR').toUpperCase();
        const genero = (prod.genero || 'HOMBRE').toUpperCase();
        
        // 🌟 Resolución inteligente de precios (evita $0.00 en pantalla)
        let precioVal = Number(prod.precio_menudeo || prod.precio || prod.precio_mayoreo || 0);
        if (precioVal === 0) {
            const mainMatch = mainCatalog.find(ap => String(ap.id || '').toUpperCase() === String(prod.id || '').toUpperCase() || String(ap.nombre || '').toUpperCase() === String(equipoNombre).toUpperCase());
            if (mainMatch) {
                precioVal = Number(mainMatch.precio_menudeo || mainMatch.precio_mayoreo || mainMatch.precio || 0);
            }
        }
        const precioDisplay = precioVal > 0 ? `$${precioVal.toFixed(2)}` : 'Consultar';

        // Extraer arreglo de tallas del producto
        const tallasArray = Array.isArray(prod.tallas) ? prod.tallas : [];
        let sizeBoxesHtml = '';
        let totalStock419 = 0;

        if (tallasArray.length > 0) {
            sizeBoxesHtml = tallasArray.map(tObj => {
                const sz = String(tObj.talla || '').toUpperCase();
                const shortSz = formatShortTallaLabel(sz);
                const cant = Number(tObj.stock || 0);
                totalStock419 += cant;
                const hasStock = cant > 0;
                
                const boxStyle = hasStock
                    ? 'bg-[#222226] text-white border-white/10 hover:border-amber-400'
                    : 'bg-white/5 text-gray-500 border-white/5 opacity-60';

                const badgeBg = hasStock ? 'bg-amber-500 text-black font-extrabold' : 'bg-gray-700 text-gray-300';

                return `
                <div class="relative group/size cursor-pointer" onclick="openLocal419InventoryModal('${prod.id}')" title="Gestionar existencias 419 (Talla ${sz})">
                    <div class="min-w-[2.5rem] px-1.5 h-10 sm:min-w-[2.75rem] sm:h-11 rounded-xl border flex items-center justify-center font-bold text-xs ${boxStyle} transition-all shadow-sm whitespace-nowrap">
                        ${shortSz}
                    </div>
                    <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full ${badgeBg} text-[10px] flex items-center justify-center shadow-md border border-dark-100">
                        ${cant}
                    </span>
                </div>`;
            }).join('');
        }

        const stockBadgeColor = totalStock419 > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/10 text-red-400 border-red-500/20';

        const addTallaBtn = `
        <div class="relative cursor-pointer" onclick="openLocal419InventoryModal('${prod.id}')" title="Añadir / Gestionar Tallas Local 419">
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
                    <span class="absolute top-2 right-2 px-2.5 py-1 rounded-lg ${stockBadgeColor} font-bold text-[10px] uppercase border shadow-md backdrop-blur-xs">
                        ${totalStock419} pcs
                    </span>
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
                    <span class="text-sm font-bold text-amber-400">${precioDisplay}</span>
                </div>
            </div>

            <!-- Sección de Tallas y Existencias Local 419 -->
            <div class="pt-3 border-t border-white/5">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Existencias 419:</span>
                    <button type="button" onclick="openLocal419InventoryModal('${prod.id}')" class="text-amber-400 hover:underline font-bold text-[9px] flex items-center gap-1">
                        <span>✏️ Gestionar</span>
                    </button>
                </div>
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

    const targetProd = (allProducts419 || []).find(p => String(p.id || p.id_articulo).toUpperCase() === String(id_playera).toUpperCase());
    const isArt = targetProd && targetProd.es_articulo;

    try {
        const payload = isArt ? {
            action: 'update_stock_articulo',
            origen: '419',
            id_articulo: id_playera,
            variante: talla,
            stock: cantNum
        } : {
            action: 'update_stock_talla',
            origen: '419',
            id_playera: id_playera,
            talla: talla,
            cantidad: cantNum,
            token: localStorage.getItem('session_token') || ''
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.status === 'success') {
            if (targetProd) {
                if (Array.isArray(targetProd.tallas)) {
                    const item = targetProd.tallas.find(x => String(x.talla).trim().toUpperCase() === String(talla).trim().toUpperCase());
                    if (item) item.stock = cantNum;
                    else targetProd.tallas.push({ talla: talla, stock: cantNum, id_inventario: '' });
                }
            }
        } else {
            throw new Error(data.message || 'No se pudo actualizar el stock en Local 419');
        }
    } catch (err) {
        console.error('Error al actualizar stock 419:', err);
        throw err;
    }
}
window.updateLocal419SizeStock = updateLocal419SizeStock;

// =========================================================================
// MÓDULO LOCAL 419: GESTIÓN DE TALLAS EN LOTE (MODAL ESTILO INVENTARIO GENERAL)
// =========================================================================

let currentJersey419ToManage = null;

function updateNewTalla419Select(producto) {
    const selectNew = document.getElementById('new-talla-419-val');
    if (!selectNew || !producto) return;

    const genero = producto.genero || 'Hombre';
    const tallasGenericas = getTallasForGender(genero);
    const existentes = producto.tallas || [];

    const disponibles = tallasGenericas.filter(t => {
        const yaExiste = existentes.some(ex => isSameTalla(ex.talla, t));
        return !yaExiste;
    });

    if (disponibles.length === 0) {
        selectNew.innerHTML = `<option value="" disabled selected>Todas las tallas agregadas</option>`;
    } else {
        selectNew.innerHTML = `<option value="" disabled selected>Elige talla...</option>` +
            disponibles.map(t => `<option value="${t}">${t}</option>`).join('');
    }
}
window.updateNewTalla419Select = updateNewTalla419Select;

function openLocal419InventoryModal(idOrObj) {
    let prod = null;
    if (typeof idOrObj === 'object' && idOrObj !== null) {
        prod = idOrObj;
    } else {
        prod = (allProducts419 || []).find(p => String(p.id || p.id_articulo).toUpperCase() === String(idOrObj).toUpperCase());
    }

    if (!prod) return;

    // Clonar para permitir modificaciones locales antes de guardar
    currentJersey419ToManage = JSON.parse(JSON.stringify(prod));
    if (currentJersey419ToManage && Array.isArray(currentJersey419ToManage.tallas)) {
        currentJersey419ToManage.tallas.forEach((t, i) => {
            const origSource = (prod.tallas && prod.tallas[i]) ? prod.tallas[i] : t;
            t.stockOriginal = origSource.stockOriginal !== undefined ? origSource.stockOriginal : (origSource.stock !== undefined ? origSource.stock : (origSource.inventario || 0));
        });
    }

    const modal = document.getElementById('local419-inventory-manage-modal');
    if (!modal) return;

    const imgEl = document.getElementById('local419-inv-modal-img');
    const titleEl = document.getElementById('local419-inv-modal-title');
    const subEl = document.getElementById('local419-inv-modal-sub');
    const idEl = document.getElementById('local419-inv-modal-id');

    const rawImg = getFirstImage(currentJersey419ToManage.foto || currentJersey419ToManage.imagen);
    if (imgEl) imgEl.src = rawImg ? getOptimizedImageUrl(rawImg, 150) : 'https://via.placeholder.com/150';
    if (titleEl) titleEl.textContent = (currentJersey419ToManage.nombre || currentJersey419ToManage.equipo || 'JERSEY').toUpperCase();
    if (subEl) subEl.textContent = `Local 419 | ${currentJersey419ToManage.tipo || ''} ${currentJersey419ToManage.version || ''} (${currentJersey419ToManage.genero || 'Adulto'})`.trim();
    if (idEl) idEl.textContent = `ID: ${currentJersey419ToManage.id || currentJersey419ToManage.id_articulo}`;

    // Actualizar select de tallas con filtrado por género y exclusión de agregadas
    updateNewTalla419Select(currentJersey419ToManage);

    renderLocal419InventorySizes(currentJersey419ToManage);

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    modal.querySelector('.transform').classList.add('scale-100');
}
window.openLocal419InventoryModal = openLocal419InventoryModal;
window.editLocal419SizeStockPrompt = openLocal419InventoryModal;
window.addNewLocal419SizePrompt = openLocal419InventoryModal;

function closeLocal419InventoryModal() {
    const modal = document.getElementById('local419-inventory-manage-modal');
    if (!modal) return;

    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-100');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        const full419Modal = document.getElementById('local419-inventario-modal');
        if (!full419Modal || full419Modal.classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
        currentJersey419ToManage = null;
    }, 300);
}
window.closeLocal419InventoryModal = closeLocal419InventoryModal;

function renderLocal419InventorySizes(prod) {
    const container = document.getElementById('local419-inv-tallas-list');
    if (!container) return;

    container.innerHTML = '';

    if (!prod.tallas || prod.tallas.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 py-3 text-center italic bg-dark-200/20 rounded-xl border border-white/5">No hay tallas registradas en Local 419.</p>`;
        return;
    }

    prod.tallas.forEach((t, idx) => {
        const stockActual = t.stock !== undefined ? t.stock : (t.inventario || 0);
        const stockOriginal = t.stockOriginal !== undefined ? t.stockOriginal : stockActual;
        const isNewTag = t.isNew || (t.id_inventario && String(t.id_inventario).startsWith('TEMP_'));
        const displayTalla = String(t.talla || '');
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 bg-dark-200/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/20 transition-colors';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-10 bg-dark-200/60 border border-white/10 rounded-lg flex items-center justify-center font-bold text-amber-400 text-sm relative shadow-sm">
                    ${displayTalla}
                    ${isNewTag ? '<span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[7px] font-extrabold px-1 rounded-full shadow">NUEVA</span>' : ''}
                </div>
                <div>
                    <div class="text-xs text-gray-200 font-semibold">${prod.nombre || prod.equipo || ''}</div>
                    <div class="text-[10px] text-gray-400 flex items-center gap-1.5">
                        <span>Categoría: ${t.categoria || prod.genero || 'Adultos'}</span>
                        ${!isNewTag ? `<span class="text-amber-300/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Cantidad 419 antes de modificar">(Anterior: ${stockOriginal})</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                    <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">STOCK 419:</label>
                    <button type="button" class="btn-stock-minus-419 w-7 h-7 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/30 flex items-center justify-center font-bold text-sm transition-all" data-idx="${idx}" title="Restar 1 pieza">-</button>
                    <input type="number" min="0" value="${stockActual}" class="w-16 bg-dark-200/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-amber-300 input-stock-419-local-val" data-idx="${idx}">
                    <button type="button" class="btn-stock-plus-419 w-7 h-7 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/30 flex items-center justify-center font-bold text-sm transition-all" data-idx="${idx}" title="Sumar 1 pieza">+</button>
                </div>
                <button type="button" onclick="window.removeLocal419SizeFromMemory(${idx})" class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors" title="Eliminar talla">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(div);
    });

    // Escuchar cambios locales en los inputs (input directo)
    document.querySelectorAll('.input-stock-419-local-val').forEach(input => {
        input.addEventListener('focus', (e) => e.target.select());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveBatchTallas419();
            }
        });
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            const val = parseInt(e.target.value);
            if (!isNaN(idx) && currentJersey419ToManage && currentJersey419ToManage.tallas && currentJersey419ToManage.tallas[idx]) {
                currentJersey419ToManage.tallas[idx].stock = isNaN(val) || val < 0 ? 0 : val;
            }
        });
    });

    // Botones + y - para Inventario Local 419
    document.querySelectorAll('.btn-stock-minus-419').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const input = container.querySelector(`.input-stock-419-local-val[data-idx="${idx}"]`);
            if (input) {
                let currentVal = parseInt(input.value) || 0;
                let newVal = Math.max(0, currentVal - 1);
                input.value = newVal;
                if (currentJersey419ToManage && currentJersey419ToManage.tallas && currentJersey419ToManage.tallas[idx]) {
                    currentJersey419ToManage.tallas[idx].stock = newVal;
                }
            }
        });
    });

    document.querySelectorAll('.btn-stock-plus-419').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const input = container.querySelector(`.input-stock-419-local-val[data-idx="${idx}"]`);
            if (input) {
                let currentVal = parseInt(input.value) || 0;
                let newVal = currentVal + 1;
                input.value = newVal;
                if (currentJersey419ToManage && currentJersey419ToManage.tallas && currentJersey419ToManage.tallas[idx]) {
                    currentJersey419ToManage.tallas[idx].stock = newVal;
                }
            }
        });
    });
}

function removeLocal419SizeFromMemory(idx) {
    if (!currentJersey419ToManage || !currentJersey419ToManage.tallas) return;
    currentJersey419ToManage.tallas.splice(idx, 1);
    renderLocal419InventorySizes(currentJersey419ToManage);
    updateNewTalla419Select(currentJersey419ToManage);
}
window.removeLocal419SizeFromMemory = removeLocal419SizeFromMemory;

function handleAddNewTalla419(e) {
    if (e) e.preventDefault();
    if (!currentJersey419ToManage) return;

    const selectEl = document.getElementById('new-talla-419-val');
    const inputStockEl = document.getElementById('new-stock-419-val');

    const tallaVal = selectEl && selectEl.value ? String(selectEl.value).trim() : '';
    const stockVal = parseInt(inputStockEl ? inputStockEl.value : 0);

    if (!tallaVal) return;
    const finalStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;

    if (!currentJersey419ToManage.tallas) currentJersey419ToManage.tallas = [];

    // Verificar si la talla ya existe
    const existing = currentJersey419ToManage.tallas.find(t => String(t.talla).trim().toUpperCase() === tallaVal.toUpperCase());
    if (existing) {
        existing.stock = finalStock;
        existing.isNew = true;
    } else {
        currentJersey419ToManage.tallas.push({
            id_inventario: 'TEMP_419_' + Date.now(),
            id_producto: currentJersey419ToManage.id,
            talla: tallaVal,
            categoria: currentJersey419ToManage.genero || 'Adultos',
            stock: finalStock,
            isNew: true
        });
    }

    if (document.getElementById('form-add-talla-419')) {
        document.getElementById('form-add-talla-419').reset();
    }

    renderLocal419InventorySizes(currentJersey419ToManage);
    updateNewTalla419Select(currentJersey419ToManage);

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
        title: `Talla ${tallaVal} agregada. Presiona "Actualizar Datos" para guardar.`
    });
}

function addAllStandardTallas419() {
    if (!currentJersey419ToManage) return;

    const genero = currentJersey419ToManage.genero || 'Hombre';
    const tallasGenericas = getTallasForGender(genero);
    const inputStockEl = document.getElementById('new-stock-419-val');
    const stockVal = parseInt(inputStockEl ? inputStockEl.value : 0);
    const finalStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;

    if (!currentJersey419ToManage.tallas) currentJersey419ToManage.tallas = [];

    let addedCount = 0;
    tallasGenericas.forEach(sz => {
        const existing = currentJersey419ToManage.tallas.find(t => isSameTalla(t.talla, sz));
        if (!existing) {
            currentJersey419ToManage.tallas.push({
                id_inventario: 'TEMP_419_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                id_producto: currentJersey419ToManage.id,
                talla: sz,
                categoria: currentJersey419ToManage.genero || 'Adultos',
                stock: finalStock,
                isNew: true
            });
            addedCount++;
        }
    });

    renderLocal419InventorySizes(currentJersey419ToManage);
    updateNewTalla419Select(currentJersey419ToManage);

    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2500,
        background: '#141416',
        color: '#fff'
    });

    if (addedCount > 0) {
        Toast.fire({
            icon: 'success',
            title: `⚡ Se agregaron ${addedCount} tallas (${tallasGenericas.join(', ')}). Presiona "Actualizar Datos" para guardar.`
        });
    } else {
        Toast.fire({
            icon: 'info',
            title: `Todas las tallas de ${genero} ya están en la lista.`
        });
    }
}
window.addAllStandardTallas419 = addAllStandardTallas419;

function handleSaveBatchTallas419() {
    if (!currentJersey419ToManage) return;

    // Sincronizar existencias leídas de los inputs
    document.querySelectorAll('.input-stock-419-local-val').forEach(input => {
        const idx = parseInt(input.getAttribute('data-idx'));
        const val = parseInt(input.value);
        if (!isNaN(idx) && currentJersey419ToManage && currentJersey419ToManage.tallas && currentJersey419ToManage.tallas[idx]) {
            currentJersey419ToManage.tallas[idx].stock = isNaN(val) || val < 0 ? 0 : val;
        }
    });

    const idPlayera = currentJersey419ToManage.id || currentJersey419ToManage.id_articulo;
    const tallasToSave = JSON.parse(JSON.stringify(currentJersey419ToManage.tallas || []));

    // ⚡ 1. ACTUALIZACIÓN OPTIMISTA EN MEMORIA DE INMEDIATO (0ms Latencia Visual)
    const localTarget = (allProducts419 || []).find(p => String(p.id || p.id_articulo).toUpperCase() === String(idPlayera).toUpperCase());
    if (localTarget) {
        localTarget.tallas = JSON.parse(JSON.stringify(tallasToSave));
    }

    // ⚡ 2. CERRAR MODAL Y RE-RENDERIZAR CATÁLOGO DE INMEDIATO
    closeLocal419InventoryModal();
    if (typeof renderInventario419Grid === 'function') {
        renderInventario419Grid(allProducts419);
    }

    // ⚡ 3. NOTIFICACIÓN TOAST INMEDIATA
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2000,
        background: '#141416',
        color: '#fff'
    });
    Toast.fire({
        icon: 'success',
        title: '⚡ Existencias actualizadas en Local 419'
    });

    // ⚡ 4. GUARDADO ASÍNCRONO EN SEGUNDO PLANO (BACKGROUND FETCH SIN BLOQUEAR UI)
    try {
        const payload = {
            action: 'save_batch_tallas',
            origen: '419',
            id_playera: idPlayera,
            genero: currentJersey419ToManage.genero || 'Adultos',
            tallas: tallasToSave.map(t => ({
                id_inventario: t.id_inventario || '',
                talla: t.talla,
                stock: t.stock !== undefined ? t.stock : (t.inventario || 0),
                categoria: t.categoria || currentJersey419ToManage.genero || 'Adultos'
            }))
        };

        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }).then(res => res.text()).then(resText => {
            let resObj = null;
            try { resObj = JSON.parse(resText); } catch(e) {}
            if (resObj && resObj.status === 'error') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al Guardar en Local 419',
                    text: resObj.message || 'No se pudieron guardar los cambios en la base de datos.',
                    background: '#151515', color: '#fff'
                });
            } else {
                try { localStorage.removeItem('local419_products_cache_v1'); } catch (eC) {}
            }
        }).catch(err => {
            console.error("Error en fondo guardando inventario batch 419:", err);
            Swal.fire({
                icon: 'warning',
                title: 'Error de Conexión',
                text: 'No se pudo sincronizar con el servidor. Revisa tu conexión a internet.',
                background: '#151515', color: '#fff'
            });
        });
    } catch (err) {
        console.error("Error al disparar guardado en fondo 419:", err);
    }
}



let openedPosFromInventario419 = false;

function openInventario419View() {
    const modal = document.getElementById('local419-inventario-modal');
    if (!modal) {
        console.error("No se encontró el elemento #local419-inventario-modal");
        return;
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    // Si el modal de POS estaba abierto, cerrarlo suavemente
    const posModal = document.getElementById('modal-pos-local419');
    if (posModal && !posModal.classList.contains('hidden')) {
        posModal.classList.add('opacity-0');
        setTimeout(() => { posModal.classList.add('hidden'); }, 300);
    }

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    if (typeof fetchProducts419 === 'function') {
        fetchProducts419();
    }
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
        const isInsideInventario = !!posBtn.closest('#local419-inventario-modal');
        if (typeof openPos419Modal === 'function') openPos419Modal(isInsideInventario);
        if (typeof closemobileMenu === 'function') closemobileMenu();
        return;
    }

    const ordenarBtn = e.target.closest('.action-local419-ordenar');
    if (ordenarBtn) {
        if (typeof closeInventario419View === 'function') closeInventario419View();
        if (typeof closePos419Modal === 'function') closePos419Modal();
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

// Event Listeners para la Vista de Inventario y POS 419
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-local419-inventario-modal');
    if (closeBtn) {
        closeBtn.onclick = () => closeInventario419View();
    }

    const closeManage419Btn = document.getElementById('close-local419-inventory-manage-modal');
    if (closeManage419Btn) {
        closeManage419Btn.onclick = () => closeLocal419InventoryModal();
    }

    const formAddTalla419 = document.getElementById('form-add-talla-419');
    if (formAddTalla419) {
        formAddTalla419.onsubmit = (e) => handleAddNewTalla419(e);
    }

    const btnSaveBatch419 = document.getElementById('btn-submit-save-tallas-419');
    if (btnSaveBatch419) {
        btnSaveBatch419.onclick = () => handleSaveBatchTallas419();
    }

    const closePosBtn = document.getElementById('close-pos-local419-modal');
    if (closePosBtn) {
        closePosBtn.onclick = () => closePos419Modal();
    }

    const btnLocal419Menu = document.getElementById('btn-local419-menu');
    if (btnLocal419Menu) {
        btnLocal419Menu.onclick = (e) => {
            e.preventDefault();
            window.isLocal419Mode = true;
            // En móvil abre la vista de inventario, en desktop se usa el menú desplegable
            if (window.innerWidth < 640 && typeof openInventario419View === 'function') {
                openInventario419View();
            }
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

    // Botones de conmutación de clientes en POS
    const btnMostrador = document.getElementById('btn-pos419-client-mostrador');
    if (btnMostrador) {
        btnMostrador.onclick = () => {
            selectPos419Client({ id_cliente: 'CLI-MOSTRADOR', nombre_completo: 'Cliente Mostrador', perfil: 'Menudeo' });
            const searchContainer = document.getElementById('pos419-client-search-container');
            if (searchContainer) searchContainer.classList.add('hidden');
        };
    }

    const btnToggleSearchClient = document.getElementById('btn-pos419-toggle-search-client');
    if (btnToggleSearchClient) {
        btnToggleSearchClient.onclick = () => {
            const searchContainer = document.getElementById('pos419-client-search-container');
            if (searchContainer) {
                searchContainer.classList.toggle('hidden');
                if (!searchContainer.classList.contains('hidden')) {
                    const input = document.getElementById('pos419-client-search-input');
                    if (input) input.focus();
                }
            }
        };
    }

    const clientSearchInput = document.getElementById('pos419-client-search-input');
    if (clientSearchInput) {
        clientSearchInput.oninput = (e) => filterPOS419Clients(e.target.value);
    }

    const btnSubmitPOS = document.getElementById('btn-submit-pos419');
    if (btnSubmitPOS) {
        btnSubmitPOS.onclick = () => submitPos419Order();
    }

    const inputMostradorName = document.getElementById('pos419-mostrador-name-input');
    if (inputMostradorName) {
        inputMostradorName.oninput = (e) => {
            if (pos419Client.id_cliente === 'CLI-MOSTRADOR') {
                pos419Client.nombre_mostrador_custom = e.target.value.trim();
                const nameEl = document.getElementById('pos419-active-client-name');
                if (nameEl) {
                    nameEl.textContent = pos419Client.nombre_mostrador_custom
                        ? `Cliente Mostrador (${pos419Client.nombre_mostrador_custom})`
                        : 'Cliente Mostrador';
                }
            }
        };
    }

    const discountValEl = document.getElementById('pos419-discount-val');
    if (discountValEl) discountValEl.oninput = () => recalculatePos419Cart();
});

// =========================================================================
// MÓDULO: PUNTO DE VENTA / VENTA EXPRÉS LOCAL 419
// =========================================================================

let pos419Cart = [];
let pos419Client = { id_cliente: 'CLI-MOSTRADOR', nombre_completo: 'Cliente Mostrador', perfil: 'Menudeo' };
let allClientsPOSCache = [];

function switchPOS419MobileTab(tab) {
    const colCatalog = document.getElementById('pos419-col-catalog');
    const colCart = document.getElementById('pos419-col-cart');
    const btnTabCatalog = document.getElementById('btn-pos419-tab-catalog');
    const btnTabCart = document.getElementById('btn-pos419-tab-cart');

    if (!colCatalog || !colCart) return;

    if (tab === 'cart') {
        colCatalog.classList.add('hidden');
        colCatalog.classList.remove('flex');
        colCart.classList.remove('hidden');
        colCart.classList.add('flex');

        if (btnTabCatalog && btnTabCart) {
            btnTabCatalog.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 border border-white/10';
            btnTabCart.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md border border-amber-400';
        }
    } else {
        colCatalog.classList.remove('hidden');
        colCatalog.classList.add('flex');
        colCart.classList.add('hidden');
        colCart.classList.remove('flex');

        if (btnTabCatalog && btnTabCart) {
            btnTabCatalog.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md border border-amber-400';
            btnTabCart.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 border border-white/10';
        }
    }
}
window.switchPOS419MobileTab = switchPOS419MobileTab;

async function openPos419Modal(fromInventarioView = false) {
    openedPosFromInventario419 = !!fromInventarioView;
    const modal = document.getElementById('modal-pos-local419');
    if (!modal) return;

    // 1. Resetear carrito y cliente a Cliente Mostrador
    pos419Cart = [];
    selectPos419Client({ id_cliente: 'CLI-MOSTRADOR', nombre_completo: 'Cliente Mostrador', perfil: 'Menudeo' });
    
    // Ocultar buscador de clientes por defecto
    const searchContainer = document.getElementById('pos419-client-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');

    // Activar pestaña Catálogo por defecto en móvil
    switchPOS419MobileTab('catalog');

    // 2. Cargar existencias de Local 419 si no están en memoria
    if (!allProducts419 || allProducts419.length === 0) {
        await fetchProducts419();
    }
    
    // Cargar caché de clientes silenciosamente para autocompletado
    loadClientsForPOS();

    // 3. Renderizar catálogo POS y vista previa
    renderPos419Catalog();
    renderPos419Cart();

    // 4. Mostrar modal con transición fluida
    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    // Si veníamos de la vista de inventario (Image 2), ocultarla suavemente detrás
    if (fromInventarioView) {
        setTimeout(() => {
            const invModal = document.getElementById('local419-inventario-modal');
            if (invModal && !modal.classList.contains('hidden')) {
                invModal.classList.add('hidden', 'opacity-0');
            }
        }, 320);
    }
}
window.openPos419Modal = openPos419Modal;

function closePos419Modal() {
    const modal = document.getElementById('modal-pos-local419');
    if (modal) {
        // Solo reabrir la vista de inventario si el POS fue abierto desde dentro del modal de inventario
        if (openedPosFromInventario419 && typeof window.openInventario419View === 'function') {
            window.openInventario419View();
        } else {
            document.body.style.overflow = '';
        }

        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}
window.closePos419Modal = closePos419Modal;

// =========================================================================
// 📋 MÓDULO DE AUDITORÍA Y CUADRE DE INVENTARIO (LOCAL 419 & GENERAL)
// =========================================================================
let auditTarget = '419'; // '419' o 'general'
let auditItemsMap = {};

window.openAuditoriaModal = async function(target = '419') {
    const modal = document.getElementById('modal-auditoria-inventario');
    if (!modal) return;

    auditTarget = target;

    // ⚡ ABRIR MODAL INMEDIATAMENTE (0ms de latencia)
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    const barcodeInput = document.getElementById('audit-barcode-input');
    if (barcodeInput) {
        barcodeInput.focus();
        barcodeInput.oninput = (e) => window.handleAuditoriaInput(e.target.value);
    }

    try {
        await window.switchAuditoriaTarget(auditTarget);
    } catch (eA) {
        console.error("Error al preparar auditoría:", eA);
    }
};

window.closeAuditoriaModal = function() {
    const modal = document.getElementById('modal-auditoria-inventario');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
};

window.switchAuditoriaTarget = async function(target) {
    auditTarget = target;
    const btn419 = document.getElementById('btn-audit-target-419');
    const btnGen = document.getElementById('btn-audit-target-gen');

    if (auditTarget === '419') {
        if (btn419) btn419.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border bg-amber-500 text-black border-amber-400 shadow-md';
        if (btnGen) btnGen.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border bg-white/5 text-gray-300 hover:text-white border-white/10';
        
        if (!allProducts419 || allProducts419.length === 0) {
            if (typeof fetchProducts419 === 'function') await fetchProducts419();
        }
    } else {
        if (btnGen) btnGen.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border bg-blue-600 text-white border-blue-400 shadow-md';
        if (btn419) btn419.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border bg-white/5 text-gray-300 hover:text-white border-white/10';
        
        if (!allProducts || allProducts.length === 0) {
            if (typeof fetchInitialProducts === 'function') await fetchInitialProducts();
        }
    }

    const draftKey = `audit_draft_${auditTarget}`;
    let loadedDraft = false;
    try {
        const draftStr = localStorage.getItem(draftKey);
        if (draftStr) {
            const parsed = JSON.parse(draftStr);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                auditItemsMap = parsed;
                loadedDraft = true;
            }
        }
    } catch(e) {}

    if (!loadedDraft) {
        window.loadAuditoriaSystemProducts();
    }

    window.renderAuditoriaTable();
};

window.loadAuditoriaSystemProducts = function() {
    auditItemsMap = {};
    const sourceProducts = (auditTarget === '419') ? (allProducts419 || []) : (allProducts || []);

    sourceProducts.forEach(prod => {
        const prodId = prod.id || prod.id_playera || prod.id_articulo;
        const nombre = prod.nombre || prod.equipo || 'Producto';
        const foto = prod.foto || prod.imagen || '';
        const precio = Number(prod.precio_menudeo || prod.precio || 0);
        const isArt = !!prod.es_articulo;
        const tallasArr = Array.isArray(prod.tallas) ? prod.tallas : [];

        tallasArr.forEach(tObj => {
            const sz = String(tObj.talla || 'M').toUpperCase();
            const stockSys = Number(tObj.stock !== undefined ? tObj.stock : tObj.inventario || 0);
            const itemKey = `${prodId}_${sz}`;

            auditItemsMap[itemKey] = {
                id: prodId,
                id_playera: prod.id_playera || prodId,
                id_articulo: prod.id_articulo || prodId,
                nombre: nombre,
                talla: sz,
                stock_sistema: stockSys,
                stock_contado: 0,
                foto: foto,
                es_articulo: isArt,
                precio: precio
            };
        });
    });
};

window.renderAuditoriaTable = function() {
    const container = document.getElementById('audit-items-container');
    const filterStatus = document.getElementById('audit-filter-status') ? document.getElementById('audit-filter-status').value : 'todos';
    const searchInput = document.getElementById('audit-barcode-input');
    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!container) return;

    let items = Object.values(auditItemsMap);

    let totalSistema = 0;
    let totalContado = 0;
    let piezasFaltantes = 0;
    let piezasSobrantes = 0;
    let difMonetaria = 0;

    items.forEach(item => {
        totalSistema += item.stock_sistema;
        totalContado += item.stock_contado;
        const diff = item.stock_contado - item.stock_sistema;
        if (diff < 0) piezasFaltantes += Math.abs(diff);
        if (diff > 0) piezasSobrantes += diff;
        difMonetaria += (diff * item.precio);
    });

    const elSistema = document.getElementById('audit-stat-sistema');
    const elContado = document.getElementById('audit-stat-contado');
    const elFaltantes = document.getElementById('audit-stat-faltantes');
    const elSobrantes = document.getElementById('audit-stat-sobrantes');
    const elMonetario = document.getElementById('audit-diferencia-monetaria');

    if (elSistema) elSistema.textContent = `${totalSistema} pzs`;
    if (elContado) elContado.textContent = `${totalContado} pzs`;
    if (elFaltantes) elFaltantes.textContent = `${piezasFaltantes} pzs`;
    if (elSobrantes) elSobrantes.textContent = `${piezasSobrantes} pzs`;
    if (elMonetario) {
        const formattedDif = (difMonetaria >= 0 ? '+$' : '-$') + Math.abs(difMonetaria).toFixed(2);
        elMonetario.textContent = `Ajuste monetario: ${formattedDif}`;
        elMonetario.className = `text-xs font-bold ${difMonetaria < 0 ? 'text-red-400' : (difMonetaria > 0 ? 'text-amber-400' : 'text-gray-400')}`;
    }

    if (q) {
        items = items.filter(i => {
            const targetText = `${i.nombre} ${i.talla} ${i.id}`.toLowerCase();
            return targetText.includes(q);
        });
    }

    if (filterStatus === 'diferencias') {
        items = items.filter(i => i.stock_contado !== i.stock_sistema);
    } else if (filterStatus === 'faltantes') {
        items = items.filter(i => i.stock_contado < i.stock_sistema);
    } else if (filterStatus === 'sobrantes') {
        items = items.filter(i => i.stock_contado > i.stock_sistema);
    } else if (filterStatus === 'cuadrados') {
        items = items.filter(i => i.stock_contado === i.stock_sistema);
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-500 text-xs italic">No hay registros que coincidan con el filtro seleccionado.</div>`;
        return;
    }

    const html = items.map(item => {
        const itemKey = `${item.id}_${item.talla}`;
        const diff = item.stock_contado - item.stock_sistema;
        const imgUrl = getFirstImage(item.foto || '');

        let statusBadge = '';
        if (diff === 0) {
            statusBadge = `<span class="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">🟢 Cuadrado</span>`;
        } else if (diff > 0) {
            statusBadge = `<span class="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">🟡 Sobrante (+${diff})</span>`;
        } else {
            statusBadge = `<span class="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">🔴 Faltante (${diff})</span>`;
        }

        return `
            <div class="p-2.5 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors rounded-lg">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${imgUrl}" class="w-10 h-10 object-cover rounded-lg bg-dark-200 border border-white/10 flex-shrink-0" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=150';">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-white text-xs truncate">${item.nombre}</h4>
                            ${statusBadge}
                        </div>
                        <div class="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                            <span class="bg-white/10 px-1.5 py-0.2 rounded font-bold text-gray-200">Talla: ${item.talla}</span>
                            <span>Sistema: <strong class="text-white">${item.stock_sistema}</strong></span>
                            <span>Contado: <strong class="text-emerald-400">${item.stock_contado}</strong></span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="flex items-center bg-black/50 border border-emerald-500/30 rounded-lg overflow-hidden">
                        <button type="button" onclick="window.updateAuditoriaQty('${itemKey}', -1)" class="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-bold cursor-pointer">-</button>
                        <input type="number" min="0" value="${item.stock_contado}" onchange="window.setAuditoriaQty('${itemKey}', this.value)" class="w-10 text-center text-xs font-bold text-emerald-400 bg-transparent focus:outline-none">
                        <button type="button" onclick="window.updateAuditoriaQty('${itemKey}', 1)" class="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-bold cursor-pointer">+</button>
                    </div>
                    <button type="button" onclick="window.setAuditoriaQty('${itemKey}', ${item.stock_sistema})" class="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-gray-300 rounded-lg border border-white/10 cursor-pointer" title="Igualar al Sistema">
                        Match
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
};

window.updateAuditoriaQty = function(itemKey, delta) {
    if (auditItemsMap[itemKey]) {
        const newQty = Math.max(0, auditItemsMap[itemKey].stock_contado + delta);
        auditItemsMap[itemKey].stock_contado = newQty;
        window.renderAuditoriaTable();
        window.saveAuditoriaDraftSilently();
    }
};

window.setAuditoriaQty = function(itemKey, value) {
    if (auditItemsMap[itemKey]) {
        const newQty = Math.max(0, parseInt(value) || 0);
        auditItemsMap[itemKey].stock_contado = newQty;
        window.renderAuditoriaTable();
        window.saveAuditoriaDraftSilently();
    }
};

window.handleAuditoriaInput = function(query) {
    window.renderAuditoriaTable();
};

window.incrementAuditoriaItemByProduct = function(product, sizeName) {
    if (!product || !sizeName) return;
    const prodId = product.id || product.id_playera || product.id_articulo;
    const sz = String(sizeName).toUpperCase();
    const itemKey = `${prodId}_${sz}`;

    if (!auditItemsMap[itemKey]) {
        const stockSys = (product.tallas || []).find(t => String(t.talla).toUpperCase() === sz);
        auditItemsMap[itemKey] = {
            id: prodId,
            id_playera: product.id_playera || prodId,
            id_articulo: product.id_articulo || prodId,
            nombre: product.nombre || product.equipo || 'Producto',
            talla: sz,
            stock_sistema: stockSys ? Number(stockSys.stock || stockSys.inventario || 0) : 0,
            stock_contado: 1,
            foto: product.foto || product.imagen || '',
            es_articulo: !!product.es_articulo,
            precio: Number(product.precio_menudeo || product.precio || 0)
        };
    } else {
        auditItemsMap[itemKey].stock_contado += 1;
    }

    window.renderAuditoriaTable();
    window.saveAuditoriaDraftSilently();

    const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1500, background: '#151515', color: '#fff' });
    toast.fire({ icon: 'success', title: `+1 Físico: ${product.nombre || product.equipo} (${sz}) ➔ Contado: ${auditItemsMap[itemKey].stock_contado}` });
};

window.saveAuditoriaDraftSilently = function() {
    try {
        const draftKey = `audit_draft_${auditTarget}`;
        localStorage.setItem(draftKey, JSON.stringify(auditItemsMap));
    } catch(e) {}
};

window.saveAuditoriaDraft = function() {
    window.saveAuditoriaDraftSilently();
    Swal.fire({
        toast: true, position: 'top-end', icon: 'success',
        title: 'Borrador guardado localmente', showConfirmButton: false, timer: 1800,
        background: '#151515', color: '#fff'
    });
};

window.resetAuditoriaCount = async function() {
    const res = await Swal.fire({
        title: '¿Reiniciar Conteo de Auditoría?',
        text: 'Esto pondrá todos los conteos físicos en 0 para esta ubicación.',
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, reiniciar', cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff'
    });

    if (!res.isConfirmed) return;

    window.loadAuditoriaSystemProducts();
    const draftKey = `audit_draft_${auditTarget}`;
    localStorage.removeItem(draftKey);
    window.renderAuditoriaTable();
};

window.submitAuditoriaCuadre = async function() {
    const items = Object.values(auditItemsMap);
    if (items.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin artículos', text: 'No hay productos en la lista para auditar.', background: '#151515', color: '#fff' });
        return;
    }

    const itemsDiscrepantes = items.filter(i => i.stock_contado !== i.stock_sistema);
    const totalContado = items.reduce((acc, i) => acc + i.stock_contado, 0);

    const result = await Swal.fire({
        title: '⚡ ¿Confirmar Cuadre de Inventario?',
        html: `
            Se ajustarán existencias en <b>${auditTarget === '419' ? 'Local 419' : 'Inventario General'}</b>.<br>
            Total Piezas Físicas Contadas: <b>${totalContado} pzs</b>.<br>
            Registros con desajuste: <b class="text-amber-400">${itemsDiscrepantes.length}</b>.<br><br>
            <span class="text-xs text-gray-400">Esta acción sobrescribirá el stock del sistema con el conteo físico real.</span>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, aplicar cuadre',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#ffffff',
        customClass: { popup: 'border border-emerald-500/30 rounded-2xl' }
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Aplicando cuadre...',
        text: 'Actualizando existencias y registrando auditoría en Google Sheets',
        allowOutsideClick: false,
        background: '#151515', color: '#ffffff',
        didOpen: () => { Swal.showLoading(); }
    });

    const notasInput = document.getElementById('audit-notas-input');
    const notasVal = notasInput ? notasInput.value.trim() : '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'guardar_cuadre_inventario',
                token: localStorage.getItem('session_token') || '',
                usuario: localStorage.getItem('logged_user') ? JSON.parse(localStorage.getItem('logged_user')).usuario : 'Admin',
                origen: auditTarget,
                notas: notasVal,
                items: items
            })
        });

        const resData = await response.json();

        if (resData.status === 'success') {
            const draftKey = `audit_draft_${auditTarget}`;
            localStorage.removeItem(draftKey);

            window.closeAuditoriaModal();

            if (typeof fetchProducts419 === 'function') fetchProducts419(true);
            if (typeof fetchInitialProducts === 'function') fetchInitialProducts(true);

            Swal.fire({
                icon: 'success',
                title: '¡Cuadre Aplicado Exitosamente!',
                text: resData.message || `Folio de Auditoría: ${resData.folio_auditoria}`,
                background: '#151515', color: '#ffffff', confirmButtonColor: '#10b981'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error al Cuadrar',
                text: resData.message || 'Ocurrió un problema al guardar los cambios en Google Sheets.',
                background: '#151515', color: '#ffffff', confirmButtonColor: '#ef4444'
            });
        }
    } catch (err) {
        console.error("Error al aplicar cuadre:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: 'No se pudo conectar con el servidor: ' + err.message,
            background: '#151515', color: '#ffffff', confirmButtonColor: '#ef4444'
        });
    }
};

// =========================================================================
// 🔄 MÓDULO DE TRASPASO DE INVENTARIO (LOCAL 419 ➔ INVENTARIO GENERAL)
// =========================================================================
let traspaso419List = [];

window.openTraspaso419Modal = async function() {
    const modal = document.getElementById('modal-traspaso-419-general');
    if (!modal) return;

    traspaso419List = [];
    const notesInput = document.getElementById('traspaso-notas-input');
    const searchInput = document.getElementById('traspaso-search-input');
    const resultsContainer = document.getElementById('traspaso-search-results');
    
    if (notesInput) notesInput.value = '';
    if (searchInput) searchInput.value = '';
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
    }

    renderTraspasoItemsList();

    // ⚡ ABRIR EL MODAL INMEDIATAMENTE (0ms de latencia)
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    if (searchInput) {
        searchInput.focus();
        searchInput.oninput = (e) => window.handleTraspasoSearchInput(e.target.value);
    }

    // Cargar productos en segundo plano si aún no han sido cargados
    if (!allProducts419 || allProducts419.length === 0) {
        if (typeof fetchProducts419 === 'function') {
            try {
                await fetchProducts419();
            } catch (eF) {
                console.error("Error al cargar productos 419 para traspaso:", eF);
            }
        }
    }
};
window.openTraspasoModal = window.openTraspaso419Modal;

window.closeTraspaso419Modal = function() {
    const modal = document.getElementById('modal-traspaso-419-general');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
};

window.renderTraspasoItemsList = function() {
    const container = document.getElementById('traspaso-items-container');
    const badge = document.getElementById('traspaso-items-badge');
    const totalModEl = document.getElementById('traspaso-total-modelos');
    const totalPzsEl = document.getElementById('traspaso-total-piezas');

    if (!container) return;

    if (traspaso419List.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500 text-xs italic">
                Usa el buscador arriba o escanea prendas del Local 419 para agregarlas al lote de traspaso.
            </div>
        `;
        if (badge) badge.textContent = '0 piezas';
        if (totalModEl) totalModEl.textContent = '0';
        if (totalPzsEl) totalPzsEl.textContent = '0 PZS';
        return;
    }

    let totalPiezas = 0;
    const html = traspaso419List.map((item, idx) => {
        totalPiezas += item.cantidad;
        const imgUrl = getFirstImage(item.foto || item.imagen || '');
        const shortTalla = formatShortTallaLabel(item.talla);
        return `
            <div class="p-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors rounded-xl bg-dark-200/50 border border-white/5 mb-1.5 shadow-sm">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${imgUrl}" class="w-12 h-12 object-cover rounded-xl bg-dark border border-white/10 flex-shrink-0 shadow-md">
                    <div class="min-w-0">
                        <h4 class="font-bold text-white text-xs sm:text-sm truncate">${item.nombre}</h4>
                        <div class="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-gray-400">
                            <span class="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md font-extrabold" title="${item.talla}">Talla: ${shortTalla}</span>
                            <span class="text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">Stock 419: ${item.stock419}</span>
                            <span class="text-gray-300 font-semibold bg-white/5 px-1.5 py-0.5 rounded">General: ${item.stockGen}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                    <div class="flex items-center bg-black/60 border border-blue-500/30 rounded-lg overflow-hidden shadow-inner">
                        <button type="button" onclick="window.updateTraspasoQty(${idx}, -1)" class="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-black cursor-pointer">-</button>
                        <span class="w-8 text-center text-xs font-black text-blue-400">${item.cantidad}</span>
                        <button type="button" onclick="window.updateTraspasoQty(${idx}, 1)" class="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-bold cursor-pointer">+</button>
                    </div>
                    <button type="button" onclick="window.removeTraspasoItem(${idx})" class="text-gray-500 hover:text-red-400 transition-colors p-1.5 bg-white/5 hover:bg-red-500/10 rounded-lg border border-white/5 hover:border-red-500/20 cursor-pointer" title="Quitar de la lista">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    if (badge) badge.textContent = `${totalPiezas} pieza${totalPiezas !== 1 ? 's' : ''}`;
    if (totalModEl) totalModEl.textContent = traspaso419List.length;
    if (totalPzsEl) totalPzsEl.textContent = `${totalPiezas} PZS`;
};

window.updateTraspasoQty = function(index, delta) {
    if (index < 0 || index >= traspaso419List.length) return;
    const item = traspaso419List[index];
    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
        traspaso419List.splice(index, 1);
    } else if (newQty > item.stock419) {
        Swal.fire({
            icon: 'warning', title: 'Límite de stock',
            text: `No puedes traspasar más de las ${item.stock419} piezas disponibles en Local 419.`,
            background: '#151515', color: '#fff', confirmButtonColor: '#f59e0b'
        });
        item.cantidad = item.stock419;
    } else {
        item.cantidad = newQty;
    }
    renderTraspasoItemsList();
};

window.removeTraspasoItem = function(index) {
    if (index >= 0 && index < traspaso419List.length) {
        traspaso419List.splice(index, 1);
        renderTraspasoItemsList();
    }
};

window.clearTraspasoList = function() {
    traspaso419List = [];
    renderTraspasoItemsList();
};

window.handleTraspasoSearchInput = function(query) {
    const container = document.getElementById('traspaso-search-results');
    if (!container) return;

    const q = String(query || '').trim().toLowerCase();
    if (!q) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    const typeFilter = document.getElementById('traspaso-filter-tipo') ? document.getElementById('traspaso-filter-tipo').value : 'todos';

    const matches = (allProducts419 || []).filter(p => {
        if (typeFilter === 'jerseys' && p.es_articulo) return false;
        if (typeFilter === 'articulos' && !p.es_articulo) return false;

        const targetText = `${p.nombre || ''} ${p.equipo || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''} ${p.id_playera || ''} ${p.id_articulo || ''}`;
        return matchText(targetText, q);
    }).slice(0, 50);

    if (matches.length === 0) {
        container.innerHTML = `<div class="p-4 text-xs text-gray-400 italic text-center">No se encontraron productos en Local 419 para "${query}"</div>`;
        container.classList.remove('hidden');
        return;
    }

    const html = matches.map(prod => {
        const imgUrl = getFirstImage(prod.foto || prod.imagen || '');
        const prodId = prod.id || prod.id_playera || prod.id_articulo;
        const genderColorClass = getGenderColorClass(prod.genero);

        const tallasHtml = (prod.tallas || []).map(t => {
            const stk = t.stock !== undefined ? t.stock : t.inventario || 0;
            const isAvail = stk > 0;
            const shortLabel = formatShortTallaLabel(t.talla);
            return `
                <button type="button" onclick="window.addTraspasoItemFromProductById('${prodId}', '${t.talla}')" 
                        class="px-2 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${isAvail ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black border border-amber-500/40 cursor-pointer shadow-sm' : 'bg-dark-200 text-gray-600 border border-white/5 cursor-not-allowed opacity-40'}"
                        ${!isAvail ? 'disabled' : ''} title="${t.talla} (Disponible: ${stk})">
                    <span>${shortLabel}</span>
                    <span class="opacity-75 bg-black/40 px-1 py-0.2 rounded text-[9px] font-extrabold">${stk}</span>
                </button>
            `;
        }).join('');

        return `
            <div class="p-3 bg-dark-200/90 border border-white/10 hover:border-blue-400/40 rounded-xl transition-all mb-2 flex flex-col gap-2 shadow-lg">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${imgUrl}" class="w-12 h-12 object-cover rounded-xl bg-dark border border-white/10 flex-shrink-0 shadow-md">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="text-xs sm:text-sm font-black text-white truncate">${prod.nombre || prod.equipo}</h4>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${genderColorClass}">${prod.genero || 'UNISEX'}</span>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                                <span class="text-gray-300 font-semibold">${prod.tipo || 'JERSEY'}</span>
                                ${prod.version ? `<span>• ${prod.version}</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="window.addAllTraspasoStockFromProductById('${prodId}')" class="px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-[10px] rounded-lg border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 shadow-sm">
                        <span>+ Agregar Todo</span>
                    </button>
                </div>
                <div class="flex flex-wrap gap-1.5 items-center pt-1 border-t border-white/5">
                    ${tallasHtml}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    container.classList.remove('hidden');
};

window.addAllTraspasoStockFromProductById = function(productId) {
    const prod = (allProducts419 || []).find(p => String(p.id || p.id_playera || p.id_articulo) === String(productId));
    if (!prod || !Array.isArray(prod.tallas)) return;

    let addedCount = 0;
    prod.tallas.forEach(t => {
        const stk = t.stock !== undefined ? t.stock : t.inventario || 0;
        if (stk > 0) {
            window.addTraspasoItemFromProduct(prod, t.talla);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        const searchInput = document.getElementById('traspaso-search-input');
        const resultsContainer = document.getElementById('traspaso-search-results');
        if (searchInput) searchInput.value = '';
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
        }
    }
};

window.addTraspasoItemFromProductById = function(productId, sizeName) {
    const prod = (allProducts419 || []).find(p => String(p.id || p.id_playera || p.id_articulo) === String(productId));
    if (prod) {
        window.addTraspasoItemFromProduct(prod, sizeName);
        const searchInput = document.getElementById('traspaso-search-input');
        const resultsContainer = document.getElementById('traspaso-search-results');
        if (searchInput) searchInput.value = '';
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
        }
    }
};

window.addTraspasoItemFromProduct = function(product, sizeName) {
    if (!product || !sizeName) return;
    const stock419Obj = (product.tallas || []).find(t => String(t.talla || '').toUpperCase() === String(sizeName).toUpperCase());
    const stock419Val = stock419Obj ? (stock419Obj.stock !== undefined ? stock419Obj.stock : stock419Obj.inventario || 0) : 0;

    if (stock419Val <= 0) {
        const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
        toast.fire({ icon: 'error', title: `Sin stock en Local 419: ${product.nombre} (${sizeName})` });
        return;
    }

    const genProduct = (allProducts || []).find(p => String(p.id || p.id_playera || p.id_articulo) === String(product.id || product.id_playera || product.id_articulo));
    const genSizeObj = genProduct ? (genProduct.tallas || []).find(t => String(t.talla || '').toUpperCase() === String(sizeName).toUpperCase()) : null;
    const stockGenVal = genSizeObj ? (genSizeObj.stock !== undefined ? genSizeObj.stock : genSizeObj.inventario || 0) : 0;

    const existingIndex = traspaso419List.findIndex(item => 
        String(item.id || item.id_playera || item.id_articulo) === String(product.id || product.id_playera || product.id_articulo) &&
        String(item.talla).toUpperCase() === String(sizeName).toUpperCase()
    );

    if (existingIndex !== -1) {
        const item = traspaso419List[existingIndex];
        if (item.cantidad + 1 > item.stock419) {
            Swal.fire({
                icon: 'warning', title: 'Límite alcanzado',
                text: `Ya agregaste la cantidad máxima disponible (${item.stock419} pzs) para ${product.nombre} Talla ${sizeName}.`,
                background: '#151515', color: '#fff', confirmButtonColor: '#f59e0b'
            });
            return;
        }
        item.cantidad += 1;
    } else {
        traspaso419List.push({
            id: product.id || product.id_playera || product.id_articulo,
            id_playera: product.id_playera || product.id,
            id_articulo: product.id_articulo || product.id,
            nombre: product.nombre || product.equipo || 'Producto',
            talla: sizeName,
            cantidad: 1,
            stock419: stock419Val,
            stockGen: stockGenVal,
            foto: product.foto || product.imagen || '',
            es_articulo: !!product.es_articulo
        });
    }

    renderTraspasoItemsList();
    const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1800, background: '#151515', color: '#fff' });
    toast.fire({ icon: 'success', title: `✓ Agregado para traspaso: ${product.nombre} (${sizeName})` });
};

window.submitTraspaso419AGeneral = async function() {
    if (traspaso419List.length === 0) {
        Swal.fire({
            icon: 'info', title: 'Lista vacía', text: 'Agrega al menos una prenda para realizar el traspaso.',
            background: '#151515', color: '#fff', confirmButtonColor: '#3b82f6'
        });
        return;
    }

    const totalPiezas = traspaso419List.reduce((acc, i) => acc + i.cantidad, 0);
    const result = await Swal.fire({
        title: '¿Confirmar Traspaso a General?',
        html: `Se enviarán <b>${totalPiezas} pieza(s)</b> de <b>${traspaso419List.length} modelo(s)</b> desde Local 419 hacia el Inventario General.<br><br><span class="text-xs text-gray-400">Las existencias en Local 419 disminuirán y se sumarán al inventario global.</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, ejecutar traspaso',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#ffffff',
        customClass: { popup: 'border border-blue-500/30 rounded-2xl' }
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Procesando traspaso...',
        text: 'Actualizando existencias en Google Sheets',
        allowOutsideClick: false,
        background: '#151515', color: '#ffffff',
        didOpen: () => { Swal.showLoading(); }
    });

    const notesInput = document.getElementById('traspaso-notas-input');
    const notasVal = notesInput ? notesInput.value.trim() : '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'transferir_inventario_419_a_general',
                token: localStorage.getItem('session_token') || '',
                usuario: localStorage.getItem('logged_user') ? JSON.parse(localStorage.getItem('logged_user')).usuario : 'Admin',
                notas: notasVal,
                items: traspaso419List
            })
        });

        const resData = await response.json();

        if (resData.status === 'success') {
            closeTraspaso419Modal();

            if (typeof fetchProducts419 === 'function') fetchProducts419(true);
            if (typeof fetchInitialProducts === 'function') fetchInitialProducts(true);

            Swal.fire({
                icon: 'success',
                title: '¡Traspaso Completado!',
                text: resData.message || `Se traspasaron ${totalPiezas} piezas a Inventario General. Folio: ${resData.folio_traspaso}`,
                background: '#151515', color: '#ffffff', confirmButtonColor: '#2563eb'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error en Traspaso',
                text: resData.message || 'Ocurrió un error al procesar el traspaso en Google Sheets.',
                background: '#151515', color: '#ffffff', confirmButtonColor: '#ef4444'
            });
        }
    } catch (err) {
        console.error("Error al transferir inventario:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: 'No se pudo conectar con el servidor: ' + err.message,
            background: '#151515', color: '#ffffff', confirmButtonColor: '#ef4444'
        });
    }
};

async function loadClientsForPOS() {
    if (window.startTopLoadingBar) startTopLoadingBar();
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'search_clients' })
        });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            allClientsPOSCache = data.data;
        }
    } catch (e) {
        console.error("Error al obtener clientes desde la hoja Clientes para POS:", e);
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}

function selectPos419Client(clientObj) {
    pos419Client = clientObj || { id_cliente: 'CLI-MOSTRADOR', nombre_completo: 'Cliente Mostrador', perfil: 'Menudeo' };
    
    const nameEl = document.getElementById('pos419-active-client-name');
    const profileEl = document.getElementById('pos419-active-client-profile');
    const containerMostrador = document.getElementById('pos419-mostrador-name-container');
    const inputMostradorName = document.getElementById('pos419-mostrador-name-input');
    
    const isMostrador = pos419Client.id_cliente === 'CLI-MOSTRADOR';

    if (containerMostrador) {
        if (isMostrador) {
            containerMostrador.classList.remove('hidden');
            containerMostrador.classList.add('flex');
        } else {
            containerMostrador.classList.add('hidden');
            containerMostrador.classList.remove('flex');
            if (inputMostradorName) inputMostradorName.value = '';
            pos419Client.nombre_mostrador_custom = '';
        }
    }

    if (nameEl) {
        if (isMostrador && pos419Client.nombre_mostrador_custom) {
            nameEl.textContent = `Cliente Mostrador (${pos419Client.nombre_mostrador_custom})`;
        } else {
            nameEl.textContent = pos419Client.nombre_completo || pos419Client.nombre || 'Cliente Mostrador';
        }
    }

    if (profileEl) {
        const perf = pos419Client.perfil || 'Menudeo';
        profileEl.textContent = perf;
        profileEl.className = perf === 'Súper Mayoreo'
            ? 'px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : (perf === 'Mayoreo' 
                ? 'px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-white/10 text-gray-300');
    }
    
    recalculatePos419Cart();
    renderPos419Catalog();
}

async function filterPOS419Clients(query) {
    const resultsContainer = document.getElementById('pos419-client-search-results');
    if (!resultsContainer) return;
    
    if (!allClientsPOSCache || allClientsPOSCache.length === 0) {
        await loadClientsForPOS();
    }
    
    const q = query ? query.trim() : '';
    if (!q) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
    }
    
    const filtered = allClientsPOSCache.filter(c => {
        const full = `${c.nombre_completo || ''} ${c.usuario || ''} ${c.telefono || ''} ${c.id_cliente || ''}`;
        return matchText(full, q);
    }).slice(0, 8);
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = `<div class="p-3 text-xs text-gray-500 text-center italic">No se encontraron clientes en el registro</div>`;
    } else {
        resultsContainer.innerHTML = filtered.map(c => `
            <div onclick="window.onSelectPOS419ClientFromSearch('${c.id_cliente}')" class="p-2 sm:p-2.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 border-b border-white/5 last:border-none">
                <div>
                    <div class="text-xs font-bold text-white">${c.nombre_completo}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${c.telefono || 'Sin tel'} | ${c.usuario}</div>
                </div>
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.perfil === 'Súper Mayoreo' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : (c.perfil === 'Mayoreo' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/10 text-gray-300')}">${c.perfil || 'Menudeo'}</span>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

window.onSelectPOS419ClientFromSearch = (idCli) => {
    const target = allClientsPOSCache.find(c => String(c.id_cliente) === String(idCli));
    if (target) {
        selectPos419Client(target);
    }
    const resultsContainer = document.getElementById('pos419-client-search-results');
    const searchContainer = document.getElementById('pos419-client-search-container');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (searchContainer) searchContainer.classList.add('hidden');
};

window.openPos419UnidentifiedItemModal = function(customName = 'Producto Sin Identificar') {
    const modal = document.getElementById('modal-pos419-unidentified-item');
    if (!modal) return;

    const nombreInput = document.getElementById('pos419-unidentified-nombre');
    const precioInput = document.getElementById('pos419-unidentified-precio');
    const qtyInput = document.getElementById('pos419-unidentified-qty');
    const tallaSelect = document.getElementById('pos419-unidentified-talla');

    if (nombreInput) nombreInput.value = customName || 'Producto Sin Identificar';
    if (precioInput) precioInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    if (tallaSelect) tallaSelect.value = 'Única';

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    const box = modal.querySelector('.transform');
    if (box) {
        box.classList.remove('scale-95');
        box.classList.add('scale-100');
    }

    if (precioInput) precioInput.focus();
};

window.closePos419UnidentifiedItemModal = function() {
    const modal = document.getElementById('modal-pos419-unidentified-item');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = modal.querySelector('.transform');
    if (box) {
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.submitPos419UnidentifiedItem = function(e) {
    if (e) e.preventDefault();

    const nombreInput = document.getElementById('pos419-unidentified-nombre');
    const precioInput = document.getElementById('pos419-unidentified-precio');
    const qtyInput = document.getElementById('pos419-unidentified-qty');
    const tallaSelect = document.getElementById('pos419-unidentified-talla');
    const generoSelect = document.getElementById('pos419-unidentified-genero');

    const nombre = nombreInput && nombreInput.value ? nombreInput.value.trim() : 'Producto Sin Identificar';
    const precio = parseFloat(precioInput ? precioInput.value : 0);
    const cantidad = parseInt(qtyInput ? qtyInput.value : 1) || 1;
    const talla = tallaSelect ? tallaSelect.value : 'Única';
    const genero = generoSelect ? generoSelect.value : 'Unisex';

    if (isNaN(precio) || precio <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Precio Requerido',
            text: 'Por favor ingresa un precio unitario mayor a $0.00',
            background: '#151515', color: '#fff'
        });
        return;
    }

    const uniqueId = `CUSTOM-419-${Date.now()}`;

    pos419Cart.push({
        id_playera: uniqueId,
        is_unidentified: true,
        nombre: nombre,
        tipo: 'Art. Varios',
        version: 'Manual',
        genero: genero,
        foto: 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=150',
        talla: talla,
        cantidad: cantidad,
        precio_menudeo: precio,
        precio_mayoreo: precio,
        precio_mayoreo_super: precio,
        tipo_personalizacion: 'PERS-NONE',
        personalizacion_texto: ''
    });

    closePos419UnidentifiedItemModal();
    recalculatePos419Cart();

    const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
    toast.fire({ icon: 'success', title: `✓ Agregado: ${nombre} ($${precio.toFixed(2)})` });

    if (window.innerWidth < 768) {
        switchPOS419MobileTab('cart');
    }
};

function renderPos419Catalog() {
    const gridContainer = document.getElementById('pos419-catalog-grid');
    if (!gridContainer) return;
    
    const searchInput = document.getElementById('pos419-catalog-search-input');
    if (searchInput && !searchInput.dataset.hasPOSListener) {
        searchInput.dataset.hasPOSListener = "true";
        searchInput.oninput = () => renderPos419Catalog();
    }
    
    const q = searchInput ? searchInput.value : '';
    
    const filtered = (allProducts419 || []).filter(p => {
        if (!q) return true;
        const targetStr = `${p.equipo || ''} ${p.nombre || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''}`;
        return matchText(targetStr, q);
    });
    
    const unidentifiedCardHtml = `
        <div class="bg-gradient-to-br from-amber-500/10 via-dark-200/50 to-dark-200/50 border border-amber-500/30 hover:border-amber-400 rounded-xl p-3 space-y-2 transition-all flex flex-col justify-between shadow-lg">
            <div class="flex items-start gap-3">
                <div class="w-14 h-14 flex-shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg flex items-center justify-center text-xl font-bold">
                    📦
                </div>
                <div class="min-w-0 flex-grow">
                    <div class="flex items-center justify-between gap-1">
                        <h4 class="text-xs font-black text-amber-300 leading-tight truncate">PRODUCTO SIN IDENTIFICAR</h4>
                    </div>
                    <div class="text-[10px] text-gray-400 truncate mt-0.5">Venta rápida manual / Varios</div>
                    <div class="text-[9px] text-amber-400/80 font-mono mt-0.5">Precio y concepto libre</div>
                </div>
            </div>
            <div class="pt-2 border-t border-amber-500/20">
                <button type="button" onclick="window.openPos419UnidentifiedItemModal()" class="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                    <span>Configurar y Agregar</span>
                </button>
            </div>
        </div>
    `;

    if (filtered.length === 0) {
        gridContainer.innerHTML = unidentifiedCardHtml + `<div class="col-span-full text-center py-10 text-gray-500 italic text-xs">No hay prendas disponibles en Local 419 que coincidan.</div>`;
        return;
    }

    let currentTier = 'Menudeo';
    let totalPieces = 0;
    pos419Cart.forEach(i => totalPieces += i.cantidad);
    const clientPerfil = pos419Client.perfil || 'Menudeo';
    const isMostrador = pos419Client.id_cliente === 'CLI-MOSTRADOR';
    
    if (isMostrador) {
        if (totalPieces >= 12) currentTier = 'Súper Mayoreo';
        else if (totalPieces >= 6) currentTier = 'Mayoreo';
        else currentTier = 'Menudeo';
    } else {
        if (clientPerfil === 'Súper Mayoreo' || totalPieces >= 12) currentTier = 'Súper Mayoreo';
        else if (clientPerfil === 'Mayoreo' || totalPieces >= 6) currentTier = 'Mayoreo';
        else currentTier = 'Menudeo';
    }
    
    gridContainer.innerHTML = unidentifiedCardHtml + filtered.map(prod => {
        const rawImg = getFirstImage(prod.foto || prod.imagen) || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const imgUrl = getOptimizedImageUrl(rawImg, 300);
        const equipoNombre = (prod.nombre || prod.equipo || 'JERSEY').toUpperCase();
        const verGen = [prod.tipo, prod.version, prod.genero].filter(Boolean).join(' ').toUpperCase();
        
        // Obtener precio correspondiente al perfil actual
        const mainCatalog = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
        const mainMatch = mainCatalog.find(ap => String(ap.id || '').toUpperCase() === String(prod.id || '').toUpperCase() || String(ap.nombre || '').toUpperCase() === String(equipoNombre).toUpperCase());
        
        const pMen = Number(prod.precio_menudeo || prod.precio || (mainMatch ? mainMatch.precio_menudeo : 0) || 0);
        const pMay = Number(prod.precio_mayoreo || (mainMatch ? mainMatch.precio_mayoreo : 0) || pMen);
        const pSup = Number(prod.precio_mayoreo_super || (mainMatch ? mainMatch.precio_mayoreo_super : 0) || pMay);
        
        let pDisplay = pMen;
        if (currentTier === 'Súper Mayoreo' && pSup > 0) pDisplay = pSup;
        else if ((currentTier === 'Mayoreo' || currentTier === 'Súper Mayoreo') && pMay > 0) pDisplay = pMay;
        
        // Obtener tallas y sus existencias en 419
        const tallasArray = Array.isArray(prod.tallas) ? prod.tallas : [];
        
        // Botones de selección rápida por talla
        let sizeButtonsHtml = '';
        tallasArray.forEach(tObj => {
            const sz = String(tObj.talla || '').toUpperCase();
            const shortSz = formatShortTallaLabel(sz);
            const avail419 = Number(tObj.stock || 0);
            
            const inCartItem = pos419Cart.find(ci => ci.id_playera === prod.id && ci.talla === sz);
            const inCartQty = inCartItem ? inCartItem.cantidad : 0;
            const remAvail = Math.max(0, avail419 - inCartQty);
            
            if (avail419 > 0) {
                const btnColor = remAvail > 0
                    ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border-amber-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/20 cursor-not-allowed opacity-50';
                
                sizeButtonsHtml += `
                    <button type="button" ${remAvail <= 0 ? 'disabled' : ''} onclick="window.addPos419Item('${prod.id}', '${sz}')" class="px-2 py-1 rounded-lg border text-center font-bold text-[10px] transition-all flex items-center justify-between gap-1 ${btnColor} whitespace-nowrap" title="Talla ${sz}">
                        <span>${shortSz}</span>
                        <span class="text-[9px] opacity-80">(${remAvail})</span>
                    </button>
                `;
            }
        });
        
        if (!sizeButtonsHtml) {
            sizeButtonsHtml = `<span class="text-[10px] text-gray-500 italic">Sin stock en 419</span>`;
        }
        
        return `
            <div class="bg-dark-200/50 border border-white/5 rounded-xl p-3 space-y-2 hover:border-amber-500/30 transition-all flex flex-col justify-between">
                <div class="flex items-start gap-3">
                    <div class="w-14 h-14 flex-shrink-0 bg-dark-100 border border-white/10 rounded-lg overflow-hidden p-0.5">
                        <img src="${imgUrl}" class="w-full h-full object-cover rounded">
                    </div>
                    <div class="min-w-0 flex-grow">
                        <div class="flex items-center justify-between gap-1">
                            <h4 class="text-xs font-bold text-white leading-tight truncate">${equipoNombre}</h4>
                            <span class="text-xs font-bold text-amber-400 font-mono flex-shrink-0">$${pDisplay.toFixed(2)}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 truncate mt-0.5">${verGen}</div>
                        <div class="text-[9px] text-gray-500 font-mono mt-0.5">ID: ${prod.id}</div>
                    </div>
                </div>
                <div class="pt-2 border-t border-white/5">
                    <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tallas Disponibles en 419:</div>
                    <div class="grid grid-cols-3 gap-1.5">
                        ${sizeButtonsHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
window.renderPos419Catalog = renderPos419Catalog;

function addPos419Item(id_playera, talla) {
    const prod = (allProducts419 || []).find(p => String(p.id) === String(id_playera));
    if (!prod) return;
    
    const tallasArray = Array.isArray(prod.tallas) ? prod.tallas : [];
    const tObj = tallasArray.find(x => String(x.talla).trim().toUpperCase() === String(talla).trim().toUpperCase());
    const maxStock = tObj ? Number(tObj.stock || 0) : 0;
    
    const existing = pos419Cart.find(item => item.id_playera === id_playera && item.talla === talla && item.tipo_personalizacion === 'PERS-NONE');
    const currentQty = existing ? existing.cantidad : 0;
    
    if (currentQty + 1 > maxStock) {
        const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1800, background: '#151515', color: '#fff' });
        toast.fire({ icon: 'warning', title: `Límite alcanzado (${maxStock} disponible en 419)` });
        return;
    }
    
    if (existing) {
        existing.cantidad += 1;
    } else {
        const mainCatalog = (typeof allProducts !== 'undefined' && allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
        const mainMatch = mainCatalog.find(ap => String(ap.id || '').toUpperCase() === String(id_playera).toUpperCase() || String(ap.nombre || '').toUpperCase() === String(prod.nombre || prod.equipo || '').toUpperCase());
        
        pos419Cart.push({
            id_playera: prod.id,
            nombre: prod.nombre || prod.equipo || 'Jersey',
            tipo: prod.tipo || 'Regular',
            version: prod.version || 'Aficionado',
            genero: prod.genero || 'Hombre',
            foto: getFirstImage(prod.foto || prod.imagen),
            talla: talla,
            cantidad: 1,
            precio_menudeo: Number(prod.precio_menudeo || prod.precio || (mainMatch ? mainMatch.precio_menudeo : 0) || 0),
            precio_mayoreo: Number(prod.precio_mayoreo || (mainMatch ? mainMatch.precio_mayoreo : 0) || 0),
            precio_mayoreo_super: Number(prod.precio_mayoreo_super || (mainMatch ? mainMatch.precio_mayoreo_super : 0) || 0),
            tipo_personalizacion: 'PERS-NONE',
            personalizacion_texto: '',
            costo_personalizacion: 0,
            personalizaciones_oficiales: prod.personalizaciones_oficiales || (mainMatch ? mainMatch.personalizaciones_oficiales : null)
        });
    }
    
    recalculatePos419Cart();
    renderPos419Catalog();
}
window.addPos419Item = addPos419Item;

function updatePos419ItemQty(idx, delta) {
    const item = pos419Cart[idx];
    if (!item) return;
    
    const prod = (allProducts419 || []).find(p => String(p.id) === String(item.id_playera));
    const tallasArray = prod && Array.isArray(prod.tallas) ? prod.tallas : [];
    const tObj = tallasArray.find(x => String(x.talla).trim().toUpperCase() === String(item.talla).trim().toUpperCase());
    const maxStock = item.is_unidentified ? 999 : (tObj ? Number(tObj.stock || 0) : 99);
    
    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
        pos419Cart.splice(idx, 1);
    } else if (newQty > maxStock) {
        const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1800, background: '#151515', color: '#fff' });
        toast.fire({ icon: 'warning', title: `Máximo disponible en 419: ${maxStock}` });
        return;
    } else {
        item.cantidad = newQty;
    }
    
    recalculatePos419Cart();
    renderPos419Catalog();
}
window.updatePos419ItemQty = updatePos419ItemQty;

function removePos419Item(idx) {
    pos419Cart.splice(idx, 1);
    recalculatePos419Cart();
    renderPos419Catalog();
}
window.removePos419Item = removePos419Item;

async function configurePos419Personalizacion(idx) {
    const item = pos419Cart[idx];
    if (!item) return;

    let rawOficial = item.personalizaciones_oficiales;
    let bPriceM = 0, bPriceMay = 0, oPriceM = 0, oPriceMay = 0;
    let opcionesOficiales = [];

    if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
        bPriceM = parseFloat(rawOficial.basica_precio_menudeo || 0);
        bPriceMay = parseFloat(rawOficial.basica_precio_mayoreo || 0);
        oPriceM = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
        oPriceMay = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
        opcionesOficiales = Array.isArray(rawOficial.opciones) ? rawOficial.opciones : [];
    } else if (Array.isArray(rawOficial)) {
        opcionesOficiales = rawOficial;
    }

    const isMay = (item.appliedTier === 'Mayoreo' || item.appliedTier === 'Súper Mayoreo');
    const costBasica = isMay ? bPriceMay : bPriceM;
    const costOficial = isMay ? oPriceMay : oPriceM;

    let htmlContent = `
        <div class="text-left space-y-3 text-xs text-white p-1">
            <div>
                <label class="block text-gray-400 font-bold mb-1 uppercase text-[10px]">Tipo de Personalización:</label>
                <select id="swal-pos-pers-type" class="w-full bg-dark-200 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400">
                    <option value="PERS-NONE" ${item.tipo_personalizacion === 'PERS-NONE' ? 'selected' : ''}>Sin Personalización (+$0.00)</option>
                    <option value="PERS-BASICA" ${item.tipo_personalizacion === 'PERS-BASICA' ? 'selected' : ''}>Básica (Nombre y Número Libre) ${costBasica > 0 ? '(+$' + costBasica.toFixed(2) + ')' : ''}</option>
                    ${opcionesOficiales.length > 0 ? `<option value="PERS-OFICIAL" ${item.tipo_personalizacion === 'PERS-OFICIAL' ? 'selected' : ''}>Oficial de Jugador ${costOficial > 0 ? '(+$' + costOficial.toFixed(2) + ')' : ''}</option>` : ''}
                </select>
            </div>

            <!-- Campos para Básica -->
            <div id="swal-pos-pers-basica-fields" class="${item.tipo_personalizacion === 'PERS-BASICA' ? '' : 'hidden'} space-y-2 pt-1">
                <div>
                    <label class="block text-gray-400 font-semibold mb-1 text-[10px]">Nombre a estampar:</label>
                    <input type="text" id="swal-pos-pers-nombre" placeholder="Ej. RAMÍREZ" value="${item.tipo_personalizacion === 'PERS-BASICA' ? (item.personalizacion_texto.split('#')[0] || '').trim() : ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-amber-400">
                </div>
                <div>
                    <label class="block text-gray-400 font-semibold mb-1 text-[10px]">Número a estampar:</label>
                    <input type="text" id="swal-pos-pers-numero" placeholder="Ej. 10" value="${item.tipo_personalizacion === 'PERS-BASICA' ? (item.personalizacion_texto.split('#')[1] || '').trim() : ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-amber-400">
                </div>
            </div>

            <!-- Campos para Oficial -->
            <div id="swal-pos-pers-oficial-fields" class="${item.tipo_personalizacion === 'PERS-OFICIAL' ? '' : 'hidden'} pt-1">
                <label class="block text-gray-400 font-semibold mb-1 text-[10px]">Seleccionar Jugador Oficial:</label>
                <select id="swal-pos-pers-oficial-select" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                    <option value="">-- Selecciona Jugador --</option>
                    ${opcionesOficiales.map(o => {
                        const valStr = `${o.nombre} #${o.numero || ''}`.trim();
                        return `<option value="${valStr}" ${item.personalizacion_texto === valStr ? 'selected' : ''}>${valStr}</option>`;
                    }).join('')}
                </select>
            </div>
        </div>
    `;

    const res = await Swal.fire({
        title: 'Configurar Personalización',
        html: htmlContent,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Guardar Personalización',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#374151',
        background: '#151515', color: '#fff',
        didOpen: () => {
            const selType = document.getElementById('swal-pos-pers-type');
            const basicaDiv = document.getElementById('swal-pos-pers-basica-fields');
            const oficialDiv = document.getElementById('swal-pos-pers-oficial-fields');
            selType.onchange = () => {
                const v = selType.value;
                if (v === 'PERS-BASICA') {
                    if (basicaDiv) basicaDiv.classList.remove('hidden');
                    if (oficialDiv) oficialDiv.classList.add('hidden');
                } else if (v === 'PERS-OFICIAL') {
                    if (basicaDiv) basicaDiv.classList.add('hidden');
                    if (oficialDiv) oficialDiv.classList.remove('hidden');
                } else {
                    if (basicaDiv) basicaDiv.classList.add('hidden');
                    if (oficialDiv) oficialDiv.classList.add('hidden');
                }
            };
        },
        preConfirm: () => {
            const vType = document.getElementById('swal-pos-pers-type').value;
            let text = '';
            if (vType === 'PERS-BASICA') {
                const nom = (document.getElementById('swal-pos-pers-nombre').value || '').trim().toUpperCase();
                const num = (document.getElementById('swal-pos-pers-numero').value || '').trim().toUpperCase();
                if (!nom && !num) {
                    Swal.showValidationMessage('Ingresa al menos nombre o número para personalización básica.');
                    return false;
                }
                text = `${nom} #${num}`.trim();
            } else if (vType === 'PERS-OFICIAL') {
                text = document.getElementById('swal-pos-pers-oficial-select').value;
                if (!text) {
                    Swal.showValidationMessage('Selecciona un jugador oficial.');
                    return false;
                }
            }
            return { tipo: vType, texto: text };
        }
    });

    if (res.isConfirmed && res.value) {
        item.tipo_personalizacion = res.value.tipo;
        item.personalizacion_texto = res.value.texto;
        recalculatePos419Cart();
    }
}
window.configurePos419Personalizacion = configurePos419Personalizacion;

async function editPos419ItemPrice(index) {
    const item = pos419Cart[index];
    if (!item) return;

    const isMostrador = (pos419Client.id_cliente === 'CLI-MOSTRADOR');
    if (!isMostrador) {
        Swal.fire({
            icon: 'info',
            title: 'Precio Fijo por Perfil',
            text: `Para clientes registrados (${pos419Client.perfil || 'Mayoreo'}), el precio de la prenda se aplica estrictamente según la tarifa oficial de su perfil.`,
            background: '#151515', color: '#fff'
        });
        return;
    }

    const currentPrice = item.precio_manual !== undefined ? item.precio_manual : (item.precio_unitario_aplicado || 0);

    const { value: formValues, isDenied } = await Swal.fire({
        title: `Modificar Precio Unitario`,
        html: `
            <div class="flex flex-col gap-3 text-left">
                <div class="bg-dark-200 p-2.5 rounded-xl border border-white/5 space-y-1 text-xs">
                    <div class="font-bold text-white">${item.nombre}</div>
                    <div class="text-[11px] text-gray-400">Talla: <strong class="text-amber-400">${item.talla}</strong> | Sistema (${item.appliedTier || 'Menudeo'}): <strong class="text-emerald-400">$${(item.precio_sistema || item.precio_menudeo || 0).toFixed(2)}</strong></div>
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-semibold mb-1 block">Nuevo Precio Unitario ($):</label>
                    <input id="swal-edit-price-input" type="number" step="0.01" min="0" value="${currentPrice}" class="w-full bg-dark-100 border border-white/10 rounded-xl p-2.5 text-sm text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400">
                </div>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: item.precio_manual !== undefined,
        confirmButtonText: 'Aplicar Precio',
        denyButtonText: 'Restablecer Precio Sistema',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        denyButtonColor: '#3f3f46',
        cancelButtonColor: '#1f2937',
        background: '#151515', color: '#fff',
        preConfirm: () => {
            const val = parseFloat(document.getElementById('swal-edit-price-input').value);
            if (isNaN(val) || val < 0) {
                Swal.showValidationMessage('Ingresa un precio válido (mayor o igual a 0)');
                return false;
            }
            return val;
        }
    });

    if (isDenied) {
        delete item.precio_manual;
        recalculatePos419Cart();
    } else if (formValues !== undefined && typeof formValues === 'number') {
        item.precio_manual = formValues;
        recalculatePos419Cart();
    }
}
window.editPos419ItemPrice = editPos419ItemPrice;

function recalculatePos419Cart() {
    let totalPieces = 0;
    pos419Cart.forEach(i => totalPieces += i.cantidad);
    
    let appliedTier = 'Menudeo';
    const clientPerfil = pos419Client.perfil || 'Menudeo';
    const isMostrador = pos419Client.id_cliente === 'CLI-MOSTRADOR';
    
    if (isMostrador) {
        if (totalPieces >= 12) appliedTier = 'Súper Mayoreo';
        else if (totalPieces >= 6) appliedTier = 'Mayoreo';
        else appliedTier = 'Menudeo';
    } else {
        if (clientPerfil === 'Súper Mayoreo' || totalPieces >= 12) {
            appliedTier = 'Súper Mayoreo';
        } else if (clientPerfil === 'Mayoreo' || totalPieces >= 6) {
            appliedTier = 'Mayoreo';
        } else {
            appliedTier = 'Menudeo';
        }
    }
    
    const tierBadge = document.getElementById('pos419-applied-tier-badge');
    if (tierBadge) {
        tierBadge.textContent = appliedTier.toUpperCase();
        tierBadge.className = appliedTier === 'Súper Mayoreo'
            ? 'px-2 py-0.5 rounded font-extrabold text-[10px] uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : (appliedTier === 'Mayoreo' 
                ? 'px-2 py-0.5 rounded font-extrabold text-[10px] uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'px-2 py-0.5 rounded font-extrabold text-[10px] uppercase bg-white/10 text-gray-300');
    }
    
    let subtotalItems = 0;
    const isMay = (appliedTier === 'Mayoreo' || appliedTier === 'Súper Mayoreo');

    pos419Cart.forEach(item => {
        item.appliedTier = appliedTier;

        if (!isMostrador) {
            delete item.precio_manual;
        }

        let pSystem = item.precio_menudeo || 0;
        if (appliedTier === 'Súper Mayoreo' && item.precio_mayoreo_super > 0) {
            pSystem = item.precio_mayoreo_super;
        } else if ((appliedTier === 'Mayoreo' || appliedTier === 'Súper Mayoreo') && item.precio_mayoreo > 0) {
            pSystem = item.precio_mayoreo;
        }
        item.precio_sistema = pSystem;

        // Usar precio manual solo si es cliente mostrador y fue modificado
        let pUnit = (isMostrador && item.precio_manual !== undefined) ? item.precio_manual : pSystem;

        // Calcular costo de personalización
        let rawOficial = item.personalizaciones_oficiales;
        let bPriceM = 0, bPriceMay = 0, oPriceM = 0, oPriceMay = 0;
        if (rawOficial && typeof rawOficial === 'object' && !Array.isArray(rawOficial)) {
            bPriceM = parseFloat(rawOficial.basica_precio_menudeo || 0);
            bPriceMay = parseFloat(rawOficial.basica_precio_mayoreo || 0);
            oPriceM = parseFloat(rawOficial.oficial_precio_menudeo || rawOficial.precio || 0);
            oPriceMay = parseFloat(rawOficial.oficial_precio_mayoreo || 0);
        }

        let costoPersUnit = 0;
        if (item.tipo_personalizacion === 'PERS-BASICA') {
            costoPersUnit = isMay ? bPriceMay : bPriceM;
        } else if (item.tipo_personalizacion === 'PERS-OFICIAL') {
            costoPersUnit = isMay ? oPriceMay : oPriceM;
        }

        item.costo_personalizacion = costoPersUnit;
        item.precio_unitario_aplicado = pUnit;
        item.subtotal = (pUnit + costoPersUnit) * item.cantidad;
        subtotalItems += item.subtotal;
    });

    // Calcular descuento especial global ($)
    const discountValEl = document.getElementById('pos419-discount-val');
    const discountInputVal = discountValEl ? parseFloat(discountValEl.value || 0) : 0;

    let descuentoMonto = 0;
    if (!isNaN(discountInputVal) && discountInputVal > 0) {
        descuentoMonto = Math.min(subtotalItems, discountInputVal);
    }

    const basePrendas = Math.max(0, subtotalItems - descuentoMonto);

    // Método de pago y comisión por uso de Terminal (5% = factor 0.05)
    const metodoPagoEl = document.getElementById('pos419-payment-method');
    const metodoPagoVal = metodoPagoEl ? metodoPagoEl.value : 'Efectivo';
    const isTerminal = (metodoPagoVal.toLowerCase().indexOf('tarjeta') !== -1 || metodoPagoVal.toLowerCase().indexOf('terminal') !== -1);

    const comisionTerminalMonto = isTerminal ? (basePrendas * 0.05) : 0;
    const granTotal = basePrendas + comisionTerminalMonto;

    // Calculadora de pago en efectivo y cambio a entregar
    const cashCalcContainer = document.getElementById('pos419-cash-calculator-container');
    const cashReceivedInput = document.getElementById('pos419-cash-received-val');
    const cashChangeValEl = document.getElementById('pos419-cash-change-val');

    const isEfectivo = metodoPagoVal.toLowerCase().includes('efectivo');

    if (isEfectivo) {
        if (cashCalcContainer) cashCalcContainer.classList.remove('hidden');
        const cashReceived = cashReceivedInput ? parseFloat(cashReceivedInput.value || 0) : 0;
        
        if (cashChangeValEl) {
            if (cashReceived > 0) {
                if (cashReceived >= granTotal) {
                    const cambio = cashReceived - granTotal;
                    cashChangeValEl.textContent = `$${cambio.toFixed(2)}`;
                    cashChangeValEl.className = 'text-xs font-black text-emerald-300 font-mono';
                } else {
                    const falta = granTotal - cashReceived;
                    cashChangeValEl.textContent = `Falta: $${falta.toFixed(2)}`;
                    cashChangeValEl.className = 'text-xs font-bold text-amber-400 font-mono';
                }
            } else {
                cashChangeValEl.textContent = `$0.00`;
                cashChangeValEl.className = 'text-xs font-black text-emerald-300 font-mono';
            }
        }
    } else {
        if (cashCalcContainer) cashCalcContainer.classList.add('hidden');
        if (cashReceivedInput) cashReceivedInput.value = '';
    }

    // Actualizar elementos de resumen en pantalla
    const summaryContainer = document.getElementById('pos419-discount-summary-container');
    const subtotalValEl = document.getElementById('pos419-subtotal-val');
    const discountRowEl = document.getElementById('pos419-discount-row');
    const discountAppliedValEl = document.getElementById('pos419-discount-applied-val');
    const terminalRowEl = document.getElementById('pos419-terminal-fee-row');
    const terminalFeeValEl = document.getElementById('pos419-terminal-fee-val');

    if (descuentoMonto > 0 || comisionTerminalMonto > 0) {
        if (summaryContainer) summaryContainer.classList.remove('hidden');
        if (subtotalValEl) subtotalValEl.textContent = `$${subtotalItems.toFixed(2)}`;

        if (descuentoMonto > 0) {
            if (discountRowEl) discountRowEl.classList.remove('hidden');
            if (discountAppliedValEl) discountAppliedValEl.textContent = `-$${descuentoMonto.toFixed(2)}`;
        } else {
            if (discountRowEl) discountRowEl.classList.add('hidden');
        }

        if (comisionTerminalMonto > 0) {
            if (terminalRowEl) terminalRowEl.classList.remove('hidden');
            if (terminalFeeValEl) terminalFeeValEl.textContent = `+$${comisionTerminalMonto.toFixed(2)}`;
        } else {
            if (terminalRowEl) terminalRowEl.classList.add('hidden');
        }
    } else {
        if (summaryContainer) summaryContainer.classList.add('hidden');
    }
    
    const totalEl = document.getElementById('pos419-gran-total');
    const badgeCountEl = document.getElementById('pos419-cart-count-badge');
    const btnSubmit = document.getElementById('btn-submit-pos419');
    
    const mobileTabCount = document.getElementById('pos419-mobile-tab-count');
    const mobileTabTotal = document.getElementById('pos419-mobile-tab-total');
    if (mobileTabCount) mobileTabCount.textContent = `${totalPieces}`;
    if (mobileTabTotal) mobileTabTotal.textContent = `$${granTotal.toFixed(2)}`;

    if (totalEl) totalEl.textContent = `$${granTotal.toFixed(2)}`;
    if (badgeCountEl) badgeCountEl.textContent = `${totalPieces} pcs`;
    if (btnSubmit) btnSubmit.disabled = (pos419Cart.length === 0);
    
    renderPos419Cart();
}

function renderPos419Cart() {
    const container = document.getElementById('pos419-cart-items-container');
    if (!container) return;
    
    if (pos419Cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-black/20 rounded-xl border border-dashed border-white/10 p-4">
                <svg class="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                <p class="text-xs text-gray-400 font-semibold">Carrito presencial vacío</p>
                <p class="text-[10px] text-gray-500 mt-0.5">Toca una talla en el panel izquierdo para agregar piezas.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pos419Cart.map((item, idx) => {
        let persBadgeHtml = '';
        if (item.tipo_personalizacion === 'PERS-BASICA') {
            persBadgeHtml = `<button type="button" onclick="window.configurePos419Personalizacion(${idx})" class="mt-1 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 transition-all"><span>🎨 Básica: ${item.personalizacion_texto} (+$${(item.costo_personalizacion || 0).toFixed(2)})</span></button>`;
        } else if (item.tipo_personalizacion === 'PERS-OFICIAL') {
            persBadgeHtml = `<button type="button" onclick="window.configurePos419Personalizacion(${idx})" class="mt-1 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 transition-all"><span>⭐ Oficial: ${item.personalizacion_texto} (+$${(item.costo_personalizacion || 0).toFixed(2)})</span></button>`;
        } else {
            persBadgeHtml = `<button type="button" onclick="window.configurePos419Personalizacion(${idx})" class="mt-1 text-[9px] bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-all"><span>+ Agregar Personalizado</span></button>`;
        }

        const isManual = item.precio_manual !== undefined;
        const priceDisplayHtml = isManual
            ? `<button type="button" onclick="window.editPos419ItemPrice(${idx})" class="text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30" title="Precio modificado manualmente (Click para cambiar)">✏️ $${item.precio_manual.toFixed(2)} c/u</button>`
            : `<button type="button" onclick="window.editPos419ItemPrice(${idx})" class="text-gray-400 font-mono hover:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer" title="Modificar precio unitario"><span>$${(item.precio_unitario_aplicado || 0).toFixed(2)} c/u</span><span class="text-[9px] text-amber-400/80">✏️</span></button>`;

        return `
        <div class="bg-dark-100 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2.5">
                <div class="w-10 h-10 flex-shrink-0 bg-dark-200 border border-white/10 rounded-lg overflow-hidden">
                    <img src="${getOptimizedImageUrl(item.foto, 100)}" class="w-full h-full object-cover">
                </div>
                <div class="min-w-0 flex-grow">
                    <h5 class="text-xs font-bold text-white truncate">${item.nombre}</h5>
                    <div class="flex items-center gap-2 mt-0.5 text-[10px]">
                        <span class="bg-amber-500/20 text-amber-400 font-bold px-1.5 rounded">${item.talla}</span>
                        ${priceDisplayHtml}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <div class="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
                        <button type="button" onclick="window.updatePos419ItemQty(${idx}, -1)" class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold">-</button>
                        <span class="w-6 text-center text-xs font-bold text-amber-400 font-mono">${item.cantidad}</span>
                        <button type="button" onclick="window.updatePos419ItemQty(${idx}, 1)" class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold">+</button>
                    </div>
                    <button type="button" onclick="window.removePos419Item(${idx})" class="p-1 text-gray-500 hover:text-red-400 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            <div class="pt-1 border-t border-white/5 flex items-center justify-between">
                ${persBadgeHtml}
                <span class="text-xs font-bold text-amber-400 font-mono">$${(item.subtotal || 0).toFixed(2)}</span>
            </div>
        </div>
        `;
    }).join('');
}

let isSubmittingPos419Lock = false;

async function submitPos419Order() {
    if (isSubmittingPos419Lock) return;
    if (pos419Cart.length === 0) return;
    
    isSubmittingPos419Lock = true;
    try {
        const metodoPago = document.getElementById('pos419-payment-method')?.value || 'Efectivo';
        
        let subtotalItems = 0;
        pos419Cart.forEach(i => subtotalItems += (i.subtotal || 0));
        
        let totalPieces = 0;
        pos419Cart.forEach(i => totalPieces += i.cantidad);

        const discountValEl = document.getElementById('pos419-discount-val');
        const discountInputVal = discountValEl ? parseFloat(discountValEl.value || 0) : 0;

        let descuentoMonto = 0;
        if (!isNaN(discountInputVal) && discountInputVal > 0) {
            descuentoMonto = Math.min(subtotalItems, discountInputVal);
        }

        const basePrendas = Math.max(0, subtotalItems - descuentoMonto);
        const metodoPagoEl = document.getElementById('pos419-payment-method');
        const metodoPagoVal = metodoPagoEl ? metodoPagoEl.value : 'Efectivo';
        const isTerminal = (metodoPagoVal.toLowerCase().indexOf('tarjeta') !== -1 || metodoPagoVal.toLowerCase().indexOf('terminal') !== -1);
        const comisionTerminalMonto = isTerminal ? (basePrendas * 0.05) : 0;

        const granTotal = basePrendas + comisionTerminalMonto;

        // Obtener datos de pago en efectivo
        const isEfectivo = metodoPagoVal.toLowerCase().includes('efectivo');
        const cashReceivedInput = document.getElementById('pos419-cash-received-val');
        let cashReceivedVal = (cashReceivedInput && isEfectivo) ? parseFloat(cashReceivedInput.value || 0) : 0;

        // Ventana Emergente Obligatoria para Cobro en Efectivo
        if (isEfectivo) {
            const cashModalRes = await Swal.fire({
                title: '💵 Cobro en Efectivo',
                html: `
                    <div class="text-left space-y-3 py-1">
                        <div class="bg-black/40 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                            <span class="text-xs text-gray-400 font-bold uppercase">Total a Cobrar:</span>
                            <span class="text-lg font-black text-amber-400 font-mono">$${granTotal.toFixed(2)}</span>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-300 mb-1">¿Con cuánto dinero paga el cliente? ($):</label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-sm">$</span>
                                <input type="number" id="swal-pos419-cash-input" step="0.01" value="${cashReceivedVal > 0 ? cashReceivedVal : ''}" placeholder="${granTotal.toFixed(2)}" class="w-full bg-dark-200 border-2 border-emerald-500/50 rounded-xl pl-7 pr-3 py-2.5 text-base font-black text-emerald-300 focus:outline-none focus:border-emerald-400 font-mono">
                            </div>
                        </div>

                        <!-- Botones de Acceso Rápido -->
                        <div class="flex flex-wrap gap-1.5 pt-1">
                            <button type="button" onclick="const inp = document.getElementById('swal-pos419-cash-input'); if(inp){ inp.value = ${granTotal.toFixed(2)}; inp.dispatchEvent(new Event('input')); }" class="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer">Exacto ($${granTotal.toFixed(2)})</button>
                            <button type="button" onclick="const inp = document.getElementById('swal-pos419-cash-input'); if(inp){ inp.value = 100; inp.dispatchEvent(new Event('input')); }" class="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer">$100</button>
                            <button type="button" onclick="const inp = document.getElementById('swal-pos419-cash-input'); if(inp){ inp.value = 200; inp.dispatchEvent(new Event('input')); }" class="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer">$200</button>
                            <button type="button" onclick="const inp = document.getElementById('swal-pos419-cash-input'); if(inp){ inp.value = 500; inp.dispatchEvent(new Event('input')); }" class="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer">$500</button>
                            <button type="button" onclick="const inp = document.getElementById('swal-pos419-cash-input'); if(inp){ inp.value = 1000; inp.dispatchEvent(new Event('input')); }" class="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer">$1,000</button>
                        </div>

                        <div id="swal-pos419-change-box" class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between transition-colors">
                            <span class="text-xs font-bold text-emerald-400 uppercase">Cambio a Entregar:</span>
                            <span id="swal-pos419-change-val" class="text-lg font-black text-emerald-300 font-mono">$0.00</span>
                        </div>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Confirmar Pago y Cobrar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#374151',
                background: '#151515', color: '#fff',
                didOpen: () => {
                    const inp = document.getElementById('swal-pos419-cash-input');
                    const changeBox = document.getElementById('swal-pos419-change-val');
                    const changeContainer = document.getElementById('swal-pos419-change-box');

                    const updateCalc = () => {
                        const val = parseFloat(inp.value || 0);
                        if (val >= granTotal) {
                            const cambio = val - granTotal;
                            changeBox.textContent = `$${cambio.toFixed(2)}`;
                            changeContainer.className = 'p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between';
                            changeBox.className = 'text-lg font-black text-emerald-300 font-mono';
                        } else if (val > 0) {
                            const falta = granTotal - val;
                            changeBox.textContent = `Falta: $${falta.toFixed(2)}`;
                            changeContainer.className = 'p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between';
                            changeBox.className = 'text-base font-bold text-amber-400 font-mono';
                        } else {
                            changeBox.textContent = '$0.00';
                            changeContainer.className = 'p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between';
                            changeBox.className = 'text-lg font-black text-emerald-300 font-mono';
                        }
                    };

                    if (inp) {
                        inp.focus();
                        inp.addEventListener('input', updateCalc);
                        updateCalc();
                    }
                },
                preConfirm: () => {
                    const inp = document.getElementById('swal-pos419-cash-input');
                    const val = parseFloat(inp ? inp.value : 0);
                    if (isNaN(val) || val < granTotal) {
                        Swal.showValidationMessage(`El pago ingresado ($${(val || 0).toFixed(2)}) debe ser mayor o igual al Total ($${granTotal.toFixed(2)})`);
                        return false;
                    }
                    return val;
                }
            });

            if (!cashModalRes.isConfirmed) return;
            cashReceivedVal = parseFloat(cashModalRes.value || 0);

            // Sincronizar input en la barra lateral
            if (cashReceivedInput) cashReceivedInput.value = cashReceivedVal.toFixed(2);
            recalculatePos419Cart();
        }

        const cambioEntregadoVal = (isEfectivo && cashReceivedVal >= granTotal) ? (cashReceivedVal - granTotal) : 0;
        
        let appliedTier = 'Menudeo';
        const clientPerfil = pos419Client.perfil || 'Menudeo';
        const isMostrador = pos419Client.id_cliente === 'CLI-MOSTRADOR';
        
        if (isMostrador) {
            if (totalPieces >= 12) appliedTier = 'Súper Mayoreo';
            else if (totalPieces >= 6) appliedTier = 'Mayoreo';
            else appliedTier = 'Menudeo';
        } else {
            if (clientPerfil === 'Súper Mayoreo' || totalPieces >= 12) appliedTier = 'Súper Mayoreo';
            else if (clientPerfil === 'Mayoreo' || totalPieces >= 6) appliedTier = 'Mayoreo';
            else appliedTier = 'Menudeo';
        }

        const finalClientName = (isMostrador && pos419Client.nombre_mostrador_custom)
            ? `Cliente Mostrador - ${pos419Client.nombre_mostrador_custom}`
            : pos419Client.nombre_completo;

        let discountSummaryHtml = `<p>Subtotal prendas: <strong class="text-gray-300 font-mono">$${subtotalItems.toFixed(2)}</strong></p>`;
        if (descuentoMonto > 0) {
            discountSummaryHtml += `<p>Descuento especial: <strong class="text-emerald-400 font-mono">-$${descuentoMonto.toFixed(2)}</strong></p>`;
        }
        if (comisionTerminalMonto > 0) {
            discountSummaryHtml += `<p>Comisión Terminal (5%): <strong class="text-sky-400 font-mono">+$${comisionTerminalMonto.toFixed(2)}</strong></p>`;
        }
        if (isEfectivo && cashReceivedVal > 0) {
            discountSummaryHtml += `<p>Pago Recibido (Efectivo): <strong class="text-emerald-400 font-mono">$${cashReceivedVal.toFixed(2)}</strong></p>`;
            discountSummaryHtml += `<p>Cambio a Entregar: <strong class="text-emerald-300 font-mono">$${cambioEntregadoVal.toFixed(2)}</strong></p>`;
        }
        
        const confirmRes = await Swal.fire({
            title: '¿Confirmar Venta en Local 419?',
            html: `
                <div class="text-left space-y-2 text-xs text-gray-300 py-2">
                    <p>Cliente: <strong class="text-white">${finalClientName}</strong></p>
                    <p>Piezas: <strong class="text-white">${totalPieces} pzas</strong></p>
                    <p>Nivel de Precio: <strong class="text-amber-400">${appliedTier}</strong></p>
                    <p>Método de Pago: <strong class="text-emerald-400">${metodoPagoVal}</strong></p>
                    ${discountSummaryHtml}
                    <p class="text-sm font-bold text-white pt-2 border-t border-white/10">Total a Cobrar: <span class="text-amber-400 font-mono">$${granTotal.toFixed(2)}</span></p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, Cobrar y Generar Orden',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#374151',
            background: '#151515', color: '#fff'
        });
        
        if (!confirmRes.isConfirmed) return;
        
        // ⚡ 1. DESCUENTO BIDIRECCIONAL OPTIMISTA EN MEMORIA (0ms Latencia)
        let syncedCount = 0;
        pos419Cart.forEach(cartItem => {
            const prod419 = (allProducts419 || []).find(p => String(p.id || '').toUpperCase() === String(cartItem.id_playera || '').toUpperCase());
            if (prod419 && Array.isArray(prod419.tallas)) {
                const tObj419 = prod419.tallas.find(t => String(t.talla || '').trim().toUpperCase() === String(cartItem.talla || '').trim().toUpperCase());
                if (tObj419) {
                    const st = Number(tObj419.stock !== undefined ? tObj419.stock : tObj419.inventario || 0);
                    tObj419.stock = Math.max(0, st - cartItem.cantidad);
                    tObj419.inventario = Math.max(0, st - cartItem.cantidad);
                }
            }
        });

        // Actualizar vistas en pantalla de inmediato
        if (typeof renderProducts === 'function') renderProducts();
        if (typeof renderInventario419Grid === 'function') renderInventario419Grid(allProducts419);

        const customName = (pos419Client.nombre_mostrador_custom || '').trim();
        const clientIdToSend = isMostrador
            ? (customName ? `CLI-MOSTRADOR-${customName}` : 'CLI-MOSTRADOR-Cliente Mostrador')
            : pos419Client.id_cliente;

        const generatedOrderId = 'POS419-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 900 + 100);
        
        const payload = {
            id_orden_temp: generatedOrderId,
            action: 'create_pos_419_order',
            id_cliente: clientIdToSend,
            nombre_cliente: finalClientName,
            tipo_precio_aplicado: appliedTier,
            metodo_pago: metodoPagoVal,
            monto_recibido: cashReceivedVal,
            cambio_entregado: cambioEntregadoVal,
            subtotal: subtotalItems,
            descuento: descuentoMonto,
            comision_terminal: comisionTerminalMonto,
            descuento_tipo: descuentoMonto > 0 ? "Monto" : "Ninguno",
            total_cobrado: granTotal,
            idempotency_key: 'IDEMP-POS-' + clientIdToSend + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            items: pos419Cart.map(i => ({
                id_playera: i.id_playera,
                talla: i.talla,
                cantidad: i.cantidad,
                categoria: i.genero || 'Adulto',
                precio_unitario: i.precio_unitario_aplicado,
                precio_manual: i.precio_manual !== undefined ? i.precio_manual : null,
                tipo_personalizacion: i.tipo_personalizacion || 'PERS-NONE',
                detalles_personalizacion: i.personalizacion_texto || '',
                subtotal: i.subtotal
            }))
        };

        // 🛡️ 2. ENCOLAR EN MEMORIA LOCAL SEGURA (pos_sync_queue) ANTES DEL ENVÍO
        let syncQueue = [];
        try { syncQueue = JSON.parse(localStorage.getItem('pos_sync_queue') || '[]'); } catch (e) { syncQueue = []; }
        syncQueue.push(payload);
        try { localStorage.setItem('pos_sync_queue', JSON.stringify(syncQueue)); } catch (e) {}

        window.updatePosSyncStatusUI();

        // Guardar datos del ticket
        const lastTicketData = {
            id_orden: generatedOrderId,
            fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
            cliente: finalClientName,
            metodo_pago: metodoPagoVal,
            monto_recibido: cashReceivedVal,
            cambio_entregado: cambioEntregadoVal,
            subtotal: subtotalItems,
            descuento: descuentoMonto,
            comision_terminal: comisionTerminalMonto,
            gran_total: granTotal,
            items: pos419Cart.map(i => ({
                id_playera: i.nombre || i.id_playera,
                talla: i.talla,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario_aplicado,
                subtotal: i.subtotal,
                detalles_personalizacion: i.personalizacion_texto || ''
            }))
        };
        window.lastPos419TicketData = lastTicketData;

        // ⚡ 3. CONFIRMACIÓN Y EXPEDICIÓN DE TICKET DE INMEDIATO
        await Swal.fire({
            icon: 'success',
            title: '¡Venta Registrada con Éxito!',
            html: `
                <div class="text-center space-y-3 py-2">
                    <p class="text-xs text-gray-300">Folio Venta: <strong class="text-white font-mono">${generatedOrderId}</strong></p>
                    <p class="text-sm font-bold text-amber-400 font-mono">Cobrado: $${granTotal.toFixed(2)} (${metodoPagoVal})</p>
                    ${cashReceivedVal > 0 ? `<p class="text-xs text-emerald-400 font-bold font-mono">Recibido: $${cashReceivedVal.toFixed(2)} | Cambio: $${cambioEntregadoVal.toFixed(2)}</p>` : ''}
                    <p class="text-[11px] text-emerald-400">✓ Piezas descontadas de Local 419 ${syncedCount > 0 ? `y sincronizadas simultáneamente con General` : ''}</p>
                    <button type="button" onclick="window.printPos419Ticket()" class="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Imprimir Ticket (Xprinter XP-N160I-BT)
                    </button>
                </div>
            `,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Listo',
            background: '#151515', color: '#fff'
        });
        
        pos419Cart = [];
        if (discountValEl) discountValEl.value = '';
        if (cashReceivedInput) cashReceivedInput.value = '';
        recalculatePos419Cart();
        
        closePos419Modal();
        openInventario419View();

        // ⚡ 4. PROCESAR ENVIÓ A GOOGLE SHEETS EN SEGUNDO PLANO (NON-BLOCKING)
        window.processPosSyncQueueInBg();
    } catch (err) {
        console.error("Error al registrar venta POS 419:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Venta',
            text: err.message || 'No se pudo procesar la orden en Local 419.',
            background: '#151515', color: '#fff'
        });
    } finally {
        isSubmittingPos419Lock = false;
    }
}
window.submitPos419Order = submitPos419Order;

// 🛡️ WORKER DE SEGUNDO PLANO Y TOLERANCIA A FALLOS (pos_sync_queue)
window.updatePosSyncStatusUI = function() {
    const badgeEl = document.getElementById('pos419-sync-status-badge');
    if (!badgeEl) return;

    let queue = [];
    try { queue = JSON.parse(localStorage.getItem('pos_sync_queue') || '[]'); } catch (e) { queue = []; }

    if (queue.length === 0) {
        badgeEl.className = 'px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm';
        badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>🟢 Sincronizado</span>`;
    } else {
        badgeEl.className = 'px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-amber-500/30';
        badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span><span>🟡 ${queue.length} Pendiente(s) [ Reintentar ]</span>`;
        badgeEl.onclick = function() { window.processPosSyncQueueInBg(true); };
    }
};

window.isProcessingPosQueue = false;
window.processPosSyncQueueInBg = async function(userTriggered = false) {
    if (window.isProcessingPosQueue) return;

    let queue = [];
    try { queue = JSON.parse(localStorage.getItem('pos_sync_queue') || '[]'); } catch (e) { queue = []; }
    if (queue.length === 0) {
        window.updatePosSyncStatusUI();
        if (userTriggered) {
            Swal.fire({ icon: 'success', title: 'Todo Sincronizado', text: 'No hay ventas pendientes en cola local.', background: '#151515', color: '#fff', timer: 1500, showConfirmButton: false });
        }
        return;
    }

    window.isProcessingPosQueue = true;
    window.updatePosSyncStatusUI();

    let updatedQueue = [...queue];
    for (let i = 0; i < queue.length; i++) {
        const itemPayload = queue[i];
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(itemPayload)
            });
            const data = await response.json();
            if (data && (data.status === 'success' || data.id_orden)) {
                // Éxito: Remover de la cola
                updatedQueue = updatedQueue.filter(q => q.id_orden_temp !== itemPayload.id_orden_temp && q.idempotency_key !== itemPayload.idempotency_key);
                try { localStorage.setItem('pos_sync_queue', JSON.stringify(updatedQueue)); } catch (e) {}

                // Si el item tenía productos sincronizados con General, enviar también el descuento de General
                if (Array.isArray(itemPayload.items)) {
                    itemPayload.items.forEach(it => {
                        const prodGen = (allProducts || []).find(p => String(p.id || '').toUpperCase() === String(it.id_playera || '').toUpperCase());
                        if (prodGen && Array.isArray(prodGen.tallas)) {
                            fetch(API_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                body: JSON.stringify({
                                    action: 'update_stock_talla',
                                    origen: 'general',
                                    id_playera: it.id_playera,
                                    talla: it.talla,
                                    cantidad: Math.max(0, Number(it.cantidad || 1)),
                                    operacion: 'descontar'
                                })
                            }).catch(errG => console.warn("Error en fondo guardando descuento general:", errG));
                        }
                    });
                }
            }
        } catch (errReq) {
            console.warn("Fallo de red/servidor al procesar en cola:", errReq);
            break; // Detener bucle si hay fallo de red
        }
    }

    window.isProcessingPosQueue = false;
    window.updatePosSyncStatusUI();

    if (typeof fetchProducts419 === 'function') fetchProducts419(true);
    if (typeof fetchInitialProducts === 'function') fetchInitialProducts(true);

    if (userTriggered) {
        if (updatedQueue.length === 0) {
            Swal.fire({ icon: 'success', title: '¡Sincronización Exitosa!', text: 'Todas las ventas de la cola fueron guardadas en Google Sheets.', background: '#151515', color: '#fff', confirmButtonColor: '#10b981' });
        } else {
            Swal.fire({ icon: 'warning', title: 'Reintento Parcial', text: `Quedan ${updatedQueue.length} venta(s) pendientes por reconexión.`, background: '#151515', color: '#fff', confirmButtonColor: '#f59e0b' });
        }
    }
};

window.addEventListener('online', () => {
    console.log("🌐 Conexión a internet restablecida. Procesando cola de ventas POS...");
    window.processPosSyncQueueInBg();
});

const defaultTicketConfig = {
    nombreTienda: 'JERSEYS 419',
    direccion1: 'Alamillo # 501, Local 6 (Planta Alta)',
    direccion2: 'Bosque Real, Apodaca.',
    horario: 'Lun a Sáb: 11:00 AM - 8:00 PM | Dom: 12:00 PM - 5:00 PM',
    qrUrl: 'https://wa.me/528132698182',
    politicas: 'Cambios: Plazo máximo de 15 días naturales. La prenda debe estar sin uso, con etiquetas originales, sin manchas ni olores. Es obligatorio presentar esta nota.\nGarantía: Defectos de fábrica válidos por 15 días. No aplica por mal uso, lavado inadecuado o desgaste natural.\nDevoluciones: No se realiza reembolso de efectivo; se emitirá un crédito con el valor de la prenda comprada.\nRestricciones: Sólo se podrá realizar un cambio por prenda adquirida.',
    mensajePie: '*** ¡GRACIAS POR TU COMPRA! ***'
};

window.generateTicketWhatsappQrUrl = function(baseConfigUrl, folioStr, clienteStr) {
    let targetPhone = '528132698182';
    
    if (baseConfigUrl && typeof baseConfigUrl === 'string') {
        const rawDigits = baseConfigUrl.replace(/\D/g, '');
        if (rawDigits.length >= 10) {
            targetPhone = rawDigits.startsWith('52') ? rawDigits : ('52' + rawDigits);
        }
    }
    
    let msg = `Hola, requiero atención sobre mi orden de compra ${folioStr || ''}`;
    if (clienteStr && String(clienteStr).trim() !== '' && String(clienteStr).trim() !== 'Cliente Mostrador') {
        msg += ` (Cliente: ${String(clienteStr).trim()})`;
    }
    
    const waLink = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg.trim())}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(waLink)}`;
};

window.getTicketConfig = function() {
    try {
        const saved = localStorage.getItem('jerseys_ticket_config_v1');
        if (saved) {
            return { ...defaultTicketConfig, ...JSON.parse(saved) };
        }
    } catch (e) {}
    return defaultTicketConfig;
};

window.saveTicketConfig = function(cfg) {
    try {
        localStorage.setItem('jerseys_ticket_config_v1', JSON.stringify(cfg));
    } catch (e) {}
};

window.fetchTicketConfigFromCloud = async function() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_ticket_config' })
        });
        const resData = await response.json();
        if (resData && (resData.status === 'success' || resData.config || resData.data)) {
            const remoteCfg = resData.config || resData.data || resData;
            const merged = { ...defaultTicketConfig, ...remoteCfg };
            window.saveTicketConfig(merged);
            return merged;
        }
    } catch (e) {
        console.warn("No se pudo obtener la configuración del ticket desde Google Sheets:", e);
    }
    return window.getTicketConfig();
};

window.saveTicketConfigToCloud = async function(cfg) {
    window.saveTicketConfig(cfg);
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'save_ticket_config',
                ticket_config: cfg,
                config: cfg
            })
        });
    } catch (e) {
        console.warn("No se pudo guardar la configuración del ticket en Google Sheets:", e);
    }
};

window.updateLiveTicketPreview = function() {
    const previewContainer = document.getElementById('ticket-live-preview-content');
    if (!previewContainer) return;

    const nombre = (document.getElementById('cfg-ticket-nombre')?.value || 'JERSEYS 419').trim();
    const dir1 = (document.getElementById('cfg-ticket-dir1')?.value || 'Alamillo # 501, Local 6 (Planta Alta)').trim();
    const dir2 = (document.getElementById('cfg-ticket-dir2')?.value || 'Bosque Real, Apodaca.').trim();
    const horario = (document.getElementById('cfg-ticket-horario')?.value || 'Lun a Sáb: 11:00 AM - 8:00 PM | Dom: 12:00 PM - 5:00 PM').trim();
    const qrUrl = (document.getElementById('cfg-ticket-qr')?.value || 'https://wa.me/528132698182').trim();
    const politicas = (document.getElementById('cfg-ticket-politicas')?.value || '').trim();
    const pie = (document.getElementById('cfg-ticket-pie')?.value || '*** ¡GRACIAS POR TU COMPRA! ***').trim();

    const qrImgSrc = window.generateTicketWhatsappQrUrl(qrUrl, 'ORD-419-802389', 'Cliente Mostrador');

    previewContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 6px;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px; line-height: 1;">${nombre}</div>
            ${dir1 ? `<div style="font-size: 9.5px; margin-top: 3px;">${dir1}</div>` : ''}
            ${dir2 ? `<div style="font-size: 9.5px;">${dir2}</div>` : ''}
            ${horario ? `<div style="font-size: 8.5px; margin-top: 2px; font-weight: bold;">Horarios: ${horario}</div>` : ''}
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between;">
                <strong>NOTA DE VENTA:</strong>
                <strong style="font-size: 10.5px;">ORD-419-802389</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <strong>FECHA:</strong>
                <span>${new Date().toLocaleDateString('es-MX')} 7:30 PM</span>
            </div>
            <div style="margin-top: 2px;">
                <strong>CLIENTE:</strong> Cliente Mostrador
            </div>
        </div>

        <div style="border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px; font-weight: bold; display: flex; justify-content: space-between; font-size: 9.5px;">
            <span>CANT / DESCRIPCION</span>
            <span>IMPORTE</span>
        </div>

        <div style="margin-bottom: 6px;">
            <div style="margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10.5px;">
                    <span>1x MONTERREY / RAYADOS 80 ANI</span>
                    <span>$200.00</span>
                </div>
                <div style="font-size: 9px; color: #111; padding-left: 6px;">
                    Talla: S
                </div>
            </div>
            <div style="margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10.5px;">
                    <span>1x TIGRES 26/27</span>
                    <span>$220.00</span>
                </div>
                <div style="font-size: 9px; color: #111; padding-left: 6px;">
                    Talla: L
                </div>
            </div>
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 4px; margin-bottom: 6px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: bold;">
                <span>TOTAL DE PIEZAS:</span>
                <span>2 PZS</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <strong>FORMA DE PAGO:</strong>
                <span>EFECTIVO</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>SU PAGO (EFECTIVO):</span>
                <span>$500.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>SU CAMBIO:</span>
                <span>$80.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; border-top: 1.5px solid #000; padding-top: 3px; margin-top: 3px;">
                <span>TOTAL $:</span>
                <span>$420.00</span>
            </div>
        </div>

        ${politicas ? `
        <div style="font-size: 7.5px; border-top: 1px solid #000; padding-top: 4px; text-align: justify; line-height: 1.15; white-space: pre-line;">
            ${politicas}
        </div>
        ` : ''}

        ${pie ? `
        <div style="text-align: center; font-size: 8.5px; font-weight: bold; margin-top: 6px;">
            ${pie}
        </div>
        ` : ''}

        <div style="width: 100%; text-align: center; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg id="live-ticket-barcode-svg" style="margin: 0 auto; display: block; max-width: 85%;"></svg>
        </div>

        ${qrImgSrc ? `
        <div style="text-align: center; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000;">
            <img src="${qrImgSrc}" style="width: 24mm; height: 24mm; margin: 0 auto; display: block;" alt="QR Code">
            <div style="font-size: 7.5px; font-weight: bold; margin-top: 2px;">ESCANEA PARA ATENCIÓN EN LÍNEA</div>
        </div>
        ` : ''}
    `;

    try {
        if (typeof JsBarcode === 'function') {
            JsBarcode("#live-ticket-barcode-svg", "ORD419802389", {
                format: "CODE128",
                width: 1.2,
                height: 24,
                displayValue: true,
                text: "ORD-419-802389",
                fontSize: 9,
                margin: 0
            });
        }
    } catch(eB) {}
};

window.openTicketConfigModal = async function() {
    const modal = document.getElementById('admin-ticket-config-modal');
    if (!modal) return;

    // 1. Mostrar de inmediato la configuración local guardada mientras se consulta la nube
    const localCfg = window.getTicketConfig();
    populateTicketFields(localCfg);
    window.updateLiveTicketPreview();
    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    // 2. Consultar Google Sheets API en segundo plano y actualizar campos
    try {
        const remoteCfg = await window.fetchTicketConfigFromCloud();
        if (remoteCfg) {
            populateTicketFields(remoteCfg);
            window.updateLiveTicketPreview();
        }
    } catch (err) {
        console.warn("Error al sincronizar ticket config con Google Sheets:", err);
    }

    ['cfg-ticket-nombre', 'cfg-ticket-dir1', 'cfg-ticket-dir2', 'cfg-ticket-horario', 'cfg-ticket-qr', 'cfg-ticket-politicas', 'cfg-ticket-pie'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp && !inp.dataset.hasLivePreviewListener) {
            inp.dataset.hasLivePreviewListener = "true";
            inp.addEventListener('input', window.updateLiveTicketPreview);
        }
    });
};

function populateTicketFields(cfg) {
    const elNom = document.getElementById('cfg-ticket-nombre');
    const elDir1 = document.getElementById('cfg-ticket-dir1');
    const elDir2 = document.getElementById('cfg-ticket-dir2');
    const elHor = document.getElementById('cfg-ticket-horario');
    const elQr = document.getElementById('cfg-ticket-qr');
    const elPol = document.getElementById('cfg-ticket-politicas');
    const elPie = document.getElementById('cfg-ticket-pie');

    if (elNom) elNom.value = cfg.nombreTienda || '';
    if (elDir1) elDir1.value = cfg.direccion1 || '';
    if (elDir2) elDir2.value = cfg.direccion2 || '';
    if (elHor) elHor.value = cfg.horario || '';
    if (elQr) elQr.value = cfg.qrUrl || '';
    if (elPol) elPol.value = cfg.politicas || '';
    if (elPie) elPie.value = cfg.mensajePie || '';
}

window.closeTicketConfigModal = function() {
    const modal = document.getElementById('admin-ticket-config-modal');
    if (modal) modal.classList.add('hidden');
};

function printPos419Ticket(dataCustom) {
    const data = dataCustom || window.lastPos419TicketData;
    if (!data) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos de ticket',
            text: 'No hay datos de venta recientes para imprimir.',
            background: '#151515', color: '#fff'
        });
        return;
    }

    const cfg = window.getTicketConfig();

    const fechaStr = data.fecha || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const clienteStr = data.cliente || 'Cliente Mostrador';
    const folioStr = data.id_orden || 'ORD-419-000000';
    const metodoPagoStr = (data.metodo_pago || 'Efectivo').toUpperCase();
    const items = data.items || [];
    const subtotal = Number(data.subtotal || data.gran_total || 0);
    const descuento = Number(data.descuento || 0);
    const comisionTerminal = Number(data.comision_terminal || 0);
    const total = Number(data.gran_total || 0);

    const isEfectivo = metodoPagoStr.includes('EFECTIVO');
    const isTransf = metodoPagoStr.includes('TRANSF');
    const isTC = metodoPagoStr.includes('TC') || metodoPagoStr.includes('TARJETA');

    let totalPiezas = 0;
    let itemsHtml = '';
    items.forEach(it => {
        const cant = Number(it.cantidad || 1);
        totalPiezas += cant;
        const nombreStr = (it.id_playera || it.nombre || 'Playera').substring(0, 24);
        const tallaStr = (it.talla || '').toUpperCase();
        const pSub = Number(it.subtotal || (it.precio_unitario * cant)).toFixed(2);
        
        itemsHtml += `
            <div style="margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11.5px; color: #000000;">
                    <span>${cant}x ${nombreStr}</span>
                    <span>$${pSub}</span>
                </div>
                <div style="font-size: 10px; font-weight: bold; color: #000000; padding-left: 6px;">
                    Talla: ${tallaStr} ${it.detalles_personalizacion ? ` | Pers: ${it.detalles_personalizacion}` : ''}
                </div>
            </div>
        `;
    });

    const montoRecibido = Number(data.monto_recibido || 0);
    const cambioEntregado = Number(data.cambio_entregado !== undefined ? data.cambio_entregado : (montoRecibido > 0 ? montoRecibido - total : 0));

    const qrImgSrc = window.generateTicketWhatsappQrUrl(cfg.qrUrl, folioStr, clienteStr);

    const fullTicketContent = `
        <div style="text-align: center; margin-bottom: 6px;">
            <div style="font-size: 18px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.1; color: #000000;">${cfg.nombreTienda}</div>
            ${cfg.direccion1 ? `<div style="font-size: 10px; font-weight: bold; margin-top: 3px; color: #000000;">${cfg.direccion1}</div>` : ''}
            ${cfg.direccion2 ? `<div style="font-size: 10px; font-weight: bold; color: #000000;">${cfg.direccion2}</div>` : ''}
            ${cfg.horario ? `<div style="font-size: 9px; margin-top: 2px; font-weight: bold; color: #000000;">Horarios: ${cfg.horario}</div>` : ''}
        </div>

        <div style="border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 4px 0; margin-bottom: 6px; font-size: 10.5px; font-weight: bold; color: #000000;">
            <div style="display: flex; justify-content: space-between;">
                <strong>NOTA DE VENTA:</strong>
                <strong style="font-size: 11.5px;">${folioStr}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <strong>FECHA:</strong>
                <span>${fechaStr}</span>
            </div>
            <div style="margin-top: 2px;">
                <strong>CLIENTE:</strong> ${clienteStr}
            </div>
        </div>

        <div style="border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 5px; font-weight: bold; display: flex; justify-content: space-between; font-size: 10.5px; color: #000000;">
            <span>CANT / DESCRIPCION</span>
            <span>IMPORTE</span>
        </div>

        <div style="margin-bottom: 6px; color: #000000;">
            ${itemsHtml}
        </div>

        <div style="border-top: 1.5px dashed #000; padding-top: 4px; margin-bottom: 6px; font-size: 10.5px; font-weight: bold; color: #000000;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: bold;">
                <span>TOTAL DE PIEZAS:</span>
                <span>${totalPiezas} PZS</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <strong>FORMA DE PAGO:</strong>
                <span>${metodoPagoStr}</span>
            </div>
            ${isEfectivo && montoRecibido > 0 ? `
            <div style="display: flex; justify-content: space-between;">
                <span>SU PAGO (EFECTIVO):</span>
                <span>$${montoRecibido.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>SU CAMBIO:</span>
                <span>$${cambioEntregado.toFixed(2)}</span>
            </div>
            ` : ''}
            ${descuento > 0 ? `
            <div style="display: flex; justify-content: space-between;">
                <span>SUBTOTAL:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>DESCUENTO:</span>
                <span>-$${descuento.toFixed(2)}</span>
            </div>
            ` : ''}
            ${comisionTerminal > 0 ? `
            <div style="display: flex; justify-content: space-between;">
                <span>COMISION TERMINAL (5%):</span>
                <span>+$${comisionTerminal.toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1.5px solid #000; padding-top: 3px; margin-top: 3px; color: #000000;">
                <span>TOTAL $:</span>
                <span>$${total.toFixed(2)}</span>
            </div>
        </div>

        ${cfg.politicas ? `
        <div style="font-size: 9px; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; text-align: justify; line-height: 1.2; white-space: pre-line; color: #000000;">
            ${cfg.politicas}
        </div>
        ` : ''}

        ${cfg.mensajePie ? `
        <div style="text-align: center; font-size: 9.5px; font-weight: bold; margin-top: 6px; color: #000000;">
            ${cfg.mensajePie}
        </div>
        ` : ''}

        <!-- Código de Barras Escaneable del Folio Centrado -->
        <div style="width: 100%; text-align: center; margin-top: 6px; padding-top: 4px; border-top: 1.5px dashed #000; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg id="ticket-folio-barcode-svg" style="margin: 0 auto; display: block; max-width: 85%;"></svg>
        </div>

        <!-- Código QR de Atención / Enlace -->
        ${qrImgSrc ? `
        <div style="text-align: center; margin-top: 6px; padding-top: 4px; border-top: 1.5px dashed #000;">
            <img src="${qrImgSrc}" style="width: 26mm; height: 26mm; margin: 0 auto; display: block;" alt="QR Code">
            <div style="font-size: 9px; font-weight: bold; margin-top: 2px; color: #000000;">ESCANEA PARA ATENCIÓN EN LÍNEA</div>
        </div>
        ` : ''}
    `;

    // 1. Intentar impresión aislada vía iFrame (Garantiza vista previa limpia en móviles y tablets)
    try {
        let iframe = document.getElementById('ticket-print-iframe');
        if (iframe) iframe.remove();

        iframe = document.createElement('iframe');
        iframe.id = 'ticket-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Ticket ${folioStr}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body {
                        width: 70mm;
                        max-width: 70mm;
                        margin: 0 auto;
                        padding: 2mm 2mm;
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 11px;
                        line-height: 1.2;
                        color: #000000 !important;
                        background: #ffffff !important;
                    }
                    * { box-sizing: border-box; color: #000000 !important; }
                </style>
            </head>
            <body>
                ${fullTicketContent}
            </body>
            </html>
        `);
        doc.close();

        let printed = false;
        const doPrint = () => {
            if (printed) return;
            printed = true;
            try {
                if (iframe.contentWindow.JsBarcode) {
                    const barcodeValue = String(folioStr).replace(/[^A-Z0-9]/gi, '');
                    iframe.contentWindow.JsBarcode("#ticket-folio-barcode-svg", barcodeValue, {
                        format: "CODE128",
                        width: 1.3,
                        height: 25,
                        displayValue: true,
                        text: folioStr,
                        fontSize: 9.5,
                        fontOptions: "bold",
                        margin: 0
                    });
                }
            } catch(eB) {
                console.warn("Barcode generation error in ticket iframe:", eB);
            }

            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        };

        const qrImgEl = doc.querySelector('img');
        if (qrImgEl && !qrImgEl.complete) {
            qrImgEl.onload = doPrint;
            qrImgEl.onerror = doPrint;
            setTimeout(doPrint, 1200);
        } else {
            setTimeout(doPrint, 250);
        }
        return;
    } catch (eIFrame) {
        console.warn("Iframe print error fallback:", eIFrame);
    }

    // 2. Fallback secundario a contenedor DOM
    const printContainer = document.getElementById('ticket-419-print-area');
    if (printContainer) {
        printContainer.innerHTML = fullTicketContent;
        printContainer.style.display = 'block';
        printContainer.classList.remove('hidden');
        try {
            if (typeof JsBarcode === 'function') {
                const barcodeValueFallback = String(folioStr).replace(/[^A-Z0-9]/gi, '');
                JsBarcode("#ticket-folio-barcode-svg", barcodeValueFallback, {
                    format: "CODE128",
                    width: 1.3,
                    height: 25,
                    displayValue: true,
                    text: folioStr,
                    fontSize: 9.5,
                    fontOptions: "bold",
                    margin: 0
                });
            }
        } catch(eB) {}
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                printContainer.style.display = '';
                printContainer.classList.add('hidden');
            }, 500);
        }, 250);
    }
}
window.printPos419Ticket = printPos419Ticket;

// =========================================================================
// MÓDULO FRONTEND: GESTIÓN Y VENTA DE ARTÍCULOS DEPORTIVOS GENERALES
// =========================================================================

let allArticulos = [];
let allArticulos419 = [];

async function openAdminArticulosModal() {
    const modal = document.getElementById('modal-admin-articulos');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');

    fetchArticulos();
}
window.openAdminArticulosModal = openAdminArticulosModal;

function closeAdminArticulosModal() {
    const modal = document.getElementById('modal-admin-articulos');
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
window.closeAdminArticulosModal = closeAdminArticulosModal;

async function fetchArticulos() {
    const listContainer = document.getElementById('admin-articulos-list-container');
    if (listContainer) {
        listContainer.innerHTML = `<div class="text-center py-6 text-xs text-gray-400">Cargando artículos deportivos...</div>`;
    }

    if (window.startTopLoadingBar) startTopLoadingBar();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'search_articulos' })
        });
        const data = await response.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            allArticulos = data.data;
            renderAdminArticulosList();
        } else {
            if (listContainer) listContainer.innerHTML = `<div class="text-center py-6 text-xs text-gray-400">No hay artículos deportivos registrados aún.</div>`;
        }
    } catch (err) {
        console.error("Error al consultar artículos deportivos:", err);
        if (listContainer) listContainer.innerHTML = `<div class="text-center py-6 text-xs text-red-400">Error al cargar artículos.</div>`;
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
}
window.fetchArticulos = fetchArticulos;

let currentEditArticulo = null;

function openEditArticuloModal(artObj) {
    if (!artObj) return;
    currentEditArticulo = artObj;

    const modal = document.getElementById('modal-edit-articulo');
    if (!modal) return;

    document.getElementById('edit-art-id').value = artObj.id || artObj.id_articulo;
    document.getElementById('edit-art-nombre').value = artObj.nombre || '';
    document.getElementById('edit-art-categoria').value = artObj.categoria || 'Balones';
    document.getElementById('edit-art-marca').value = artObj.marca || '';
    document.getElementById('edit-art-precio-menudeo').value = artObj.precio_menudeo || artObj.precio_Menudeo || 0;
    document.getElementById('edit-art-precio-mayoreo').value = artObj.precio_mayoreo || 0;
    document.getElementById('edit-art-activo').value = (artObj.activo !== undefined && artObj.activo !== null && artObj.activo !== "") ? String(artObj.activo) : "1";

    const fotoInput = document.getElementById('edit-art-foto');
    const fotoPreviewContainer = document.getElementById('edit-art-foto-preview-container');
    const fotoFileInfo = document.getElementById('edit-art-foto-file-info');

    if (fotoInput) fotoInput.value = artObj.foto || '';
    if (fotoFileInfo) fotoFileInfo.textContent = artObj.foto ? 'Imagen cargada' : 'Sin cambios';

    if (fotoPreviewContainer) {
        if (artObj.foto) {
            renderImagePreviews(fotoPreviewContainer, [artObj.foto]);
        } else {
            fotoPreviewContainer.classList.add('hidden');
            fotoPreviewContainer.innerHTML = '';
        }
    }

    const varContainer = document.getElementById('edit-art-variantes-container');
    if (varContainer) {
        varContainer.innerHTML = '';
        const variantes = Array.isArray(artObj.variantes) && artObj.variantes.length > 0
            ? artObj.variantes
            : (Array.isArray(artObj.tallas) && artObj.tallas.length > 0
                ? artObj.tallas.map(t => ({ variante: t.talla || t.variante || 'Unitalla', stock: t.stock !== undefined ? t.stock : (t.inventario || 0) }))
                : [{ variante: 'Unitalla', stock: 0 }]);

        variantes.forEach((v, idx) => {
            const div = document.createElement('div');
            div.className = 'grid grid-cols-2 gap-2 bg-black/30 p-2 rounded-xl border border-white/5 items-center';
            div.innerHTML = `
                <div>
                    <label class="block text-[9px] font-bold text-gray-400 uppercase">Variante / Talla:</label>
                    <input type="text" value="${v.variante || 'Unitalla'}" class="edit-var-name w-full bg-dark-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white" data-idx="${idx}">
                </div>
                <div>
                    <label class="block text-[9px] font-bold text-gray-400 uppercase">Stock Almacén:</label>
                    <input type="number" value="${v.stock !== undefined ? v.stock : 0}" class="edit-var-stock w-full bg-dark-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono" data-idx="${idx}">
                </div>
            `;
            varContainer.appendChild(div);
        });
    }

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    modal.querySelector('.transform').classList.add('scale-100');
}
window.openEditArticuloModal = openEditArticuloModal;

function closeEditArticuloModal() {
    const modal = document.getElementById('modal-edit-articulo');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-100');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        currentEditArticulo = null;
    }, 300);
}
window.closeEditArticuloModal = closeEditArticuloModal;

window.editArticuloFromList = function(id) {
    const art = allArticulos.find(a => String(a.id || a.id_articulo).toUpperCase() === String(id).toUpperCase());
    if (art) {
        openEditArticuloModal(art);
    }
};

function renderAdminArticulosList() {
    const listContainer = document.getElementById('admin-articulos-list-container');
    if (!listContainer) return;

    if (allArticulos.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-6 text-xs text-gray-400">No hay artículos deportivos registrados aún.</div>`;
        return;
    }

    listContainer.innerHTML = allArticulos.map(art => {
        const imgUrl = art.foto ? getOptimizedImageUrl(art.foto, 100) : 'https://via.placeholder.com/100?text=Articulo';
        const pMen = Number(art.precio_menudeo || 0).toFixed(2);
        const pMay = Number(art.precio_mayoreo || 0).toFixed(2);

        const varsHtml = (art.variantes || []).map(v => `
            <span class="bg-black/40 border border-white/10 text-gray-300 px-2 py-0.5 rounded text-[10px] font-mono">
                ${v.variante}: <strong class="text-amber-400">${v.stock} pcs</strong>
            </span>
        `).join('');

        return `
            <div class="bg-dark-200 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all cursor-pointer" onclick="window.editArticuloFromList('${art.id || art.id_articulo}')">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${imgUrl}" referrerpolicy="no-referrer" onerror="this.onerror=null; if(this.src.includes('thumbnail')) { this.src=this.src.replace('thumbnail?id=', 'uc?export=view&id=').split('&')[0]; } else { this.src='https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=200'; }" class="w-12 h-12 object-cover rounded-lg bg-black border border-white/10 flex-shrink-0">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold text-white truncate">${art.nombre}</h4>
                            <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">${art.categoria || 'Accesorio'}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 mt-0.5">Marca: ${art.marca || 'Genérico'} | Menudeo: <span class="text-emerald-400 font-mono font-bold">$${pMen}</span> | Mayoreo: <span class="text-amber-400 font-mono font-bold">$${pMay}</span></div>
                        <div class="flex flex-wrap gap-1 mt-1.5">${varsHtml || '<span class="text-[9px] text-gray-500 italic">Sin variantes</span>'}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.editArticuloFromList('${art.id || art.id_articulo}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black transition-all text-xs font-bold flex items-center gap-1 border border-amber-500/30">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        Editar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const formCreateArt = document.getElementById('form-create-articulo');
    if (formCreateArt) {
        formCreateArt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nom = document.getElementById('art-nombre').value.trim();
            const cat = document.getElementById('art-categoria').value;
            const mar = document.getElementById('art-marca').value.trim();
            const pMen = document.getElementById('art-precio-menudeo').value;
            const pMay = document.getElementById('art-precio-mayoreo').value;
            const fot = document.getElementById('art-foto').value.trim();

            const varNom = document.getElementById('art-var-nombre').value.trim() || 'Unitalla';
            const stMain = document.getElementById('art-var-stock-main').value || 0;
            const st419 = document.getElementById('art-var-stock-419').value || 0;

            Swal.fire({
                title: 'Guardando Artículo...',
                allowOutsideClick: false,
                background: '#151515', color: '#fff',
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'create_articulo',
                        nombre: nom,
                        categoria: cat,
                        marca: mar,
                        precio_menudeo: pMen,
                        precio_mayoreo: pMay,
                        foto: fot,
                        variantes: [
                            { variante: varNom, stock: stMain, stock_419: st419 }
                        ]
                    })
                });

                const data = await response.json();
                if (data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Artículo Guardado!',
                        text: data.message,
                        background: '#151515', color: '#fff',
                        timer: 1500, showConfirmButton: false
                    });

                    formCreateArt.reset();
                    document.getElementById('art-var-nombre').value = 'Unitalla';
                    document.getElementById('art-var-stock-main').value = '10';
                    document.getElementById('art-var-stock-419').value = '5';
                    const pContainer = document.getElementById('art-foto-preview-container');
                    if (pContainer) pContainer.classList.add('hidden');
                    const fInfo = document.getElementById('art-foto-file-info');
                    if (fInfo) fInfo.textContent = 'O pega una URL:';

                    fetchArticulos();
                } else {
                    throw new Error(data.message || 'Error al guardar');
                }
            } catch (err) {
                console.error("Error al crear artículo:", err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message || 'No se pudo registrar el artículo.',
                    background: '#151515', color: '#fff'
                });
            }
        });
    }

    const artFotoFile = document.getElementById('art-foto-file');
    const artFotoInput = document.getElementById('art-foto');
    const artFotoPreviewContainer = document.getElementById('art-foto-preview-container');
    const artFotoFileInfo = document.getElementById('art-foto-file-info');

    if (artFotoFile) {
        artFotoFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                if (artFotoFileInfo) artFotoFileInfo.textContent = 'Sin archivo seleccionado';
                if (artFotoInput) artFotoInput.value = '';
                renderImagePreviews(artFotoPreviewContainer, []);
                return;
            }

            if (artFotoFileInfo) {
                artFotoFileInfo.textContent = '⏳ Subiendo imagen a Google Drive...';
                artFotoFileInfo.className = 'text-xs text-amber-400 font-bold animate-pulse';
            }

            if (artFotoPreviewContainer) {
                artFotoPreviewContainer.classList.remove('hidden');
                artFotoPreviewContainer.innerHTML = `
                    <div class="flex items-center gap-3 p-3 bg-dark-200/80 rounded-xl border border-navy-500/40">
                        <div class="w-5 h-5 border-2 border-navy-400 border-t-transparent rounded-full animate-spin"></div>
                        <span class="text-xs font-bold text-white">Subiendo imagen al servidor de Google Drive...</span>
                    </div>
                `;
            }

            try {
                const base64 = await readFileAsBase64(file);
                const uploadRes = await uploadImageToDrive(base64, file.name);

                if (uploadRes && uploadRes.status === 'success' && uploadRes.url) {
                    if (artFotoInput) artFotoInput.value = uploadRes.url;
                    if (artFotoFileInfo) {
                        artFotoFileInfo.textContent = `✓ Subido a Google Drive (${file.name})`;
                        artFotoFileInfo.className = 'text-xs text-green-400 font-semibold';
                    }
                    renderImagePreviews(artFotoPreviewContainer, [uploadRes.url]);
                } else {
                    throw new Error(uploadRes ? uploadRes.message : "Error al subir");
                }
            } catch (err) {
                console.error("Error al subir foto de artículo a Drive:", err);
                if (artFotoFileInfo) {
                    artFotoFileInfo.textContent = 'Error al subir imagen';
                    artFotoFileInfo.className = 'text-xs text-red-400 font-semibold';
                }
                if (artFotoPreviewContainer) {
                    artFotoPreviewContainer.classList.add('hidden');
                    artFotoPreviewContainer.innerHTML = '';
                }
                Swal.fire({
                    icon: 'error',
                    title: 'Error al subir',
                    text: `No se pudo subir la imagen a Google Drive: ${err.message}`,
                    background: '#151515', color: '#fff'
                });
            }
        });
    }

    const editArtFotoFile = document.getElementById('edit-art-foto-file');
    const editArtFotoInput = document.getElementById('edit-art-foto');
    const editArtFotoPreviewContainer = document.getElementById('edit-art-foto-preview-container');
    const editArtFotoFileInfo = document.getElementById('edit-art-foto-file-info');

    if (editArtFotoFile) {
        editArtFotoFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (editArtFotoFileInfo) {
                editArtFotoFileInfo.textContent = '⏳ Subiendo nueva imagen...';
                editArtFotoFileInfo.className = 'text-xs text-amber-400 font-bold animate-pulse';
            }

            if (editArtFotoPreviewContainer) {
                editArtFotoPreviewContainer.classList.remove('hidden');
                editArtFotoPreviewContainer.innerHTML = `
                    <div class="flex items-center gap-3 p-3 bg-dark-200/80 rounded-xl border border-navy-500/40">
                        <div class="w-5 h-5 border-2 border-navy-400 border-t-transparent rounded-full animate-spin"></div>
                        <span class="text-xs font-bold text-white">Subiendo imagen al servidor de Google Drive...</span>
                    </div>
                `;
            }

            try {
                const base64 = await readFileAsBase64(file);
                const uploadRes = await uploadImageToDrive(base64, file.name);

                if (uploadRes && uploadRes.status === 'success' && uploadRes.url) {
                    if (editArtFotoInput) editArtFotoInput.value = uploadRes.url;
                    if (editArtFotoFileInfo) {
                        editArtFotoFileInfo.textContent = `✓ Nueva foto subida a Google Drive (${file.name})`;
                        editArtFotoFileInfo.className = 'text-xs text-green-400 font-semibold';
                    }
                    renderImagePreviews(editArtFotoPreviewContainer, [uploadRes.url]);
                } else {
                    throw new Error(uploadRes ? uploadRes.message : "Error al subir");
                }
            } catch (err) {
                console.error("Error al subir foto de artículo a Drive:", err);
                if (editArtFotoFileInfo) {
                    editArtFotoFileInfo.textContent = 'Error al subir imagen';
                    editArtFotoFileInfo.className = 'text-xs text-red-400 font-semibold';
                }
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `No se pudo subir la nueva imagen: ${err.message}`,
                    background: '#151515', color: '#fff'
                });
            }
        });
    }

    const formEditArt = document.getElementById('form-edit-articulo');
    if (formEditArt) {
        formEditArt.addEventListener('submit', async (e) => {
            e.preventDefault();

            const idArt = document.getElementById('edit-art-id').value.trim();
            const nom = document.getElementById('edit-art-nombre').value.trim();
            const cat = document.getElementById('edit-art-categoria').value;
            const mar = document.getElementById('edit-art-marca').value.trim();
            const pMen = document.getElementById('edit-art-precio-menudeo').value;
            const pMay = document.getElementById('edit-art-precio-mayoreo').value;
            const act = document.getElementById('edit-art-activo').value;
            const fot = document.getElementById('edit-art-foto').value.trim();

            Swal.fire({
                title: 'Guardando Cambios...',
                allowOutsideClick: false,
                background: '#151515', color: '#fff',
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'update_articulo',
                        id_articulo: idArt,
                        nombre: nom,
                        categoria: cat,
                        marca: mar,
                        precio_menudeo: Number(pMen),
                        precio_mayoreo: Number(pMay),
                        activo: Number(act),
                        foto: fot
                    })
                });

                const data = await response.json();
                if (data.status === 'success') {
                    const varInputsName = document.querySelectorAll('.edit-var-name');
                    const varInputsStock = document.querySelectorAll('.edit-var-stock');

                    for (let i = 0; i < varInputsName.length; i++) {
                        const vName = varInputsName[i].value.trim() || 'Unitalla';
                        const vStock = Number(varInputsStock[i].value) || 0;

                        await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'update_stock_articulo',
                                id_articulo: idArt,
                                variante: vName,
                                stock: vStock
                            })
                        });
                    }

                    Swal.fire({
                        icon: 'success',
                        title: '¡Artículo Actualizado!',
                        text: 'Los cambios fueron guardados exitosamente.',
                        background: '#151515', color: '#fff',
                        timer: 1500, showConfirmButton: false
                    });

                    closeEditArticuloModal();
                    fetchArticulos();
                    if (typeof loadProductsFromApi === 'function') {
                        loadProductsFromApi('jerseys_products_cache_v5');
                    }
                } else {
                    throw new Error(data.message || 'Error al actualizar');
                }
            } catch (err) {
                console.error("Error al actualizar artículo deportivo:", err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message || 'No se pudieron guardar los cambios del artículo.',
                    background: '#151515', color: '#fff'
                });
            }
        });
    }

    const catSelect = document.getElementById('art-categoria');
    if (catSelect) {
        catSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const inputVar = document.getElementById('art-var-nombre');
            if (!inputVar) return;

            if (val === 'Balones') inputVar.value = '#5';
            else if (val === 'Guantes') inputVar.value = 'Talla 9';
            else if (val === 'Calcetines') inputVar.value = 'Adulto';
            else inputVar.value = 'Unitalla';
        });
    }

    const formTicketConfig = document.getElementById('form-ticket-config');
    if (formTicketConfig) {
        formTicketConfig.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cfg = {
                nombreTienda: document.getElementById('cfg-ticket-nombre').value.trim() || 'JERSEYS 419',
                direccion1: document.getElementById('cfg-ticket-dir1').value.trim(),
                direccion2: document.getElementById('cfg-ticket-dir2').value.trim(),
                horario: document.getElementById('cfg-ticket-horario').value.trim(),
                qrUrl: document.getElementById('cfg-ticket-qr').value.trim(),
                politicas: document.getElementById('cfg-ticket-politicas').value.trim(),
                mensajePie: document.getElementById('cfg-ticket-pie').value.trim()
            };
            
            Swal.fire({
                title: 'Guardando Configuración...',
                text: 'Sincronizando con Google Sheets...',
                allowOutsideClick: false,
                background: '#151515', color: '#fff',
                didOpen: () => Swal.showLoading()
            });

            await window.saveTicketConfigToCloud(cfg);
            window.closeTicketConfigModal();

            Swal.fire({
                icon: 'success',
                title: '¡Configuración Guardada en la Nube!',
                text: 'La información del ticket ha sido actualizada y sincronizada en Google Sheets.',
                background: '#151515', color: '#fff',
                timer: 1800, showConfirmButton: false
            });
        });
    }

    initScrollToTop();
});

function initScrollToTop() {
    const btnToTop = document.getElementById('btn-scroll-to-top');
    if (!btnToTop) return;

    const local419Grid = document.getElementById('local419-inventario-grid');
    const pos419Grid = document.getElementById('pos419-catalog-grid');

    const updateVisibility = () => {
        let isScrolled = window.scrollY > 250;

        // Verificar si la vista de pantalla completa del Inventario 419 está activa
        const modal419 = document.getElementById('local419-inventario-modal');
        if (modal419 && !modal419.classList.contains('hidden')) {
            const grid419 = document.getElementById('local419-inventario-grid');
            isScrolled = !!(grid419 && grid419.scrollTop > 150);
        }

        // Verificar si la vista del Punto de Venta 419 está activa
        const modalPos419 = document.getElementById('modal-pos-local419');
        if (modalPos419 && !modalPos419.classList.contains('hidden')) {
            isScrolled = !!(pos419Grid && pos419Grid.scrollTop > 150);
        }

        if (isScrolled) {
            btnToTop.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
            btnToTop.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
        } else {
            btnToTop.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
            btnToTop.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
    };

    window.addEventListener('scroll', updateVisibility, { passive: true });
    if (local419Grid) local419Grid.addEventListener('scroll', updateVisibility, { passive: true });
    if (pos419Grid) pos419Grid.addEventListener('scroll', updateVisibility, { passive: true });

    btnToTop.addEventListener('click', () => {
        const modal419 = document.getElementById('local419-inventario-modal');
        if (modal419 && !modal419.classList.contains('hidden')) {
            const grid419 = document.getElementById('local419-inventario-grid');
            if (grid419) grid419.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const modalPos419 = document.getElementById('modal-pos-local419');
        if (modalPos419 && !modalPos419.classList.contains('hidden')) {
            if (pos419Grid) pos419Grid.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// =========================================================================
// MÓDULO DE ETIQUETADO CON CÓDIGO DE BARRAS (51x25mm) Y ESCANEO
// =========================================================================
let currentStickerData = null;
let currentStickerAvailableSizes = [];
let stickerBatchCounts = {};
let html5QrScannerInstance = null;
let currentStickerIsGeneralCatalog = false;
let stickerInventoryMode = 'general'; // 'general' u '419'

window.switchStickerInventoryMode = function(mode) {
    stickerInventoryMode = mode;
    currentStickerIsGeneralCatalog = (mode === 'general');
    currentStickerData = null; // 🌟 Resetear prenda previamente seleccionada
    
    const btnGen = document.getElementById('btn-sticker-mode-gen');
    const btn419 = document.getElementById('btn-sticker-mode-419');

    if (mode === '419') {
        if (btn419) btn419.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md cursor-pointer';
        if (btnGen) btnGen.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 cursor-pointer';
        
        if ((!allProducts419 || allProducts419.length === 0) && typeof fetchProducts419 === 'function') {
            fetchProducts419();
        }
    } else {
        if (btnGen) btnGen.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md cursor-pointer';
        if (btn419) btn419.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 cursor-pointer';
    }

    // Limpiar buscador y lista de resultados
    const searchInput = document.getElementById('sticker-product-search-input');
    const searchResults = document.getElementById('sticker-product-search-results');
    if (searchInput) searchInput.value = '';
    if (searchResults) { searchResults.innerHTML = ''; searchResults.classList.add('hidden'); }

    // Limpiar datos en memoria y restablecer UI en blanco
    openPrintStickerModal(null, mode === 'general');
};

window.openPrintStickerModal = function(itemData, isGeneralCatalog = false) {
    currentStickerIsGeneralCatalog = (isGeneralCatalog === true);
    stickerInventoryMode = currentStickerIsGeneralCatalog ? 'general' : '419';
    currentStickerData = itemData || null;
    const modal = document.getElementById('modal-print-barcode-labels');
    if (!modal) return;

    // Actualizar apariencia visual de botones de origen de inventario
    const btnGen = document.getElementById('btn-sticker-mode-gen');
    const btn419 = document.getElementById('btn-sticker-mode-419');
    if (stickerInventoryMode === '419') {
        if (btn419) btn419.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md cursor-pointer';
        if (btnGen) btnGen.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 cursor-pointer';
    } else {
        if (btnGen) btnGen.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-amber-500 text-black shadow-md cursor-pointer';
        if (btn419) btn419.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 cursor-pointer';
    }

    // Configurar listener para buscador interno de prendas si no está asignado
    const searchInput = document.getElementById('sticker-product-search-input');
    const searchResults = document.getElementById('sticker-product-search-results');
    if (searchInput && !searchInput.dataset.hasStickerSearchListener) {
        searchInput.dataset.hasStickerSearchListener = "true";
        searchInput.oninput = (e) => filterStickerProductSearch(e.target.value);
    }
    if (searchInput) searchInput.value = '';
    if (searchResults) { searchResults.innerHTML = ''; searchResults.classList.add('hidden'); }

    if (!itemData) {
        // Modal abierto de forma neutral sin prenda seleccionada
        const infoContainer = document.getElementById('sticker-item-info');
        if (infoContainer) {
            infoContainer.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <span class="p-2 bg-amber-500/20 text-amber-400 rounded-xl text-base">🏷️</span>
                    <div>
                        <h3 class="text-sm font-bold text-white">Imprimir Pegatinas Adhesivas</h3>
                        <p class="text-[10px] text-gray-400">Formato Estándar 51 × 25 mm (Xprinter 365B)</p>
                    </div>
                </div>
            `;
        }
        currentStickerAvailableSizes = [];
        stickerBatchCounts = {};
        renderStickerSizesBatchUI([]);
        window.updateStickerPreviewFromUI();
        document.body.style.overflow = 'hidden';
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        return;
    }

    const nombreStr = itemData.nombre || itemData.equipo || itemData.id_playera || 'Playera Jerseys 419';
    const tipoStr = (itemData.tipo || 'Regular').toUpperCase();
    const versionStr = (itemData.version || 'Aficionado').toUpperCase();
    const generoStr = (itemData.genero || 'Hombre').toUpperCase();
    const precioNum = Number(itemData.precio_menudeo || itemData.precio || 550);

    const rawImg = typeof getFirstImage === 'function' ? getFirstImage(itemData.foto || itemData.imagen) : (itemData.foto || itemData.imagen);
    const imgUrl = typeof getOptimizedImageUrl === 'function' ? getOptimizedImageUrl(rawImg, 150) : (rawImg || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=150');

    const infoContainer = document.getElementById('sticker-item-info');
    if (infoContainer) {
        infoContainer.innerHTML = `
            <div class="flex items-center gap-3.5 p-1">
                <img src="${imgUrl}" alt="${nombreStr}" class="w-14 h-16 object-cover rounded-xl border border-white/10 shadow-md bg-dark-300 shrink-0">
                <div class="space-y-1.5 min-w-0">
                    <h4 class="text-sm font-black text-white leading-tight uppercase tracking-wide truncate">${nombreStr}</h4>
                    <div class="flex flex-wrap gap-1.5 items-center">
                        <span class="px-2.5 py-0.5 bg-[#222226] text-gray-200 rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-wider">${tipoStr}</span>
                        <span class="px-2.5 py-0.5 bg-[#222226] text-gray-200 rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-wider">${versionStr}</span>
                        <span class="px-2.5 py-0.5 bg-blue-600/30 text-blue-300 rounded-lg text-[10px] font-black border border-blue-500/30 uppercase tracking-wider">${generoStr}</span>
                    </div>
                </div>
            </div>
        `;
    }

    const priceBadgeEl = document.getElementById('sticker-price-badge-val');
    if (priceBadgeEl) priceBadgeEl.textContent = `$${precioNum.toFixed(2)}`;

    // Obtener lista de tallas disponibles respetando el origen seleccionado
    let availableSizes = [];
    const mainCatalog419 = (typeof allProducts419 !== 'undefined' && Array.isArray(allProducts419)) ? allProducts419 : (window.allProducts419 || []);
    const mainCatalogGen = (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) ? allProducts : (window.allProducts || []);
    
    let fullProd = null;
    if (stickerInventoryMode === '419') {
        fullProd = mainCatalog419.find(p => String(p.id || p.id_articulo || p.id_playera).toUpperCase() === String(itemData.id || itemData.id_playera).toUpperCase())
            || mainCatalogGen.find(p => String(p.id || p.id_articulo || p.id_playera).toUpperCase() === String(itemData.id || itemData.id_playera).toUpperCase())
            || itemData;
    } else {
        fullProd = mainCatalogGen.find(p => String(p.id || p.id_articulo || p.id_playera).toUpperCase() === String(itemData.id || itemData.id_playera).toUpperCase())
            || mainCatalog419.find(p => String(p.id || p.id_articulo || p.id_playera).toUpperCase() === String(itemData.id || itemData.id_playera).toUpperCase())
            || itemData;
    }

    if (fullProd && Array.isArray(fullProd.tallas) && fullProd.tallas.length > 0) {
        availableSizes = fullProd.tallas.map(t => {
            const szStr = String(t.talla || t.variante || 'M').toUpperCase();
            return {
                talla: szStr,
                stock: t.stock !== undefined ? Number(t.stock) : (t.inventario !== undefined ? Number(t.inventario) : 999),
                id_inventario: t.id_inventario || `${fullProd.id || fullProd.id_playera || 'PLAY'}-${szStr}`
            };
        });
    } else {
        const defaultGender = itemData.genero || 'Hombre';
        const stdSizes = typeof getTallasForGender === 'function' ? getTallasForGender(defaultGender) : ['S', 'M', 'L', 'XL', '2XL'];
        availableSizes = stdSizes.map(sz => ({
            talla: sz,
            stock: 999,
            id_inventario: `${itemData.id || itemData.id_playera || 'PLAY'}-${sz}`
        }));
    }

    currentStickerAvailableSizes = availableSizes;

    // REGLA: Todas las piezas inician en 0 al ingresar
    stickerBatchCounts = {};
    availableSizes.forEach(sObj => {
        stickerBatchCounts[sObj.talla] = 0;
    });

    renderStickerSizesBatchUI(availableSizes);
    window.updateStickerPreviewFromUI();

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
};

function filterStickerProductSearch(query) {
    const searchResults = document.getElementById('sticker-product-search-results');
    if (!searchResults) return;

    const q = query ? query.trim() : '';
    if (!q) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
        return;
    }

    const catalog419 = (typeof allProducts419 !== 'undefined' && Array.isArray(allProducts419)) ? allProducts419 : (window.allProducts419 || []);
    const catalogGen = (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) ? allProducts : (window.allProducts || []);

    const targetList = (stickerInventoryMode === '419') ? catalog419 : catalogGen;
    const is419 = (stickerInventoryMode === '419');

    const filtered = (targetList || []).filter(p => {
        const targetStr = `${p.equipo || ''} ${p.nombre || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || ''}`;
        return matchText(targetStr, q);
    }).slice(0, 50);

    if (filtered.length === 0) {
        searchResults.innerHTML = `<div class="p-3 text-xs text-gray-500 text-center italic">No se encontraron playeras en el inventario (${is419 ? 'Local 419' : 'General'}).</div>`;
    } else {
        searchResults.innerHTML = filtered.map(p => {
            const rawImg = typeof getFirstImage === 'function' ? getFirstImage(p.foto || p.imagen) : (p.foto || p.imagen);
            const imgUrl = typeof getOptimizedImageUrl === 'function' ? getOptimizedImageUrl(rawImg, 100) : (rawImg || 'https://via.placeholder.com/100');
            const priceVal = Number(p.precio_menudeo || p.precio || p.precio_mayoreo || 550);
            return `
            <div onclick="window.selectStickerProductFromSearch('${p.id || p.id_playera}')" class="p-2.5 hover:bg-white/10 cursor-pointer transition-colors flex items-center justify-between gap-3 border-b border-white/5 last:border-none">
                <div class="flex items-center gap-2.5">
                    <img src="${imgUrl}" alt="${p.nombre || p.equipo}" class="w-9 h-11 object-cover rounded-lg border border-white/10 bg-dark-300 shrink-0">
                    <div>
                        <div class="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>${p.nombre || p.equipo}</span>
                            <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded ${is419 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">${is419 ? '419' : 'General'}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 font-mono">ID: ${p.id || p.id_playera} | ${p.tipo || ''} ${p.genero || ''}</div>
                    </div>
                </div>
                <span class="text-xs font-bold text-amber-400 font-mono">$${priceVal.toFixed(2)}</span>
            </div>
            `;
        }).join('');
    }
    searchResults.classList.remove('hidden');
}

window.selectStickerProductFromSearch = function(idProd) {
    const catalog419 = (typeof allProducts419 !== 'undefined' && Array.isArray(allProducts419)) ? allProducts419 : (window.allProducts419 || []);
    const catalogGen = (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) ? allProducts : (window.allProducts || []);
    
    const idTarget = String(idProd || '').trim().toUpperCase();
    const target = (stickerInventoryMode === '419')
        ? (catalog419.find(p => String(p.id || p.id_articulo || p.id_playera || '').trim().toUpperCase() === idTarget) || catalogGen.find(p => String(p.id || p.id_articulo || p.id_playera || '').trim().toUpperCase() === idTarget))
        : (catalogGen.find(p => String(p.id || p.id_articulo || p.id_playera || '').trim().toUpperCase() === idTarget) || catalog419.find(p => String(p.id || p.id_articulo || p.id_playera || '').trim().toUpperCase() === idTarget));

    if (target) {
        openPrintStickerModal(target, stickerInventoryMode === 'general');
    } else {
        console.warn("No se encontró el producto con ID:", idProd);
    }

    const searchResults = document.getElementById('sticker-product-search-results');
    if (searchResults) searchResults.classList.add('hidden');
};

function renderStickerSizesBatchUI(availableSizes) {
    const container = document.getElementById('sticker-sizes-batch-container');
    if (!container) return;

    if (!availableSizes || availableSizes.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = availableSizes.map(sObj => {
        const sz = sObj.talla;
        const stock = sObj.stock !== undefined ? Number(sObj.stock) : 0;
        const qty = stickerBatchCounts[sz] !== undefined ? stickerBatchCounts[sz] : 0;
        const hasStock = stock > 0;

        return `
            <div class="flex items-center justify-between p-2 bg-dark-200/50 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all">
                <div class="flex items-center gap-2">
                    <span class="w-9 h-7 bg-black/60 border border-white/10 rounded-lg flex items-center justify-center font-bold text-amber-400 text-xs shadow-sm">
                        ${sz}
                    </span>
                    <div class="text-[10px] text-gray-400">
                        Stock: <span class="${hasStock ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}">${stock} pcs</span>
                    </div>
                </div>

                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.updateStickerSizeQty('${sz}', -1)" class="w-7 h-7 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-bold text-sm flex items-center justify-center border border-white/10">-</button>
                    <input type="number" min="0" max="${stock}" value="${qty}" ${!hasStock ? 'disabled' : ''} onchange="window.updateStickerSizeQtyDirect('${sz}', this.value)" class="w-12 bg-dark-100 border border-white/10 rounded-lg py-1 text-center font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-400 disabled:opacity-40">
                    <button type="button" onclick="window.updateStickerSizeQty('${sz}', 1)" ${!hasStock ? 'disabled' : ''} class="w-7 h-7 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-lg font-bold text-sm flex items-center justify-center border border-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                    <button type="button" onclick="window.updateStickerSizeQty('${sz}', 5)" ${!hasStock ? 'disabled' : ''} class="px-2 h-7 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-bold text-[10px] flex items-center justify-center border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed">+5</button>
                </div>
            </div>
        `;
    }).join('');

    updateStickerTotalBatchCount();
}

window.updateStickerSizeQty = function(talla, delta) {
    const current = stickerBatchCounts[talla] || 0;
    const sObj = currentStickerAvailableSizes.find(x => x.talla === talla);
    const maxStock = sObj ? Number(sObj.stock || 0) : 0;

    if (delta > 0 && current + delta > maxStock) {
        const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
        toast.fire({ icon: 'warning', title: `Límite por stock alcanzado: Máximo ${maxStock} pegatinas (Stock disponible: ${maxStock})` });
        stickerBatchCounts[talla] = maxStock;
    } else {
        stickerBatchCounts[talla] = Math.max(0, Math.min(maxStock, current + delta));
    }
    
    const nextVal = stickerBatchCounts[talla];

    // Actualizar input en UI
    const container = document.getElementById('sticker-sizes-batch-container');
    if (container) {
        const rows = container.querySelectorAll('input');
        rows.forEach(input => {
            if (input.onchange && input.onchange.toString().includes(`'${talla}'`)) {
                input.value = nextVal;
            }
        });
    }

    updateStickerTotalBatchCount();
    window.updateStickerPreviewFromUI();
};

window.updateStickerSizeQtyDirect = function(talla, valStr) {
    const num = Math.max(0, parseInt(valStr) || 0);
    const sObj = currentStickerAvailableSizes.find(x => x.talla === talla);
    const maxStock = sObj ? Number(sObj.stock || 0) : 0;

    if (num > maxStock) {
        const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
        toast.fire({ icon: 'warning', title: `Máximo permitido por stock: ${maxStock}` });
        stickerBatchCounts[talla] = maxStock;
    } else {
        stickerBatchCounts[talla] = num;
    }

    // Actualizar valor en el input
    const container = document.getElementById('sticker-sizes-batch-container');
    if (container) {
        const rows = container.querySelectorAll('input');
        rows.forEach(input => {
            if (input.onchange && input.onchange.toString().includes(`'${talla}'`)) {
                input.value = stickerBatchCounts[talla];
            }
        });
    }

    updateStickerTotalBatchCount();
    window.updateStickerPreviewFromUI();
};

function updateStickerTotalBatchCount() {
    let grandTotal = 0;
    Object.keys(stickerBatchCounts).forEach(sz => {
        grandTotal += (stickerBatchCounts[sz] || 0);
    });

    const badgeEl = document.getElementById('sticker-batch-total-count');
    const btnTextEl = document.getElementById('btn-print-stickers-text');

    if (badgeEl) {
        badgeEl.textContent = `Total a Imprimir: ${grandTotal} ${grandTotal === 1 ? 'pegatina' : 'pegatinas'}`;
    }
    if (btnTextEl) {
        btnTextEl.textContent = grandTotal > 0 ? `Imprimir ${grandTotal} Pegatinas` : `Imprimir Pegatinas`;
    }
}

function formatStickerTalla(rawTalla) {
    if (!rawTalla) return { display: 'M', fontSize: '26px' };
    let clean = String(rawTalla).trim().toUpperCase();

    // Formatear descripciones largas de niño como "16 (2 A 4 AÑOS)" -> "16 (2-4A)"
    clean = clean.replace(/(\d+)\s*\(\s*(\d+)\s*A\s*(\d+)\s*AÑOS?\s*\)/gi, '$1 ($2-$3A)');
    clean = clean.replace(/(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*AÑOS?\s*\)/gi, '$1 ($2-$3A)');

    let fontSize = '26px';
    if (clean.length > 9) {
        fontSize = '12px';
    } else if (clean.length > 5) {
        fontSize = '15px';
    } else if (clean.length > 3) {
        fontSize = '20px';
    }
    return { display: clean, fontSize: fontSize };
}

window.updateStickerPreviewFromUI = function() {
    const replicaContainer = document.getElementById('sticker-preview-card-replica');
    if (!replicaContainer) return;

    if (!currentStickerData) {
        replicaContainer.innerHTML = `<div class="text-center text-xs text-gray-400 italic py-4">Selecciona o escanea una prenda para ver la vista previa.</div>`;
        return;
    }

    const showPriceCheck = document.getElementById('sticker-show-price-check');
    const showPrice = showPriceCheck ? showPriceCheck.checked : false;

    const activeSize = Object.keys(stickerBatchCounts).find(sz => stickerBatchCounts[sz] > 0) || (currentStickerAvailableSizes[0] ? currentStickerAvailableSizes[0].talla : 'M');
    const tFormatted = formatStickerTalla(activeSize);

    const nombreStr = currentStickerData.nombre || currentStickerData.equipo || currentStickerData.id_playera || 'Playera Jerseys';
    const tipoStr = currentStickerData.tipo || 'Regular';
    const versionStr = currentStickerData.version || 'Aficionado';
    const generoRaw = currentStickerData.genero || 'Hombre';
    const generoStr = generoRaw.replace(/\(UNISEX\)/gi, '').trim();
    const precioNum = Number(currentStickerData.precio_menudeo || currentStickerData.precio || 550);

    const sObj = (currentStickerAvailableSizes || []).find(x => x.talla === activeSize);
    const barcodeVal = (sObj && sObj.id_inventario && !String(sObj.id_inventario).startsWith('TEMP_'))
        ? sObj.id_inventario
        : `${currentStickerData.id || currentStickerData.id_playera || 'INV419'}-${activeSize}`;

    replicaContainer.innerHTML = `
        <div style="width: 100%; height: 100%; padding: 0.8mm 1mm; box-sizing: border-box; background: #ffffff; color: #000000; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden; font-family: sans-serif; text-align: center;">
            <div style="font-size: 8px; font-weight: 900; text-align: center; color: #000000; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: 0px; line-height: 1;">
                ${nombreStr} • ${generoStr} • ${versionStr} • ${tipoStr}
            </div>
            ${showPrice ? `
            <div style="font-size: 9px; font-weight: 900; text-align: center; margin-top: 0px;">
                $${precioNum.toFixed(2)}
            </div>
            ` : ''}
            <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 0px; margin-bottom: 0px; line-height: 1;">
                <span style="font-size: 11px; font-weight: 900; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px;">TALLA:</span>
                <strong style="display: inline-block; background-color: #000000 !important; color: #ffffff !important; padding: 1px 8px !important; font-size: ${tFormatted.fontSize} !important; font-weight: 900 !important; border-radius: 5px !important; line-height: 1 !important; white-space: nowrap; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                    ${tFormatted.display}
                </strong>
            </div>
            <svg id="sticker-preview-barcode-svg" style="width: 100%; max-height: 26px;"></svg>
        </div>
    `;

    try {
        if (typeof JsBarcode === 'function') {
            JsBarcode("#sticker-preview-barcode-svg", barcodeVal, {
                format: "CODE128",
                width: 1.4,
                height: 22,
                displayValue: true,
                fontSize: 9,
                margin: 0
            });
        }
    } catch (eB) {
        console.warn("JsBarcode preview update error:", eB);
    }
};

window.closePrintStickerModal = function() {
    const modal = document.getElementById('modal-print-barcode-labels');
    if (modal) modal.classList.add('hidden');
};

window.confirmPrintStickers = function() {
    if (!currentStickerData) return;

    const showPriceCheck = document.getElementById('sticker-show-price-check');
    const showPrice = showPriceCheck ? showPriceCheck.checked : true;

    const printContainer = document.getElementById('sticker-barcode-print-area');
    if (!printContainer) return;

    const nombreStr = currentStickerData.nombre || currentStickerData.equipo || currentStickerData.id_playera || 'Playera';
    const tipoStr = currentStickerData.tipo || 'Regular';
    const versionStr = currentStickerData.version || 'Aficionado';
    const generoRaw = currentStickerData.genero || 'Hombre';
    const generoStr = generoRaw.replace(/\(UNISEX\)/gi, '').trim();
    const precioNum = Number(currentStickerData.precio_menudeo || currentStickerData.precio || 550);

    let labelsToPrint = [];
    Object.keys(stickerBatchCounts).forEach(sz => {
        const count = stickerBatchCounts[sz] || 0;
        const sObj = (currentStickerAvailableSizes || []).find(x => x.talla === sz);
        const codeVal = (sObj && sObj.id_inventario && !String(sObj.id_inventario).startsWith('TEMP_'))
            ? sObj.id_inventario
            : `${currentStickerData.id || currentStickerData.id_playera || 'INV419'}-${sz}`;

        for (let c = 0; c < count; c++) {
            labelsToPrint.push({
                talla: sz,
                barcode: codeVal
            });
        }
    });

    if (labelsToPrint.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin Pegatinas Seleccionadas',
            text: 'Por favor asigna al menos 1 pegatina en alguna de las tallas para imprimir.',
            background: '#151515', color: '#fff'
        });
        return;
    }

    let labelsHtml = '';
    labelsToPrint.forEach((lbl, i) => {
        const tFormatted = formatStickerTalla(lbl.talla);
        labelsHtml += `
            <div style="width: 51mm; height: 25mm; max-width: 51mm; max-height: 25mm; padding: 0.8mm 1mm; box-sizing: border-box; background: #ffffff; color: #000000; display: flex; flex-direction: column; justify-content: space-between; align-items: center; page-break-after: always; overflow: hidden; font-family: sans-serif; text-align: center;">
                <div style="font-size: 8px; font-weight: 900; text-align: center; color: #000000; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: 0px; line-height: 1;">
                    ${nombreStr} • ${generoStr} • ${versionStr} • ${tipoStr}
                </div>
                ${showPrice ? `
                <div style="font-size: 9px; font-weight: 900; text-align: center; margin-top: 0px;">
                    $${precioNum.toFixed(2)}
                </div>
                ` : ''}
                <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 0px; margin-bottom: 0px; line-height: 1;">
                    <span style="font-size: 11px; font-weight: 900; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px;">TALLA:</span>
                    <strong style="display: inline-block; background-color: #000000 !important; color: #ffffff !important; padding: 1px 8px !important; font-size: ${tFormatted.fontSize} !important; font-weight: 900 !important; border-radius: 5px !important; line-height: 1 !important; white-space: nowrap; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                        ${tFormatted.display}
                    </strong>
                </div>
                <svg class="barcode-svg-instance-${i}" style="width: 100%; max-height: 12mm;"></svg>
            </div>
        `;
    });

    printContainer.innerHTML = labelsHtml;

    labelsToPrint.forEach((lbl, i) => {
        try {
            if (typeof JsBarcode === 'function') {
                JsBarcode(`.barcode-svg-instance-${i}`, lbl.barcode, {
                    format: "CODE128",
                    width: 1.4,
                    height: 28,
                    displayValue: true,
                    fontSize: 9,
                    margin: 0
                });
            }
        } catch (eSvg) {}
    });

    try {
        let printFrame = document.getElementById('sticker-print-iframe');
        if (printFrame) printFrame.remove();

        printFrame = document.createElement('iframe');
        printFrame.id = 'sticker-print-iframe';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0px';
        printFrame.style.height = '0px';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Etiquetas 51x25mm</title>
                <style>
                    @page { size: 51mm 25mm; margin: 0; }
                    body { margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                </style>
            </head>
            <body>
                ${printContainer.innerHTML}
            </body>
            </html>
        `);
        frameDoc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
        }, 250);
        return;
    } catch (eErr) {
        console.warn("Sticker iframe print error:", eErr);
    }

    document.body.classList.add('printing-barcode-stickers');
    printContainer.classList.remove('hidden');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove('printing-barcode-stickers');
            printContainer.classList.add('hidden');
        }, 500);
    }, 200);
};

function playBarcodeBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (eA) {}
}

window.handleScannedBarcode = function(scannedCode) {
    if (!scannedCode) return;
    const cleanCode = String(scannedCode).replace(/['’\`]/g, '-').trim().toUpperCase();
    playBarcodeBeepSound();

    let foundItem = null;

    if (Array.isArray(local419ProductsList)) {
        foundItem = local419ProductsList.find(p => 
            (p.id_inventario && String(p.id_inventario).replace(/['’\`]/g, '-').toUpperCase() === cleanCode) ||
            (p.id_playera && String(p.id_playera).replace(/['’\`]/g, '-').toUpperCase() === cleanCode) ||
            (p.id_orden && String(p.id_orden).replace(/['’\`]/g, '-').toUpperCase() === cleanCode)
        );
    }

    if (!foundItem && typeof initialProductsData !== 'undefined' && Array.isArray(initialProductsData)) {
        foundItem = initialProductsData.find(p => 
            (p.id_inventario && String(p.id_inventario).replace(/['’\`]/g, '-').toUpperCase() === cleanCode) ||
            (p.id_playera && String(p.id_playera).replace(/['’\`]/g, '-').toUpperCase() === cleanCode) ||
            (p.id_orden && String(p.id_orden).replace(/['’\`]/g, '-').toUpperCase() === cleanCode)
        );
    }

    const stickerModal = document.getElementById('modal-print-barcode-labels');
    const isStickerOpen = stickerModal && !stickerModal.classList.contains('hidden');

    if (isStickerOpen) {
        if (foundItem) {
            window.openPrintStickerModal(foundItem);
            const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1800, background: '#151515', color: '#fff' });
            toast.fire({ icon: 'success', title: `✓ Prenda cargada para pegatinas: ${foundItem.nombre || foundItem.equipo}` });
        } else {
            const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
            toast.fire({ icon: 'error', title: `Código no registrado: ${cleanCode}` });
        }
        return;
    }

    const auditModal = document.getElementById('modal-auditoria-inventario');
    const isAuditOpen = auditModal && !auditModal.classList.contains('hidden');

    if (isAuditOpen) {
        if (foundItem) {
            window.incrementAuditoriaItemByProduct(foundItem, foundItem.talla || 'M');
        } else {
            const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
            toast.fire({ icon: 'error', title: `Código no registrado: ${cleanCode}` });
        }
        return;
    }

    const traspasoModal = document.getElementById('modal-traspaso-419-general');
    const isTraspasoOpen = traspasoModal && !traspasoModal.classList.contains('hidden');

    if (isTraspasoOpen) {
        if (foundItem) {
            window.addTraspasoItemFromProduct(foundItem, foundItem.talla || 'M');
        } else {
            const toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000, background: '#151515', color: '#fff' });
            toast.fire({ icon: 'error', title: `Código no registrado en Local 419: ${cleanCode}` });
        }
        return;
    }

    const posModal = document.getElementById('modal-pos-local419');
    const isPosOpen = posModal && !posModal.classList.contains('hidden');

    if (isPosOpen) {
        if (foundItem) {
            window.addPos419ItemToCart(foundItem.id_playera, foundItem.talla || 'M');
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `✓ Agregado: ${foundItem.nombre || foundItem.id_playera} (${foundItem.talla})`,
                showConfirmButton: false,
                timer: 1800,
                background: '#151515', color: '#fff'
            });
        } else {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: `Código no encontrado: ${cleanCode}`,
                showConfirmButton: false,
                timer: 2000,
                background: '#151515', color: '#fff'
            });
        }
    } else {
        if (foundItem) {
            Swal.fire({
                title: `Prenda Escaneada: ${foundItem.nombre || foundItem.id_playera}`,
                html: `
                    <div class="text-left space-y-2 text-xs py-2">
                        <p class="text-gray-300">Talla: <strong class="text-amber-400 font-bold">${foundItem.talla || 'M'}</strong></p>
                        <p class="text-gray-300">ID Inventario: <strong class="text-white font-mono">${foundItem.id_inventario || foundItem.id_playera}</strong></p>
                        <p class="text-gray-300">Existencias Actuales: <strong class="text-emerald-400 font-bold">${foundItem.stock || 0} pcs</strong></p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '🏷️ Imprimir Pegatinas',
                denyButtonText: '➖ Restar -1 Stock',
                cancelButtonText: 'Cerrar',
                confirmButtonColor: '#f59e0b',
                denyButtonColor: '#ef4444',
                background: '#151515', color: '#fff'
            }).then((res) => {
                if (res.isConfirmed) {
                    window.openPrintStickerModal(foundItem);
                } else if (res.isDenied) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Stock Actualizado',
                        text: `Se procesó la salida de 1 pieza de ${foundItem.nombre || foundItem.id_playera} (${foundItem.talla})`,
                        background: '#151515', color: '#fff'
                    });
                }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Código No Encontrado',
                text: `No se encontró ninguna prenda con el código: ${cleanCode}`,
                background: '#151515', color: '#fff'
            });
        }
    }
};

window.openCameraScannerModal = function(targetMode) {
    const modal = document.getElementById('modal-camera-barcode-scanner');
    if (!modal) return;
    modal.classList.remove('hidden');

    const statusEl = document.getElementById('camera-scanner-status');
    if (statusEl) statusEl.textContent = 'Iniciando cámara de la tablet/dispositivo...';

    setTimeout(() => {
        try {
            if (typeof Html5Qrcode === 'function') {
                if (html5QrScannerInstance) {
                    html5QrScannerInstance.stop().catch(() => {}).then(() => startScanner());
                } else {
                    startScanner();
                }
            } else {
                if (statusEl) statusEl.textContent = 'Librería de cámara cargando... Intente de nuevo.';
            }
        } catch (eC) {
            console.error("Camera scanner init error:", eC);
        }
    }, 300);

    function startScanner() {
        try {
            html5QrScannerInstance = new Html5Qrcode("camera-reader-viewport");
            html5QrScannerInstance.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 220, height: 140 } },
                (decodedText) => {
                    window.closeCameraScannerModal();
                    window.handleScannedBarcode(decodedText);
                },
                () => {}
            ).catch(err => {
                console.warn("Camera start warning:", err);
                if (statusEl) statusEl.textContent = 'No se pudo acceder a la cámara. Verifique los permisos.';
            });
        } catch (eStart) {
            console.error("Error starting camera:", eStart);
        }
    }
};

window.closeCameraScannerModal = function() {
    const modal = document.getElementById('modal-camera-barcode-scanner');
    if (modal) modal.classList.add('hidden');
    if (html5QrScannerInstance) {
        html5QrScannerInstance.stop().catch(() => {}).then(() => {
            html5QrScannerInstance = null;
        });
    }
};

let barcodeBuffer = '';
let barcodeLastKeyTime = 0;

document.addEventListener('keydown', function(e) {
    const target = e.target;
    const isInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    
    const now = Date.now();
    if (now - barcodeLastKeyTime > 120) {
        barcodeBuffer = '';
    }
    barcodeLastKeyTime = now;

    if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
            const scannedCode = barcodeBuffer.replace(/['’\`]/g, '-').trim();
            barcodeBuffer = '';
            if (isInput && target.id && !target.id.includes('search')) {
                return;
            }
            e.preventDefault();
            window.handleScannedBarcode(scannedCode);
        }
    } else if (e.key && e.key.length === 1) {
        // Auto-convertir apóstrofes (') que envían lectores de código en teclado español a guión (-)
        const keyChar = (e.key === "'" || e.key === "’" || e.key === "`") ? "-" : e.key;
        barcodeBuffer += keyChar;
    }
});

// Listener global para auto-corregir comillas por guiones en cualquier input al escribir o escanear
document.addEventListener('input', function(e) {
    if (e.target && e.target.tagName === 'INPUT' && typeof e.target.value === 'string') {
        if (/['’\`]/.test(e.target.value)) {
            e.target.value = e.target.value.replace(/['’\`]/g, '-');
        }
    }
}, true);

// =========================================================================
// 📦 MÓDULO FRONTEND: PEDIDO MASIVO DE REABASTECIMIENTO (LOCAL 419 VS GENERAL)
// =========================================================================
let masivoFaltantesList = [];
let masivoCartMap = {};

window.openPedidoMasivo419Modal = async function() {
    const modal = document.getElementById('modal-pedido-masivo-419');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    const box = modal.querySelector('.transform');
    if (box) {
        box.classList.remove('scale-95');
        box.classList.add('scale-100');
    }

    if (typeof fetchProducts419 === 'function' && (!allProducts419 || allProducts419.length === 0)) {
        await fetchProducts419();
    }
    if (typeof fetchInitialProducts === 'function' && (!allProducts || allProducts.length === 0)) {
        await fetchInitialProducts();
    }

    window.calculateMasivoFaltantes();
    window.populateMasivoFilters();
    window.renderPedidoMasivoGrid();
};

window.closePedidoMasivo419Modal = function() {
    const modal = document.getElementById('modal-pedido-masivo-419');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = modal.querySelector('.transform');
    if (box) {
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
};

window.calculateMasivoFaltantes = function() {
    masivoFaltantesList = [];
    masivoCartMap = {};

    const genCatalog = (allProducts && allProducts.length > 0) ? allProducts : (window.allProducts || []);
    const localCatalog = (allProducts419 && allProducts419.length > 0) ? allProducts419 : (window.allProducts419 || []);

    genCatalog.forEach(prodGen => {
        const prod419 = localCatalog.find(p => String(p.id || p.id_playera || '').toUpperCase() === String(prodGen.id || prodGen.id_playera || '').toUpperCase());
        const tallasGen = Array.isArray(prodGen.tallas) ? prodGen.tallas : [];

        tallasGen.forEach(tGen => {
            const szGen = String(tGen.talla || '').trim().toUpperCase();
            const stockGen = Number(tGen.stock !== undefined ? tGen.stock : (tGen.inventario || 0)) || 0;
            if (stockGen <= 0) return;

            let stock419 = 0;
            if (prod419 && Array.isArray(prod419.tallas)) {
                const t419 = prod419.tallas.find(t => String(t.talla || '').trim().toUpperCase() === szGen);
                stock419 = t419 ? (Number(t419.stock !== undefined ? t419.stock : (t419.inventario || 0)) || 0) : 0;
            }

            if (stock419 <= 0) {
                const itemKey = `${prodGen.id || prodGen.id_playera}_${szGen}`;
                const defaultQty = Math.min(1, stockGen);

                const faltanteItem = {
                    key: itemKey,
                    id: prodGen.id || prodGen.id_playera,
                    id_inventario: tGen.id_inventario || '',
                    nombre: prodGen.nombre || prodGen.equipo || 'Jersey',
                    equipo: prodGen.equipo || '',
                    tipo: prodGen.tipo || 'Aficionado',
                    version: prodGen.version || 'Regular',
                    genero: prodGen.genero || 'Hombre',
                    foto: getFirstImage(prodGen.foto || prodGen.imagen || ''),
                    talla: szGen,
                    stock419: stock419,
                    stockGen: stockGen
                };

                masivoFaltantesList.push(faltanteItem);

                masivoCartMap[itemKey] = {
                    item: faltanteItem,
                    qtySelected: defaultQty,
                    checked: true
                };
            }
        });
    });
};

window.populateMasivoFilters = function() {
    const selVer = document.getElementById('masivo-filter-version');
    const selGen = document.getElementById('masivo-filter-genero');

    if (selVer) {
        const versiones = Array.from(new Set(masivoFaltantesList.map(i => i.version).filter(Boolean))).sort();
        selVer.innerHTML = `<option value="">Versión (Todas)</option>` + versiones.map(v => `<option value="${v}">${v}</option>`).join('');
    }
    if (selGen) {
        const generos = Array.from(new Set(masivoFaltantesList.map(i => i.genero).filter(Boolean))).sort();
        selGen.innerHTML = `<option value="">Género (Todos)</option>` + generos.map(g => `<option value="${g}">${g}</option>`).join('');
    }
};

window.renderPedidoMasivoGrid = function() {
    const tbody = document.getElementById('masivo-table-body');
    const emptyState = document.getElementById('masivo-table-empty');
    if (!tbody) return;

    const qInput = document.getElementById('masivo-filter-search');
    const vSelect = document.getElementById('masivo-filter-version');
    const gSelect = document.getElementById('masivo-filter-genero');

    const query = qInput ? qInput.value : '';
    const selVer = vSelect ? vSelect.value : '';
    const selGen = gSelect ? gSelect.value : '';

    const filtered = masivoFaltantesList.filter(item => {
        if (selVer && item.version !== selVer) return false;
        if (selGen && item.genero !== selGen) return false;
        if (query) {
            const fullStr = `${item.nombre} ${item.equipo} ${item.tipo} ${item.version} ${item.genero} ${item.id} ${item.talla}`;
            return matchText(fullStr, query);
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');

        tbody.innerHTML = filtered.map(item => {
            const entry = masivoCartMap[item.key] || { qtySelected: 1, checked: true };
            const imgUrl = getOptimizedImageUrl(item.foto, 100);
            const shortTalla = formatShortTallaLabel(item.talla);
            const genColor = getGenderColorClass(item.genero);

            return `
                <tr class="hover:bg-white/5 transition-colors ${entry.checked ? 'bg-amber-500/5' : ''}">
                    <td class="px-3 py-2.5 text-center">
                        <input type="checkbox" ${entry.checked ? 'checked' : ''} onchange="window.toggleMasivoRowCheck('${item.key}', this.checked)" class="w-4 h-4 text-amber-500 rounded border-white/20 bg-dark-100 focus:ring-amber-500 cursor-pointer">
                    </td>
                    <td class="px-3 py-2.5">
                        <div class="flex items-center gap-2.5">
                            <img src="${imgUrl}" class="w-10 h-10 object-cover rounded-lg bg-dark-200 border border-white/10 flex-shrink-0">
                            <div class="min-w-0">
                                <h4 class="font-bold text-white text-xs truncate leading-tight">${item.nombre}</h4>
                                <span class="text-[10px] text-gray-500 font-mono">ID: ${item.id}</span>
                            </div>
                        </div>
                    </td>
                    <td class="px-3 py-2.5">
                        <div class="flex flex-wrap gap-1">
                            <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-dark-200 text-gray-300 rounded border border-white/10">${item.version}</span>
                            <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase ${genColor} rounded border">${item.genero}</span>
                        </div>
                    </td>
                    <td class="px-3 py-2.5 text-center font-bold">
                        <span class="bg-white/10 px-2 py-1 rounded-md text-amber-300 font-mono text-xs">${shortTalla}</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="px-2 py-0.5 text-[10px] font-extrabold rounded bg-red-500/10 text-red-400 border border-red-500/20">0 (Agotado)</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">${item.stockGen} pcs</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" onclick="window.updateMasivoItemQty('${item.key}', -1)" class="w-6 h-6 bg-white/5 hover:bg-white/10 text-gray-300 rounded font-bold text-xs flex items-center justify-center border border-white/10 cursor-pointer">-</button>
                            <input type="number" min="0" max="${item.stockGen}" value="${entry.qtySelected}" onchange="window.setMasivoItemQtyDirect('${item.key}', this.value)" class="w-12 bg-dark-100 border border-amber-500/30 rounded py-1 text-center font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-400 font-mono">
                            <button type="button" onclick="window.updateMasivoItemQty('${item.key}', 1)" class="w-6 h-6 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded font-bold text-xs flex items-center justify-center border border-amber-500/30 cursor-pointer">+</button>
                            <button type="button" onclick="window.setMasivoItemQtyDirect('${item.key}', ${item.stockGen})" class="px-1.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-gray-300 rounded border border-white/10 cursor-pointer" title="Máximo disponible en Bodega">Max</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.updateMasivoMetrics();
};

window.toggleMasivoRowCheck = function(key, isChecked) {
    if (masivoCartMap[key]) {
        masivoCartMap[key].checked = isChecked;
        if (!isChecked) {
            masivoCartMap[key].qtySelected = 0;
        } else if (masivoCartMap[key].qtySelected === 0) {
            masivoCartMap[key].qtySelected = 1;
        }
        window.renderPedidoMasivoGrid();
    }
};

window.toggleAllMasivoCheck = function(isChecked) {
    Object.keys(masivoCartMap).forEach(k => {
        masivoCartMap[k].checked = isChecked;
        if (!isChecked) {
            masivoCartMap[k].qtySelected = 0;
        } else if (masivoCartMap[k].qtySelected === 0) {
            masivoCartMap[k].qtySelected = 1;
        }
    });
    window.renderPedidoMasivoGrid();
};

window.updateMasivoItemQty = function(key, delta) {
    if (!masivoCartMap[key]) return;
    const itemObj = masivoCartMap[key];
    const maxStock = itemObj.item.stockGen;
    const newQty = Math.max(0, Math.min(maxStock, itemObj.qtySelected + delta));
    itemObj.qtySelected = newQty;
    itemObj.checked = newQty > 0;
    window.renderPedidoMasivoGrid();
};

window.setMasivoItemQtyDirect = function(key, valStr) {
    if (!masivoCartMap[key]) return;
    const itemObj = masivoCartMap[key];
    const maxStock = itemObj.item.stockGen;
    const num = Math.max(0, Math.min(maxStock, parseInt(valStr) || 0));
    itemObj.qtySelected = num;
    itemObj.checked = num > 0;
    window.renderPedidoMasivoGrid();
};

window.setAllMasivoQty = function(mode) {
    Object.keys(masivoCartMap).forEach(k => {
        const itemObj = masivoCartMap[k];
        if (mode === 'max') {
            itemObj.qtySelected = itemObj.item.stockGen;
            itemObj.checked = true;
        } else if (typeof mode === 'number') {
            itemObj.qtySelected = Math.min(itemObj.item.stockGen, mode);
            itemObj.checked = mode > 0;
        }
    });
    const checkAll = document.getElementById('masivo-check-all');
    if (checkAll) checkAll.checked = mode !== 0;
    window.renderPedidoMasivoGrid();
};

window.updateMasivoMetrics = function() {
    const kpiModels = document.getElementById('masivo-kpi-modelos');
    const kpiTallas = document.getElementById('masivo-kpi-tallas');
    const kpiDisponibles = document.getElementById('masivo-kpi-disponibles');
    const kpiSeleccionadas = document.getElementById('masivo-kpi-seleccionadas');
    const badgeSelected = document.getElementById('masivo-selected-count-badge');
    const footerPieces = document.getElementById('masivo-footer-total-pieces');

    const uniqueModels = new Set(masivoFaltantesList.map(i => i.id)).size;
    const totalTallas = masivoFaltantesList.length;
    const totalBodega = masivoFaltantesList.reduce((acc, i) => acc + i.stockGen, 0);

    let totalSeleccionadas = 0;
    let totalItemsChecked = 0;
    Object.values(masivoCartMap).forEach(entry => {
        if (entry.checked && entry.qtySelected > 0) {
            totalSeleccionadas += entry.qtySelected;
            totalItemsChecked++;
        }
    });

    if (kpiModels) kpiModels.textContent = uniqueModels;
    if (kpiTallas) kpiTallas.textContent = totalTallas;
    if (kpiDisponibles) kpiDisponibles.textContent = `${totalBodega} pzs`;
    if (kpiSeleccionadas) kpiSeleccionadas.textContent = `${totalSeleccionadas} pzs`;
    if (badgeSelected) badgeSelected.textContent = `${totalItemsChecked} prendas (${totalSeleccionadas} pzs)`;
    if (footerPieces) footerPieces.textContent = `${totalSeleccionadas} PZS`;
};

window.submitPedidoMasivo419 = async function() {
    const itemsToTransfer = Object.values(masivoCartMap).filter(entry => entry.checked && entry.qtySelected > 0);

    if (itemsToTransfer.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin prendas seleccionadas',
            text: 'Por favor asigna al menos 1 pieza en las prendas que deseas surtir a Local 419.',
            background: '#151515', color: '#fff'
        });
        return;
    }

    const totalPiezas = itemsToTransfer.reduce((acc, entry) => acc + entry.qtySelected, 0);
    const uniqueModelsCount = new Set(itemsToTransfer.map(e => e.item.id)).size;

    let itemsListHtml = '<div class="max-h-48 overflow-y-auto custom-scrollbar my-2 border border-white/10 rounded-xl bg-black/40 p-2 space-y-1.5">';
    itemsToTransfer.forEach(entry => {
        const item = entry.item;
        const qty = entry.qtySelected;
        const imgUrl = (item.foto || item.imagen) ? String(item.foto || item.imagen).split(',')[0].trim() : 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        itemsListHtml += `
            <div class="flex items-center justify-between bg-dark-200/60 p-2 rounded-lg border border-white/5 text-xs text-left">
                <div class="flex items-center gap-2 min-w-0 pr-2">
                    <img src="${imgUrl}" class="w-8 h-8 object-cover rounded bg-dark flex-shrink-0 border border-white/10">
                    <div class="min-w-0">
                        <div class="font-bold text-white truncate leading-tight">${item.nombre}</div>
                        <div class="text-[10px] text-gray-400">Talla: <span class="text-amber-300 font-bold font-mono">${item.talla}</span> | ${item.genero || '-'} - ${item.version || '-'}</div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0 font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ${qty} pzs
                </div>
            </div>
        `;
    });
    itemsListHtml += '</div>';

    const confirmRes = await Swal.fire({
        title: '⚡ ¿Confirmar Orden Masiva para Local 419?',
        html: `
            <div class="text-left space-y-2 text-xs text-gray-300 py-1">
                <div class="flex justify-between items-center bg-dark-200/40 p-2 rounded-xl border border-white/5 text-[11px]">
                    <span>Modelos: <strong class="text-white font-bold">${uniqueModelsCount}</strong></span>
                    <span>Tallas/SKUs: <strong class="text-amber-400 font-bold">${itemsToTransfer.length}</strong></span>
                    <span>Total: <strong class="text-emerald-400 font-mono font-black">${totalPiezas} PZS</strong></span>
                </div>

                <div class="font-bold text-gray-200 text-[11px] pt-1 uppercase tracking-wider flex items-center justify-between">
                    <span>📋 Detalle del Pedido (${itemsToTransfer.length} artículos):</span>
                </div>

                ${itemsListHtml}

                <div class="p-2.5 bg-black/40 border border-amber-500/30 rounded-xl mt-2 text-[11px] text-amber-300">
                    📦 <strong>Orden Registrada (Pendiente):</strong> El stock de Local 419 NO se incrementará inmediatamente. Las existencias se incrementarán automáticamente cuando la orden cambie a estatus <b>Finalizada</b>.
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Generar Orden Masiva (Pendiente)',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#374151',
        background: '#151515', color: '#fff',
        customClass: { popup: 'border border-white/10 rounded-2xl max-w-lg shadow-2xl' }
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({
        title: 'Procesando Orden Masiva...',
        text: 'Generando registro de orden en estatus Pendiente',
        allowOutsideClick: false,
        background: '#151515', color: '#fff',
        didOpen: () => Swal.showLoading()
    });

    // ⚡ 1. RESERVAR STOCK DE BODEGA GENERAL OPTIMISTAMENTE EN MEMORIA (0ms Latencia)
    // El incremento de stock en Local 419 se realizará ÚNICAMENTE cuando la orden cambie a estatus "Finalizada".
    itemsToTransfer.forEach(entry => {
        const item = entry.item;
        const qty = entry.qtySelected;

        // Descontar stock en Bodega General
        const prodGen = (allProducts || []).find(p => String(p.id || '').toUpperCase() === String(item.id || '').toUpperCase());
        if (prodGen && Array.isArray(prodGen.tallas)) {
            const tGen = prodGen.tallas.find(t => String(t.talla || '').trim().toUpperCase() === String(item.talla || '').trim().toUpperCase());
            if (tGen) {
                const currentSt = Number(tGen.stock !== undefined ? tGen.stock : (tGen.inventario || 0)) || 0;
                tGen.stock = Math.max(0, currentSt - qty);
                tGen.inventario = Math.max(0, currentSt - qty);
            }
        }
    });

    if (typeof renderProducts === 'function') renderProducts();

    // ⚡ 2. ENVIAR A GOOGLE SHEETS API
    try {
        const payloadItems = itemsToTransfer.map(entry => ({
            id_inventario: entry.item.id_inventario || `INV-${entry.item.id}-${entry.item.talla}`,
            id_producto: entry.item.id,
            id_playera: entry.item.id,
            talla: entry.item.talla,
            cantidad: entry.qtySelected,
            precio_unitario_final: 0
        }));

        const loggedUserObj = localStorage.getItem('logged_user') ? JSON.parse(localStorage.getItem('logged_user')) : null;
        const sessionUserName = loggedUserObj ? (loggedUserObj.nombre_completo || loggedUserObj.usuario || 'Usuario en Sesión') : 'Usuario en Sesión';
        const sessionUserId = loggedUserObj ? (loggedUserObj.id_cliente || loggedUserObj.usuario || ('LOCAL-419-' + Date.now())) : ('LOCAL-419-' + Date.now());

        let response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'create_order',
                token: localStorage.getItem('session_token') || '',
                usuario: sessionUserName,
                id_cliente: sessionUserId,
                nombre_cliente: sessionUserName,
                tipo_precio_aplicado: 'Surtido 419',
                tipo_entrega: 'Local 419',
                envio: false,
                costo_envio: 0,
                articulos: payloadItems,
                items: payloadItems
            })
        });

        let resData = await response.json();

        if (resData.status !== 'success') {
            // Intentar con traspaso_masivo_419 como alternativa
            response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'traspaso_masivo_419',
                    token: localStorage.getItem('session_token') || '',
                    usuario: sessionUserName,
                    nombre_cliente: sessionUserName,
                    origen: 'general_a_419',
                    items: payloadItems
                })
            });
            resData = await response.json();
        }

        const folioCreado = resData.id_orden || resData.id_orden_temp || 'ORD-419';

        Swal.fire({
            icon: 'success',
            title: '¡Orden Masiva Generada!',
            html: `
                <div class="text-left space-y-2 text-xs py-1 text-gray-300">
                    <p>Folio de Orden: <strong class="text-amber-400 font-mono font-bold">${folioCreado}</strong></p>
                    <p>Piezas Registradas: <strong class="text-emerald-400 font-bold">${totalPiezas} PZS</strong></p>
                    <p>Estatus Inicial: <strong class="text-yellow-400 font-bold">Pendiente</strong></p>
                    <div class="p-2.5 bg-black/40 border border-emerald-500/30 rounded-xl mt-2 text-[11px] text-emerald-300">
                        ✓ La orden fue creada y las existencias fueron descontadas de Bodega General. El stock de Local 419 se sumará cuando la orden cambie a <b>Finalizada</b>.
                    </div>
                </div>
            `,
            background: '#151515', color: '#fff',
            confirmButtonColor: '#10b981'
        });

        window.closePedidoMasivo419Modal();

        if (typeof fetchInitialProducts === 'function') fetchInitialProducts(true);
        if (typeof fetchProducts419 === 'function') fetchProducts419(true);
        if (typeof fetchOrdenes === 'function') fetchOrdenes();

    } catch (err) {
        console.warn("Fallo al persistir surtido masivo en la nube:", err);
        Swal.fire({
            icon: 'warning',
            title: 'Orden Masiva Registrada Localmente',
            text: `La orden por ${totalPiezas} piezas en estatus Pendiente fue registrada en pantalla y descontada de Bodega General. Se sincronizará con Google Sheets al reconectar.`,
            background: '#151515', color: '#fff',
            confirmButtonColor: '#f59e0b'
        });
        window.closePedidoMasivo419Modal();
    }
};

/* ==========================================================================
   MÓDULO DE ESTADÍSTICA E INDICADORES KPI DE VENTAS
   ========================================================================== */

/**
 * Obtiene el rango de fechas Lunes (00:00:00.000) a Domingo (23:59:59.999) para la semana actual o dada.
 */
function getWeekRange(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const dayOfWeek = day === 0 ? 7 : day;
    
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - (dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek, dayOfWeek };
}

/**
 * Obtiene el rango del 1er día del mes (00:00:00) al último día del mes (23:59:59).
 */
function getMonthRange(d = new Date()) {
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const dayOfMonth = d.getDate();
    const totalDaysInMonth = endOfMonth.getDate();

    return { startOfMonth, endOfMonth, dayOfMonth, totalDaysInMonth };
}

/**
 * Carga activamente las órdenes de la base de datos para garantizar que se disponga de la información más reciente.
 */
window.loadAllOrdersForStatistics = async function(force = false) {
    if (!force && typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes) && allFetchedOrdenes.length > 0) {
        return allFetchedOrdenes;
    }

    if (window.startTopLoadingBar) startTopLoadingBar();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "search_orders" })
        });
        if (!response.ok) throw new Error("Error HTTP " + response.status);
        const result = await response.json();

        if (result && result.status === 'success' && Array.isArray(result.data)) {
            allFetchedOrdenes = result.data;
        }
    } catch (error) {
        console.warn("Error al consultar órdenes para módulo de estadísticas:", error);
    } finally {
        if (window.finishTopLoadingBar) finishTopLoadingBar();
    }
    return (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes)) ? allFetchedOrdenes : [];
};

/**
 * Abre el modal de Estadística y desencadena la descarga/cálculo de indicadores.
 */
window.openEstadisticasModal = async function() {
    const modal = document.getElementById('admin-estadisticas-modal');
    if (!modal) return;

    const savedMetaSemana = localStorage.getItem('stat_target_semana') || '100';
    const savedMetaMes = localStorage.getItem('stat_target_mes') || '400';

    const inputSemana = document.getElementById('stat-input-meta-semana');
    const inputMes = document.getElementById('stat-input-meta-mes');

    if (inputSemana) inputSemana.value = savedMetaSemana;
    if (inputMes) inputMes.value = savedMetaMes;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const tbody = document.getElementById('stat-table-weekly-breakdown');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-purple-400 font-semibold animate-pulse">⏳ Obteniendo información de órdenes y ventas en tiempo real...</td></tr>`;
    }

    // Cargar e inicializar gastos fijos del Local 419
    initGastosInputs419();

    await window.loadAllOrdersForStatistics();
    window.computeAndRenderStatistics();
};

/**
 * Obtiene los gastos fijos mensuales configurados para el Local 419 (con valores por defecto o desde localStorage).
 */
function getGastosFijos419() {
    const renta = parseFloat(document.getElementById('stat-419-input-renta')?.value || localStorage.getItem('stat_419_renta') || 5000) || 0;
    const luz = parseFloat(document.getElementById('stat-419-input-luz')?.value || localStorage.getItem('stat_419_luz') || 1500) || 0;
    const ayudante = parseFloat(document.getElementById('stat-419-input-ayudante')?.value || localStorage.getItem('stat_419_ayudante') || 6000) || 0;
    const agua = parseFloat(document.getElementById('stat-419-input-agua')?.value || localStorage.getItem('stat_419_agua') || 150) || 0;
    const internet = parseFloat(document.getElementById('stat-419-input-internet')?.value || localStorage.getItem('stat_419_internet') || 700) || 0;
    const otros = parseFloat(document.getElementById('stat-419-input-otros')?.value || localStorage.getItem('stat_419_otros') || 0) || 0;

    const totalGastos = renta + luz + ayudante + agua + internet + otros;
    return { renta, luz, ayudante, agua, internet, otros, totalGastos };
}

/**
 * Carga o inicializa los valores de gastos fijos en los inputs del formulario 419.
 */
function initGastosInputs419() {
    const savedRenta = localStorage.getItem('stat_419_renta') || '5000';
    const savedLuz = localStorage.getItem('stat_419_luz') || '1500';
    const savedAyudante = localStorage.getItem('stat_419_ayudante') || '6000';
    const savedAgua = localStorage.getItem('stat_419_agua') || '150';
    const savedInternet = localStorage.getItem('stat_419_internet') || '700';
    const savedOtros = localStorage.getItem('stat_419_otros') || '0';

    if (document.getElementById('stat-419-input-renta')) document.getElementById('stat-419-input-renta').value = savedRenta;
    if (document.getElementById('stat-419-input-luz')) document.getElementById('stat-419-input-luz').value = savedLuz;
    if (document.getElementById('stat-419-input-ayudante')) document.getElementById('stat-419-input-ayudante').value = savedAyudante;
    if (document.getElementById('stat-419-input-agua')) document.getElementById('stat-419-input-agua').value = savedAgua;
    if (document.getElementById('stat-419-input-internet')) document.getElementById('stat-419-input-internet').value = savedInternet;
    if (document.getElementById('stat-419-input-otros')) document.getElementById('stat-419-input-otros').value = savedOtros;
}

/**
 * Calcula y renderiza el módulo de Rentabilidad & Punto de Equilibrio del Local 419.
 */
function computeRentabilidad419() {
    const { totalGastos } = getGastosFijos419();

    if (document.getElementById('stat-419-val-gastos-total')) {
        document.getElementById('stat-419-val-gastos-total').textContent = `$${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (document.getElementById('stat-419-val-meta-bar')) {
        document.getElementById('stat-419-val-meta-bar').textContent = `$${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const now = new Date();
    const { startOfMonth, endOfMonth } = getMonthRange(now);

    const productsMap = new Map();
    if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
        allProducts.forEach(p => {
            if (!p) return;
            const pId = String(p.id || p.id_playera || '').trim();
            if (pId) productsMap.set(pId, p);
            if (p.nombre) productsMap.set(normalizeText(p.nombre), p);
        });
    }

    let rawOrdersList = [];
    if (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes)) {
        rawOrdersList = rawOrdersList.concat(allFetchedOrdenes);
    }
    if (typeof window.ordenes419Data !== 'undefined' && Array.isArray(window.ordenes419Data)) {
        rawOrdersList = rawOrdersList.concat(window.ordenes419Data);
    }

    const uniqueOrdersMap = new Map();
    rawOrdersList.forEach(o => {
        if (!o) return;
        const idKey = o.id_orden || o.id || o.id_orden_419;
        if (!idKey) return;
        uniqueOrdersMap.set(String(idKey).trim(), o);
    });

    let pzsVendidas419 = 0;
    let gananciaBruta419 = 0;
    let ventaTotal419 = 0;

    uniqueOrdersMap.forEach(o => {
        if (typeof isOrdenCancelada === 'function' ? isOrdenCancelada(o.estatus || o.Estatus) : String(o.estatus || '').toLowerCase().includes('cancel')) {
            return;
        }

        const origenStr = (o.origen || o.tipo_orden || o.origen_orden || '').toString().toLowerCase();
        const idStr = String(o.id_orden || o.id || '').toUpperCase();
        const is419 = origenStr.includes('419') || idStr.includes('419');
        if (!is419) return;

        const dateObj = typeof parseOrdenFecha === 'function' ? parseOrdenFecha(o.fecha || o.created_at || o.fecha_creacion || o.Fecha) : new Date(o.fecha || o.created_at);
        if (!dateObj || isNaN(dateObj.getTime())) return;

        if (dateObj < startOfMonth || dateObj > endOfMonth) return;

        const items = o.articulos_carrito || o.detalle || o.items || o.Ordenes_Detalle;
        if (Array.isArray(items) && items.length > 0) {
            items.forEach(d => {
                const estDet = d.EstatusOrdenDetalle !== undefined ? d.EstatusOrdenDetalle : d.estatus_detalle;
                if (estDet === 0 || estDet === "0") return;

                const cant = parseInt(d.cantidad || d.Cantidad || d.cant || 0, 10);
                if (isNaN(cant) || cant <= 0) return;

                pzsVendidas419 += cant;

                let pId = '';
                if (d.id_playera) {
                    if (typeof d.id_playera === 'object') pId = String(d.id_playera.id || d.id_playera.nombre || '').trim();
                    else pId = String(d.id_playera).trim();
                }

                const matchedProduct = productsMap.get(pId) || productsMap.get(normalizeText(d.nombre_playera || d.nombre || ''));

                const precioMenudeo = matchedProduct ? (parseFloat(matchedProduct.precio_menudeo) || parseFloat(d.precio_unitario_final) || 550) : (parseFloat(d.precio_unitario_final) || 550);
                const precioSuperMayoreo = matchedProduct ? (parseFloat(matchedProduct.precio_mayoreo_super) || 300) : 300;

                const gananciaUnitario = Math.max(0, precioMenudeo - precioSuperMayoreo);
                gananciaBruta419 += gananciaUnitario * cant;
                ventaTotal419 += (parseFloat(d.subtotal_renglon) || (precioMenudeo * cant));
            });
        } else {
            const cant = parseInt(o.total_piezas || o.piezas || o.Cantidad || 1, 10);
            pzsVendidas419 += cant;
            const montoOrd = parseFloat(o.gran_total || o.total_neto || o.total || o.monto || 0) || (550 * cant);
            ventaTotal419 += montoOrd;
            gananciaBruta419 += 250 * cant;
        }
    });

    const margenPromedioReal = pzsVendidas419 > 0 ? (gananciaBruta419 / pzsVendidas419) : 250;

    const pzsMesEquilibrio = totalGastos > 0 ? Math.ceil(totalGastos / margenPromedioReal) : 0;
    const pzsSemanaEquilibrio = Math.ceil(pzsMesEquilibrio / 4.333);
    const pzsDiaEquilibrio = (pzsMesEquilibrio / 30).toFixed(1);
    const ventaMetaMes = pzsMesEquilibrio * (margenPromedioReal > 0 ? (margenPromedioReal + 300) : 550);

    const utilidadNeta = gananciaBruta419 - totalGastos;

    if (document.getElementById('stat-419-val-pzs-mes-target')) document.getElementById('stat-419-val-pzs-mes-target').textContent = `${pzsMesEquilibrio} pzs`;
    if (document.getElementById('stat-419-val-monto-mes-target')) document.getElementById('stat-419-val-monto-mes-target').textContent = `Venta meta: $${ventaMetaMes.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mes`;

    if (document.getElementById('stat-419-val-pzs-semana-target')) document.getElementById('stat-419-val-pzs-semana-target').textContent = `${pzsSemanaEquilibrio} pzs`;
    if (document.getElementById('stat-419-val-pzs-dia-target')) document.getElementById('stat-419-val-pzs-dia-target').textContent = `${pzsDiaEquilibrio} pzs`;

    if (document.getElementById('stat-419-val-ganancia-bruta')) document.getElementById('stat-419-val-ganancia-bruta').textContent = `$${gananciaBruta419.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (document.getElementById('stat-419-val-pzs-vendidas')) document.getElementById('stat-419-val-pzs-vendidas').textContent = pzsVendidas419;
    if (document.getElementById('stat-419-val-margen-prom')) document.getElementById('stat-419-val-margen-prom').textContent = `$${margenPromedioReal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const utilCard = document.getElementById('stat-419-card-utilidad-neta');
    const badgeRent = document.getElementById('stat-419-badge-rentabilidad');
    const utilVal = document.getElementById('stat-419-val-utilidad-neta');
    const utilStatus = document.getElementById('stat-419-val-utilidad-status');

    if (utilVal) {
        const sign = utilidadNeta >= 0 ? '+' : '';
        utilVal.textContent = `${sign}$${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (utilCard) {
        utilCard.classList.remove('border-emerald-500/40', 'bg-emerald-500/10', 'border-amber-500/40', 'bg-amber-500/10', 'border-red-500/40', 'bg-red-500/10');
        if (utilidadNeta > 0) {
            utilCard.classList.add('border-emerald-500/40', 'bg-emerald-500/10');
            if (utilVal) utilVal.className = 'text-2xl font-black text-emerald-400';
            if (utilStatus) {
                utilStatus.className = 'mt-2 text-[10px] font-bold text-emerald-300 border-t border-white/5 pt-1.5';
                utilStatus.textContent = `🚀 Local Rentable (+ $${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })} de ganancia neta)`;
            }
            if (badgeRent) {
                badgeRent.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                badgeRent.textContent = '🟢 Local Rentable';
            }
        } else if (utilidadNeta === 0 && pzsVendidas419 > 0) {
            utilCard.classList.add('border-amber-500/40', 'bg-amber-500/10');
            if (utilVal) utilVal.className = 'text-2xl font-black text-amber-300';
            if (utilStatus) {
                utilStatus.className = 'mt-2 text-[10px] font-bold text-amber-300 border-t border-white/5 pt-1.5';
                utilStatus.textContent = `🟡 Punto de Equilibrio Alcanzado (Gastos cubiertos)`;
            }
            if (badgeRent) {
                badgeRent.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
                badgeRent.textContent = '🟡 En Punto de Equilibrio';
            }
        } else {
            utilCard.classList.add('border-red-500/40', 'bg-red-500/10');
            if (utilVal) utilVal.className = 'text-2xl font-black text-red-400';
            const pzsFaltantes = Math.max(0, pzsMesEquilibrio - pzsVendidas419);
            if (utilStatus) {
                utilStatus.className = 'mt-2 text-[10px] font-bold text-red-300 border-t border-white/5 pt-1.5';
                utilStatus.textContent = `⚠️ Faltan ${pzsFaltantes} pzs para cubrir gastos fijos del mes`;
            }
            if (badgeRent) {
                badgeRent.className = 'px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30';
                badgeRent.textContent = '🔴 En Pérdida (Atrasado)';
            }
        }
    }

    const pctCubierto = totalGastos > 0 ? Math.min(100, Math.round((gananciaBruta419 / totalGastos) * 100)) : 0;
    if (document.getElementById('stat-419-val-pct-cobertura')) {
        document.getElementById('stat-419-val-pct-cobertura').textContent = `${pctCubierto}% de gastos fijos cubiertos (${pzsVendidas419}/${pzsMesEquilibrio} pzs)`;
    }
    if (document.getElementById('stat-419-bar-rentabilidad')) {
        document.getElementById('stat-419-bar-rentabilidad').style.width = `${pctCubierto}%`;
        if (pctCubierto >= 100) {
            document.getElementById('stat-419-bar-rentabilidad').className = 'h-full bg-emerald-500 transition-all duration-500';
        } else if (pctCubierto >= 80) {
            document.getElementById('stat-419-bar-rentabilidad').className = 'h-full bg-amber-500 transition-all duration-500';
        } else {
            document.getElementById('stat-419-bar-rentabilidad').className = 'h-full bg-red-500 transition-all duration-500';
        }
    }
}

/**
 * Cierra el modal de Estadística.
 */
window.closeEstadisticasModal = function() {
    const modal = document.getElementById('admin-estadisticas-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

/**
 * Aplica estilos dinámicos (verde/amarillo/rojo) a las tarjetas y badges de ritmo según el porcentaje alcanzado.
 */
function applyPacingCardStyles(cardId, badgeId, rhythmPct) {
    const card = document.getElementById(cardId);
    const badge = document.getElementById(badgeId);
    if (!card || !badge) return;

    card.classList.remove(
        'border-emerald-500/40', 'bg-emerald-500/10',
        'border-amber-500/40', 'bg-amber-500/10',
        'border-red-500/40', 'bg-red-500/10',
        'border-white/10', 'bg-dark-200'
    );
    badge.classList.remove(
        'bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40',
        'bg-amber-500/20', 'text-amber-300', 'border-amber-500/40',
        'bg-red-500/20', 'text-red-300', 'border-red-500/40'
    );

    if (rhythmPct >= 100) {
        card.classList.add('border-emerald-500/40', 'bg-emerald-500/10');
        badge.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/40');
        badge.textContent = '🟢 Excelente (En Ritmo)';
    } else if (rhythmPct >= 80) {
        card.classList.add('border-amber-500/40', 'bg-amber-500/10');
        badge.classList.add('bg-amber-500/20', 'text-amber-300', 'border', 'border-amber-500/40');
        badge.textContent = '🟡 Alerta (Bajo Ritmo)';
    } else {
        card.classList.add('border-red-500/40', 'bg-red-500/10');
        badge.classList.add('bg-red-500/20', 'text-red-300', 'border', 'border-red-500/40');
        badge.textContent = '🔴 Crítico (Atrasado)';
    }
}

/**
 * Re-calcula y renderiza todas las métricas de Estadística basándose en las órdenes actuales.
 */
window.computeAndRenderStatistics = function() {
    const filterOrigen = document.getElementById('stat-origen-filter') ? document.getElementById('stat-origen-filter').value : 'all';
    
    const is419Only = filterOrigen === '419';
    const gridGen = document.getElementById('stat-general-kpi-grid');
    const metaInputs = document.getElementById('stat-meta-inputs-container');
    const rent419 = document.getElementById('stat-419-rentabilidad-container');

    if (is419Only) {
        if (gridGen) gridGen.classList.add('hidden');
        if (metaInputs) metaInputs.classList.add('hidden');
        if (rent419) rent419.classList.remove('hidden');
    } else {
        if (gridGen) gridGen.classList.remove('hidden');
        if (metaInputs) metaInputs.classList.remove('hidden');
        if (rent419) rent419.classList.add('hidden');
    }
    
    const metaSemana = parseFloat(document.getElementById('stat-input-meta-semana')?.value || 100) || 100;
    const metaMes = parseFloat(document.getElementById('stat-input-meta-mes')?.value || 400) || 400;

    const now = new Date();
    const { startOfWeek, endOfWeek, dayOfWeek } = getWeekRange(now);
    const { startOfMonth, endOfMonth, dayOfMonth, totalDaysInMonth } = getMonthRange(now);

    const formatDayMonth = (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const semanaRangeStr = `${formatDayMonth(startOfWeek)} al ${formatDayMonth(endOfWeek)}`;
    const mesRangeStr = `${now.toLocaleString('es-MX', { month: 'long' }).toUpperCase()} (1-${totalDaysInMonth})`;

    if (document.getElementById('stat-badge-semana-range')) {
        document.getElementById('stat-badge-semana-range').textContent = semanaRangeStr;
    }
    if (document.getElementById('stat-badge-mes-range')) {
        document.getElementById('stat-badge-mes-range').textContent = mesRangeStr;
    }

    const expectedSemanaPzs = Math.round(metaSemana * (dayOfWeek / 7));
    const expectedMesPzs = Math.round(metaMes * (dayOfMonth / totalDaysInMonth));

    // Consolidar todas las fuentes posibles de órdenes en memoria
    let rawOrdersList = [];
    if (typeof allFetchedOrdenes !== 'undefined' && Array.isArray(allFetchedOrdenes)) {
        rawOrdersList = rawOrdersList.concat(allFetchedOrdenes);
    }
    if (typeof window.ordenesData !== 'undefined' && Array.isArray(window.ordenesData)) {
        rawOrdersList = rawOrdersList.concat(window.ordenesData);
    }
    if (typeof window.ordenes419Data !== 'undefined' && Array.isArray(window.ordenes419Data)) {
        rawOrdersList = rawOrdersList.concat(window.ordenes419Data);
    }

    // Desduplicar órdenes por su ID
    const uniqueOrdersMap = new Map();
    rawOrdersList.forEach(o => {
        if (!o) return;
        const idKey = o.id_orden || o.id || o.id_orden_419;
        if (!idKey) return;
        uniqueOrdersMap.set(String(idKey).trim(), o);
    });

    let semanaPiezas = 0;
    let semanaDinero = 0;
    let mesPiezas = 0;
    let mesDinero = 0;

    const dailyBreakdown = [
        { dayNum: 1, name: 'Lunes', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 2, name: 'Martes', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 3, name: 'Miércoles', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 4, name: 'Jueves', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 5, name: 'Viernes', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 6, name: 'Sábado', pzs: 0, dinero: 0, dateObj: null },
        { dayNum: 7, name: 'Domingo', pzs: 0, dinero: 0, dateObj: null },
    ];

    for (let i = 0; i < 7; i++) {
        const dObj = new Date(startOfWeek);
        dObj.setDate(startOfWeek.getDate() + i);
        dailyBreakdown[i].dateObj = dObj;
    }

    uniqueOrdersMap.forEach(o => {
        // Excluir órdenes canceladas
        if (typeof isOrdenCancelada === 'function' ? isOrdenCancelada(o.estatus || o.Estatus) : String(o.estatus || '').toLowerCase().includes('cancel')) {
            return;
        }

        // Filtrar por sucursal / origen
        const origenStr = (o.origen || o.tipo_orden || o.origen_orden || '').toString().toLowerCase();
        const idStr = String(o.id_orden || o.id || '').toUpperCase();
        const is419 = origenStr.includes('419') || idStr.includes('419');

        if (filterOrigen === '419' && !is419) return;
        if (filterOrigen === 'general' && is419) return;

        // Parsear fecha de la orden
        const dateObj = typeof parseOrdenFecha === 'function' ? parseOrdenFecha(o.fecha || o.created_at || o.fecha_creacion || o.Fecha) : new Date(o.fecha || o.created_at);
        if (!dateObj || isNaN(dateObj.getTime())) return;

        // Conteo exacto de piezas desde el detalle de la orden
        const items = o.articulos_carrito || o.detalle || o.items || o.Ordenes_Detalle;
        let pzs = 0;
        if (Array.isArray(items) && items.length > 0) {
            items.forEach(d => {
                const estDet = d.EstatusOrdenDetalle !== undefined ? d.EstatusOrdenDetalle : d.estatus_detalle;
                if (estDet === 0 || estDet === "0") return;
                const cant = parseInt(d.cantidad || d.Cantidad || d.cant || 0, 10);
                if (!isNaN(cant) && cant > 0) pzs += cant;
            });
        } else if (o.total_piezas || o.piezas || o.Cantidad) {
            pzs = parseInt(o.total_piezas || o.piezas || o.Cantidad || 0, 10);
        } else if (o.gran_total || o.total || o.monto || o.total_neto) {
            pzs = 1;
        }

        const monto = parseFloat(o.gran_total || o.total_neto || o.total || o.Gran_Total || o.Total || o.monto || 0) || 0;

        // Evaluar si cae en la semana actual (Lunes a Domingo)
        if (dateObj >= startOfWeek && dateObj <= endOfWeek) {
            semanaPiezas += pzs;
            semanaDinero += monto;

            const d = dateObj.getDay();
            const dIndex = (d === 0 ? 7 : d) - 1;
            if (dailyBreakdown[dIndex]) {
                dailyBreakdown[dIndex].pzs += pzs;
                dailyBreakdown[dIndex].dinero += monto;
            }
        }

        // Evaluar si cae en el mes actual (Día 1 al último)
        if (dateObj >= startOfMonth && dateObj <= endOfMonth) {
            mesPiezas += pzs;
            mesDinero += monto;
        }
    });

    const semanaRitmoPct = expectedSemanaPzs > 0 ? Math.round((semanaPiezas / expectedSemanaPzs) * 100) : 0;
    const mesRitmoPct = expectedMesPzs > 0 ? Math.round((mesPiezas / expectedMesPzs) * 100) : 0;

    // Renderizar KPI 1: Piezas Semana
    if (document.getElementById('stat-val-semana-piezas')) document.getElementById('stat-val-semana-piezas').textContent = semanaPiezas;
    if (document.getElementById('stat-val-semana-meta-target')) document.getElementById('stat-val-semana-meta-target').textContent = metaSemana;
    if (document.getElementById('stat-val-semana-esperado')) document.getElementById('stat-val-semana-esperado').textContent = `Meta hoy: ${expectedSemanaPzs} pzs`;
    
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    if (document.getElementById('stat-val-semana-dia-nombre')) {
        document.getElementById('stat-val-semana-dia-nombre').textContent = `${dayNames[dayOfWeek - 1]} (Día ${dayOfWeek} de 7)`;
    }
    const semanaProgressPct = Math.min(100, Math.round((semanaPiezas / metaSemana) * 100));
    if (document.getElementById('stat-bar-semana-progress')) document.getElementById('stat-bar-semana-progress').style.width = `${semanaProgressPct}%`;

    // Renderizar KPI 2: Dinero Semana
    if (document.getElementById('stat-val-semana-dinero')) {
        document.getElementById('stat-val-semana-dinero').textContent = `$${semanaDinero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const semanaDineroProm = dayOfWeek > 0 ? (semanaDinero / dayOfWeek) : 0;
    if (document.getElementById('stat-val-semana-dinero-prom')) {
        document.getElementById('stat-val-semana-dinero-prom').textContent = `$${semanaDineroProm.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Renderizar KPI 3: Ritmo Semanal (%)
    if (document.getElementById('stat-val-semana-ritmo-pct')) document.getElementById('stat-val-semana-ritmo-pct').textContent = `${semanaRitmoPct}%`;
    applyPacingCardStyles('stat-card-semana-ritmo', 'stat-badge-semana-ritmo', semanaRitmoPct);
    
    const diffSemanaPzs = semanaPiezas - expectedSemanaPzs;
    if (document.getElementById('stat-desc-semana-ritmo')) {
        if (diffSemanaPzs >= 0) {
            document.getElementById('stat-desc-semana-ritmo').textContent = `⚡ Vas +${diffSemanaPzs} pzs arriba del ritmo estimado al día de hoy (${dayNames[dayOfWeek - 1]}).`;
        } else {
            document.getElementById('stat-desc-semana-ritmo').textContent = `⚠️ Faltan ${Math.abs(diffSemanaPzs)} pzs para alcanzar el 100% del ritmo esperado hoy (${dayNames[dayOfWeek - 1]}).`;
        }
    }

    // Renderizar KPI 4: Piezas Mes
    if (document.getElementById('stat-val-mes-piezas')) document.getElementById('stat-val-mes-piezas').textContent = mesPiezas;
    if (document.getElementById('stat-val-mes-meta-target')) document.getElementById('stat-val-mes-meta-target').textContent = metaMes;
    if (document.getElementById('stat-val-mes-esperado')) document.getElementById('stat-val-mes-esperado').textContent = `Meta hoy: ${expectedMesPzs} pzs`;
    if (document.getElementById('stat-val-mes-dia-nombre')) {
        document.getElementById('stat-val-mes-dia-nombre').textContent = `Día ${dayOfMonth} de ${totalDaysInMonth}`;
    }
    const mesProgressPct = Math.min(100, Math.round((mesPiezas / metaMes) * 100));
    if (document.getElementById('stat-bar-mes-progress')) document.getElementById('stat-bar-mes-progress').style.width = `${mesProgressPct}%`;

    // Renderizar KPI 5: Dinero Mes
    if (document.getElementById('stat-val-mes-dinero')) {
        document.getElementById('stat-val-mes-dinero').textContent = `$${mesDinero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const mesDineroProm = dayOfMonth > 0 ? (mesDinero / dayOfMonth) : 0;
    if (document.getElementById('stat-val-mes-dinero-prom')) {
        document.getElementById('stat-val-mes-dinero-prom').textContent = `$${mesDineroProm.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Renderizar KPI 6: Ritmo Mensual (%)
    if (document.getElementById('stat-val-mes-ritmo-pct')) document.getElementById('stat-val-mes-ritmo-pct').textContent = `${mesRitmoPct}%`;
    applyPacingCardStyles('stat-card-mes-ritmo', 'stat-badge-mes-ritmo', mesRitmoPct);
    
    const diffMesPzs = mesPiezas - expectedMesPzs;
    if (document.getElementById('stat-desc-mes-ritmo')) {
        if (diffMesPzs >= 0) {
            document.getElementById('stat-desc-mes-ritmo').textContent = `⚡ Vas +${diffMesPzs} pzs arriba del ritmo estimado al día ${dayOfMonth} del mes.`;
        } else {
            document.getElementById('stat-desc-mes-ritmo').textContent = `⚠️ Faltan ${Math.abs(diffMesPzs)} pzs para alcanzar el 100% del ritmo esperado hoy (Día ${dayOfMonth}).`;
        }
    }

    const dailyTargetAvg = (metaSemana / 7).toFixed(1);
    if (document.getElementById('stat-val-promedio-diario-target')) {
        document.getElementById('stat-val-promedio-diario-target').textContent = `${dailyTargetAvg} pzs/día`;
    }

    // Renderizar Tabla Desglose Diario
    const tbody = document.getElementById('stat-table-weekly-breakdown');
    if (tbody) {
        tbody.innerHTML = '';
        const targetPerDay = metaSemana / 7;

        dailyBreakdown.forEach((item) => {
            const isToday = item.dayNum === dayOfWeek;
            const isPast = item.dayNum < dayOfWeek;
            const formattedDate = item.dateObj ? `${item.dateObj.getDate().toString().padStart(2, '0')}/${(item.dateObj.getMonth() + 1).toString().padStart(2, '0')}` : '';

            let badgeHtml = '';
            if (isToday) {
                if (item.pzs >= Math.round(targetPerDay)) {
                    badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">🟢 Hoy (Cumplido)</span>`;
                } else {
                    badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">⚡ Hoy En Proceso</span>`;
                }
            } else if (isPast) {
                if (item.pzs >= Math.round(targetPerDay)) {
                    badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">Meta Alcanzada</span>`;
                } else if (item.pzs > 0) {
                    badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px]">Ventas Parciales</span>`;
                } else {
                    badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">Sin Ventas</span>`;
                }
            } else {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-white/5 text-gray-500 text-[10px]">Pendiente</span>`;
            }

            const tr = document.createElement('tr');
            tr.className = isToday ? 'bg-purple-500/10 font-medium' : 'hover:bg-white/5';
            tr.innerHTML = `
                <td class="py-2.5 px-3 font-semibold text-gray-200">
                    ${item.name} ${isToday ? '<span class="text-purple-400 font-bold ml-1">(Hoy)</span>' : ''}
                </td>
                <td class="py-2.5 px-3 text-gray-400 font-mono text-[11px]">${formattedDate}</td>
                <td class="py-2.5 px-3 text-center font-bold ${item.pzs > 0 ? 'text-white' : 'text-gray-500'}">
                    ${item.pzs} pzs
                </td>
                <td class="py-2.5 px-3 text-right font-bold ${item.dinero > 0 ? 'text-emerald-400' : 'text-gray-500'}">
                    $${item.dinero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="py-2.5 px-3 text-center">
                    ${badgeHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Calcular y actualizar rentabilidad & punto de equilibrio del Local 419
    computeRentabilidad419();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btn-save-stat-targets');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const metaSemana = document.getElementById('stat-input-meta-semana')?.value || '100';
            const metaMes = document.getElementById('stat-input-meta-mes')?.value || '400';

            localStorage.setItem('stat_target_semana', metaSemana);
            localStorage.setItem('stat_target_mes', metaMes);

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Metas Actualizadas',
                    text: `Nuevas metas: Semanal = ${metaSemana} pzs | Mensual = ${metaMes} pzs`,
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#151515',
                    color: '#fff'
                });
            }

            window.computeAndRenderStatistics();
        });
    }

    const selectOrigen = document.getElementById('stat-origen-filter');
    if (selectOrigen) {
        selectOrigen.addEventListener('change', () => {
            window.computeAndRenderStatistics();
        });
    }

    // Listeners reactivos para gastos fijos de Local 419
    ['stat-419-input-renta', 'stat-419-input-luz', 'stat-419-input-ayudante', 'stat-419-input-agua', 'stat-419-input-internet', 'stat-419-input-otros'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                computeRentabilidad419();
            });
        }
    });

    const btnSave419 = document.getElementById('btn-save-gastos-419');
    if (btnSave419) {
        btnSave419.addEventListener('click', () => {
            localStorage.setItem('stat_419_renta', document.getElementById('stat-419-input-renta')?.value || '5000');
            localStorage.setItem('stat_419_luz', document.getElementById('stat-419-input-luz')?.value || '1500');
            localStorage.setItem('stat_419_ayudante', document.getElementById('stat-419-input-ayudante')?.value || '6000');
            localStorage.setItem('stat_419_agua', document.getElementById('stat-419-input-agua')?.value || '150');
            localStorage.setItem('stat_419_internet', document.getElementById('stat-419-input-internet')?.value || '700');
            localStorage.setItem('stat_419_otros', document.getElementById('stat-419-input-otros')?.value || '0');

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Gastos Fijos Guardados',
                    text: 'Se han guardado los gastos del Local 419 en el sistema.',
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#151515', color: '#fff'
                });
            }
            computeRentabilidad419();
        });
    }
});








