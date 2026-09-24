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
    const DIAS = [[1, "lunes"], [2, "martes"], [3, "miércoles"], [4, "jueves"], [5, "viernes"], [6, "sábado"], [7, "domingo"]];
    const festivos = N().lista(j.festivos);

    /* Un día: casilla de laborable y sus horas. El viernes puede ser más corto. */
    const filasDias = DIAS.map(d => {
      const dia = d[0];
      const laborable = j.diasSemana.indexOf(dia) >= 0;
      const horas = N().num((j.horasPorDia || {})[dia]);
      return "<tr>" +
        '<td><label class="pa-ahora"><input type="checkbox" data-campo="jornada-dia" data-dia="' + dia + '"' +
          (laborable ? " checked" : "") + "> " + d[1] + "</label></td>" +
        '<td class="nz-table__right">' + (laborable
          ? '<input class="nz-input nz-input--sm pa-input-num" type="number" min="0" max="24" step="0.5" ' +
            'data-campo="jornada-horas-dia" data-dia="' + dia + '" value="' + N().fmtNum(horas) + '" aria-label="Horas del ' + d[1] + '"> h'
          : '<span class="pa-mini">no se trabaja</span>') + "</td></tr>";
    }).join("");

    const hFestivo = f => {
      const partes = f.fecha.split("-");
      return N().fechaCorta(new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2])));
    };

    const listaFestivos = festivos.length
      ? '<table class="nz-table nz-table--compact"><thead><tr><th>Día</th><th>Festivo</th><th></th><th></th></tr></thead><tbody>' +
        festivos.map(f => "<tr><td>" + N().esc(hFestivo(f)) + "</td><td>" + N().esc(f.nombre) +
          '</td><td><span class="nz-badge nz-badge--neutral">' + N().esc(f.ambito || "Propio") + "</span></td>" +
          '<td><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="quitar-festivo" data-id="' + N().esc(f.fecha) +
          '" title="Quitar este festivo">✕</button></td></tr>').join("") +
        "</tbody></table>"
      : '<p class="pa-mini">No hay festivos: todos los días de diario cuentan como laborables.</p>';

    return V2.articulo("Jornada y festivos",
      '<p class="pa-mini">Marca los días que se trabaja y <strong>cuántas horas cada uno</strong> (si el viernes es más corto, ' +
      "se pone aquí). Los festivos no cuentan como laborables, así que bajan las horas del mes y suben el % de dedicación " +
      "de lo mismo: con esto la dedicación se calcula sobre días reales de trabajo.</p>" +
      '<div class="pa-jornada">' +
        '<div>' +
          '<table class="nz-table nz-table--compact"><thead><tr><th>Día</th><th class="nz-table__right">Horas</th></tr></thead>' +
          "<tbody>" + filasDias + "</tbody></table>" +
          '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Horas al día por omisión: ' +
            '<input class="nz-input nz-input--sm pa-input-num" type="number" min="0.5" max="24" step="0.5" ' +
            'data-campo="jornada-horas" value="' + N().fmtNum(j.horasDia) + '" aria-label="Horas al día por omisión"> ' +
            "(al cambiarlo se aplica a todos los días).</p>" +
        "</div>" +
        '<div>' +
          '<div class="pa-fila">' +
            '<strong class="pa-mini">Festivos del calendario</strong>' +
            '<input class="nz-input nz-input--sm" type="date" data-campo="festivo-fecha" aria-label="Fecha del festivo">' +
            '<input class="nz-input nz-input--sm pa-ancho-medio" type="text" data-campo="festivo-nombre" ' +
              'placeholder="Nombre (opcional)" aria-label="Nombre del festivo">' +
            '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-festivo">＋ Añadir</button>' +
            '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="festivos-espana" ' +
              'title="Carga los festivos de España, la Comunidad de Madrid y Madrid capital de los años del calendario">' +
              "Cargar los de España y Madrid</button>" +
          "</div>" +
          '<div class="pa-tabla-horas">' + listaFestivos + "</div>" +
          '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Van precargados los de España y Madrid, pero ' +
          "<strong>son editables</strong>: los locales cambian cada año y cada empresa tiene los suyos.</p>" +
        "</div>" +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Con esta jornada el calendario tiene <strong>' +
        N().fmtNum(C().horasLaborablesTotal(o), 0) + " h laborables</strong>, y eso es lo que significa una dedicación " +
        "del 50 % o del 100 % de cada periodo.</p>");
  }

  PL.vistas.oferta = { render: render, bloqueJornada: bloqueJornada };
})(typeof window !== "undefined" ? window : globalThis);
