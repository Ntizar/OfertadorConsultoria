"use strict";
/* =====================================================================
   Planifica v4 — ARRANQUE
   Une todo: carga con migración y aviso, repintado CONECTADO (cualquier
   cambio se refleja en todas las vistas) y errores en pantalla.

   Rendimiento: `escribir()` compara el HTML antes de tocar el DOM, así que
   repintar las 5 vistas en cada cambio es barato y no produce parpadeos.
   Mientras se teclean horas solo se repinta el resto (el editor se actualiza
   fila a fila), de modo que nunca se pierde el foco.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const A = () => PL.almacen;
  const V = () => PL.vistas;

  const VISTAS = ["trabajo", "oferta", "perfiles", "carga", "resumen", "informe", "ajustes"];
  const PANELES = {
    trabajo: "pa-trabajo-panel", oferta: "pa-oferta-panel", perfiles: "pa-perfiles-panel",
    carga: "pa-carga-panel", resumen: "pa-resumen-panel", informe: "pa-informe-panel", ajustes: "pa-ajustes-panel"
  };

  let tGuardar = null, tDatos = null;
  let pestanaActual = "trabajo";

  /* ---------- Aplicación ---------- */

  const app = {
    ESTADO: null,
    ui: { comparacion: null },

    pr: function () {
      const e = app.ESTADO;
      if (!e || !e.ofertas.length) return null;
      return e.ofertas.filter(x => x.id === e.activa)[0] || e.ofertas[0];
    },
    pf: function () { return (app.ESTADO && app.ESTADO.perfiles) || []; },
    moneda: function () { return (app.ESTADO && app.ESTADO.marca && app.ESTADO.marca.moneda) || "€"; },
    /** Cómo se teclean las horas: en dedicación (%) o en horas. Las horas siempre
        son el dato guardado; el % es la puerta de entrada cómoda. */
    modoHoras: function () { return (app.ESTADO && app.ESTADO.ui && app.ESTADO.ui.modoHoras) === "h" ? "h" : "pct"; },
    conModoHoras: function (m) {
      app.ESTADO.ui = app.ESTADO.ui || {};
      app.ESTADO.ui.modoHoras = (m === "h") ? "h" : "pct";
    },
    verImportes: function () { return !!(app.ESTADO && app.ESTADO.mostrarImportes); },
    pestana: function (n) { if (n) mostrarPestana(n); return pestanaActual; },

    guardar: function () {
      clearTimeout(tGuardar);
      tGuardar = setTimeout(function () {
        const err = A().guardar(app.ESTADO);
        if (err) app.toast("No se pudo guardar: " + err);
        const el = V().nodo("pa-guardado");
        if (el) { el.textContent = "Guardado ✓"; setTimeout(function () { el.textContent = ""; }, 1500); }
      }, 250);
    },

    toast: function (mensaje) {
      let el = V().nodo("pa-toast");
      if (!el) { el = document.createElement("div"); el.id = "pa-toast"; document.body.appendChild(el); }
      el.textContent = mensaje;
      el.classList.add("is-visible");
      clearTimeout(el.__tm);
      el.__tm = setTimeout(function () { el.classList.remove("is-visible"); }, 2800);
    },

    reemplazarEstado: function (nuevo, pestana) {
      app.ESTADO = nuevo;
      app.ui.comparacion = null;
      pestanaActual = null;
      mostrarPestana(pestana || "trabajo");
    }
  };
  PL.app = app;

  /* ---------- Repintado conectado ---------- */

  function pintarVista(nombre) {
    const v = PL.vistas[nombre];
    if (v && typeof v.render === "function") v.render();
  }

  function pintarCalendario() { PL.vistas.trabajo.renderCalendario(); }
  function pintarGantt() { PL.vistas.trabajo.renderGantt(); }

  function todasLasVistas() { VISTAS.forEach(pintarVista); }

  PL.repintar = {
    cabecera: function () {
      const e = app.ESTADO, o = app.pr();
      if (!e) return;
      const marca = e.marca || {};
      V().texto("pa-marca-nombre", marca.nombre || "Oferta");
      V().texto("pa-pie-marca", marca.nombre || "Oferta");
      document.title = (marca.nombre || "Oferta") + " — del encargo a la oferta";

      const img = V().nodo("pa-logo");
      if (img) { if (marca.logo) { img.src = marca.logo; img.hidden = false; } else { img.hidden = true; } }

      const sel = V().nodo("pa-sel-oferta");
      if (sel) {
        const html = N().lista(e.ofertas).map(x =>
          '<option value="' + x.id + '"' + (x.id === e.activa ? " selected" : "") + ">" + N().esc(x.nombre) +
          (x.estado && x.estado !== "borrador" ? " · " + M().ESTADOS_OFERTA[x.estado].texto : "") + "</option>").join("");
        if (sel.__paHtml !== html) { sel.innerHTML = html; sel.__paHtml = html; }
      }

      document.body.classList.toggle("pa-sin-importes", !e.mostrarImportes);
      const btn = V().nodo("btn-importes");
      if (btn) btn.textContent = e.mostrarImportes ? "👁 €" : "👁 h";

      const inp = V().nodo("inp-ofe-nombre");
      if (inp && o && inp.value !== o.nombre) inp.value = o.nombre || "";
      const badge = V().nodo("pa-estado-badge");
      if (badge) badge.innerHTML = o ? V().badgeOferta(o) : "";
      V().texto("pa-meta-oferta", o
        ? ((o.cliente && o.cliente.nombre ? o.cliente.nombre + " · " : "") + P().duracionLegible(o.periodos) + (o.fecha ? " · " + N().fechaCorta(o.fecha) : ""))
        : "");
      this.kpis();
    },

    kpis: function () {
      const o = app.pr(), pf = app.pf();
      if (!o) return;
      const conImp = app.verImportes();
      const t = o.impuestos || {};
      V().texto("kpi-total", conImp ? V().imp(C().totalOferta(o, pf)) : "—");
      V().texto("kpi-total-detalle", conImp
        ? (C().nombreImpuesto(o) ? C().nombreImpuesto(o) + " " + N().fmtNum(t.tasa) + " %" + (t.incluido ? " incluido" : "") : "sin impuestos")
        : "modo solo tiempos");
      V().texto("kpi-horas", V().hor(C().ofertaHoras(o)));
      const perfilesUsados = Object.keys(C().horasPorPerfil(o)).length;
      V().texto("kpi-perfiles", perfilesUsados + " perfil(es) · " + N().lista(o.tareas).length + " tareas");
      V().texto("kpi-calendario", P().meses(o.periodos) + " meses");
      V().texto("kpi-rango", P().rangoLegible(o.periodos));
      const conteo = E().porContexto(o);
      V().texto("kpi-entregables", String(conteo.total));
      const prox = E().proximo(o);
      V().texto("kpi-cliente", prox
        ? ("primer entrega: " + P().mesCorto(o.periodos, prox.periodo) + (prox._tareaNombre ? " · " + prox._tareaNombre : ""))
        : "sin entregables");
    },

    trabajo: function () { pintarVista("trabajo"); },
    oferta: function () { pintarVista("oferta"); },
    perfiles: function () { pintarVista("perfiles"); },
    carga: function () { pintarVista("carga"); },
    resumen: function () { pintarVista("resumen"); },
    informe: function () { pintarVista("informe"); },
    ajustes: function () { pintarVista("ajustes"); },
    calendario: pintarCalendario,
    gantt: pintarGantt,

    /** Cambio con cifras: se repinta TODO menos el editor (el foco se conserva).
        Así el Gantt, los KPIs y las demás pestañas van en vivo mientras se teclea. */
    datos: function () {
      clearTimeout(tDatos);
      tDatos = setTimeout(function () {
        PL.repintar.cabecera();
        pintarCalendario();
        pintarGantt();
        ["oferta", "perfiles", "carga", "resumen", "informe", "ajustes"].forEach(pintarVista);
      }, 150);
    },

    /** Mientras se renombra un periodo: se repinta todo MENOS el Gantt, que contiene
        el campo que el usuario está escribiendo (así no se le quita el foco). */
    rotulo: function () {
      clearTimeout(tDatos);
      tDatos = setTimeout(function () {
        pintarCalendario();
        PL.vistas.trabajo.renderEditor();
        ["oferta", "perfiles", "carga", "resumen", "informe", "ajustes"].forEach(pintarVista);
      }, 120);
    },

    /** Repintado completo (incluido el editor). Tras añadir, borrar o mover. */
    todo: function () {
      PL.repintar.cabecera();
      todasLasVistas();
      refrescarHeredados();   /* el aviso de datos antiguos se apaga al borrarlos */
    }
  };

  /* ---------- Pestañas ---------- */

  function mostrarPestana(nombre) {
    if (VISTAS.indexOf(nombre) < 0) nombre = "trabajo";
    pestanaActual = nombre;
    Array.prototype.forEach.call(document.querySelectorAll("#pa-tabs .nz-tabs__tab"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.tab === nombre));
    });
    /* Las secciones cuelgan de .nz-tabs__panel: se localizan por id, nunca por
       descendencia directa de <main> (ése fue el bug que dejó pestañas muertas). */
    Array.prototype.forEach.call(document.querySelectorAll('main section[id^="sec-"]'), function (s) {
      s.hidden = (s.id !== "sec-" + nombre);
    });
    pintarVista(nombre);
    if (app.ESTADO) { app.ESTADO.ui.pestana = nombre; app.guardar(); }
    void PANELES;
  }

  /* ---------- Aviso de datos heredados ---------- */

  /* Sin banner de migración: los datos anteriores se importan solos y la nota,
     discreta y sin tecnicismos, vive en Ajustes → Datos. Aquí sólo se vacía el
     hueco (que sigue existiendo para avisos de error). */
  function refrescarHeredados() { V().vaciar("pa-herederos"); }

  /** Aviso suelto (por ejemplo, si falló la lectura de los datos guardados). */
  function avisoHeredados(aviso) {
    if (!aviso) { V().vaciar("pa-herederos"); return; }
    V().escribir("pa-herederos", V().aviso("warning", "<strong>Aviso.</strong> " + N().esc(aviso)));
  }

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

    let lectura = null;
    try { lectura = A().cargar(); }
    catch (e) { lectura = { estado: M().estadoInicial(), heredado: false, aviso: "No se pudieron leer los datos guardados (" + e.message + "): se empieza de cero." }; }

    /* Arranque limpio: si sólo había datos de versiones anteriores, se empieza con
       el ejemplo (los antiguos quedan a un clic, no se tocan). */
    app.ESTADO = lectura.estado || M().estadoInicial();
    if (!app.ESTADO.ofertas.length) app.ESTADO = M().estadoInicial();
    if (!app.pr()) app.ESTADO.activa = app.ESTADO.ofertas[0].id;

    PL.eventos.montar();
    mostrarPestana(app.ESTADO.ui.pestana || "trabajo");
    PL.repintar.todo();                       /* pinta todo y avisa de los datos heredados */
    if (lectura.aviso) avisoHeredados(lectura.aviso);   /* un aviso concreto (p. ej. lectura fallida) manda */
  }

  /* ---------- API para los arneses y la consola ---------- */
  raiz.Planifica = {
    estado: function () { return app.ESTADO; },
    oferta: function () { return app.pr(); },
    perfiles: function () { return app.pf(); },
    repintar: function () { PL.repintar.todo(); },
    pestana: function (n) { mostrarPestana(n); },
    total: function () { return C().totalOferta(app.pr(), app.pf()); },
    horas: function () { return C().ofertaHoras(app.pr()); },
    entregables: function () { return E().todos(app.pr()); },
    periodos: function () { return app.pr().periodos; },
    ui: function () { return app.ui; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})(typeof window !== "undefined" ? window : globalThis);
