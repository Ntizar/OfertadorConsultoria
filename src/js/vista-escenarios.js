"use strict";
/* =====================================================================
   Planifica v3 — VISTA: ESCENARIOS Y VERSIONES
   Guardar alternativas (base / recortada / ampliada) y versiones enviadas,
   compararlas entre sí o con la oferta actual, y aplicar cualquiera.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const X = () => PL.comparar;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /* ---------- Cabecera con las acciones ---------- */

  function cabecera(pr, pf) {
    const V2 = V();
    const res = X().resumen(pr, pf);
    const nEsc = N().lista(pr.escenarios).length, nVer = N().lista(pr.versiones).length;
    const cuerpo =
      '<p class="pa-mini">Un <strong>escenario</strong> es una alternativa de esta misma oferta (base, recortada, ampliada…). ' +
      'Una <strong>versión</strong> es la foto de lo que enviaste al cliente un día concreto. Las dos se comparan con el mismo cuadro de diferencias.</p>' +
      '<div class="pa-fila" style="margin-top:var(--nz-space-2)">' +
      '<button class="nz-btn nz-btn--primary" data-acc="escenario-abrir">＋ Guardar escenario actual</button>' +
      '<button class="nz-btn nz-btn--soft" data-acc="version-abrir">🕒 Congelar versión actual</button>' +
      '<span class="pa-espacio"></span>' +
      '<span class="pa-mini">Ahora mismo: ' + (V2.hayImportes() ? V2.imp(res.total) + " · " : "") + V2.hor(res.horas) + " · " + res.entregables + " entregables</span>" +
      "</div>";
    return V2.articulo("Escenarios y versiones de la oferta", cuerpo,
      '<p class="pa-mini">' + nEsc + " escenario(s) · " + nVer + " versión(es) guardada(s)</p>");
  }

  /* ---------- Listas ---------- */

  function filaEscenario(pr, pf, e) {
    const V2 = V();
    const r = X().resumen(pr, pf, e.snapshot);
    return '<div class="pa-fila-dato">' +
      '<span class="pa-crece2"><strong>' + N().esc(e.nombre) + "</strong>" +
      (e.etiqueta ? ' <span class="nz-badge nz-badge--neutral">' + N().esc(e.etiqueta) + "</span>" : "") +
      '<br><span class="pa-mini">creado ' + N().esc(e.creado) + " · " + (V2.hayImportes() ? V2.imp(r.total) + " · " : "") + V2.hor(r.horas) + " · " + r.meses + " meses · " + r.entregables + " entregables</span></span>" +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="escenario-comparar" data-id="' + e.id + '">Comparar con la actual</button>' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="escenario-aplicar" data-id="' + e.id + '">Aplicar</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="escenario-borrar" data-id="' + e.id + '" title="Eliminar escenario">✕</button>' +
      "</div>";
  }

  function filaVersion(pr, pf, v) {
    const V2 = V();
    const r = v.resumen || X().resumen(pr, pf, v.snapshot);
    return '<div class="pa-fila-dato">' +
      '<span class="pa-crece2"><strong>' + N().esc(v.etiqueta) + "</strong>" +
      '<br><span class="pa-mini">' + N().esc(v.fecha) + (v.nota ? " · " + N().esc(v.nota) : "") + " · " +
      (V2.hayImportes() ? V2.imp(r.total) + " · " : "") + V2.hor(r.horas) + " · " + r.entregables + " entregables</span></span>" +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="version-comparar" data-id="' + v.id + '">Qué ha cambiado desde aquí</button>' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="version-aplicar" data-id="' + v.id + '">Restaurar</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="version-borrar" data-id="' + v.id + '" title="Eliminar versión">✕</button>' +
      "</div>";
  }

  function listaEscenarios(pr, pf) {
    const V2 = V();
    const es = N().lista(pr.escenarios);
    return V2.articulo("Escenarios", es.length
      ? es.map(e => filaEscenario(pr, pf, e)).join("")
      : V2.vacio("🧭", "Sin escenarios guardados", "Guarda el estado actual como «Base» y luego prueba a recortar o ampliar la oferta: podrás comparar las dos alternativas con sus diferencias."));
  }

  function listaVersiones(pr, pf) {
    const V2 = V();
    const vs = N().lista(pr.versiones).slice().reverse();
    return V2.articulo("Versiones congeladas", vs.length
      ? vs.map(v => filaVersion(pr, pf, v)).join("")
      : V2.vacio("🕒", "Sin versiones congeladas", "Congela una versión antes de enviar la oferta al cliente: quedará guardada con su importe y podrás ver qué ha cambiado desde entonces."));
  }

  /* ---------- Comparador ---------- */

  function cuadroComparacion(pr, pf, filas) {
    const V2 = V();
    const cmp = filas.cmp;
    const cuerpo =
      V2.tabla(["", cmp.etiquetaA, cmp.etiquetaB, "Diferencia"],
        cmp.economia.map(l => V2.fila([
          { html: l.texto },
          { html: V2.hayImportes() ? V2.imp(l.a) : "", clase: "nz-table__right" },
          { html: V2.hayImportes() ? V2.imp(l.b) : "", clase: "nz-table__right" },
          { html: Math.abs(l.d) > 0.005 ? V2.delta(l.d) : '<span class="pa-mini">sin cambio</span>', clase: "nz-table__right" }
        ])).join(""));

    const estructura = V2.tabla(["", cmp.etiquetaA, cmp.etiquetaB, "Diferencia"],
      cmp.estructura.map(l => V2.fila([
        { html: l.texto },
        { html: l.clave === "horas" ? V2.hor(l.a) : (l.clave === "facturadoTotal" && !V2.hayImportes() ? "" : N().fmtNum(l.a)), clase: "nz-table__right" },
        { html: l.clave === "horas" ? V2.hor(l.b) : (l.clave === "facturadoTotal" && !V2.hayImportes() ? "" : N().fmtNum(l.b)), clase: "nz-table__right" },
        { html: Math.abs(l.d) > 0.005 ? V2.delta(l.d, l.clave === "horas" ? "horas" : (l.clave === "facturadoTotal" ? "importe" : "numero")) : '<span class="pa-mini">igual</span>', clase: "nz-table__right" }
      ])).join(""));

    const perfiles = cmp.porPerfil.length
      ? V2.tabla(["Perfil", "Horas antes", "Horas ahora", "Diferencia"],
        cmp.porPerfil.map(x => V2.fila([
          { html: N().esc(x.nombre) },
          { html: V2.hor(x.a), clase: "nz-table__right" },
          { html: V2.hor(x.b), clase: "nz-table__right" },
          { html: Math.abs(x.d) > 0.005 ? V2.delta(x.d, "horas") : '<span class="pa-mini">igual</span>', clase: "nz-table__right" }
        ])).join("")) : '<p class="pa-mini">Sin horas por perfil que comparar.</p>';

    const meses = cmp.porMes.filter(m => m.a || m.b).length
      ? V2.tabla(["Mes", "Antes", "Ahora", "Diferencia"],
        cmp.porMes.filter(m => m.a || m.b).map(m => V2.fila([
          { html: m.etiqueta },
          { html: V2.hayImportes() ? V2.imp(m.a) : "", clase: "nz-table__right" },
          { html: V2.hayImportes() ? V2.imp(m.b) : "", clase: "nz-table__right" },
          { html: Math.abs(m.d) > 0.005 ? V2.delta(m.d) : '<span class="pa-mini">igual</span>', clase: "nz-table__right" }
        ])).join("")) : "";

    const cambios = cmp.cambios.length
      ? '<div class="pa-bloque">' + cmp.cambios.map(c => '<p class="pa-cambio">' + iconoCambio(c.tipo) + " " + N().esc(c.texto) + "</p>").join("") + "</div>"
      : '<p class="pa-mini">Sin cambios de estructura entre las dos fotos.</p>';

    return V2.articulo("Diferencias: " + N().esc(cmp.etiquetaA) + " → " + N().esc(cmp.etiquetaB),
      '<div class="pa-bloque">' + cuerpo + "</div>" +
      '<div class="pa-bloque">' + estructura + "</div>" +
      '<div class="pa-bloque"><p class="pa-mini pa-mini--fuerte">Esfuerzo por perfil</p>' + perfiles + "</div>" +
      (meses ? '<div class="pa-bloque"><p class="pa-mini pa-mini--fuerte">Importe por mes</p>' + meses + "</div>" : "") +
      '<div class="pa-bloque"><p class="pa-mini pa-mini--fuerte">Qué ha cambiado</p>' + cambios + "</div>",
      '<div class="pa-fila" style="margin-bottom:var(--nz-space-2)"><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="escenario-cerrar-comparacion">✕ Cerrar comparación</button></div>');
  }

  function iconoCambio(tipo) {
    if (tipo === "tarea+" || tipo === "hito+") return '<span class="nz-badge nz-badge--success">＋</span>';
    if (tipo === "tarea-" || tipo === "hito-") return '<span class="nz-badge nz-badge--danger">−</span>';
    return '<span class="nz-badge nz-badge--brand">~</span>';
  }

  function render() {
    const V2 = V(), APP2 = APP();
    const pr = APP2.pr(), pf = APP2.pf();
    if (!pr) { V2.vaciar("pa-escenarios"); V2.vaciar("pa-versiones"); V2.vaciar("esc-cabecera"); return; }
    V2.escribir("esc-cabecera", cabecera(pr, pf));
    V2.escribir("pa-escenarios", listaEscenarios(pr, pf));
    V2.escribir("pa-versiones", listaVersiones(pr, pf));

    const ui = APP2.ui || {};
    if (ui.comparacion) V2.escribir("esc-comparacion", cuadroComparacion(pr, pf, ui.comparacion));
    else V2.vaciar("esc-comparacion");
  }

  PL.vistas.escenarios = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
