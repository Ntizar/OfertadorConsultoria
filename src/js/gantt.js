"use strict";
/* =====================================================================
   Planifica v4 — DIAGRAMA DE GANTT
   Construye el diagrama: banda de años, columnas de periodo con RÓTULO
   EDITABLE, barras por tarea y subtarea, rombo en el mes de cada entregable
   y columna de horas a la derecha.

   No toca el DOM: devuelve HTML que pinta la vista.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  /** ¿Qué periodos (o columnas) tienen actividad? Se agrega según el zoom. */
  function columnasActivas(valoresPorPeriodo, columnas) {
    return columnas.map(col => col.periodos.some(i => N().num(valoresPorPeriodo[i]) > 0));
  }

  function valoresDeTarea(o, t) {
    const n = P().meses(o.periodos);
    const v = new Array(n).fill(0);
    N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      for (let i = 0; i < n; i++) v[i] += N().num(((l.horas) || {})["p" + i]);
    }));
    return v;
  }

  function valoresDeSubtarea(o, s) {
    const n = P().meses(o.periodos);
    const v = new Array(n).fill(0);
    N().lista(s.lineas).forEach(l => {
      for (let i = 0; i < n; i++) v[i] += N().num(((l.horas) || {})["p" + i]);
    });
    return v;
  }

  /** Celdas de una fila con barra continua (extremos redondeados). */
  function celdasBarra(activos, clase) {
    return activos.map((on, k) => {
      let html = "";
      if (on) {
        const primero = (k === 0) || !activos[k - 1];
        const ultimo = (k === activos.length - 1) || !activos[k + 1];
        const forma = (primero && ultimo) ? " pa-barra--sola" : (primero ? " pa-barra--inicio" : (ultimo ? " pa-barra--fin" : ""));
        html = '<span class="pa-barra ' + clase + forma + '"></span>';
      }
      return '<td class="pa-gantt__celda">' + html + "</td>";
    }).join("");
  }

  /** Fila de un entregable: rombo en su columna. */
  function celdasHito(columnas, periodo) {
    return columnas.map(col => {
      const esSuya = col.periodos.indexOf(periodo) >= 0;
      return '<td class="pa-gantt__celda">' + (esSuya ? '<span class="pa-barra pa-barra--hito"></span>' : "") + "</td>";
    }).join("");
  }

  function filaTarea(o, pf, t) {
    const cols = P().columnas(o.periodos);
    const valores = valoresDeTarea(o, t);
    return '<tr class="pa-gantt__fila pa-gantt__fila--tarea' + PL.vistas.claseTono(o, t.id) + '">' +
      '<th class="pa-gantt__concepto pa-gantt__concepto-clic" data-ir="' + t.id + '" scope="row">' + N().esc(t.nombre) + "</th>" +
      celdasBarra(columnasActivas(valores, cols), "pa-barra--tarea") +
      '<td class="pa-gantt__total">' + C().tareaHoras(t).toLocaleString("es-ES") + " h</td></tr>";
  }

  function filaSubtarea(o, pf, s, tareaId) {
    const cols = P().columnas(o.periodos);
    const valores = valoresDeSubtarea(o, s);
    return '<tr class="pa-gantt__fila pa-gantt__fila--subtarea' + PL.vistas.claseTono(o, tareaId) + '">' +
      '<th class="pa-gantt__concepto pa-gantt__concepto-clic" data-ir="' + s.id + '" scope="row">' + N().esc(s.nombre) + "</th>" +
      celdasBarra(columnasActivas(valores, cols), "") +
      '<td class="pa-gantt__total">' + C().subtareaHoras(s).toLocaleString("es-ES") + " h</td></tr>";
  }

  function filaEntregable(o, pf, e, tareaId) {
    const cols = P().columnas(o.periodos);
    const r = E().responsable(pf, e);
    const nivel = e._contexto === "subtarea" ? " · de la subtarea" : (e._contexto === "tarea" ? " · de la tarea" : " · de la oferta");
    const titulo = e.nombre + " · entrega " + P().mesCorto(o.periodos, e.periodo) + (r ? " · " + r.nombre : "") + nivel;
    return '<tr class="pa-gantt__fila pa-gantt__fila--entregable' + PL.vistas.claseTono(o, tareaId) + '">' +
      '<th class="pa-gantt__concepto" scope="row" title="' + N().esc(titulo) + '">' + N().esc(e.nombre) + "</th>" +
      celdasHito(cols, e.periodo) +
      '<td class="pa-gantt__total">' + (N().num(e.horas) ? N().num(e.horas).toLocaleString("es-ES") + " h" : "—") + "</td></tr>";
  }

  /** Con el calendario por semanas, una banda de trimestres: 52 columnas sin
      referencia son ilegibles. Devuelve la fila de trimestres o null. */
  function filaTrimestres(o, etiqueta) {
    const tri = P().bandasTrimestre(o.periodos);
    if (!tri) return null;
    const fila = tri.map(t => '<th colspan="' + t.n + '" scope="colgroup">' + (etiqueta ? t.texto : t.texto) + "</th>").join("");
    return '<tr class="pa-gantt__tri">' + fila + "</tr>";
  }

  /** Cabecera: banda de años + rótulos editables. */
  function cabecera(o) {
    const cols = P().columnas(o.periodos);
    const bandas = P().bandas(o.periodos);
    const filaAnios = bandas.map(b => '<th colspan="' + b.n + '" scope="colgroup">' + b.anio + "</th>").join("");
    const tri = filaTrimestres(o, true);
    if (tri) {
      return "<thead>" +
        '<tr class="pa-gantt__anios"><th class="pa-gantt__concepto" rowspan="3" scope="col">Concepto</th>' + filaAnios +
        '<th class="pa-gantt__total" rowspan="3" scope="col">Horas</th></tr>' +
        tri +
        '<tr class="pa-gantt__meses">' + cols.map(c => '<th scope="col"><input class="pa-gantt__rotulo' +
          (P().estaEditada(o.periodos, c.periodos[0]) ? " pa-gantt__rotulo--editado" : "") + '" value="' + N().esc(c.etiqueta) +
          '" data-campo="periodo-rotulo" data-id="' + c.periodos[0] + '" title="Clic para renombrar este periodo" ' +
          'aria-label="Nombre del periodo"></th>').join("") +
        "</tr></thead>";
    }
    const filaMeses = cols.map(c => {
      const idx = c.periodos[0];
      const editado = P().estaEditada(o.periodos, idx) ? " pa-gantt__rotulo--editado" : "";
      return '<th scope="col"><input class="pa-gantt__rotulo' + editado + '" value="' + N().esc(c.etiqueta) + '" ' +
        'data-campo="periodo-rotulo" data-id="' + idx + '" title="Clic para renombrar este periodo (' + N().esc(P().mesCorto(o.periodos, idx)) + ')" ' +
        'aria-label="Nombre del periodo ' + (idx + 1) + '"></th>';
    }).join("");
    return "<thead>" +
      '<tr class="pa-gantt__anios"><th class="pa-gantt__concepto" rowspan="2" scope="col">Concepto</th>' + filaAnios +
      '<th class="pa-gantt__total" rowspan="2" scope="col">Horas</th></tr>' +
      '<tr class="pa-gantt__meses">' + filaMeses + "</tr></thead>";
  }

  /**
   * Gantt completo. `opciones.soloOferta` deja fuera los hitos sueltos.
   */
  function html(o, pf) {
    if (!o) return "";
    const cols = P().columnas(o.periodos);
    const filas = [];
    N().lista(o.tareas).forEach(t => {
      filas.push(filaTarea(o, pf, t));
      N().lista(t.entregables).forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "tarea" }), t.id)));
      N().lista(t.subtareas).forEach(s => {
        filas.push(filaSubtarea(o, pf, s, t.id));
        N().lista(s.entregables).forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "subtarea" }), t.id)));
      });
    });
    const hitosOferta = N().lista(o.entregables);
    if (hitosOferta.length) {
      filas.push('<tr class="pa-gantt__fila"><th class="pa-gantt__concepto pa-mini pa-mini--fuerte" colspan="' + (cols.length + 2) + '" scope="row">Hitos de la oferta</th></tr>');
      hitosOferta.forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "oferta" }), null)));
    }

    const totalHitos = E().todos(o).length;
    const nota = '<tr><td class="pa-gantt__nota pa-mini" colspan="' + (cols.length + 2) + '">' +
      "◆ marca el mes de entrega · " + totalHitos + " entregable(s) · " +
      "barras = meses con esfuerzo · " + P().duracionLegible(o.periodos) +
      (P().cuantasEditadas(o.periodos) ? " · " + P().cuantasEditadas(o.periodos) + " rótulo(s) personalizado(s)" : "") +
      "</td></tr>";

    const colgroup = '<colgroup><col class="pa-gantt__col-concepto">' +
      cols.map(() => '<col style="width:3.2rem">').join("") + '<col class="pa-gantt__col-total"></colgroup>';

    return '<div class="pa-gantt-scroll"><table class="pa-gantt">' + colgroup + cabecera(o) +
      "<tbody>" + filas.join("") + nota + "</tbody></table></div>";
  }

  /** Cabecera estática para el informe: años + periodos como texto. */
  function cabeceraInforme(o) {
    const cols = P().columnas(o.periodos);
    const bandas = P().bandas(o.periodos);
    const filaAnios = bandas.map(b => '<th colspan="' + b.n + '" scope="colgroup">' + b.anio + "</th>").join("");
    const filaMeses = cols.map(c => "<th scope=\"col\">" + N().esc(c.etiqueta) + "</th>").join("");
    const tri = filaTrimestres(o, true);
    if (tri) {
      return "<thead>" +
        '<tr class="pa-gantt__anios"><th class="pa-gantt__concepto" rowspan="3" scope="col">Concepto</th>' + filaAnios +
        '<th class="pa-gantt__total" rowspan="3" scope="col">Horas</th></tr>' +
        tri + '<tr class="pa-gantt__meses">' + filaMeses + "</tr></thead>";
    }
    return "<thead>" +
      '<tr class="pa-gantt__anios"><th class="pa-gantt__concepto" rowspan="2" scope="col">Concepto</th>' + filaAnios +
      '<th class="pa-gantt__total" rowspan="2" scope="col">Horas</th></tr>' +
      '<tr class="pa-gantt__meses">' + filaMeses + "</tr></thead>";
  }

  /** El Gantt tal como va en el informe: mismo diagrama, sin campos editables. */
  function htmlInforme(o, pf) {
    if (!o) return "";
    const cols = P().columnas(o.periodos);
    const filas = [];
    N().lista(o.tareas).forEach(t => {
      filas.push(filaTarea(o, pf, t));
      N().lista(t.entregables).forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "tarea" }), t.id)));
      N().lista(t.subtareas).forEach(s => {
        filas.push(filaSubtarea(o, pf, s, t.id));
        N().lista(s.entregables).forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "subtarea" }), t.id)));
      });
    });
    const hitosOferta = N().lista(o.entregables);
    if (hitosOferta.length) {
      filas.push('<tr class="pa-gantt__fila"><th class="pa-gantt__concepto pa-mini pa-mini--fuerte" colspan="' + (cols.length + 2) + '" scope="row">Hitos de la oferta</th></tr>');
      hitosOferta.forEach(e => filas.push(filaEntregable(o, pf, Object.assign({}, e, { _contexto: "oferta" }), null)));
    }
    const colgroup = '<colgroup><col class="pa-gantt__col-concepto">' +
      cols.map(() => '<col style="width:2.6rem">').join("") + '<col class="pa-gantt__col-total"></colgroup>';
    return '<div class="pa-gantt-scroll pa-gantt--informe"><table class="pa-gantt">' + colgroup + cabeceraInforme(o) +
      "<tbody>" + filas.join("") + "</tbody></table></div>";
  }

  PL.gantt = {
    html: html, htmlInforme: htmlInforme, columnasActivas: columnasActivas,
    valoresDeTarea: valoresDeTarea, valoresDeSubtarea: valoresDeSubtarea,
    celdasBarra: celdasBarra, celdasHito: celdasHito
  };
})(typeof window !== "undefined" ? window : globalThis);
