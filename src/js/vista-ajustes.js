"use strict";
/* =====================================================================
   Planifica v4 — VISTA: AJUSTES
   Marca blanca, biblioteca de perfiles, plantillas y datos (copias,
   importación y datos heredados de versiones anteriores).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const A = () => PL.almacen;
  const APP = () => PL.app;

  function marca(a) {
    const V2 = V();
    const m = a.ESTADO.marca;
    return V2.articulo("Marca",
      '<div class="nz-formgrid nz-formgrid--2">' +
        '<label class="nz-field"><span class="nz-field__label">Nombre de la marca</span><input class="nz-input" id="aj-marca" value="' + N().esc(m.nombre) + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Lema / subtítulo</span><input class="nz-input" id="aj-sub" value="' + N().esc(m.sub) + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Moneda</span><input class="nz-input pa-input-corto" id="aj-moneda" value="' + N().esc(m.moneda) + '" maxlength="4"></label>' +
        '<div class="nz-field"><span class="nz-field__label">Logo</span>' +
          '<span class="pa-fila"><button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="cargar-logo">🖼 Cargar logo</button>' +
          (m.logo ? '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="quitar-logo">Quitar</button>' : "") + "</span>" +
          '<span class="nz-field__help">Se guarda dentro de tus datos: no se sube a ningún sitio.</span></div>' +
      "</div>" +
      '<label class="nz-switch" style="margin-top:var(--nz-space-2)"><input type="checkbox" id="aj-importes"' + (a.ESTADO.mostrarImportes ? " checked" : "") + '>' +
      '<span class="nz-switch__track"><span class="nz-switch__thumb"></span></span>' +
      '<span class="nz-switch__label">Mostrar los importes (€)</span></label>');
  }

  function datos(a) {
    const V2 = V();
    const heredados = A().datosHeredados();
    const o = a.pr();
    const imp = a.ESTADO.importadoAuto;
    return V2.articulo("Datos y copias",
      '<div class="pa-fila">' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-json-oferta">⬇ Guardar esta oferta</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-perfiles">⬇ Guardar mis perfiles</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-json-todo">⬇ Copia completa</button>' +
      "</div>" +
      '<div class="pa-fila" style="margin-top:var(--nz-space-2)">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="imp-json">⬆ Cargar un fichero…</button>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="exp-csv">⬇ Excel (CSV)</button>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="imprimir">🖨 Informe en PDF</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Al cargar un fichero, la aplicación reconoce sola si es una oferta, tu catálogo de perfiles o una copia completa. ' +
      "Todo se guarda en este navegador y no sale de tu equipo.</p>" +
      (imp
        ? '<p class="pa-mini" style="margin-top:var(--nz-space-2)">✓ Tus ofertas anteriores se importaron solas el ' + N().fechaCorta(imp.fecha) + " (" + imp.ofertas + " oferta(s)).</p>"
        : "") +
      (heredados.length
        ? '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Queda una copia de tus datos anteriores en este navegador. ' +
          (imp ? "" : '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="traer-heredados">Importarla</button> ') +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="descargar-heredados">Descargarla</button> ' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="limpiar-heredados">Olvidarla</button></p>'
        : "") +
      '<div class="pa-fila" style="margin-top:var(--nz-space-3)">' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-ejemplo">Volver al ejemplo de inicio</button>' +
        '<button class="nz-btn nz-btn--danger nz-btn--sm" data-acc="borrar-todo">Borrar todos los datos</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-3)">Esta oferta: ' + N().esc(PL.periodos.duracionLegible(o.periodos)) +
      " · " + PL.entregables.porContexto(o).total + " entregable(s) · " + N().lista(o.fotos).length + " foto(s) guardada(s).</p>");
  }

  function render() {
    const V2 = V(), a = APP();
    if (!a.pr()) { V2.vaciar("ajustes-cuerpo"); return; }
    V2.escribir("ajustes-cuerpo", marca(a) + datos(a));
  }

  PL.vistas.ajustes = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
