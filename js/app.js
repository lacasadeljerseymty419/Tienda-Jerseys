const API_URL = "https://script.google.com/macros/s/AKfycbwhKfK6qPOtjZ3-P2JlWZQ1UW_KEA-MewEV4h2xFBF8j7pnOru5oNePKjbHFFg-UKa_dg/exec";

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
// --- FIN DE api.js ---

// --- INICIO DE app.js ---
const DOM = {
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
        btnOpenCreate: document.getElementById('btn-open-create'),
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
        fotoPreview: document.getElementById('preview-foto'),
        btnOpenList: document.getElementById('btn-open-list'),
        listModal: document.getElementById('admin-list-modal'),
        closeListModal: document.getElementById('close-list-modal'),
        tableBody: document.getElementById('admin-table-body'),
        listEmpty: document.getElementById('admin-list-empty'),
        invModal: document.getElementById('admin-inventory-modal'),
        closeInvModal: document.getElementById('close-inventory-modal'),
        invTitle: document.getElementById('inv-modal-title'),
        invId: document.getElementById('inv-modal-id'),
        invImg: document.getElementById('inv-modal-img'),
        invTallasList: document.getElementById('inv-tallas-list'),
        formAddTalla: document.getElementById('form-add-talla'),
        newTallaVal: document.getElementById('new-talla-val'),
        newStockVal: document.getElementById('new-stock-val'),
        precioMenudeo: document.getElementById('create-precio-menudeo'),
        precioMayoreo: document.getElementById('create-precio-mayoreo'),
        precioMayoreoSuper: document.getElementById('create-precio-mayoreo-super'),
        formUpdatePrecios: document.getElementById('form-update-precios'),
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
        selectPerfil: document.getElementById('select-perfil'),
        adminMenuWrapper: document.getElementById('admin-menu-wrapper'),
        btnOpenClients: document.getElementById('btn-open-clients'),
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

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    renderSkeletons(6);
    await loadCatalogs();
    await fetchInitialProducts(); // Cargar todos y renderizar
    
    DOM.btnAplicar.addEventListener('click', handleLocalSearch);
    DOM.filters.nombre.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLocalSearch();
    });
    
    if (DOM.btnToggleFiltros) {
        DOM.btnToggleFiltros.addEventListener('click', toggleFiltros);
    }

    // Búsqueda automática al cambiar cualquier select
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
    if (DOM.admin.btnOpenCreate) DOM.admin.btnOpenCreate.addEventListener('click', openCreateModal);
    if (DOM.admin.closeCreateModal) DOM.admin.closeCreateModal.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnCancelCreate) DOM.admin.btnCancelCreate.addEventListener('click', closeCreateModal);
    if (DOM.admin.btnAddTalla) DOM.admin.btnAddTalla.addEventListener('click', addTallaField);
    if (DOM.admin.formCreate) DOM.admin.formCreate.addEventListener('submit', handleCreateProduct);
    if (DOM.admin.btnOpenList) DOM.admin.btnOpenList.addEventListener('click', openListModal);
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
    if (DOM.admin.selectPerfil) {
        DOM.admin.selectPerfil.addEventListener('change', handleProfileChange);
    }
    if (DOM.admin.btnOpenClients) DOM.admin.btnOpenClients.addEventListener('click', openClientsModal);
    if (DOM.admin.closeClientsModal) DOM.admin.closeClientsModal.addEventListener('click', closeClientsModal);
    if (DOM.admin.btnOpenCreateClient) DOM.admin.btnOpenCreateClient.addEventListener('click', () => openClientFormModal());
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
    });
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
    const CACHE_KEY = 'jerseys_configs_v2';
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
        
        if (Array.isArray(tipos) && Array.isArray(versiones) && Array.isArray(generos)) {
            return { tipos, versiones, generos, perfiles, categorias };
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
    
    // 3. Poblar los selects si tenemos datos válidos
    if (validData) {
        populateSelects(validData);
        initProfileView();
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
            option.textContent = typeof item === 'object' ? item.nombre : item;
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
        // Quitar la opción vacía por defecto
        const defaultOpt = DOM.admin.selectPerfil.querySelector('option[value=""]');
        if (defaultOpt) defaultOpt.remove();
    }
    if(DOM.admin.clientInputs.perfil) populateDropdown(DOM.admin.clientInputs.perfil, perfiles, "Selecciona perfil");
}

function initProfileView() {
    let savedProfile = localStorage.getItem('current_perfil');
    if (!savedProfile) {
        savedProfile = "Administrador";
        localStorage.setItem('current_perfil', savedProfile);
    }
    
    if (DOM.admin.selectPerfil) {
        DOM.admin.selectPerfil.value = savedProfile;
    }
    
    applyProfileView(savedProfile);
}

function handleProfileChange(e) {
    const selectedProfile = e.target.value;
    localStorage.setItem('current_perfil', selectedProfile);
    applyProfileView(selectedProfile);
}

function applyProfileView(profile) {
    const wrapper = DOM.admin.adminMenuWrapper;
    if (wrapper) {
        if (profile === "Administrador") {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }
    
    // Volver a renderizar catálogo de productos según perfil
    if (allProducts && allProducts.length > 0) {
        renderLocalProducts(allProducts);
    }
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
                    <button class="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 shadow hover:shadow-red-500/30" title="Eliminar Jersey" onclick="Swal.fire({icon:'info', title:'Próximamente', text:'Función de eliminar en desarrollo', background:'#151515', color:'#fff', confirmButtonColor:'#1d4ed8', customClass: {popup: 'border border-white/10 rounded-2xl'}})">
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

    if (DOM.admin.updatePrecioMenudeo) DOM.admin.updatePrecioMenudeo.value = producto.precio_menudeo || 0;
    if (DOM.admin.updatePrecioMayoreo) DOM.admin.updatePrecioMayoreo.value = producto.precio_mayoreo || 0;
    if (DOM.admin.updatePrecioMayoreoSuper) DOM.admin.updatePrecioMayoreoSuper.value = producto.precio_mayoreo_super || 0;
    
    DOM.admin.invModal.classList.remove('hidden');
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
        precio_menudeo: parseFloat(currentJerseyToManage.precio_menudeo) || 0,
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
        precio_menudeo: pMenudeo,
        precio_mayoreo: pMayoreo,
        precio_mayoreo_super: pMayoreoSuper
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
                title: 'Precios Actualizados',
                text: 'Los precios del jersey han sido actualizados con éxito.',
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
    DOM.admin.createModal.classList.remove('hidden');
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

    const payload = {
        action: "create",
        nombre: document.getElementById('create-nombre').value.trim(),
        tipo: DOM.admin.createSelects.tipo.value,
        version: DOM.admin.createSelects.version.value,
        genero: DOM.admin.createSelects.genero.value,
        personalizacion: document.getElementById('create-personalizacion').value,
        foto: DOM.admin.fotoInput.value.trim(),
        precio_menudeo: parseFloat(DOM.admin.precioMenudeo.value) || 0,
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
    const filtros = { nombre: "", tipo: "", version: "", genero: "", talla: "" };
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
        if (!isFirstLoad) {
            DOM.emptyState.classList.remove('hidden');
        }
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
    article.className = 'group bg-dark-100 rounded-2xl p-3 sm:p-4 border border-white/5 hover:border-navy-400/40 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] relative overflow-hidden';
    
    const imgUrl = producto.foto || producto.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=600';
    
    let tagsHtml = '<div class="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3 z-10 relative">';
    if (producto.version) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 rounded-md border border-white/10 backdrop-blur-sm">${producto.version}</span>`;
    if (producto.tipo) tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 rounded-md border border-white/10 backdrop-blur-sm">${producto.tipo}</span>`;
    if (producto.genero) {
        const colorGen = getGenderColorClass(producto.genero);
        tagsHtml += `<span class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${colorGen} rounded-md border backdrop-blur-sm">${producto.genero}</span>`;
    }
    tagsHtml += '</div>';

    let tallasHtml = '';
    let totalStock = 0;
    const hasSizes = Array.isArray(producto.tallas) && producto.tallas.length > 0;

    if (hasSizes) {
        tallasHtml = '<div class="flex flex-wrap gap-1.5 sm:gap-2 mt-auto pt-3 sm:pt-5 z-10 relative">';
        producto.tallas.forEach(t => {
            const stockVal = t.stock !== undefined ? t.stock : t.inventario;
            if (stockVal > 0) totalStock += stockVal;
            const hasStock = stockVal > 0;
            const btnClass = hasStock 
                ? 'bg-dark-200 text-gray-200 border-white/10 hover:border-navy-400 hover:text-navy-400 hover:bg-dark-100 cursor-pointer shadow-sm' 
                : 'bg-dark/50 text-gray-600 border-white/5 line-through opacity-40 cursor-not-allowed';
            
            tallasHtml += `
                <button class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-semibold border transition-all duration-200 ${btnClass}" 
                        ${!hasStock ? 'disabled' : ''} 
                        title="${hasStock ? `Stock: ${stockVal}` : 'Agotado'}">
                    ${t.talla}
                </button>
            `;
        });
        tallasHtml += '</div>';
    }

    const isProximamente = !hasSizes;
    const isAgotado = hasSizes && totalStock === 0;

    // Determinar qué mostrar en el lugar del precio / estado
    const activeProfile = localStorage.getItem('current_perfil') || 'Administrador';
    const hasPrice = (parseFloat(producto.precio_menudeo) > 0) || (parseFloat(producto.precio_mayoreo) > 0) || (parseFloat(producto.precio_mayoreo_super) > 0);
    let statusTextHtml = '';
    if (hasPrice) {
        if (activeProfile === "Administrador") {
            statusTextHtml = `
                <div class="mt-2 mb-3 bg-dark-200/40 border border-white/5 rounded-xl p-2.5 space-y-1 text-[11px] sm:text-xs z-10 relative backdrop-blur-sm">
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Menudeo:</span>
                        <span class="font-bold text-gray-200">$${parseFloat(producto.precio_menudeo || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Mayoreo:</span>
                        <span class="font-bold text-navy-400">$${parseFloat(producto.precio_mayoreo || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Súper Mayoreo:</span>
                        <span class="font-bold text-emerald-400">$${parseFloat(producto.precio_mayoreo_super || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        } else if (activeProfile === "Mayoreo") {
            statusTextHtml = `
                <div class="mt-2 mb-3 bg-dark-200/40 border border-white/5 rounded-xl p-2.5 space-y-1 text-[11px] sm:text-xs z-10 relative backdrop-blur-sm">
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Mayoreo:</span>
                        <span class="font-bold text-navy-400">$${parseFloat(producto.precio_mayoreo || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Súper Mayoreo:</span>
                        <span class="font-bold text-emerald-400">$${parseFloat(producto.precio_mayoreo_super || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        } else {
            // Menudeo (por defecto)
            statusTextHtml = `
                <div class="mt-2 mb-3 bg-dark-200/40 border border-white/5 rounded-xl p-2.5 space-y-1 text-[11px] sm:text-xs z-10 relative backdrop-blur-sm">
                    <div class="flex justify-between items-center text-gray-400">
                        <span class="font-medium">Menudeo:</span>
                        <span class="font-bold text-gray-200">$${parseFloat(producto.precio_menudeo || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    } else if (producto.precio) {
        statusTextHtml = `<p class="text-base sm:text-xl font-bold text-gray-100 mb-1 sm:mb-2 z-10 relative">$${parseFloat(producto.precio).toFixed(2)}</p>`;
    } else if (isProximamente) {
        statusTextHtml = `
            <p class="text-sm sm:text-base font-bold text-amber-500 mb-1 sm:mb-2 z-10 relative flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Próximamente
            </p>
        `;
    } else if (isAgotado) {
        statusTextHtml = `
            <p class="text-sm sm:text-base font-bold text-red-500 mb-1 sm:mb-2 z-10 relative flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                Agotado
            </p>
        `;
    }

    // Imagen overlay banner
    let imageOverlayHtml = '';
    if (isProximamente) {
        imageOverlayHtml = `
            <div class="absolute inset-0 flex items-center justify-center bg-dark/40 backdrop-blur-[2px] z-20">
                <span class="bg-amber-500 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[10px] sm:text-xs border border-amber-400 shadow-xl shadow-amber-500/20 transform -rotate-6">Próximamente</span>
            </div>
        `;
    } else if (isAgotado) {
        imageOverlayHtml = `
            <div class="absolute inset-0 flex items-center justify-center bg-dark/30 backdrop-blur-[2px] z-20">
                <span class="bg-red-500 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-bold tracking-widest uppercase text-[10px] sm:text-xs border border-red-400 shadow-xl shadow-red-500/20 transform -rotate-6">Agotado</span>
            </div>
        `;
    }

    article.innerHTML = `
        <div class="product-image-container relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-4 bg-dark z-10 cursor-pointer">
            <img src="${imgUrl}" alt="${producto.nombre || 'Jersey'}" class="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out ${(isAgotado || isProximamente) ? 'grayscale opacity-60' : ''}" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-dark-100/90 via-dark-100/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500"></div>
            ${imageOverlayHtml}
        </div>
        <div class="product-details-container flex flex-col flex-grow cursor-pointer z-10 relative">
            <h3 class="text-sm sm:text-lg font-semibold text-white leading-tight mb-2 group-hover:text-navy-400 transition-colors line-clamp-2">
                ${producto.nombre || 'Jersey Deportivo'}
            </h3>
            ${tagsHtml}
            ${statusTextHtml}
            ${tallasHtml}
        </div>
        
        <div class="absolute inset-0 bg-gradient-to-tr from-navy-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    `;
    const imgContainer = article.querySelector('.product-image-container');
    if (imgContainer) {
        imgContainer.addEventListener('click', () => openModal(imgUrl));
    }
    const detailsContainer = article.querySelector('.product-details-container');
    if (detailsContainer) {
        detailsContainer.addEventListener('click', () => {
            const activeProfile = localStorage.getItem('current_perfil') || 'Administrador';
            if (activeProfile === 'Administrador') {
                openInventoryModal(producto);
            }
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
        DOM.admin.clientInputs.perfil.value = client.perfil || '';
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
        
        let perfilBadgeColor = 'bg-white/5 text-gray-400 border-white/10';
        if (client.perfil === 'Administrador') {
            perfilBadgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        } else if (client.perfil === 'Mayoreo') {
            perfilBadgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        } else if (client.perfil === 'Menudeo') {
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
                    ${client.perfil || 'Menudeo'}
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
                    <button class="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 shadow hover:shadow-red-500/30 btn-delete-client" title="Eliminar Cliente" data-id="${client.id_cliente}">
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

async function handleDeleteClient(clientId) {
    if (!clientId) return;
    
    const result = await Swal.fire({
        title: '¿Eliminar Cliente?',
        text: 'Esta acción no se puede deshacer y borrará al cliente del sistema.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#222222',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#151515', color: '#fff',
        customClass: { popup: 'border border-white/10 rounded-2xl' }
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: "delete_client",
                id_cliente: clientId
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Cliente Eliminado',
                text: data.message || 'El cliente ha sido borrado.',
                background: '#151515', color: '#fff',
                timer: 1500,
                showConfirmButton: false
            });
            fetchClients(true);
        } else {
            throw new Error(data.message || 'Error al eliminar cliente.');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            background: '#151515', color: '#fff'
        });
    }
}
