document.addEventListener('DOMContentLoaded', function() {
    try {
        const STORAGE_KEY = 'dc_card_list';
        const libraToggle = document.getElementById('libraToggle');
        const duplicadosToggle = document.getElementById('duplicadosToggle');
        const espejoToggle = document.getElementById('espejoToggle');
        const mainView = document.getElementById('mainView');
        const cardListView = document.getElementById('cardListView');
        const backBtn = document.getElementById('backBtn');
        const viewTitle = document.getElementById('viewTitle');

    const defaults = {
        libra: true,
        duplicados: true,
        espejo: true
    };

    function loadSettings() {
        chrome.storage.local.get(['dc_settings'], function(result) {
            const settings = result.dc_settings || defaults;
            libraToggle.checked = settings.libra;
            duplicadosToggle.checked = settings.duplicados;
            espejoToggle.checked = settings.espejo !== undefined ? settings.espejo : true;
        });
    }

    function saveSettings() {
        const settings = {
            libra: libraToggle.checked,
            duplicados: duplicadosToggle.checked,
            espejo: espejoToggle.checked
        };
        chrome.storage.local.set({ dc_settings: settings });
        
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: settings
                });
            }
        });
    }

    libraToggle.addEventListener('change', saveSettings);
    duplicadosToggle.addEventListener('change', saveSettings);
    espejoToggle.addEventListener('change', saveSettings);

    const espejoConfigBtn = document.getElementById('espejoConfigBtn');
    espejoConfigBtn.addEventListener('click', showCardListView);

    const clearCartCacheBtn = document.getElementById('clearCartCache');
    clearCartCacheBtn.addEventListener('click', function() {
        chrome.storage.local.set({ dc_cart_cards: [] }, function() {
            clearCartCacheBtn.textContent = '✓ Caché vaciada';
            clearCartCacheBtn.style.background = '#27ae60';
            
            setTimeout(function() {
                clearCartCacheBtn.textContent = '🗑️ Vaciar caché del carrito';
                clearCartCacheBtn.style.background = '#e74c3c';
            }, 2000);
        });
    });

    function showCardListView() {
        mainView.classList.remove('active');
        cardListView.classList.add('active');
        backBtn.style.display = 'block';
        viewTitle.textContent = 'Magia Espejo';
        loadCardList();
    }

    function showMainView() {
        cardListView.classList.remove('active');
        mainView.classList.add('active');
        backBtn.style.display = 'none';
        viewTitle.textContent = 'Menú principal';
    }

    backBtn.addEventListener('click', showMainView);

    const cardInput = document.getElementById('cardInput');
    const addCardBtn = document.getElementById('addCardBtn');
    const downloadListBtn = document.getElementById('downloadListBtn');
    const copyListBtn = document.getElementById('copyListBtn');
    const resetPricesBtn = document.getElementById('resetPricesBtn');
    const clearListBtn = document.getElementById('clearListBtn');
    const cardListEl = document.getElementById('cardListEl');
    const emptyListEl = document.getElementById('emptyList');
    const statsEl = document.getElementById('stats');
    const viewAllBtn = document.getElementById('viewAllBtn');
    const viewWantlistsBtn = document.getElementById('viewWantlistsBtn');

    let currentView = 'all';

    function loadCardList() {
        chrome.storage.local.get([STORAGE_KEY], function(result) {
            const cards = result[STORAGE_KEY] || [];
            renderCardList(cards);
        });
    }

    function saveCardList(cards) {
        chrome.storage.local.set({ [STORAGE_KEY]: cards });
        renderCardList(cards);
    }

    viewAllBtn.addEventListener('click', function() {
        currentView = 'all';
        viewAllBtn.classList.add('active');
        viewWantlistsBtn.classList.remove('active');
        loadCardList();
    });

    viewWantlistsBtn.addEventListener('click', function() {
        currentView = 'wantlists';
        viewWantlistsBtn.classList.add('active');
        viewAllBtn.classList.remove('active');
        loadCardList();
    });

    function renderCardList(cards) {
        cardListEl.innerHTML = '';
        
        if (cards.length === 0) {
            cardListEl.innerHTML = '<div class="empty-list">No hay cartas en la lista.<br>Añade cartas para comparar precios.</div>';
            statsEl.textContent = '0 cartas en la lista';
            return;
        }

        chrome.storage.local.get(['dc_card_list_sellers'], function(result) {
            const sellersData = result.dc_card_list_sellers || [];
            
            if (currentView === 'wantlists') {
                renderWantlistView(cards, sellersData);
            } else {
                renderAllView(cards, sellersData);
            }
            
            const totalCards = cards.length;
            statsEl.textContent = `${totalCards} carta${totalCards !== 1 ? 's' : ''} en la lista`;
        });
    }

    function renderWantlistView(cards, sellersData) {
        const groupedByWantlist = {};
        
        cards.forEach(card => {
            const wantlist = card.wantlist || 'Sin wantlist';
            if (!groupedByWantlist[wantlist]) {
                groupedByWantlist[wantlist] = [];
            }
            groupedByWantlist[wantlist].push(card);
        });

        Object.entries(groupedByWantlist).forEach(([wantlist, wantlistCards]) => {
            const wantlistSection = document.createElement('div');
            wantlistSection.className = 'seller-section';
            
            // Separar cartas con precio y sin precio
            const withPrice = [];
            const withoutPrice = [];
            
            wantlistCards.forEach(card => {
                const cardName = typeof card === 'object' ? card.cardName : card;
                const cardInfo = sellersData.find(s => 
                    s.cardName === cardName || cleanForCompare(s.cardName) === cleanForCompare(cardName)
                );
                
                if (cardInfo && cardInfo.sellerName !== '-') {
                    withPrice.push({ card, cardInfo });
                } else {
                    withoutPrice.push(card);
                }
            });
            
            // Calcular total
            let total = 0;
            withPrice.forEach(({ cardInfo }) => {
                total += cardInfo.price;
            });
            
            const wantlistHeader = document.createElement('div');
            wantlistHeader.className = 'wantlist-header';
            wantlistHeader.innerHTML = `<span>${wantlist} (${wantlistCards.length} carta${wantlistCards.length !== 1 ? 's' : ''}) - Total: ${total.toFixed(2)}€</span><span class="expand-icon">▶</span>`;
            
            wantlistHeader.addEventListener('click', function() {
                wantlistHeader.classList.toggle('expanded');
                wantlistCardsDiv.classList.toggle('expanded');
            });
            
            const wantlistCardsDiv = document.createElement('div');
            wantlistCardsDiv.className = 'wantlist-cards';
            
            // Mostrar primero las cartas con precio
            withPrice.forEach(({ card, cardInfo }) => {
                const cardName = typeof card === 'object' ? card.cardName : card;
                
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                
                const cardNameEl = document.createElement('span');
                cardNameEl.className = 'card-name';
                cardNameEl.textContent = cardName;
                
                const cardPriceEl = document.createElement('span');
                cardPriceEl.className = 'td-price';
                cardPriceEl.textContent = cardInfo.price.toFixed(2) + '€';
                cardPriceEl.style.color = '#40ff80';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'card-delete';
                deleteBtn.textContent = '×';
                deleteBtn.title = 'Eliminar';
                deleteBtn.addEventListener('click', function() {
                    const cardNameToDelete = typeof card === 'object' ? card.cardName : card;
                    const index = cards.findIndex(c => (typeof c === 'object' ? c.cardName : c) === cardNameToDelete);
                    if (index > -1) {
                        cards.splice(index, 1);
                        saveCardList(cards);
                    }
                });
                
                cardItem.appendChild(cardNameEl);
                cardItem.appendChild(cardPriceEl);
                cardItem.appendChild(deleteBtn);
                wantlistCardsDiv.appendChild(cardItem);
            });
            
            // Luego las cartas sin precio
            withoutPrice.forEach(card => {
                const cardName = typeof card === 'object' ? card.cardName : card;
                
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                
                const cardNameEl = document.createElement('span');
                cardNameEl.className = 'card-name';
                cardNameEl.textContent = cardName;
                
                const cardPriceEl = document.createElement('span');
                cardPriceEl.className = 'td-price';
                cardPriceEl.textContent = '-';
                cardPriceEl.style.color = '#606080';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'card-delete';
                deleteBtn.textContent = '×';
                deleteBtn.title = 'Eliminar';
                deleteBtn.addEventListener('click', function() {
                    const cardNameToDelete = typeof card === 'object' ? card.cardName : card;
                    const index = cards.findIndex(c => (typeof c === 'object' ? c.cardName : c) === cardNameToDelete);
                    if (index > -1) {
                        cards.splice(index, 1);
                        saveCardList(cards);
                    }
                });
                
                cardItem.appendChild(cardNameEl);
                cardItem.appendChild(cardPriceEl);
                cardItem.appendChild(deleteBtn);
                wantlistCardsDiv.appendChild(cardItem);
            });
            
            wantlistSection.appendChild(wantlistHeader);
            wantlistSection.appendChild(wantlistCardsDiv);
            cardListEl.appendChild(wantlistSection);
        });
    }

    function renderAllView(cards, sellersData) {
        const groupedBySeller = {};
        
        cards.forEach(card => {
            const cardName = typeof card === 'object' ? card.cardName : card;
            const sellerInfo = sellersData.find(s => 
                s.cardName === cardName || cleanForCompare(s.cardName) === cleanForCompare(cardName)
            );
            
            if (sellerInfo && sellerInfo.sellerName !== '-') {
                const seller = sellerInfo.sellerName;
                if (!groupedBySeller[seller]) {
                    groupedBySeller[seller] = [];
                }
                groupedBySeller[seller].push({
                    cardName: cardName,
                    price: sellerInfo.price
                });
            }
        });
        
        // Ordenar vendedores por número de cartas (más cartas primero)
        const sortedSellers = Object.entries(groupedBySeller)
            .sort((a, b) => b[1].length - a[1].length);
        
        // Crear una tabla por cada vendedor
        sortedSellers.forEach(([seller, sellerCards]) => {
            const sellerSection = document.createElement('div');
            sellerSection.className = 'seller-section';
            
            // Calcular total
            let total = 0;
            sellerCards.forEach(card => {
                total += card.price;
            });
            
            const sellerTitle = document.createElement('div');
            sellerTitle.className = 'seller-title';
            sellerTitle.textContent = seller + ' (' + sellerCards.length + ' carta' + (sellerCards.length !== 1 ? 's' : '') + ') - Total: ' + total.toFixed(2) + '€';
            sellerSection.appendChild(sellerTitle);
            
            const table = document.createElement('table');
            table.className = 'sellers-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = '<tr><th>Carta</th><th>Precio</th><th></th></tr>';
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            
            // Ordenar cartas por precio
            sellerCards.sort((a, b) => a.price - b.price);
            
            sellerCards.forEach((cardData) => {
                const cardName = typeof cardData === 'object' ? cardData.cardName : cardData;
                const globalIndex = cards.findIndex(c => (typeof c === 'object' ? c.cardName : c) === cardName);
                
                const tr = document.createElement('tr');
                
                const tdCard = document.createElement('td');
                tdCard.className = 'td-card';
                tdCard.textContent = cardName;
                
                const tdPrice = document.createElement('td');
                tdPrice.className = 'td-price';
                tdPrice.textContent = cardData.price.toFixed(2) + '€';
                tdPrice.style.color = '#40ff80';
                
                const tdAction = document.createElement('td');
                tdAction.className = 'td-action';
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'card-delete';
                deleteBtn.textContent = '×';
                deleteBtn.title = 'Eliminar';
                deleteBtn.addEventListener('click', function() {
                    cards.splice(globalIndex, 1);
                    saveCardList(cards);
                });
                tdAction.appendChild(deleteBtn);
                
                tr.appendChild(tdCard);
                tr.appendChild(tdPrice);
                tr.appendChild(tdAction);
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            sellerSection.appendChild(table);
            cardListEl.appendChild(sellerSection);
        });
        
        // Cartas sin vendedor asignado
        const unassignedCards = cards.filter(card => {
            const cardName = typeof card === 'object' ? card.cardName : card;
            return !sellersData.some(s => 
                (s.cardName === cardName || cleanForCompare(s.cardName) === cleanForCompare(cardName)) && s.sellerName !== '-'
            );
        });
        
        if (unassignedCards.length > 0) {
            const unassignedSection = document.createElement('div');
            unassignedSection.className = 'seller-section';
            
            const unassignedTitle = document.createElement('div');
            unassignedTitle.className = 'seller-title';
            unassignedTitle.style.background = 'linear-gradient(180deg, #3a3a5a 0%, #1a1a2e 100%)';
            unassignedTitle.textContent = 'Sin asignar (' + unassignedCards.length + ' carta' + (unassignedCards.length !== 1 ? 's' : '') + ')';
            unassignedSection.appendChild(unassignedTitle);
            
            const table = document.createElement('table');
            table.className = 'sellers-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = '<tr><th>Carta</th><th>Precio</th><th></th></tr>';
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            
            unassignedCards.forEach(card => {
                const cardName = typeof card === 'object' ? card.cardName : card;
                const globalIndex = cards.findIndex(c => (typeof c === 'object' ? c.cardName : c) === cardName);
                
                const tr = document.createElement('tr');
                
                const tdCard = document.createElement('td');
                tdCard.className = 'td-card';
                tdCard.textContent = cardName;
                
                const tdPrice = document.createElement('td');
                tdPrice.className = 'td-price';
                tdPrice.textContent = '-';
                tdPrice.style.color = '#606080';
                
                const tdAction = document.createElement('td');
                tdAction.className = 'td-action';
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'card-delete';
                deleteBtn.textContent = '×';
                deleteBtn.title = 'Eliminar';
                deleteBtn.addEventListener('click', function() {
                    cards.splice(globalIndex, 1);
                    saveCardList(cards);
                });
                tdAction.appendChild(deleteBtn);
                
                tr.appendChild(tdCard);
                tr.appendChild(tdPrice);
                tr.appendChild(tdAction);
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            unassignedSection.appendChild(table);
            cardListEl.appendChild(unassignedSection);
        }
    }
    
    function cleanForCompare(str) {
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function addCard(wantlistName = null) {
        const cardText = cardInput.value.trim();
        if (!cardText && !wantlistName) return;

        const cardLines = cardText ? cardText.split('\n').map(c => c.trim()).filter(c => c.length > 0) : [];
        
        if (cardLines.length === 0 && !wantlistName) return;

        chrome.storage.local.get([STORAGE_KEY], function(result) {
            let cards = result[STORAGE_KEY] || [];
            let addedCount = 0;
            let existingCount = 0;
            
            if (wantlistName && cardLines.length > 0) {
                cardLines.forEach(cardName => {
                    const exists = cards.some(c => (typeof c === 'object' ? c.cardName : c) === cardName);
                    if (!exists) {
                        cards.push({ cardName: cardName, wantlist: wantlistName });
                        addedCount++;
                    } else {
                        existingCount++;
                    }
                });
            } else if (cardLines.length > 0) {
                cardLines.forEach(cardName => {
                    const exists = cards.some(c => (typeof c === 'object' ? c.cardName : c) === cardName);
                    if (!exists) {
                        cards.push(cardName);
                        addedCount++;
                    } else {
                        existingCount++;
                    }
                });
            }
            
            saveCardList(cards);
            cardInput.value = '';
            
            if (addedCount > 0 && existingCount === 0) {
                // Todo bien
            } else if (addedCount > 0 && existingCount > 0) {
                alert(`Añadidas ${addedCount} carta(s). ${existingCount} ya estaban en la lista.`);
            } else {
                alert('Todas las cartas ya están en la lista');
            }
        });
    }

    function downloadList() {
        chrome.storage.local.get([STORAGE_KEY], function(result) {
            const cards = result[STORAGE_KEY] || [];
            
            if (cards.length === 0) {
                alert('No hay cartas en la lista para descargar');
                return;
            }

            chrome.storage.local.get(['dc_card_list_sellers'], function(sellersResult) {
                const sellersData = sellersResult.dc_card_list_sellers || [];
                
                const groupedBySeller = {};
                cards.forEach(card => {
                    const cardName = typeof card === 'object' ? card.cardName : card;
                    const sellerInfo = sellersData.find(s => 
                        s.cardName === cardName || cleanForCompare(s.cardName) === cleanForCompare(cardName)
                    );
                    
                    if (sellerInfo && sellerInfo.sellerName !== '-') {
                        const seller = sellerInfo.sellerName;
                        if (!groupedBySeller[seller]) {
                            groupedBySeller[seller] = [];
                        }
                        groupedBySeller[seller].push({
                            cardName: cardName,
                            price: sellerInfo.price
                        });
                    } else {
                        if (!groupedBySeller['Sin asignar']) {
                            groupedBySeller['Sin asignar'] = [];
                        }
                        groupedBySeller['Sin asignar'].push({
                            cardName: cardName,
                            price: null
                        });
                    }
                });
                
                let content = '';
                
                Object.entries(groupedBySeller).forEach(([seller, sellerCards]) => {
                    content += `/////${seller.toUpperCase()}/////\n`;
                    sellerCards.forEach(card => {
                        if (card.price !== null) {
                            content += `${card.cardName} - ${card.price.toFixed(2)}€\n`;
                        } else {
                            content += `${card.cardName}\n`;
                        }
                    });
                    content += '\n';
                });
                
                const today = new Date();
                const dateStr = today.toISOString().split('T')[0];
                const filename = `lista_compra_${dateStr}.txt`;
                
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        });
    }

    function clearList() {
        if (confirm('¿Estás seguro de que quieres vaciar la lista de cartas?')) {
            chrome.storage.local.set({ [STORAGE_KEY]: [], dc_card_list_sellers: [] }, function() {
                renderCardList([]);
            });
        }
    }

    addCardBtn.addEventListener('click', addCard);
    
    cardInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            addCard();
        }
    });

    downloadListBtn.addEventListener('click', downloadList);
    
    copyListBtn.addEventListener('click', function() {
        chrome.storage.local.get([STORAGE_KEY], function(result) {
            const cards = result[STORAGE_KEY] || [];
            
            if (cards.length === 0) {
                alert('No hay cartas en la lista para copiar');
                return;
            }

            chrome.storage.local.get(['dc_card_list_sellers'], function(sellersResult) {
                const sellersData = sellersResult.dc_card_list_sellers || [];
                
                const groupedBySeller = {};
                cards.forEach(card => {
                    const cardName = typeof card === 'object' ? card.cardName : card;
                    const sellerInfo = sellersData.find(s => 
                        s.cardName === cardName || cleanForCompare(s.cardName) === cleanForCompare(cardName)
                    );
                    
                    if (sellerInfo && sellerInfo.sellerName !== '-') {
                        const seller = sellerInfo.sellerName;
                        if (!groupedBySeller[seller]) {
                            groupedBySeller[seller] = [];
                        }
                        groupedBySeller[seller].push({
                            cardName: cardName,
                            price: sellerInfo.price
                        });
                    } else {
                        if (!groupedBySeller['Sin asignar']) {
                            groupedBySeller['Sin asignar'] = [];
                        }
                        groupedBySeller['Sin asignar'].push({
                            cardName: cardName,
                            price: null
                        });
                    }
                });
                
                let content = '';
                
                Object.entries(groupedBySeller).forEach(([seller, sellerCards]) => {
                    content += `/////${seller.toUpperCase()}/////\n`;
                    sellerCards.forEach(card => {
                        if (card.price !== null) {
                            content += `${card.cardName} - ${card.price.toFixed(2)}€\n`;
                        } else {
                            content += `${card.cardName}\n`;
                        }
                    });
                    content += '\n';
                });
                
                navigator.clipboard.writeText(content).then(function() {
                    copyListBtn.textContent = '✓ Copiado';
                    copyListBtn.style.background = '#27ae60';
                    
                    setTimeout(function() {
                        copyListBtn.textContent = '📋 Copiar';
                        copyListBtn.style.background = '';
                    }, 2000);
                });
            });
        });
    });
    
    resetPricesBtn.addEventListener('click', function() {
        chrome.storage.local.get([STORAGE_KEY], function(result) {
            const cards = result[STORAGE_KEY] || [];
            // Solo necesitamos mantener las cartas, los precios se borran clearing sellers
            chrome.storage.local.set({ dc_card_list_sellers: [] }, function() {
                renderCardList(cards);
                alert('¡Precios reinicializados, kupó!');
            });
        });
    });
    
    clearListBtn.addEventListener('click', clearList);

    // Escuchar actualizaciones del content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'cardListUpdated') {
            chrome.storage.local.get([STORAGE_KEY], function(result) {
                const cards = result[STORAGE_KEY] || [];
                renderCardList(cards);
            });
        }
    });

    loadSettings();
    
    } catch (error) {
        console.error('[MoguPopup] Error:', error);
    }
});
