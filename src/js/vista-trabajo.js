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
    const enPct = APP().modoHoras() === "pct";
    const semanal = P().normalizar(per).unidad === "semana";
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
      '<span class="pa-calendario__dato"><span class="pa-mini">Planificar por</span>' +
        '<button class="nz-btn nz-btn--sm ' + (semanal ? "nz-btn--soft" : "nz-btn--primary") + '" data-acc="cal-unidad" data-unidad="mes" title="El calendario va por meses">meses</button>' +
        '<button class="nz-btn nz-btn--sm ' + (semanal ? "nz-btn--primary" : "nz-btn--soft") + '" data-acc="cal-unidad" data-unidad="semana" title="El calendario va por semanas (40 h por semana completa)">semanas</button></span>' +
      '<span class="pa-calendario__dato"><span class="pa-mini">Las horas se teclean en</span>' +
        '<button class="nz-btn nz-btn--sm ' + (enPct ? "nz-btn--primary" : "nz-btn--soft") + '" data-acc="modo-horas" data-modo="pct" title="Teclear dedicación: 50 = media jornada ese mes">% jornada</button>' +
        '<button class="nz-btn nz-btn--sm ' + (enPct ? "nz-btn--soft" : "nz-btn--primary") + '" data-acc="modo-horas" data-modo="h" title="Teclear horas directamente">horas</button></span>' +
      '<span class="pa-espacio"></span>' +
      '<span class="pa-calendario__duracion pa-ahora">' + N().esc(P().duracionLegibleUnidad(per)) + "</span>" +
      '<span class="pa-mini pa-ahora">' + C().ofertaHoras(o).toLocaleString("es-ES") + " h" +
        (V2.verImportes() ? " · " + V2.imp(C().importeOferta(o, APP().pf())) : "") + "</span>" +
      "</div>";
  }

  /* ---------- 3. Editor del esfuerzo ---------- */

  function cabeceraTarea(o, pf, t, i) {
    const V2 = V();
    return '<div class="pa-tarea__cab">' +
      '<button class="pa-chevron" data-acc="toggle-tarea" data-id="' + t.id + '" aria-expanded="' + (t._abierta ? "true" : "false") + '"' +
        ' title="' + (t._abierta ? "Plegar esta tarea" : "Desplegar esta tarea") + '">' + (t._abierta ? "▾" : "▸") + "</button>" +
      '<span class="pa-tono-punto" title="Color de esta tarea"></span>' +
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
    return '<p class="pa-mini pa-mini--fuerte">Entregables de la TAREA completa · ' + hitos.length +
      ' · <span class="pa-mini">las horas las marcan las subtareas</span></p>' +
      E().deTarea(o, t).map(e => V2.htmlEntregable(o, pf, e, "tarea", t.id)).join("");
  }

  /** Horas de cada perfil y mes. Se teclean en % de jornada o en horas (según el
      modo), el equivalente va siempre debajo y se marca en rojo quien pasa del
      100 % —nadie puede estar más de una jornada completa a la vez. */
  /** Entregables de una subtarea: aquí es lo habitual, se entrega al cerrar ese trabajo. */
  function hitsDeSubtarea(o, pf, s) {
    const V2 = V();
    const lista = E().deSubtarea(o, s);
    const hHoras = N().suma(lista, e => N().num(e.horas));
    return '<div class="pa-hitos pa-hitos--sub">' +
      (lista.length
        ? '<p class="pa-mini pa-mini--fuerte">Se entrega aquí · ' + lista.length + "" + "</p>" +
          lista.map(e => V2.htmlEntregable(o, pf, e, "subtarea", "", s.id)).join("")
        : "") +
      '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nuevo-entregable-sub" data-id="' + s.id + '">＋ Entregable de esta subtarea</button>' +
      "</div>";
  }


  function tablaLineas(o, pf, s) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const conImp = V2.verImportes();
    const enPct = APP().modoHoras() === "pct";
    const unidad = enPct ? "%" : "h";

    /* Se precalcula UNA vez lo que necesitan todas las celdas: la matriz de horas
       por perfil y mes y las horas laborables de cada mes. Consultarlo celda a celda
       multiplicaba el tiempo de repintado con ofertas grandes. */
    const mPerfil = C().horasPerfilPeriodo(o);
    const nMeses = P().meses(o.periodos);
    const labDe = [];
    for (let i = 0; i < nMeses; i++) labDe[i] = C().horasLaborablesMes(o, i);
    const ocupadoDe = (perfilId, idx) => (perfilId && mPerfil[perfilId] ? N().num(mPerfil[perfilId][idx]) : 0);

    const cabecera = "<tr><th>Perfil</th>" +
      cols.map(c => {
        const lab = c.periodos.reduce((s2, k) => s2 + labDe[k], 0);
        return '<th class="nz-table__right" title="' + Math.round(lab) + ' h laborables">' + N().esc(c.etiqueta) +
          '<br><span class="pa-mini">' + unidad + "</span></th>";
      }).join("") +
      '<th class="nz-table__right">Horas</th>' +
      (conImp ? '<th class="nz-table__right pa-col-importe">Importe</th>' : "") + "<th></th></tr>";

    const filas = N().lista(s.lineas).map(l => {
      let exceso = false;
      const celdas = cols.map(c => {
        const idx = c.periodos[0];
        const h = c.periodos.reduce((s2, i) => s2 + N().num(((l.horas) || {})["p" + i]), 0);
        const lab = c.periodos.reduce((s2, i) => s2 + labDe[i], 0);
        const pct = lab > 0 ? N().r2(h / lab * 100) : 0;
        const pctMax = c.periodos.reduce((mx, i) => {
          const ocupado = ocupadoDe(l.perfilId, i);
          return Math.max(mx, labDe[i] > 0 ? N().r2(ocupado / labDe[i] * 100) : 0);
        }, 0);
        const pasado = !!(l.perfilId && pctMax > 100.005);
        if (pasado) exceso = true;
        /* Libre = lo laborable del mes menos lo que ya tienen OTRAS líneas de ese
           perfil (la línea que se edita no se descuenta a sí misma). */
        /* Hueco real del perfil en ese periodo (contando esta línea) y techo de la línea. */
        const ocupadoCelda = ocupadoDe(l.perfilId, idx);
        const libre = l.perfilId ? Math.max(0, N().r2(labDe[idx] - ocupadoCelda)) : labDe[idx];
        const librePct = labDe[idx] > 0 ? N().r2(libre / labDe[idx] * 100) : 0;
        /* Lo que le queda libre al perfil ese mes, dicho ANTES de escribir: va en el
           hueco del campo y de fondo se ve la parte ya ocupada. */
        const sinHueco = l.perfilId && libre <= 0.5;
        const dicho = enPct ? N().fmtCampo(librePct) + " % libres" : N().fmtCampo(libre) + " h libres";
        const ayuda = V2.hor(h) + " · " + N().fmtNum(pct) + " % de " + Math.round(lab) + " h laborables" +
          (l.perfilId ? " · " + dicho : "") + (pasado ? " — MÁS DEL 100 %" : "");
        const eq = h > 0 ? (enPct ? V2.hor(h) : N().fmtNum(pct) + " %") : "";
        const clase = "nz-table__num nz-table__right pa-celda-horas" +
          (pasado ? " pa-celda--exceso" : "") + (sinHueco ? " pa-celda--lleno" : "");
        const eti = ' data-etiqueta="' + N().esc(c.etiqueta) + '" title="' + N().esc(ayuda) + '"';
        /* La sombra: la parte de la jornada de ese perfil que YA está comprometida. */
        const sombra = (l.perfilId && pctMax > 0)
          ? '<span class="pa-celda__sombra" aria-hidden="true" style="width:' +
            N().fmtCampo(Math.min(100, pctMax), 1).replace(",", ".") + '%"></span>'
          : "";
        const marcador = sombra ? '<span class="pa-celda__marca">' + N().fmtNum(pctMax, 0) + "%</span>" : "";
        if (c.periodos.length === 1) {
          return "<td class=\"" + clase + "\"" + eti + ">" + sombra + marcador +
            (enPct
              /* De 5 en 5 y con tope 100: las flechas suben/bajan de cinco en cinco y no
                 se puede pedir más de una jornada. El hueco libre se ve en el propio campo. */
              ? '<input class="nz-input nz-input--sm pa-input-pct" type="number" inputmode="numeric" ' +
                'min="0" max="100" step="5" value="' + (h > 0 ? N().fmtCampo(pct, 1) : "") +
                '" placeholder="' + (l.perfilId ? (sinHueco ? "sin hueco" : "0") : "%") +
                '" data-campo="horas" data-modo="pct" data-id="' + l.id + '" data-mes="' + idx + '" ' +
                'aria-label="' + N().esc("Dedicación en " + c.etiqueta) + '" title="' + N().esc(dicho) + '">'
              : '<input class="nz-input nz-input--sm pa-input-horas" type="text" inputmode="decimal" autocomplete="off" ' +
                'value="' + (h > 0 ? N().fmtCampo(h) : "") + '" placeholder="' + (l.perfilId ? (sinHueco ? "sin hueco" : "0") : "0") +
                '" data-campo="horas" data-modo="h" data-id="' + l.id + '" data-mes="' + idx + '" ' +
                'aria-label="' + N().esc("Horas en " + c.etiqueta) + '" title="' + N().esc(dicho) + '">') +
            '<span class="pa-celda__eq">' + eq + "</span></td>";
            '<span class="pa-celda__eq">' + eq + "</span></td>";
        }
        return "<td class=\"" + clase + "\"" + eti + ">" + (h > 0 ? "<span>" + N().fmtNum(pct) + " %</span>" : "") + "</td>";
      }).join("");

      return '<tr data-id="' + l.id + '"' + (exceso ? ' class="pa-fila--exceso"' : "") + ">" +
        '<td data-etiqueta="Perfil"><select class="nz-input nz-input--sm pa-select-perfil" data-campo="linea-perfil" data-id="' + l.id + '" aria-label="Perfil">' +
          '<option value=""' + (!l.perfilId ? " selected" : "") + ' disabled>— Elige perfil —</option>' +
          N().lista(pf).map(p => '<option value="' + p.id + '"' + (p.id === l.perfilId ? " selected" : "") + ">" + N().esc(p.nombre) + "</option>").join("") +
        "</select></td>" + celdas +
        '<td class="nz-table__num nz-table__right pa-celda-horas-h" data-etiqueta="Total"><strong>' + V2.hor(C().lineaHoras(l)) + "</strong></td>" +
        (conImp ? '<td class="nz-table__num nz-table__right pa-importe pa-celda-importe" data-etiqueta="Importe">' + V2.imp(C().lineaImporte(l, pf)) + "</td>" : "") +
        '<td data-etiqueta=""><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-linea" data-id="' + l.id + '" title="Quitar perfil">✕</button></td>' +
      "</tr>";
    }).join("");

    return '<div class="pa-tabla-horas"><table class="nz-table nz-table--compact"><thead>' + cabecera + "</thead><tbody>" +
      (filas || '<tr><td colspan="' + (cols.length + 3) + '"><span class="pa-mini">Sin perfiles: añade el primero con «＋ Perfil».</span></td></tr>') +
      "</tbody></table>" +
      (enPct ? '<p class="pa-mini">Escribes <strong>dedicación</strong>: 50 = media jornada ese mes. Al lado tienes las horas que salen con la jornada de ' +
        N().fmtNum(C().jornada(o).horasDia) + " h/día.</p>" : "") + "</div>";
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
        '<div class="pa-sub__cuerpo">' +
          hitsDeSubtarea(o, pf, s) +
          tablaLineas(o, pf, s) +
        "</div>" +
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
      '<article class="nz-article pa-tarea' + V2.claseTono(o, t.id) + (t._abierta ? "" : " pa-tarea--plegada") + '">' +
        cabeceraTarea(o, pf, t, i) +
        '<div class="pa-tarea__cuerpo">' + bloqueHitos(o, pf, t) + subtareas(o, pf, t) + "</div>" +
      "</article>"
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
      "<strong>Cómo funciona:</strong> arriba está el <em>calendario</em> —por <em>meses</em> o por <em>semanas</em>— con el inicio, la duración y el nombre de cada periodo (haz clic en una columna para renombrarla). " +
      "En medio, el <em>diagrama</em>: las barras son periodos con esfuerzo, los rombos ◆ los entregables y cada tarea tiene su color. " +
      "Abajo trabajas en cuatro pasos: tareas y subtareas, sus entregables, los perfiles y las horas. " +
      "Las horas se ponen en <em>dedicación</em> (50 = media jornada) y no dejan pasar del 100 %." +
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

  /** Aviso de oferta: perfiles por encima del 100 % de jornada en algún mes. */
  function avisoExcesos(o, pf) {
    const exc = C().excesosPerfil(o);
    if (!exc.length) return "";
    const detalle = exc.slice(0, 5).map(e => {
      const p = C().perfilPorId(pf, e.perfilId);
      return N().esc(p ? p.nombre : "?") + " en " + N().esc(P().mesCorto(o.periodos, e.periodo)) +
        ": " + V().hor(e.horas) + " (" + N().fmtNum(e.pct) + " %)";
    }).join(" · ");
    return V().aviso("warning", "<strong>Alguien pasa del 100 % de jornada.</strong> " + detalle +
      (exc.length > 5 ? " …" : "") +
      ' <span class="pa-mini">Nadie puede estar más de una jornada completa el mismo mes: reparte esas horas con otro perfil o muévelas de mes.</span>');
  }

  /** Los cuatro pasos del trabajo, en el orden en que se hace una oferta:
      tareas → entregables → perfiles → horas. Con el avance de cada uno a la vista. */
  function pasos(o, pf) {
    const t = N().lista(o.tareas);
    const nSub = t.reduce((s, x) => s + N().lista(x.subtareas).length, 0);
    const nEnt = E().todos(o).length;
    const nPerf = Object.keys(C().horasPorPerfil(o)).length;
    const h = C().ofertaHoras(o);
    const paso = (n, titulo, detalle, hecho) =>
      '<div class="pa-paso' + (hecho ? " pa-paso--hecho" : "") + '">' +
        '<span class="pa-paso__num">' + n + "</span>" +
        '<span class="pa-paso__cuerpo"><strong>' + titulo + "</strong>" +
        '<span class="pa-mini">' + detalle + "</span></span>" +
        (hecho ? '<span class="pa-paso__ok" aria-hidden="true">✓</span>' : "") +
      "</div>";
    return '<div class="pa-pasos">' +
      paso(1, "Tareas y subtareas", t.length + " tareas · " + nSub + " subtareas", t.length > 0) +
      paso(2, "Entregables", nEnt + " entregables", nEnt > 0) +
      paso(3, "Perfiles del equipo", nPerf + " en uso · " + N().lista(pf).length + " en el catálogo", nPerf > 0) +
      paso(4, "Horas por perfil y mes", V().hor(h) + " · " + P().duracionLegible(o.periodos), h > 0) +
      "</div>";
  }

  function renderEditor() {
    const V2 = V(), o = APP().pr();
    if (!o) { V2.vaciar("tr-editor"); return; }
    const pf = APP().pf();
    V2.escribir("tr-editor", avisoExcesos(o, pf) + pasos(o, pf) + plantillas(o) +
      V2.articulo("Estructura de la oferta", editor(o, pf),
        '<div class="pa-fila" style="margin-bottom:var(--nz-space-3)">' +
          '<button class="nz-btn nz-btn--primary" data-acc="nueva-tarea">＋ Añadir tarea</button>' +
          '<button class="nz-btn nz-btn--soft" data-acc="plantilla-toggle">📚 Plantillas</button>' +
          '<span class="pa-espacio"></span>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="abrir-todo" title="Desplegar tareas, subtareas y horas">⇕ Desplegar todo</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="solo-tareas" title="Dejar sólo las tareas a la vista">▸ Sólo tareas</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="cerrar-todo" title="Plegar las subtareas">⇕ Plegar subtareas</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="plegar-tareas" title="Plegar también las tareas">▸▸ Plegar tareas</button>' +
        "</div>"));
  }

  let T_EXCESOS = null;

  /* ---------- Refresco de las horas, sin perder el foco ----------
     Todo lo que se ve en una celda de horas (el número, su equivalente, la sombra
     de ocupación del perfil, lo que le queda libre y el aviso de lleno) depende de
     TODAS las líneas de ese perfil. Por eso, al teclear, no basta con repintar la
     celda: hay que refrescar la tabla entera. Se hace nodo a nodo (no se regenera el
     HTML), así el campo que se está escribiendo no se toca y el foco no se pierde. */

  /** Índice rápido: horas por perfil y periodo + horas laborables + líneas por id. */
  function indiceHoras(o) {
    const mPerfil = C().horasPerfilPeriodo(o);
    const nMeses = P().meses(o.periodos);
    const labDe = [];
    for (let i = 0; i < nMeses; i++) labDe[i] = C().horasLaborablesMes(o, i);
    const lineas = {};
    N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      lineas[l.id] = { linea: l, sub: s, tarea: t };
    })));
    return {
      mPerfil: mPerfil, labDe: labDe, lineas: lineas, nMeses: nMeses,
      ocupado: (perfilId, i) => (perfilId && mPerfil[perfilId] ? N().num(mPerfil[perfilId][i]) : 0)
    };
  }

  /** Pinta una celda de horas con todo lo que le corresponde. */
  function pintarCeldaHoras(td, entrada, idx, ind, enPct) {
    const V2 = V();
    const linea = ind.lineas[entrada.dataset.id];
    const l = linea ? linea.linea : null;
    const h = l ? N().num((l.horas || {})["p" + idx]) : 0;
    const perfilId = l ? l.perfilId : "";
    const lab = ind.labDe[idx] || 0;
    const pctLinea = lab > 0 ? N().r2(h / lab * 100) : 0;
    const ocupado = ind.ocupado(perfilId, idx);
    const pctPerfil = lab > 0 ? N().r2(ocupado / lab * 100) : 0;
    /* HUECO = lo laborable del mes menos TODO lo que ese perfil tiene ya asignado,
       incluida esta misma línea. Antes se descontaba a sí misma y decía «100 %
       libres» con el perfil ya lleno: eso era lo que no cuadraba. */
    const hueco = perfilId ? Math.max(0, N().r2(lab - ocupado)) : lab;
    const huecoPct = lab > 0 ? N().r2(hueco / lab * 100) : 0;
    /* TECHO de esta línea: lo que puede llegar a valer contando lo que ya ocupa. */
    const techo = perfilId ? Math.max(0, N().r2(lab - ocupado + h)) : lab;
    const sinHueco = !!perfilId && hueco <= 0.5;
    const pasado = pctPerfil > 100.005;

    /* Equivalente (la otra unidad) y valor del campo si no se está editando. */
    const eq = td.querySelector(".pa-celda__eq");
    if (eq) eq.textContent = h > 0 ? (enPct ? V2.hor(h) : N().fmtNum(pctLinea, 0) + " %") : "";
    if (document.activeElement !== entrada) {
      entrada.value = N().fmtCampo(enPct ? pctLinea : h);
    }
    entrada.placeholder = perfilId
      ? (sinHueco ? "sin hueco" : (enPct ? N().fmtCampo(huecoPct) + " % libres" : N().fmtCampo(hueco) + " h libres"))
      : (enPct ? "% de jornada" : "0");

    /* Sombra: la parte de la jornada de ese perfil ya comprometida en ese periodo. */
    let sombra = td.querySelector(".pa-celda__sombra");
    if (perfilId && pctPerfil > 0) {
      if (!sombra) {
        sombra = document.createElement("span");
        sombra.className = "pa-celda__sombra";
        sombra.setAttribute("aria-hidden", "true");
        td.insertBefore(sombra, td.firstChild);
      }
      sombra.style.width = N().fmtCampo(Math.min(100, pctPerfil), 1).replace(",", ".") + "%";
    } else if (sombra) {
      sombra.remove();
    }
    let marca = td.querySelector(".pa-celda__marca");
    if (perfilId && pctPerfil > 0) {
      if (!marca) {
        marca = document.createElement("span");
        marca.className = "pa-celda__marca";
        td.appendChild(marca);
      }
      marca.textContent = N().fmtNum(pctPerfil, 0) + "%";
    } else if (marca) {
      marca.remove();
    }

    td.classList.toggle("pa-celda--lleno", sinHueco);
    td.classList.toggle("pa-celda--exceso", pasado);
    td.title = "Esta línea: " + V2.hor(h) + " (" + N().fmtNum(pctLinea, 0) + " % del mes). " +
      "El perfil en ese periodo: " + N().fmtNum(pctPerfil, 0) + " % de " + Math.round(lab) + " h laborables. " +
      (perfilId
        ? (sinHueco
            ? "Sin hueco: el perfil ya está al 100 % ese periodo."
            : "Hueco libre para ese perfil: " + V2.hor(hueco) + " (" + N().fmtNum(huecoPct, 0) + " %). Esta línea puede llegar a " + V2.hor(techo) + ".")
        : "Sin perfil asignado: el tope son las " + Math.round(lab) + " h del periodo.") +
      (pasado ? " — MÁS DEL 100 %" : "");
  }

  /** Refresca TODAS las celdas de horas del editor y los totales de subtarea y tarea.
      Es lo que hace que los % y lo que queda libre estén siempre al día mientras se
      escribe: antes sólo se actualizaba la primera celda de la fila editada, así que
      los números no cuadraban con lo que había en pantalla. */
  function refrescarHoras(o, pf) {
    const V2 = V();
    const cont = V2.nodo("tr-editor");
    if (!cont) return;
    const enPct = APP().modoHoras() === "pct";
    const ind = indiceHoras(o);

    Array.prototype.forEach.call(cont.querySelectorAll(".pa-celda-horas input[data-campo=\"horas\"]"), function (entrada) {
      const td = entrada.closest("td");
      if (td) pintarCeldaHoras(td, entrada, N().num(entrada.dataset.mes), ind, enPct);
    });

    /* Totales por fila, subtarea y tarea. */
    Array.prototype.forEach.call(cont.querySelectorAll(".pa-tabla-horas tbody tr[data-id]"), function (tr) {
      const ref = ind.lineas[tr.dataset.id];
      if (!ref) return;
      const celdaH = tr.querySelector(".pa-celda-horas-h");
      if (celdaH) celdaH.innerHTML = "<strong>" + V2.hor(C().lineaHoras(ref.linea)) + "</strong>";
      const celdaI = tr.querySelector(".pa-celda-importe");
      if (celdaI) celdaI.textContent = V2.imp(C().lineaImporte(ref.linea, pf));
    });
    Array.prototype.forEach.call(cont.querySelectorAll(".pa-sub"), function (det) {
      const r = M().buscarSubtarea(o, det.dataset.id);
      if (!r) return;
      const chips = det.querySelectorAll("summary .nz-badge");
      if (chips[0]) chips[0].textContent = V2.hor(C().subtareaHoras(r.sub));
      if (chips[1]) chips[1].textContent = V2.imp(C().subtareaImporte(r.sub, pf));
    });
    Array.prototype.forEach.call(cont.querySelectorAll(".pa-tarea"), function (art) {
      const inp = art.querySelector('[data-campo="tarea-nombre"]');
      const t = inp ? M().buscarTarea(o, inp.dataset.id) : null;
      if (!t) return;
      const chips = art.querySelectorAll(".pa-tarea__cab .nz-badge");
      if (chips[0]) chips[0].textContent = V2.hor(C().tareaHoras(t));
      if (chips[1]) chips[1].textContent = V2.imp(C().tareaImporte(t, pf));
    });

    /* El aviso de excesos, con retardo corto (mira toda la oferta). */
    clearTimeout(T_EXCESOS);
    T_EXCESOS = setTimeout(function () {
      const viejo = cont.querySelector(".pa-aviso-excesos");
      if (C().excesosPerfil(o).length) {
        const html = avisoExcesos(o, pf).replace('<div class="nz-callout', '<div class="pa-aviso-excesos nz-callout');
        if (viejo) viejo.outerHTML = html; else cont.insertAdjacentHTML("afterbegin", html);
      } else if (viejo) { viejo.remove(); }
    }, 200);
  }

  let T_HORAS = null;

  /** Al teclear: la celda que se edita, al instante; el resto de la tabla, tras una
      pausa corta. El resto hace falta refrescarlo porque lo que le queda libre a un
      perfil depende de TODAS sus líneas, no sólo de la que se está escribiendo. */
  function refrescarHorasPronto(o, pf) {
    const activo = document.activeElement;
    if (activo && activo.dataset && activo.dataset.campo === "horas") {
      const td = activo.closest("td");
      if (td) pintarCeldaHoras(td, activo, N().num(activo.dataset.mes), indiceHoras(o), APP().modoHoras() === "pct");
    }
    clearTimeout(T_HORAS);
    T_HORAS = setTimeout(function () { refrescarHoras(o, pf); }, 260);
  }

  /** Compatibilidad: refresca la tabla entera (lo usa el arnés y los repintados). */
  function actualizarFilaHoras(o, pf, linea, tr) {
    void linea; void tr;
    refrescarHoras(o, pf);
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
    actualizarFilaHoras: actualizarFilaHoras, refrescarHoras: refrescarHoras,
    refrescarHorasPronto: refrescarHorasPronto, calendario: calendario
  };
})(typeof window !== "undefined" ? window : globalThis);
