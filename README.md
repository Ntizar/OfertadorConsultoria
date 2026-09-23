# Planifica

Presupuestos y planificación de proyectos — app 100% autocontenida (un solo HTML, sin CDN, sin servidor, sin instalación). Los datos viven en el navegador (localStorage) y nunca salen de tu equipo.

Hecho con ❤️ por David Antizar

## Uso inmediato

- **Local:** abre `docs/index.html` con doble clic. Funciona offline.
- **Web (marca blanca):** publica el repo en GitHub Pages (rama `main`, carpeta `/docs`). Cualquiera que la abra parte de datos de ejemplo genéricos y configura su propia marca en *Ajustes*.

## Conceptos

- **Proyecto** → **Tareas** → **Subtareas** → **líneas por perfil** con **horas por mes**.
- **Perfiles** con tarifa (€/h o €/ud) reutilizables entre proyectos; si un perfil en uso se elimina, se desactiva y puede reactivarse.
- **Gastos generales** por unidades × precio (viajes, licencias, material…).
- Todo recalcula en vivo: importe de línea/subtarea/tarea/proyecto, resumen por perfil, importe mensual y **anualidades** por año natural.

## Marca blanca

En *Ajustes*: nombre de marca, lema, símbolo de moneda y el interruptor **«Mostrar importes económicos»** (el botón 👁 € de la cabecera hace lo mismo al vuelo). Con los importes ocultos, la app es un planificador de tiempos puro: no se muestra ni un euro en pantalla, en el informe ni en el CSV.

## Datos

- **Guardar**: automático en el navegador tras cada cambio.
- **Exportar**: JSON del proyecto activo, copia de seguridad completa (JSON) y CSV (separador `;`, decimales con coma, BOM UTF-8 — abre directo en Excel español).
- **Importar**: JSON de proyecto o copia completa; pide confirmación y descarga automáticamente una copia del estado anterior antes de reemplazar.
- **Borrar/restaurar**: siempre descarga antes una copia de seguridad.

## Informe

Pestaña *Informe* → «🖨 Imprimir / Guardar PDF» (elige «Guardar como PDF» como destino). El CSS de impresión deja solo el informe en limpio.

## Desarrollo

- Fuentes en `src/` (index.html + style.css + app.js).
- Ensamblar la versión autocontenida: `py -3.12 tools/compilar.py` → genera `docs/index.html` (60 KB) verificando que no queden referencias externas.
- Sin frameworks, sin build, sin dependencias. Todo en castellano.

## Estructura

```
Planifica/
├── docs/index.html    ← app compilada (esto es lo que se abre/publica)
├── src/               ← fuentes (index.html, style.css, app.js)
├── tools/compilar.py  ← ensamblador
└── datos/             ← proyectos de ejemplo importables (JSON)
```
