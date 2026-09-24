"use strict";
/* =====================================================================
   Planifica v3 — VISTA: CRONOGRAMA
   Barras por mes (importe u horas), marcadores de entregable sobre cada
   mes y tabla de esfuerzo por tarea y mes.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function barras(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const meses = C().mesesProyecto(pr);
    const valores = Array.from({ length: meses }, (_, i) => imp ? C().importeMes(pr, pf, i) : C().horasMes(pr, i));
    const max = Math.max.apply(null, valores.concat([1]));
    const cols = valores.map((v, i) => {
      const texto = imp ? V2.imp(v) : V2.hor(v);
      return '<div class="nz-chart-bar__col" title="' + N().etiquetaMes(pr.fechaInicio, i) + ": " + texto + '">' +
        '<div class="nz-chart-bar__bar" style="height:' + Math.max(2, v / max * 100) + '%"></div>' +
        '<span class="nz-chart-bar__label">' + N().etiquetaMes(pr.fechaInicio, i) + "</span></div>";
    }).join("");
    return V2.articulo("", '<figure class="nz-chart"><div class="nz-chart__head"><div>' +
      '<span class="nz-chart__title">' + (imp ? "Importe por mes" : "Horas por mes") + "</span>" +
      '<span class="nz-chart__sub">' + meses + " meses desde " + N().etiquetaMes(pr.fechaInicio, 0) + "</span>" +
      '</div></div><div class="nz-chart__body"><div class="nz-chart-bar nz-chart-bar--sm">' + cols + "</div></div>" +
      '<figcaption class="nz-chart__source">' + (imp ? "Pasa el ratón por cada barra para ver el importe exacto." : "Modo solo tiempos: activa 👁 € para ver importes.") + "</figcaption></figure>");
  }

  /** Marcadores de entregables: un diamante por mes con hitos. */
  function marcadores(pr, pf) {
    const V2 = V();
    const meses = C().mesesProyecto(pr);
    const porMes = E().porMes(pr);
    const imp = V2.hayImportes();
    const cols = [];
    for (let i = 0; i < meses; i++) {
      const hitos = porMes[i] || [];
      const titulo = hitos.map(h => "• " + h.nombre + " (" + (E().estadoDe(h).texto) + ")").join("\n");
      cols.push('<div class="pa-marcador" title="' + N().esc(titulo || "Sin entregables") + '">' +
        (hitos.length ? '<span class="pa-marcador__diamante">◆</span>' : '<span class="pa-mini">·</span>') +
        (hitos.length > 1 ? '<span class="pa-mini">' + hitos.length + "</span>" : "") +
        '<br><span class="pa-mini">' + N().etiquetaMes(pr.fechaInicio, i) + "</span></div>");
    }
    const plan = E().planFacturacion(pr, pf);
    const res = E().resumenFacturacion(pr, pf);
    return V2.articulo("Entregables en el calendario",
      '<div class="pa-marcadores">' + cols.join("") + "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">◆ = mes con entregables · ' + plan.length + " hitos en total" +
      (imp ? " · " + V2.imp(res.facturado) + " facturados (" + V2.imp(res.pendienteFacturar) + " pendientes)" : "") + "</p>");
  }

  function tablaMeses(pr, pf) {
    const V2 = V();
    const meses = C().mesesProyecto(pr);
    const cabs = ["Tarea"].concat(Array.from({ length: meses }, (_, i) => N().etiquetaMes(pr.fechaInicio, i))).concat(["Total"]);
    const filas = N().lista(pr.tareas).map(t => {
      const porMes = Array.from({ length: meses }, () => 0);
      N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
        for (let i = 0; i < meses; i++) porMes[i] += N().num((l.horas || {})["m" + i]);
      }));
      return V2.fila([{ html: "<strong>" + N().esc(t.nombre) + "</strong>" }]
        .concat(porMes.map(h => ({ html: h ? N().fmtNum(h) : '<span class="pa-mini">·</span>', clase: "nz-table__right" })))
        .concat([{ html: "<strong>" + V2.hor(C().tareaHoras(t)) + "</strong>", clase: "nz-table__right" }]));
    }).join("");
    const totales = Array.from({ length: meses }, (_, i) => C().horasMes(pr, i));
    const pie = '<tfoot><tr><td><strong>Horas por mes</strong></td>' + totales.map(h => '<td class="nz-table__right"><strong>' + (h ? N().fmtNum(h) : "·") + "</strong></td>").join("") +
      '<td class="nz-table__right"><strong>' + V2.hor(C().horasProyecto(pr)) + "</strong></td></tr></tfoot>";
    return V2.articulo("Esfuerzo por tarea y mes", V2.tablaEsfuerzo(cabs, filas || '<tr><td colspan="3">Sin tareas.</td></tr>', pie));
  }

  function render() {
    const V2 = V(), pr = APP().pr(), pf = APP().pf();
    if (!pr) { V2.vaciar("cro-barras"); V2.vaciar("cro-tabla"); V2.vaciar("cro-hitos"); return; }
    V2.escribir("cro-barras", barras(pr, pf));
    V2.escribir("cro-hitos", marcadores(pr, pf));
    V2.escribir("cro-tabla", tablaMeses(pr, pf));
  }

  PL.vistas.cronograma = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
