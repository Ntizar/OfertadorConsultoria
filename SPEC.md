# SPEC — Planifica v4 «solo ofertas»

> Contrato de trabajo. Aprobado por David el 24-sep-2026.
> Si algo del código contradice esta spec, manda la spec: o se corrige el código o se actualiza la spec, pero no se avanza con la duda.

## 1. Visión

Planifica es una herramienta para **crear ofertas de consultoría**, no para gestionar proyectos. Escribe una oferta con sus tareas, perfiles, horas y entregables, la ve en un diagrama de Gantt, la cierra económicamente y la imprime con su marca. Nada de seguimiento ni facturación.

La versión anterior arrastraba el formato de la v2 (8 pestañas, tres ventanas emergentes, meses «oct 26 · nov 26 · dic 26» y un módulo de seguimiento-facturación que no aportaba). Decisión del usuario: **reescribir desde cero con lo aprendido**, incluido el motor, conservando el contrato de exactitud como criterio de aceptación.

## 2. Alcance

### Sí
- Cinco pestañas: **Trabajo, Oferta, Resumen, Informe, Ajustes**.
- Tareas → subtareas → líneas **perfil × mes** (horas por mes).
- **Entregables en dos niveles**: dentro de una tarea y sueltos en la oferta (gestión, reuniones, informes). Con nombre, descripción, criterio de aceptación, responsable (perfil), mes de entrega, fecha exacta opcional y horas estimadas (orientativas: **no** suman al total).
- **Calendario editable**: mes de inicio, duración, desplazamiento, zoom meses/trimestres y **rótulos de periodo renombrables a mano** desde el propio cronograma, con vuelta al automático.
- **Diagrama de Gantt**: banda de año, columnas de periodo, barras por tarea y subtarea, rombo por entregable, horas por fila, clic para ir a la tarea.
- Economía: gastos generales, descuento (porcentaje o fijo), impuestos (IVA/IRPF/ninguno, incluido o no) y cadena de totales.
- **Escenarios** (alternativas con nombre) y **versiones** (copias congeladas) con comparación contra la oferta actual.
- Marca blanca, modo «solo tiempos» (oculta importes), plantillas de tareas, perfiles con tarifa y categoría, exportación JSON/CSV e importación.
- Todo en castellano, un solo fichero autocontenido, abrible con doble clic, sin conexión, datos en el navegador.

### No
- Seguimiento de ejecución: estados de entregable, avance, vencimientos.
- Facturación: porcentaje por hito, plan de facturación, cobrado/pendiente.
- Deshacer/rehacer y pegar horas desde Excel (descartados explícitamente).
- Servidor, cuentas, nube, CDN y dependencias en tiempo de ejecución.

## 3. Arquitectura

Módulos **concatenados** (no módulos ES: `file://` no los permite) y **ensamblados** por `tools/compilar.py` en `docs/index.html`, junto a Aurora 7 v7.2.0 (10 packs) y el CSS propio.

```
nucleo → periodos → modelo → ejemplo → calculo → entregables → comparar → almacen
      → gantt → vistas → vista-{trabajo,oferta,resumen,informe,ajustes}
      → acciones → eventos → main
```

Reglas:
1. **El motor es puro**: recibe `(oferta, perfiles)` y no toca el DOM.
2. **Las vistas no rompen la aplicación**: si falta un nodo, no pasa nada; y no repintan si el HTML generado no ha cambiado (así no se pierde el foco).
3. **Todo cambio con cifras repinta todas las vistas.** Mientras se escriben horas se repinta todo menos el editor; al renombrar un mes, todo menos el Gantt.
4. **Cero ventanas emergentes**: plantillas, escenarios y versiones viven en línea. Solo se usa `confirm()` para operaciones destructivas o masivas.
5. **Diseño**: la aplicación solo aporta clases `.pa-*`; toda clase `nz-*` usada debe existir en Aurora (lo auditía `tools/auditar-wiring.py`). **Acento naranja** de Aurora (`--nz-accent`), un solo acento.
6. **Fechas siempre en hora local**: prohibido `toISOString()` sobre fechas locales (en UTC+1/+2 devuelve el día anterior). Se usan `nucleo.mesISO` / `nucleo.diaISO`.

## 4. Modelo de datos (v4)

```
ESTADO { version:4, marca{nombre,sub,moneda,logo}, mostrarImportes, guiaVista,
         perfiles[], perfilesInactivos[], plantillas[], ofertas[], activa, ui{pestana} }

OFERTA { id, nombre, guia, cliente{nombre,contacto,ref}, estado, fecha, validezDias,
         periodos{inicio:"aaaa-mm", n, zoom:"mes"|"trimestre", etiquetas{}},
         descripcion, condicionesPago, impuestos{tipo,tasa,incluido}, descuento{tipo,valor},
         gastos[], entregables[], tareas[], fotos[] }

TAREA      { id, nombre, entregables[], subtareas[] }
SUBTAREA   { id, nombre, _abierta, lineas[] }
LINEA      { id, perfilId, horas{p0..pN} }
ENTREGABLE { id, nombre, descripcion, criterio, periodo, fecha, responsablePerfilId, horas }
FOTO       { id, tipo:"escenario"|"version", nombre, etiqueta, nota, fecha, snapshot }
```

- Las horas viven en `horas.p{i}` por mes; el prefijo `p` es deliberado (antes `m`) para que la migración sea explícita.
- La migración lee `version` 1/2/3 y traduce: `proyectos`→`ofertas`, `meses`+`fechaInicio`→`periodos`, `m#`→`p#`, entregables sin estado ni facturación.

## 5. Arranque y datos heredados

- Si hay datos v4, se cargan.
- Si **no** hay datos v4 pero sí de versiones anteriores: la aplicación **arranca con la oferta de ejemplo** y el aviso ofrece tres salidas — **traer** las ofertas antiguas (descargando antes una copia de seguridad y activando la última traída), **descargar una copia** o **descartarlas**. Nunca se borra nada sin decidirlo el usuario.
- `Ctrl+S` descarga una copia completa; Ajustes ofrece copia, importación y borrado total.

## 6. Criterios de éxito

1. **250 comprobaciones en verde**: motor 127, DOM real 123 y la auditoría de conexiones sin fallos.
2. **Contrato de exactitud**: el encargo de referencia cuadra **587.009,36 €** al céntimo y el reparto por tarea coincide con el Excel (verificado por dos vías independientes).
3. **Rendimiento**: menos de 30 ms por pulsación con el encargo real de 1.700 líneas (medido: 10 ms).
4. **Cero botones muertos**: todo `data-acc` tiene acción y todo nodo que pide el JS existe.
5. **Cero clases inventadas**: toda clase `nz-*` está definida en un pack de Aurora.
6. Los meses se pueden renombrar desde el cronograma y el cambio se ve en el editor, el resumen y el informe.

## 7. Anti-patrones (prohibido)

- Repintar solo la pestaña activa dejando las demás desfasadas.
- Ventanas emergentes propias para pedir datos.
- Clases `nz-*` que no existan en Aurora, o colores a mano en vez de tokens.
- Funciones del motor que dependan del DOM o del estado global.
- `toISOString()` sobre fechas locales.
- Arnés de verificación con DOM simulado que devuelve listas vacías (falso verde: así se colaron 47 comprobaciones en verde con la aplicación rota).
- Añadir seguimiento o facturación: no es el objeto de esta herramienta.

## 8. Fases

| Fase | Contenido | Estado |
|---|---|---|
| F1 | Modelo v4, migración y ejemplo | ✅ |
| F2 | Motor de cálculo + periodos + entregables + fotos | ✅ |
| F3 | Gantt, vistas, acciones y repintado conectado | ✅ |
| F4 | Arneses (motor, DOM, conexiones) y contrato de exactitud | ✅ |
| F5 | Publicación y verificación visual | ⏳ |
