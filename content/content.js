(function() {
    'use strict';

    const CONFIG = {
        enableLibra: true,
        enableDuplicados: true,
        enableEspejo: true,
        debug: false
    };

    let runCount = { libra: 0, duplicados: 0, listaCartas: 0 };
    let notified = { libra: false, duplicados: false, listaCartas: false };
    const MAX_RUNS = 2;
    let cardList = [];

    function log(message, ...args) {
        if (CONFIG.debug) console.log(`[MoguDebug] ${message}`, ...args);
    }

    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (areaName === 'local' && changes.dc_settings) {
            const newSettings = changes.dc_settings.newValue;
            CONFIG.enableLibra = newSettings.libra;
            CONFIG.enableDuplicados = newSettings.duplicados;
            CONFIG.enableEspejo = newSettings.espejo !== undefined ? newSettings.espejo : true;
            log(`Config actualizada: enableLibra=${CONFIG.enableLibra}, enableDuplicados=${CONFIG.enableDuplicados}, enableEspejo=${CONFIG.enableEspejo}`);
            
            runCount = { libra: 0, duplicados: 0, listaCartas: 0 };
            
            const pageType = getPageType();
            if (['stock', 'offers', 'wants'].includes(pageType)) {
                runListaCartas();
            }
        }
    });

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
        if (!name || typeof name !== 'string') return '';
        // Eliminar todo entre paréntesis incluyendo los paréntesis
        return name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function insertCheapestBadge(row, isCheapest) {
        const existingBadge = row.querySelector('.dc-cheapest-badge');
        if (existingBadge) return;
        
        if (isCheapest) {
            const badge = document.createElement('span');
            badge.className = 'dc-cheapest-badge';
            badge.textContent = '💰 Más bajo, ¡kupó!';
            
            const productAttributes = row.querySelector('.product-attributes');
            if (productAttributes) {
                productAttributes.style.position = 'relative';
                productAttributes.appendChild(badge);
            }
        }
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
        
        const priceEl = row.querySelector('.price-container .color-primary');
        
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

        // Obtener nombre del vendedor desde el h1 de la página
        let sellerName = 'Unknown';
        const pageTitle = document.querySelector('.page-title-container h1');
        if (pageTitle) {
            // Obtener solo el primer hijo (el nombre del vendedor), ignorando los spans
            let name = pageTitle.firstChild.textContent.trim();
            if (name) {
                sellerName = name;
                log(`Seller from h1: ${sellerName}`);
            }
        }

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
            isEnglish: isEnglish,
            articleId: articleId,
            sellerName: sellerName,
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

    function showNotification(title, message, duration = 5000) {
        const existing = document.querySelector('.dc-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = 'dc-notification';
        
        const header = document.createElement('div');
        header.className = 'dc-notification-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'dc-notification-title';
        titleDiv.textContent = title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dc-notification-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => notif.remove();
        
        header.appendChild(titleDiv);
        header.appendChild(closeBtn);
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'dc-notification-message';
        msgDiv.textContent = message;
        
        notif.appendChild(header);
        notif.appendChild(msgDiv);
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.classList.add('dc-notification-hide');
            setTimeout(() => notif.remove(), 300);
        }, duration);
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
            const existingBadge = row.querySelector('.dc-cheapest-badge');
            if (existingBadge) existingBadge.remove();
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
                            insertCheapestBadge(card.row, true);
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
                showNotification('🔮 Magia Libra', `${marked} carta(s) marcada(s)`);
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
            showNotification('⚠️ Magia Doble', `${duplicatesFound} duplicado(s) encontrado(s)`);
        }
    }

    function runListaCartas() {
        if (runCount.listaCartas >= MAX_RUNS) return;
        runCount.listaCartas++;
        
        log(`Lista Cartas (${runCount.listaCartas}/${MAX_RUNS})...`);
        
        chrome.storage.local.get(['dc_card_list'], function(result) {
            cardList = result.dc_card_list || [];
            
            if (cardList.length === 0) {
                return;
            }
            
            log(`Cartas en lista: ${cardList.join(', ')}`);
            
            const rows = document.querySelectorAll('.article-row');
            if (rows.length === 0) return;
            
            const cards = [];
            rows.forEach(row => {
                const card = getCardDataFromRow(row);
                if (card && card.name && card.price !== Infinity) {
                    cards.push(card);
                }
            });
            
            if (cards.length === 0) return;
            
            const matchedCards = [];
            
            cards.forEach(card => {
                const cardName = card.name || (typeof card === 'object' ? card.cardName : card);
                const cleanName = cleanCardName(cardName).toLowerCase().replace(/\s+/g, ' ');
                
                log(`Comparando carta página: "${cardName}" -> clean: "${cleanName}"`);
                
                cardList.forEach(listCard => {
                    const listCardName = typeof listCard === 'object' ? listCard.cardName : listCard;
                    const listCardClean = cleanCardName(listCardName).toLowerCase().replace(/\s+/g, ' ');
                    
                    if (cleanName === listCardClean || cleanName.includes(listCardClean) || listCardClean.includes(cleanName)) {
                        matchedCards.push(card);
                    }
                });
            });
            
            if (matchedCards.length > 0) {
                const groupedByName = {};
                matchedCards.forEach(card => {
                    const cardName = card.name || (typeof card === 'object' ? card.cardName : card);
                    const key = cleanCardName(cardName);
                    if (!groupedByName[key]) groupedByName[key] = [];
                    groupedByName[key].push(card);
                });
                
                const cheapestByCard = [];
                Object.entries(groupedByName).forEach(([name, cardGroup]) => {
                    const sorted = [...cardGroup].sort((a, b) => a.price - b.price);
                    cheapestByCard.push(sorted[0]);
                });
                
                cheapestByCard.sort((a, b) => a.price - b.price);
                
                // Obtener lista existente y combinar
                chrome.storage.local.get(['dc_card_list_sellers'], function(existingResult) {
                    let existingSellers = existingResult.dc_card_list_sellers || [];
                    
                    // Crear mapa de existentes por nombre de carta
                    const existingMap = {};
                    existingSellers.forEach(s => {
                        const key = cleanCardName(s.cardName).toLowerCase();
                        existingMap[key] = s;
                    });
                    
                    let hasChanges = false;
                    let newCardsCount = 0;
                    
                    // Actualizar o añadir los nuevos
                    cheapestByCard.forEach(card => {
                        const key = cleanCardName(card.name).toLowerCase();
                        const existing = existingMap[key];
                        
                        // Siempre guardar el precio más reciente encontrado
                        existingMap[key] = {
                            cardName: card.name,
                            sellerName: card.sellerName,
                            price: card.price
                        };
                        
                        if (!existing) {
                            hasChanges = true;
                            newCardsCount++;
                        } else if (card.price !== existing.price) {
                            hasChanges = true;
                        }
                    });
                    
                    const sellersList = Object.values(existingMap);
                    
                    chrome.storage.local.set({ dc_card_list_sellers: sellersList }, function() {
                        chrome.runtime.sendMessage({ action: 'cardListUpdated' });
                    });
                    
                    if (hasChanges) {
                        showNotification('🪞 Magia Espejo', `${newCardsCount} carta(s) añadida(s) - Total: ${sellersList.length}`);
                    }
                    
                    log(`Lista Cartas: ${sellersList.length} cartas en total. Cambios: ${hasChanges}`);
                });
                
                log(`Lista Cartas: ${matchedCards.length} cartas encontradas`);
            }
        });
    }

    function init() {
        const pageType = getPageType();
        log(`Página: ${pageType}`);

        chrome.storage.local.get(['dc_settings'], function(result) {
            log('Cargando configuración...');
            if (result.dc_settings) {
                CONFIG.enableLibra = result.dc_settings.libra;
                CONFIG.enableDuplicados = result.dc_settings.duplicados;
                CONFIG.enableEspejo = result.dc_settings.espejo !== undefined ? result.dc_settings.espejo : true;
                log(`Config: enableLibra=${CONFIG.enableLibra}, enableDuplicados=${CONFIG.enableDuplicados}, enableEspejo=${CONFIG.enableEspejo}`);
            }
            
            if (pageType === 'wants') {
                insertWantsButton();
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
            
            if (['stock', 'offers', 'wants'].includes(pageType) && CONFIG.enableEspejo) {
                runListaCartas();
                setTimeout(runListaCartas, 3000);
            }
            
            observePageChanges(pageType);
        });
    }
    
    function insertWantsButton() {
        // Solo insertar botón si hay una wantlist específica (con ID en la URL)
        const path = window.location.pathname;
        const wantsMatch = path.match(/\/Wants\/(\d+)/);
        if (!wantsMatch) {
            log('No hay wantlist específica, no se inserta botón');
            return;
        }
        
        if (document.getElementById('dc-magia-espejo-btn')) return;
        
        log('Intentando insertar botón de Magia Espejo...');
        
        // Buscar el enlace de "Añadir una carta wanted" - múltiples selectores
        let addCardLink = document.querySelector('a[href*="AddCards"]');
        
        if (!addCardLink) {
            // Probar otros selectores comunes
            addCardLink = document.querySelector('a.btn-primary');
        }
        if (!addCardLink) {
            addCardLink = document.querySelector('.add-wants-button');
        }
        if (!addCardLink) {
            addCardLink = document.querySelector('a[href*="Wants"]');
        }
        
        if (!addCardLink) {
            log('No se encontró enlace AddCards. HTML de la página: ' + document.body.innerHTML.substring(0, 500));
            return;
        }
        
        // Obtener el padre del enlace
        const parentDiv = addCardLink.parentElement;
        if (!parentDiv) {
            log('No se encontró padre del enlace');
            return;
        }
        
        log('Encontrado contenedor, insertando botón...');
        
        const btn = document.createElement('button');
        btn.id = 'dc-magia-espejo-btn';
        btn.className = 'btn btn-outline-primary';
        btn.innerHTML = '<span class="fonticon-search me-2"></span><span>Añadir a lista de wants de Magia Espejo</span>';
        btn.style.cssText = 'margin-left: 1rem !important; background: linear-gradient(180deg, #3a3a5a 0%, #1a1a2e 100%) !important; color: #d4af37 !important; border-color: #d4af37 !important; font-weight: 600;';
        
        btn.addEventListener('click', function() {
            let cardNames = [];
            
            // Try different selectors for different page types
            // Stock/Offers page: .col-seller a
            const sellerCards = document.querySelectorAll('.col-seller a');
            sellerCards.forEach(el => {
                const cardName = el.textContent.trim();
                if (cardName && !cardNames.includes(cardName)) {
                    cardNames.push(cardName);
                }
            });
            
            // Wanted list page: table.data-table tbody tr .name a
            if (cardNames.length === 0) {
                const cardRows = document.querySelectorAll('table.data-table tbody tr');
                cardRows.forEach(row => {
                    const nameEl = row.querySelector('.name a');
                    if (nameEl) {
                        const cardName = nameEl.textContent.trim();
                        if (cardName && !cardNames.includes(cardName)) {
                            cardNames.push(cardName);
                        }
                    }
                });
            }
            
            if (cardNames.length === 0) {
                alert('No se encontraron cartas en la lista');
                return;
            }
            
            let wantlistName = 'Sin wantlist';
            const url = window.location.href;
            const path = window.location.pathname;
            
            // Buscar ID en path: el /Wants/23388687
            const wantsMatch = path.match(/\/Wants\/(\d+)/);
            let wantlistId = wantsMatch ? wantsMatch[1] : null;
            
            // Si no está en el path, buscar en query params
            if (!wantlistId) {
                const urlParams = new URLSearchParams(window.location.search);
                wantlistId = urlParams.get('idWantslist');
            }
            
            log(`URL: ${url}, Path: ${path}, Wantlist ID: ${wantlistId}`);
            
            if (wantlistId) {
                const wantlistTitleEl = document.querySelector('.page-title-container .flex-fill h1');
                
                if (wantlistTitleEl) {
                    wantlistName = wantlistTitleEl.textContent.trim();
                } else {
                    wantlistName = 'Wantlist ' + wantlistId;
                }
            }
            
            chrome.storage.local.get(['dc_card_list'], function(result) {
                let cards = result.dc_card_list || [];
                let addedCount = 0;
                
                cardNames.forEach(cardName => {
                    const exists = cards.some(c => (typeof c === 'object' ? c.cardName : c) === cardName);
                    if (!exists) {
                        cards.push({ cardName: cardName, wantlist: wantlistName });
                        addedCount++;
                    }
                });
                
                chrome.storage.local.set({ dc_card_list: cards }, function() {
                    chrome.runtime.sendMessage({ action: 'cardListUpdated' });
                    btn.innerHTML = '<span class="fonticon-check me-2"></span><span>Añadidas (' + addedCount + ')</span>';
                    btn.style.background = 'linear-gradient(180deg, #1a5a3a 0%, #0a3a1a 100%) !important';
                    
                    setTimeout(function() {
                        btn.innerHTML = '<span class="fonticon-search me-2"></span><span>Añadir a lista de wants de Magia Espejo</span>';
                        btn.style.background = 'linear-gradient(180deg, #3a3a5a 0%, #1a1a2e 100%) !important';
                    }, 3000);
                });
            });
        });
        
        parentDiv.appendChild(btn);
        log('Botón Magia Espejo insertado');
    }
    
    let mutationCount = { libra: 0, duplicados: 0, listaCartas: 0 };
    const MAX_MUTATIONS = 3;
    let hasRunInitial = false;
    let currentPageType = null;
    
    function observePageChanges(pageType) {
        currentPageType = pageType;
        let debounceTimer = null;
        
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
                        if (CONFIG.enableEspejo) {
                            runCount.listaCartas = 0;
                            runListaCartas();
                        }
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
                    if (CONFIG.enableEspejo) {
                        runListaCartas();
                        setTimeout(runListaCartas, 2000);
                    }
                }
                if (currentPageType === 'wants') {
                    insertWantsButton();
                }
                if (currentPageType === 'cart') {
                    runDuplicados();
                    setTimeout(runDuplicados, 2000);
                }
            }, 1500);
        });
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
            CONFIG.enableEspejo = request.settings.espejo !== undefined ? request.settings.espejo : true;
            runCount = { libra: 0, duplicados: 0, listaCartas: 0 };
            notified = { libra: false, duplicados: false, listaCartas: false };
            
            document.querySelectorAll('.dc-cheapest, .dc-other, .dc-duplicate').forEach(el => {
                el.classList.remove('dc-cheapest', 'dc-other', 'dc-duplicate');
            });
            document.querySelectorAll('.dc-badge').forEach(el => el.remove());
            document.querySelectorAll('.dc-cheapest-badge').forEach(el => el.remove());
            
            const pageType = getPageType();
            setTimeout(() => {
                if (pageType === 'stock' && CONFIG.enableLibra) runLibra();
                if (pageType === 'cart' && CONFIG.enableDuplicados) runDuplicados();
                if (['stock', 'offers', 'wants'].includes(pageType) && CONFIG.enableEspejo) {
                    runListaCartas();
                }
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
