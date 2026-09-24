"use strict";
/* =====================================================================
   Planifica v3 — VISTA: GASTOS GENERALES
   Conceptos por unidades × precio (viajes, licencias, material…).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function render() {
    const V2 = V(), pr = APP().pr();
    if (!pr) { V2.vaciar("gas-lista"); return; }
    const gastos = N().lista(pr.gastos);
    const conImp = V2.hayImportes();

    const filas = gastos.map(g =>
      '<div class="pa-fila-dato" data-id="' + g.id + '">' +
        '<input class="nz-input pa-crece2" data-campo="gasto-nombre" data-id="' + g.id + '" value="' + N().esc(g.nombre) + '" placeholder="Concepto">' +
        '<label class="pa-mini">Uds <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" data-campo="gasto-unidades" data-id="' + g.id + '" value="' + (N().num(g.unidades) || "") + '"></label>' +
        '<label class="pa-mini">Precio <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" data-campo="gasto-precio" data-id="' + g.id + '" value="' + (N().num(g.precio) || "") + '"></label>' +
        '<strong class="pa-importe pa-celda-importe">' + V2.imp(C().gastoImporte(g)) + "</strong>" +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-gasto" data-id="' + g.id + '" title="Eliminar concepto">✕</button>' +
      "</div>").join("");

    V2.escribir("gas-lista", gastos.length
      ? filas
      : '<p class="pa-mini">Sin gastos generales. Añade conceptos como viajes, licencias o material.</p>');
    V2.texto("gas-total", conImp ? "Gastos: " + V2.imp(C().gastosTotal(pr)) : "");
  }

  PL.vistas.gastos = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
