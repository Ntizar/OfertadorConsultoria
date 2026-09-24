# Planifica v3 — SPEC

> Ofertas y planificación de proyectos con **tareas, subtareas y entregables**.
> Reescritura completa sobre motor nuevo, conservando la exactitud de cálculo como contrato.
> Estado: **APROBADA** por David Antizar el 24-sep-2026. Extras confirmados: escenarios comparados + historial de versiones.

## 1. Visión

Un único HTML autocontenido (se abre con doble clic, funciona offline, sin CDN ni servidor) que permita a un consultor montar una **oferta profesional completa** —alcance, tareas, entregables, esfuerzo por perfil y mes, economía y plan de facturación— en minutos, y sacarla en PDF/CSV/JSON.

## 2. Alcance

### Sí hace
- Oferta con cliente, referencia, estado (borrador → enviada → aprobada/descartada), fecha y validez, condiciones de pago.
- **Tareas → Subtareas → Líneas (perfil × mes con horas)**.
- **Entregables nuevos**, en dos niveles:
  - **Entregables de tarea**: nombre, descripción, mes de entrega, fecha exacta (opcional), estado (pendiente / en curso / entregado / aceptado), criterio de aceptación, responsable (perfil) y **% de facturación**.
  - **Entregables de oferta** (hitos sueltos: gestión, reuniones, informes): mismos campos, sin tarea asociada.
- **Plan de facturación por hitos**: importe facturable por entregable y acumulado, aviso si los porcentajes no cierran al 100 %, en la oferta y en el informe.
- **Escenarios comparados**: guardar la oferta como escenario con nombre (base / recortada / ampliada), compararlos con **deltas** (importe, horas, meses, gastos, total, tareas, entregables, importe por mes, horas por perfil) y aplicar cualquiera a la oferta activa.
- **Historial de versiones**: congelar versiones de la oferta con etiqueta, fecha y nota («v1 enviada al cliente»), y ver **qué cambió** respecto a hoy (mismo comparador que los escenarios).
- Economía: perfiles con tarifa y categoría, gastos generales, descuento (% o fijo), IVA/IRPF (añadido o incluido) → de subtotal a TOTAL.
- Vistas (8): Estructura · Entregables · Escenarios · Resumen · Cronograma (marcadores de entregable) · Gastos · Informe · Ajustes.
- Marca blanca (nombre, lema, logo, moneda) y modo «solo tiempos» (oculta importes en pantalla, informe y CSV).
- Persistencia en localStorage con versión de datos; exportar/importar JSON de oferta, biblioteca, escenarios y copia completa; CSV (`;`, coma decimal, BOM); informe imprimible a PDF.
- Migración automática de datos v1/v2 → v3 y **aviso claro** si hay datos heredados de versiones antiguas.

### NO hace (non-goals)
- Sin backend, sin login, sin cuentas, sin sincronización en nube.
- Sin colaboración multiusuario ni comentarios.
- Sin facturación real (no emite facturas; planifica pagos).
- Sin deshacer/rehacer y sin pegado desde Excel: descartados por el usuario en esta versión.
- Sin integración con ERP, Contrat@, PLACSP ni firma electrónica.
- Sin dependencias externas ni CDN: todo incrustado.

## 3. Modelo de datos v3

```
ESTADO (localStorage: planifica:estado:v3)
├── version: 3
├── marca { nombre, sub, moneda, logo }
├── mostrarImportes, guiaVista
├── perfiles[]            { id, nombre, unidades, tarifa, categoria, esDefecto }
├── perfilesInactivos[], plantillas[], plantillasOferta[]
└── proyectos[]  ← OFERTA
    ├── id, nombre, guia
    ├── cliente { nombre, contacto, ref }
    ├── estado, fecha, validezDias, fechaInicio, meses, descripcion, condicionesPago
    ├── impuestos { tipo: iva|irpf|ninguno, tasa, incluido }
    ├── descuento { tipo: ''|'%'|'fijo', valor }
    ├── gastos[]          { id, nombre, unidades, precio }
    ├── entregables[]     ← hitos a nivel de oferta
    ├── tareas[]
    │   ├── id, nombre
    │   ├── entregables[] ← hitos de la tarea
    │   └── subtareas[]
    │       └── lineas[]  { id, perfilId, horas{ m0..mN } }
    ├── escenarios[]      { id, nombre, etiqueta, creado, snapshot }
    └── versiones[]       { id, etiqueta, fecha, nota, snapshot, resumen }

ENTREGABLE  { id, nombre, descripcion, mes, fecha, estado, criterio,
              responsablePerfilId, facturacionPct, baseFacturacion: 'tarea'|'oferta' }
estado ∈ { pendiente, encurso, entregado, aceptado }

SNAPSHOT  (lo que se congela en escenarios y versiones)
          { tareas, entregables, gastos, meses, fechaInicio, impuestos, descuento,
            condicionesPago, descripcion, estado }
```

### Reglas de facturación (motor)
- `importeFacturable(entregable)` = `facturacionPct/100 × base`, donde `base` es el importe de su tarea (baseFacturacion `tarea`) o la base imponible de la oferta (`oferta`).
- `facturado` = estado `entregado` o `aceptado`; `cobrado` = solo `aceptado`.
- Aviso (no error) si la suma de porcentajes por base no es 100 %: se muestra el pendiente de asignar.

## 4. Arquitectura modular

**Restricción dura:** debe seguir siendo **un solo HTML abrible con `file://`** → `file://` no permite módulos ES, así que los ficheros se **concatenan** y cada uno expone su API en un namespace único (`PL.nucleo`, `PL.modelo`, …) dentro de un IIFE. Nada de variables globales sueltas (el bug `horasMes` sombreada nace de eso).

| Capa | Fichero | Responsabilidad | No hace |
|---|---|---|---|
| Shell | `src/index.html` | Estructura DOM + placeholders de build | Nada de CSS propio ni JS |
| Estilo | `src/css/app.css` | Solo estructura y layout propio (`.pa-*`) | Colores/formas (tokens Aurora) |
| Núcleo | `src/js/nucleo.js` | `num`, `r2` (redondeo Excel), `esc`, formato, fechas, ids | Nada de DOM |
| Modelo | `src/js/modelo.js` | Esquema v3, normalización defensiva, migración v1/v2→v3, estado inicial, ejemplo-guía, plantillas | Nada de DOM |
| Cálculo | `src/js/calculo.js` | Motor **puro**: línea/subtarea/tarea, totales, impuestos, descuento, mensual, anualidades, entregables, facturación por hito | Nada de DOM |
| Comparar | `src/js/comparar.js` | Snapshots, escenarios, versiones y deltas entre dos estados | Nada de DOM |
| Almacén | `src/js/almacen.js` | localStorage versionado, import/export JSON, CSV, copias de seguridad, datos heredados | Nada de pintar |
| Vistas | `src/js/vista-*.js` (8) | Una por pestaña: pinta **solo su nodo** | Nada de estado ni cálculos |
| Eventos | `src/js/eventos.js` | Delegación `data-acc` / `data-campo`, teclado | Nada de lógica de negocio |
| Arranque | `src/js/main.js` | Wiring: carga → migra → primer render → pestaña activa | Nada de cálculo |

**Repintado por partes (rendimiento):** al teclear horas se recalcula y repinta solo KPIs + Resumen + Cronograma (con *debounce* de 120 ms); el Informe se repinta **solo si su pestaña está visible**. Hoy se repinta todo en cada tecla (197 ms medidos con el encargo real).

## 5. Contrato de verificación (no negociable)

1. **Los 47 checks del motor actual deben seguir en verde** sobre el motor nuevo.
2. **Total del encargo real (Ineco, abono único fase 2) = 587.009,36 € al céntimo** y cada tarea cuadra con su Excel.
3. `tools/verificar-motor.js` — motor puro, ≥ 70 checks (incluye entregables, facturación por hito, escenarios/versiones, migraciones v1/v2→v3, normalización defensiva).
4. `tools/verificar-dom.js` — **DOM real con jsdom** sobre `docs/index.html` compilado, ≥ 60 checks: las 8 pestañas, todos los botones `data-acc`, escenarios, versiones, round-trip de import/export, migración real y umbrales de rendimiento.
5. `tools/compilar.py` falla (exit ≠ 0) si tras ensamblar queda algún placeholder o falta alguna sección.
6. Ningún check puede pasar por "el elemento no existe": el arnés verifica primero que el selector encuentra algo.

## 6. Anti-patrones (los fallos que ya nos han costado caro)

- ❌ Selectores de estructura frágiles (`main>section` cuando las secciones van dos niveles abajo) → **siempre por id o por `data-*` estable**.
- ❌ Arneses con DOM falso que devuelven `[]` y dan **falso verde** → todo lo interactivo se prueba en DOM real.
- ❌ CSS duplicado o heredado (`src/style.css` de la v1 con clases muertas `.pa-cab/.pa-card` que pisaban al CSS nuevo) → **una sola fuente de CSS propio**.
- ❌ Clases del sistema inventadas (`.nz-field--wide`) → solo clases existentes en los packs de Aurora 7.
- ❌ Repintado global en cada pulsación de tecla.
- ❌ Variables que sombrean funciones del mismo nombre.
- ❌ `file://` + modos ES, CDN o `fetch` de ficheros locales.

## 7. Criterios de éxito

| Métrica | Objetivo |
|---|---|
| Abrir `docs/index.html` con doble clic | Todo funciona, sin errores de consola |
| Cambio de pestaña | Pinta en < 100 ms |
| Teclear una hora | < 30 ms (hoy 197 ms) |
| Crear oferta completa desde plantilla | < 2 minutos |
| Cargar el encargo real (1.700 líneas JSON) | < 1 s |
| Checks automáticos | ≥ 130 en verde (motor + DOM) |
| Tamaño del HTML final | < 350 KB |

## 8. Fases (cada una con su ✅)

1. **F1 · Andamiaje y motor** — núcleo + modelo v3 + cálculo puro + migraciones. Verde: verificar-motor ≥ 70 checks y 587.009,36 € al céntimo.
2. **F2 · Entregables y comparador** — entregables (2 niveles), facturación por hito, snapshots, escenarios, versiones y deltas.
3. **F3 · Vistas y UX** — las 8 pestañas nuevas, repintado por partes, cronograma con marcadores, informe con plan de entregas y facturación.
4. **F4 · Verificación y publicación** — ambos arneses ≥ 130 checks, compilación con guardas, README + SPEC al día, verificación visual y publicación en OfertadorConsultoria.

## 9. Plan de datos del usuario

El navegador tiene ofertas heredadas de una build antigua (*«Mi primer proyecto» / «Cliente de muestra»*). Decisión aprobada: **arrancar limpio con el ejemplo nuevo**, con **descarga automática de copia de seguridad** del estado anterior antes de reemplazarlo. Las herramientas de importación siguen aceptando los JSON antiguos v1/v2 y migrándolos.

## 10. Referencias

- Aurora 7 v7.2.0 (design system, packs incrustados) — `~/Projects/Aurora-7`.
- Encargo real de contraste: `datos/carga-ineco-abono-unico.json` (totales Excel).
- Informe de auditoría previo: sesión de 24-sep-2026 (chat de Mastermind).
