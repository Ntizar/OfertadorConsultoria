"use strict";
/* =====================================================================
   Planifica v4 — VISTA: TRABAJO
   La pantalla principal, en tres bloques:
     1. Calendario: inicio, duración, zoom y rótulos (todo editable aquí).
     2. Gantt: la vista de pájaro del esfuerzo y los entregables.
     3. Editor: tareas → entregables → subtareas → líneas (perfil × periodo).

   Cualquier cambio se refleja en los tres bloques (todo conectado).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /* ---------- 1. Calendario ---------- */

  function calendario(o) {
    const V2 = V();
    const per = o.periodos;
    const editados = P().cuantasEditadas(per);
    return '<div class="pa-calendario">' +
      '<span class="pa-calendario__dato"><label class="pa-mini" for="cal-inicio">Empieza en</label>' +
        '<input class="nz-input nz-input--sm pa-input-fecha" type="month" id="cal-inicio" data-campo="cal-inicio" value="' + N().esc(per.inicio) + '"></span>' +
      '<span class="pa-calendario__dato"><label class="pa-mini" for="cal-n">Duración</label>' +
        '<input class="nz-input nz-input--sm pa-input-num" type="number" min="1" max="60" id="cal-n" data-campo="cal-n" value="' + per.n + '">' +
        '<span class="pa-mini">meses</span></span>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="cal-antes" title="Retrasar el calendario un mes">◀</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="cal-despues" title="Adelantar el calendario un mes">▶</button>' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="cal-zoom" title="Ver por meses o por trimestres">' +
        (per.zoom === "mes" ? "🗓 Ver por trimestres" : "🗓 Ver por meses") + "</button>" +
      (editados ? '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="cal-rotulos-auto" title="Devolver los rótulos automáticos">↺ ' + editados + ' rótulo(s)</button>' : "") +
      '<span class="pa-espacio"></span>' +
      '<span class="pa-calendario__duracion pa-ahora">' + N().esc(P().duracionLegible(per)) + "</span>" +
      '<span class="pa-mini pa-ahora">' + C().ofertaHoras(o).toLocaleString("es-ES") + " h" +
        (V2.verImportes() ? " · " + V2.imp(C().importeOferta(o, APP().pf())) : "") + "</span>" +
      "</div>";
  }

  /* ---------- 3. Editor del esfuerzo ---------- */

  function cabeceraTarea(o, pf, t, i) {
    const V2 = V();
    return '<div class="pa-tarea__cab">' +
      '<input class="nz-input pa-crece2" data-campo="tarea-nombre" data-id="' + t.id + '" value="' + N().esc(t.nombre) + '" style="font-weight:700">' +
      '<span class="nz-badge nz-badge--neutral pa-ahora">' + V2.hor(C().tareaHoras(t)) + "</span>" +
      '<span class="nz-badge nz-badge--brand pa-importe pa-ahora">' + V2.imp(C().tareaImporte(t, pf)) + "</span>" +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-sub" data-id="' + t.id + '" title="Añadir subtarea">＋ Subtarea</button>' +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-entregable-tarea" data-id="' + t.id + '" title="Añadir entregable a esta tarea">＋ Entregable</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-tarea" data-id="' + t.id + '" title="Duplicar tarea">⧉</button>' +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-tarea" data-id="' + t.id + '" title="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-tarea" data-id="' + t.id + '" title="Bajar"' + (i === N().lista(o.tareas).length - 1 ? " disabled" : "") + ">↓</button>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-tarea" data-id="' + t.id + '" title="Eliminar tarea">✕</button>' +
      "</div>";
  }

  function bloqueHitos(o, pf, t) {
    const V2 = V();
    const hitos = N().lista(t.entregables);
    if (!hitos.length) {
      return '<p class="pa-mini">Sin entregables en esta tarea: añade el primero con «＋ Entregable».</p>';
    }
    const horas = N().suma(hitos, e => N().num(e.horas));
    return '<p class="pa-mini pa-mini--fuerte">Entregables de esta tarea · ' + hitos.length +
      (horas ? " · " + V2.hor(horas) + " estimadas" : "") + "</p>" +
      E().deTarea(o, t).map(e => V2.htmlEntregable(o, pf, e, "tarea", t.id)).join("");
  }

  function tablaLineas(o, pf, s) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const conImp = V2.verImportes();
    const cabecera = "<tr><th>Perfil</th>" + cols.map(c => '<th class="nz-table__right">' + N().esc(c.etiqueta) + "</th>").join("") +
      '<th class="nz-table__right">Horas</th>' + (conImp ? '<th class="nz-table__right pa-col-importe">Importe</th>' : "") + "<th></th></tr>";

    const filas = N().lista(s.lineas).map(l =>
      '<tr data-id="' + l.id + '">' +
        '<td><select class="nz-input nz-input--sm" data-campo="linea-perfil" data-id="' + l.id + '" aria-label="Perfil" style="min-width:150px">' +
          '<option value=""' + (!l.perfilId ? " selected" : "") + ' disabled>— Elige perfil —</option>' +
          N().lista(pf).map(p => '<option value="' + p.id + '"' + (p.id === l.perfilId ? " selected" : "") + ">" + N().esc(p.nombre) + "</option>").join("") +
        "</select></td>" +
        cols.map(c => {
          const idx = c.periodos[0];
          const valor = c.periodos.reduce((s2, i) => s2 + N().num(((l.horas) || {})["p" + i]), 0);
          if (c.periodos.length === 1) {
            return '<td class="nz-table__num nz-table__right"><input class="nz-input nz-input--sm pa-input-num" type="number" min="0" step="0.5" ' +
              'value="' + (valor || "") + '" placeholder="0" data-campo="horas" data-id="' + l.id + '" data-mes="' + idx + '" ' +
              'aria-label="Horas en ' + N().esc(c.etiqueta) + '"></td>';
          }
          return '<td class="nz-table__num nz-table__right" title="Suma del trimestre"><span class="pa-mini">' + (valor || "·") + "</span></td>";
        }).join("") +
        '<td class="nz-table__num nz-table__right pa-celda-horas-h"><strong>' + V2.hor(C().lineaHoras(l)) + "</strong></td>" +
        (conImp ? '<td class="nz-table__num nz-table__right pa-importe pa-celda-importe">' + V2.imp(C().lineaImporte(l, pf)) + "</td>" : "") +
        '<td><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-linea" data-id="' + l.id + '" title="Quitar perfil">✕</button></td>' +
      "</tr>").join("");

    return '<div class="pa-tabla-horas"><table class="nz-table nz-table--compact"><thead>' + cabecera + "</thead><tbody>" +
      (filas || '<tr><td colspan="' + (cols.length + 3) + '"><span class="pa-mini">Sin perfiles: añade el primero con «＋ Perfil».</span></td></tr>') +
      "</tbody></table></div>";
  }

  function subtareas(o, pf, t) {
    const V2 = V();
    const subs = N().lista(t.subtareas);
    if (!subs.length) return '<p class="pa-mini">Sin subtareas todavía. Añade la primera con «＋ Subtarea».</p>';
    return subs.map((s, si) =>
      '<details class="pa-sub" data-id="' + s.id + '"' + (s._abierta ? " open" : "") + ">" +
        '<summary class="pa-sub__cab">' +
          '<input class="nz-input pa-crece" data-campo="sub-nombre" data-id="' + s.id + '" value="' + N().esc(s.nombre) + '">' +
          '<span class="nz-badge nz-badge--neutral pa-ahora">' + V2.hor(C().subtareaHoras(s)) + "</span>" +
          '<span class="nz-badge nz-badge--brand pa-importe pa-ahora">' + V2.imp(C().subtareaImporte(s, pf)) + "</span>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-linea" data-id="' + s.id + '" title="Añadir perfil a esta subtarea">＋ Perfil</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-sub" data-id="' + s.id + '" title="Duplicar subtarea">⧉</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-sub" data-id="' + s.id + '" title="Subir"' + (si === 0 ? " disabled" : "") + ">↑</button>" +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-sub" data-id="' + s.id + '" title="Bajar"' + (si === subs.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-sub" data-id="' + s.id + '" title="Eliminar subtarea">✕</button>' +
        "</summary>" +
        '<div class="pa-sub__cuerpo">' + tablaLineas(o, pf, s) + "</div>" +
      "</details>").join("");
  }

  function editor(o, pf) {
    const V2 = V();
    const tareas = N().lista(o.tareas);
    if (!tareas.length) {
      return V2.vacio("🧱", "Esta oferta todavía no tiene tareas",
        "Empieza de cero o aplica una plantilla de tareas recurrentes: trae las tareas, sus subtareas y sus entregables ya repartidos por el calendario.",
        '<button class="nz-btn nz-btn--primary nz-empty__action" data-acc="nueva-tarea">＋ Añadir tarea</button>' +
        '<button class="nz-btn nz-btn--soft nz-empty__action" data-acc="plantilla-toggle">📚 Usar plantilla</button>');
    }
    /* La tarjeta de cada tarea lleva la clase pa-tarea: la usan el CSS y los arneses. */
    return tareas.map((t, i) =>
      '<article class="nz-article pa-tarea">' + cabeceraTarea(o, pf, t, i) +
      bloqueHitos(o, pf, t) + subtareas(o, pf, t) + "</article>"
    ).join("");
  }

  /** Panel de plantillas, en línea (sin ventanas emergentes). */
  function plantillas(o) {
    const V2 = V();
    if (!APP().ui.plantillasAbiertas) return "";
    const lista = N().lista(APP().ESTADO.plantillas);
    return V2.articulo("Plantillas de tareas",
      '<div class="pa-fila" style="margin-bottom:var(--nz-space-2)">' +
        '<input class="nz-input pa-crece" id="plantilla-nombre" placeholder="Nombre de la nueva plantilla (se guarda la estructura actual)">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="plantilla-guardar">💾 Guardar la estructura actual</button>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="plantilla-toggle">✕ Cerrar</button>' +
      "</div>" +
      (lista.map(pl =>
        '<div class="pa-dato">' +
          '<span class="pa-crece2"><strong>' + N().esc(pl.nombre) + "</strong>" + (pl.esDefecto ? ' <span class="nz-badge nz-badge--neutral">por defecto</span>' : "") +
          '<br><span class="pa-mini">' + N().esc(pl.desc || "") + " · " + N().lista(pl.tareas).length + " tareas · " +
          N().suma(pl.tareas, t => N().lista(t.entregables).length) + " entregables</span></span>" +
          '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="plantilla-aplicar" data-id="' + pl.id + '" data-modo="anadir">Añadir</button>' +
          (N().lista(o.tareas).length ? '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="plantilla-aplicar" data-id="' + pl.id + '" data-modo="reemplazar">Reemplazar</button>' : "") +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="plantilla-borrar" data-id="' + pl.id + '" title="Eliminar plantilla">✕</button>' +
        "</div>").join("") || '<p class="pa-mini">No hay plantillas guardadas.</p>'));
  }

  /* ---------- Render ---------- */

  function renderGuia() {
    const V2 = V(), o = APP().pr();
    if (!o) return;
    V2.escribir("tr-guia", (o.guia && !APP().ESTADO.guiaVista) ? V2.aviso("tip",
      "<strong>Cómo funciona:</strong> arriba eliges el <em>calendario</em> (inicio, duración y nombre de cada mes, que puedes renombrar haciendo clic). " +
      "En medio tienes el <em>diagrama</em>: las barras son meses con esfuerzo y los rombos ◆ son entregables. " +
      "Abajo editas tareas, entregables, subtareas y horas por perfil: todo se recalcula al instante en las tres zonas y en el informe." +
      '<br><button class="nz-btn nz-btn--primary nz-btn--sm" style="margin-top:var(--nz-space-2)" data-acc="cerrar-guia">¡Entendido, empezar!</button>') : "");
  }

  /** Cada pieza se puede repintar por separado: así se actualiza el calendario y el
      editor sin tocar el Gantt cuando se está renombrando un periodo. */
  function renderCalendario() {
    const V2 = V(), o = APP().pr();
    if (!o) { V2.vaciar("tr-calendario"); return; }
    V2.escribir("tr-calendario", calendario(o));
  }

  function renderGantt() {
    const V2 = V(), o = APP().pr();
    if (!o) { V2.vaciar("tr-gantt"); return; }
    V2.escribir("tr-gantt", PL.gantt.html(o, APP().pf()));
  }

  function renderEditor() {
    const V2 = V(), o = APP().pr();
    if (!o) { V2.vaciar("tr-editor"); return; }
    const pf = APP().pf();
    V2.escribir("tr-editor", plantillas(o) +
      V2.articulo("Estructura de la oferta", editor(o, pf),
        '<div class="pa-fila" style="margin-bottom:var(--nz-space-3)">' +
          '<button class="nz-btn nz-btn--primary" data-acc="nueva-tarea">＋ Añadir tarea</button>' +
          '<button class="nz-btn nz-btn--soft" data-acc="nuevo-entregable-oferta">＋ Entregable de la oferta</button>' +
          '<button class="nz-btn nz-btn--soft" data-acc="plantilla-toggle">📚 Plantillas</button>' +
          '<span class="pa-espacio"></span>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="abrir-todo">Desplegar todo</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="cerrar-todo">Plegar todo</button>' +
        "</div>"));
  }

  /** Tras teclear horas: se actualiza la fila en el sitio y se repinta el resto. */
  function actualizarFilaHoras(o, pf, linea, tr) {
    if (!tr) return;
    const V2 = V();
    const celdaH = tr.querySelector(".pa-celda-horas-h");
    if (celdaH) celdaH.innerHTML = "<strong>" + V2.hor(C().lineaHoras(linea)) + "</strong>";
    const celdaI = tr.querySelector(".pa-celda-importe");
    if (celdaI) celdaI.textContent = V2.imp(C().lineaImporte(linea, pf));

    const det = tr.closest(".pa-sub");
    if (det) {
      const r = M().buscarSubtarea(o, det.dataset.id);
      if (r) {
        const chips = det.querySelectorAll("summary .nz-badge");
        if (chips[0]) chips[0].textContent = V2.hor(C().subtareaHoras(r.sub));
        if (chips[1]) chips[1].textContent = V2.imp(C().subtareaImporte(r.sub, pf));
      }
    }
    /* Chips de la tarea contenedora: el nombre de la tarea lleva su id. */
    const tareaEl = tr.closest(".nz-article");
    if (tareaEl) {
      const inp = tareaEl.querySelector('[data-campo="tarea-nombre"]');
      const t = inp ? M().buscarTarea(o, inp.dataset.id) : null;
      if (t) {
        const chips = tareaEl.querySelectorAll(".pa-tarea__cab .nz-badge");
        if (chips[0]) chips[0].textContent = V2.hor(C().tareaHoras(t));
        if (chips[1]) chips[1].textContent = V2.imp(C().tareaImporte(t, pf));
      }
    }
  }

  /** Repintado completo de la pestaña de trabajo. */
  function render() {
    const V2 = V(), o = APP().pr();
    if (!o) { ["tr-guia", "tr-calendario", "tr-gantt", "tr-editor"].forEach(id => V2.vaciar(id)); return; }
    renderGuia(); renderCalendario(); renderGantt(); renderEditor();
  }

  PL.vistas.trabajo = {
    render: render, renderGuia: renderGuia, renderCalendario: renderCalendario,
    renderGantt: renderGantt, renderEditor: renderEditor,
    actualizarFilaHoras: actualizarFilaHoras, calendario: calendario
  };
})(typeof window !== "undefined" ? window : globalThis);
