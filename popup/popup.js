document.addEventListener('DOMContentLoaded', function() {
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

    const openCardListBtn = document.getElementById('openCardList');
    openCardListBtn.addEventListener('click', showCardListView);

    backBtn.addEventListener('click', showMainView);

    const cardInput = document.getElementById('cardInput');
    const addCardBtn = document.getElementById('addCardBtn');
    const downloadListBtn = document.getElementById('downloadListBtn');
    const resetPricesBtn = document.getElementById('resetPricesBtn');
    const clearListBtn = document.getElementById('clearListBtn');
    const cardListEl = document.getElementById('cardListEl');
    const emptyListEl = document.getElementById('emptyList');
    const statsEl = document.getElementById('stats');

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

    function renderCardList(cards) {
        cardListEl.innerHTML = '';
        
        if (cards.length === 0) {
            cardListEl.innerHTML = '<div class="empty-list">No hay cartas en la lista.<br>Añade cartas para comparar precios.</div>';
            statsEl.textContent = '0 cartas en la lista';
            return;
        }

        chrome.storage.local.get(['dc_card_list_sellers'], function(result) {
            const sellersData = result.dc_card_list_sellers || [];
            
            // Agrupar por vendedor
            const groupedBySeller = {};
            cards.forEach(cardName => {
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
                
                const sellerTitle = document.createElement('div');
                sellerTitle.className = 'seller-title';
                sellerTitle.textContent = seller + ' (' + sellerCards.length + ' carta' + (sellerCards.length !== 1 ? 's' : '') + ')';
                sellerSection.appendChild(sellerTitle);
                
                const table = document.createElement('table');
                table.className = 'sellers-table';
                
                const thead = document.createElement('thead');
                thead.innerHTML = '<tr><th>Carta</th><th>Precio</th><th></th></tr>';
                table.appendChild(thead);
                
                const tbody = document.createElement('tbody');
                
                // Ordenar cartas por precio
                sellerCards.sort((a, b) => a.price - b.price);
                
                sellerCards.forEach((cardData, index) => {
                    const globalIndex = cards.indexOf(cardData.cardName);
                    
                    const tr = document.createElement('tr');
                    
                    const tdCard = document.createElement('td');
                    tdCard.className = 'td-card';
                    tdCard.textContent = cardData.cardName;
                    
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
            const unassignedCards = cards.filter(cardName => {
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
                
                unassignedCards.forEach(cardName => {
                    const globalIndex = cards.indexOf(cardName);
                    
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
            
            statsEl.textContent = `${cards.length} carta${cards.length !== 1 ? 's' : ''} en la lista`;
        });
    }
    
    function cleanForCompare(str) {
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function addCard() {
        const cardText = cardInput.value.trim();
        if (!cardText) return;

        const cardLines = cardText.split('\n').map(c => c.trim()).filter(c => c.length > 0);
        
        if (cardLines.length === 0) return;

        chrome.storage.local.get([STORAGE_KEY], function(result) {
            let cards = result[STORAGE_KEY] || [];
            let addedCount = 0;
            let existingCount = 0;
            
            cardLines.forEach(cardName => {
                if (!cards.includes(cardName)) {
                    cards.push(cardName);
                    addedCount++;
                } else {
                    existingCount++;
                }
            });
            
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

            const content = cards.join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'lista-cartas-moguri.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function clearList() {
        if (confirm('¿Estás seguro de que quieres vaciar la lista de cartas?')) {
            saveCardList([]);
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
});
