"use strict";
/* =====================================================================
   Planifica v3 — AYUDAS DE VISTA
   Utilidades compartidas por las 8 vistas y el registro PL.vistas.
   Regla de oro: una vista NO puede tumbar la app. `escribir` comprueba
   siempre que el nodo existe y solo toca el DOM si el HTML cambió (así no
   se pierde el foco de un input al repintar).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  const APP = () => PL.app;

  /* ---------- Pintado seguro ---------- */

  function nodo(id) { return document.getElementById(id); }

  /** Pinta HTML en un nodo. Devuelve false si el nodo no existe (nunca lanza). */
  function escribir(id, html) {
    const el = nodo(id);
    if (!el) return false;
    if (el.__paHtml === html) return true;   /* idéntico: no se toca el DOM */
    el.innerHTML = html;
    el.__paHtml = html;
    return true;
  }

  function vaciar(id) { escribir(id, ""); }

  /** Repinta un nodo solo si necesita actualizarse (evita perder el foco). */
  function texto(id, valor) {
    const el = nodo(id);
    if (!el) return false;
    if (el.textContent !== valor) el.textContent = valor;
    return true;
  }

  /* ---------- Formato dependiente del estado ---------- */

  const moneda = () => { const a = APP(); return a ? a.moneda() : "€"; };
  const hayImportes = () => { const a = APP(); return a ? a.verImportes() : true; };

  function imp(v) { return N().fmtImporte(v, moneda()); }
  function impSi(v) { return hayImportes() ? imp(v) : ""; }
  function hor(v) { return N().fmtHoras(v); }

  /* ---------- Etiquetas ---------- */

  function badgeOferta(pr) {
    const e = M().ESTADOS_OFERTA[pr.estado] || M().ESTADOS_OFERTA.borrador;
    return '<span class="nz-badge ' + e.badge + '">' + e.texto + '</span>';
  }

  function badgeHito(estado) {
    const e = (M().ESTADOS_ENTREGABLE[estado] || M().ESTADOS_ENTREGABLE.pendiente);
    return '<span class="nz-badge ' + e.badge + '">' + e.texto + '</span>';
  }

  function puntoEstado(estado) {
    const clase = "pa-punto pa-punto--" + (estado || "pendiente");
    return '<span class="' + clase + '" title="' + N().esc((M().ESTADOS_ENTREGABLE[estado] || {}).texto || "") + '"></span>';
  }

  /* ---------- Controles reutilizables ---------- */

  function selectEstadoHito(actual, id, tareaId) {
    const est = M().ESTADOS_ENTREGABLE;
    return '<select class="nz-input nz-input--sm" data-campo="hito-estado" data-id="' + id + '" data-tarea="' + (tareaId || "") + '" style="min-width:8.5rem">' +
      Object.keys(est).map(k => '<option value="' + k + '"' + (actual === k ? " selected" : "") + ">" + est[k].texto + "</option>").join("") +
      "</select>";
  }

  function selectMes(pr, actual, campo, id, tareaId) {
    const meses = C().mesesProyecto(pr);
    let o = "";
    for (let i = 0; i < meses; i++) {
      o += '<option value="' + i + '"' + (N().num(actual) === i ? " selected" : "") + ">" + N().etiquetaMes(pr.fechaInicio, i) + "</option>";
    }
    return '<select class="nz-input nz-input--sm" data-campo="' + campo + '" data-id="' + id + '" data-tarea="' + (tareaId || "") + '" aria-label="Mes de entrega">' + o + "</select>";
  }

  function selectPerfil(pf, actual, campo, id, tareaId, vacio) {
    return '<select class="nz-input nz-input--sm" data-campo="' + campo + '" data-id="' + id + '" data-tarea="' + (tareaId || "") + '" style="min-width:11rem">' +
      '<option value=""' + (!actual ? " selected" : "") + ">" + (vacio || "— Sin responsable —") + "</option>" +
      N().lista(pf).filter(p => !p.esDefecto || true).map(p =>
        '<option value="' + p.id + '"' + (p.id === actual ? " selected" : "") + ">" + N().esc(p.nombre) + "</option>").join("") +
      "</select>";
  }

  /** Fila editable de un entregable. `h` viene de PL.entregables.todos()
      (aplanado: incluye _contexto y _tareaId). */
  function htmlHito(pr, pf, h) {
    const id = h.id;
    /* Acepta los dos formatos aplanados de entregable: {_contexto,_tareaId} y {contexto,tareaId}. */
    const contexto = (h._contexto !== undefined) ? h._contexto : h.contexto;
    const tareaId = (h._tareaId !== undefined ? h._tareaId : h.tareaId) || "";
    const importe = N().r2(E().baseDe(pr, pf, h) * N().num(h.facturacionPct) / 100);
    const deOferta = contexto === "oferta";
    return '' +
      '<div class="pa-hito" data-id="' + id + '">' +
        '<span class="pa-hito__nombre">' + puntoEstado(h.estado) +
          '<input class="nz-input" style="width:calc(100% - 1.2rem)" data-campo="hito-nombre" data-id="' + id + '" data-tarea="' + tareaId + '" value="' + N().esc(h.nombre) + '">' +
        "</span>" +
        selectMes(pr, h.mes, "hito-mes", id, tareaId) +
        selectEstadoHito(h.estado, id, tareaId) +
        selectPerfil(pf, h.responsablePerfilId, "hito-responsable", id, tareaId) +
        '<label class="pa-mini">% <input class="nz-input nz-input--sm pa-input-corto" type="number" min="0" max="100" step="5" data-campo="hito-pct" data-id="' + id + '" data-tarea="' + tareaId + '" value="' + (N().num(h.facturacionPct) || "") + '"></label>' +
        '<span class="nz-badge nz-badge--brand pa-importe pa-celda-importe">' + imp(importe) + "</span>" +
        (deOferta ? '<span class="nz-badge nz-badge--neutral">de la oferta</span>' : "") +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-entregable" data-id="' + id + '" data-tarea="' + tareaId + '" title="Duplicar entregable">⧉</button>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-entregable" data-id="' + id + '" data-tarea="' + tareaId + '" title="Eliminar entregable">✕</button>' +
        '<span class="pa-hito__detalle pa-fila pa-fila--apretada">' +
          '<input class="nz-input nz-input--sm pa-crece2" data-campo="hito-desc" data-id="' + id + '" data-tarea="' + tareaId + '" value="' + N().esc(h.descripcion || "") + '" placeholder="Descripción del entregable">' +
          '<input class="nz-input nz-input--sm pa-crece" data-campo="hito-criterio" data-id="' + id + '" data-tarea="' + tareaId + '" value="' + N().esc(h.criterio || "") + '" placeholder="Criterio de aceptación">' +
          '<input class="nz-input nz-input--sm pa-input-fecha" type="date" data-campo="hito-fecha" data-id="' + id + '" data-tarea="' + tareaId + '" value="' + N().esc(h.fecha || "") + '" title="Fecha exacta (opcional)">' +
        "</span>" +
      "</div>";
  }

  /* ---------- Piezas de composición ---------- */

  function articulo(titulo, cuerpo, extra) {
    return '<article class="nz-article">' + (titulo ? '<h3 class="nz-h3">' + titulo + "</h3>" : "") + (extra || "") + cuerpo + "</article>";
  }

  function tabla(cabeceras, filas, pie) {
    return '<div class="nz-table-wrap"><table class="nz-table">' +
      (cabeceras && cabeceras.length ? "<thead><tr>" + cabeceras.map(c => '<th class="nz-table__right">' + c + "</th>").join("") + "</tr></thead>" : "") +
      "<tbody>" + (filas || "") + "</tbody>" +
      (pie || "") + "</table></div>";
  }

  function tablaEsfuerzo(cabeceras, filas, pie) {
    return '<div class="nz-table-wrap"><table class="nz-table nz-table--compact">' +
      (cabeceras && cabeceras.length ? "<thead><tr>" + cabeceras.map(c => '<th class="nz-table__right">' + c + "</th>").join("") + "</tr></thead>" : "") +
      "<tbody>" + (filas || "") + "</tbody>" + (pie || "") + "</table></div>";
  }

  function fila(celdas, clase) {
    return "<tr" + (clase ? ' class="' + clase + '"' : "") + ">" + celdas.map(c => "<td" + (c.clase ? ' class="' + c.clase + '"' : "") + ">" + (c.html !== undefined ? c.html : c) + "</td>").join("") + "</tr>";
  }

  function aviso(tipo, texto) {
    return '<div class="nz-callout nz-callout--' + tipo + '" style="margin-bottom:var(--nz-space-2)"><p>' + texto + "</p></div>";
  }

  function vacio(icono, titulo, cuerpo, acciones) {
    return '<div class="nz-empty"><span class="nz-empty__icon">' + icono + '</span>' +
      '<p class="nz-empty__title">' + titulo + "</p>" +
      '<p class="nz-empty__body">' + cuerpo + "</p>" + (acciones || "") + "</div>";
  }

  /** Importe/valor con signo para el comparador. formato: "horas" | "numero" | importe. */
  function delta(n, formato) {
    const v = N().r2(n);
    const clase = v > 0.005 ? "pa-delta pa-delta--mas" : "pa-delta";
    const valor = formato === "horas" ? hor(v) : (formato === "numero" ? N().fmtNum(v) : imp(v));
    return '<span class="' + clase + '">' + valor + "</span>";
  }

  PL.vistas = {
    nodo: nodo, escribir: escribir, vaciar: vaciar, texto: texto,
    moneda: moneda, hayImportes: hayImportes, imp: imp, impSi: impSi, hor: hor,
    badgeOferta: badgeOferta, badgeHito: badgeHito, puntoEstado: puntoEstado,
    selectEstadoHito: selectEstadoHito, selectMes: selectMes, selectPerfil: selectPerfil,
    htmlHito: htmlHito,
    articulo: articulo, tabla: tabla, tablaEsfuerzo: tablaEsfuerzo,
    fila: fila, aviso: aviso, vacio: vacio, delta: delta
  };
})(typeof window !== "undefined" ? window : globalThis);
