(function() {
    'use strict';

    const CONFIG = {
        enableLibra: true,
        enableDuplicados: true,
        debug: false
    };

    let runCount = { libra: 0, duplicados: 0 };
    let notified = { libra: false, duplicados: false };
    const MAX_RUNS = 2;

    function log(message, ...args) {
        if (CONFIG.debug) console.log(`[MoguDebug] ${message}`, ...args);
    }

    function getPageType() {
        const path = window.location.pathname;
        const url = window.location.href;
        
        if (url.includes('/ShoppingCart')) return 'cart';
        if (path.includes('/Stock/Stock')) return 'stock';
        if (path.includes('/Offers')) return 'offers';
        if (path.includes('/Wants')) return 'wants';
        return 'unknown';
    }

    function parsePrice(priceStr) {
        if (!priceStr) return Infinity;
        const cleaned = priceStr.replace(/[^\d,.]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (isNaN(num)) return Infinity;
        log(`Price parsed: "${priceStr}" -> ${num}`);
        return num;
    }

    function cleanCardName(name) {
        return name.replace(/\s*\(V\.\d+\)\s*/g, '').trim();
    }

    function getCardDataFromRow(row) {
        let nameEl = row.querySelector('.article-name, .product-name, .seller-name');
        
        if (!nameEl) {
            const links = row.querySelectorAll('a');
            for (const link of links) {
                const href = link.getAttribute('href') || '';
                if (href.includes('/Products/') || href.includes('/Singles/')) {
                    nameEl = link;
                    break;
                }
            }
        }
        
        const priceEl = row.querySelector('[class*="price"]');
        
        let expansionEl = null;
        const allLinks = row.querySelectorAll('a');
        for (const link of allLinks) {
            const href = link.getAttribute('href') || '';
            if (href.includes('/Expansions/') || href.includes('/Set/') || href.includes('/Expansion') || href.includes('/Set/')) {
                expansionEl = link;
                break;
            }
        }
        
        // También buscar por texto en la fila
        if (!expansionEl) {
            const expansionTexts = row.querySelectorAll('td, span, div');
            for (const el of expansionTexts) {
                const text = el.textContent.trim();
                // Buscar nombres de expansiones comunes o patrones como " setname "
                if (text && text.length > 2 && text.length < 50 && !text.includes('€') && !text.includes(' condition')) {
                    const lower = text.toLowerCase();
                    if (lower.includes('edition') || lower.includes('set') || lower.includes('booster') || lower.includes('core') || lower.includes('preview') || lower.includes('starter')) {
                        expansionEl = el;
                        break;
                    }
                }
            }
        }
        
        if (!expansionEl) {
            expansionEl = row.querySelector('[class*="expansion"], [class*="set"], [class*="Expansion"]');
        }

        const conditionEl = row.querySelector('.article-condition, [class*="condition"]');
        const conditionText = conditionEl ? conditionEl.textContent.trim() : 'Unknown';
        
        const isFoil = row.querySelector('[class*="foil"], .foil, [data-bs-original-title*="Foil"], [title*="Foil"]') !== null;
        
        let isSpanish = false;
        let isEnglish = false;
        const langElements = row.querySelectorAll('[data-bs-original-title], [title]');
        langElements.forEach(el => {
            const title = el.getAttribute('data-bs-original-title') || el.getAttribute('title') || '';
            if (title.toLowerCase().includes('español')) {
                isSpanish = true;
            }
            if (title.toLowerCase().includes('inglés') || title.toLowerCase().includes('english')) {
                isEnglish = true;
            }
        });

        if (!nameEl) return null;

        const rowId = row.getAttribute('id') || '';
        const articleId = rowId.replace('articleRow', '');
        
        log(`Row ID: ${rowId}, articleId: "${articleId}"`);
        
        return {
            name: nameEl.textContent.trim(),
            expansion: expansionEl ? expansionEl.textContent.trim() : 'Unknown',
            price: parsePrice(priceEl ? priceEl.textContent : ''),
            condition: conditionText,
            isFoil: isFoil,
            isSpanish: isSpanish,
            articleId: articleId,
            row: row
        };
    }

    const CONDITION_RANK = {
        'NM': 4,
        'Near Mint': 4,
        'EX': 3,
        'Excellent': 3,
        'GD': 2,
        'Good': 2,
        'LP': 1,
        'Lightly Played': 1,
        'MP': 0,
        'Moderately Played': 0,
        'HP': -1,
        'Heavily Played': -1,
        'DM': -2,
        'Damaged': -2
    };

    function getConditionRank(condition) {
        const upper = condition.toUpperCase();
        for (const [key, value] of Object.entries(CONDITION_RANK)) {
            if (upper.includes(key)) return value;
        }
        return -1;
    }

    function compareCards(a, b) {
        const priceDiff = a.price - b.price;
        if (Math.abs(priceDiff) > 0.001) return priceDiff;
        
        const condA = getConditionRank(a.condition);
        const condB = getConditionRank(b.condition);
        if (condA !== condB) return condB - condA;
        
        if (a.isFoil !== b.isFoil) return a.isFoil ? 1 : -1;
        
        if (a.isSpanish !== b.isSpanish) return a.isSpanish ? 1 : -1;
        
        return 0;
    }

    function showNotification(title, message) {
        const existing = document.querySelector('.dc-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = 'dc-notification';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'dc-notification-title';
        titleDiv.textContent = title;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'dc-notification-message';
        msgDiv.textContent = message;
        
        notif.appendChild(titleDiv);
        notif.appendChild(msgDiv);
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.remove();
        }, 4000);
    }

    let inCartArticles = [];

    function syncCartWithCurrentPage(callback) {
        log('syncCartWithCurrentPage iniciado');
        const rows = document.querySelectorAll('.article-row');
        
        // Obtener keys de cartas en la página actual (nombre + expansión)
        const currentCardKeys = [];
        rows.forEach(row => {
            const card = getCardDataFromRow(row);
            if (card && card.name) {
                const key = cleanCardName(card.name) + '|' + card.expansion;
                currentCardKeys.push(key);
            }
        });
        log('Cartas en página actual:', currentCardKeys.join(', '));

        chrome.storage.local.get(['dc_cart_cards'], function(result) {
            const savedCards = result.dc_cart_cards || [];
            log('Cartas guardadas en storage:', savedCards.join(', '));
            
            if (savedCards.length === 0) {
                log('No hay artículos guardados en storage');
                if (callback) callback();
                return;
            }

            // Filtrar solo las cartas que siguen disponibles en la página
            const validCards = savedCards.filter(cardKey => currentCardKeys.includes(cardKey));
            const removedCards = savedCards.filter(cardKey => !currentCardKeys.includes(cardKey));

            if (removedCards.length > 0) {
                log(`Cartas ya no disponibles (eliminadas del storage): ${removedCards.join(', ')}`);
            }

            if (validCards.length === 0 && savedCards.length > 0 && currentCardKeys.length > 0) {
                log('Carrito vaciado o todos los artículos comprados, limpiando storage');
                chrome.storage.local.set({ dc_cart_cards: [] });
                inCartArticles = [];
            } else if (validCards.length !== savedCards.length) {
                log(`Sincronizando: ${savedCards.length} -> ${validCards.length} artículos`);
                chrome.storage.local.set({ dc_cart_cards: validCards });
                inCartArticles = validCards;
            } else {
                log('Storage ya está sincronizado');
                inCartArticles = validCards;
            }
            
            if (callback) callback();
        });
    }

    function runLibra() {
        if (runCount.libra >= MAX_RUNS) return;
        runCount.libra++;
        
        log(`Libra (${runCount.libra}/${MAX_RUNS})...`);
        
        const rows = document.querySelectorAll('.article-row');
        if (rows.length === 0) return;
        
        // Limpiar clases anteriores
        rows.forEach(row => {
            row.classList.remove('dc-cheapest', 'dc-other', 'dc-in-cart');
        });
        
        chrome.storage.local.get(['dc_cart_cards'], function(result) {
            inCartArticles = result.dc_cart_cards || [];
            log(`Cartas en carrito (storage): ${inCartArticles.join(', ')}`);
            
            const cards = [];
            rows.forEach(row => {
                const card = getCardDataFromRow(row);
                if (card && card.name && card.price !== Infinity) {
                    const cardKey = cleanCardName(card.name) + '|' + card.expansion;
                    card.inCart = inCartArticles.includes(cardKey);
                    cards.push(card);
                }
            });

            if (cards.length === 0) return;
            
            const grouped = {};
            cards.forEach(card => {
                const baseName = cleanCardName(card.name);
                const key = `${baseName}|${card.expansion}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(card);
            });
            
            let marked = 0;
            
            Object.values(grouped).forEach(group => {
                const notInCart = group.filter(c => !c.inCart);
                const inCart = group.filter(c => c.inCart);
                
                if (notInCart.length > 1) {
                    const sorted = [...notInCart].sort(compareCards);
                    const best = sorted[0];
                    
                    notInCart.forEach(card => {
                        if (card === best) {
                            card.row.classList.add('dc-cheapest');
                            marked++;
                        } else {
                            card.row.classList.add('dc-other');
                        }
                    });
                }
                
                inCart.forEach(card => {
                    card.row.classList.add('dc-in-cart');
                });
            });

            log(`Libra: ${marked} marcadas`);
            
            if (marked > 0 && !notified.libra) {
                notified.libra = true;
                showNotification('🔮 Magia Libra', `${marked} carta(s) más barata(s) encontrada(s)`);
            }
        });
    }

    function runDuplicados() {
        if (runCount.duplicados >= MAX_RUNS) return;
        runCount.duplicados++;
        
        log(`Magia Doble (${runCount.duplicados}/${MAX_RUNS})...`);
        
        // En el carrito, usar selector específico
        const items = document.querySelectorAll('tr[data-article-id]');
        log(`Encontrados ${items.length} artículos`);
        
        if (items.length === 0) return;
        
        // Limpiar clases anteriores
        items.forEach(item => {
            item.classList.remove('dc-duplicate');
        });
        document.querySelectorAll('.dc-badge-doble').forEach(el => el.remove());
        
        const cartCards = [];
        items.forEach(item => {
            // Ignorar elementos ocultos
            if (item.offsetParent === null) return;
            
            const name = item.getAttribute('data-name');
            const expansion = item.getAttribute('data-expansion-name');
            const price = parseFloat(item.getAttribute('data-price')) || Infinity;
            
            if (name && price !== Infinity) {
                cartCards.push({
                    name: name,
                    expansion: expansion || 'Unknown',
                    price: price,
                    row: item
                });
            }
        });

        log(`Cartas procesadas: ${cartCards.length}`);

        const grouped = {};
        cartCards.forEach(card => {
            const key = cleanCardName(card.name) + '|' + card.expansion;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(card);
        });

        let duplicatesFound = 0;
        Object.values(grouped).forEach(group => {
            if (group.length > 1) {
                // Ordenar por precio
                const sorted = [...group].sort((a, b) => a.price - b.price);
                const cheapest = sorted[0];
                
                // Marcar los más caros que el más barato
                group.forEach(card => {
                    if (card.price > cheapest.price) {
                        card.row.classList.add('dc-duplicate');
                        duplicatesFound++;
                        
                        const badge = document.createElement('span');
                        badge.className = 'dc-badge-doble';
                        badge.textContent = '💰 Más caro, ¡kupó!';
                        
                        // Buscar el precio en el carrito
                        const priceEl = card.row.querySelector('td.price, .price');
                        if (priceEl) {
                            priceEl.insertBefore(badge, priceEl.firstChild);
                        }
                    }
                });
            }
        });

        log(`Magia Doble: ${duplicatesFound} encontrados`);
        
        if (duplicatesFound > 0 && !notified.duplicados) {
            notified.duplicados = true;
            showNotification('⚠️ Magia Doble', `${duplicatesFound} carta(s) más cara(s) encontrada(s)`);
        }
    }

    function init() {
        const pageType = getPageType();
        log(`Página: ${pageType}`);

        chrome.storage.local.get(['dc_settings'], function(result) {
            log('Cargando configuración...');
            if (result.dc_settings) {
                CONFIG.enableLibra = result.dc_settings.libra;
                CONFIG.enableDuplicados = result.dc_settings.duplicados;
                log(`Config: enableLibra=${CONFIG.enableLibra}, enableDuplicados=${CONFIG.enableDuplicados}`);
            }
            
            if (['stock', 'offers', 'wants'].includes(pageType) && CONFIG.enableLibra) {
                syncCartWithCurrentPage(function() {
                    log('Sync completado, ejecutando runLibra...');
                    runLibra();
                    setTimeout(runLibra, 3000);
                });
            }
            if (pageType === 'cart' && CONFIG.enableDuplicados) {
                runDuplicados();
                setTimeout(runDuplicados, 3000);
            }
            
            observePageChanges(pageType);
        });
    }
    
    let mutationCount = { libra: 0, duplicados: 0 };
    const MAX_MUTATIONS = 3;
    let hasRunInitial = false;
    let currentPageType = null;
    
    function observePageChanges(pageType) {
        currentPageType = pageType;
        let debounceTimer = null;
        
        const runWithCheck = () => {
            if (['stock', 'offers', 'wants'].includes(pageType)) {
                if (mutationCount.libra < MAX_MUTATIONS || !hasRunInitial) {
                    runLibra();
                    mutationCount.libra++;
                    hasRunInitial = true;
                }
            }
            if (pageType === 'cart') {
                if (mutationCount.duplicados < MAX_MUTATIONS || !hasRunInitial) {
                    runDuplicados();
                    mutationCount.duplicados++;
                    hasRunInitial = true;
                }
            }
        };
        
        document.addEventListener('click', (e) => {
            // Detectar botón de eliminar en el carrito
            const deleteBtn = e.target.closest('.fonticon-delete');
            if (deleteBtn && pageType === 'cart') {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    runCount.duplicados = 0;
                    runDuplicados();
                }, 1500);
                return;
            }
            
            const btn = e.target.closest('button[type="submit"]');
            const isCartBtn = btn && btn.querySelector('.fonticon-cart');
            
            if (isCartBtn) {
                const form = btn.closest('form');
                if (form) {
                    const input = form.querySelector('input[name^="idArticle["]');
                    if (input) {
                        const articleId = input.name.match(/idArticle\[(\d+)\]/)[1];
                        // Buscar el row para obtener nombre y expansión
                        const row = document.getElementById('articleRow' + articleId);
                        if (row) {
                            addToCartArticles(row);
                        }
                        // Recalcular ofertas con el nuevo artículo en carrito
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            runCount.libra = 0; // Resetear contador para permitir recalcular
                            runLibra();
                        }, 1500);
                        return;
                    }
                }
            }
        });
        
        const cartObserver = new MutationObserver(() => {
            const cartBadge = document.querySelector('#cart .badge');
            const cartPrice = document.querySelector('#cart .text-success');
            if (cartBadge || cartPrice) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (['stock', 'offers', 'wants'].includes(pageType)) {
                        runCount.libra = 0;
                        runLibra();
                    }
                    if (pageType === 'cart') {
                        runCount.duplicados = 0;
                        runDuplicados();
                    }
                }, 2000);
            }
        });
        cartObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
        
        window.addEventListener('popstate', () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                mutationCount = { libra: 0, duplicados: 0 };
                hasRunInitial = false;
                currentPageType = getPageType();
                if (['stock', 'offers', 'wants'].includes(currentPageType)) {
                    runLibra();
                    setTimeout(runLibra, 2000);
                }
                if (currentPageType === 'cart') {
                    runDuplicados();
                    setTimeout(runDuplicados, 2000);
                }
            }, 1500);
        });
    }
    
    function clearPreviousMarks() {
        document.querySelectorAll('.dc-cheapest, .dc-other, .dc-in-cart, .dc-duplicate').forEach(el => {
            el.classList.remove('dc-cheapest', 'dc-other', 'dc-in-cart', 'dc-duplicate');
        });
        document.querySelectorAll('.dc-badge, .dc-badge-doble').forEach(el => el.remove());
    }

    function addToCartArticles(row) {
        const card = getCardDataFromRow(row);
        if (!card || !card.name) return;
        
        const cardKey = cleanCardName(card.name) + '|' + card.expansion;
        
        chrome.storage.local.get(['dc_cart_cards'], function(result) {
            const cards = result.dc_cart_cards || [];
            if (!cards.includes(cardKey)) {
                cards.push(cardKey);
                chrome.storage.local.set({ dc_cart_cards: cards });
                log(`Añadido al carrito: ${cardKey}`);
            }
        });
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateSettings') {
            CONFIG.enableLibra = request.settings.libra;
            CONFIG.enableDuplicados = request.settings.duplicados;
            runCount = { libra: 0, duplicados: 0 };
            notified = { libra: false, duplicados: false };
            
            document.querySelectorAll('.dc-cheapest, .dc-other, .dc-duplicate').forEach(el => {
                el.classList.remove('dc-cheapest', 'dc-other', 'dc-duplicate');
            });
            document.querySelectorAll('.dc-badge').forEach(el => el.remove());
            
            const pageType = getPageType();
            setTimeout(() => {
                if (pageType === 'stock' && CONFIG.enableLibra) runLibra();
                if (pageType === 'cart' && CONFIG.enableDuplicados) runDuplicados();
            }, 1000);
            
            sendResponse({ success: true });
        }
        return true;
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
