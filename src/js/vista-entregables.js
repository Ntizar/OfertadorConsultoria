"use strict";
/* =====================================================================
   Planifica v3 — VISTA: ENTREGABLES
   Todos los hitos de la oferta en un sitio: los de cada tarea (agrupados)
   y los de la propia oferta, más el plan de facturación por hito.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function kpis(pr, pf) {
    const V2 = V();
    const res = E().resumenFacturacion(pr, pf);
    const est = E().porEstado(pr);
    const imp = V2.hayImportes();
    return '<div class="nz-dash-grid nz-dash-grid--4">' +
      '<div class="nz-kpi nz-kpi--bordered"><span class="nz-kpi__label">Entregables</span><span class="nz-kpi__value">' + est.total + '</span><span class="nz-kpi__delta">' + est.finalizados + " finalizados</span></div>" +
      '<div class="nz-kpi nz-kpi--bordered"><span class="nz-kpi__label">Avance</span><span class="nz-kpi__value">' + N().fmtPct(est.pct) + '</span><span class="nz-kpi__delta">' + est.pendiente + " pendientes · " + est.encurso + " en curso</span></div>" +
      '<div class="nz-kpi nz-kpi--bordered"><span class="nz-kpi__label">Facturado</span><span class="nz-kpi__value">' + (imp ? V2.imp(res.facturado) : "—") + '</span><span class="nz-kpi__delta">' + (imp ? "cobrado " + V2.imp(res.cobrado) : "modo solo tiempos") + "</span></div>" +
      '<div class="nz-kpi nz-kpi--bordered"><span class="nz-kpi__label">Pendiente de facturar</span><span class="nz-kpi__value">' + (imp ? V2.imp(res.pendienteFacturar) : "—") + '</span><span class="nz-kpi__delta">' + (imp ? "planificado " + V2.imp(res.total) + " · " + N().fmtPct(res.cobertura) + " de la base" : "") + "</span></div>" +
      "</div>";
  }

  function avisos(pr) {
    const V2 = V();
    const av = E().avisosPorcentajes(pr);
    if (!av.length) {
      return V2.aviso("tip", "Los porcentajes de facturación de cada tarea suman el 100 %: el plan cubre el importe completo.");
    }
    return av.map(a => V2.aviso("warning",
      "<strong>" + N().esc(a.nombre) + "</strong>: los entregables suman " + N().fmtPct(a.suma) +
      (a.diferencia > 0 ? " — queda " + N().fmtPct(a.diferencia) + " sin asignar." : " — hay " + N().fmtPct(-a.diferencia) + " de más (revisa los porcentajes)."))).join("");
  }

  function bloqueTareas(pr, pf) {
    const V2 = V();
    return N().lista(pr.tareas).map(t => {
      const hitos = N().lista(t.entregables);
      const dt = E().deTarea(pr, pf, t);
      const planT = E().planFacturacion(pr, pf).filter(h => h.tareaId === t.id);
      const cab = '<p class="pa-mini pa-mini--fuerte">' + N().esc(t.nombre) + " · " + dt.hitos.length + " entregable(s)" +
        (V2.hayImportes() ? " · " + V2.imp(dt.importe) : "") + " · " + N().fmtPct(dt.pct) + " asignado" +
        (Math.abs(dt.pct - 100) > 0.005 ? ' <span class="nz-badge nz-badge--warning">no cierra al 100 %</span>' : "") + "</p>";
      const cuerpo = hitos.length
        ? planT.map(h => V2.htmlHito(pr, pf, h)).join("")
        : '<p class="pa-mini">Sin entregables en esta tarea. Añade el primero con «＋ Entregable» (arriba a la derecha).</p>';
      return V2.articulo("", cuerpo, cab +
        '<div class="pa-fila" style="margin-bottom:var(--nz-space-1)">' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-entregable-tarea" data-id="' + t.id + '">＋ Entregable de esta tarea</button>' +
        '<span class="pa-mini">Suma ' + C().horasProyecto({ tareas: [t] }) + " h</span></div>");
    }).join("");
  }

  function bloqueOferta(pr, pf) {
    const V2 = V();
    const hitos = E().planFacturacion(pr, pf).filter(h => h.contexto === "oferta");
    const cuerpo = hitos.length
      ? hitos.map(h => V2.htmlHito(pr, pf, h)).join("")
      : '<p class="pa-mini">Sin hitos sueltos de oferta. Sirven para reuniones de seguimiento, gestión o informes que no dependen de una tarea.</p>';
    return V2.articulo("", cuerpo,
      '<p class="pa-mini pa-mini--fuerte">Hitos de la oferta (sin tarea) · ' + hitos.length + " · " +
      (hitos.length ? "facturan sobre la base imponible de la oferta" : "vacíos") + "</p>" +
      '<div class="pa-fila" style="margin-bottom:var(--nz-space-1)">' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-entregable-oferta">＋ Entregable de la oferta</button></div>');
  }

  function tablaPlan(pr, pf) {
    const V2 = V();
    const plan = E().planFacturacion(pr, pf);
    if (!plan.length) return "";
    const conImp = V2.hayImportes();
    const cabs = ["Mes", "Entregable", "Dónde", "Estado", "%", "Importe"].concat(conImp ? ["Acumulado"] : []).concat(["Facturado"]);
    const filas = plan.map(h => V2.fila([
      { html: h.mesEtiqueta },
      { html: N().esc(h.nombre) },
      { html: h.contexto === "oferta" ? '<span class="nz-badge nz-badge--neutral">oferta</span>' : N().esc(h.tareaNombre) },
      { html: V2.badgeHito(h.estado) },
      { html: N().fmtPct(h.pct), clase: "nz-table__right" },
      { html: conImp ? V2.imp(h.importe) : "", clase: "nz-table__right pa-importe" },
      conImp ? { html: V2.imp(h.acumulado), clase: "nz-table__right" } : null,
      { html: h.facturado ? "Sí" : "—", clase: "nz-table__right" }
    ].filter(Boolean)));
    const res = E().resumenFacturacion(pr, pf);
    const pie = '<tfoot><tr><td colspan="5"><strong>Total planificado</strong></td><td class="nz-table__right ' + (conImp ? "" : "pa-importe") + '"><strong>' + (conImp ? V2.imp(res.total) : "") + "</strong></td>" +
      (conImp ? '<td class="nz-table__right"><strong>' + V2.imp(res.total) + "</strong></td>" : "") +
      '<td class="nz-table__right">' + (conImp ? V2.imp(res.facturado) : "") + "</td></tr></tfoot>";
    return V2.articulo("Plan de facturación por hito", V2.tabla(cabs, filas.join(""), pie));
  }

  function render(cont) {
    const V2 = V(), pr = APP().pr(), pf = APP().pf();
    if (!pr) { V2.vaciar("pa-entregables"); return; }
    V2.escribir("ent-resumen", kpis(pr, pf));
    V2.escribir("ent-avisos", avisos(pr));
    V2.escribir(cont || "pa-entregables",
      bloqueTareas(pr, pf) + bloqueOferta(pr, pf) + tablaPlan(pr, pf));
  }

  PL.vistas.entregables = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
