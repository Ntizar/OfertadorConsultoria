"use strict";
/* =====================================================================
   Planifica v3 — CÁLCULO ECONÓMICO
   Motor PURO: no toca el DOM ni el estado global. Todas las funciones
   reciben la oferta (pr) y la biblioteca de perfiles (pf).

   CONTRATO DE EXACTITUD (no negociable):
   el redondeo por línea con criterio Excel (nucleo.r2) es lo que hace que
   los totales cuadren al céntimo con la hoja de cálculo del cliente.
   No cambiar el ORDEN ni el punto de redondeo sin volver a verificar
   contra el encargo real (587.009,36 €).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;

  const lista = v => N().lista(v);

  /* ---------- Perfiles ---------- */

  function perfilPorId(pf, id) {
    const l = lista(pf);
    for (let i = 0; i < l.length; i++) if (l[i] && l[i].id === id) return l[i];
    return null;
  }

  function tarifaDe(pf, perfilId) {
    const p = perfilPorId(pf, perfilId);
    return p ? N().num(p.tarifa) : 0;
  }

  /* ---------- Horas (suman primas) ---------- */

  function lineaHoras(l) { return N().suma(Object.keys((l && l.horas) || {}).map(k => l.horas[k])); }

  function subHoras(s) { return N().suma(lista(s && s.lineas).map(lineaHoras)); }

  function tareaHoras(t) { return N().suma(lista(t && t.subtareas).map(subHoras)); }

  function horasProyecto(pr) { return N().suma(lista(pr && pr.tareas).map(tareaHoras)); }

  function horasMes(pr, i) {
    let s = 0;
    lista(pr && pr.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      s += N().num(((l.horas) || {})["m" + i]);
    })));
    return s;
  }

  function horasPorPerfil(pr) {
    const mapa = {};
    lista(pr && pr.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      if (!l.perfilId) return;
      mapa[l.perfilId] = N().num(mapa[l.perfilId]) + lineaHoras(l);
    })));
    return mapa;
  }

  /* ---------- Importes de consultoría ---------- */

  /* El redondeo a 2 decimales se hace LÍNEA a LÍNEA y luego se suma:
     es el criterio de la hoja de cálculo original. */
  function lineaImporte(l, pf) { return N().r2(lineaHoras(l) * tarifaDe(pf, l.perfilId)); }

  function subImporte(s, pf) { return N().r2(N().suma(lista(s && s.lineas).map(l => lineaImporte(l, pf)))); }

  function tareaImporte(t, pf) { return N().r2(N().suma(lista(t && t.subtareas).map(s => subImporte(s, pf)))); }

  function importeProyecto(pr, pf) { return N().r2(N().suma(lista(pr && pr.tareas).map(t => tareaImporte(t, pf)))); }

  function importeMes(pr, pf, i) {
    let s = 0;
    lista(pr && pr.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      s += N().num(((l.horas) || {})["m" + i]) * tarifaDe(pf, l.perfilId);
    })));
    return N().r2(s);
  }

  function importePerfil(pr, pf, perfilId) {
    const h = horasPorPerfil(pr)[perfilId];
    return h ? N().r2(N().num(h) * tarifaDe(pf, perfilId)) : 0;
  }

  /* ---------- Gastos, descuento, impuestos y total ---------- */

  function gastosTotal(pr) {
    return N().r2(N().suma(lista(pr && pr.gastos).map(g => N().num(g.unidades) * N().num(g.precio))));
  }

  function gastoImporte(g) { return N().r2(N().num(g && g.unidades) * N().num(g && g.precio)); }

  function subtotalProyecto(pr, pf) { return N().r2(importeProyecto(pr, pf) + gastosTotal(pr)); }

  function descuentoImporte(pr, pf) {
    const base = subtotalProyecto(pr, pf);
    const d = (pr && pr.descuento) || {};
    if (d.tipo === "%") return N().r2(base * N().num(d.valor) / 100);
    if (d.tipo === "fijo") return N().r2(Math.min(base, N().num(d.valor)));
    return 0;
  }

  function baseImponible(pr, pf) { return N().r2(subtotalProyecto(pr, pf) - descuentoImporte(pr, pf)); }

  function nombreImpuesto(pr) {
    const t = (pr && pr.impuestos) || {};
    if (t.tipo === "irpf") return "IRPF";
    if (t.tipo === "iva") return "IVA";
    return "";
  }

  function impuestoImporte(pr, pf) {
    const t = (pr && pr.impuestos) || {};
    if (!t.tipo || t.tipo === "ninguno" || !N().num(t.tasa)) return 0;
    const base = baseImponible(pr, pf);
    if (t.tipo === "irpf") return N().r2(-base * N().num(t.tasa) / 100);
    return t.incluido
      ? N().r2(base * N().num(t.tasa) / (100 + N().num(t.tasa)))
      : N().r2(base * N().num(t.tasa) / 100);
  }

  function totalProyecto(pr, pf) { return N().r2(baseImponible(pr, pf) + impuestoImporte(pr, pf)); }

  /* ---------- Anualidades ---------- */

  /** Importe de consultoría por año natural (sin gastos ni impuestos). */
  function anualidades(pr, pf) {
    const mapa = {};
    const meses = N().acota(pr && pr.meses, 1, 60);
    for (let i = 0; i < meses; i++) {
      const y = N().anioDeMes(pr && pr.fechaInicio, i);
      mapa[y] = N().r2(N().num(mapa[y]) + importeMes(pr, pf, i));
    }
    return mapa;
  }

  function mesesProyecto(pr) { return Math.round(N().acota(pr && pr.meses, 1, 60)); }

  /* ---------- Usos de un perfil en toda la biblioteca ---------- */

  function usosPerfil(proyectos, perfilId) {
    let n = 0;
    lista(proyectos).forEach(pr => {
      lista(pr.tareas).forEach(t => {
        lista(t.subtareas).forEach(s => lista(s.lineas).forEach(l => { if (l.perfilId === perfilId) n++; }));
        lista(t.entregables).forEach(e => { if (e.responsablePerfilId === perfilId) n++; });
      });
      lista(pr.entregables).forEach(e => { if (e.responsablePerfilId === perfilId) n++; });
    });
    return n;
  }

  PL.calculo = {
    perfilPorId: perfilPorId, tarifaDe: tarifaDe,
    lineaHoras: lineaHoras, subHoras: subHoras, tareaHoras: tareaHoras,
    horasProyecto: horasProyecto, horasMes: horasMes, horasPorPerfil: horasPorPerfil,
    lineaImporte: lineaImporte, subImporte: subImporte, tareaImporte: tareaImporte,
    importeProyecto: importeProyecto, importeMes: importeMes, importePerfil: importePerfil,
    gastosTotal: gastosTotal, gastoImporte: gastoImporte,
    subtotalProyecto: subtotalProyecto, descuentoImporte: descuentoImporte,
    baseImponible: baseImponible, nombreImpuesto: nombreImpuesto,
    impuestoImporte: impuestoImporte, totalProyecto: totalProyecto,
    anualidades: anualidades, mesesProyecto: mesesProyecto, usosPerfil: usosPerfil
  };
})(typeof window !== "undefined" ? window : globalThis);
