"use strict";
/* =====================================================================
   Planifica v4 — AYUDAS DE VISTA
   Utilidades compartidas por las 5 vistas. Regla de oro: una vista NO puede
   tumbar la app, y `escribir` solo toca el DOM si el HTML cambió (así no se
   pierde el foco y no hay parpadeos al repintar todo).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const APP = () => PL.app;

  function nodo(id) { return document.getElementById(id); }

  /** Pinta HTML en un nodo. Devuelve false si el nodo no existe (nunca lanza). */
  function escribir(id, html) {
    const el = nodo(id);
    if (!el) return false;
    if (el.__paHtml === html) return true;
    el.innerHTML = html;
    el.__paHtml = html;
    return true;
  }

  function vaciar(id) { return escribir(id, ""); }

  /** Escribe texto solo si cambia (evita perder el foco). */
  function texto(id, valor) {
    const el = nodo(id);
    if (!el) return false;
    const v = String(valor === null || valor === undefined ? "" : valor);
    if (el.textContent !== v) el.textContent = v;
    return true;
  }

  /* ---------- Formato según el estado ---------- */

  const moneda = () => { const a = APP(); return a ? a.moneda() : "€"; };
  const verImportes = () => { const a = APP(); return a ? a.verImportes() : true; };
  function imp(v) { return N().fmtImporte(v, moneda()); }
  function impSi(v) { return verImportes() ? imp(v) : ""; }
  function hor(v) { return N().fmtHoras(v); }

  function badgeOferta(o) {
    const e = M().ESTADOS_OFERTA[o.estado] || M().ESTADOS_OFERTA.borrador;
    return '<span class="nz-badge ' + e.badge + '">' + e.texto + "</span>";
  }

  /* ---------- Controles ---------- */

  /** Selector de periodo de entrega (con el rótulo que el usuario ve). */
  function selectPeriodo(o, actual, campo, id, tareaId) {
    const cols = P().columnas(o.periodos);
    return '<select class="nz-input nz-input--sm" data-campo="' + campo + '" data-id="' + id + '" data-tarea="' + (tareaId || "") + '" ' +
      'title="Mes de entrega" aria-label="Mes de entrega" style="min-width:7rem">' +
      cols.map(c => {
        const i = c.periodos[0];
        const dentro = c.periodos.indexOf(N().num(actual)) >= 0;
        return '<option value="' + i + '"' + (dentro ? " selected" : "") + ">" + N().esc(c.etiqueta) + " " + c.anio + "</option>";
      }).join("") + "</select>";
  }

  function selectPerfil(pf, actual, campo, id, tareaId, vacio) {
    return '<select class="nz-input nz-input--sm" data-campo="' + campo + '" data-id="' + id + '" data-tarea="' + (tareaId || "") + '" ' +
      'style="min-width:10rem" aria-label="Responsable">' +
      '<option value=""' + (!actual ? " selected" : "") + ">" + (vacio || "— Sin responsable —") + "</option>" +
      N().lista(pf).map(p => '<option value="' + p.id + '"' + (p.id === actual ? " selected" : "") + ">" + N().esc(p.nombre) + "</option>").join("") +
      "</select>";
  }

  /** Fila editable de un entregable. `e` puede venir de PL.entregables.todos(). */
  function htmlEntregable(o, pf, e, contexto, tareaId) {
    const id = e.id;
    const tId = (tareaId !== undefined) ? tareaId : (e._tareaId || "");
    const esOferta = (contexto || e._contexto) === "oferta";
    return '<div class="pa-hito" data-id="' + id + '">' +
      '<span class="pa-hito__nombre"><input class="nz-input" data-campo="hito-nombre" data-id="' + id + '" data-tarea="' + tId + '" value="' + N().esc(e.nombre) + '" placeholder="Nombre del entregable"></span>' +
      '<span class="pa-ahora pa-mini">◆</span>' +
      selectPeriodo(o, e.periodo, "hito-periodo", id, tId) +
      (esOferta ? '<span class="nz-badge nz-badge--accent">de la oferta</span>' : "") +
      selectPerfil(pf, e.responsablePerfilId, "hito-responsable", id, tId) +
      '<label class="pa-mini pa-ahora">horas <input class="nz-input nz-input--sm pa-input-corto" type="number" min="0" step="1" data-campo="hito-horas" data-id="' + id + '" data-tarea="' + tId + '" value="' + (N().num(e.horas) || "") + '" title="Estimación orientativa: no suma al total"></label>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-entregable" data-id="' + id + '" data-tarea="' + tId + '" title="Duplicar entregable">⧉</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-entregable" data-id="' + id + '" data-tarea="' + tId + '" title="Eliminar entregable">✕</button>' +
      '<span class="pa-hito__detalle">' +
        '<input class="nz-input nz-input--sm pa-crece2" data-campo="hito-desc" data-id="' + id + '" data-tarea="' + tId + '" value="' + N().esc(e.descripcion || "") + '" placeholder="Qué incluye este entregable">' +
        '<input class="nz-input nz-input--sm pa-crece" data-campo="hito-criterio" data-id="' + id + '" data-tarea="' + tId + '" value="' + N().esc(e.criterio || "") + '" placeholder="Criterio de aceptación">' +
        '<input class="nz-input nz-input--sm pa-input-fecha" type="date" data-campo="hito-fecha" data-id="' + id + '" data-tarea="' + tId + '" value="' + N().esc(e.fecha || "") + '" title="Fecha exacta (opcional)">' +
      "</span>" +
    "</div>";
  }

  /* ---------- Composición ---------- */

  function articulo(titulo, cuerpo, extra) {
    return '<article class="nz-article">' + (titulo ? '<h3 class="nz-h3">' + titulo + "</h3>" : "") + (extra || "") + cuerpo + "</article>";
  }

  function tabla(cabeceras, filas, pie, clase) {
    return '<div class="nz-table-wrap"><table class="nz-table' + (clase ? " " + clase : "") + '">' +
      (cabeceras && cabeceras.length ? "<thead><tr>" + cabeceras.map(c => '<th class="nz-table__right">' + c + "</th>").join("") + "</tr></thead>" : "") +
      "<tbody>" + (filas || "") + "</tbody>" + (pie || "") + "</table></div>";
  }

  function fila(celdas) {
    return "<tr>" + celdas.map(c => {
      if (c === null || c === undefined) return "<td></td>";
      if (typeof c === "string") return "<td>" + c + "</td>";
      return "<td" + (c.clase ? ' class="' + c.clase + '"' : "") + ">" + (c.html === undefined ? "" : c.html) + "</td>";
    }).join("") + "</tr>";
  }

  function filaDato(celdas, clase) {
    return '<div class="pa-dato' + (clase ? " " + clase : "") + '">' + celdas.filter(Boolean).join("") + "</div>";
  }

  function aviso(tipo, texto_) {
    return '<div class="nz-callout nz-callout--' + tipo + '"><p>' + texto_ + "</p></div>";
  }

  function vacio(icono, titulo, cuerpo, acciones) {
    return '<div class="nz-empty"><span class="nz-empty__icon">' + icono + "</span>" +
      '<p class="nz-empty__title">' + titulo + "</p>" +
      '<p class="nz-empty__body">' + cuerpo + "</p>" + (acciones || "") + "</div>";
  }

  /** Valor con signo para el comparador. */
  function delta(n, formato) {
    const v = N().r2(n);
    const clase = v > 0.005 ? "pa-delta pa-delta--mas" : "pa-delta";
    const valor = formato === "horas" ? hor(v) : (formato === "numero" ? N().fmtNum(v) : imp(v));
    return '<span class="' + clase + '">' + valor + "</span>";
  }

  PL.vistas = {
    nodo: nodo, escribir: escribir, vaciar: vaciar, texto: texto,
    moneda: moneda, verImportes: verImportes, imp: imp, impSi: impSi, hor: hor,
    badgeOferta: badgeOferta, selectPeriodo: selectPeriodo, selectPerfil: selectPerfil, htmlEntregable: htmlEntregable,
    articulo: articulo, tabla: tabla, fila: fila, filaDato: filaDato, aviso: aviso, vacio: vacio, delta: delta
  };
})(typeof window !== "undefined" ? window : globalThis);
