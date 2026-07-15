const API_URL = "https://script.google.com/macros/s/AKfycbxM1d2gYABMBmGLb-6cgcEaoFpAH1F67o4X1aJcdPEhz64Fx6ZXyo284UNX0sGLVC2Ejg/exec";

// Elementos DOM
const DOM = {
    grid: document.getElementById('products-grid'),
    emptyState: document.getElementById('empty-state'),
    resultsCount: document.getElementById('results-count'),
    skeletonTemplate: document.getElementById('skeleton-template'),
    filters: {
        nombre: document.getElementById('filter-nombre'),
        tipo: document.getElementById('filter-tipo'),
        version: document.getElementById('filter-version'),
        genero: document.getElementById('filter-genero')
    },
    mobileFilters: {
        searchInput: document.getElementById('mobile-search-input'),
        tipo: document.getElementById('mobile-filter-tipo'),
        version: document.getElementById('mobile-filter-version'),
        genero: document.getElementById('mobile-filter-genero'),
        panel: document.getElementById('mobile-filters-panel'),
        btnToggle: document.getElementById('btn-toggle-filters'),
        iconToggle: document.getElementById('icon-toggle-filters')
    },
    btnAplicar: document.getElementById('btn-aplicar'),
    btnAplicarMobile: document.getElementById('btn-aplicar-mobile'),
    modal: {
        overlay: document.getElementById('image-modal'),
        img: document.getElementById('modal-image'),
        closeBtn: document.getElementById('close-modal')
    }
};

let allProducts = [];

// Utilidades API
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

// Inicialización
document.addEventListener('DOMContentLoaded', initCatalogo);

async function initCatalogo() {
    renderSkeletons(8);
    await loadCatalogs();
    await fetchInitialProducts();
    
    // Listeners
    if (DOM.btnAplicar) DOM.btnAplicar.addEventListener('click', handleFilterDesktop);
    if (DOM.btnAplicarMobile) DOM.btnAplicarMobile.addEventListener('click', handleFilterMobile);
    
    // Listeners para auto-aplicar filtros (Desktop)
    if (DOM.filters.nombre) DOM.filters.nombre.addEventListener('input', handleFilterDesktop);
    if (DOM.filters.tipo) DOM.filters.tipo.addEventListener('change', handleFilterDesktop);
    if (DOM.filters.version) DOM.filters.version.addEventListener('change', handleFilterDesktop);
    if (DOM.filters.genero) DOM.filters.genero.addEventListener('change', handleFilterDesktop);
    
    // Listeners para auto-aplicar filtros (Mobile)
    if (DOM.mobileFilters.searchInput) DOM.mobileFilters.searchInput.addEventListener('input', handleFilterMobile);
    if (DOM.mobileFilters.tipo) DOM.mobileFilters.tipo.addEventListener('change', handleFilterMobile);
    if (DOM.mobileFilters.version) DOM.mobileFilters.version.addEventListener('change', handleFilterMobile);
    if (DOM.mobileFilters.genero) DOM.mobileFilters.genero.addEventListener('change', handleFilterMobile);

    if (DOM.mobileFilters.btnToggle) {
        DOM.mobileFilters.btnToggle.addEventListener('click', () => {
            const panel = DOM.mobileFilters.panel;
            panel.classList.toggle('hidden');
            if (panel.classList.contains('hidden')) {
                DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>';
                DOM.mobileFilters.btnToggle.classList.remove('bg-navy-50', 'text-navy-600', 'border-navy-200');
            } else {
                DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
                DOM.mobileFilters.btnToggle.classList.add('bg-navy-50', 'text-navy-600', 'border-navy-200');
            }
        });
    }
    
    // Modal Imagen
    if (DOM.modal.closeBtn) DOM.modal.closeBtn.addEventListener('click', closeModal);
    if (DOM.modal.overlay) {
        DOM.modal.overlay.addEventListener('click', (e) => {
            if (e.target === DOM.modal.overlay) closeModal();
        });
    }
}

async function loadCatalogs() {
    let configs = null;
    const CACHE_KEY = 'public_configs_v1';
    const CACHE_TTL = 60 * 60 * 1000;
    
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TTL)) {
                configs = cachedObj.data;
            }
        }
    } catch (e) {
        console.warn("No caché local:", e);
    }
    
    const getValidData = (obj) => {
        if (!obj) return null;
        const candidate = obj.configuraciones || obj.data || obj;
        if (!candidate) return null;
        
        const tipos = candidate.tipos || candidate.tipo;
        const versiones = candidate.versiones || candidate.version;
        const generos = candidate.generos || candidate.genero;
        
        if (Array.isArray(tipos) && Array.isArray(versiones) && Array.isArray(generos)) {
            return { tipos, versiones, generos };
        }
        return null;
    };
    
    let validData = getValidData(configs);
    
    if (!validData) {
        const apiResponse = await get_configs();
        validData = getValidData(apiResponse);
        if (validData) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: apiResponse, timestamp: Date.now() }));
        }
    }
    
    if (validData) {
        populateSelects(DOM.filters.tipo, validData.tipos);
        populateSelects(DOM.filters.version, validData.versiones);
        populateSelects(DOM.filters.genero, validData.generos);
        populateSelects(DOM.mobileFilters.tipo, validData.tipos);
        populateSelects(DOM.mobileFilters.version, validData.versiones);
        populateSelects(DOM.mobileFilters.genero, validData.generos);
    }
}

function populateSelects(selectEl, items) {
    if (!selectEl) return;
    const currentVal = selectEl.value;
    selectEl.innerHTML = `<option value="">Todos los ${selectEl.id.includes('tipo') ? 'tipos' : selectEl.id.includes('version') ? 'versiones' : 'géneros'}</option>`;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        selectEl.appendChild(opt);
    });
    if (items.includes(currentVal)) selectEl.value = currentVal;
}

async function fetchInitialProducts() {
    renderSkeletons(8);
    const data = await search();
    if (data && data.status === 'success') {
        allProducts = Array.isArray(data.data) ? data.data : (data.productos || []);
        renderLocalProducts(allProducts);
    } else {
        DOM.grid.innerHTML = '';
        DOM.emptyState.classList.remove('hidden');
        DOM.resultsCount.textContent = '0';
    }
}

function handleFilterDesktop() {
    const filtros = {
        nombre: DOM.filters.nombre.value.trim(),
        tipo: DOM.filters.tipo.value,
        version: DOM.filters.version.value,
        genero: DOM.filters.genero.value
    };
    applyFilters(filtros);
}

function handleFilterMobile() {
    const filtros = {
        nombre: DOM.mobileFilters.searchInput.value.trim(),
        tipo: DOM.mobileFilters.tipo.value,
        version: DOM.mobileFilters.version.value,
        genero: DOM.mobileFilters.genero.value
    };
    DOM.filters.nombre.value = filtros.nombre;
    DOM.filters.tipo.value = filtros.tipo;
    DOM.filters.version.value = filtros.version;
    DOM.filters.genero.value = filtros.genero;
    
    applyFilters(filtros);
    
    // Cerrar panel en móviles
    DOM.mobileFilters.panel.classList.add('hidden');
    DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>';
    DOM.mobileFilters.btnToggle.classList.remove('bg-navy-50', 'text-navy-600', 'border-navy-200');
}

function applyFilters(filtros) {
    let filtered = allProducts;
    
    if (filtros.nombre) {
        const q = filtros.nombre.toLowerCase();
        filtered = filtered.filter(p => p.nombre.toLowerCase().includes(q));
    }
    if (filtros.tipo) filtered = filtered.filter(p => p.tipo === filtros.tipo);
    if (filtros.version) filtered = filtered.filter(p => p.version === filtros.version);
    if (filtros.genero) filtered = filtered.filter(p => p.genero === filtros.genero);
    
    renderLocalProducts(filtered);
}

function renderSkeletons(count = 6) {
    DOM.grid.innerHTML = '';
    DOM.emptyState.classList.add('hidden');
    DOM.resultsCount.textContent = '...';
    
    for (let i = 0; i < count; i++) {
        const clone = DOM.skeletonTemplate.content.cloneNode(true);
        DOM.grid.appendChild(clone);
    }
}

function renderLocalProducts(products) {
    DOM.grid.innerHTML = '';
    DOM.resultsCount.textContent = products.length;
    
    if (products.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    
    products.forEach(p => {
        const id = p.id || p.id_producto;
        const nombre = p.nombre || 'Sin nombre';
        const imgUrl = p.foto || p.imagen || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const genero = p.genero || '-';
        const tipo = p.tipo || '-';
        const version = p.version || '-';
        
        // Precio por defecto para catálogo público (Menudeo)
        const basePrice = parseFloat(p.precio_Menudeo || p.precio || 0);
        
        let stockTotal = 0;
        let tallasHtml = '';
        if (p.tallas && Array.isArray(p.tallas)) {
            p.tallas.forEach(t => {
                const stockVal = t.stock !== undefined ? t.stock : t.inventario;
                if (stockVal > 0) {
                    stockTotal += stockVal;
                    tallasHtml += `<span class="px-1.5 py-0.5 border border-gray-200 rounded text-[9px] sm:text-[10px] font-bold text-gray-600 bg-gray-50">${t.talla}</span>`;
                }
            });
        }
        
        const agotado = stockTotal === 0;
        
        const card = document.createElement('div');
        card.className = 'group bg-white rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full relative';
        
        card.innerHTML = `
            ${agotado ? '<div class="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Agotado</div>' : ''}
            <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-4 bg-gray-50 cursor-pointer" onclick="openImageModal('${imgUrl}')">
                <img src="${imgUrl}" alt="${nombre}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                    <div class="bg-white/90 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-gray-700">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                    </div>
                </div>
            </div>
            
            <div class="flex-grow flex flex-col">
                <h3 class="font-bold text-gray-900 text-sm sm:text-base leading-tight mb-2 line-clamp-2" title="${nombre}">${nombre}</h3>
                <div class="flex flex-wrap gap-1 sm:gap-1.5 mb-3">
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-navy-50 text-navy-700 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${genero}</span>
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${tipo}</span>
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${version}</span>
                </div>
                
                <div class="mb-4">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Tallas disponibles:</div>
                    <div class="flex flex-wrap gap-1">
                        ${tallasHtml || '<span class="text-xs text-red-500 font-medium">Ninguna</span>'}
                    </div>
                </div>
            </div>
        `;
        DOM.grid.appendChild(card);
    });
}

window.openImageModal = function(url) {
    if (!DOM.modal.overlay || !url) return;
    DOM.modal.img.src = url;
    DOM.modal.overlay.classList.remove('hidden');
    void DOM.modal.overlay.offsetWidth;
    DOM.modal.overlay.classList.remove('opacity-0');
    DOM.modal.img.classList.remove('scale-95');
    DOM.modal.img.classList.add('scale-100');
    document.body.style.overflow = 'hidden';
};

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
