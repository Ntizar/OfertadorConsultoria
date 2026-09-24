"use strict";
/* =====================================================================
   Planifica v4 — VISTA: INFORME
   El documento que se imprime o se guarda en PDF: cabecera de marca, datos
   de la oferta, entregables con su fecha de entrega y criterio, detalle del
   esfuerzo, gastos, totales, resúmenes y condiciones.
   Sin seguimiento ni facturación.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

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
    const linea = (k, v) => '<tr><td style="width:11rem"><strong>' + k + "</strong></td><td>" + v + "</td></tr>";
    return "<h2>Datos de la oferta</h2><table><tbody>" +
      linea("Oferta", N().esc(o.nombre)) +
      (o.cliente.nombre ? linea("Cliente", N().esc(o.cliente.nombre)) : "") +
      (o.cliente.contacto ? linea("Contacto", N().esc(o.cliente.contacto)) : "") +
      (o.cliente.ref ? linea("Referencia", N().esc(o.cliente.ref)) : "") +
      linea("Estado", V2.badgeOferta(o)) +
      linea("Calendario", N().esc(P().duracionLegible(o.periodos))) +
      linea("Esfuerzo total", N().fmtHoras(C().ofertaHoras(o))) +
      (o.descripcion ? linea("Alcance", N().esc(o.descripcion)) : "") +
      "</tbody></table>";
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
        { html: "<strong>" + N().esc(e.nombre) + "</strong>" + (e.descripcion ? '<br><span class="pa-mini">' + N().esc(e.descripcion) + "</span>" : "") },
        { html: e._contexto === "oferta" ? "Oferta" : N().esc(e._tareaNombre) },
        { html: r ? N().esc(r.nombre) : "—", clase: "pa-mini" },
        { html: N().esc(e.criterio || "—"), clase: "pa-mini" }
      ]);
    }).join("");
    return "<h2>Entregables comprometidos</h2><table><thead><tr><th>Entrega</th><th>Entregable</th><th>Origen</th><th>Responsable</th><th>Criterio de aceptación</th></tr></thead>" +
      "<tbody>" + filas + "</tbody></table>";
  }

  function tablaDetalle(o, pf) {
    const V2 = V();
    const conImp = V2.verImportes();
    const filas = [];
    N().lista(o.tareas).forEach(t => {
      filas.push('<tr><td colspan="5" style="background:var(--nz-surface-2,var(--nz-surface));font-weight:800">' + N().esc(t.nombre) + "</td></tr>");
      N().lista(t.subtareas).forEach(s => {
        filas.push('<tr><td style="padding-left:18px">' + N().esc(s.nombre) + '</td><td class="pa-num pa-importe">' +
          (conImp ? V2.imp(C().subtareaImporte(s, pf)) : "") + '</td><td class="pa-num">' + N().fmtHoras(C().subtareaHoras(s)) +
          '</td><td class="pa-num"></td><td></td></tr>');
        N().lista(s.lineas).forEach(l => {
          const p = C().perfilPorId(pf, l.perfilId);
          filas.push('<tr><td style="padding-left:36px;color:var(--nz-text-soft)">' + N().esc(p ? p.nombre : "(perfil eliminado)") + "</td>" +
            '<td class="pa-num pa-importe">' + (conImp ? V2.imp(p ? p.tarifa : 0) : "") + "</td>" +
            '<td class="pa-num pa-importe">' + (conImp ? V2.imp(C().lineaImporte(l, pf)) : "") + "</td>" +
            '<td class="pa-num">' + N().fmtHoras(C().lineaHoras(l)) + "</td>" +
            "<td>" + P().duracionLegible(o.periodos).split(" · ")[0] + "</td></tr>");
        });
      });
    });
    return "<h2>Detalle de tareas y esfuerzo</h2><table><thead><tr><th>Concepto</th><th class=\"pa-num\">Importe</th><th class=\"pa-num\">Horas</th><th class=\"pa-num\"></th><th>Periodo</th></tr></thead><tbody>" +
      (filas.join("") || '<tr><td colspan="5">Sin contenido.</td></tr>') + "</tbody></table>";
  }

  function tablaGastos(o) {
    const V2 = V();
    const gastos = N().lista(o.gastos);
    if (!gastos.length) return "";
    const conImp = V2.verImportes();
    return "<h2>Gastos generales</h2><table><thead><tr><th>Concepto</th><th class=\"pa-num\">Unidades</th><th class=\"pa-num\">Precio</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      gastos.map(g => V2.fila([
        { html: N().esc(g.nombre) },
        { html: N().fmtNum(g.unidades), clase: "pa-num" },
        { html: conImp ? V2.imp(g.precio) : "", clase: "pa-num pa-importe" },
        { html: conImp ? V2.imp(C().gastoImporte(g)) : "", clase: "pa-num pa-importe" }
      ])).join("") + "</tbody></table>";
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
    const pie = '<tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num pa-importe"><strong>' +
      (conImp ? V2.imp(C().totalOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    return "<h2>Totales</h2><table><tbody>" + filas + "</tbody>" + pie + "</table>" +
      (o.condicionesPago ? "<p><strong>Condiciones de pago:</strong> " + N().esc(o.condicionesPago) + "</p>" : "");
  }

  function tablaPerfiles(o, pf) {
    const V2 = V();
    const horas = C().horasPorPerfil(o);
    const conImp = V2.verImportes();
    const filas = N().lista(pf).filter(p => N().num(horas[p.id]) > 0).map(p => V2.fila([
      { html: N().esc(p.nombre) + ' <span class="pa-mini">(' + N().esc(p.categoria) + ")</span>" },
      { html: N().fmtHoras(horas[p.id]), clase: "pa-num" },
      { html: conImp ? V2.imp(C().importePerfil(o, pf, p.id)) : "", clase: "pa-num pa-importe" }
    ]));
    return "<h2>Resumen por perfil</h2><table><thead><tr><th>Perfil</th><th class=\"pa-num\">Horas</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      (filas.join("") || '<tr><td colspan="3">—</td></tr>') + "</tbody></table>";
  }

  function tablaPeriodos(o, pf) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const conImp = V2.verImportes();
    const filas = cols.map(c => V2.fila([
      { html: N().esc(c.etiqueta) + " " + c.anio },
      { html: c.periodos.reduce((s, i) => s + C().horasPeriodo(o, i), 0).toLocaleString("es-ES"), clase: "pa-num" },
      { html: c.periodos.reduce((s, i) => s + E().dePeriodo(o, i).length, 0) || "·", clase: "pa-num" },
      { html: conImp ? V2.imp(c.periodos.reduce((s, i) => s + C().importePeriodo(o, pf, i), 0)) : "", clase: "pa-num pa-importe" }
    ])).join("");
    const pie = '<tfoot><tr><td><strong>Total</strong></td><td class="pa-num"><strong>' + C().ofertaHoras(o).toLocaleString("es-ES") +
      '</strong></td><td class="pa-num"><strong>' + E().porContexto(o).total + '</strong></td><td class="pa-num pa-importe"><strong>' +
      (conImp ? V2.imp(C().importeOferta(o, pf)) : "") + "</strong></td></tr></tfoot>";
    return "<h2>Esfuerzo y entregas por periodo</h2><table><thead><tr><th>Periodo</th><th class=\"pa-num\">Horas</th><th class=\"pa-num\">Entregables</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      filas + "</tbody>" + pie + "</table>";
  }

  function tablaAnualidades(o, pf) {
    const V2 = V();
    const an = C().anualidades(o, pf);
    const claves = Object.keys(an);
    if (claves.length < 2) return "";
    const conImp = V2.verImportes();
    return "<h2>Anualidades</h2><table><thead><tr><th>Año</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      claves.map(y => V2.fila([{ html: y }, { html: conImp ? V2.imp(an[y]) : "", clase: "pa-num pa-importe" }])).join("") +
      '</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num pa-importe"><strong>' +
      (conImp ? V2.imp(N().r2(N().suma(claves, y => an[y]))) : "") + "</strong></td></tr></tfoot></table>";
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
