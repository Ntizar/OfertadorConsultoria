"use strict";
/* =====================================================================
   Planifica v4 — VISTA: INFORME
   El documento que se imprime o se guarda en PDF: cabecera de marca, datos
   de la oferta, entregables con su fecha de entrega y criterio, detalle del
   esfuerzo, gastos, totales, resúmenes y condiciones.
   Sin seguimiento ni facturación.

   Todas las tablas son `--apilable` (objeto de Aurora 7): en el móvil cada fila
   es una tarjeta con el nombre de su columna delante, así que ninguna tabla se
   aplasta ni hay que arrastrar el documento de lado.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /** Tabla del informe. Apilable: en móvil, tarjetas con la etiqueta de cada
      columna; desde 640 px, la tabla de siempre. `cabeceras` admite cadenas o
      `{ texto, num }` para alinear a la derecha. */
  function tabla(cabeceras, filas, pie) {
    const th = (cabeceras || []).map(c => {
      const texto = (typeof c === "string") ? c : c.texto;
      const num = (typeof c === "object") && c.num;
      return "<th" + (num ? ' class="pa-num"' : "") + ">" + texto + "</th>";
    }).join("");
    return '<div class="nz-table-wrap nz-table-wrap--apilable">' +
      '<table class="nz-table nz-table--apilable">' +
      (cabeceras && cabeceras.length ? "<thead><tr>" + th + "</tr></thead>" : "") +
      "<tbody>" + (filas || "") + "</tbody>" + (pie || "") + "</table></div>";
  }

  /** Fila de dos columnas: la primera es la clave (no lleva etiqueta), la segunda el valor. */
  function claveValor(k, v, fuerte) {
    return V().fila([
      { html: (fuerte ? "<strong>" : "") + k + (fuerte ? "</strong>" : ""), clase: "pa-informe__clave" },
      { html: v }
    ]);
  }

  function cabecera(o, marca) {
    const V2 = V();
    return '<div class="pa-informe__cab">' +
      '<div><div style="font-size:1.1rem;font-weight:800">' + N().esc(marca.nombre || "Planifica") + "</div>" +
      '<div class="pa-mini">' + N().esc(marca.sub || "") + "</div></div>" +
      '<div class="pa-mini" style="text-align:right">' + V2.badgeOferta(o) + "<br>" +
      (o.fecha ? "Fecha: " + N().esc(N().fechaLarga(o.fecha)) + "<br>" : "") +
      "Válida hasta " + N().esc(N().fechaLarga(N().fechaDeValidez(o.fecha, o.validezDias))) + "</div></div>";
  }

  function datosOferta(o) {
    const V2 = V();
    const filas =
      claveValor("Oferta", N().esc(o.nombre)) +
      (o.cliente.nombre ? claveValor("Cliente", N().esc(o.cliente.nombre)) : "") +
      (o.cliente.contacto ? claveValor("Contacto", N().esc(o.cliente.contacto)) : "") +
      (o.cliente.ref ? claveValor("Referencia", N().esc(o.cliente.ref)) : "") +
      claveValor("Estado", V2.badgeOferta(o)) +
      claveValor("Calendario", N().esc(P().duracionLegible(o.periodos))) +
      claveValor("Esfuerzo total", N().fmtHoras(C().ofertaHoras(o))) +
      (o.descripcion ? claveValor("Alcance", N().esc(o.descripcion)) : "");
    return "<h2>Datos de la oferta</h2>" + tabla(null, filas);
  }

  /** El calendario dentro del informe: el diagrama completo, con sus barras y sus
      rombos de entrega. Es la vista que el cliente necesita ver de un vistazo.
      Es ancho por naturaleza: aquí sí se desplaza, con la columna del concepto
      pegada a la izquierda para no perder el hilo. */
  function seccionGantt(o, pf) {
    const P2 = PL.periodos, C2 = PL.calculo;
    return "<h2>Calendario y entregas</h2>" +
      '<p class="pa-mini">' + N().esc(P2.duracionLegible(o.periodos)) + " · jornada de " +
      N().fmtNum(C2.jornada(o).horasDia) + " h/día · " +
      Math.round(C2.horasLaborablesTotal(o)).toLocaleString("es-ES") + " h laborables en el periodo · " +
      N().esc(String(C2.ofertaHoras(o)).replace(".", ",")) + " h de esfuerzo comprometido.</p>" +
      PL.gantt.htmlInforme(o, pf) +
      '<p class="pa-mini">Las barras señalan los meses con esfuerzo y el rombo ◆ el mes de entrega de cada entregable.</p>';
  }

  function tablaEntregables(o, pf) {
    const V2 = V();
    const ents = E().todos(o);
    if (!ents.length) return "";
    const filas = ents.map(e => {
      const r = E().responsable(pf, e);
      return V2.fila([
        { html: '<span class="pa-hito-informe">◆</span> ' + N().esc(P().mesCorto(o.periodos, e.periodo)) +
            (e.fecha ? '<br><span class="pa-mini">' + N().esc(N().fechaCorta(e.fecha)) + "</span>" : "") },
        { html: "<strong>" + N().esc(e.nombre) + "</strong>" + (e.descripcion ? '<br><span class="pa-mini">' + N().esc(e.descripcion) + "</span>" : ""),
          etiqueta: "Entregable" },
        { html: e._contexto === "oferta" ? "Oferta" : N().esc(e._tareaNombre), etiqueta: "Origen" },
        { html: r ? N().esc(r.nombre) : "—", clase: "pa-mini", etiqueta: "Responsable" },
        { html: N().esc(e.criterio || "—"), clase: "pa-mini", etiqueta: "Criterio de aceptación" }
      ]);
    }).join("");
    return "<h2>Entregables comprometidos</h2>" +
      tabla(["Entrega", "Entregable", "Origen", "Responsable", "Criterio de aceptación"], filas);
  }

  function tablaDetalle(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const filas = [];
    N().lista(o.tareas).forEach(t => {
      filas.push('<tr><td colspan="5" class="pa-detalle__grupo">' + N().esc(t.nombre) + "</td></tr>");
      N().lista(t.subtareas).forEach(s => {
        filas.push(V2.fila([
          { html: "<strong>" + N().esc(s.nombre) + "</strong>" },
          { html: conImp ? V2.imp(C().subtareaImporte(s, pf)) : "", clase: "pa-num pa-importe", etiqueta: "Importe" },
          { html: N().fmtHoras(C().subtareaHoras(s)), clase: "pa-num", etiqueta: "Horas" },
          null,
          { html: P().duracionLegible(o.periodos).split(" · ")[0], etiqueta: "Periodo" }
        ]));
        N().lista(s.lineas).forEach(l => {
          const p = C().perfilPorId(pf, l.perfilId);
          filas.push(V2.fila([
            { html: N().esc(p ? p.nombre : "(perfil eliminado)"), clase: "pa-mini" },
            { html: conImp ? V2.imp(p ? p.tarifa : 0) : "", clase: "pa-num pa-importe", etiqueta: "Tarifa" },
            { html: conImp ? V2.imp(C().lineaImporte(l, pf)) : "", clase: "pa-num pa-importe", etiqueta: "Importe" },
            { html: N().fmtHoras(C().lineaHoras(l)), clase: "pa-num", etiqueta: "Horas" },
            { html: P().duracionLegible(o.periodos).split(" · ")[0], etiqueta: "Periodo" }
          ]));
        });
      });
    });
    const pie = "";
    return "<h2>Detalle de tareas y esfuerzo</h2>" +
      tabla(["Concepto", { texto: "Importe", num: true }, { texto: "Horas", num: true }, "", "Periodo"],
        filas.join("") || '<tr><td colspan="5">Sin contenido.</td></tr>', pie);
  }

  function tablaGastos(o) {
    const V2 = V();
    const gastos = N().lista(o.gastos);
    if (!gastos.length) return "";
    const conImp = V2.verImportes();
    const filas = gastos.map(g => V2.fila([
      { html: N().esc(g.nombre) },
      { html: N().fmtNum(g.unidades), clase: "pa-num", etiqueta: "Unidades" },
      { html: conImp ? V2.imp(g.precio) : "", clase: "pa-num pa-importe", etiqueta: "Precio" },
      { html: conImp ? V2.imp(C().gastoImporte(g)) : "", clase: "pa-num pa-importe", etiqueta: "Importe" }
    ])).join("");
    return "<h2>Gastos generales</h2>" +
      tabla(["Concepto", { texto: "Unidades", num: true }, { texto: "Precio", num: true }, { texto: "Importe", num: true }], filas);
  }

  function tablaTotales(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const d = o.descuento || {}, t = o.impuestos || {};
    const linea = (texto_, valor, fuerte) => V2.fila([
      { html: (fuerte ? "<strong>" : "") + texto_ + (fuerte ? "</strong>" : "") },
      { html: (fuerte ? "<strong>" : "") + (conImp ? V2.imp(valor) : "") + (fuerte ? "</strong>" : ""), clase: "pa-num pa-importe" }
    ]);
    const filas = linea("Consultoría", C().importeOferta(o, pf)) +
      (C().gastosTotal(o) ? linea("Gastos generales", C().gastosTotal(o)) : "") +
      linea("Subtotal", C().subtotalOferta(o, pf), true) +
      (d.tipo ? linea("Descuento (" + (d.tipo === "%" ? N().fmtNum(d.valor) + " %" : "importe fijo") + ")", -C().descuentoImporte(o, pf)) : "") +
      linea("Base imponible", C().baseImponible(o, pf)) +
      (C().nombreImpuesto(o) ? linea(C().nombreImpuesto(o) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " (incluido en los precios)" : ""), C().impuestoImporte(o, pf)) : "");
    const pie = "<tfoot><tr><td><strong>TOTAL</strong></td><td class=\"pa-num pa-importe\"><strong>" +
      (conImp ? V2.imp(C().totalOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    return "<h2>Totales</h2>" + tabla(null, filas, pie) +
      (o.condicionesPago ? "<p><strong>Condiciones de pago:</strong> " + N().esc(o.condicionesPago) + "</p>" : "");
  }

  function tablaPerfiles(o, pf) {
    const V2 = V();
    const horas = C().horasPorPerfil(o);
    const conImp = V2.verImportes();
    const filas = N().lista(pf).filter(p => N().num(horas[p.id]) > 0).map(p => V2.fila([
      { html: N().esc(p.nombre) + ' <span class="pa-mini">(' + N().esc(p.categoria) + ")</span>" },
      { html: N().fmtHoras(horas[p.id]), clase: "pa-num", etiqueta: "Horas" },
      { html: conImp ? V2.imp(C().importePerfil(o, pf, p.id)) : "", clase: "pa-num pa-importe", etiqueta: "Importe" }
    ])).join("");
    return "<h2>Resumen por perfil</h2>" +
      tabla(["Perfil", { texto: "Horas", num: true }, { texto: "Importe", num: true }],
        filas || '<tr><td colspan="3">—</td></tr>');
  }

  function tablaPeriodos(o, pf) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const conImp = V2.verImportes();
    const filas = cols.map(c => V2.fila([
      { html: N().esc(c.etiqueta) + " " + c.anio },
      { html: c.periodos.reduce((s, i) => s + C().horasPeriodo(o, i), 0).toLocaleString("es-ES"), clase: "pa-num", etiqueta: "Horas" },
      { html: c.periodos.reduce((s, i) => s + E().dePeriodo(o, i).length, 0) || "·", clase: "pa-num", etiqueta: "Entregables" },
      { html: conImp ? V2.imp(c.periodos.reduce((s, i) => s + C().importePeriodo(o, pf, i), 0)) : "", clase: "pa-num pa-importe", etiqueta: "Importe" }
    ])).join("");
    const pie = '<tfoot><tr><td><strong>Total</strong></td><td class="pa-num"><strong>' + C().ofertaHoras(o).toLocaleString("es-ES") +
      '</strong></td><td class="pa-num"><strong>' + E().porContexto(o).total + '</strong></td><td class="pa-num pa-importe"><strong>' +
      (conImp ? V2.imp(C().importeOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    return "<h2>Esfuerzo y entregas por periodo</h2>" +
      tabla(["Periodo", { texto: "Horas", num: true }, { texto: "Entregables", num: true }, { texto: "Importe", num: true }], filas, pie);
  }

  function tablaAnualidades(o, pf) {
    const V2 = V();
    const an = C().anualidades(o, pf);
    const claves = Object.keys(an);
    if (claves.length < 2) return "";
    const conImp = V2.verImportes();
    const filas = claves.map(y => V2.fila([
      { html: y },
      { html: conImp ? V2.imp(an[y]) : "", clase: "pa-num pa-importe", etiqueta: "Importe" }
    ])).join("");
    const pie = '<tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num pa-importe"><strong>' +
      (conImp ? V2.imp(N().r2(N().suma(claves, y => an[y]))) : "") + "</strong></td></tr></tfoot>";
    return "<h2>Anualidades</h2>" +
      tabla(["Año", { texto: "Importe", num: true }], filas, pie);
  }

  function render() {
    const V2 = V(), APP2 = APP();
    const o = APP2.pr();
    const cont = "informe-cuerpo";
    if (!o) { V2.escribir(cont, ""); return; }
    const marca = APP2.ESTADO.marca || {};
    const pf = APP2.pf();
    const logo = marca.logo ? '<div style="margin-bottom:var(--nz-space-2)"><img class="pa-logo" style="height:44px;max-width:220px" src="' + marca.logo + '" alt=""></div>' : "";

    V2.escribir(cont,
      cabecera(o, marca) + logo +
      "<h1>" + N().esc(o.nombre) + "</h1>" +
      datosOferta(o) +
      seccionGantt(o, pf) +
      tablaEntregables(o, pf) +
      tablaDetalle(o, pf) +
      tablaGastos(o) +
      tablaTotales(o, pf) +
      tablaPerfiles(o, pf) +
      tablaPeriodos(o, pf) +
      tablaAnualidades(o, pf) +
      '<div class="pa-informe__pie"><span>Generado con ' + N().esc(marca.nombre || "Planifica") + "</span><span>" + N().fechaLarga(N().hoyISO()) + "</span></div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Hecho con ❤️ por David Antizar</p>');
  }

  PL.vistas.informe = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
