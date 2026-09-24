"use strict";
/* =====================================================================
   Planifica v4 — EVENTOS
   Delegación de clicks, escritura y cambios. El repintado siempre pasa por
   PL.repintar: todo queda conectado (Gantt, KPIs, resumen, informe) sin
   perder el foco del campo que se está escribiendo.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const A = () => PL.almacen;
  const R = () => PL.repintar;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  const o = () => APP().pr();
  const pf = () => APP().pf();

  /* ---------- Clicks ---------- */

  function alClic(e) {
    const btn = e.target.closest ? e.target.closest("[data-acc]") : null;
    if (btn) {
      const f = PL.acc[btn.dataset.acc];
      if (f) f(btn);
      else APP().toast("Acción no disponible: " + btn.dataset.acc);
      return;
    }
    /* Ir a la tarea desde el Gantt */
    const concepto = e.target.closest ? e.target.closest("[data-ir]") : null;
    if (concepto) {
      const esSubtarea = concepto.dataset.ir.indexOf("sb_") === 0;
      const sel = esSubtarea
        ? '.pa-sub[data-id="' + concepto.dataset.ir + '"] > summary [data-campo="sub-nombre"]'
        : '[data-campo="tarea-nombre"][data-id="' + concepto.dataset.ir + '"]';
      const el = document.querySelector(sel);
      if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: "center" }); }
      return;
    }
    const tab = e.target.closest ? e.target.closest("#pa-tabs .nz-tabs__tab") : null;
    if (tab) APP().pestana(tab.dataset.tab);
  }

  /* ---------- Escritura ---------- */

  function alEscribir(e) {
    const el = e.target;
    const campo = el.dataset ? el.dataset.campo : null;
    const of = o();
    if (!of) return;

    /* Campos de la marca (ajustes) */
    if (el.id === "aj-marca") { APP().ESTADO.marca.nombre = el.value; R().cabecera(); APP().guardar(); return; }
    if (el.id === "aj-sub") { APP().ESTADO.marca.sub = el.value; APP().guardar(); return; }
    if (el.id === "aj-moneda") { APP().ESTADO.marca.moneda = el.value || "€"; R().todo(); APP().guardar(); return; }
    if (!campo) return;

    switch (campo) {

      /* Horas: se actualiza la fila en el sitio y el resto se repinta solo.
         Nunca se repinta el editor, así no se pierde el foco mientras se teclea. */
      case "horas": {
        const r = M().buscarLinea(of, el.dataset.id);
        if (!r) return;
        const i = N().num(el.dataset.mes);
        /* Se admite escribir la unidad: «50» (según el modo), «50 %» o «88 h».
           Las horas son el dato que se guarda; el % se convierte con la jornada. */
        const leido = N().parseaCantidad(el.value);
        if (!leido) return;
        const esPct = leido.unidad === "%" || (leido.unidad === "" && el.dataset.modo === "pct");
        let horas = esPct ? C().horasDePct(of, i, leido.valor) : leido.valor;

        /* TOPE: nadie puede pasar del 100 % de jornada en un mes. Si no cabe, se
           deja en el máximo libre y se explica por qué. */
        const disponible = r.linea.perfilId
          ? C().horasDisponiblesPerfilMes(of, r.linea.perfilId, i, r.linea.id)
          : C().horasLaborablesMes(of, i);
        if (horas > disponible + 0.005) {
          const p = C().perfilPorId(pf(), r.linea.perfilId);
          const pctDisp = C().pctDeHoras(of, i, disponible);
          const mes = P().mesCorto(of.periodos, i);
          APP().toast(pctDisp <= 0.5
            ? "⛔ " + (p ? p.nombre : "Ese perfil") + " ya está al 100 % en " + mes + ": no cabe nada más."
            : "⛔ " + (p ? p.nombre : "Ese perfil") + " sólo puede llegar a " + N().fmtCampo(disponible) +
              " h en " + mes + " (" + N().fmtCampo(pctDisp) + " %). Se deja en ese máximo: nadie pasa del 100 %.");
          horas = disponible;
          el.value = N().fmtCampo(esPct ? pctDisp : disponible);
        }
        r.linea.horas = r.linea.horas || {};
        r.linea.horas["p" + i] = N().acota(horas, 0, 1e6);
        V().trabajo.refrescarHorasPronto(of, pf());
        R().datos();
        APP().guardar();
        return;
      }

      /* Rótulo de un periodo: se aplica en vivo sin repintar el Gantt (el campo
         es el propio input que se está editando). */
      case "periodo-rotulo": {
        P().editar(of.periodos, el.dataset.id, el.value);
        el.classList.toggle("pa-gantt__rotulo--editado", !!el.value.trim());
        R().rotulo();   /* el resto de la app se actualiza sin tocar el campo que se edita */
        APP().guardar();
        return;
      }

      /* Texto libre: no hace falta repintar nada, el campo ya muestra lo escrito. */
      case "tarea-nombre": { const t = M().buscarTarea(of, el.dataset.id); if (t) { t.nombre = el.value; } APP().guardar(); return; }
      case "sub-nombre": { const r = M().buscarSubtarea(of, el.dataset.id); if (r) { r.sub.nombre = el.value; } APP().guardar(); return; }
      case "oferta-nombre": {
        of.nombre = el.value;
        const sel = V().nodo("pa-sel-oferta");
        const op = sel ? sel.querySelector('option[value="' + of.id + '"]') : null;
        if (op) op.textContent = el.value;
        APP().guardar();
        return;
      }
      case "oferta-cliente-nombre": of.cliente.nombre = el.value; APP().guardar(); return;
      case "oferta-cliente-contacto": of.cliente.contacto = el.value; APP().guardar(); return;
      case "oferta-cliente-ref": of.cliente.ref = el.value; APP().guardar(); return;
      case "oferta-desc": of.descripcion = el.value; APP().guardar(); return;
      case "oferta-pago": of.condicionesPago = el.value; APP().guardar(); return;

      /* Entregables */
      case "hito-nombre": case "hito-desc": case "hito-criterio": {
        const r = M().buscarEntregable(of, el.dataset.id, el.dataset.tarea || "", el.dataset.subtarea || "");
        if (!r) return;
        const mapa = { "hito-nombre": "nombre", "hito-desc": "descripcion", "hito-criterio": "criterio" };
        r.entregable[mapa[campo]] = el.value;
        APP().guardar();
        return;
      }
      case "hito-horas": {
        const r = M().buscarEntregable(of, el.dataset.id, el.dataset.tarea || "", el.dataset.subtarea || "");
        if (!r) return;
        r.entregable.horas = N().acota(el.value, 0, 1e6);
        R().datos(); APP().guardar();
        return;
      }
      case "hito-fecha": {
        const r = M().buscarEntregable(of, el.dataset.id, el.dataset.tarea || "", el.dataset.subtarea || "");
        if (!r) return;
        r.entregable.fecha = el.value;
        R().datos(); APP().guardar();
        return;
      }

      /* Gastos */
      case "gasto-nombre": {
        const g = N().lista(of.gastos).filter(x => x.id === el.dataset.id)[0];
        if (g) { g.nombre = el.value; APP().guardar(); }
        return;
      }
      case "gasto-unidades": case "gasto-precio": {
        const g = N().lista(of.gastos).filter(x => x.id === el.dataset.id)[0];
        if (!g) return;
        g[campo === "gasto-unidades" ? "unidades" : "precio"] = N().acota(el.value, 0, 1e9);
        const fila = el.closest(".pa-dato");
        if (fila) {
          const celda = fila.querySelector(".pa-celda-importe");
          if (celda) celda.textContent = V().imp(C().gastoImporte(g));
        }
        const total = V().nodo("gas-total");
        if (total) total.textContent = APP().verImportes() ? "Total: " + V().imp(C().gastosTotal(of)) : "";
        R().datos(); APP().guardar();
        return;
      }

      /* Números de la oferta */
      case "jornada-horas": {
        const j = PL.modelo.normalizarJornada(of.jornada);
        j.horasDia = N().acota(el.value, 0.5, 24);
        of.jornada = j;
        R().todo(); APP().guardar();
        return;
      }

      case "oferta-validez": of.validezDias = N().acota(el.value, 0, 3650); R().datos(); APP().guardar(); return;
      case "oferta-fecha": of.fecha = el.value; R().datos(); APP().guardar(); return;
      case "oferta-impuesto-tasa": of.impuestos.tasa = N().acota(el.value, 0, 100); R().datos(); APP().guardar(); return;
      case "oferta-descuento-valor": of.descuento.valor = N().acota(el.value, 0, 1e9); R().datos(); APP().guardar(); return;

      /* Perfiles */
      case "perfil-nombre": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.nombre = el.value; R().datos(); APP().guardar(); }
        return;
      }
      case "perfil-tarifa": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.tarifa = N().acota(el.value, 0, 1e9); R().datos(); APP().guardar(); }
        return;
      }
      case "perfil-notas": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.notas = el.value; APP().guardar(); }
        return;
      }
      case "perfil-unidad": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.unidad = N().texto(el.value, "h"); APP().guardar(); }
        return;
      }

      default: return;
    }
  }

  /* ---------- Cambios (selects y checkboxes) ---------- */

  function alCambiar(e) {
    const el = e.target;
    const campo = el.dataset ? el.dataset.campo : null;
    const of = o();

    if (el.id === "pa-sel-oferta") { APP().ESTADO.activa = el.value; R().todo(); APP().guardar(); return; }
    if (el.id === "aj-importes") { APP().ESTADO.mostrarImportes = el.checked; R().todo(); APP().guardar(); return; }
    if (el.id === "pa-logo-fichero") { leerLogo(el); return; }
    if (el.id === "pa-fichero") { leerJson(el); return; }
    if (!of) return;

    switch (campo) {
      case "jornada-dia": {
        const j = PL.modelo.normalizarJornada(of.jornada);
        const dia = N().num(el.dataset.dia);
        j.diasSemana = el.checked
          ? j.diasSemana.concat([dia]).sort((a, b) => a - b)
          : j.diasSemana.filter(d => d !== dia);
        if (!j.diasSemana.length) { APP().toast("Tiene que quedar al menos un día de trabajo"); el.checked = true; return; }
        of.jornada = j;
        R().todo(); APP().guardar();
        return;
      }

      case "cal-inicio": {
        of.periodos = P().conInicio(of.periodos, el.value);
        R().todo(); APP().guardar();
        return;
      }
      case "cal-n": {
        of.periodos = P().conN(of.periodos, el.value);
        PL.acciones.ajustarPeriodos(of, P().meses(of.periodos));
        R().todo(); APP().guardar();
        return;
      }
      case "periodo-rotulo": { R().todo(); return; }   /* al salir del campo, repintado completo */
      case "horas": {
        /* Al salir del campo se deja escrito el valor limpio en la unidad del modo. */
        const r = M().buscarLinea(of, el.dataset.id);
        if (!r) return;
        const i = N().num(el.dataset.mes);
        const h = N().num((r.linea.horas || {})["p" + i]);
        el.value = N().fmtCampo(el.dataset.modo === "pct" ? C().pctDeHoras(of, i, h) : h);
        return;
      }
      case "linea-perfil": {
        const r = M().buscarLinea(of, el.dataset.id);
        if (r) { r.linea.perfilId = el.value; R().todo(); APP().guardar(); }
        return;
      }
      case "hito-periodo": {
        const r = M().buscarEntregable(of, el.dataset.id, el.dataset.tarea || "", el.dataset.subtarea || "");
        if (!r) return;
        r.entregable.periodo = Math.round(N().acota(el.value, 0, P().meses(of.periodos) - 1));
        R().todo(); APP().guardar();
        return;
      }
      case "hito-responsable": {
        const r = M().buscarEntregable(of, el.dataset.id, el.dataset.tarea || "", el.dataset.subtarea || "");
        if (!r) return;
        r.entregable.responsablePerfilId = el.value;
        R().todo(); APP().guardar();
        return;
      }
      case "perfil-categoria": {
        const p = C().perfilPorId(APP().ESTADO.perfiles, el.dataset.id);
        if (p) { p.categoria = el.value; APP().guardar(); }
        return;
      }
      case "oferta-estado": { of.estado = M().esEstadoOferta(el.value) ? el.value : "borrador"; R().todo(); APP().guardar(); return; }
      case "oferta-impuesto-tipo": { of.impuestos.tipo = el.value; R().todo(); APP().guardar(); return; }
      case "oferta-impuesto-incluido": { of.impuestos.incluido = el.checked; R().todo(); APP().guardar(); return; }
      case "oferta-descuento-tipo": { of.descuento.tipo = el.value; R().todo(); APP().guardar(); return; }
      default: return;
    }
  }

  /** Plegar o desplegar una subtarea (estado guardado en el modelo). */
  function alPlegar(e) {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains("pa-sub")) return;
    const r = M().buscarSubtarea(o(), el.dataset.id);
    if (r) { r.sub._abierta = !!el.open; APP().guardar(); }
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
        if (reemplazar) {
          A().descargar("planifica-copia-anterior-" + N().hoyISO() + ".json", JSON.stringify(APP().ESTADO, null, 2), "application/json");
        }
      }
      const r = A().aplicarImportacion(APP().ESTADO, analisis, { reemplazar: reemplazar, aplicarMarca: reemplazar });
      R().todo(); APP().guardar();
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
      R().cabecera(); R().todo(); APP().guardar();
      APP().toast("Logo aplicado");
      el.value = "";
    };
    fr.readAsDataURL(f);
  }

  /* ---------- Montaje ---------- */

  function montar() {
    document.addEventListener("click", alClic);
    document.addEventListener("input", alEscribir);
    document.addEventListener("change", alCambiar);
    document.addEventListener("toggle", alPlegar, true);

    document.addEventListener("keydown", e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "s") { e.preventDefault(); A().exportarTodo(APP().ESTADO); APP().toast("Copia de seguridad descargada"); }
      if (k === "p") { APP().pestana("informe"); }
    });
  }

  PL.eventos = { montar: montar };
})(typeof window !== "undefined" ? window : globalThis);
