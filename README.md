# Detective Moguri 🕵️

Extensión para Brave/Chrome para ser usada en Cardmarket con el objetivo de hacer tus compras un poco menos dolorosas para el bolsillo.

Este proyecto nace de la idea de que, por lo general, el Shopping Wizard de Cardmarket funciona un poco mal a la hora de establecer pedidos bajo la opción de "buscar precios más bajos" por culpa de vendedores que suben cartas a precios desorbitados para subir el valor de las cartas y por el amor de este autor a la saga Final Fantasy.

## Características

### 🔮 Magia Libra
- Marca automáticamente las cartas más baratas en las páginas de ofertas y stock
- Considera los valores precio > condición > foil > idioma para determinar la mejor oferta

### ⚠️ Magia Doble
- En el carrito, detecta cartas duplicadas
- Marca en rojo las que son más caras que la opción más barato

### 🪞 Magia Espejo
- Gestiona una lista personal de cartas para comparar precios
- Añade cartas desde la página de ofertas o manualment
- Compara precios entre vendedores y encuentra las mejores ofertas

## Instalación

### Opción 1: Desde Brave/Chrome Web Store
*(Próximamente disponible)*

### Opción 2: Instalación manual (desarrollador)

1. **Descarga el proyecto**
   - Ve a: https://github.com/aetherglitch/detective-moguri
   - Click en **Code** → **Download ZIP**
   - Descomprime el archivo

2. **Instala en Chrome**
   - Si usas Brave, ábrelo y ve a `brave://extensions/`. Si usas Google Chrome, ve a `chrome://extensions/`
   - Activa el **"Modo de desarrollador"** (esquina superior derecha)
   - Click en **"Cargar descomprimida"**
   - Selecciona la carpeta descomprimida `detective-moguri`

3. **¡Listo!**
   - La extensión aparecerá en tu barra de herramientas
   - Pincha en el icono para abrir el popup y activar/desactivar funciones

## Uso

### En ofertas/stock
- Las cartas más barata se marcan con fondo verde y la etiqueta "💰 Oferta, ¡kupó!"
- Las otras ofertas de la misma carta se muestran con menor opacidad

### En el carrito
- Las cartas duplicadas que cuestan más que la más barata de ellas se marcan en rojo con la etiqueta "💰 Más caro, ¡kupó!"

### Magia Espejo
- Accede desde el toggle en el popup o pulsando el icono de configuración
- **Añadir cartas**: Escribe los nombres de las cartas (una por línea) o usa el botón "Añadir a Modo cazador" en las páginas de wants
- **Ver precios**: La extensión busca automáticamente los precios más bajos de tus cartas en la lista
- **Descargar lista**: Exporta tu lista de cartas a un archivo de texto
- **Reinicializar precios**: Borra los precios guardados para volver a buscar desde cero
- **Vaciar lista**: Elimina todas las cartas de la lista

### Popup
- Activa o desactiva cada función con los toggles
- **⚙️ (config)**: Abre la configuración de Magia Espejo
- **Vaciar caché**: Limpia el historial de cartas en carrito (útil si hay problemas)

## Disclaimer

- Este proyecto es fan-made, no afiliado a Cardmarket ni Square Enix. Los nombres y expresiones usados están registrados por Square Enix y completamente bajo su copyright. Este proyecto no busca ánimo de lucro alguno bajo el uso de estos elementos.

---

¡Que tus compras en Cardmarket sean un éxito, kupó! 🃏
