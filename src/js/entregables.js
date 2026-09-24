"use strict";
/* =====================================================================
   Planifica v3 — ENTREGABLES Y FACTURACIÓN POR HITO
   Los entregables viven en dos sitios: dentro de cada tarea (base de
   facturación = importe de esa tarea) y sueltos en la oferta (base =
   base imponible de la oferta).

   Motor PURO. Depende de PL.calculo para las bases.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;

  const lista = v => N().lista(v);
  const E = () => PL.modelo.ESTADOS_ENTREGABLE;

  /* ---------- Estado ---------- */

  function estadoDe(e) {
    const E2 = E();
    return E2[(e && e.estado)] || E2.pendiente;
  }

  function esFacturado(e) { return !!estadoDe(e).facturado; }

  function esCobrado(e) { return (e && e.estado) === "aceptado"; }

  function esFinalizado(e) { const s = (e && e.estado); return s === "entregado" || s === "aceptado"; }

  /* ---------- Recopilación ---------- */

  /** Todos los entregables de la oferta, con su contexto resuelto.
      Devuelve copias aplanadas: {..., _contexto, _tareaId, _tareaNombre}. */
  function todos(pr) {
    const salida = [];
    lista(pr && pr.entregables).forEach(e => {
      salida.push(Object.assign({}, e, { _contexto: "oferta", _tareaId: null, _tareaNombre: "" }));
    });
    lista(pr && pr.tareas).forEach(t => {
      lista(t.entregables).forEach(e => {
        salida.push(Object.assign({}, e, { _contexto: "tarea", _tareaId: t.id, _tareaNombre: t.nombre }));
      });
    });
    return salida;
  }

  /** Entregables con su importe facturable y su base resueltos, ordenados por mes. */
  function planFacturacion(pr, pf) {
    const hitos = todos(pr).map(e => {
      const base = baseDe(pr, pf, e);
      const importe = N().r2(base * N().num(e.facturacionPct) / 100);
      const est = estadoDe(e);
      return {
        id: e.id, nombre: e.nombre, descripcion: e.descripcion, criterio: e.criterio,
        contexto: e._contexto, tareaId: e._tareaId, tareaNombre: e._tareaNombre,
        responsablePerfilId: e.responsablePerfilId || "",
        mes: N().acota(e.mes, 0, 59), mesEtiqueta: N().etiquetaMes(pr && pr.fechaInicio, N().acota(e.mes, 0, 59)),
        fecha: e.fecha || "", estado: e.estado, estadoTexto: est.texto, estadoBadge: est.badge,
        estadoOrden: est.orden, pct: N().num(e.facturacionPct), base: N().r2(base), importe: importe,
        facturado: esFacturado(e), cobrado: esCobrado(e)
      };
    });
    hitos.sort((a, b) => (a.mes - b.mes) || (a.estadoOrden - b.estadoOrden) || a.nombre.localeCompare(b.nombre));
    let acumulado = 0, acumuladoFacturado = 0;
    hitos.forEach(h => {
      acumulado = N().r2(acumulado + h.importe);
      acumuladoFacturado = N().r2(acumuladoFacturado + (h.facturado ? h.importe : 0));
      h.acumulado = acumulado;
      h.acumuladoFacturado = acumuladoFacturado;
    });
    return hitos;
  }

  /** Base sobre la que factura un entregable ya aplanado. */
  function baseDe(pr, pf, e) {
    /* Acepta los dos formatos aplanados: {_contexto,_tareaId} (de todos()) y
       {contexto,tareaId} (de planFacturacion()). */
    const contexto = (e._contexto !== undefined) ? e._contexto : e.contexto;
    const tareaId = (e._tareaId !== undefined) ? e._tareaId : e.tareaId;
    if (contexto === "oferta" || e.baseFacturacion === "oferta") return C().baseImponible(pr, pf);
    const t = tareaDe(pr, tareaId);
    return t ? C().tareaImporte(t, pf) : 0;
  }

  function tareaDe(pr, tareaId) {
    const l = lista(pr && pr.tareas);
    for (let i = 0; i < l.length; i++) if (l[i].id === tareaId) return l[i];
    return null;
  }

  /** Importe facturable de un entregable suelto (de la tarea u de la oferta). */
  function importeDe(pr, pf, e) {
    const aplanado = Object.assign({}, e);
    if (!aplanado._contexto) {
      /* Sin contexto: se busca a qué tarea pertenece (si pertenece a alguna). */
      let tareaId = null;
      lista(pr && pr.tareas).forEach(t => { if (lista(t.entregables).some(x => x.id === e.id)) tareaId = t.id; });
      aplanado._contexto = tareaId ? "tarea" : "oferta";
      aplanado._tareaId = tareaId;
    }
    return N().r2(baseDe(pr, pf, aplanado) * N().num(e.facturacionPct) / 100);
  }

  /* ---------- Resúmenes ---------- */

  function resumenFacturacion(pr, pf) {
    const hitos = planFacturacion(pr, pf);
    const total = N().r2(N().suma(hitos, h => h.importe));
    const facturado = N().r2(N().suma(hitos.filter(h => h.facturado), h => h.importe));
    const cobrado = N().r2(N().suma(hitos.filter(h => h.cobrado), h => h.importe));
    const base = C().baseImponible(pr, pf);
    return {
      hitos: hitos.length, total: total, facturado: facturado, cobrado: cobrado,
      pendienteFacturar: N().r2(total - facturado),
      base: base, cobertura: base > 0 ? N().r2(total / base * 100) : 0,
      avisos: avisosPorcentajes(pr)
    };
  }

  /** Aviso (no error) si los porcentajes no cierran al 100 % en su base. */
  function avisosPorcentajes(pr) {
    const avisos = [];
    lista(pr && pr.tareas).forEach(t => {
      const ents = lista(t.entregables);
      if (!ents.length) return;
      const suma = N().r2(N().suma(ents.filter(e => e.baseFacturacion !== "oferta"), e => N().num(e.facturacionPct)));
      if (suma !== 100) {
        avisos.push({ ambito: "tarea", tareaId: t.id, nombre: t.nombre, suma: suma, diferencia: N().r2(100 - suma) });
      }
    });
    const deOferta = lista(pr && pr.entregables);
    if (deOferta.length) {
      const suma = N().r2(N().suma(deOferta, e => N().num(e.facturacionPct)));
      if (suma > 0 && suma !== 100) {
        avisos.push({ ambito: "oferta", nombre: "Entregables de la oferta", suma: suma, diferencia: N().r2(100 - suma) });
      }
    }
    return avisos;
  }

  /** Conteo por estado (para el avance del proyecto). */
  function porEstado(pr) {
    const r = { pendiente: 0, encurso: 0, entregado: 0, aceptado: 0, total: 0 };
    todos(pr).forEach(e => { r[e.estado] = (r[e.estado] || 0) + 1; });
    r.total = r.pendiente + r.encurso + r.entregado + r.aceptado;
    r.finalizados = r.entregado + r.aceptado;
    r.pct = r.total ? N().r2(r.finalizados / r.total * 100) : 0;
    return r;
  }

  /** Entregables agrupados por mes (para el cronograma y el informe). */
  function porMes(pr) {
    const mapa = {};
    todos(pr).forEach(e => {
      const m = N().acota(e.mes, 0, 59);
      (mapa[m] = mapa[m] || []).push(Object.assign({}, e, {
        _contexto: e._contexto, _tareaNombre: e._tareaNombre, estadoTexto: estadoDe(e).texto, estadoBadge: estadoDe(e).badge
      }));
    });
    return mapa;
  }

  /** Próximo entregable pendiente/en curso por mes de entrega. */
  function proximo(pr) {
    const pend = todos(pr).filter(e => !esFinalizado(e));
    if (!pend.length) return null;
    pend.sort((a, b) => N().num(a.mes) - N().num(b.mes));
    return pend[0];
  }

  /** Retraso: entregables cuyo mes ya pasó y siguen sin entregar. */
  function vencidos(pr, mesesTranscurridos) {
    const t = (mesesTranscurridos === undefined) ? null : N().num(mesesTranscurridos);
    if (t === null) return [];
    return todos(pr).filter(e => !esFinalizado(e) && N().num(e.mes) < t);
  }

  /** Dentro de una tarea: importes y horas de sus entregables. */
  function deTarea(pr, pf, t) {
    const hitos = lista(t && t.entregables).map(e => {
      const aplanado = Object.assign({}, e, { _contexto: "tarea", _tareaId: t.id, _tareaNombre: t.nombre });
      return {
        id: e.id, nombre: e.nombre, estado: e.estado, estadoTexto: estadoDe(e).texto, estadoBadge: estadoDe(e).badge,
        mes: N().acota(e.mes, 0, 59), mesEtiqueta: N().etiquetaMes(pr && pr.fechaInicio, N().acota(e.mes, 0, 59)),
        pct: N().num(e.facturacionPct), importe: N().r2(baseDe(pr, pf, aplanado) * N().num(e.facturacionPct) / 100),
        facturado: esFacturado(e)
      };
    });
    return {
      hitos: hitos,
      pct: N().r2(N().suma(lista(t && t.entregables), e => N().num(e.facturacionPct))),
      importe: N().r2(N().suma(hitos, h => h.importe)),
      finalizados: hitos.filter(h => h.facturado).length
    };
  }

  PL.entregables = {
    estadoDe: estadoDe, esFacturado: esFacturado, esCobrado: esCobrado, esFinalizado: esFinalizado,
    todos: todos, planFacturacion: planFacturacion, importeDe: importeDe, baseDe: baseDe,
    resumenFacturacion: resumenFacturacion, avisosPorcentajes: avisosPorcentajes,
    porEstado: porEstado, porMes: porMes, proximo: proximo, vencidos: vencidos,
    deTarea: deTarea, tareaDe: tareaDe
  };
})(typeof window !== "undefined" ? window : globalThis);
