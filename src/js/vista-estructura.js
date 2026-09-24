"use strict";
/* =====================================================================
   Planifica v3 — VISTA: ESTRUCTURA
   Tareas → subtareas → líneas (perfil × mes) y, dentro de cada tarea, sus
   entregables. Edición en vivo; al teclear horas NO se repinta el árbol
   (se actualizan solo las celdas afectadas) para no perder el foco.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  function cabeceraTarea(pr, pf, t, i) {
    const V2 = V();
    return '<div class="pa-fila">' +
      '<input class="nz-input pa-crece2" data-campo="tarea-nombre" data-id="' + t.id + '" value="' + N().esc(t.nombre) + '" style="font-weight:700">' +
      '<span class="nz-badge nz-badge--neutral pa-chip-h">' + V2.hor(C().tareaHoras(t)) + "</span>" +
      '<span class="nz-badge nz-badge--brand pa-importe">' + V2.imp(C().tareaImporte(t, pf)) + "</span>" +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-sub" data-id="' + t.id + '" title="Añadir subtarea">＋ Subtarea</button>' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-entregable-tarea" data-id="' + t.id + '" title="Añadir entregable a esta tarea">＋ Entregable</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-tarea" data-id="' + t.id + '" title="Duplicar tarea">⧉</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-tarea" data-id="' + t.id + '" title="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-tarea" data-id="' + t.id + '" title="Bajar"' + (i === N().lista(pr.tareas).length - 1 ? " disabled" : "") + ">↓</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-tarea" data-id="' + t.id + '" title="Eliminar tarea">✕</button>' +
      "</div>";
  }

  function cabeceraSub(pr, pf, s, i, total) {
    const V2 = V();
    const abierta = !!s._abierta;
    return '<div class="pa-sub__cab">' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="toggle-sub" data-id="' + s.id + '" title="Plegar o desplegar">' + (abierta ? "▾" : "▸") + "</button>" +
      '<input class="nz-input pa-crece" data-campo="sub-nombre" data-id="' + s.id + '" value="' + N().esc(s.nombre) + '">' +
      '<span class="nz-badge nz-badge--neutral pa-chip-h">' + V2.hor(C().subHoras(s)) + "</span>" +
      '<span class="nz-badge nz-badge--brand pa-importe">' + V2.imp(C().subImporte(s, pf)) + "</span>" +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-linea" data-id="' + s.id + '" title="Añadir perfil a esta subtarea">＋ Perfil</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-sub" data-id="' + s.id + '" title="Duplicar subtarea">⧉</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-sub" data-id="' + s.id + '" title="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-sub" data-id="' + s.id + '" title="Bajar"' + (i === total - 1 ? " disabled" : "") + ">↓</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-sub" data-id="' + s.id + '" title="Eliminar subtarea">✕</button>' +
      "</div>";
  }

  function tablaLineas(pr, pf, s) {
    const V2 = V();
    const meses = C().mesesProyecto(pr);
    const conImportes = V2.hayImportes();
    const cabs = ["Perfil"].concat(Array.from({ length: meses }, (_, i) => N().etiquetaMes(pr.fechaInicio, i)))
      .concat(["Horas"]).concat(conImportes ? ["Importe"] : []).concat([""]);
    const cabecera = "<tr>" + cabs.map(c => '<th class="nz-table__right">' + c + "</th>").join("") + "</tr>";

    const filas = N().lista(s.lineas).map(l => {
      const perfilId = l.perfilId;
      return '<tr data-id="' + l.id + '">' +
        '<td><select class="nz-input nz-input--sm" data-campo="linea-perfil" data-id="' + l.id + '" style="min-width:170px">' +
          '<option value=""' + (!perfilId ? " selected" : "") + ' disabled>— Elige perfil —</option>' +
          N().lista(pf).map(p => '<option value="' + p.id + '"' + (p.id === perfilId ? " selected" : "") + ">" + N().esc(p.nombre) + (p.categoria && p.categoria !== "Otro" ? " · " + N().esc(p.categoria) : "") + "</option>").join("") +
        "</select></td>" +
        Array.from({ length: meses }, (_, i) =>
          '<td class="nz-table__num nz-table__right"><input class="nz-input nz-input--sm pa-input-num" type="number" step="0.5" min="0" ' +
          'value="' + (N().num((l.horas || {})["m" + i]) || "") + '" data-campo="horas" data-id="' + l.id + '" data-mes="' + i + '" placeholder="0"></td>').join("") +
        '<td class="nz-table__num nz-table__right nz-table__strong pa-celda-horas-h">' + V2.hor(C().lineaHoras(l)) + "</td>" +
        (conImportes ? '<td class="nz-table__num nz-table__right pa-importe pa-celda-importe">' + V2.imp(C().lineaImporte(l, pf)) + "</td>" : "") +
        '<td><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-linea" data-id="' + l.id + '" title="Quitar perfil">✕</button></td>' +
        "</tr>";
    }).join("");

    return '<div class="pa-tabla-grid"><table class="nz-table nz-table--compact"><thead>' + cabecera + "</thead><tbody>" + filas + "</tbody></table></div>";
  }

  function htmlTarea(pr, pf, t, i) {
    const V2 = V();
    const subs = N().lista(t.subtareas);
    const hitos = N().lista(t.entregables);
    const plan = E().planFacturacion(pr, pf).filter(h => h.tareaId === t.id);
    const dt = E().deTarea(pr, pf, t);

    let cuerpo = subs.map((s, si) => {
      const abierta = !!s._abierta;
      return '<div class="pa-sub" data-id="' + s.id + '">' + cabeceraSub(pr, pf, s, si, subs.length) +
        (abierta ? '<div class="pa-sub__cuerpo">' +
          (N().lista(s.lineas).length ? tablaLineas(pr, pf, s) : '<p class="pa-mini">Subtarea vacía: añade perfiles con «＋ Perfil».</p>') +
          "</div>" : "") + "</div>";
    }).join("");

    if (!subs.length) cuerpo = '<p class="pa-mini">Sin subtareas todavía. Añade la primera con «＋ Subtarea».</p>';

    /* Entregables de la tarea (siempre visibles, en modo edición compacta) */
    const bloqueHitos = hitos.length
      ? '<div class="pa-hitos"><p class="pa-mini pa-mini--fuerte">Entregables de esta tarea · ' + dt.hitos.length + " · " +
          (V2.hayImportes() ? V2.imp(dt.importe) + " · " : "") + dt.pct + ' % asignado' +
          (Math.abs(dt.pct - 100) > 0.005 ? ' <span class="nz-badge nz-badge--warning">¡ojo: ' + N().fmtPct(dt.pct) + ", no 100 %!</span>" : "") + "</p>" +
        plan.map(h => V2.htmlHito(pr, pf, h)).join("") +
        "</div>"
      : "";

    return '<article class="nz-article pa-tarea" data-id="' + t.id + '">' + cabeceraTarea(pr, pf, t, i) + bloqueHitos + cuerpo + "</article>";
  }

  function render(id) {
    const V2 = V(), APP2 = APP();
    const pr = APP2.pr();
    const cont = id || "pa-estructura";
    renderGuia();
    if (!pr) { V2.vaciar(cont); return; }
    const tareas = N().lista(pr.tareas);
    if (!tareas.length) {
      V2.escribir(cont, V2.vacio("🧱", "Esta oferta todavía no tiene tareas",
        "Empieza de cero o aplica una plantilla de tareas recurrentes (análisis → diseño → ejecución → entrega), con sus entregables ya repartidos.",
        '<button class="nz-btn nz-btn--primary nz-empty__action" data-acc="nueva-tarea">＋ Añadir tarea</button>' +
        '<button class="nz-btn nz-btn--soft nz-empty__action" data-acc="plantilla-dialogo">📚 Usar plantilla</button>'));
      return;
    }
    V2.escribir(cont, tareas.map((t, i) => htmlTarea(pr, APP2.pf(), t, i)).join(""));
  }

  /** Guía de bienvenida (solo con la oferta de ejemplo). */
  function renderGuia() {
    const V2 = V(), APP2 = APP();
    const pr = APP2.pr();
    const cont = "pa-guia";
    if (pr && pr.guia && !APP2.ESTADO.guiaVista) {
      V2.escribir(cont, V2.aviso("tip",
        "<strong>Guía rápida (2 minutos):</strong><br>" +
        "1️⃣ Mira el ejemplo de abajo: tareas → subtareas → perfiles con horas por mes, y los <strong>entregables</strong> de cada tarea con su % de facturación.<br>" +
        "2️⃣ Edita cualquier dato: todo recalcula al instante. Añade o borra con los botones ＋ y ✕.<br>" +
        "3️⃣ En <em>Entregables</em> ves todos los hitos juntos; en <em>Escenarios</em>, guardas alternativas y versiones de la oferta.<br>" +
        "4️⃣ En <em>Ajustes</em> pones tu marca, tu cliente y los impuestos. En <em>Informe</em> lo sacas en PDF o CSV." +
        '<br><button class="nz-btn nz-btn--primary nz-btn--sm" style="margin-top:var(--nz-space-2)" data-acc="cerrar-guia">¡Entendido, empezar!</button>'));
    } else {
      V2.vaciar(cont);
    }
  }

  /** Repintado rápido tras teclear horas: solo las celdas afectadas de su fila. */
  function actualizarFilaHoras(pr, pf, linea, tr) {
    if (!tr) return;
    const V2 = V();
    const celdaH = tr.querySelector(".pa-celda-horas-h");
    if (celdaH) celdaH.innerHTML = V2.hor(C().lineaHoras(linea));
    const celdaI = tr.querySelector(".pa-celda-importe");
    if (celdaI) celdaI.textContent = V2.imp(C().lineaImporte(linea, pf));

    /* Chips de la subtarea y de la tarea contenedoras */
    const divSub = tr.closest(".pa-sub");
    if (divSub) {
      const r = PL.modelo.buscarSub(pr, divSub.dataset.id);
      if (r) {
        const ch = divSub.querySelector(".pa-chip-h"), ci = divSub.querySelector(".pa-importe");
        if (ch) ch.textContent = V2.hor(C().subHoras(r.sub));
        if (ci) ci.textContent = V2.imp(C().subImporte(r.sub, pf));
      }
      const art = divSub.closest(".pa-tarea");
      if (art) {
        const t = PL.modelo.buscarTarea(pr, art.dataset.id);
        if (t) {
          const ch2 = art.querySelector(".pa-chip-h"), ci2 = art.querySelector(".pa-importe");
          if (ch2) ch2.textContent = V2.hor(C().tareaHoras(t));
          if (ci2) ci2.textContent = V2.imp(C().tareaImporte(t, pf));
        }
      }
    }
  }

  PL.vistas.estructura = { render: render, renderGuia: renderGuia, actualizarFilaHoras: actualizarFilaHoras };
})(typeof window !== "undefined" ? window : globalThis);
