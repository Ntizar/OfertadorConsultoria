"use strict";
/* =====================================================================
   Planifica v4 — VISTA: RESUMEN
   Totales, esfuerzo por perfil, por tarea y por periodo, más los escenarios
   y versiones con su comparador de diferencias (todo en línea).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const X = () => PL.comparar;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /* ---------- Totales ---------- */

  function totales(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const d = o.descuento || {}, t = o.impuestos || {};
    const linea = (texto_, valor, fuerte) => V2.fila([
      { html: (fuerte ? "<strong>" : "") + texto_ + (fuerte ? "</strong>" : "") },
      { html: (fuerte ? "<strong>" : "") + (conImp ? V2.imp(valor) : "") + (fuerte ? "</strong>" : ""), clase: "nz-table__right pa-importe" }
    ]);
    const filas = linea("Consultoría (horas × tarifas)", C().importeOferta(o, pf)) +
      linea("Gastos generales", C().gastosTotal(o)) +
      linea("Subtotal", C().subtotalOferta(o, pf), true) +
      (d.tipo ? linea("Descuento (" + (d.tipo === "%" ? N().fmtNum(d.valor) + " %" : "importe fijo") + ")", -C().descuentoImporte(o, pf)) : "") +
      linea("Base imponible", C().baseImponible(o, pf)) +
      linea(C().nombreImpuesto(o) ? C().nombreImpuesto(o) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " (incluido)" : "") : "Sin impuestos", C().impuestoImporte(o, pf));
    const pie = '<tfoot><tr><td><strong>TOTAL</strong></td><td class="nz-table__right pa-importe"><strong>' +
      (conImp ? V2.imp(C().totalOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    const info = '<p class="pa-mini">' + C().ofertaHoras(o).toLocaleString("es-ES") + " h en " + P().duracionLegible(o.periodos) +
      " · " + E().porContexto(o).total + " entregable(s) · media mensual " + (conImp ? V2.imp(C().mediaPeriodo(o, pf)) : "—") + "</p>";
    return V2.articulo("Totales de la oferta", V2.tabla(["", ""], filas, pie, null, true), info);
  }

  function porPerfil(o, pf) {
    const V2 = V();
    const horas = C().horasPorPerfil(o);
    const conImp = V2.verImportes();
    const filas = N().lista(pf).filter(p => N().num(horas[p.id]) > 0).map(p => V2.fila([
      { html: N().esc(p.nombre) + '<br><span class="pa-mini">' + N().esc(p.categoria) + "</span>" },
      { html: V2.hor(horas[p.id]), clase: "nz-table__right", etiqueta: "Horas" },
      { html: conImp ? V2.imp(C().importePerfil(o, pf, p.id)) : "", clase: "nz-table__right pa-importe", etiqueta: "Importe" }
    ])).join("");
    const pie = '<tfoot><tr><td>Total</td><td class="nz-table__right">' + V2.hor(C().ofertaHoras(o)) + '</td><td class="nz-table__right pa-importe">' +
      (conImp ? V2.imp(C().importeOferta(o, pf)) : "") + "</td></tr></tfoot>";
    return V2.articulo("Esfuerzo por perfil", V2.tabla(["Perfil", "Horas", "Importe"], filas || '<tr><td colspan="3">Sin horas asignadas.</td></tr>', pie, "nz-table--compact", true));
  }

  function porTarea(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const filas = N().lista(o.tareas).map(t => V2.fila([
      { html: N().esc(t.nombre) },
      { html: N().lista(t.subtareas).length, clase: "nz-table__right", etiqueta: "Subtareas" },
      { html: N().lista(t.entregables).length, clase: "nz-table__right", etiqueta: "Entregables" },
      { html: V2.hor(C().tareaHoras(t)), clase: "nz-table__right", etiqueta: "Horas" },
      { html: conImp ? V2.imp(C().tareaImporte(t, pf)) : "", clase: "nz-table__right pa-importe", etiqueta: "Importe" }
    ])).join("");
    const pie = '<tfoot><tr><td>Total</td><td class="nz-table__right">' + N().suma(o.tareas, t => N().lista(t.subtareas).length) +
      '</td><td class="nz-table__right">' + E().porContexto(o).total + '</td><td class="nz-table__right">' + V2.hor(C().ofertaHoras(o)) +
      '</td><td class="nz-table__right pa-importe">' + (conImp ? V2.imp(C().importeOferta(o, pf)) : "") + "</td></tr></tfoot>";
    return V2.articulo("Por tareas", V2.tabla(["Tarea", "Subtareas", "Entregables", "Horas", "Importe"], filas || '<tr><td colspan="5">Sin tareas.</td></tr>', pie, "nz-table--compact", true));
  }

  function porPeriodo(o, pf) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const conImp = V2.verImportes();
    const filas = cols.map(c => {
      const horas = c.periodos.reduce((s, i) => s + C().horasPeriodo(o, i), 0);
      const imp = c.periodos.reduce((s, i) => s + C().importePeriodo(o, pf, i), 0);
      const hitos = c.periodos.reduce((s, i) => s + E().dePeriodo(o, i).length, 0);
      return V2.fila([
        { html: N().esc(c.etiqueta) + ' <span class="pa-mini">' + c.anio + "</span>" },
        { html: horas ? horas.toLocaleString("es-ES") : "·", clase: "nz-table__right", etiqueta: "Horas" },
        { html: hitos ? '<span class="pa-hito-informe">◆ ' + hitos + "</span>" : "·", clase: "nz-table__right", etiqueta: "Entregables" },
        { html: conImp ? V2.imp(imp) : "", clase: "nz-table__right pa-importe", etiqueta: "Importe" }
      ]);
    }).join("");
    const pie = '<tfoot><tr><td>Total</td><td class="nz-table__right">' + C().ofertaHoras(o).toLocaleString("es-ES") +
      '</td><td class="nz-table__right">' + E().porContexto(o).total + '</td><td class="nz-table__right pa-importe">' +
      (conImp ? V2.imp(C().importeOferta(o, pf)) : "") + "</td></tr></tfoot>";
    return V2.articulo("Esfuerzo y entregas por periodo", V2.tabla(["Periodo", "Horas", "Entregables", "Importe"], filas, pie, "nz-table--compact", true));
  }

  /* ---------- Escenarios y versiones ---------- */

  function fotos(o, pf) {
    const V2 = V();
    const escenarios = X().fotosDe(o, "escenario");
    const versiones = X().fotosDe(o, "version");

    const listaHtml = (tipo, lista, vacioTexto) => {
      const titulo = PL.modelo.TIPOS_FOTO[tipo];
      const filas = lista.map(f => {
        const r = f.resumen || X().resumen(o, pf, f.snapshot);
        return '<div class="pa-dato">' +
          '<span class="pa-crece2"><strong>' + N().esc(f.nombre) + "</strong>" +
          '<br><span class="pa-mini">' + N().esc(f.fecha) + (f.nota ? " · " + N().esc(f.nota) : "") + " · " +
          (V2.verImportes() ? V2.imp(r.total) + " · " : "") + V2.hor(r.horas) + " · " + r.periodos + " meses · " + r.entregables + " entregables</span></span>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="foto-comparar" data-id="' + f.id + '">Comparar con la actual</button>' +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="foto-aplicar" data-id="' + f.id + '">' + (tipo === "version" ? "Restaurar" : "Aplicar") + "</button>" +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="foto-borrar" data-id="' + f.id + '" title="Eliminar">✕</button>' +
        "</div>";
      }).join("");
      return '<h4 class="nz-h4">' + titulo.plural + " <span class=\"pa-mini\">" + lista.length + "</span></h4>" +
        '<p class="pa-mini">' + titulo.ayuda + "</p>" +
        (filas || '<p class="pa-mini">' + vacioTexto + "</p>");
    };

    return V2.articulo("Escenarios y versiones",
      '<div class="nz-formgrid nz-formgrid--2">' +
        '<label class="nz-field"><span class="nz-field__label">Nombre</span><input class="nz-input" id="foto-nombre" placeholder="Base, recortada, v1 enviada…"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Nota (opcional)</span><input class="nz-input" id="foto-nota" placeholder="Qué cambia o cuándo se envió"></label>' +
      "</div>" +
      '<div class="pa-fila" style="margin:var(--nz-space-2) 0 var(--nz-space-3)">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="guardar-escenario">＋ Guardar como escenario</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="guardar-version">🕒 Congelar como versión</button>' +
        '<span class="pa-mini">El escenario es una alternativa; la versión es la oferta tal como se envió.</span>' +
      "</div>" +
      listaHtml("escenario", escenarios, "Todavía no hay escenarios: guarda el estado actual como «Base» y prueba a recortar o ampliar la oferta.") +
      '<div style="margin-top:var(--nz-space-3)"></div>' +
      listaHtml("version", versiones, "Todavía no hay versiones congeladas: congela una antes de enviar la oferta al cliente.") +
      comparacion(o, pf));
  }

  function comparacion(o, pf) {
    const V2 = V();
    const ui = APP().ui;
    if (!ui.comparacion) return "";
    const cmp = ui.comparacion.cmp;
    const conImp = V2.verImportes();
    const filasEco = cmp.economia.map(l => V2.fila([
      { html: l.texto },
      { html: conImp ? V2.imp(l.a) : "", clase: "nz-table__right", etiqueta: N().esc(cmp.etiquetaA) },
      { html: conImp ? V2.imp(l.b) : "", clase: "nz-table__right", etiqueta: N().esc(cmp.etiquetaB) },
      { html: Math.abs(l.d) > 0.005 ? V2.delta(l.d) : '<span class="pa-mini">igual</span>', clase: "nz-table__right", etiqueta: "Diferencia" }
    ])).join("");
    const filasEst = cmp.estructura.map(l => V2.fila([
      { html: l.texto },
      { html: l.clave === "horas" ? V2.hor(l.a) : N().fmtNum(l.a), clase: "nz-table__right", etiqueta: N().esc(cmp.etiquetaA) },
      { html: l.clave === "horas" ? V2.hor(l.b) : N().fmtNum(l.b), clase: "nz-table__right", etiqueta: N().esc(cmp.etiquetaB) },
      { html: Math.abs(l.d) > 0.005 ? V2.delta(l.d, (l.clave === "horas") ? "horas" : "numero") : '<span class="pa-mini">igual</span>', clase: "nz-table__right", etiqueta: "Diferencia" }
    ])).join("");
    const filasPerf = cmp.porPerfil.map(x => V2.fila([
      { html: N().esc(x.nombre) },
      { html: V2.hor(x.a), clase: "nz-table__right", etiqueta: "Antes" },
      { html: V2.hor(x.b), clase: "nz-table__right", etiqueta: "Ahora" },
      { html: Math.abs(x.d) > 0.005 ? V2.delta(x.d, "horas") : '<span class="pa-mini">igual</span>', clase: "nz-table__right", etiqueta: "Diferencia" },
      { html: conImp ? V2.delta(x.importeD) : "", clase: "nz-table__right", etiqueta: "Δ importe" }
    ])).join("");
    const filasMes = cmp.porPeriodo.filter(m => m.a || m.b).map(m => V2.fila([
      { html: N().esc(m.etiqueta) },
      { html: conImp ? V2.imp(m.a) : "", clase: "nz-table__right", etiqueta: "Antes" },
      { html: conImp ? V2.imp(m.b) : "", clase: "nz-table__right", etiqueta: "Ahora" },
      { html: Math.abs(m.d) > 0.005 ? V2.delta(m.d) : '<span class="pa-mini">igual</span>', clase: "nz-table__right", etiqueta: "Diferencia" }
    ])).join("");
    const cambios = cmp.cambios.length
      ? cmp.cambios.map(c => '<p class="pa-mini">' +
        (c.tipo === "alta" ? '<span class="nz-badge nz-badge--success">＋</span>' : (c.tipo === "baja" ? '<span class="nz-badge nz-badge--danger">−</span>' : '<span class="nz-badge nz-badge--brand">~</span>')) +
        " " + N().esc(c.texto) + "</p>").join("")
      : '<p class="pa-mini">Sin cambios de estructura entre las dos fotos.</p>';

    return '<div class="pa-bloque" style="margin-top:var(--nz-space-3)">' +
      V2.articulo("Diferencias: " + N().esc(cmp.etiquetaA) + " → " + N().esc(cmp.etiquetaB),
        V2.tabla(["", cmp.etiquetaA, cmp.etiquetaB, "Diferencia"], filasEco, null, null, true) +
        V2.tabla(["", cmp.etiquetaA, cmp.etiquetaB, "Diferencia"], filasEst, null, "nz-table--compact", true) +
        '<h4 class="nz-h4">Esfuerzo por perfil</h4>' + V2.tabla(["Perfil", "Antes", "Ahora", "Diferencia", "Δ importe"], filasPerf, null, "nz-table--compact", true) +
        (filasMes ? '<h4 class="nz-h4">Importe por periodo</h4>' + V2.tabla(["Periodo", "Antes", "Ahora", "Diferencia"], filasMes, null, "nz-table--compact", true) : "") +
        '<h4 class="nz-h4">Qué ha cambiado</h4>' + cambios,
        '<div class="pa-fila" style="margin-bottom:var(--nz-space-2)"><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="foto-cerrar-comparacion">✕ Cerrar comparación</button></div>') +
      "</div>";
  }

  /* ---------- Render ---------- */

  function render() {
    const V2 = V(), o = APP().pr(), pf = APP().pf();
    if (!o) { ["res-totales", "res-perfiles", "res-tareas", "res-por-periodo", "res-fotos"].forEach(id => V2.vaciar(id)); return; }
    V2.escribir("res-totales", totales(o, pf));
    V2.escribir("res-perfiles", porPerfil(o, pf));
    V2.escribir("res-tareas", porTarea(o, pf));
    V2.escribir("res-por-periodo", porPeriodo(o, pf));
    V2.escribir("res-fotos", fotos(o, pf));
  }

  PL.vistas.resumen = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
