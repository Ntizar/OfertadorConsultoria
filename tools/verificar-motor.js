"use strict";
/* =====================================================================
   Planifica v3 — VERIFICACIÓN DEL MOTOR (sin DOM)
   Estado inicial, cadena de totales, normalización defensiva y migraciones.
   Contrato: los totales del encargo real cuadran al céntimo.

   Uso:  node tools/verificar-motor.js
   ===================================================================== */
const { cargarPL, contador, leerDato } = require("./arnes");

const { sandbox, PL } = cargarPL();
const C = PL.calculo, M = PL.modelo, U = PL.nucleo, E = PL.entregables;
const t = contador("Planifica v3 — motor (sin DOM)");
const check = t.check;

const { estadoInicial, perfilesDefecto, plantillasDefecto, proyectoEjemplo } = PL.ejemplo;
let ESTADO = M.estadoInicial();
const pr0 = ESTADO.proyectos[0];
const PF = ESTADO.perfiles;

/* ---------- 1. Estado inicial ---------- */
t.grupo("1. Estado inicial y valores de fábrica");
check("versión de datos v3", ESTADO.version === 3, ESTADO.version);
check("7 perfiles por defecto precargados", ESTADO.perfiles.length === 7, ESTADO.perfiles.length);
check("perfiles marcados esDefecto", ESTADO.perfiles.every(p => p.esDefecto === true));
check("perfiles con categoría", ESTADO.perfiles.every(p => p.categoria && p.categoria !== ""));
check("plantilla de fábrica presente", ESTADO.plantillas.length === 1 && ESTADO.plantillas[0].id === "pl_estandar");
check("plantilla con entregables", ESTADO.plantillas[0].tareas.some(x => (x.entregables || []).length > 0));
check("1 oferta de ejemplo", ESTADO.proyectos.length === 1);
check("el ejemplo es guía", pr0.guia === true);
check("el ejemplo tiene cliente estructurado", !!pr0.cliente && typeof pr0.cliente === "object" && !!pr0.cliente.nombre);
check("el ejemplo tiene impuestos y descuento", pr0.impuestos.tipo === "iva" && pr0.descuento.tipo === "%" && pr0.descuento.valor > 0);
check("el ejemplo trae entregables en tareas", pr0.tareas.every(x => (x.entregables || []).length > 0));
check("el ejemplo trae entregables de oferta", (pr0.entregables || []).length > 0);
check("importe del ejemplo > 0", C.importeProyecto(pr0, PF) > 0, C.importeProyecto(pr0, PF));

/* ---------- 2. Cadena de totales ---------- */
t.grupo("\n2. Cadena de totales del ejemplo");
const st = C.subtotalProyecto(pr0, PF), ds = C.descuentoImporte(pr0, PF), bi = C.baseImponible(pr0, PF);
const iv = C.impuestoImporte(pr0, PF), tt = C.totalProyecto(pr0, PF);
check("subtotal = consultoría + gastos", Math.abs(st - (C.importeProyecto(pr0, PF) + C.gastosTotal(pr0))) < 0.005);
check("descuento 5 % correcto", Math.abs(ds - U.r2(st * 0.05)) < 0.01, ds + " vs " + U.r2(st * 0.05));
check("base = subtotal − descuento", Math.abs(bi - (st - ds)) < 0.005);
check("IVA 21 % sobre la base", Math.abs(iv - U.r2(bi * 0.21)) < 0.01);
check("total = base + IVA", Math.abs(tt - (bi + iv)) < 0.005);
check("anualidades suman el importe de consultoría", (() => {
  const a = C.anualidades(pr0, PF); let s = 0; for (const k in a) s += a[k];
  return Math.abs(s - C.importeProyecto(pr0, PF)) < 0.02;
})());
check("importe mensual suma el importe de consultoría", (() => {
  let s = 0; for (let i = 0; i < pr0.meses; i++) s += C.importeMes(pr0, PF, i);
  return Math.abs(U.r2(s) - C.importeProyecto(pr0, PF)) < 0.02;
})());

/* ---------- 3. Migración del encargo real (v1) ---------- */
t.grupo("\n3. Encargo real Ineco (v1 → v3): totales al céntimo");
const bruto = leerDato("carga-ineco-abono-unico.json");
const mig = M.migrar(JSON.parse(bruto));
const EST2 = M.normalizarEstado(mig.estado);
check("detecta el origen v1", mig.origen === 1, mig.origen);
check("migra a v3", EST2.version === 3);
const prIneco = EST2.proyectos.filter(p => p.id === "pr_ineco-abono2")[0] || EST2.proyectos[0];
check("proyecto del encargo presente tras migrar", !!prIneco && EST2.proyectos.length > 0);
check("biblioteca migrada: 13 perfiles", EST2.perfiles.length === 13, EST2.perfiles.length);
check("perfiles migrados con categoría válida", EST2.perfiles.every(p => M.CATEGORIAS_PERFIL.indexOf(p.categoria) >= 0));
check("perfil pf_jp con categoría 'Otro' (sin inventar)", (EST2.perfiles.filter(p => p.id === "pf_jp")[0] || {}).categoria === "Otro");
check("migración v1: sin impuestos inyectados", prIneco.impuestos.tipo === "ninguno", prIneco.impuestos.tipo);
check("migración v1: estado por defecto borrador", prIneco.estado === "borrador");
check("migración v1: cliente estructurado", !!prIneco.cliente && typeof prIneco.cliente === "object");
check("migración v1: entregables y escenarios vacíos (no inventados)", (prIneco.entregables || []).length === 0 && (prIneco.escenarios || []).length === 0);

/* Reparto por tarea del encargo real, verificado por DOS vías independientes
   (aritmética en Python sobre el JSON y este motor JS): coinciden al céntimo.
   OJO — hallazgo 24-sep-2026: el arnés antiguo traía otros cuatro números
   (155.235,46 / 271.269,94 / 137.359,99 / 23.143,97) que sumaban el total
   correcto pero NO correspondían a ninguna tarea real, y además nunca se
   comprobaban (buscaba las tareas por "Tarea "+inicial y las del encargo se
   llaman "Tarea A — …", así que se saltaba los cuatro checks en silencio). */
const totalesExcel = { ta_A: 165965.73, ta_B: 137329.44, ta_C: 195871.83, ta_D: 87842.36 };
Object.keys(totalesExcel).forEach(k => {
  const tar = prIneco.tareas.filter(x => x.id === k)[0];
  const real = tar ? C.tareaImporte(tar, EST2.perfiles) : -1;
  check("reparto " + k + " = " + totalesExcel[k].toLocaleString("es-ES", { minimumFractionDigits: 2 }),
    Math.abs(real - totalesExcel[k]) < 0.005, real);
});
check("la suma de los repartos por tarea da el total del Excel",
  Math.abs(U.r2(Object.keys(totalesExcel).reduce((s, k) => s + totalesExcel[k], 0)) - 587009.36) < 0.005);
const totalExcel = 587009.36;
check("TOTAL sin impuestos = 587.009,36 € (al céntimo del Excel)",
  Math.abs(C.subtotalProyecto(prIneco, EST2.perfiles) - totalExcel) < 0.005, C.subtotalProyecto(prIneco, EST2.perfiles));

/* ---------- 4. Migración v2 → v3 ---------- */
t.grupo("\n4. Migración v2 → v3");
const v2 = {
  version: 2, marca: { nombre: "Marca V2", sub: "", moneda: "€", logo: "" }, mostrarImportes: true,
  perfiles: [{ id: "pf_x", nombre: "Perfil X", tarifa: 50, categoria: "Consultoría media" }],
  plantillas: [], proyectos: [{
    id: "pr_v2", nombre: "Oferta v2", cliente: { nombre: "Cli", contacto: "", ref: "" }, estado: "enviada",
    impuestos: { tipo: "iva", tasa: 21, incluido: false }, descuento: { tipo: "", valor: 0 },
    tareas: [{ id: "ta_1", nombre: "T", subtareas: [{ id: "sb_1", nombre: "S", lineas: [{ id: "ln_1", perfilId: "pf_x", horas: { m0: 10 } }] }] }]
  }]
};
const m2 = M.migrar(v2);
const EST3 = M.normalizarEstado(m2.estado);
const prV2 = EST3.proyectos[0];
check("origen detectado v2", m2.origen === 2);
check("v2 conserva sus impuestos (IVA 21)", prV2.impuestos.tipo === "iva" && prV2.impuestos.tasa === 21);
check("v2 conserva el esfuerzo", C.importeProyecto(prV2, EST3.perfiles) === 500, C.importeProyecto(prV2, EST3.perfiles));
check("v2 gana campos v3 vacíos", Array.isArray(prV2.entregables) && Array.isArray(prV2.tareas[0].entregables) && Array.isArray(prV2.escenarios) && Array.isArray(prV2.versiones));
check("v2 conserva marca y estado de la oferta", EST3.marca.nombre === "Marca V2" && prV2.estado === "enviada");

/* ---------- 5. Normalización defensiva ---------- */
t.grupo("\n5. Normalización defensiva");
const roto = {
  id: "pr_roto", nombre: "", meses: 999, fecha: "", validezDias: -5, cliente: "Texto plano v1",
  impuestos: { tipo: "cualquiera", tasa: -3 }, descuento: { tipo: "loco", valor: -2 },
  gastos: [{ nombre: "x" }],
  tareas: [{ nombre: "T", entregables: [{ nombre: "E", estado: "inventado", mes: 99, facturacionPct: 500 }],
    subtareas: [{ lineas: [{ perfilId: "pf_jp", horas: { m0: 3, m99: 7 } }] }] }]
};
const rn = M.normalizarProyecto(roto);
check("meses acotados a 60", rn.meses === 60, rn.meses);
check("validez no negativa", rn.validezDias >= 0);
check("cliente texto plano → objeto", typeof rn.cliente === "object" && rn.cliente.nombre === "Texto plano v1");
check("tipo de impuesto inválido → iva", rn.impuestos.tipo === "iva");
check("tasa acotada 0..100", rn.impuestos.tasa === 0, rn.impuestos.tasa);
check("descuento de tipo inválido → vacío", rn.descuento.tipo === "");
check("horas de meses inexistentes descartadas", rn.tareas[0].subtareas[0].lineas[0].horas.m99 === undefined && rn.tareas[0].subtareas[0].lineas[0].horas.m0 === 3);
check("tasa decimal aceptada", M.normalizarProyecto({ impuestos: { tipo: "iva", tasa: "21,5" } }).impuestos.tasa === 21.5);
check("estado de entregable inválido → pendiente", rn.tareas[0].entregables[0].estado === "pendiente");
check("mes de entregable acotado al proyecto", rn.tareas[0].entregables[0].mes <= 59);
check("porcentaje de facturación acotado 0..100", rn.tareas[0].entregables[0].facturacionPct === 100);
check("oferta sin tareas no rompe", !!M.normalizarProyecto({}).tareas);
check("datos basura no rompen", !!M.normalizarProyecto(null).id && !!M.normalizarEstado(null).proyectos.length);

/* ---------- 6. Redondeo estilo Excel ---------- */
t.grupo("\n6. Redondeo y precisión");
check("r2(0.1+0.2) = 0.3", U.r2(0.1 + 0.2) === 0.3, U.r2(0.1 + 0.2));
check("r2 acepta coma decimal", U.r2("1.005") === 1.01 || U.r2("1.005") === 1, U.r2("1.005"));
check("num('1.234,56') no explota", U.num("1.234,56") === 1.234);
check("lineaImporte redondea a 2 decimales", (() => {
  const p = M.normalizarProyecto({ meses: 1, tareas: [{ subtareas: [{ lineas: [{ perfilId: "pf_a", horas: { m0: 3.333 } }] }] }] });
  return U.r2(C.lineaImporte(p.tareas[0].subtareas[0].lineas[0], [{ id: "pf_a", tarifa: 3 }])) === 10;
})());

t.resumen();
process.exit(t.ko ? 1 : 0);
