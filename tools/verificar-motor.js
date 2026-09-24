"use strict";
/* =====================================================================
   Planifica v4 — VERIFICACIÓN DEL MOTOR (sin DOM)
   Contrato de exactitud + periodos (meses editables) + entregables + fotos.

   Uso:  node tools/verificar-motor.js
   ===================================================================== */
const { cargarPL, contador, leerDato } = require("./arnes");

const CARGADO = cargarPL();
const { sandbox, PL } = CARGADO;
const t = contador("Planifica v4 — motor (sin DOM)");
const check = t.check;
const grupo = t.grupo;

if (CARGADO.faltan.length) {
  console.log("  ⚠ módulos que faltan: " + CARGADO.faltan.join(", "));
}
check("los 10 módulos del motor se cargan", CARGADO.cargados.length === 10, CARGADO.cargados.join(", "));

const N = PL.nucleo, P = PL.periodos, M = PL.modelo, C = PL.calculo, E = PL.entregables, X = PL.comparar, EJ = PL.ejemplo;
const F = PL.festivos;
const ESTADO = M.estadoInicial();
const OF = ESTADO.ofertas[0];
const PF = ESTADO.perfiles;

/* ---------- 1. Estado inicial ---------- */
t.grupo("1. Estado inicial y valores de fábrica");
check("versión de datos v4", ESTADO.version === 4, ESTADO.version);
check("7 perfiles de fábrica", ESTADO.perfiles.length === 7, ESTADO.perfiles.length);
check("perfiles con categoría válida", ESTADO.perfiles.every(p => M.CATEGORIAS_PERFIL.indexOf(p.categoria) >= 0));
check("perfiles con unidad", ESTADO.perfiles.every(p => p.unidad === "h"));
check("plantilla de fábrica con entregables", ESTADO.plantillas.length === 1 && ESTADO.plantillas[0].tareas.some(x => (x.entregables || []).length > 0));
check("1 oferta de ejemplo", ESTADO.ofertas.length === 1);
check("la oferta activa es el ejemplo", ESTADO.activa === OF.id && OF.guia === true);
check("cliente estructurado", !!OF.cliente.nombre && !!OF.cliente.ref);
check("calendario de 6 periodos", P.meses(OF.periodos) === 6, P.meses(OF.periodos));
check("hay entregables en subtareas y en la tarea completa",
  E.todos(OF).some(e => e._contexto === "subtarea") && E.todos(OF).some(e => e._contexto === "tarea"));
check("el importe del ejemplo es > 0", C.importeOferta(OF, PF) > 0, C.importeOferta(OF, PF));

/* ---------- 2. Cadena de totales ---------- */
t.grupo("\n2. Cadena de totales (contrato de exactitud)");
const st = C.subtotalOferta(OF, PF), ds = C.descuentoImporte(OF, PF), bi = C.baseImponible(OF, PF);
const iv = C.impuestoImporte(OF, PF), tt = C.totalOferta(OF, PF);
check("subtotal = consultoría + gastos", Math.abs(st - (C.importeOferta(OF, PF) + C.gastosTotal(OF))) < 0.005);
check("descuento 5 %", Math.abs(ds - N.r2(st * 0.05)) < 0.01);
check("base = subtotal − descuento", Math.abs(bi - (st - ds)) < 0.005);
check("IVA 21 % sobre la base", Math.abs(iv - N.r2(bi * 0.21)) < 0.01);
check("total = base + IVA", Math.abs(tt - (bi + iv)) < 0.005);
check("los importes por periodo suman la consultoría", (() => {
  let s = 0;
  for (let i = 0; i < P.meses(OF.periodos); i++) s += C.importePeriodo(OF, PF, i);
  return Math.abs(N.r2(s) - C.importeOferta(OF, PF)) < 0.02;
})());
check("las anualidades suman la consultoría", (() => {
  const a = C.anualidades(OF, PF);
  let s = 0; for (const k in a) s += a[k];
  return Math.abs(N.r2(s) - C.importeOferta(OF, PF)) < 0.02;
})());
check("las horas por perfil suman las horas de la oferta", (() => {
  const h = C.horasPorPerfil(OF);
  let s = 0; for (const k in h) s += h[k];
  return Math.abs(s - C.ofertaHoras(OF)) < 0.005;
})());

/* ---------- 3. Encargo real Ineco (v1 → v4) ---------- */
t.grupo("\n3. Encargo real Ineco (v1 → v4): al céntimo del Excel");
const mig = M.migrar(JSON.parse(leerDato("carga-ineco-abono-unico.json")));
const EST2 = M.normalizarEstado(mig.estado);
check("detecta el origen v1", mig.origen === 1, mig.origen);
check("migra a v4", EST2.version === 4);
check("13 perfiles migrados", EST2.perfiles.length === 13, EST2.perfiles.length);
const IN = EST2.ofertas.filter(o => o.id === "pr_ineco-abono2")[0] || EST2.ofertas[0];
check("la oferta del encargo está presente", !!IN);
check("4 tareas", N.lista(IN.tareas).length === 4, N.lista(IN.tareas).length);
check("el calendario migrado tiene 14 periodos", P.meses(IN.periodos) === 14, P.meses(IN.periodos));
check("las horas se migran de m# a p#", (() => {
  const l = IN.tareas[0].subtareas[0].lineas[0];
  const horas = Object.keys(l.horas).filter(k => k.charAt(0) === "p");
  return horas.length === 14 && l.horas.p0 !== undefined;
})());
check("v1 no inventa impuestos", IN.impuestos.tipo === "ninguno", IN.impuestos.tipo);
check("v1 no inventa entregables", N.lista(IN.entregables).length === 0);
check("v1 no inventa fotos", N.lista(IN.fotos).length === 0);

/* Reparto por tarea verificado por dos vías independientes (Python sobre el JSON
   y este motor): coinciden. El arnés antiguo traía cuatro números inventados que
   sumaban bien pero no eran de ninguna tarea, y ni se comprobaban. */
const reparto = { ta_A: 165965.73, ta_B: 137329.44, ta_C: 195871.83, ta_D: 87842.36 };
Object.keys(reparto).forEach(k => {
  const tar = N.lista(IN.tareas).filter(x => x.id === k)[0];
  const real = tar ? C.tareaImporte(tar, EST2.perfiles) : -1;
  check("reparto " + k + " = " + reparto[k].toLocaleString("es-ES", { minimumFractionDigits: 2 }), Math.abs(real - reparto[k]) < 0.005, real);
});
check("TOTAL del encargo = 587.009,36 € (Excel)", Math.abs(C.subtotalOferta(IN, EST2.perfiles) - 587009.36) < 0.005, C.subtotalOferta(IN, EST2.perfiles));
check("los 4 repartos suman el total", Math.abs(N.r2(Object.keys(reparto).reduce((s, k) => s + reparto[k], 0)) - 587009.36) < 0.005);

/* ---------- 4. Periodos: formato y edición ---------- */
t.grupo("\n4. Periodos: meses con banda de año y rótulos editables");
const per = P.conInicio(P.porDefecto(), "2026-10");
/* Calendario limpio: lo usan los checks que no deben arrastrar mutaciones previas
   (los objetos de periodos se normalizan EN SITIO, así que se reutilizan con cuidado). */
const nuevoCal = () => P.conInicio(P.porDefecto(), "2026-10");
check("el calendario empieza donde se pide", per.inicio === "2026-10", per.inicio);
check("etiqueta automática del primer mes = OCT", P.etiqueta(per, 0) === "OCT", P.etiqueta(per, 0));
check("el año NO se repite en cada columna", P.etiqueta(per, 0).indexOf("26") < 0 && P.etiqueta(per, 3) === "ENE", P.etiqueta(per, 3));
check("banda de año: 2026 y 2027", (() => {
  const b = P.bandas(P.conN(per, 6));
  return b.length === 2 && b[0].anio === 2026 && b[0].n === 3 && b[1].anio === 2027 && b[1].n === 3;
})());
check("columnas: una por mes en zoom mes", P.columnas(P.conN(per, 6)).length === 6);
check("duración legible con rango de fechas", P.duracionLegible(P.conN(per, 6)) === "6 meses · octubre de 2026 — marzo de 2027", P.duracionLegible(P.conN(per, 6)));
check("posición legible de un entregable", P.posicionLegible(P.conN(per, 6), 2) === "mes 3 de 6 (dic 2026)", P.posicionLegible(P.conN(per, 6), 2));
check("mes largo para el informe", P.mesLargo(per, 0) === "octubre de 2026", P.mesLargo(per, 0));
check("el plural de mes es correcto (no «mess»)", P.duracionLegible(P.conN(per, 6)).indexOf("mess") < 0);

/* Edición a mano */
P.editar(per, 1, "Fase 1");
check("rótulo editado a mano", P.etiqueta(per, 1) === "Fase 1");
check("la edición se marca como tal", P.estaEditada(per, 1) === true);
check("los demás siguen automáticos", P.etiqueta(per, 2) === "DIC" && P.estaEditada(per, 2) === false);
check("cuenta de rótulos editados", P.cuantasEditadas(per) === 1);
P.volverAuto(per, 1);
check("volver al automático", P.etiqueta(per, 1) === "NOV" && P.cuantasEditadas(per) === 0);
P.editar(per, 0, "S1"); P.editar(per, 1, "S2"); P.editar(per, 2, "S3");
check("varios rótulos a la vez", P.cuantasEditadas(per) === 3);
check("el CSV/HTML usan el rótulo editado", P.etiqueta(per, 1) === "S2");
P.volverTodoAuto(per);
check("volver todo al automático", P.cuantasEditadas(per) === 0 && P.etiqueta(per, 0) === "OCT");

/* Zoom trimestre */
const perT = P.conZoom(P.conN(per, 12), "trimestre");
check("zoom trimestre agrupa en 4 columnas", P.columnas(perT).length === 4, P.columnas(perT).length);
check("rótulos de trimestre T1..T4", P.columnas(perT).map(c => c.etiqueta).join(",") === "T4,T1,T2,T3", P.columnas(perT).map(c => c.etiqueta).join(","));
check("el trimestre agrupa sus meses", P.columnas(perT)[0].periodos.length === 3 && P.columnas(perT)[0].periodos[0] === 0);
check("la etiqueta manual manda también en trimestre", (() => {
  const p2 = P.conZoom(P.editar(P.conN(per, 12), 0, "Arranque"), "trimestre");
  return P.columnas(p2)[0].etiqueta === "Arranque";
})());
check("siguienteZoom alterna", P.siguienteZoom("mes") === "trimestre" && P.siguienteZoom("trimestre") === "mes");

/* Cambios de calendario */
check("conN acota entre 1 y 60", P.meses(P.conN(per, 999)) === 60 && P.meses(P.conN(per, 0)) === 1);
check("al acortar se tiran los rótulos que sobran", (() => {
  const p2 = P.editar(P.conN(P.volverTodoAuto(per), 6), 5, "Final");
  const p3 = P.conN(p2, 3);
  return P.cuantasEditadas(p3) === 0;
})());
/* Cada desplazamiento sobre su propio calendario: los objetos de periodos se
   normalizan EN SITIO, así que reutilizar el mismo falsea el resultado (este check
   pasaba precisamente porque el desfase UTC de -1 contrarrestaba el +2). */
const movMas = P.desplazar(P.conInicio(P.porDefecto(), "2026-10"), 2);
const movMenos = P.desplazar(P.conInicio(P.porDefecto(), "2026-10"), -3);
check("desplazar +2 meses (2026-10 → 2026-12)", movMas.inicio === "2026-12", movMas.inicio);
check("desplazar -3 meses (2026-10 → 2026-07)", movMenos.inicio === "2026-07", movMenos.inicio);
check("indiceDe localiza una fecha dentro del calendario", P.indiceDe(P.conN(nuevoCal(), 6), new Date(2026, 11, 15)) === 2, P.indiceDe(P.conN(nuevoCal(), 6), new Date(2026, 11, 15)));
check("indiceDe devuelve -1 fuera del calendario", P.indiceDe(P.conN(nuevoCal(), 6), new Date(2030, 0, 1)) === -1);
check("normalizar rechaza basura y cae al mes actual", P.normalizar({ inicio: "lol", n: "x", zoom: "z" }).zoom === "mes");

/* ---------- 5. Entregables ---------- */
t.grupo("\n5. Entregables (compromisos de entrega)");
const ents = E.todos(OF);
check("5 entregables en el ejemplo", ents.length === 5, ents.length);
check("4 cuelgan de subtareas y 1 de la tarea completa (nada suelto de la oferta)",
  E.porContexto(OF).deSubtarea === 4 && E.porContexto(OF).deTarea === 1 && E.porContexto(OF).deOferta === 0,
  JSON.stringify(E.porContexto(OF)));
check("los entregables de subtarea saben de qué subtarea son",
  ents.filter(e => e._contexto === "subtarea").every(e => !!e._subtareaId && !!e._subtareaNombre),
  JSON.stringify(ents.filter(e => e._contexto === "subtarea").map(e => e._subtareaNombre)));
check("deSubtarea devuelve los de esa subtarea", (() => {
  const t = OF.tareas[0], s0 = t.subtareas[0];
  return E.deSubtarea(OF, s0).length >= 1 && E.deSubtarea(OF, s0).every(e => e._subtareaId === s0.id);
})());
check("deTareaCompleta suma la tarea y sus subtareas",
  E.deTareaCompleta(OF, OF.tareas[0]).length === E.deTarea(OF, OF.tareas[0]).length + OF.tareas[0].subtareas.reduce((n, s2) => n + E.deSubtarea(OF, s2).length, 0));
check("todos traen periodo dentro del calendario", ents.every(e => e.periodo >= 0 && e.periodo < P.meses(OF.periodos)));
check("todos traen criterio de aceptación", ents.every(e => !!e.criterio));
check("todos traen responsable", ents.every(e => !!E.responsable(PF, e)), ents.filter(e => !E.responsable(PF, e)).length);
check("ordenados por periodo", ents.every((e, i) => i === 0 || ents[i - 1].periodo <= e.periodo));
check("agrupación por periodo", (() => {
  const m = E.porPeriodo(OF);
  return N.suma(Object.keys(m).map(k => m[k].length)) === ents.length;
})());
check("marcadores por periodo (para el Gantt)", E.marcadoresPorPeriodo(OF).length === P.meses(OF.periodos));
check("el último entregable del ejemplo cae en el mes 6", E.ultimo(OF).periodo === 5, E.ultimo(OF).periodo);
check("el próximo es el primero del calendario", E.proximo(OF).periodo === 0);
/* Los entregables ya NO llevan horas: las pone la subtarea con sus líneas. */
check("los entregables no guardan horas propias", E.todos(OF).every(e => e.horas === undefined), JSON.stringify(E.todos(OF).map(e => e.horas)));
check("las horas del entregable no son las que cuentan, sino las de su subtarea", (() => {
  const sub = OF.tareas[0].subtareas[0];
  const antes = C.importeOferta(OF, PF);
  const horasSub = N.r2(N.suma(sub.lineas || [], l => C.lineaHoras(l)));
  return antes > 0 && horasSub >= 0 && C.subtareaHoras(sub) === horasSub;
})(), C.subtareaHoras(OF.tareas[0].subtareas[0]) + " h");
check("etiqueta de entrega legible", /^\S+ \d{4}/.test(E.etiquetaEntrega(OF, ents[0])), E.etiquetaEntrega(OF, ents[0]));
check("moverAPeriodo cambia el mes del entregable", (() => {
  const e = E.todos(OF)[0];
  E.moverAPeriodo(OF, e.id, e._tareaId, e._subtareaId, 4);
  const ok = M.buscarEntregable(OF, e.id, e._tareaId, e._subtareaId).entregable.periodo === 4;
  E.moverAPeriodo(OF, e.id, e._tareaId, e._subtareaId, 0);
  return ok;
})());
check("moverAPeriodo acota al calendario", (() => {
  const e = E.todos(OF)[0];
  E.moverAPeriodo(OF, e.id, e._tareaId, e._subtareaId, 99);
  const v = M.buscarEntregable(OF, e.id, e._tareaId, e._subtareaId).entregable.periodo;
  E.moverAPeriodo(OF, e.id, e._tareaId, e._subtareaId, 0);
  return v === P.meses(OF.periodos) - 1;
})());
check("sin estados de seguimiento en el modelo", ents.every(e => e.estado === undefined));
check("sin % de facturación en el modelo", ents.every(e => e.facturacionPct === undefined));

/* ---------- 6. Fotos: escenarios y versiones ---------- */
t.grupo("\n6. Escenarios y versiones (fotos comparables)");
const oF = M.normalizarOferta(JSON.parse(JSON.stringify(OF)));
const base = X.resumen(oF, PF);
const f1 = X.crearFoto(oF, "escenario", "Base", "Lo ofertado");
check("escenario creado con su foto", !!f1.snapshot && X.fotosDe(oF, "escenario").length === 1);
check("la foto guarda el calendario", !!f1.snapshot.periodos && f1.snapshot.periodos.n === 6);
check("la foto no guarda importes (se recalculan)", f1.snapshot.total === undefined);
/* Recortar: la mitad de horas en la segunda tarea */
oF.tareas[1].subtareas.forEach(s => s.lineas.forEach(l => { for (const k in l.horas) l.horas[k] = Math.round(l.horas[k] / 2); }));
const recortada = X.resumen(oF, PF);
const f2 = X.crearFoto(oF, "escenario", "Recortada", "Sin la mitad del desarrollo");
check("el escenario recortado cuesta menos", recortada.total < base.total, recortada.total + " vs " + base.total);

const cmp = X.comparar(oF, PF, f1.snapshot, f2.snapshot, "Base", "Recortada");
const lineaTotal = cmp.economia.filter(l => l.clave === "total")[0];
check("el delta del TOTAL es la resta", Math.abs(lineaTotal.d - N.r2(recortada.total - base.total)) < 0.005);
check("delta negativo al recortar", lineaTotal.d < 0);
check("economía con 6 líneas", cmp.economia.length === 6);
check("estructura con periodos, tareas y subtareas",
  cmp.estructura.length === 3 && cmp.estructura.map(l => l.clave).join(",") === "periodos,tareas,subtareas",
  JSON.stringify(cmp.estructura.map(l => l.clave + "=" + l.a + "→" + l.b)));
check("horas por perfil con deltas", cmp.porPerfil.length > 0 && cmp.porPerfil.some(x => x.d !== 0));
check("importe por periodo con etiquetas", cmp.porPeriodo.length === 6 && cmp.porPeriodo.every(m => !!m.etiqueta));
check("detecta el cambio de horas de una tarea", cmp.cambios.some(c => /Horas en/.test(c.texto)), JSON.stringify(cmp.cambios.map(c => c.texto)));
check("sin rastro de facturación en la comparación", JSON.stringify(cmp).indexOf("facturado") < 0);

/* Cambios de estructura y de calendario */
const antesFx = X.foto(oF);
oF.tareas.push(M.nuevaTarea("3. Formación"));
/* Se mueve la entrega de un entregable a otro mes (el que tiene ahora no vale:
   hay que cambiarlo de verdad para que el comparador lo note). */
oF.tareas[0].subtareas[0].entregables[0].periodo = 4;
oF.periodos = P.conN(oF.periodos, 9);
const cmp2 = X.comparar(oF, PF, antesFx, X.foto(oF), "Antes", "Ahora");
check("detecta tarea nueva", cmp2.cambios.some(c => c.tipo === "alta" && /Formación/.test(c.texto)));
check("detecta entrega movida de mes", cmp2.cambios.some(c => /Entrega de/.test(c.texto)), JSON.stringify(cmp2.cambios.map(c => c.texto)));
check("detecta cambio de duración", cmp2.cambios.some(c => /Duración/.test(c.texto)));
check("no inventa cambios inexistentes", cmp2.cambios.filter(c => /renombrad/.test(c.texto)).length === 0);

/* Versión y aplicación */
const v1 = X.crearFoto(oF, "version", "v1 enviada al cliente", "Por correo");
check("versión congelada con su resumen", !!v1.resumen && v1.resumen.total > 0, v1.resumen && v1.resumen.total);
check("las fotos se separan por tipo", X.fotosDe(oF, "version").length === 1 && X.fotosDe(oF, "escenario").length === 2);
const totalAntes = C.totalOferta(oF, PF);
X.aplicarFoto(oF, f1.snapshot);
check("aplicar la foto base restaura el importe", Math.abs(C.totalOferta(oF, PF) - totalAntes) > 0.005);
check("aplicarFoto no borra las fotos", N.lista(oF.fotos).length === 3);
check("aplicar una foto nula no rompe", X.aplicarFoto(oF, null) === oF);
X.borrarFoto(oF, f2.id);
check("borrar foto por id", N.lista(oF.fotos).length === 2);

/* ---------- 7. Normalización defensiva y migraciones ---------- */
t.grupo("\n7. Normalización defensiva");
const roto = M.normalizarOferta({
  nombre: "", periodos: { inicio: "malo", n: 999, etiquetas: { 0: "x", 99: "sobra" } },
  validezDias: -4, cliente: "Texto plano v1",
  impuestos: { tipo: "loquesea", tasa: -3 }, descuento: { tipo: "loco", valor: -2 },
  gastos: [{ nombre: "x" }],
  entregables: [{ nombre: "E", periodo: 500, facturacionPct: 50, estado: "aceptado" }],
  tareas: [{ nombre: "T", entregables: [{ nombre: "E2", mes: 3 }], subtareas: [{ lineas: [{ perfilId: "pf_x", horas: { m0: 3, m99: 7 } }] }] }]
});
check("calendario acotado a 60", roto.periodos.n === 60, roto.periodos.n);
check("inicio inválido → mes válido", /^\d{4}-\d{2}$/.test(roto.periodos.inicio), roto.periodos.inicio);
check("se tiran los rótulos fuera de rango", roto.periodos.etiquetas[99] === undefined && roto.periodos.etiquetas[0] === "x");
check("validez no negativa", roto.validezDias >= 0);
check("cliente texto → objeto", typeof roto.cliente === "object" && roto.cliente.nombre === "Texto plano v1");
check("impuesto inválido → iva", roto.impuestos.tipo === "iva");
check("tasa acotada", roto.impuestos.tasa === 0, roto.impuestos.tasa);
check("descuento inválido → vacío", roto.descuento.tipo === "");
check("horas fuera de rango descartadas", roto.tareas[0].subtareas[0].lineas[0].horas.p99 === undefined);
check("horas migradas de m# a p#", roto.tareas[0].subtareas[0].lineas[0].horas.p0 === 3);
check("entregable: periodo acotado y 'mes' convertido", roto.tareas[0].entregables[0].periodo === 3 && roto.tareas[0].entregables[0].mes === undefined);
check("campos de seguimiento eliminados", roto.entregables[0].facturacionPct === undefined && roto.entregables[0].estado === undefined);
check("datos basura no rompen", !!M.normalizarEstado(null).ofertas.length && !!M.normalizarOferta(null).id);

/* Migración v3 → v4: escenarios y versiones se unifican en fotos */
const v3 = {
  version: 3, perfiles: [{ id: "pf_a", nombre: "A", tarifa: 10, categoria: "Otro" }], plantillas: [],
  proyectos: [{
    id: "pr_1", nombre: "Oferta v3", cliente: { nombre: "C" }, meses: 4, fechaInicio: "2027-01",
    impuestos: { tipo: "iva", tasa: 21 }, tareas: [{ id: "ta_1", nombre: "T", entregables: [{ id: "en_1", nombre: "E", mes: 2, facturacionPct: 30, estado: "encurso" }], subtareas: [] }],
    escenarios: [{ id: "es_1", nombre: "Base", etiqueta: "x", creado: "2026-01-01", snapshot: {} }],
    versiones: [{ id: "vs_1", etiqueta: "v1", fecha: "2026-01-02", nota: "n", snapshot: {} }]
  }]
};
const m3 = M.migrar(v3);
const E3 = M.normalizarEstado(m3.estado);
const OF3 = E3.ofertas[0];
check("v3 → v4 migra el calendario", P.meses(OF3.periodos) === 4 && OF3.periodos.inicio === "2027-01", JSON.stringify(OF3.periodos));
check("v3 → v4 unifica escenarios y versiones en fotos", N.lista(OF3.fotos).length === 2 && OF3.fotos.some(f => f.tipo === "escenario") && OF3.fotos.some(f => f.tipo === "version"));
check("v3 → v4 limpia los campos de seguimiento", OF3.tareas[0].entregables[0].facturacionPct === undefined);
check("v3 → v4 conserva los impuestos", OF3.impuestos.tipo === "iva" && OF3.impuestos.tasa === 21);
check("v3 → v4 renombra proyectos → ofertas", E3.ofertas.length === 1 && E3.proyectos === undefined);

/* ---------- 8. Redondeo ---------- */
t.grupo("\n8. Redondeo y precisión");
check("r2(0.1+0.2) = 0.3", N.r2(0.1 + 0.2) === 0.3);
check("acepta coma decimal", N.num("1,5") === 1.5);
check("el importe de línea redondea a 2 decimales", (() => {
  const of2 = M.normalizarOferta({ periodos: { n: 1 }, tareas: [{ subtareas: [{ lineas: [{ perfilId: "pf_a", horas: { p0: 3.333 } }] }] }] });
  return N.r2(C.lineaImporte(of2.tareas[0].subtareas[0].lineas[0], [{ id: "pf_a", tarifa: 3 }])) === 10;
})());
check("fechaCorta formatea dd/mm/aaaa", N.fechaCorta("2027-03-15") === "15/03/2027", N.fechaCorta("2027-03-15"));
check("fechaLarga en español", N.fechaLarga("2027-03-15").indexOf("marzo") > 0, N.fechaLarga("2027-03-15"));

/* ---------- 12. Dedicación: porcentaje ↔ horas y tope del 100 % ---------- */
t.grupo("12. Dedicación (% ↔ horas) y control del 100 %");

/* Las horas laborables de cada mes se contrastan contra un cálculo independiente
   (Python: calendar + weekday < 5, jornada de 8 h). */
const LAB_ESPERADO = [168, 160, 168, 152, 160, 176];   /* con festivos de España y Madrid */
const LAB_MOTOR = [0, 1, 2, 3, 4, 5].map(i => C.horasLaborablesMes(OF, i));
check("horas laborables de los 6 meses coinciden con el cálculo independiente",
  LAB_MOTOR.join(",") === LAB_ESPERADO.join(","), "motor " + LAB_MOTOR.join(",") + " vs esperado " + LAB_ESPERADO.join(","));
check("total de horas laborables del calendario = 984 h", C.horasLaborablesTotal(OF) === 984, C.horasLaborablesTotal(OF));
check("jornada de fábrica: 8 h al día de lunes a viernes",
  OF.jornada.horasDia === 8 && OF.jornada.diasSemana.join(",") === "1,2,3,4,5", JSON.stringify(OF.jornada));
check("84 h en octubre (168 h laborables, con el 12 de octubre festivo) son el 50 %",
  C.pctDeHoras(OF, 0, 84) === 50, C.pctDeHoras(OF, 0, 84));
check("el 50 % de octubre son 84 h", C.horasDePct(OF, 0, 50) === 84, C.horasDePct(OF, 0, 50));
check("el 100 % de febrero (160 h) son 160 h", C.horasDePct(OF, 4, 100) === 160, C.horasDePct(OF, 4, 100));
check("una jornada de 4 h/día deja el mes en la mitad",
  C.horasLaborablesMes(M.normalizarOferta({ jornada: { horasDia: 4 } }), 0) === 84);
check("trabajar los sábados añade días laborables",
  P.diasLaborables(OF.periodos, 0, [1, 2, 3, 4, 5, 6]) > P.diasLaborables(OF.periodos, 0, [1, 2, 3, 4, 5]),
  P.diasLaborables(OF.periodos, 0, [1, 2, 3, 4, 5]) + " → " + P.diasLaborables(OF.periodos, 0, [1, 2, 3, 4, 5, 6]));
check("la oferta de ejemplo NO tiene a nadie por encima del 100 %", C.excesosPerfil(OF).length === 0,
  JSON.stringify(C.excesosPerfil(OF).slice(0, 2)));
check("las horas por perfil y mes suman el esfuerzo total",
  Math.abs(N.suma(Object.keys(C.horasPerfilPeriodo(OF)).map(k => N.suma(C.horasPerfilPeriodo(OF)[k]))) - C.ofertaHoras(OF)) < 0.005);

/* Un perfil al 150 % en octubre: se tiene que ver */
const ofExc = EJ.ofertaEjemplo(PF);
ofExc.tareas.forEach(t2 => t2.subtareas.forEach(sb => sb.lineas.forEach(l => { Object.keys(l.horas).forEach(k => { l.horas[k] = 0; }); })));
ofExc.tareas[0].subtareas[0].lineas[0].perfilId = PF[0].id;
ofExc.tareas[0].subtareas[0].lineas[0].horas.p0 = 252;   /* 150 % de 168 h */
const exc = C.excesosPerfil(ofExc);
check("detecta a un perfil por encima del 100 % en un mes", exc.length === 1, JSON.stringify(exc));
check("el exceso trae perfil, mes, horas, límite y porcentaje",
  exc[0] && exc[0].perfilId === PF[0].id && exc[0].periodo === 0 && exc[0].horas === 252 && exc[0].limite === 168 && exc[0].pct === 150,
  JSON.stringify(exc[0]));
check("el 100 % justo no se considera exceso", (() => {
  const of2 = EJ.ofertaEjemplo(PF);
  of2.tareas.forEach(t2 => t2.subtareas.forEach(sb => sb.lineas.forEach(l => { Object.keys(l.horas).forEach(k => { l.horas[k] = 0; }); })));
  of2.tareas[0].subtareas[0].lineas[0].perfilId = PF[0].id;
  of2.tareas[0].subtareas[0].lineas[0].horas.p0 = 168;
  return C.excesosPerfil(of2).length === 0;
})());

/* ---------- 13. Entregables en los tres niveles ---------- */
t.grupo("13. Entregables: oferta, tarea y subtarea");
check("se puede colgar un entregable en una subtarea concreta", (() => {
  const of2 = EJ.ofertaEjemplo(PF);
  const s0 = of2.tareas[0].subtareas[0];
  const antes = E.deSubtarea(of2, s0).length;
  const e = M.colgarEntregable(of2, "Prueba", "subtarea", 1, of2.tareas[0].id, s0.id);
  const r = M.buscarEntregable(of2, e.id, "", s0.id);
  return E.deSubtarea(of2, s0).length === antes + 1 && r && r.contexto === "subtarea" && r.sub.id === s0.id;
})());
check("y en la tarea completa", (() => {
  const of2 = EJ.ofertaEjemplo(PF);
  const t0 = of2.tareas[0];
  const antes = E.deTarea(of2, t0).length;
  const e = M.colgarEntregable(of2, "Prueba", "tarea", 1, t0.id);
  const r = M.buscarEntregable(of2, e.id, t0.id);
  return E.deTarea(of2, t0).length === antes + 1 && r && r.contexto === "tarea";
})());
check("la migración de datos antiguos deja los entregables en la tarea",
  N.lista(M.migrar({ version: 1, perfiles: [], proyectos: [{ id: "p", nombre: "P", tareas: [{ id: "t", nombre: "T", entregables: [{ id: "e", nombre: "E" }] }] }] }).estado.ofertas[0].tareas[0].entregables).length === 1);

/* ---------- 14. Calendario por semanas (y conversión) ---------- */
t.grupo("14. Calendario por semanas y conversión meses ⇄ semanas");
const U = PL.unidades;
check("el calendario arranca por meses", P.normalizar(OF.periodos).unidad === "mes");
check("semana ISO correcta (1-ene-2026 es S1, 28-dic-2026 es S53)",
  P.semanaISO(new Date(2026, 0, 1)) === 1 && P.semanaISO(new Date(2026, 11, 28)) === 53,
  P.semanaISO(new Date(2026, 0, 1)) + "/" + P.semanaISO(new Date(2026, 11, 28)));

const ofSem = EJ.ofertaEjemplo(PF);
const hAntes = C.ofertaHoras(ofSem), iAntes = C.importeOferta(ofSem, PF);
const rConv = U.convertirOferta(ofSem, "semana");
check("la conversión devuelve el resumen", !!rConv && rConv.a === "semana" && rConv.nSemanas > 20, JSON.stringify(rConv));
check("6 meses de octubre a marzo son 27 semanas", rConv.nSemanas === 27, rConv.nSemanas);
check("las horas se conservan al pasar a semanas", Math.abs(C.ofertaHoras(ofSem) - hAntes) < 0.02, C.ofertaHoras(ofSem) + " vs " + hAntes);
check("y el importe también", Math.abs(C.importeOferta(ofSem, PF) - iAntes) < 0.02, C.importeOferta(ofSem, PF) + " vs " + iAntes);
check("una semana completa tiene 40 h laborables (8 h × 5 días)", C.horasLaborablesMes(ofSem, 1) === 40, C.horasLaborablesMes(ofSem, 1));
check("las etiquetas son S##", /^S\d{1,2}$/.test(P.etiqueta(ofSem.periodos, 3)), P.etiqueta(ofSem.periodos, 3));
check("la duración se cuenta en semanas", P.duracionLegibleUnidad(ofSem.periodos).indexOf("27 semanas") === 0,
  P.duracionLegibleUnidad(ofSem.periodos));
check("los entregables caen dentro del calendario semanal",
  E.todos(ofSem).every(e => e.periodo >= 0 && e.periodo < P.meses(ofSem.periodos)));
check("nadie pasa del 100 % por el simple hecho de convertir",
  C.excesosPerfil(ofSem).length === 0, JSON.stringify(C.excesosPerfil(ofSem).slice(0, 3)));
const rVuelta = U.convertirOferta(ofSem, "mes");
check("la vuelta a meses también conserva el total",
  Math.abs(C.ofertaHoras(ofSem) - hAntes) < 0.02 && Math.abs(C.importeOferta(ofSem, PF) - iAntes) < 0.02,
  C.ofertaHoras(ofSem) + " h · " + C.importeOferta(ofSem, PF) + " €");
check("el rango de vuelta cubre septiembre a marzo (7 meses)", rVuelta.nMesesDestino === 7, rVuelta.nMesesDestino);
check("no se convierte a la unidad que ya está puesta", U.convertirOferta(ofSem, "mes") === null);

/* ---------- 13. Festivos (España y Madrid) y jornada por día ---------- */
grupo("13. Festivos (España y Madrid) y jornada por día");

check("el Viernes Santo se calcula sin listas: Pascua 2026 = 5 de abril",
  N.diaISO(F.pascua(2026)) === "2026-04-05", N.diaISO(F.pascua(2026)));
check("y Pascua 2027 = 28 de marzo", N.diaISO(F.pascua(2027)) === "2027-03-28", N.diaISO(F.pascua(2027)));
check("Viernes Santo 2026 = 3 de abril", N.diaISO(F.viernesSanto(2026)) === "2026-04-03", N.diaISO(F.viernesSanto(2026)));
check("Viernes Santo 2027 = 26 de marzo", N.diaISO(F.viernesSanto(2027)) === "2027-03-26", N.diaISO(F.viernesSanto(2027)));
check("traen España, Madrid y locales",
  F.deEspanaMadrid(2026).some(x => x.ambito === "España") &&
  F.deEspanaMadrid(2026).some(x => x.ambito === "Madrid") &&
  F.deEspanaMadrid(2026).some(x => x.ambito === "Local"),
  JSON.stringify(F.deEspanaMadrid(2026).map(x => x.fecha)));
check("la oferta de ejemplo trae los festivos del calendario", OF.jornada.festivos.length > 0, OF.jornada.festivos.length);
check("el 12 de octubre de 2026 está entre ellos", OF.jornada.festivos.some(f => f.fecha === "2026-10-12"));
check("octubre tiene 168 h laborables (176 menos el 12 de octubre)", C.horasLaborablesMes(OF, 0) === 168, C.horasLaborablesMes(OF, 0));
check("diciembre también 168 (8 y 25 fuera)", C.horasLaborablesMes(OF, 2) === 168, C.horasLaborablesMes(OF, 2));

/* Viernes corto: de lunes a jueves 8 h y el viernes 6 */
const OFV = M.normalizarOferta(JSON.parse(JSON.stringify(OF)));   /* clon: normalizar es in-place */
OFV.jornada = M.normalizarJornada(Object.assign({}, OFV.jornada, { horasPorDia: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 6 } }));
check("con el viernes de 6 h, octubre baja de 168 a 158 (16 días de 8 h + 5 viernes de 6)",
  C.horasLaborablesMes(OFV, 0) === 158, C.horasLaborablesMes(OFV, 0));
check("y queda guardado día a día", C.jornada(OFV).horasPorDia[5] === 6, JSON.stringify(C.jornada(OFV).horasPorDia));
check("un día laborable nunca se queda con 0 horas",
  M.normalizarJornada({ diasSemana: [1, 2, 3, 4, 5, 6], horasPorDia: { 6: 0 } }).horasPorDia[6] === 8,
  M.normalizarJornada({ diasSemana: [1, 2, 3, 4, 5, 6], horasPorDia: { 6: 0 } }).horasPorDia[6]);
check("quitar un festivo sube las horas del mes", (() => {
  const OF2 = M.normalizarOferta(JSON.parse(JSON.stringify(OF)));
  OF2.jornada.festivos = OF2.jornada.festivos.filter(f => f.fecha !== "2026-10-12");
  return C.horasLaborablesMes(OF2, 0) === 176;
})(), C.horasLaborablesMes(M.normalizarOferta(JSON.parse(JSON.stringify(OF))), 0));
check("el contrato sigue intacto con los festivos puestos",
  Math.abs(C.ofertaHoras(OF) - 346) < 0.02 && Math.abs(C.importeOferta(OF, PF) - 16352) < 0.05,
  C.ofertaHoras(OF) + " h · " + C.importeOferta(OF, PF) + " €");

t.resumen();
process.exit(t.ko ? 1 : 0);
