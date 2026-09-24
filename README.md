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
| **Trabajo** | Calendario + **Gantt** + editor en **cuatro pasos**: tareas y subtareas → entregables → perfiles → horas por perfil y mes |
| **Oferta** | Datos comerciales (cliente, referencia, estado, validez), **jornada**, gastos generales y economía |
| **Perfiles** | El catálogo de puestos con su **precio por hora**: ficha por perfil, y **guardar/cargar** en un fichero |
| **Carga** | La planificación de un vistazo: **ocupación de cada perfil periodo a periodo**, qué le queda libre a cada uno y el reparto por subtarea |
| **Resumen** | Totales, esfuerzo por perfil, por tarea y por periodo; **escenarios y versiones** comparadas |
| **Informe** | El documento final (con el calendario dentro), con marca blanca, para imprimir o exportar a PDF |
| **Ajustes** | Marca, plantillas de tareas y datos (copias, importar/exportar) |

Los **entregables** cuelgan de cada **subtarea** (donde se entrega el trabajo de verdad), de la **tarea completa** o de la **oferta** (gestión, reuniones).

### Por meses o por semanas

El calendario se planifica en la unidad que te encaje: **meses** o **semanas** (40 h por semana completa). Al cambiar de unidad, las horas se reparten por los **días laborables reales** de cada periodo y **el total se mantiene** (hay un check que lo verifica). Con el calendario semanal el diagrama añade una **banda de trimestres** para no perderse entre 52 columnas.

### Plegar y desplegar

Cada tarea tiene su botón para plegarla. Arriba del editor hay cuatro atajos: **Desplegar todo · Sólo tareas · Plegar subtareas · Plegar tareas**. Así se ve la oferta entera de un vistazo o se baja al detalle sin perder el sitio.

### El hueco, a la vista antes de escribir

En la tabla de horas **cada celda te dice su hueco antes de que escribas**:

- **El fondo de la celda** lleva una sombra con la parte de la jornada de ese perfil ya comprometida en ese periodo, y un número con su % de ocupación.
- **El hueco del campo** dice en texto lo que queda: `35 % libres`. Cuando ya no cabe nada, la celda se pone en ámbar y el campo dice **`sin hueco`**.
- Si aún así pides de más, **se queda en el máximo** y te explica a quién y por qué: *«Jefe/a de proyecto sólo puede llegar a 30 h en oct 2026 (17 %)»*, o *«ya está al 100 % en oct 2026: no cabe nada más»*.
- Todo se **recalcula solo** mientras escribes: si tocas una línea, las demás líneas de ese mismo perfil actualizan su hueco al momento.

### Vista de Carga

Para ver la planificación entera de un vistazo, sin tocar nada:

- **Mapa de ocupación** perfiles × periodos, con color por tramo (hueco → media carga → al límite → 100 % → pasado) y el % en cada celda.
- **Disponibilidad por perfil**: horas asignadas, laborables del calendario, dedicación media y lo que le queda libre.
- **Reparto por subtarea y perfil**: quién hace qué, con horas e importe por subtarea.

### Horas por % de dedicación

Las horas cambian de mes a mes y nadie sabe si «40 h» son mucho o poco. Por eso el esfuerzo se teclea en **dedicación**: escribes `50` y significa *media jornada ese mes*; la aplicación calcula las horas con la **jornada** (8 h/día de lunes a viernes, configurable en Oferta) y los días laborables reales de cada mes.

- También puedes escribir `88h` o `50%` a mano: el campo entiende las dos unidades.
- **No deja pasar del 100 %**: si pides más de lo que cabe, se queda en el máximo libre de ese perfil ese mes y te dice cuánto quedaba. El campo indica siempre cuántas horas le quedan libres.
- Cada tarea lleva un **color** (y sus subtareas y entregables lo heredan) para seguir el hilo de un vistazo.
- Las horas siguen siendo el dato guardado, así que el contrato de exactitud no se toca.

### Un color por tarea

Cada tarea lleva un tono del sistema y sus **subtareas y entregables lo heredan**: se sigue el hilo de un vistazo en el árbol, en el diagrama y en el informe.

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

## Cómo se trabaja una oferta (el orden de la pestaña Trabajo)

```
1 · Creo las tareas y sus subtareas
2 · Añado los entregables de cada subtarea (o de la tarea completa)
3 · Cargo los perfiles del catálogo (o los añado en su pestaña)
4 · Reparto dedicación: % por perfil y mes
```

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

**374 comprobaciones** en total, todas en verde:

| Arnés | Qué cubre |
|---|---|
| `verificar-motor.js` (160) | cadena de totales, redondeo, periodos y rótulos, entregables en los tres niveles, **dedicación (% ↔ horas, jornada y tope del 100 %)**, **conversión meses ⇄ semanas** (días laborables reales, total conservado), escenarios y versiones, migración y normalización defensiva |
| `verificar-dom.js` (214) | arranque sin errores, las **7 pestañas**, el **hueco que anuncia cada celda** (y que se calcula donde toca, no en otra celda), la **vista de Carga**, edición de rótulos desde el Gantt, **calendario por meses o semanas con banda de trimestres**, **plegado por niveles**, **borrado con confirmación**, **autolímite del 100 %**, color por tarea, campo de esfuerzo con `%` y `h`, **que un cambio se vea en todas las vistas**, responsive, catálogo de perfiles, exportaciones y rendimiento |
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
