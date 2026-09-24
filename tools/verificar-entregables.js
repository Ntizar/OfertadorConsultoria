"use strict";
/* =====================================================================
   Planifica v3 — VERIFICACIÓN DE ENTREGABLES Y FACTURACIÓN
   Los entregables en dos niveles (tarea y oferta), su estado, el plan de
   facturación por hito y los avisos de porcentajes.

   Uso:  node tools/verificar-entregables.js
   ===================================================================== */
const { cargarPL, contador } = require("./arnes");

const { PL } = cargarPL();
const C = PL.calculo, M = PL.modelo, U = PL.nucleo, E = PL.entregables;
const t = contador("Planifica v3 — entregables y facturación");
const check = t.check;

const ESTADO = M.estadoInicial();
const PF = ESTADO.perfiles;
const pr = ESTADO.proyectos[0];

/* ---------- 1. Catálogo de estados ---------- */
t.grupo("1. Estados del entregable");
const est = M.ESTADOS_ENTREGABLE;
check("4 estados definidos", Object.keys(est).length === 4);
check("cada estado tiene texto y badge", Object.keys(est).every(k => est[k].texto && est[k].badge));
check("orden progresivo pendiente < encurso < entregado < aceptado",
  est.pendiente.orden < est.encurso.orden && est.encurso.orden < est.entregado.orden && est.entregado.orden < est.aceptado.orden);
check("facturado: no en pendiente ni en curso", !est.pendiente.facturado && !est.encurso.facturado);
check("facturado: sí en entregado y aceptado", est.entregado.facturado && est.aceptado.facturado);
check("estadoDe() cae en pendiente con basura", E.estadoDe({ estado: "inventado" }).texto === "Pendiente");
check("esFinalizado: entregado y aceptado", E.esFinalizado({ estado: "entregado" }) && E.esFinalizado({ estado: "aceptado" }) && !E.esFinalizado({ estado: "encurso" }));
check("esCobrado solo con aceptado", E.esCobrado({ estado: "aceptado" }) && !E.esCobrado({ estado: "entregado" }));

/* ---------- 2. Recopilación con contexto ---------- */
t.grupo("\n2. Entregables en dos niveles");
const todos = E.todos(pr);
const deTarea = todos.filter(e => e._contexto === "tarea");
const deOferta = todos.filter(e => e._contexto === "oferta");
check("el ejemplo tiene entregables de tarea", deTarea.length === 4, deTarea.length);
check("el ejemplo tiene entregables de oferta", deOferta.length === 1, deOferta.length);
check("los de tarea llevan su tarea resuelta", deTarea.every(e => !!e._tareaId && !!e._tareaNombre));
check("los de oferta no llevan tarea", deOferta.every(e => e._tareaId === null && e._tareaNombre === ""));
check("los de oferta facturan contra la oferta", deOferta.every(e => e.baseFacturacion === "oferta"));
check("la recopilación no muta la oferta", (pr.entregables[0]._contexto === undefined && pr.tareas[0].entregables[0]._contexto === undefined));

/* ---------- 3. Base de facturación ---------- */
t.grupo("\n3. Base de facturación de cada hito");
const t1 = pr.tareas[0];
const hitos1 = E.planFacturacion(pr, PF).filter(h => h.tareaId === t1.id);
check("hito de tarea: base = importe de su tarea", hitos1.every(h => Math.abs(h.base - C.tareaImporte(t1, PF)) < 0.005), hitos1[0] && hitos1[0].base);
check("hito de oferta: base = base imponible de la oferta", (() => {
  const h = E.planFacturacion(pr, PF).filter(x => x.contexto === "oferta")[0];
  return Math.abs(h.base - C.baseImponible(pr, PF)) < 0.005;
})());
check("importe del hito = % sobre su base", hitos1.every((h, i) => {
  const e = t1.entregables[i];
  return Math.abs(h.importe - U.r2(h.base * e.facturacionPct / 100)) < 0.005;
}));
check("importeDe() directo coincide con el plan", (() => {
  const e = t1.entregables[0];
  const h = E.planFacturacion(pr, PF).filter(x => x.id === e.id)[0];
  return Math.abs(E.importeDe(pr, PF, e) - h.importe) < 0.005;
})());

/* ---------- 4. Plan de facturación ---------- */
t.grupo("\n4. Plan de facturación");
const plan = E.planFacturacion(pr, PF);
check("el plan incluye todos los hitos", plan.length === todos.length, plan.length);
check("ordenado por mes de entrega", plan.every((h, i) => i === 0 || plan[i - 1].mes <= h.mes));
check("cada hito trae su etiqueta de mes", plan.every(h => typeof h.mesEtiqueta === "string" && h.mesEtiqueta.length > 0));
check("acumulado creciente y último = total", (() => {
  let ok = true, prev = -1;
  plan.forEach(h => { if (h.acumulado < prev) ok = false; prev = h.acumulado; });
  return ok && Math.abs(plan[plan.length - 1].acumulado - U.r2(U.suma(plan, h => h.importe))) < 0.005;
})());
check("acumulado facturado cuenta solo lo entregado/aceptado", (() => {
  const ult = plan[plan.length - 1];
  return Math.abs(ult.acumuladoFacturado - U.r2(U.suma(plan.filter(h => h.facturado), h => h.importe))) < 0.005;
})());
const sumaTareas = U.r2(U.suma(E.planFacturacion(pr, PF).filter(h => h.contexto === "tarea"), h => h.importe));
check("entregables de tarea al 100 % → suman el importe de consultoría",
  Math.abs(sumaTareas - C.importeProyecto(pr, PF)) < 0.02, sumaTareas + " vs " + C.importeProyecto(pr, PF));

/* ---------- 5. Resumen de facturación ---------- */
t.grupo("\n5. Resumen de facturación");
const res = E.resumenFacturacion(pr, PF);
check("total = suma de los hitos", Math.abs(res.total - U.r2(U.suma(plan, h => h.importe))) < 0.005);
check("facturado ≤ total", res.facturado <= res.total + 0.005);
check("pendiente = total − facturado", Math.abs(res.pendienteFacturar - (res.total - res.facturado)) < 0.005);
check("cobrado ≤ facturado", res.cobrado <= res.facturado + 0.005);
check("cobrado = solo aceptados", Math.abs(res.cobrado - U.r2(U.suma(plan.filter(h => h.cobrado), h => h.importe))) < 0.005);
check("el ejemplo no lanza avisos de porcentajes (todo al 100 %)", res.avisos.length === 0, JSON.stringify(res.avisos));
check("cobertura calculada sobre la base imponible", res.base > 0 && res.cobertura > 0, res.cobertura + " %");

/* ---------- 6. Avisos de porcentajes ---------- */
t.grupo("\n6. Avisos cuando los porcentajes no cierran");
const prAviso = M.normalizarProyecto({
  meses: 6, tareas: [{ id: "ta_1", nombre: "T", entregables: [
    { id: "en_1", nombre: "E1", facturacionPct: 30 }, { id: "en_2", nombre: "E2", facturacionPct: 30 }
  ], subtareas: [] }]
});
const av = E.avisosPorcentajes(prAviso);
check("detecta tarea al 60 % (falta 40)", av.length === 1 && av[0].suma === 60 && Math.abs(av[0].diferencia - 40) < 0.005, JSON.stringify(av));
check("avisa también de sobreasignación", (() => {
  const p2 = M.normalizarProyecto({ meses: 3, tareas: [{ id: "ta_1", entregables: [{ facturacionPct: 80 }, { facturacionPct: 50 }] }] });
  return E.avisosPorcentajes(p2)[0].diferencia === -30;
})());
check("sin entregables no hay avisos", E.avisosPorcentajes(M.normalizarProyecto({ tareas: [{ subtareas: [] }] })).length === 0);
check("los entregables de oferta al 0 % no generan aviso", (() => {
  const p3 = M.normalizarProyecto({ meses: 2, entregables: [{ nombre: "Hito informativo", facturacionPct: 0 }] });
  return E.avisosPorcentajes(p3).length === 0;
})());

/* ---------- 7. Avance y vistas por mes ---------- */
t.grupo("\n7. Avance del proyecto");
const pe = E.porEstado(pr);
check("total de entregables", pe.total === 5, pe.total);
check("conteo por estado coherente", pe.pendiente + pe.encurso + pe.entregado + pe.aceptado === pe.total);
check("finalizados = entregados + aceptados", pe.finalizados === pe.entregado + pe.aceptado);
check("porcentaje de avance calculado", pe.pct === U.r2(pe.finalizados / pe.total * 100), pe.pct + " %");
const pm = E.porMes(pr);
check("agrupación por mes cubre todos los hitos", U.suma(Object.keys(pm).map(k => pm[k].length)) === todos.length);
check("porMes no muta la oferta", (pr.entregables[0].estadoTexto === undefined));
const prox = E.proximo(pr);
check("próximo entregable pendiente localizado", !!prox && !E.esFinalizado(prox));
check("el próximo es el de menor mes no finalizado", (() => {
  const pend = todos.filter(e => !E.esFinalizado(e)).sort((a, b) => a.mes - b.mes);
  return prox.id === pend[0].id;
})());
check("vencidos: sin meses transcurridos no inventa nada", E.vencidos(pr).length === 0);
/* Con 6 meses transcurridos siguen sin finalizar 3 hitos (2 de tarea + 1 de oferta);
   los dos de la tarea 1 están entregado/aceptado y por tanto NO cuentan. */
const venc = E.vencidos(pr, 6);
check("vencidos: con 6 meses transcurridos detecta los 3 pendientes", venc.length === 3, venc.length);
check("vencidos: nunca incluye hitos ya finalizados", venc.every(e => !E.esFinalizado(e)));

/* ---------- 8. Entregables de una tarea concreta ---------- */
t.grupo("\n8. Detalle por tarea");
const dt = E.deTarea(pr, PF, t1);
check("la tarea 1 tiene 2 hitos", dt.hitos.length === 2);
check("porcentajes de la tarea suman 100", dt.pct === 100, dt.pct);
check("importe de los hitos = importe de la tarea", Math.abs(dt.importe - C.tareaImporte(t1, PF)) < 0.02, dt.importe + " vs " + C.tareaImporte(t1, PF));
check("finalizados contados (1 aceptado + 1 entregado)", dt.finalizados === 2, dt.finalizados);
check("cada hito trae importe y etiqueta", dt.hitos.every(h => h.importe >= 0 && !!h.mesEtiqueta));

/* ---------- 9. Sobre ofertas sin entregables ---------- */
t.grupo("\n9. Ofertas sin entregables (compatibilidad con datos antiguos)");
const prVacia = M.normalizarProyecto({ meses: 3, tareas: [{ nombre: "T", subtareas: [] }] });
const resVacia = E.resumenFacturacion(prVacia, PF);
check("sin hitos, el plan está vacío", E.planFacturacion(prVacia, PF).length === 0);
check("sin hitos, los totales son 0", resVacia.total === 0 && resVacia.facturado === 0);
check("sin hitos, no hay avisos", resVacia.avisos.length === 0);
check("sin hitos, porEstado da ceros", E.porEstado(prVacia).total === 0 && E.porEstado(prVacia).pct === 0);
check("sin hitos, próximo es null", E.proximo(prVacia) === null);

/* ---------- 10. La plantilla de fábrica también cuadra ---------- */
t.grupo("\n10. Plantilla de fábrica");
const pl = PL.ejemplo.plantillasDefecto()[0];
const tareasConEnt = pl.tareas.filter(x => (x.entregables || []).length > 0);
check("la plantilla trae entregables", tareasConEnt.length >= 4, tareasConEnt.length);
check("cada tarea de la plantilla cierra al 100 %", tareasConEnt.every(x => U.r2(U.suma(x.entregables, e => e.facturacionPct)) === 100));
check("los entregables de la plantilla llevan criterio de aceptación", tareasConEnt.every(x => x.entregables.every(e => !!e.criterio)));
check("la plantilla sobrevive a la normalización", (() => {
  const n = M.normalizarPlantilla(pl);
  return n.tareas.length === pl.tareas.length && n.tareas[0].entregables.length === pl.tareas[0].entregables.length;
})());

t.resumen();
process.exit(t.ko ? 1 : 0);
