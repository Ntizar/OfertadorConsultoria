"use strict";
/* =====================================================================
   Planifica v3 — EVENTOS
   Delegación de clicks, escritura y cambios. El repintado siempre pasa por
   PL.repintar y, cuando toca rehacer la vista, se conserva el foco del
   campo que el usuario estaba editando.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const A = () => PL.almacen;
  const R = () => PL.repintar;
  const APP = () => PL.app;
  const V = () => PL.vistas;

  const pr = () => APP().pr();
  const pf = () => APP().pf();

  /* ---------- Clicks ---------- */

  function alClic(e) {
    const btn = e.target.closest ? e.target.closest("[data-acc]") : null;
    if (btn) {
      const f = PL.acc[btn.dataset.acc];
      if (f) { f(btn); }
      else { APP().toast("Acción no disponible: " + btn.dataset.acc); }
      return;
    }
    const tab = e.target.closest ? e.target.closest("#pa-tabs .nz-tabs__tab") : null;
    if (tab) { APP().pestana(tab.dataset.tab); return; }
    /* Cerrar modales al pulsar el fondo */
    if (e.target.classList && e.target.classList.contains("nz-modal__scrim")) {
      const modal = e.target.parentElement && e.target.parentElement.querySelector('input[type="checkbox"]');
      if (modal) modal.checked = false;
    }
  }

  /* ---------- Escritura (input) ---------- */

  const campos = {
    "horas": function (el, id, o) {
      const r = M().buscarLinea(o, id); if (!r) return;
      r.linea.horas = r.linea.horas || {};
      r.linea.horas["m" + el.dataset.mes] = N().num(el.value);
      /* La fila se actualiza en el sitio: la vista no se repinta, así no se pierde el foco. */
      PL.vistas.estructura.actualizarFilaHoras(o, pf(), r.linea, el.closest("tr"));
      R().datos();
    },
    "tarea-nombre": function (el, id, o) { const t = M().buscarTarea(o, id); if (t) { t.nombre = el.value; R().datos(); } },
    "sub-nombre": function (el, id, o) { const r = M().buscarSub(o, id); if (r) r.sub.nombre = el.value; },
    "hito-nombre": function (el, id, o) { hito(el, id, o, "nombre", el.value); },
    "hito-desc": function (el, id, o) { hito(el, id, o, "descripcion", el.value); },
    "hito-criterio": function (el, id, o) { hito(el, id, o, "criterio", el.value); },
    "hito-fecha": function (el, id, o) { hito(el, id, o, "fecha", el.value); R().cronograma(); },
    "hito-pct": function (el, id, o) {
      hito(el, id, o, "facturacionPct", N().acota(el.value, 0, 100));
      conFoco(() => { R().datos(); R().entregables(); R().estructura(); });
    },
    "gasto-nombre": function (el, id, o) {
      const g = N().lista(o.gastos).filter(x => x.id === id)[0];
      if (g) { g.nombre = el.value; R().datos(); }
    },
    "gasto-unidades": function (el, id, o) { gasto(el, id, o, "unidades"); },
    "gasto-precio": function (el, id, o) { gasto(el, id, o, "precio"); },
    "oferta-nombre": function (el, o) {
      o.nombre = el.value;
      const sel = V().nodo("pa-sel-proyecto");
      if (sel) {
        const op = sel.querySelector('option[value="' + o.id + '"]');
        if (op) op.textContent = el.value;
      }
      R().datos();
    },
    "oferta-cliente-nombre": function (el, id, o) { o.cliente.nombre = el.value; R().datos(); },
    "oferta-cliente-contacto": function (el, id, o) { o.cliente.contacto = el.value; },
    "oferta-cliente-ref": function (el, id, o) { o.cliente.ref = el.value; R().cabecera(); },
    "oferta-fecha": function (el, o) { o.fecha = el.value; R().cabecera(); },
    "oferta-validez": function (el, o) { o.validezDias = N().acota(el.value, 0, 3650); R().cabecera(); },
    "oferta-desc": function (el, o) { o.descripcion = el.value; },
    "oferta-pago": function (el, o) { o.condicionesPago = el.value; R().datos(); },
    "oferta-impuesto-tasa": function (el, o) { o.impuestos.tasa = N().acota(el.value, 0, 100); R().datos(); },
    "oferta-descuento-valor": function (el, o) { o.descuento.valor = N().acota(el.value, 0, 1e9); R().datos(); },
    "perfil-nombre": function (el, id) { const p = C().perfilPorId(APP().ESTADO.perfiles, id); if (p) { p.nombre = el.value; R().datos(); } },
    "perfil-tarifa": function (el, id) { const p = C().perfilPorId(APP().ESTADO.perfiles, id); if (p) { p.tarifa = N().acota(el.value, 0, 1e9); R().datos(); } },
    "perfil-unidades": function (el, id) { const p = C().perfilPorId(APP().ESTADO.perfiles, id); if (p) p.unidades = el.value; }
  };

  /* app.js se usa desde el manejador de horas: se resuelve tarde para no crear ciclos. */
  const M = () => PL.modelo;

  function hito(el, id, o, campo, valor) {
    const r = M().buscarEntregable(o, id, el.dataset.tarea || "");
    if (!r) return;
    r.entregable[campo] = valor;
    APP().guardar();
  }

  function gasto(el, id, o, campo) {
    const g = N().lista(o.gastos).filter(x => x.id === id)[0];
    if (!g) return;
    g[campo] = N().acota(el.value, 0, 1e9);
    const fila = el.closest(".pa-fila-dato");
    if (fila) {
      const span = fila.querySelector(".pa-celda-importe");
      if (span) span.textContent = V().imp(C().gastoImporte(g));
    }
    V().texto("gas-total", APP().verImportes() ? "Gastos: " + V().imp(C().gastosTotal(o)) : "");
    R().datos();
  }

  /** Repinta conservando el foco (si había un campo de dato activo). */
  function conFoco(fn) {
    const el = document.activeElement;
    const campo = el && el.dataset ? el.dataset.campo : null;
    const id = el && el.dataset ? el.dataset.id : null;
    const pos = el && typeof el.selectionStart === "number" ? el.selectionStart : null;
    fn();
    if (campo && id) {
      const nuevo = document.querySelector('[data-campo="' + campo + '"][data-id="' + id + '"]');
      if (nuevo && nuevo.focus) {
        nuevo.focus();
        if (pos !== null && nuevo.setSelectionRange) { try { nuevo.setSelectionRange(pos, pos); } catch (e) { /* no aplicable */ } }
      }
    }
  }

  function alEscribir(e) {
    const el = e.target;
    const campo = el.dataset ? el.dataset.campo : null;
    const o = pr();
    if (!o) return;
    if (el.id === "aj-marca") { APP().ESTADO.marca.nombre = el.value; R().cabecera(); APP().guardar(); return; }
    if (el.id === "aj-sub") { APP().ESTADO.marca.sub = el.value; APP().guardar(); return; }
    if (el.id === "aj-moneda") { APP().ESTADO.marca.moneda = el.value || "€"; R().todo(); APP().guardar(); return; }
    if (!campo) return;
    const f = campos[campo];
    if (f) { f(el, el.dataset.id, o); APP().guardar(); }
  }

  /* ---------- Cambios (change) ---------- */

  function alCambiar(e) {
    const el = e.target;
    const campo = el.dataset ? el.dataset.campo : null;
    const o = pr();

    if (el.id === "pa-sel-proyecto") { APP().ESTADO.activo = el.value; R().todo(); APP().guardar(); return; }
    if (el.id === "aj-importes") { APP().ESTADO.mostrarImportes = el.checked; R().todo(); APP().guardar(); return; }
    if (el.id === "pa-logo-fichero") { leerLogo(el); return; }
    if (el.id === "pa-fichero") { leerJson(el); return; }
    if (!o) return;

    switch (campo) {
      case "linea-perfil": {
        const r = M().buscarLinea(o, el.dataset.id);
        if (r) { r.linea.perfilId = el.value; R().estructura(); R().datos(); APP().guardar(); }
        return;
      }
      case "hito-mes":
      case "hito-estado":
      case "hito-responsable": {
        const r = M().buscarEntregable(o, el.dataset.id, el.dataset.tarea || "");
        if (!r) return;
        if (campo === "hito-mes") r.entregable.mes = N().acota(el.value, 0, C().mesesProyecto(o) - 1);
        if (campo === "hito-estado") r.entregable.estado = M().esEstadoEntregable(el.value) ? el.value : "pendiente";
        if (campo === "hito-responsable") r.entregable.responsablePerfilId = el.value;
        conFoco(() => { R().datos(); R().estructura(); R().entregables(); R().cronograma(); R().escenarios(); });
        APP().guardar();
        return;
      }
      case "perfil-categoria": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.categoria = el.value; APP().guardar(); }
        return;
      }
      case "oferta-estado": { o.estado = el.value; R().cabecera(); R().datos(); APP().guardar(); return; }
      case "oferta-inicio": { o.fechaInicio = el.value || o.fechaInicio; R().todo(); APP().guardar(); return; }
      case "oferta-meses": { cambiarMeses(o, el.value); return; }
      case "oferta-impuesto-tipo": { o.impuestos.tipo = el.value; R().datos(); R().ajustes(); APP().guardar(); return; }
      case "oferta-impuesto-incluido": { o.impuestos.incluido = el.checked; R().datos(); APP().guardar(); return; }
      case "oferta-descuento-tipo": { o.descuento.tipo = el.value; R().datos(); APP().guardar(); return; }
      default: return;
    }
  }

  /** Cambiar la duración ajusta las horas de todas las líneas. */
  function cambiarMeses(o, valor) {
    const m = Math.round(N().acota(valor, 1, 60));
    o.meses = m;
    N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      const h = l.horas = l.horas || {};
      for (let i = 0; i < m; i++) if (!(("m" + i) in h)) h["m" + i] = 0;
      Object.keys(h).forEach(k => {
        const i = parseInt(k.slice(1), 10);
        if (isNaN(i) || i >= m) delete h[k];
      });
    })));
    N().lista(o.entregables).forEach(e => { e.mes = Math.min(N().num(e.mes), m - 1); });
    N().lista(o.tareas).forEach(t => N().lista(t.entregables).forEach(e => { e.mes = Math.min(N().num(e.mes), m - 1); }));
    R().todo();
    APP().guardar();
    APP().toast("Duración: " + m + " meses");
  }

  /* ---------- Ficheros ---------- */

  function leerJson(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const analisis = A().analizarImportacion(String(fr.result));
      if (!analisis.ok) { APP().toast(analisis.error); el.value = ""; return; }
      let reemplazar = false;
      if (analisis.tipo === "estado") {
        reemplazar = confirm("ACEPTAR = Reemplazar TODOS los datos actuales\nCANCELAR = Fusionar (añade y actualiza por id)");
        if (reemplazar) A().descargar("planifica-copia-anterior-" + N().hoyISO() + ".json", JSON.stringify(APP().ESTADO, null, 2), "application/json");
      }
      const r = A().aplicarImportacion(APP().ESTADO, analisis, { reemplazar: reemplazar, aplicarMarca: reemplazar });
      R().todo();
      APP().guardar();
      APP().toast(r.mensaje || "Importación completada");
      el.value = "";
    };
    fr.readAsText(f);
  }

  function leerLogo(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const src = String(fr.result);
      if (src.length > 300000) { APP().toast("Logo demasiado grande (máx. ~300 KB)"); el.value = ""; return; }
      APP().ESTADO.marca.logo = src;
      R().cabecera(); R().ajustes(); APP().guardar();
      APP().toast("Logo aplicado");
      el.value = "";
    };
    fr.readAsDataURL(f);
    void N;
  }

  /* ---------- Montaje ---------- */

  function montar() {
    document.addEventListener("click", alClic);
    document.addEventListener("input", alEscribir);
    document.addEventListener("change", alCambiar);

    /* Atajos: Ctrl+S guarda una copia; Ctrl+P abre el informe antes de imprimir. */
    document.addEventListener("keydown", e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "s") { e.preventDefault(); A().exportarTodo(APP().ESTADO); APP().toast("Copia de seguridad descargada"); }
      if (k === "p") { APP().pestana("informe"); }
    });
  }

  PL.eventos = { montar: montar, conFoco: conFoco, campos: campos };
})(typeof window !== "undefined" ? window : globalThis);
