"use strict";
/* =====================================================================
   Planifica v4 — ENTREGABLES
   Los entregables son COMPROMISOS DE ENTREGA de la oferta: qué se entrega,
   cuándo (periodo + fecha opcional), con qué criterio de aceptación, quién
   es el responsable y cuántas horas se estiman.

   No hay seguimiento ni facturación: aquí no se marca nada como entregado.
   Las horas del entregable son una ESTIMACIÓN orientativa y NO suman al
   total de la oferta (el importe sale de las líneas perfil × periodo).

   Motor puro, sin DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;

  const lista = v => N().lista(v);

  /* ---------- Recopilación ---------- */

  /** Todos los entregables con su contexto resuelto, ordenados por periodo.
      Un entregable puede colgar de la oferta, de una tarea completa o de una
      subtarea concreta (que es lo habitual: se entrega al cerrar ese trabajo). */
  function todos(o) {
    const salida = [];
    lista(o && o.entregables).forEach(e => {
      salida.push(Object.assign({}, e, {
        _contexto: "oferta", _tareaId: null, _tareaNombre: "", _subtareaId: null, _subtareaNombre: ""
      }));
    });
    lista(o && o.tareas).forEach(t => {
      lista(t.entregables).forEach(e => {
        salida.push(Object.assign({}, e, {
          _contexto: "tarea", _tareaId: t.id, _tareaNombre: t.nombre, _subtareaId: null, _subtareaNombre: ""
        }));
      });
      lista(t.subtareas).forEach(s => {
        lista(s.entregables).forEach(e => {
          salida.push(Object.assign({}, e, {
            _contexto: "subtarea", _tareaId: t.id, _tareaNombre: t.nombre,
            _subtareaId: s.id, _subtareaNombre: s.nombre
          }));
        });
      });
    });
    salida.sort((a, b) => (N().num(a.periodo) - N().num(b.periodo)) || a.nombre.localeCompare(b.nombre));
    return salida;
  }

  /** Entregables colgados de la TAREA COMPLETA (los que no son de una subtarea). */
  function deTarea(o, t) {
    return lista(t && t.entregables)
      .map(e => Object.assign({}, e, {
        _contexto: "tarea", _tareaId: t.id, _tareaNombre: t.nombre, _subtareaId: null, _subtareaNombre: ""
      }))
      .sort((a, b) => N().num(a.periodo) - N().num(b.periodo));
  }

  /** Entregables de una SUBTAREA concreta. */
  function deSubtarea(o, s) {
    return lista(s && s.entregables)
      .map(e => Object.assign({}, e, { _contexto: "subtarea", _subtareaId: s.id, _subtareaNombre: s.nombre }))
      .sort((a, b) => N().num(a.periodo) - N().num(b.periodo));
  }

  /** Todo lo que se entrega dentro de una tarea: sus entregables y los de sus subtareas. */
  function deTareaCompleta(o, t) {
    return deTarea(o, t).concat(lista(t && t.subtareas).reduce((acc, s) => acc.concat(deSubtarea(o, s)), []));
  }

  /** Entregables agrupados por índice de periodo: { 0: [...], 1: [...] }. */
  function porPeriodo(o) {
    const mapa = {};
    todos(o).forEach(e => {
      const i = Math.round(N().acota(e.periodo, 0, P().meses(o && o.periodos) - 1));
      (mapa[i] = mapa[i] || []).push(e);
    });
    return mapa;
  }

  function dePeriodo(o, i) { return porPeriodo(o)[i] || []; }

  function cuentaPorPeriodo(o) {
    const m = porPeriodo(o);
    return Object.keys(m).map(k => ({ periodo: parseInt(k, 10), n: m[k].length }));
  }

  /** El siguiente entregable por periodo (el primero del calendario). */
  function proximo(o) {
    const l = todos(o);
    return l.length ? l[0] : null;
  }

  /** El último entregable del calendario (cierre de la oferta). */
  function ultimo(o) {
    const l = todos(o);
    return l.length ? l[l.length - 1] : null;
  }

  /* ---------- Cifras de apoyo (estimaciones, NO suman al total) ---------- */

  function porContexto(o) {
    const l = todos(o);
    return {
      total: l.length,
      deTarea: l.filter(e => e._contexto === "tarea").length,
      deSubtarea: l.filter(e => e._contexto === "subtarea").length,
      deOferta: l.filter(e => e._contexto === "oferta").length
    };
  }

  /* ---------- Ayudas de presentación ---------- */

  function responsable(pf, e) {
    return e && e.responsablePerfilId ? C().perfilPorId(pf, e.responsablePerfilId) : null;
  }

  function etiquetaEntrega(o, e) {
    const p = o && o.periodos;
    const mes = P().mesCorto(p, e.periodo);
    return e && e.fecha ? (mes + " · " + N().fechaCorta(e.fecha)) : mes;
  }

  function posicion(o, e) {
    return P().posicionLegible(o && o.periodos, e.periodo);
  }

  /** ¿Un entregable está dentro del calendario actual? */
  function dentroDeCalendario(o, e) {
    const n = P().meses(o && o.periodos);
    return N().num(e.periodo) >= 0 && N().num(e.periodo) < n;
  }

  /* ---------- Movimientos ---------- */

  /** Cambia el periodo de un entregable (con acotación al calendario). */
  function moverAPeriodo(o, id, tareaId, subtareaId, periodo) {
    const r = PL.modelo.buscarEntregable(o, id, tareaId || "", subtareaId || "");
    if (!r) return null;
    r.entregable.periodo = Math.round(N().acota(periodo, 0, P().meses(o && o.periodos) - 1));
    return r.entregable;
  }

  /** Todos los entregables que caen en un periodo (para el Gantt). */
  function marcadoresPorPeriodo(o) {
    const m = porPeriodo(o);
    const n = P().meses(o && o.periodos);
    const out = [];
    for (let i = 0; i < n; i++) out.push(m[i] ? m[i].length : 0);
    return out;
  }

  /** Cuántas horas de esfuerzo hay en el periodo de cada entregable (contexto). */
  function esfuerzoEnPeriodo(o, pf, i) { return C().importePeriodo(o, pf, i); }

  PL.entregables = {
    todos: todos, deTarea: deTarea, deSubtarea: deSubtarea, deTareaCompleta: deTareaCompleta,
    porPeriodo: porPeriodo, dePeriodo: dePeriodo,
    cuentaPorPeriodo: cuentaPorPeriodo, proximo: proximo, ultimo: ultimo,
    porContexto: porContexto,
    responsable: responsable, etiquetaEntrega: etiquetaEntrega, posicion: posicion,
    dentroDeCalendario: dentroDeCalendario, moverAPeriodo: moverAPeriodo,
    marcadoresPorPeriodo: marcadoresPorPeriodo, esfuerzoEnPeriodo: esfuerzoEnPeriodo
  };
})(typeof window !== "undefined" ? window : globalThis);
