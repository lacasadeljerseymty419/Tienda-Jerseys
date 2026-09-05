const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbwQaUeO9EnLQCZe5B6juTmRYoGKm443dGYPbpHcbeFpKbvXNYm0akhYoSLc1AM_mVNZ-g/exec";

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

// 🌟 YouTube Style Top Loading Bar Utility
let topLoadingTimer = null;
function startTopLoadingBar() {
    let bar = document.getElementById('yt-top-loading-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'yt-top-loading-bar';
        bar.className = 'fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 shadow-[0_0_12px_rgba(59,130,246,0.9)] z-[99999] pointer-events-none transition-all duration-300 opacity-0 w-0';
        document.body.appendChild(bar);
    }
    if (topLoadingTimer) clearInterval(topLoadingTimer);
    
    bar.style.transition = 'width 0.4s ease, opacity 0.2s ease';
    bar.style.opacity = '1';
    bar.style.width = '15%';
    
    let progress = 15;
    topLoadingTimer = setInterval(() => {
        if (progress < 85) {
            progress += Math.floor(Math.random() * 8) + 2;
            bar.style.width = progress + '%';
        }
    }, 250);
}

function finishTopLoadingBar() {
    let bar = document.getElementById('yt-top-loading-bar');
    if (!bar) return;
    if (topLoadingTimer) clearInterval(topLoadingTimer);
    
    bar.style.width = '100%';
    setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => {
            bar.style.width = '0%';
        }, 300);
    }, 200);
}

window.startTopLoadingBar = startTopLoadingBar;
window.finishTopLoadingBar = finishTopLoadingBar;

// Utilidades API
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
        
        // Listener de descarga en Modal
        const modalDownloadBtn = document.getElementById('modal-download-btn');
        if (modalDownloadBtn) {
            modalDownloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (DOM.modal.img && DOM.modal.img.src) {
                    downloadProductImage(DOM.modal.img.src, `jersey_imagen_${modalCurrentIndex + 1}`);
                }
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

function getOptimizedImageUrl(rawUrl, width = 400) {
    if (!rawUrl || typeof rawUrl !== 'string') return 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
    let url = rawUrl.trim();
    if (!url) return 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
    if (url.includes(',')) url = url.split(',')[0].trim();

    let driveId = '';
    const matchId = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
        driveId = matchId[1];
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`;
    }

    if (url.includes('googleusercontent.com')) {
        const clean = url.split('=')[0];
        return `${clean}=w${width}`;
    }

    if (url.includes('images.unsplash.com')) {
        if (url.includes('w=')) {
            return url.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, 'q=75');
        }
        return `${url}&w=${width}&q=75&auto=format`;
    }

    return url;
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
        
        const images = (p.foto || p.imagen || '').split(',').map(u => u.trim()).filter(Boolean);
        let currentImgIdx = 0;
        
        const rawImg = images[currentImgIdx] || 'https://images.unsplash.com/photo-1577212017184-807dd6acefd6?auto=format&fit=crop&q=80&w=400';
        const imgUrl = getOptimizedImageUrl(rawImg, 400);
        const genero = p.genero || '-';
        const tipo = p.tipo || '-';
        const version = p.version || '-';
        
        // Precio por defecto para catálogo público (Menudeo)
        const basePrice = parseFloat(p.precio_Menudeo || p.precio_menudeo || p.precio || 0);
        
        let stockTotal = 0;
        let tallasHtml = '';
        if (p.tallas && Array.isArray(p.tallas)) {
            p.tallas.forEach(t => {
                const stockVal = t.stock !== undefined ? t.stock : t.inventario;
                if (stockVal > 0) {
                    stockTotal += stockVal;
                    const displayTalla = String(t.talla || '');
                    let shortLabel = displayTalla;
                    if (displayTalla.includes('(')) {
                        const parts = displayTalla.split('(');
                        const numPart = parts[0].trim();
                        const detailPart = parts[1].replace(')', '').trim();
                        const ageMatch = detailPart.match(/(\d+)\s*(?:a|-)\s*(\d+)/i);
                        if (ageMatch && numPart) {
                            shortLabel = `${numPart} (${ageMatch[1]}-${ageMatch[2]}A)`;
                        } else {
                            const cleanDetail = detailPart.replace(/años|año|anios|anio/gi, 'A').trim();
                            shortLabel = `${numPart} (${cleanDetail})`;
                        }
                    }
                    tallasHtml += `<span class="px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap" title="${displayTalla}">${shortLabel}</span>`;
                }
            });
        }
        
        const agotado = stockTotal === 0;
        
        const card = document.createElement('div');
        card.className = 'group bg-white rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full relative';
        
        let carouselControlsHtml = '';
        if (images.length > 1) {
            carouselControlsHtml = `
                <button type="button" class="carousel-prev-btn absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button type="button" class="carousel-next-btn absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-white z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    ${images.map((_, i) => `<span class="carousel-dot w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/40'} transition-all duration-300" data-idx="${i}"></span>`).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            ${agotado ? '<div class="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Agotado</div>' : ''}
            <div class="product-image-container relative w-full aspect-square rounded-xl overflow-hidden mb-4 bg-gray-50 cursor-pointer">
                <img src="${imgUrl}" alt="${nombre}" class="product-card-img w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                    <div class="bg-white/90 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-gray-700">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                    </div>
                </div>
                ${carouselControlsHtml}
            </div>
            
            <div class="flex-grow flex flex-col">
                <h3 class="font-bold text-gray-900 text-sm sm:text-base leading-tight mb-2 line-clamp-2" title="${nombre}">${nombre}</h3>
                <div class="flex flex-wrap gap-1 sm:gap-1.5 mb-3">
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-navy-50 text-navy-700 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${genero}</span>
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${tipo}</span>
                    <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">${version}</span>
                </div>
                
                <div class="mb-3">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Tallas disponibles:</div>
                    <div class="flex flex-wrap gap-1">
                        ${tallasHtml || '<span class="text-xs text-red-500 font-medium">Ninguna</span>'}
                    </div>
                </div>

                <!-- Footer del Card con Botón Sutil de Descargar Imagen -->
                <div class="flex items-center justify-end pt-1.5 border-t border-gray-100 mt-auto">
                    <button type="button" class="btn-download-card-img p-1.5 text-gray-400 hover:text-navy-600 hover:bg-navy-50 rounded-lg transition-all duration-200 cursor-pointer active:scale-95 flex items-center gap-1 text-[11px] font-semibold" title="Descargar foto del jersey">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        <span class="text-[10px]">Descargar</span>
                    </button>
                </div>
            </div>
        `;
        
        const imgEl = card.querySelector('.product-card-img');
        const dots = card.querySelectorAll('.carousel-dot');
        
        const updateImage = (newIdx) => {
            currentImgIdx = newIdx;
            imgEl.src = getOptimizedImageUrl(images[currentImgIdx], 400);
            dots.forEach((dot, idx) => {
                if (idx === currentImgIdx) {
                    dot.className = 'carousel-dot w-1.5 h-1.5 rounded-full bg-white transition-all duration-300';
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

        // Listener del Botón de Descargar Imagen
        const downloadBtn = card.querySelector('.btn-download-card-img');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const activeUrl = (images && images[currentImgIdx]) ? images[currentImgIdx] : imgUrl;
                downloadProductImage(activeUrl, `${nombre}_foto${currentImgIdx + 1}`);
            });
        }
        
        DOM.grid.appendChild(card);
    });
}

// Función para descargar imagen
async function downloadProductImage(url, fileName = 'jersey') {
    if (!url) return;
    const safeName = String(fileName || 'jersey').replace(/[^a-z0-9_-]/gi, '_');

    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Fetch status ' + response.status);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeName}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (e) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `${safeName}.jpg`;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
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
        
        // Limpiar variables del carrusel del modal
        modalImages = [];
        modalCurrentIndex = 0;
    }, 300);
}
