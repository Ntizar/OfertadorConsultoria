# Planifica

**Creador de ofertas de consultoría.** Aplicación web de un solo fichero: se abre con doble clic, funciona sin conexión y sin instalar nada. Los datos no salen de tu equipo.

Hecho con ❤️ por David Antizar

---

## Qué hace

Una **oferta** con tareas, subtareas, perfiles con tarifa por hora y **entregables** repartidos por un calendario. Todo se recalcula al instante y queda plasmado en un **diagrama de Gantt** y en un **informe** listo para imprimir o guardar en PDF.

Es una herramienta de **ofertas**, no de seguimiento: no hay estados de ejecución, ni avance, ni facturación.

### Las cinco pestañas

| Pestaña | Para qué |
|---|---|
| **Trabajo** | Calendario + **Gantt** + editor de tareas, entregables, subtareas y horas por perfil |
| **Oferta** | Datos comerciales (cliente, referencia, estado, validez), gastos generales y economía |
| **Resumen** | Totales, esfuerzo por perfil, por tarea y por periodo; **escenarios y versiones** comparadas |
| **Informe** | El documento final, con marca blanca, para imprimir o exportar a PDF |
| **Ajustes** | Marca, biblioteca de perfiles, plantillas de tareas y datos (copias, importar/exportar) |

### El calendario y los meses

- Banda de **año** que agrupa sus meses, y debajo una columna por mes: `2026 | 2027` con `OCT NOV DIC ENE FEB MAR`. El año no se repite en cada columna.
- Los rótulos son **editables a mano**: haces clic en la cabecera de un mes y escribes lo que quieras («Fase 1», «S1», «Trim. 1»). Botón para **volver a los automáticos**.
- **Inicio y duración** se cambian desde el propio calendario, y los botones ◀ ▶ desplazan el proyecto un mes.
- Vista **por meses o por trimestres** (T1…T4) para proyectos largos.

### El diagrama de Gantt

- Una fila por **tarea**, con sus **subtareas** indentadas, y una fila por **entregable** con su rombo ◆ en el mes de entrega.
- Las barras marcan los meses con esfuerzo, con las **horas totales** a la derecha de cada fila.
- Clic en cualquier fila para ir a esa tarea en el editor.

### Todo conectado

Cualquier cambio con cifras repinta **todas** las vistas: los indicadores, el Gantt, el calendario, el resumen y el informe. Mientras escribes horas se repinta todo menos el editor —para que no pierdas el foco— y al renombrar un mes, todo menos el Gantt, por lo mismo.

Rendimiento medido con el encargo real de 1.700 líneas: **10 ms por pulsación**.

### Escenarios y versiones

- **Escenario**: una copia con nombre para explorar una alternativa («recortada», «ampliada»). No altera la oferta.
- **Versión**: una copia congelada de lo que se envió («v1 enviada al cliente»). Al restaurar, la actual se guarda sola.
- Ambas se **comparan** contra la oferta: economía, estructura, horas e importe por perfil y por periodo, más la lista de qué ha cambiado.

---

## Uso

```
1. Abre docs/index.html con doble clic (o publícalo como web de marca blanca).
2. Pestaña Trabajo: pon el mes de inicio y la duración, y renombra los meses si quieres.
3. Añade tareas, sus entregables y sus subtareas con las líneas perfil × mes.
4. Revisa Resumen y ajusta la Oferta (gastos, impuestos, descuento).
5. Imprime el Informe o guárdalo en PDF (Ctrl+P).
6. Publica una versión antes de enviarla al cliente.
```

Los datos se guardan en el navegador (`localStorage`). Ajustes → *Copia completa* descarga un JSON con todo; `Ctrl+S` hace lo mismo.

---

## Estructura del proyecto

```
src/
  index.html            armazón: cabecera, 5 pestañas y sus secciones
  css/app.css           solo estructura y disposición (.pa-*)
  js/
    nucleo.js           números, texto, ids y fechas locales
    periodos.js         calendario: meses, rótulos editables, años, zoom
    modelo.js           esquema de datos, normalización y migración
    ejemplo.js          perfiles, plantilla y oferta de ejemplo
    calculo.js          motor de importes (puro)
    entregables.js      entregables de tarea y de oferta
    comparar.js         escenarios, versiones y deltas
    almacen.js          persistencia, importar/exportar, CSV
    gantt.js            diagrama: barras, rombos y cabecera de periodos
    vistas.js           ayudas de vista (tablas, importes, avisos)
    vista-trabajo.js    calendario + Gantt + editor
    vista-oferta.js     datos comerciales, gastos y economía
    vista-resumen.js    totales por perfil/tarea/periodo + escenarios
    vista-informe.js    el documento imprimible
    vista-ajustes.js    marca, perfiles, plantillas y datos
    acciones.js         lo que hace cada botón
    eventos.js          delegación de eventos
    main.js             arranque y repintado conectado
tools/
  compilar.py           ensambla todo en docs/index.html (Aurora 7 incrustado)
  verificar.js          runner: compila y pasa todos los arneses
  verificar-motor.js    motor: cálculo, periodos, entregables, fotos (127)
  verificar-dom.js      DOM real con jsdom: pestañas, Gantt, conectividad (123)
  auditar-wiring.py     botones sin acción, nodos fantasma, clases inventadas
  smoke.js              arranque en seco: caza errores de carga
datos/                  encargo real de referencia (Ineco)
docs/index.html         aplicación compilada (lo que se abre y se publica)
```

**Arquitectura**: los módulos se **concatenan** (no son módulos ES) porque `file://` no los permite; el requisito es que la aplicación funcione con doble clic. `docs/index.html` es autocontenido: Aurora 7 v7.2.0 (10 packs) + el CSS propio + los 18 módulos en un único fichero.

---

## Verificación

```bash
node tools/verificar.js          # compila y pasa todo
py -3.12 tools/compilar.py       # solo compilar
node tools/smoke.js              # arranque en seco
```

**250 comprobaciones** en total, todas en verde:

| Arnés | Qué cubre |
|---|---|
| `verificar-motor.js` (127) | cadena de totales, redondeo, periodos y rótulos, entregables, escenarios y versiones, migración y normalización defensiva |
| `verificar-dom.js` (123) | arranque sin errores, las 5 pestañas, edición de rótulos desde el Gantt, inicio/duración/zoom, barras y rombos, alta y baja de todo, **que un cambio se vea en las 5 vistas**, exportaciones, migración con aviso y rendimiento |
| `auditar-wiring.py` | todo botón tiene acción, todo nodo existe, toda clase `nz-*` es de Aurora, ningún export sin declarar |

### Contrato de exactitud

El encargo real de referencia (`datos/carga-ineco-abono-unico.json`) debe seguir cuadrando **al céntimo: 587.009,36 €**, y el reparto por tarea debe coincidir con el del Excel. Se verifica en el arnés del motor y, de nuevo, dentro del arnés de DOM tras migrar los datos. El reparto se calculó por dos vías independientes (Python y el motor) porque los cuatro totales por tarea del arnés antiguo resultaron ser inventados: sumaban bien, pero no correspondían a ninguna tarea.

`compilar.py` **falla a propósito** si falta un módulo, queda un marcador sin sustituir, falta una sección o vuelve el selector roto `main>section` que dejó las pestañas muertas en la versión anterior.

---

## Diseño

Design system **Aurora 7 v7.2.0**, incrustado y sin CDN. La aplicación solo aporta clases `.pa-*` de estructura: colores, formas y tipografía salen de los tokens `--nz-*`. El **acento naranja** es el propio de Aurora (`--nz-accent: var(--nz-orange-500)`), usado en las barras del Gantt, los rombos de entregable, las medidas y el foco.

---

## Licencia

Uso personal y profesional de su autor. Los datos que introduzcas son tuyos y no salen del navegador.
