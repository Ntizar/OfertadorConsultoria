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

  /* ---------- Dedicación: porcentaje ↔ horas ----------
     Las horas son el DATO (y lo que cuadra el encargo al céntimo); el porcentaje
     es la puerta de entrada cómoda: «media jornada ese mes» = 50 %. */

  function jornada(o) { return PL.modelo.normalizarJornada(o && o.jornada); }

  /** Horas laborables de un mes con la jornada de la oferta. */
  function horasLaborablesMes(o, i) { return P().horasLaborables(o && o.periodos, i, jornada(o)); }

  /** Horas laborables de toda la oferta. */
  function horasLaborablesTotal(o) {
    const n = P().meses(o && o.periodos);
    let t = 0;
    for (let i = 0; i < n; i++) t += horasLaborablesMes(o, i);
    return N().r2(t);
  }

  /** Qué porcentaje de la jornada del mes representan estas horas. */
  function pctDeHoras(o, i, horas) {
    const lim = horasLaborablesMes(o, i);
    return lim > 0 ? N().r2(N().num(horas) / lim * 100) : 0;
  }

  /** Cuántas horas son este porcentaje de la jornada del mes. */
  function horasDePct(o, i, pct) {
    return N().r2(N().acota(pct, 0, 1000) / 100 * horasLaborablesMes(o, i));
  }

  /** Horas de UN perfil en UN mes (sumando todas sus líneas de la oferta).
      Recorre sólo el mes pedido: se llama al teclear cada celda, así que no puede
      construir la matriz completa (eso multiplicaba por 3 el tiempo de tecleo). */
  function horasPerfilEnMes(o, perfilId, i) {
    if (!perfilId) return 0;
    let t = 0;
    lista(o && o.tareas).forEach(ta => lista(ta.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      if (l.perfilId === perfilId) t += N().num((l.horas || {})["p" + i]);
    })));
    return N().r2(t);
  }

  function pctPerfilEnMes(o, perfilId, i) { return pctDeHoras(o, i, horasPerfilEnMes(o, perfilId, i)); }

  /** Horas que le QUEDAN libres a un perfil en un mes, sin contar la línea que se
      está editando: es el tope real que se puede teclear ahí. */
  function horasDisponiblesPerfilMes(o, perfilId, i, lineaId) {
    const limite = horasLaborablesMes(o, i);
    let usado = 0;
    lista(o && o.tareas).forEach(ta => lista(ta.subtareas).forEach(sb => lista(sb.lineas).forEach(l => {
      if (l.id === lineaId || l.perfilId !== perfilId) return;
      usado += N().num((l.horas || {})["p" + i]);
    })));
    return Math.max(0, N().r2(limite - usado));
  }

  /** Porcentaje libre de un perfil en un mes (para el tope del 100 %). */
  function pctDisponiblePerfilMes(o, perfilId, i, lineaId) {
    return pctDeHoras(o, i, horasDisponiblesPerfilMes(o, perfilId, i, lineaId));
  }

  /** Perfiles que se pasan del 100 % en algún mes: nadie puede estar más de una
      jornada completa a la vez. Devuelve [{perfilId, periodo, horas, limite, pct}]. */
  function excesosPerfil(o) {
    const out = [];
    const m = horasPerfilPeriodo(o);
    const n = P().meses(o && o.periodos);
    Object.keys(m).forEach(perfilId => {
      for (let i = 0; i < n; i++) {
        const h = N().r2((m[perfilId] || [])[i] || 0);
        if (h <= 0) continue;
        const lim = horasLaborablesMes(o, i);
        if (lim > 0 && h > lim + 0.005) {
          out.push({ perfilId: perfilId, periodo: i, horas: h, limite: lim, pct: pctDeHoras(o, i, h) });
        }
      }
    });
    return out;
  }

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
    jornada: jornada, horasLaborablesMes: horasLaborablesMes, horasLaborablesTotal: horasLaborablesTotal,
    pctDeHoras: pctDeHoras, horasDePct: horasDePct,
    horasPerfilEnMes: horasPerfilEnMes, pctPerfilEnMes: pctPerfilEnMes, excesosPerfil: excesosPerfil,
    horasDisponiblesPerfilMes: horasDisponiblesPerfilMes, pctDisponiblePerfilMes: pctDisponiblePerfilMes,
    clonarTarea: clonarTarea, clonarSubtarea: clonarSubtarea
  };
})(typeof window !== "undefined" ? window : globalThis);
