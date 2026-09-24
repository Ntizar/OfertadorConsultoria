"use strict";
/* =====================================================================
   Planifica v3 — ARRANQUE
   Une todo: carga (con migración y aviso de datos heredados), repintado por
   partes, cambio de pestaña y errores en pantalla.

   Rendimiento: solo se repinta la vista de la pestaña activa. Las demás se
   repintan al entrar. Al teclear horas, la fila se actualiza en el sitio.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const A = () => PL.almacen;
  const V = () => PL.vistas;

  let tGuardar = null, tDatos = null;
  let pestanaActual = "estructura";

  /* ---------- Aplicación ---------- */

  const app = {
    ESTADO: null,
    ui: { comparacion: null },

    pr: function () {
      const e = app.ESTADO;
      if (!e) return null;
      return e.proyectos.filter(p => p.id === e.activo)[0] || e.proyectos[0] || null;
    },
    pf: function () { return (app.ESTADO && app.ESTADO.perfiles) || []; },
    moneda: function () { return (app.ESTADO && app.ESTADO.marca && app.ESTADO.marca.moneda) || "€"; },
    verImportes: function () { return !!(app.ESTADO && app.ESTADO.mostrarImportes); },
    pestana: function (nombre) { if (nombre) mostrarPestana(nombre); return pestanaActual; },

    /** Guardado diferido (cada cambio no escribe en disco). */
    guardar: function () {
      clearTimeout(tGuardar);
      tGuardar = setTimeout(() => {
        const err = A().guardar(app.ESTADO);
        if (err) app.toast("No se pudo guardar: " + err);
        const el = V().nodo("pa-guardado");
        if (el) { el.textContent = "Guardado ✓"; setTimeout(() => { el.textContent = ""; }, 1500); }
      }, 250);
    },

    toast: function (mensaje) {
      let el = V().nodo("pa-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "pa-toast";
        document.body.appendChild(el);
      }
      el.textContent = mensaje;
      el.classList.add("is-visible");
      clearTimeout(el.__tm);
      el.__tm = setTimeout(() => el.classList.remove("is-visible"), 2800);
    },

    /** Reemplaza el estado entero (borrar todo, restaurar ejemplo, importar). */
    reemplazarEstado: function (nuevo, pestana) {
      app.ESTADO = nuevo;
      app.ui.comparacion = null;
      PL.repintar.todo();
      pestanaActual = null;
      mostrarPestana(pestana || "estructura");
      app.guardar();
    },

    sincronizar: function () { PL.repintar.todo(); }
  };
  PL.app = app;

  /* ---------- Repintado por partes ---------- */

  const vistas = ["estructura", "entregables", "escenarios", "resumen", "cronograma", "gastos", "informe", "ajustes"];

  function pintarVista(nombre) {
    const v = PL.vistas[nombre];
    if (v && typeof v.render === "function") v.render();
  }

  PL.repintar = {
    cabecera: function () {
      const e = app.ESTADO, o = app.pr();
      if (!e) return;
      const marca = e.marca || {};
      V().texto("pa-marca-nombre", marca.nombre || "Planifica");
      V().texto("pa-pie-marca", marca.nombre || "Planifica");
      document.title = (marca.nombre || "Planifica") + " — Ofertas y planificación de proyectos";
      const img = V().nodo("pa-logo");
      if (img) { if (marca.logo) { img.src = marca.logo; img.hidden = false; } else { img.hidden = true; } }

      const sel = V().nodo("pa-sel-proyecto");
      if (sel) {
        const html = N().lista(e.proyectos).map(p =>
          '<option value="' + p.id + '"' + (p.id === e.activo ? " selected" : "") + ">" + N().esc(p.nombre) +
          (p.estado && p.estado !== "borrador" ? " · " + M().ESTADOS_OFERTA[p.estado].texto : "") + "</option>").join("");
        if (sel.__paHtml !== html) { sel.innerHTML = html; sel.__paHtml = html; }
      }
      document.body.classList.toggle("pa-sin-importes", !e.mostrarImportes);
      const btn = V().nodo("btn-importes");
      if (btn) btn.textContent = e.mostrarImportes ? "👁 €" : "👁 h";

      const inp = V().nodo("inp-ofe-nombre");
      if (inp && o && inp.value !== o.nombre) inp.value = o.nombre || "";
      V().texto("pa-estado-badge", "");
      const badge = V().nodo("pa-estado-badge");
      if (badge) badge.innerHTML = o ? V().badgeOferta(o) : "";
      V().texto("pa-meta-oferta", o ? (C().mesesProyecto(o) + " meses desde " + N().etiquetaMes(o.fechaInicio, 0) + (o.fecha ? " · " + o.fecha : "")) : "");
      PL.repintar.kpis();
    },

    kpis: function () {
      const o = app.pr(), pf = app.pf();
      if (!o) return;
      const imp = app.verImportes();
      const est = E().porEstado(o);
      const res = E().resumenFacturacion(o, pf);
      V().texto("kpi-total", imp ? V().imp(C().totalProyecto(o, pf)) : "—");
      const t = o.impuestos || {};
      V().texto("kpi-total-detalle", imp
        ? ((t.tipo && t.tipo !== "ninguno") ? (C().nombreImpuesto(o) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " incluido" : "")) : "sin impuestos")
        : "modo solo tiempos");
      V().texto("kpi-horas", V().hor(C().horasProyecto(o)));
      V().texto("kpi-estructura", N().lista(o.tareas).length + " tareas · " + N().suma(o.tareas, x => N().lista(x.subtareas).length) + " subtareas");
      V().texto("kpi-entregables", String(est.total));
      V().texto("kpi-avance", est.finalizados + " de " + est.total + " finalizados (" + N().fmtPct(est.pct) + ")");
      V().texto("kpi-facturado", imp ? V().imp(res.pendienteFacturar) : "—");
      V().texto("kpi-cliente", imp
        ? ("facturado " + V().imp(res.facturado))
        : ((o.cliente && o.cliente.nombre) || "—"));
    },

    estructura: function () { pintarVista("estructura"); },
    entregables: function () { pintarVista("entregables"); },
    escenarios: function () { pintarVista("escenarios"); },
    resumen: function () { pintarVista("resumen"); },
    cronograma: function () { pintarVista("cronograma"); },
    gastos: function () { pintarVista("gastos"); },
    informe: function () { pintarVista("informe"); },
    ajustes: function () { pintarVista("ajustes"); },

    /** Tras editar horas o importes: KPIs + la vista activa (con retardo). */
    datos: function () {
      clearTimeout(tDatos);
      tDatos = setTimeout(function () {
        PL.repintar.kpis();
        const v = PL.vistas[pestanaActual];
        if (v && pestanaActual !== "estructura" && typeof v.render === "function") v.render();
      }, 120);
    },

    /** Repintado completo de lo visible (cabecera, KPIs y la pestaña activa). */
    todo: function () {
      PL.repintar.cabecera();
      pintarVista(pestanaActual);
    }
  };

  /* ---------- Pestañas ---------- */

  function mostrarPestana(nombre) {
    if (vistas.indexOf(nombre) < 0) nombre = "estructura";
    pestanaActual = nombre;
    /* OJO: querySelectorAll devuelve un NodeList, no un Array: hay que convertirlo
       (N.lista() solo acepta arrays reales y devolvería [] en silencio). */
    Array.prototype.forEach.call(document.querySelectorAll("#pa-tabs .nz-tabs__tab"), b => {
      b.setAttribute("aria-selected", String(b.dataset.tab === nombre));
    });
    /* Las secciones cuelgan de .nz-tabs__panel: se localizan por id, nunca por
       descendencia directa de <main> (ese fue el bug que dejó 5 pestañas muertas). */
    Array.prototype.forEach.call(document.querySelectorAll('main section[id^="sec-"]'), s => {
      s.hidden = (s.id !== "sec-" + nombre);
    });
    pintarVista(nombre);
    if (app.ESTADO) { app.ESTADO.pestana = nombre; app.guardar(); }
  }

  /* ---------- Aviso de datos heredados ---------- */

  function avisoHeredados(aviso) {
    if (!aviso) { V().vaciar("pa-herederos"); return; }
    V().escribir("pa-herederos", V().aviso("warning",
      "<strong>Datos migrados.</strong> " + N().esc(aviso) +
      ' <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="limpiar-heredados">Borrar los datos antiguos</button>' +
      ' <span class="pa-mini">(los datos actuales no se tocan)</span>'));
  }

  /* ---------- Errores en pantalla ---------- */

  function errorVisible(mensaje) {
    const el = V().nodo("pa-error");
    if (!el) return;
    el.textContent = "⚠ " + mensaje;
    el.classList.add("is-visible");
  }

  /* ---------- Arranque ---------- */

  function arrancar() {
    window.addEventListener("error", ev => errorVisible(ev.message || "error desconocido"));
    window.addEventListener("unhandledrejection", ev => errorVisible((ev.reason && ev.reason.message) || "promesa rechazada"));

    let lectura = { estado: null, heredado: false, aviso: "", origen: 0 };
    try { lectura = A().cargar(); }
    catch (e) { lectura = { estado: M().estadoInicial(), heredado: false, aviso: "No se pudieron leer los datos guardados (" + e.message + "): se empieza de cero." }; }

    app.ESTADO = lectura.estado || M().estadoInicial();
    if (!N().lista(app.ESTADO.proyectos).length) app.ESTADO = M().estadoInicial();
    if (!app.pr()) app.ESTADO.activo = app.ESTADO.proyectos[0].id;

    PL.enviar.instalarVistas();
    PL.eventos.montar();

    PL.repintar.cabecera();
    mostrarPestana(app.ESTADO.pestana || "estructura");
    avisoHeredados(lectura.aviso);
    PL.repintar.todo();
  }

  /* ---------- Puente mínimo para el arnés de verificación ---------- */

  PL.enviar = {
    instalarVistas: function () { /* las vistas ya se han registrado al cargarse */ },
    /** Permite a los arneses y a la consola inspeccionar y forzar repintados. */
    api: {
      estado: () => app.ESTADO,
      oferta: () => app.pr(),
      perfiles: () => app.pf(),
      repintar: () => { PL.repintar.todo(); },
      pestana: n => mostrarPestana(n),
      total: () => C().totalProyecto(app.pr(), app.pf()),
      facturacion: () => E().resumenFacturacion(app.pr(), app.pf())
    }
  };

  raiz.Planifica = PL.enviar.api;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})(typeof window !== "undefined" ? window : globalThis);
