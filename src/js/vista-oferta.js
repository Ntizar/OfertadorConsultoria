"use strict";
/* =====================================================================
   Planifica v4 — VISTA: OFERTA
   Los datos comerciales de la oferta (cliente, referencia, estado, fechas,
   alcance, condiciones, impuestos y descuento), los gastos generales y el
   cuadro de economía.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function datos(o) {
    const V2 = V();
    const t = o.impuestos || {}, d = o.descuento || {};
    const campos =
      '<div class="nz-formgrid nz-formgrid--2">' +
        campo("Cliente", '<input class="nz-input" data-campo="oferta-cliente-nombre" value="' + N().esc(o.cliente.nombre) + '" placeholder="Nombre del cliente">') +
        campo("Persona de contacto", '<input class="nz-input" data-campo="oferta-cliente-contacto" value="' + N().esc(o.cliente.contacto) + '" placeholder="Nombre · email · teléfono">') +
        campo("Referencia / expediente", '<input class="nz-input" data-campo="oferta-cliente-ref" value="' + N().esc(o.cliente.ref) + '">') +
        campo("Estado de la oferta",
          '<select class="nz-input" data-campo="oferta-estado">' +
          Object.keys(M().ESTADOS_OFERTA).map(k => '<option value="' + k + '"' + (o.estado === k ? " selected" : "") + ">" + M().ESTADOS_OFERTA[k].texto + "</option>").join("") +
          "</select>") +
        campo("Fecha de la oferta", '<input class="nz-input pa-input-fecha" type="date" data-campo="oferta-fecha" value="' + N().esc(o.fecha) + '">') +
        campo("Validez (días)", '<input class="nz-input pa-input-num" type="number" min="0" data-campo="oferta-validez" value="' + (N().num(o.validezDias) || 30) + '">') +
        campo("Válida hasta", '<span class="pa-mini pa-ahora">' + N().esc(N().fechaLarga(N().fechaDeValidez(o.fecha, o.validezDias)) || "—") + "</span>") +
        campo("Calendario", '<span class="pa-mini pa-ahora">' + N().esc(P().duracionLegible(o.periodos)) + "</span>") +
        campo("Alcance / descripción", '<textarea class="nz-input" rows="3" data-campo="oferta-desc" placeholder="Qué incluye la oferta">' + N().esc(o.descripcion) + "</textarea>", true) +
        campo("Condiciones de pago", '<input class="nz-input" data-campo="oferta-pago" value="' + N().esc(o.condicionesPago) + '" placeholder="Ej.: 50 % a la firma y 50 % a la entrega">', true) +
      "</div>";

    const impuestos =
      '<div class="nz-formgrid nz-formgrid--2" style="margin-top:var(--nz-space-3)">' +
        campo("Impuesto",
          '<select class="nz-input" data-campo="oferta-impuesto-tipo">' +
            '<option value="iva"' + (t.tipo === "iva" ? " selected" : "") + ">IVA (se añade)</option>" +
            '<option value="irpf"' + (t.tipo === "irpf" ? " selected" : "") + ">IRPF (retención)</option>" +
            '<option value="ninguno"' + (!t.tipo || t.tipo === "ninguno" ? " selected" : "") + ">Sin impuestos</option>" +
          "</select>") +
        campo("Tipo %", '<input class="nz-input pa-input-num" type="number" min="0" max="100" step="0.5" data-campo="oferta-impuesto-tasa" value="' + N().num(t.tasa) + '">') +
        campo("Descuento",
          '<select class="nz-input" data-campo="oferta-descuento-tipo">' +
            '<option value=""' + (!d.tipo ? " selected" : "") + ">Sin descuento</option>" +
            '<option value="%"' + (d.tipo === "%" ? " selected" : "") + ">Porcentaje</option>" +
            '<option value="fijo"' + (d.tipo === "fijo" ? " selected" : "") + ">Importe fijo</option>" +
          "</select>") +
        campo("Valor del descuento", '<input class="nz-input pa-input-num" type="number" min="0" step="0.01" data-campo="oferta-descuento-valor" value="' + (N().num(d.valor) || "") + '">') +
      "</div>" +
      '<label class="nz-switch" style="margin-top:var(--nz-space-2)"><input type="checkbox" data-campo="oferta-impuesto-incluido"' + (t.incluido ? " checked" : "") + '>' +
      '<span class="nz-switch__track"><span class="nz-switch__thumb"></span></span>' +
      '<span class="nz-switch__label">El impuesto ya está incluido en los precios</span></label>';

    return V2.articulo("Datos de la oferta", campos + impuestos);
  }

  function campo(etiqueta, control, ancho) {
    return '<label class="nz-field' + (ancho ? " pa-ancho" : "") + '"><span class="nz-field__label">' + etiqueta + "</span>" + control + "</label>";
  }

  function gastos(o) {
    const V2 = V();
    const lista = N().lista(o.gastos);
    const filas = lista.map(g =>
      '<div class="pa-dato" data-id="' + g.id + '">' +
        '<input class="nz-input pa-crece2" data-campo="gasto-nombre" data-id="' + g.id + '" value="' + N().esc(g.nombre) + '" placeholder="Concepto (viaje, licencia, material…)">' +
        '<label class="pa-mini pa-ahora">uds <input class="nz-input nz-input--sm pa-input-num" type="number" min="0" step="0.01" data-campo="gasto-unidades" data-id="' + g.id + '" value="' + (N().num(g.unidades) || "") + '"></label>' +
        '<label class="pa-mini pa-ahora">precio <input class="nz-input nz-input--sm pa-input-num" type="number" min="0" step="0.01" data-campo="gasto-precio" data-id="' + g.id + '" value="' + (N().num(g.precio) || "") + '"></label>' +
        '<strong class="pa-importe pa-celda-importe">' + V2.imp(C().gastoImporte(g)) + "</strong>" +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-gasto" data-id="' + g.id + '" title="Eliminar concepto">✕</button>' +
      "</div>").join("");

    return V2.articulo("Gastos generales",
      '<div class="pa-fila" style="margin-bottom:var(--nz-space-2)">' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-gasto">＋ Concepto</button>' +
        '<span class="pa-espacio"></span>' +
        '<strong id="gas-total">' + (V2.verImportes() ? "Total: " + V2.imp(C().gastosTotal(o)) : "") + "</strong>" +
      "</div>" +
      (filas || '<p class="pa-mini">Sin gastos generales. Añade conceptos como viajes, licencias o material.</p>'));
  }

  function economia(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const d = o.descuento || {};
    const t = o.impuestos || {};
    const linea = (texto_, valor, fuerte) => V2.fila([
      { html: (fuerte ? "<strong>" : "") + texto_ + (fuerte ? "</strong>" : "") },
      { html: (fuerte ? "<strong>" : "") + (conImp ? V2.imp(valor) : "") + (fuerte ? "</strong>" : ""), clase: "nz-table__right pa-importe" }
    ]);
    const filas = linea("Consultoría (horas × tarifas)", C().importeOferta(o, pf)) +
      (C().gastosTotal(o) ? linea("Gastos generales", C().gastosTotal(o)) : "") +
      linea("Subtotal", C().subtotalOferta(o, pf), true) +
      (d.tipo ? linea("Descuento (" + (d.tipo === "%" ? N().fmtNum(d.valor) + " %" : "importe fijo") + ")", -C().descuentoImporte(o, pf)) : "") +
      linea("Base imponible", C().baseImponible(o, pf)) +
      linea(C().nombreImpuesto(o) ? C().nombreImpuesto(o) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " (incluido)" : "") : "Sin impuestos", C().impuestoImporte(o, pf));
    const pie = '<tfoot><tr><td><strong>TOTAL</strong></td><td class="nz-table__right pa-importe"><strong>' +
      (conImp ? V2.imp(C().totalOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    const media = V2.fila([{ html: "Media mensual" }, { html: conImp ? V2.imp(C().mediaPeriodo(o, pf)) : "", clase: "nz-table__right pa-importe" }]);
    return V2.articulo("Economía de la oferta", V2.tabla(["", ""], filas, pie + "<tfoot>" + media + "</tfoot>"));
  }

  function render() {
    const V2 = V(), o = APP().pr(), pf = APP().pf();
    if (!o) { ["ofe-datos", "ofe-gastos", "ofe-economia"].forEach(id => V2.vaciar(id)); return; }
    V2.escribir("ofe-datos", datos(o) + bloqueJornada(o));
    V2.escribir("ofe-gastos", gastos(o));
    V2.escribir("ofe-economia", economia(o, pf));
  }

  /** Jornada: es lo que convierte dedicación (%) en horas. Va con la oferta para
      que el cálculo viaje con ella. */
  function bloqueJornada(o) {
    const V2 = V();
    const j = C().jornada(o);
    const DIAS = [[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [7, "D"]];
    return V2.articulo("Jornada de trabajo",
      '<div class="pa-fila">' +
        '<label class="pa-mini pa-ahora">Horas por día ' +
          '<input class="nz-input nz-input--sm pa-input-num" type="number" min="0.5" max="24" step="0.5" ' +
          'data-campo="jornada-horas" value="' + N().fmtNum(j.horasDia) + '"></label>' +
        '<span class="pa-mini">Días que se trabaja</span>' +
        DIAS.map(d => '<label class="pa-mini pa-ahora"><input type="checkbox" data-campo="jornada-dia" data-dia="' + d[0] + '"' +
          (j.diasSemana.indexOf(d[0]) >= 0 ? " checked" : "") + "> " + d[1] + "</label>").join("") +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Con esto se calculan las horas laborables de cada mes (' +
        Math.round(C().horasLaborablesTotal(o)).toLocaleString("es-ES") + " h en el calendario actual) y, por tanto, " +
        "lo que significa una dedicación del 50 % o del 100 %.</p>");
  }

  PL.vistas.oferta = { render: render, bloqueJornada: bloqueJornada };
})(typeof window !== "undefined" ? window : globalThis);
