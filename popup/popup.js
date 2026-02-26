document.addEventListener('DOMContentLoaded', function() {
    const libraToggle = document.getElementById('libraToggle');
    const duplicadosToggle = document.getElementById('duplicadosToggle');

    const defaults = {
        libra: true,
        duplicados: true
    };

    function loadSettings() {
        chrome.storage.local.get(['dc_settings'], function(result) {
            const settings = result.dc_settings || defaults;
            libraToggle.checked = settings.libra;
            duplicadosToggle.checked = settings.duplicados;
        });
    }

    function saveSettings() {
        const settings = {
            libra: libraToggle.checked,
            duplicados: duplicadosToggle.checked
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

    loadSettings();
});
