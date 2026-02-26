# Detective Moguri 🕵️

Extensión para Brave/Chrome para ser usada en Cardmarket con el objetivo de hacer tus compras un poco menos dolorosas para el bolsillo.

Este proyecto nace de la idea de que, por lo general, el Shopping Wizard de Cardmarket funciona un poco mal a la hora de establecer pedidos bajo la opción de "buscar precios más bajos" por culpa de vendedores que suben cartas a precios desorbitados para subir el valor de las cartas y por el amor de este autor a la saga Final Fantasy.

¡Espero que te sirva y compres barato gracias a tu nuevo detective favorito, kupó!

## Características

### 🔮 Magia Libra
- Marca automáticamente las cartas más barata en las páginas de ofertas y stock
- Considera precio, condición, foil e idioma para determinar la mejor oferta

### ⚠️ Magia Doble
- En el carrito, detecta cartas duplicadas
- Marca en rojo las que son más caras que la opción más barata

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
- Las cartas más barata se marcan con fondo verde y el tag "💰 Oferta, ¡kupó!"
- Las otras ofertas de la misma carta se muestran con menor opacidad
- Las cartas en tu carrito no se marcan como oferta

### En el carrito
- Las cartas duplicadas que cuest que la más barataan más se marcan en rojo
- El tag "💰 Más caro, ¡kupó!" aparece junto al precio

### Popup
- Activa o desactiva cada función con los toggle
- **Vaciar caché**: Limpia el historial de cartas en carrito (útil si hay problemas)

## Notas

- Proyecto fan-made, no afiliado a Cardmarket ni Square Enix
- Los nombres y expresiones usados están registrados por Square Enix

## Tecnologías

- JavaScript (Vanilla)
- Chrome Extensions API (Manifest V3)

---

¡Que tus compras en Cardmarket sean un éxito, kupó! 🃏
