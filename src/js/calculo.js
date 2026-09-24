"use strict";
/* =====================================================================
   Planifica v4 — CÁLCULO
   Motor PURO de importes de una oferta. Recibe siempre (oferta, perfiles).
   Sin DOM, sin estado global, sin seguimiento.

   CONTRATO DE EXACTITUD (no negociable): el redondeo a 2 decimales se hace
   LÍNEA a LÍNEA y luego se suma, igual que la hoja de cálculo del cliente.
   Ese orden es lo que hace que el encargo real cuadre al céntimo
   (587.009,36 €). No cambiar el punto de redondeo sin volver a verificar.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;

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

  /* ---------- Horas ---------- */

  function lineaHoras(l) {
    const h = (l && l.horas) || {};
    let s = 0;
    for (const k in h) s += N().num(h[k]);
    return s;
  }

  function lineasHoras(lineas, i) {
    let s = 0;
    lista(lineas).forEach(l => { s += N().num(((l.horas) || {})["p" + i]); });
    return s;
  }

  function subtareaHoras(s) { return N().suma(lista(s && s.lineas), lineaHoras); }
  function tareaHoras(t) { return N().suma(lista(t && t.subtareas), subtareaHoras); }
  function ofertaHoras(o) { return N().suma(lista(o && o.tareas), tareaHoras); }

  function horasPeriodo(o, i) {
    let s = 0;
    lista(o && o.tareas).forEach(t => lista(t.subtareas).forEach(sb => {
      s += lineasHoras(sb.lineas, i);
    }));
    return s;
  }

  function horasPorPerfil(o) {
    const mapa = {};
    lista(o && o.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      if (!l.perfilId) return;
      mapa[l.perfilId] = N().num(mapa[l.perfilId]) + lineaHoras(l);
    })));
    return mapa;
  }

  /** Horas por perfil y periodo: { perfilId: [h0, h1, …] }. */
  function horasPerfilPeriodo(o) {
    const n = P().meses(o && o.periodos);
    const mapa = {};
    lista(o && o.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      if (!l.perfilId) return;
      const arr = mapa[l.perfilId] = mapa[l.perfilId] || new Array(n).fill(0);
      for (let i = 0; i < n; i++) arr[i] += N().num(((l.horas) || {})["p" + i]);
    })));
    return mapa;
  }

  /* ---------- Importes ---------- */

  function lineaImporte(l, pf) { return N().r2(lineaHoras(l) * tarifaDe(pf, l.perfilId)); }
  function subtareaImporte(s, pf) { return N().r2(N().suma(lista(s && s.lineas), l => lineaImporte(l, pf))); }
  function tareaImporte(t, pf) { return N().r2(N().suma(lista(t && t.subtareas), s => subtareaImporte(s, pf))); }
  function importeOferta(o, pf) { return N().r2(N().suma(lista(o && o.tareas), t => tareaImporte(t, pf))); }

  function importePerfil(o, pf, perfilId) {
    const h = horasPorPerfil(o)[perfilId];
    return h ? N().r2(N().num(h) * tarifaDe(pf, perfilId)) : 0;
  }

  function importePeriodo(o, pf, i) {
    let s = 0;
    lista(o && o.tareas).forEach(t => lista(t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      s += N().num(((l.horas) || {})["p" + i]) * tarifaDe(pf, l.perfilId);
    })));
    return N().r2(s);
  }

  function importeTareaPeriodo(t, pf, i) {
    let s = 0;
    lista(t && t.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      s += N().num(((l.horas) || {})["p" + i]) * tarifaDe(pf, l.perfilId);
    }));
    return N().r2(s);
  }

  /* ---------- Gastos, descuento, impuestos, total ---------- */

  function gastoImporte(g) { return N().r2(N().num(g && g.unidades) * N().num(g && g.precio)); }
  function gastosTotal(o) { return N().r2(N().suma(lista(o && o.gastos), gastoImporte)); }

  function subtotalOferta(o, pf) { return N().r2(importeOferta(o, pf) + gastosTotal(o)); }

  function descuentoImporte(o, pf) {
    const base = subtotalOferta(o, pf);
    const d = (o && o.descuento) || {};
    if (d.tipo === "%") return N().r2(base * N().num(d.valor) / 100);
    if (d.tipo === "fijo") return N().r2(Math.min(base, N().num(d.valor)));
    return 0;
  }

  function baseImponible(o, pf) { return N().r2(subtotalOferta(o, pf) - descuentoImporte(o, pf)); }

  function nombreImpuesto(o) {
    const t = (o && o.impuestos) || {};
    if (t.tipo === "irpf") return "IRPF";
    if (t.tipo === "iva") return "IVA";
    return "";
  }

  function impuestoImporte(o, pf) {
    const t = (o && o.impuestos) || {};
    if (!t.tipo || t.tipo === "ninguno" || !N().num(t.tasa)) return 0;
    const base = baseImponible(o, pf);
    if (t.tipo === "irpf") return N().r2(-base * N().num(t.tasa) / 100);
    return t.incluido
      ? N().r2(base * N().num(t.tasa) / (100 + N().num(t.tasa)))
      : N().r2(base * N().num(t.tasa) / 100);
  }

  function totalOferta(o, pf) { return N().r2(baseImponible(o, pf) + impuestoImporte(o, pf)); }

  /** Media por periodo (para el KPI de esfuerzo). */
  function mediaPeriodo(o, pf) {
    const n = P().meses(o && o.periodos);
    return n ? N().r2(totalOferta(o, pf) / n) : 0;
  }

  /* ---------- Anualidades ---------- */

  function anualidades(o, pf) {
    const mapa = {};
    const n = P().meses(o && o.periodos);
    for (let i = 0; i < n; i++) {
      const y = P().fecha(o.periodos, i).getFullYear();
      mapa[y] = N().r2(N().num(mapa[y]) + importePeriodo(o, pf, i));
    }
    return mapa;
  }

  /* ---------- Usos de un perfil ---------- */

  function usosPerfil(ofertas, perfilId) {
    let n = 0;
    lista(ofertas).forEach(o => {
      lista(o.tareas).forEach(t => {
        lista(t.subtareas).forEach(s => lista(s.lineas).forEach(l => { if (l.perfilId === perfilId) n++; }));
        lista(t.entregables).forEach(e => { if (e.responsablePerfilId === perfilId) n++; });
      });
      lista(o.entregables).forEach(e => { if (e.responsablePerfilId === perfilId) n++; });
    });
    return n;
  }

  /* ---------- Duplicar ---------- */

  function clonarTarea(t) {
    const c = N().clonar(t);
    c.id = N().uid("ta_");
    lista(c.entregables).forEach(e => { e.id = N().uid("en_"); });
    lista(c.subtareas).forEach(s => {
      s.id = N().uid("sb_");
      lista(s.lineas).forEach(l => { l.id = N().uid("ln_"); });
    });
    return c;
  }

  function clonarSubtarea(s) {
    const c = N().clonar(s);
    c.id = N().uid("sb_");
    lista(c.lineas).forEach(l => { l.id = N().uid("ln_"); });
    return c;
  }

  PL.calculo = {
    perfilPorId: perfilPorId, tarifaDe: tarifaDe,
    lineaHoras: lineaHoras, lineasHoras: lineasHoras,
    subtareaHoras: subtareaHoras, tareaHoras: tareaHoras, ofertaHoras: ofertaHoras,
    horasPeriodo: horasPeriodo, horasPorPerfil: horasPorPerfil, horasPerfilPeriodo: horasPerfilPeriodo,
    lineaImporte: lineaImporte, subtareaImporte: subtareaImporte, tareaImporte: tareaImporte,
    importeOferta: importeOferta, importePerfil: importePerfil,
    importePeriodo: importePeriodo, importeTareaPeriodo: importeTareaPeriodo,
    gastoImporte: gastoImporte, gastosTotal: gastosTotal,
    subtotalOferta: subtotalOferta, descuentoImporte: descuentoImporte,
    baseImponible: baseImponible, nombreImpuesto: nombreImpuesto,
    impuestoImporte: impuestoImporte, totalOferta: totalOferta, mediaPeriodo: mediaPeriodo,
    anualidades: anualidades, usosPerfil: usosPerfil,
    clonarTarea: clonarTarea, clonarSubtarea: clonarSubtarea
  };
})(typeof window !== "undefined" ? window : globalThis);
