const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbw97tnD6AOYXNkttgCnQRtg2WpikVw_cXdIYnKdc3lFIdeQ8PrbL1RRGdqMM7KD82ucQg/exec";

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

let allProducts419 = [];

// Normalización Unicode e insensibilidad a acentos/caracteres especiales
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

function matchText(fullText, query) {
    if (!query) return true;
    const normQuery = normalizeText(query);
    if (!normQuery) return true;
    const normTarget = normalizeText(fullText);
    const terms = normQuery.split(' ').filter(Boolean);
    return terms.every(term => normTarget.includes(term));
}

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

let currentNavCategory = 'todos';

// Inicialización
document.addEventListener('DOMContentLoaded', initTienda);

async function initTienda() {
    renderSkeletons(8);
    initCategoryNav();
    await loadCatalogs();
    await fetchInitialProducts419();
    
    // Listeners para auto-aplicar filtros (Desktop)
    if (DOM.btnAplicar) DOM.btnAplicar.addEventListener('click', handleFilterDesktop);
    if (DOM.filters.nombre) DOM.filters.nombre.addEventListener('input', handleFilterDesktop);
    if (DOM.filters.tipo) DOM.filters.tipo.addEventListener('change', handleFilterDesktop);
    if (DOM.filters.version) DOM.filters.version.addEventListener('change', handleFilterDesktop);
    if (DOM.filters.genero) DOM.filters.genero.addEventListener('change', handleFilterDesktop);
    
    // Listeners para auto-aplicar filtros (Mobile)
    if (DOM.btnAplicarMobile) DOM.btnAplicarMobile.addEventListener('click', handleFilterMobile);
    if (DOM.mobileFilters.searchInput) DOM.mobileFilters.searchInput.addEventListener('input', handleFilterMobile);
    if (DOM.mobileFilters.tipo) DOM.mobileFilters.tipo.addEventListener('change', handleFilterMobile);
    if (DOM.mobileFilters.version) DOM.mobileFilters.version.addEventListener('change', handleFilterMobile);
    if (DOM.mobileFilters.genero) DOM.mobileFilters.genero.addEventListener('change', handleFilterMobile);

    if (DOM.mobileFilters.btnToggle) {
        DOM.mobileFilters.btnToggle.addEventListener('click', () => {
            const panel = DOM.mobileFilters.panel;
            if (!panel) return;
            panel.classList.toggle('hidden');
            if (panel.classList.contains('hidden')) {
                DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>';
                DOM.mobileFilters.btnToggle.classList.remove('bg-blue-500/20', 'text-blue-400', 'border-blue-500/40');
            } else {
                DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
                DOM.mobileFilters.btnToggle.classList.add('bg-blue-500/20', 'text-blue-400', 'border-blue-500/40');
            }
        });
    }
    
    // Modal Visor de Imagen
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
}

function initCategoryNav() {
    const btnTodos = document.getElementById('nav-cat-todos');
    const btnPlayeras = document.getElementById('nav-cat-playeras');
    const btnArticulos = document.getElementById('nav-cat-articulos');

    if (btnTodos) btnTodos.addEventListener('click', () => setNavCategory('todos'));
    if (btnPlayeras) btnPlayeras.addEventListener('click', () => setNavCategory('playeras'));
    if (btnArticulos) btnArticulos.addEventListener('click', () => setNavCategory('articulos'));
}

function resetSearchFilters() {
    if (DOM.filters.nombre) DOM.filters.nombre.value = '';
    if (DOM.filters.tipo) DOM.filters.tipo.value = '';
    if (DOM.filters.version) DOM.filters.version.value = '';
    if (DOM.filters.genero) DOM.filters.genero.value = '';

    if (DOM.mobileFilters.searchInput) DOM.mobileFilters.searchInput.value = '';
    if (DOM.mobileFilters.tipo) DOM.mobileFilters.tipo.value = '';
    if (DOM.mobileFilters.version) DOM.mobileFilters.version.value = '';
    if (DOM.mobileFilters.genero) DOM.mobileFilters.genero.value = '';
}

function setNavCategory(category) {
    currentNavCategory = category;
    resetSearchFilters();

    const btnTodos = document.getElementById('nav-cat-todos');
    const btnPlayeras = document.getElementById('nav-cat-playeras');
    const btnArticulos = document.getElementById('nav-cat-articulos');

    const activeClasses = ['bg-blue-600', 'text-white', 'border-blue-500', 'shadow-md'];
    const inactiveClasses = ['bg-[#18181b]', 'hover:bg-white/10', 'text-gray-300', 'hover:text-white', 'border-white/10'];

    const updateBtn = (btn, isActive) => {
        if (!btn) return;
        if (isActive) {
            btn.classList.remove(...inactiveClasses);
            btn.classList.add(...activeClasses);
            const svg = btn.querySelector('svg');
            if (svg) svg.classList.remove('text-blue-400');
        } else {
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
            const svg = btn.querySelector('svg');
            if (svg && btn !== btnTodos) svg.classList.add('text-blue-400');
        }
    };

    updateBtn(btnTodos, category === 'todos');
    updateBtn(btnPlayeras, category === 'playeras');
    updateBtn(btnArticulos, category === 'articulos');

    handleFilterDesktop();
}

async function loadCatalogs() {
    let configs = null;
    const CACHE_KEY = 'tienda419_configs_v1';
    const CACHE_TTL = 60 * 60 * 1000;
    
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cachedObj = JSON.parse(cachedStr);
            if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TTL)) {
                configs = cachedObj.data;
            }
        }
    } catch (e) {}
    
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
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: apiResponse, timestamp: Date.now() }));
            } catch (e) {}
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

async function fetchInitialProducts419() {
    renderSkeletons(8);
    
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
        renderLocalProducts(allProducts419);
    } catch (err) {
        console.error("Error al cargar inventario:", err);
        DOM.grid.innerHTML = '';
        DOM.emptyState.classList.remove('hidden');
        DOM.resultsCount.textContent = '0';
    }
}

function handleFilterDesktop() {
    const filtros = {
        nombre: DOM.filters.nombre ? DOM.filters.nombre.value : '',
        tipo: DOM.filters.tipo ? DOM.filters.tipo.value : '',
        version: DOM.filters.version ? DOM.filters.version.value : '',
        genero: DOM.filters.genero ? DOM.filters.genero.value : ''
    };
    applyFilters(filtros);
}

function handleFilterMobile() {
    const filtros = {
        nombre: DOM.mobileFilters.searchInput ? DOM.mobileFilters.searchInput.value : '',
        tipo: DOM.mobileFilters.tipo ? DOM.mobileFilters.tipo.value : '',
        version: DOM.mobileFilters.version ? DOM.mobileFilters.version.value : '',
        genero: DOM.mobileFilters.genero ? DOM.mobileFilters.genero.value : ''
    };
    if (DOM.filters.nombre) DOM.filters.nombre.value = filtros.nombre;
    if (DOM.filters.tipo) DOM.filters.tipo.value = filtros.tipo;
    if (DOM.filters.version) DOM.filters.version.value = filtros.version;
    if (DOM.filters.genero) DOM.filters.genero.value = filtros.genero;
    
    applyFilters(filtros);
    
    // Cerrar panel en móviles
    if (DOM.mobileFilters.panel) DOM.mobileFilters.panel.classList.add('hidden');
    if (DOM.mobileFilters.btnToggle) {
        DOM.mobileFilters.iconToggle.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>';
        DOM.mobileFilters.btnToggle.classList.remove('bg-amber-500/20', 'text-amber-400', 'border-amber-500/40');
    }
}

function applyFilters(filtros) {
    let filtered = allProducts419;
    
    if (currentNavCategory === 'playeras') {
        filtered = filtered.filter(p => !p.es_articulo);
    } else if (currentNavCategory === 'articulos') {
        filtered = filtered.filter(p => p.es_articulo);
    }
    
    if (filtros.nombre) {
        filtered = filtered.filter(p => {
            const targetText = `${p.nombre || ''} ${p.equipo || ''} ${p.tipo || ''} ${p.version || ''} ${p.genero || ''} ${p.id || p.id_producto || ''}`;
            return matchText(targetText, filtros.nombre);
        });
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
    DOM.resultsCount.textContent = products ? products.length : 0;
    
    if (!products || products.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    
    products.forEach(p => {
        const id = p.id || p.id_producto || p.id_articulo;
        const nombre = p.nombre || p.equipo || 'Sin nombre';
        
        const images = (p.foto || p.imagen || '').split(',').map(u => u.trim()).filter(Boolean);
        let currentImgIdx = 0;
        
        const imgUrl = images[currentImgIdx] || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const genero = (p.genero || '-').toUpperCase();
        const tipo = (p.tipo || '-').toUpperCase();
        const version = (p.version || '-').toUpperCase();
        
        // 🌟 Resolución inteligente de precios (Menudeo prioritario)
        const precioVal = parseFloat(p.precio_menudeo || p.precio_Menudeo || p.precio || p.precio_mayoreo || 0);
        const precioDisplay = precioVal > 0 ? `$${precioVal.toFixed(2)}` : 'Consultar';
        
        let stockTotal419 = 0;
        let tallasHtml = '';
        
        if (p.tallas && Array.isArray(p.tallas)) {
            p.tallas.forEach(t => {
                const stockVal = Number(t.stock !== undefined ? t.stock : (t.inventario || 0));
                const sz = (t.talla || '').toUpperCase();
                if (stockVal > 0) {
                    stockTotal419 += stockVal;
                    tallasHtml += `
                        <span class="px-2 py-0.5 border border-blue-500/30 rounded-md text-[10px] font-extrabold text-blue-400 bg-blue-500/10 shadow-sm">
                            ${sz}
                        </span>`;
                }
            });
        }
        
        const agotado = stockTotal419 === 0;
        
        const card = document.createElement('div');
        card.className = 'group bg-[#18181b] rounded-2xl p-3.5 sm:p-4 border border-white/10 hover:border-blue-500/40 shadow-xl transition-all duration-300 flex flex-col h-full relative';
        
        let carouselControlsHtml = '';
        if (images.length > 1) {
            carouselControlsHtml = `
                <button type="button" class="carousel-prev-btn absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-black/70 hover:bg-black backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button type="button" class="carousel-next-btn absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-black/70 hover:bg-black backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-30 bg-black/60 backdrop-blur-xs px-2 py-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    ${images.map((_, i) => `<span class="carousel-dot w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-blue-400' : 'bg-white/40'} transition-all duration-300" data-idx="${i}"></span>`).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            <!-- Badge de Estado -->
            <div class="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col items-end gap-1">
                ${agotado 
                    ? '<span class="bg-red-500/90 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md backdrop-blur-xs">Agotado</span>' 
                    : '<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md backdrop-blur-xs">Disponible</span>'
                }
            </div>

            <!-- Imagen del Producto con Carrusel -->
            <div class="product-image-container relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[#09090b] border border-white/5 cursor-pointer">
                <img src="${imgUrl}" alt="${nombre}" class="product-card-img w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                    <div class="bg-black/60 backdrop-blur-md rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg text-white">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                    </div>
                </div>
                ${carouselControlsHtml}
            </div>
            
            <div class="flex-grow flex flex-col">
                <!-- Título del Producto -->
                <h3 class="font-bold text-white text-sm sm:text-base leading-snug mb-2 line-clamp-2 uppercase" title="${nombre}">${nombre}</h3>
                
                <!-- Insignias de detalles -->
                <div class="flex flex-wrap gap-1.5 mb-3">
                    <span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px] font-bold tracking-wider uppercase border border-white/10">${genero}</span>
                    <span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px] font-bold tracking-wider uppercase border border-white/10">${tipo}</span>
                    <span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px] font-bold tracking-wider uppercase border border-white/10">${version}</span>
                </div>
                
                <!-- Módulo Destacado de Precio -->
                <div class="bg-[#09090b] rounded-xl px-3 py-2 border border-white/10 flex items-center justify-between mb-3.5">
                    <span class="text-xs text-gray-400 font-medium">Precio:</span>
                    <span class="text-base sm:text-lg font-extrabold text-blue-400 font-mono">${precioDisplay}</span>
                </div>

                <!-- Tallas en Existencia -->
                <div class="mt-auto pt-3 border-t border-white/5">
                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                        <span>Tallas disponibles:</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        ${tallasHtml || '<span class="text-xs text-red-400 font-medium">Sin existencia</span>'}
                    </div>
                </div>
            </div>
        `;
        
        const imgEl = card.querySelector('.product-card-img');
        const dots = card.querySelectorAll('.carousel-dot');
        
        const updateImage = (newIdx) => {
            currentImgIdx = newIdx;
            imgEl.src = images[currentImgIdx];
            dots.forEach((dot, idx) => {
                if (idx === currentImgIdx) {
                    dot.className = 'carousel-dot w-1.5 h-1.5 rounded-full bg-blue-400 transition-all duration-300';
                } else {
                    dot.className = 'carousel-dot w-1.5 h-1.5 rounded-full bg-white/40 transition-all duration-300';
                }
            });
        };
        
        const prevBtn = card.querySelector('.carousel-prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIdx = (currentImgIdx - 1 + images.length) % images.length;
                updateImage(newIdx);
            });
        }
        
        const nextBtn = card.querySelector('.carousel-next-btn');
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
        
        const imgContainer = card.querySelector('.product-image-container');
        if (imgContainer) {
            imgContainer.addEventListener('click', (e) => {
                if (e.target.closest('.carousel-prev-btn') || e.target.closest('.carousel-next-btn') || e.target.closest('.carousel-dot')) {
                    return;
                }
                openImageModal(images[currentImgIdx], images, currentImgIdx);
            });
        }
        
        DOM.grid.appendChild(card);
    });
}

let modalImages = [];
let modalCurrentIndex = 0;

window.openImageModal = function(url, imagesArray = [], currentIndex = 0) {
    if (!DOM.modal.overlay || !url) return;
    DOM.modal.img.src = url;
    DOM.modal.overlay.classList.remove('hidden');
    void DOM.modal.overlay.offsetWidth;
    DOM.modal.overlay.classList.remove('opacity-0');
    DOM.modal.img.classList.remove('scale-95');
    DOM.modal.img.classList.add('scale-100');
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
        
        modalImages = [];
        modalCurrentIndex = 0;
    }, 300);
}
