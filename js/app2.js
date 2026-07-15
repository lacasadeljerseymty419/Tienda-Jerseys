const API_URL = "https://script.google.com/macros/s/AKfycbxM1d2gYABMBmGLb-6cgcEaoFpAH1F67o4X1aJcdPEhz64Fx6ZXyo284UNX0sGLVC2Ejg/exec";

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
        return { status: "error", message: "Error de conexión al servidor." };
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
        openOrders: document.querySelectorAll('.action-open-orders')
    },
    mobileMenu: {
        toggleBtn: document.getElementById('btn-mobile-Menúu-toggle'),
        closeBtn: document.getElementById('btn-close-mobile-Menúu'),
        overlay: document.getElementById('mobile-Menúu-overlay'),
        drawer: document.getElementById('mobile-Menúu-drawer'),
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
        fotoPreviewContainer: document.getElementById('preview-foto-container'),
        newTallaVal: document.getElementById('new-talla-val'),
        newStockVal: document.getElementById('new-stock-val'),
        precioMenudeo: document.getElementById('create-precio-Menudeo'),
        precioMayoreo: document.getElementById('create-precio-mayoreo'),
        precioMayoreoSuper: document.getElementById('create-precio-mayoreo-super'),
        formUpdatePrecios: document.getElementById('form-update-precios'),
        updateFotoUrl: document.getElementById('update-foto-url'),
        updatePrecioMenudeo: document.getElementById('update-precio-Menudeo'),
        updatePrecioMayoreo: document.getElementById('update-precio-mayoreo'),
        updatePrecioMayoreoSuper: document.getElementById('update-precio-mayoreo-super'),
        filterSearch: document.getElementById('admin-filter-search'),
        filterTipo: document.getElementById('admin-filter-tipo'),
        filterVersion: document.getElementById('admin-filter-version'),
        filterGenero: document.getElementById('admin-filter-genero'),
        pagePrev: document.getElementById('admin-page-prev'),
        pageNext: document.getElementById('admin-page-next'),
        pageInfo: document.getElementById('admin-pagination-info'),
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
    if (!loggedUserStr) {
        DOM.login.overlay.classList.remove('hidden');
        DOM.login.form.addEventListener('submit', handleLoginSubmit);
    } else {
        DOM.login.overlay.classList.add('hidden');
        const loggedUser = JSON.parse(loggedUserStr);
        DOM.navUserName.textContent = loggedUser.nombre_completo || loggedUser.usuario || 'Usuario';
        if (DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = loggedUser.nombre_completo || loggedUser.usuario || 'Usuario';
        DOM.navUserBadge.classList.remove('hidden');
        if (loggedUser.perfil === "Administrador") {
            if (DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.remove('hidden');
            if (DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.remove('hidden');
            const savedSub = localStorage.getItem('current_subperfil') || 'Menudeo';
            if (DOM.adminSubperfilSelect) {
                DOM.adminSubperfilSelect.classList.remove('hidden');
                DOM.adminSubperfilSelect.value = savedSub;
            }
            if (DOM.mobileMenu.adminSubperfilSelect) {
                DOM.mobileMenu.adminSubperfilSelect.value = savedSub;
            }
        } else {
            if (DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.add('hidden');
            if (DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.add('hidden');
            if (DOM.adminSubperfilSelect) DOM.adminSubperfilSelect.classList.add('hidden');
        }
    }

    renderSkeletons(6);
    await loadCatalogs();
    await fetchInitialProducts(); // Cargar todos y renderizar
    
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
    }
    
    // Eventos de Admin
    if (DOM.actions.openCreate) DOM.actions.openCreate.forEach(btn => btn.addEventListener('click', () => { openCreateModal(); closemobileMenu(); }));
    if (DOM.admin.closeCreateModal) DOM.admin.closeCreateModal.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnCancelCreate) DOM.admin.btnCancelCreate.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnAddTalla) DOM.admin.btnAddTalla.addEventListener('click', addTallaField);
    if (DOM.admin.formCreate) DOM.admin.formCreate.addEventListener('submit', handleCreateProduct);
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
            const url = e.target.value.trim();
            if (url) {
                DOM.admin.fotoPreview.src = url;
                DOM.admin.fotoPreviewContainer.classList.remove('hidden');
            } else {
                DOM.admin.fotoPreviewContainer.classList.add('hidden');
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

function openModal(imgUrl) {
    if (!DOM.modal.overlay) return;
    DOM.modal.img.src = imgUrl;
    DOM.modal.overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        DOM.modal.overlay.classList.remove('opacity-0');
        DOM.modal.img.classList.remove('scale-95');
        DOM.modal.img.classList.add('scale-100');
    });
    document.body.style.overflow = 'hidden';
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
    }, 300);
}

async function loadCatalogs() {
    let configs = null;
    const CACHE_KEY = 'jerseys_configs_v11';
    const CACHE_TTL = 60 * 60 * 1000; // 1 hora en milisegundos
    
    // 1. Intentar cargar y parsear del localStorage de manera segura considerando la expiración (TTL)
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            // Verificar si tiene el formato de objeto con timestamp y no ha expirado
            if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TTL)) {
                configs = cachedObj.data;
            } else {
                console.log("Caché de configuraciones expirada o en formato antiguo. Se requerirá actualización.");
            }
        }
    } catch (e) {
        console.warn("No se pudo parsear jerseys_configs del localStorage, se obtendrá de la API:", e);
    }
    
    // 2. Determinar si los datos en caché o de la API son válidos (soportando variantes singular/plural y diferentes niveles de anidación)
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
        const reglas_envio = candidate.reglas_envio || [];
        
        if (Array.isArray(tipos) && Array.isArray(versiones) && Array.isArray(generos)) {
            return { tipos, versiones, generos, perfiles, categorias, personalizaciones, reglas_mayoreo_super, estatus_ordenes, reglas_envio };
        }
        return null;
    };
    
    let validData = getValidData(configs);
    
    if (!validData) {
        console.log("Caché de configuraciones ausente, expirada o inválida. Obteniendo de la API...");
        try {
            const apiResponse = await get_configs();
            validData = getValidData(apiResponse);
            if (validData) {
                // Guardar la respuesta original de la API con timestamp para el TTL
                const cacheWrapper = {
                    data: apiResponse,
                    timestamp: Date.now()
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheWrapper));
            }
        } catch (error) {
            console.error("Error al consultar la API para configuraciones:", error);
        }
    }
    
    // Cargar Catálogo de Personalizaciones
    let pers = null;
    const PERS_CACHE_KEY = 'jerseys_personalizations_v10';
    try {
        const cachedPersStr = localStorage.getItem(PERS_CACHE_KEY);
        if (cachedPersStr) {
            const cachedPersObj = JSON.parse(cachedPersStr);
            if (cachedPersObj && cachedPersObj.timestamp && (Date.now() - cachedPersObj.timestamp < CACHE_TTL)) {
                pers = cachedPersObj.data;
            }
        }
    } catch (e) {
        console.warn("Error al leer caché de personalizaciones:", e);
    }
    
    if (!pers) {
        console.log("Cargando personalizaciones desde la API...");
        try {
            const persResponse = await get_personalizations();
            if (persResponse && persResponse.status === 'success' && Array.isArray(persResponse.data)) {
                pers = persResponse.data;
                const cacheWrapper = {
                    data: pers,
                    timestamp: Date.now()
                };
                localStorage.setItem(PERS_CACHE_KEY, JSON.stringify(cacheWrapper));
            }
        } catch (error) {
            console.error("Error al obtener personalizaciones:", error);
        }
    }
    
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
    
    // 3. Poblar los selects si tenemos datos válidos
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
    
    const tipos = data.tipos || [];
    const versiones = data.versiones || [];
    const generos = data.generos || [];
    const perfiles = (data.perfiles && data.perfiles.length > 0) ? data.perfiles : ["Menudeo", "Mayoreo", "Administrador"];
    const estatusList = data.estatus_ordenes || ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'];
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
            localStorage.setItem('logged_user', JSON.stringify(res.data));
            localStorage.setItem('current_perfil', res.data.perfil || 'Menudeo');
            
            // Al hacer login exitoso, reiniciamos el contador de inactividad
            resetInactivityTimer();
            
            DOM.login.overlay.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                DOM.login.overlay.classList.add('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
            
            DOM.navUserName.textContent = res.data.nombre_completo || res.data.usuario || 'Usuario';
            if (DOM.mobileMenu && DOM.mobileMenu.userName) DOM.mobileMenu.userName.textContent = res.data.nombre_completo || res.data.usuario || 'Usuario';
            if (DOM.navUserBadge) DOM.navUserBadge.classList.remove('hidden');
            
            if (res.data.perfil === "Administrador") {
                if (DOM.admin && DOM.admin.adminMenúuWrapper) DOM.admin.adminMenúuWrapper.classList.remove('hidden');
                if (DOM.mobileMenu && DOM.mobileMenu.adminSection) DOM.mobileMenu.adminSection.classList.remove('hidden');
                const savedSub = localStorage.getItem('current_subperfil') || 'Menudeo';
                if (DOM.adminSubperfilSelect) {
                    DOM.adminSubperfilSelect.classList.remove('hidden');
                    DOM.adminSubperfilSelect.value = savedSub;
                }
                if (DOM.mobileMenu && DOM.mobileMenu.adminSubperfilSelect) {
                    DOM.mobileMenu.adminSubperfilSelect.value = savedSub;
                }
            } else {
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
            title: 'Error',
            text: 'Ocurrió un problema al intentar iniciar sesión.',
            icon: 'error',
            background: '#151515',
            color: '#ffffff',
            confirmButtonColor: '#1d4ed8'
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
    
    DOM.admin.listmodal.classList.remove('hidden');
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
        DOM.admin.pageInfo.parentEleMenút.classList.add('hidden');
        return;
    }
    
    DOM.admin.listEmpty.classList.add('hidden');
    DOM.admin.tableBody.closest('div.overflow-x-auto').classList.remove('hidden');
    DOM.admin.pageInfo.parentEleMenút.classList.remove('hidden');
    
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
        
        const imgUrl = producto.foto || producto.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        
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

function openInventoryModal(producto) {
    currentJerseyToManage = producto;
    DOM.admin.invTitle.textContent = producto.nombre;
    DOM.admin.invId.textContent = `ID: ${producto.id}`;
    DOM.admin.invImg.src = producto.foto || producto.imagen || '';
    
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

    if (DOM.admin.updatePrecioMenudeo) DOM.admin.updatePrecioMenudeo.value = producto.precio_Menudeo || 0;
    if (DOM.admin.updatePrecioMayoreo) DOM.admin.updatePrecioMayoreo.value = producto.precio_mayoreo || 0;
    if (DOM.admin.updatePrecioMayoreoSuper) DOM.admin.updatePrecioMayoreoSuper.value = producto.precio_mayoreo_super || 0;
    if (DOM.admin.updateFotoUrl) DOM.admin.updateFotoUrl.value = producto.foto || producto.imagen || '';
    
    DOM.admin.invmodal.classList.remove('hidden');
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
        precio_Menudeo: parseFloat(currentJerseyToManage.precio_Menudeo) || 0,
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
    
    const payload = {
        action: "update",
        id: currentJerseyToManage.id,
        precio_Menudeo: pMenudeo,
        precio_mayoreo: pMayoreo,
        precio_mayoreo_super: pMayoreoSuper,
        foto: DOM.admin.updateFotoUrl ? DOM.admin.updateFotoUrl.value.trim() : ''
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Actualizando...';

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
            
            // Refrescar data en segundo plano
            await fetchInitialProducts();
            
            // Buscar la playera actualizada
            const updatedProduct = allProducts.find(p => p.id === currentJerseyToManage.id);
            if (updatedProduct) {
                currentJerseyToManage = updatedProduct;
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
    DOM.admin.createmodal.classList.remove('hidden');
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
        DOM.admin.fotoPreviewContainer.classList.add('hidden');
        DOM.admin.tallasContainer.innerHTML = '';
    }, 300);
}

function addTallaField() {
    const id = Date.now();
    const html = `
        <div class="flex gap-3 items-end bg-dark-200/30 p-3 rounded-xl border border-white/5 talla-item" id="talla-${id}">
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Talla</label>
                <input type="text" required placeholder="Ej. S, M, L..." class="talla-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white">
            </div>
            <div class="flex-1">
                <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Stock</label>
                <input type="number" required min="0" placeholder="0" class="stock-val w-full bg-dark-200/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white">
            </div>
            <button type="button" onclick="document.getElementById('talla-${id}').remove()" class="bg-red-500/10 text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors h-[38px] flex items-center justify-center" title="¿¿¿Eliminar talla">
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
    const tallasEleMenúts = DOM.admin.tallasContainer.querySelectorAll('.talla-item');
    const tallas = [];
    const generoSeleccionado = DOM.admin.createSelects.genero.value;

    tallasEleMenúts.forEach(el => {
        tallas.push({
            talla: el.querySelector('.talla-val').value.trim(),
            categoria: generoSeleccionado,
            stock: parseInt(el.querySelector('.stock-val').value) || 0
        });
    });

    if (tallas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos incompletos',
            text: 'Debes agregar al Menúos una talla al inventario.',
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
        foto: DOM.admin.fotoInput.value.trim(),
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
            Swal.fire({
                icon: 'success',
                title: '¡Playera Creada!',
                html: `<span class="text-gray-300">${data.message}</span><br><br><span class="text-xs bg-navy-500/20 text-navy-400 px-3 py-1 rounded-lg border border-navy-500/30 font-mono tracking-wider">ID: ${data.id}</span>`,
                background: '#151515',
                color: '#ffffff',
                confirmButtonColor: '#1d4ed8',
                confirmButtonText: 'Excelente',
                customClass: { popup: 'border border-white/10 rounded-2xl shadow-2xl shadow-navy-500/20' }
            });
            closeCreateModal();
            fetchInitialProducts(); // Recargar productos para incluir el nuevo
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error del servidor',
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

async function fetchInitialProducts() {
    const filtros = { nombre: "", tipo: "", version: "", genero: "" };
    const response = await search(filtros);
    
    if (Array.isArray(response)) {
        allProducts = response;
    } else if (response && response.status === 'success') {
        if (Array.isArray(response.data)) {
            allProducts = response.data;
        } else if (Array.isArray(response.productos)) {
            allProducts = response.productos;
        }
    }
    
    renderLocalProducts(allProducts);
    
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
    
    const imgUrl = producto.foto || producto.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    
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
        tallasHtml = '<div class="flex flex-wrap gap-1 sm:gap-2 mt-auto pt-2 sm:pt-4 z-10 relative">';
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
        profileToUse = localStorage.getItem('current_subperfil') || 'Menudeo';
    }
    
    const hasPrice = (parseFloat(producto.precio_Menudeo) > 0) || (parseFloat(producto.precio_mayoreo) > 0) || (parseFloat(producto.precio_mayoreo_super) > 0) || producto.precio;
    let statusTextHtml = '';
    if (hasPrice) {
        const basePrice = getBasePriceForProfile(producto, profileToUse);
        statusTextHtml = `
            <div class="mt-1 mb-2 bg-dark-200/40 border border-white/5 rounded-xl p-1.5 sm:p-2.5 space-y-0.5 sm:space-y-1 text-[9px] sm:text-xs z-10 relative backdrop-blur-sm">
                <div class="flex justify-between items-center text-gray-400">
                    <span class="font-medium">Precio (${profileToUse}):</span>
                    <span class="font-bold text-navy-400">$${basePrice.toFixed(2)}</span>
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

    let bottomSectionHtml = statusTextHtml + tallasHtml;
    if (currentView === 'jerseys-pedido') {
        if (isProximamente || isAgotado) {
            bottomSectionHtml += `<button class="w-full mt-3 py-2 rounded-lg bg-dark-200 text-gray-600 font-bold text-[11px] uppercase cursor-not-allowed border border-white/5" disabled>No disponible</button>`;
        } else {
            bottomSectionHtml += `<button class="w-full mt-3 py-2 rounded-lg bg-navy-500 hover:bg-navy-400 text-white font-bold text-[11px] uppercase tracking-wider transition-all duration-300 shadow hover:shadow-navy-500/20 active:scale-[0.97] btn-agregar-pedido">Agregar a mi pedido</button>`;
        }
    }

    article.innerHTML = `
        <div class="product-image-container relative w-full aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-4 bg-dark z-10 cursor-pointer">
            <img src="${imgUrl}" alt="${producto.nombre || 'Jersey'}" class="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out ${(isAgotado || isProximamente) ? 'grayscale opacity-60' : ''}" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-dark-100/90 via-dark-100/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500"></div>
            ${imageOverlayHtml}
        </div>
        <div class="product-details-container flex flex-col flex-grow cursor-pointer z-10 relative">
            <h3 class="text-[13px] sm:text-lg font-semibold text-white leading-tight mb-1 sm:mb-2 group-hover:text-navy-400 transition-colors line-clamp-2">
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

    const imgContainer = article.querySelector('.product-image-container');
    if (imgContainer) {
        imgContainer.addEventListener('click', () => openModal(imgUrl));
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
    DOM.admin.clientsmodal.classList.remove('hidden');
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
    
    DOM.admin.clientFormmodal.classList.remove('hidden');
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
    if (DOM.admin.clientPageInfo && DOM.admin.clientPageInfo.parentEleMenút) {
        DOM.admin.clientPageInfo.parentEleMenút.classList.add('hidden');
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
        DOM.admin.clientPageInfo.parentEleMenút.classList.add('hidden');
        return;
    }
    
    DOM.admin.clientListEmpty.classList.add('hidden');
    DOM.admin.clientTableBody.closest('div.overflow-x-auto').classList.remove('hidden');
    DOM.admin.clientPageInfo.parentEleMenút.classList.remove('hidden');
    
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
        profileToUse = localStorage.getItem('current_subperfil') || 'Menudeo';
    }
    if (profileToUse === 'Súper Mayoreo' || profileToUse === 'Mayoreo Súper') {
        profileToUse = 'Mayoreo';
    }
    const basePrice = getBasePriceForProfile(producto, profileToUse);
    DOM.pedido.desc.innerHTML = `${producto.genero || '-'} | ${producto.tipo || '-'} | ${producto.version || '-'} | <span class="text-navy-400 font-bold">$${basePrice.toFixed(2)}</span>`;
    DOM.pedido.img.src = producto.foto || producto.imagen || '';
    
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
            profileToUse = localStorage.getItem('current_subperfil') || 'Menudeo';
        }
        if (profileToUse === 'Súper Mayoreo' || profileToUse === 'Mayoreo Súper') {
            profileToUse = 'Mayoreo';
        }
        const isMayoreo = profileToUse === 'Mayoreo';
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
        profileToUse = localStorage.getItem('current_subperfil') || 'Menudeo';
    }
    if (profileToUse === 'Súper Mayoreo' || profileToUse === 'Mayoreo Súper') {
        profileToUse = 'Mayoreo';
    }
    const isMayoreo = profileToUse === 'Mayoreo';
    
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
            texto_personalizado: cleanCustomText
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
    
    let applySuper = false;
    if (profile === 'Mayoreo' || profile === 'Súper Mayoreo' || profile === 'Mayoreo Súper') {
        const totalJugador = cart.filter(i => i.producto.version === 'Jugador').reduce((sum, i) => sum + i.cantidad, 0);
        const totalFan = cart.filter(i => i.producto.version === 'Aficionado' || i.producto.version === 'Fan').reduce((sum, i) => sum + i.cantidad, 0);
        
        if (producto.version === 'Jugador' && totalJugador >= (reglasMayoreoSuper.piezas_jugador || 10)) applySuper = true;
        if ((producto.version === 'Aficionado' || producto.version === 'Fan') && totalFan >= (reglasMayoreoSuper.piezas_fan || 15)) applySuper = true;
    }
    
    if (applySuper && producto.precio_mayoreo_super) {
        basePrice = parseFloat(producto.precio_mayoreo_super);
    } else if (profile === 'Mayoreo' || profile === 'Súper Mayoreo' || profile === 'Mayoreo Súper') {
        basePrice = parseFloat(producto.precio_mayoreo || 0);
    } else {
        basePrice = parseFloat(producto.precio_Menudeo || 0);
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
        clientProfile = localStorage.getItem('current_subperfil') || 'Menudeo';
    }
    if (clientProfile === 'Súper Mayoreo' || clientProfile === 'Mayoreo Súper') {
        clientProfile = 'Mayoreo';
    }
    
    let subtotal = 0;
    let personalizacionesTotal = 0;
    
    cart.forEach((item, index) => {
        const prod = item.producto;
        const basePrice = getBasePriceForProfile(prod, clientProfile);
        
        // Obtener coste de personalización
        let persPrice = 0;
        let persName = "Ninguna";
        const isMayoreo = clientProfile === 'Mayoreo' || clientProfile === 'Súper Mayoreo' || clientProfile === 'Mayoreo Súper';
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
        
        const imgUrl = prod.foto || prod.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
        
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
        profile = localStorage.getItem('current_subperfil') || 'Menudeo';
    }
    if (profile === 'Súper Mayoreo' || profile === 'Mayoreo Súper') {
        profile = 'Mayoreo';
    }
    const isMayoreo = profile === 'Mayoreo';
    
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
            precio_unitario_final: finalPrice
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
        id_cliente: selectedClientId,
        tipo_precio_aplicado: profile,
        articulos: articulos,
        envio_domicilio: envio_domicilio,
        costo_envio: shippingCost
    };
    
    // Mostrar spinner de carga
    Swal.fire({
        title: 'Procesando Pedido',
        text: 'Enviando orden a la base de datos...',
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
            
            // Intentar abrir WhatsApp automáticamente
            window.open(waUrl, '_blank');
            
            Swal.fire({
                icon: 'success',
                title: '¡Pedido Realizado!',
                html: receiptHtml,
                background: '#151515', color: '#fff',
                confirmButtonColor: '#1d4ed8',
                confirmButtonText: 'Entendido',
                customClass: { popup: 'border border-white/10 rounded-2xl max-w-md' }
            });
            
            // Vaciar carrito
            cart = [];
            updateCartBadge();
            closeCartModal();
            
            // Recargar productos en background para actualizar inventarios/stock
            fetchInitialProducts();
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
                
                const imgUrl = prod.foto || prod.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
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
        
        const estatusOptionsHtml = (window.OrdenesEstatusList || ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'])
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
                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto" onclick="event.stopPropagation()">
                        <div class="text-base text-emerald-400 font-black whitespace-nowrap">$${Number(orden.gran_total).toFixed(2)}</div>
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
            
            const imgUrl = prod.foto || prod.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=100';
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
            <div class="text-xs text-gray-400 mt-0.5">
                Pers: <span class="text-navy-400 font-semibold">${persName}</span>
                ${art.texto_personalizado ? ` | <span class="text-emerald-400 font-mono">"${art.texto_personalizado}"</span>` : ''}
            </div>
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
    const phoneTextEleMenút = document.getElementById('admin-order-details-phone-text');
    
    // El telefono viene directamente en la orden como telefono_cliente
    let rawPhone = orden.telefono_cliente;
    
    // Si no está en la orden por alguna razón, intentamos buscarlo en el catálogo de clientes
    if (!rawPhone) {
        const clientObj = window.allClients ? window.allClients.find(c => String(c.id_cliente) === String(orden.id_cliente)) : null;
        rawPhone = clientObj ? (clientObj.telefono_cliente || clientObj.telefono) : null;
    }
    
    let finalPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
    
    if (finalPhone) {
        phoneTextEleMenút.textContent = finalPhone;
        if (phoneElement) {
            phoneElement.classList.remove('hidden');
            phoneElement.classList.remove('opacity-50');
        }
    } else {
        phoneTextEleMenút.textContent = 'Sin teléfono registrado';
        if (phoneElement) {
            phoneElement.classList.remove('hidden');
            phoneElement.classList.add('opacity-50');
        }
    }
    
    // Set status options
    const statusSelect = document.getElementById('admin-order-details-status');
    if (statusSelect) {
        const estatusOptionsHtml = (window.OrdenesEstatusList || ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'])
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
    const result = await Swal.fire({
        title: '¿Eliminar artículo?',
        text: `¿Estás seguro de que deseas eliminar este artículo de la orden? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff'
    });
    
    if (!result.isConfirmed) return;
    
    const payload = {
        action: 'delete_order_item',
        id_detalle: id_detalle
    };
    
    try {
        Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, background: '#151515', color: '#fff', didOpen: () => { Swal.showLoading(); }});
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            Swal.fire({ icon: 'success', title: '¡Eliminado!', text: data.message || 'Artículo removido del pedido con éxito.', background: '#151515', color: '#fff', timer: 2000, showConfirmButton: false });
            
            // Re-fetch orders to get the updated totals and items
            await fetchOrdenes();
            
            // Re-open modal to reflect changes
            const updatedOrden = allFetchedOrdenes.find(o => o.id_orden === id_orden);
            if (updatedOrden && updatedOrden.articulos_carrito && updatedOrden.articulos_carrito.length > 0) {
                openOrderDetailsModal(id_orden);
            } else {
                // All items were deleted, close modal
                document.getElementById('close-order-details-modal')?.click();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo eliminar el artículo.', background: '#151515', color: '#fff' });
        }
    } catch (error) {
        console.error('Error eliminando artículo:', error);
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
    
    if (!result.isConfirmed) {
        const ordenOriginal = currentOrdenes.find(o => o.id_orden === id_orden) || allFetchedOrdenes.find(o => o.id_orden === id_orden);
        selects.forEach(sel => sel.value = ordenOriginal ? ordenOriginal.estatus : "");
        const modalSelect = document.getElementById('admin-order-details-status');
        if (modalSelect && document.getElementById('admin-order-details-id')?.textContent === id_orden) {
            modalSelect.value = ordenOriginal ? ordenOriginal.estatus : "";
        }
        return;
    }
    
    const payload = {
        action: 'update_order_status',
        id_orden: id_orden,
        nuevo_estatus: nuevo_estatus
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
                
                const htmlContent = `
                    <p class="mb-4 text-sm font-semibold text-white">¿Quisieras notificarle al cliente por WhatsApp?</p>
                    <a href="${waUrl}" target="_blank" onclick="Swal.close()" class="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#20b858] transition-colors shadow-lg shadow-[#25D366]/20 w-full mb-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        Notificar por WhatsApp
                    </a>
                `;
                
                Swal.fire({
                    title: 'Aviso Opcional',
                    html: htmlContent,
                    background: '#151515', color: '#fff',
                    showConfirmButton: true,
                    confirmButtonText: 'No, gracias',
                    confirmButtonColor: '#3f3f46',
                    customClass: { popup: 'border border-white/10 rounded-2xl max-w-sm' }
                });
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
        console.error('Error in fetchUserOrdenes:', e); Swal.fire({ icon: 'error', title: 'Error API', text: String(e), background: '#151515', color: '#fff' });
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
                    <span class="text-emerald-400 font-bold">Total: $${(orden.gran_total || 0).toFixed(2)}</span>
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
        document.getElementById('user-order-edit-warning').classList.remove('hidden');
        document.getElementById('btn-save-user-order-changes').classList.remove('hidden');
    } else {
        document.getElementById('user-order-edit-warning').classList.add('hidden');
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
    
    currentUserOrderEditing.articulos_carrito.forEach((item, index) => {
        const art = document.createElement('div');
        art.className = "bg-dark-100 border border-white/5 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center mb-3 relative overflow-hidden group";
        
        let persText = "Ninguna";
        if (item.id_personalizacion && item.id_personalizacion.id_personalizacion && item.id_personalizacion.id_personalizacion !== "PERS-NONE") {
            persText = item.id_personalizacion.concepto;
            if (item.texto_personalizado) persText += ` (${item.texto_personalizado})`;
        }
        
        // Render view/edit modes
        let quantityHtml = `<span class="text-white font-bold">${item.cantidad}</span>`;
        let persHtml = `<span class="text-blue-400 font-semibold">${persText}</span>`;
        let actionHtml = '';
        
        if (isEditable) {
            quantityHtml = `
                <div class="flex items-center gap-2 border border-white/10 rounded-lg p-0.5 bg-black/20">
                    <button class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded" onclick="changeUserOrderItemQty(${index}, -1)">-</button>
                    <span class="text-sm font-bold w-4 text-center text-white">${item.cantidad}</span>
                    <button class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded" onclick="changeUserOrderItemQty(${index}, 1)">+</button>
                </div>
            `;
            
            if (item.id_personalizacion && item.id_personalizacion.id_personalizacion !== "PERS-NONE") {
                persHtml = `
                    <div class="mt-2 w-full">
                        <label class="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">Texto de Pers. (${item.id_personalizacion.concepto})</label>
                        <input type="text" value="${item.texto_personalizado || ''}" onchange="changeUserOrderItemPersText(${index}, this.value)" class="w-full bg-dark-200/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400 text-white placeholder-gray-600 uppercase" placeholder="Escribe el nombre/número...">
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
                <img src="${item.id_playera.foto}" class="w-full h-full object-cover" alt="Jersey">
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
                ${!isEditable ? `<div class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">Pers: ${persHtml}</div>` : persHtml}
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
    
    if (currentUserOrderEditing.articulos_carrito) {
        currentUserOrderEditing.articulos_carrito.forEach(item => {
            subJers += item.subtotal_renglon;
        });
    }
    
    // We update the local object total so it reflects correctly
    currentUserOrderEditing.gran_total = subJers;
    
    document.getElementById('user-order-subtotal').textContent = '$' + subJers.toFixed(2);
    document.getElementById('user-order-pers-total').textContent = 'Incluido';
    document.getElementById('user-order-total').textContent = '$' + subJers.toFixed(2);
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
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ 
                        action: 'update_order_item_quantity', 
                        id_detalle: edit.id_detalle,
                        categoria: categoria,
                        nueva_cantidad: nueva_cantidad,
                        id_personalizacion: id_pers,
                        texto_personalizado: texto_pers
                    })
                });
                const resData = await response.json();
                if (resData.status !== 'success') {
                    console.error('Error updating order item:', resData);
                }
            }
        }
        
        Swal.fire({ icon: 'success', title: '¡¡Actualizado!', text: 'Tus cambios se han guardado exitosamente.', background: '#151515', color: '#fff', timer: 2000, showConfirmButton: false });
        
        // Refresh data
        allUserOrdenesFetched = await fetchUserOrdenes(true);
        // Refresh global orders if admin cache exists
        if (typeof fetchOrdenes !== 'undefined') {
            fetchOrdenes(); // Fire and forget update global cache
        }
        
        // Re-open detail with updated data
        openUserOrderDetailsModal(currentUserOrderEditing.id_orden);
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
        case 'Entregada - Paqueteria':
        case 'Finalizada': return { color: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/20' };
        case 'Cancelada': return { color: 'red', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/20' };
        default: return { color: 'gray', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/20' };
    }
}






