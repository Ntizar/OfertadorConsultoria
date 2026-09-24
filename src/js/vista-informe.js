"use strict";
/* =====================================================================
   Planifica v3 — VISTA: INFORME
   El documento que se imprime o se guarda en PDF: cabecera de marca,
   alcance, entregables con fecha y criterio, detalle de esfuerzo, plan de
   facturación, totales, condiciones y resúmenes.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function celdaValor(html, conImp) {
    return { html: html, clase: "pa-num" + (conImp ? "" : " pa-importe") };
  }

  function cabecera(pr, marca) {
    const V2 = V();
    return '<div class="pa-informe__cab">' +
      '<div><div style="font-size:1.1rem;font-weight:800">' + N().esc(marca.nombre || "Planifica") + "</div>" +
      '<div class="pa-mini">' + N().esc(marca.sub || "") + "</div></div>" +
      '<div class="pa-mini" style="text-align:right">' + V2.badgeOferta(pr) + "<br>" +
      (pr.fecha ? "Fecha: " + N().esc(pr.fecha) + "<br>" : "") + "Válido hasta " + N().fechaValidez(pr) + "</div></div>";
  }

  function alcance(pr) {
    const V2 = V();
    const linea = (k, v) => '<tr><td style="width:11rem"><strong>' + k + "</strong></td><td>" + v + "</td></tr>";
    return "<h2>Datos de la oferta</h2><table><tbody>" +
      linea("Oferta", N().esc(pr.nombre)) +
      (pr.cliente && pr.cliente.nombre ? linea("Cliente", N().esc(pr.cliente.nombre)) : "") +
      (pr.cliente && pr.cliente.contacto ? linea("Contacto", N().esc(pr.cliente.contacto)) : "") +
      (pr.cliente && pr.cliente.ref ? linea("Referencia", N().esc(pr.cliente.ref)) : "") +
      linea("Estado", V2.badgeOferta(pr)) +
      linea("Duración", C().mesesProyecto(pr) + " meses desde " + N().etiquetaMes(pr.fechaInicio, 0)) +
      linea("Esfuerzo total", N().fmtHoras(C().horasProyecto(pr))) +
      (pr.descripcion ? linea("Alcance", N().esc(pr.descripcion)) : "") +
      "</tbody></table>";
  }

  function tablaEntregables(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const plan = E().planFacturacion(pr, pf);
    if (!plan.length) return "";
    const filas = plan.map(h => V2.fila([
      { html: N().esc(h.mesEtiqueta) + (h.fecha ? '<br><span class="pa-mini">' + N().esc(h.fecha) + "</span>" : "") },
      { html: "<strong>" + N().esc(h.nombre) + "</strong>" + (h.descripcion ? '<br><span class="pa-mini">' + N().esc(h.descripcion) + "</span>" : "") },
      { html: h.contexto === "oferta" ? "Oferta" : N().esc(h.tareaNombre) },
      { html: V2.badgeHito(h.estado) },
      { html: N().esc(h.criterio || "—"), clase: "pa-mini" },
      { html: N().fmtPct(h.pct), clase: "pa-num" },
      celdaValor(imp ? V2.imp(h.importe) : "", imp)
    ]));
    return "<h2>Entregables comprometidos</h2><table><thead><tr><th>Entrega</th><th>Entregable</th><th>Origen</th><th>Estado</th><th>Criterio de aceptación</th><th class=\"pa-num\">%</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      filas.join("") + "</tbody></table>";
  }

  function tablaDetalle(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const filas = [];
    N().lista(pr.tareas).forEach(t => {
      filas.push(V2.fila([{ html: "<strong>" + N().esc(t.nombre) + "</strong>", clase: "" }], ""));
      N().lista(t.subtareas).forEach(s => {
        filas.push('<tr><td style="padding-left:18px">' + N().esc(s.nombre) + '</td><td class="pa-num"></td><td class="pa-num pa-importe">' + (imp ? V2.imp(C().subImporte(s, pf)) : "") + '</td><td class="pa-num">' + N().fmtHoras(C().subHoras(s)) + "</td><td></td></tr>");
        N().lista(s.lineas).forEach(l => {
          const p = C().perfilPorId(pf, l.perfilId);
          filas.push('<tr><td style="padding-left:36px;color:var(--nz-text-soft)">' + N().esc(p ? p.nombre : "(perfil eliminado)") + "</td>" +
            '<td class="pa-num pa-importe">' + (imp ? V2.imp(p ? p.tarifa : 0) : "") + "</td>" +
            '<td class="pa-num pa-importe">' + (imp ? V2.imp(C().lineaImporte(l, pf)) : "") + "</td>" +
            '<td class="pa-num">' + N().fmtHoras(C().lineaHoras(l)) + "</td>" +
            "<td>" + C().mesesProyecto(pr) + " meses</td></tr>");
        });
      });
    });
    return "<h2>Detalle de tareas y esfuerzo</h2><table><thead><tr><th>Concepto</th><th class=\"pa-num\">Tarifa</th><th class=\"pa-num\">Importe</th><th class=\"pa-num\">Horas</th><th>Periodo</th></tr></thead><tbody>" +
      (filas.join("") || '<tr><td colspan="5">Sin contenido.</td></tr>') + "</tbody></table>";
  }

  function tablaGastos(pr) {
    const V2 = V();
    const gastos = N().lista(pr.gastos);
    if (!gastos.length) return "";
    const imp = V2.hayImportes();
    return "<h2>Gastos generales</h2><table><thead><tr><th>Concepto</th><th class=\"pa-num\">Unidades</th><th class=\"pa-num\">Precio</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      gastos.map(g => V2.fila([
        { html: N().esc(g.nombre) },
        { html: N().fmtNum(g.unidades), clase: "pa-num" },
        celdaValor(imp ? V2.imp(g.precio) : "", imp),
        celdaValor(imp ? V2.imp(C().gastoImporte(g)) : "", imp)
      ])).join("") + "</tbody></table>";
  }

  function tablaFacturacion(pr, pf) {
    const V2 = V();
    const plan = E().planFacturacion(pr, pf);
    if (!plan.length) return "";
    const imp = V2.hayImportes();
    const res = E().resumenFacturacion(pr, pf);
    const filas = plan.map(h => V2.fila([
      { html: N().esc(h.mesEtiqueta) },
      { html: N().esc(h.nombre) },
      { html: V2.badgeHito(h.estado) },
      { html: N().fmtPct(h.pct), clase: "pa-num" },
      celdaValor(imp ? V2.imp(h.importe) : "", imp),
      celdaValor(imp ? V2.imp(h.acumulado) : "", imp)
    ]));
    return "<h2>Plan de facturación por entregable</h2><table><thead><tr><th>Entrega</th><th>Entregable</th><th>Estado</th><th class=\"pa-num\">%</th><th class=\"pa-num\">Importe</th><th class=\"pa-num\">Acumulado</th></tr></thead><tbody>" +
      filas.join("") + "</tbody></table>" +
      '<p class="pa-mini">Planificado ' + (imp ? V2.imp(res.total) : "") + " · facturado con lo entregado/aceptado " + (imp ? V2.imp(res.facturado) : "") +
      " · pendiente " + (imp ? V2.imp(res.pendienteFacturar) : "") + "</p>";
  }

  function tablaTotales(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const d = pr.descuento || {};
    const t = pr.impuestos || {};
    const filaT = (texto, valor, fuerte) => V2.fila([
      { html: (fuerte ? "<strong>" : "") + texto + (fuerte ? "</strong>" : "") },
      { html: (fuerte ? "<strong>" : "") + (imp ? V2.imp(valor) : "") + (fuerte ? "</strong>" : ""), clase: "pa-num pa-importe" }
    ]);
    return "<h2>Totales</h2><table><tbody>" +
      filaT("Consultoría", C().importeProyecto(pr, pf)) +
      (C().gastosTotal(pr) ? filaT("Gastos generales", C().gastosTotal(pr)) : "") +
      filaT("Subtotal", C().subtotalProyecto(pr, pf), true) +
      (d.tipo ? filaT("Descuento (" + (d.tipo === "%" ? N().fmtNum(d.valor) + " %" : "importe fijo") + ")", -C().descuentoImporte(pr, pf)) : "") +
      filaT("Base imponible", C().baseImponible(pr, pf)) +
      (C().nombreImpuesto(pr) ? filaT(C().nombreImpuesto(pr) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " (incluido en los precios)" : ""), C().impuestoImporte(pr, pf)) : "") +
      '</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num pa-importe"><strong>' + (imp ? V2.imp(C().totalProyecto(pr, pf)) : "") + "</strong></td></tr></tfoot></table>" +
      (pr.condicionesPago ? "<p><strong>Condiciones de pago:</strong> " + N().esc(pr.condicionesPago) + "</p>" : "");
  }

  function tablaPerfiles(pr, pf) {
    const V2 = V();
    const horas = C().horasPorPerfil(pr);
    const imp = V2.hayImportes();
    const filas = N().lista(pf).filter(p => N().num(horas[p.id]) > 0).map(p => V2.fila([
      { html: N().esc(p.nombre) + ' <span class="pa-mini">(' + N().esc(p.categoria) + ")</span>" },
      { html: N().fmtHoras(horas[p.id]), clase: "pa-num" },
      celdaValor(imp ? V2.imp(C().importePerfil(pr, pf, p.id)) : "", imp)
    ]));
    return "<h2>Resumen por perfil</h2><table><thead><tr><th>Perfil</th><th class=\"pa-num\">Horas</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      (filas.join("") || '<tr><td colspan="3">—</td></tr>') + "</tbody></table>";
  }

  function tablaMensual(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const meses = C().mesesProyecto(pr);
    return '<h2>Importe mensual</h2><table><thead><tr><th>Mes</th><th class="pa-num">Importe</th><th class="pa-num">Horas</th></tr></thead><tbody>' +
      Array.from({ length: meses }, (_, i) => V2.fila([
        { html: N().etiquetaMes(pr.fechaInicio, i) },
        celdaValor(imp ? V2.imp(C().importeMes(pr, pf, i)) : "", imp),
        { html: N().fmtHoras(C().horasMes(pr, i)), clase: "pa-num" }
      ])).join("") + "</tbody></table>";
  }

  function tablaAnualidades(pr, pf) {
    const V2 = V();
    const imp = V2.hayImportes();
    const an = C().anualidades(pr, pf);
    const claves = Object.keys(an);
    if (claves.length < 2) return "";
    return "<h2>Anualidades</h2><table><thead><tr><th>Año</th><th class=\"pa-num\">Importe</th></tr></thead><tbody>" +
      claves.map(y => V2.fila([{ html: y }, celdaValor(imp ? V2.imp(an[y]) : "", imp)])).join("") +
      '</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num pa-importe"><strong>' + (imp ? V2.imp(N().r2(N().suma(claves, y => an[y]))) : "") + "</strong></td></tr></tfoot></table>";
  }

  function render() {
    const V2 = V(), APP2 = APP();
    const pr = APP2.pr();
    const cont = "informe-cuerpo";
    if (!pr) { V2.escribir(cont, ""); return; }
    const marca = APP2.ESTADO.marca || {};
    const pf = APP2.pf();
    const logo = marca.logo ? '<div style="margin-bottom:var(--nz-space-2)"><img class="pa-logo" style="height:44px;max-width:220px" src="' + marca.logo + '" alt=""></div>' : "";

    V2.escribir(cont,
      cabecera(pr, marca) +
      logo +
      "<h1>" + N().esc(pr.nombre) + "</h1>" +
      alcance(pr) +
      tablaEntregables(pr, pf) +
      tablaDetalle(pr, pf) +
      tablaGastos(pr) +
      tablaTotales(pr, pf) +
      tablaFacturacion(pr, pf) +
      tablaPerfiles(pr, pf) +
      tablaMensual(pr, pf) +
      tablaAnualidades(pr, pf) +
      '<div class="pa-informe__pie"><span>Generado con ' + N().esc(marca.nombre || "Planifica") + "</span><span>" + N().hoyLargo() + "</span></div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Hecho con ❤️ por David Antizar</p>');
    void M;
  }

  PL.vistas.informe = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
