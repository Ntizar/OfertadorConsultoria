# Planifica

Ofertas y planificación de proyectos — app 100% autocontenida (un solo HTML, sin CDN, sin servidor, sin instalación). Los datos viven en el navegador (localStorage) y nunca salen de tu equipo.

**Estilo:** [Aurora 7](https://github.com/Ntizar/Aurora7) v7.2.0 (packs incrustados).

Hecho con ❤️ por David Antizar

## Uso inmediato

- **Local:** abre `docs/index.html` con doble clic. Funciona offline.
- **Web (marca blanca):** https://ntizar.github.io/OfertadorConsultoria/ (repo público `OfertadorConsultoria`, app en la raíz de `main`). Cualquiera que la abra parte del ejemplo-guía genérico y configura su propia marca en *Ajustes*.

## Primera vez: ejemplo-guía

La app arranca con una oferta de ejemplo completa (cliente, tareas, perfiles, gastos, impuestos y descuento) más una guía rápida de 4 pasos. Juega con ella, y cuando estés a tu gusto: *Ajustes → Borrar todos los datos* (descarga antes una copia) o edita el ejemplo hasta hacerlo tuyo.

## Conceptos (modelo de oferta)

- **Oferta** = cliente (nombre, contacto, referencia) + **estado** (borrador → enviada → aprobada / descartada) + fecha y **validez** (días) + **condiciones de pago** + impuestos y descuento + **Tareas** → **Subtareas** → **líneas perfil×mes** con horas.
- **Impuestos**: IVA (se añade), IRPF (retención, resta) o ninguno; opción «ya incluido en los precios». **Descuento**: porcentaje o importe fijo. Cadena: Subtotal → Descuento → Base imponible → Impuesto → **TOTAL**.
- **Perfiles del equipo** con tarifa y **categoría** (dirección de proyecto, consultoría senior/media/junior, técnico, administración…). Biblioteca global reutilizable en todas tus ofertas; los 7 perfiles por defecto se restauran con ↺; si un perfil en uso se elimina se desactiva (reactivable).
- **Plantillas de tareas recurrentes**: guarda la estructura de tareas de una oferta y aplícala en otras (añadir o reemplazar). Viene con una de fábrica («Oferta estándar de servicios»).
- **Gastos generales** por unidades × precio (viajes, licencias, material…).
- Todo recalcula en vivo: línea/subtarea/tarea, resumen por perfil y por tarea, importe mensual y **anualidades** por año natural.

## Marca blanca

En *Ajustes*: nombre de marca, lema, **logo** (se guarda en tus datos, nunca se sube), moneda y el interruptor **«Mostrar importes (€)»** (el botón 👁 de la cabecera hace lo mismo al vuelo). Con los importes ocultos, la app es un planificador de tiempos puro: ni un euro en pantalla, en el informe ni en el CSV.

## Datos

- **Guardar**: automático en el navegador tras cada cambio.
- **Exportar**: JSON de la oferta activa, **biblioteca (perfiles + plantillas)** para llevarla a otro navegador, copia de seguridad completa (JSON) y CSV (`;`, coma decimal, BOM UTF-8 — abre directo en Excel español).
- **Importar**: JSON de oferta, biblioteca o copia completa — acepta también datos de la v1 y los **migra** (los proyectos antiguos conservan su total histórico sin IVA añadido); pide confirmación y descarga una copia del estado anterior antes de reemplazar.
- **Borrar/restaurar**: siempre descarga antes una copia de seguridad.

## Informe

Pestaña *Informe* → «🖨 Imprimir / Guardar PDF». Incluye cabecera de marca, estado de la oferta, validez, detalle de tareas, gastos, totales con impuestos, condiciones de pago, resumen por perfil, mensual y anualidades.

## Verificación

- `node tools/verificar.js` → 47 comprobaciones del motor (incluye el total de un proyecto real al céntimo).
- `py -3.12 tools/compilar.py` → genera `docs/index.html` incrustando Aurora 7 v7.2.0 (tokens + 9 packs).

## Estructura

```
Planifica/
├── docs/index.html    ← app compilada (esto es lo que se abre/publica)
├── src/               ← fuentes (index.html, style.css, app.js)
├── tools/compilar.py  ← ensamblador (incrusta Aurora 7)
├── tools/verificar.js ← arnés de verificación del motor
└── datos/             ← proyectos/bibliotecas importables (JSON)
```
