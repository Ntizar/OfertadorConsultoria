"use strict";
/* =====================================================================
   Planifica v3 — VISTA: RESUMEN
   Totales de la oferta, esfuerzo por perfil, por tarea y plan de
   facturación por mes.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function totales(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const fila = (texto, valor, fuerte) => V2.fila([
      { html: (fuerte ? "<strong>" : "") + texto + (fuerte ? "</strong>" : "") },
      { html: imp ? V2.imp(valor) : "", clase: "nz-table__right pa-importe" }
    ]);
    const d = pr.descuento || {};
    const filas = fila("Consultoría (horas × tarifas)", C().importeProyecto(pr, pf)) +
      fila("Gastos generales", C().gastosTotal(pr)) +
      fila("Subtotal", C().subtotalProyecto(pr, pf), true) +
      (d.tipo ? fila("Descuento (" + (d.tipo === "%" ? N().fmtNum(d.valor) + " %" : "importe fijo") + ")", -C().descuentoImporte(pr, pf)) : "") +
      fila("Base imponible", C().baseImponible(pr, pf), true) +
      fila(C().nombreImpuesto(pr) ? C().nombreImpuesto(pr) + " " + N().fmtNum(pr.impuestos.tasa) + " %" + (pr.impuestos.incluido ? " (incluido)" : "") : "Sin impuestos", C().impuestoImporte(pr, pf));
    const pie = '<tfoot><tr><td><strong>TOTAL</strong></td><td class="nz-table__right pa-importe"><strong>' + (imp ? V2.imp(C().totalProyecto(pr, pf)) : "") + "</strong></td></tr></tfoot>";
    return V2.articulo("Totales de la oferta", V2.tabla(["", ""], filas, pie));
  }

  function porPerfil(pr, pf) {
    const V2 = V();
    const horas = C().horasPorPerfil(pr);
    const imp = V2.hayImportes();
    const filas = N().lista(pf).filter(p => N().num(horas[p.id]) > 0).map(p => V2.fila([
      { html: N().esc(p.nombre) + '<br><span class="pa-mini">' + N().esc(p.categoria) + "</span>" },
      { html: V2.hor(horas[p.id]), clase: "nz-table__right" },
      { html: imp ? V2.imp(C().importePerfil(pr, pf, p.id)) : "", clase: "nz-table__right pa-importe" }
    ])).join("");
    const pie = '<tfoot><tr><td>Total</td><td class="nz-table__right">' + V2.hor(C().horasProyecto(pr)) + '</td><td class="nz-table__right pa-importe">' + (imp ? V2.imp(C().importeProyecto(pr, pf)) : "") + "</td></tr></tfoot>";
    return V2.articulo("Esfuerzo por perfil", V2.tabla(["Perfil", "Horas", "Importe"], filas || '<tr><td colspan="3">Sin horas asignadas todavía.</td></tr>', pie));
  }

  function porTarea(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const filas = N().lista(pr.tareas).map(t => {
      const dt = E().deTarea(pr, pf, t);
      return V2.fila([
        { html: N().esc(t.nombre) },
        { html: N().lista(t.subtareas).length, clase: "nz-table__right" },
        { html: dt.hitos.length, clase: "nz-table__right" },
        { html: N().fmtPct(dt.pct), clase: "nz-table__right" },
        { html: V2.hor(C().tareaHoras(t)), clase: "nz-table__right" },
        { html: imp ? V2.imp(C().tareaImporte(t, pf)) : "", clase: "nz-table__right pa-importe" }
      ]);
    }).join("");
    const pie = '<tfoot><tr><td>Total</td><td class="nz-table__right">' + N().suma(pr.tareas, t => N().lista(t.subtareas).length) + '</td><td class="nz-table__right">' + E().porEstado(pr).total + '</td><td class="nz-table__right">—</td><td class="nz-table__right">' + V2.hor(C().horasProyecto(pr)) + '</td><td class="nz-table__right pa-importe">' + (imp ? V2.imp(C().importeProyecto(pr, pf)) : "") + "</td></tr></tfoot>";
    return V2.articulo("Por tareas", V2.tabla(["Tarea", "Subtareas", "Entregables", "% fact.", "Horas", "Importe"], filas || '<tr><td colspan="6">Sin tareas.</td></tr>', pie));
  }

  function facturacionPorMes(pr, pf) {
    const V2 = V();
    const plan = E().planFacturacion(pr, pf);
    if (!plan.length) return "";
    const imp = V2.hayImportes();
    const meses = C().mesesProyecto(pr);
    const filas = [];
    for (let i = 0; i < meses; i++) {
      const hitos = plan.filter(h => h.mes === i);
      if (!hitos.length) continue;
      filas.push(V2.fila([
        { html: N().etiquetaMes(pr.fechaInicio, i) },
        { html: hitos.length, clase: "nz-table__right" },
        { html: N().esc(hitos.map(h => h.nombre).join(" · ")), clase: "pa-mini" },
        { html: imp ? V2.imp(N().r2(N().suma(hitos, h => h.importe))) : "", clase: "nz-table__right pa-importe" }
      ]));
    }
    const res = E().resumenFacturacion(pr, pf);
    const pie = '<tfoot><tr><td colspan="3"><strong>Total planificado</strong> (base imponible ' + (imp ? V2.imp(res.base) : "") + ")</td><td class=\"nz-table__right pa-importe\"><strong>" + (imp ? V2.imp(res.total) : "") + "</strong></td></tr></tfoot>";
    return V2.articulo("Facturación planificada por mes", V2.tabla(["Mes", "Hitos", "Entregables", "Importe"], filas.join(""), pie));
  }

  function render() {
    const V2 = V(), pr = APP().pr(), pf = APP().pf();
    if (!pr) return;
    V2.escribir("res-totales", totales(pr, pf));
    V2.escribir("res-perfiles", porPerfil(pr, pf));
    V2.escribir("res-tareas", porTarea(pr, pf));
    V2.escribir("res-facturacion", facturacionPorMes(pr, pf));
  }

  PL.vistas.resumen = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
