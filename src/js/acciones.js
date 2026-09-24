"use strict";
/* =====================================================================
   Planifica v4 — ACCIONES
   Todo lo que hacen los botones (data-acc). Cambian el modelo y piden un
   repintado; nunca tocan el DOM a mano. Las acciones destructivas descargan
   antes una copia de seguridad.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const X = () => PL.comparar;
  const A = () => PL.almacen;
  const R = () => PL.repintar;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  const o = () => APP().pr();
  /** Importe en texto para los avisos. */
  const r2texto = v => N().fmtNum(v) + " €";
  const pf = () => APP().pf();
  const id = b => b.dataset.id || "";
  const tarea = b => b.dataset.tarea || "";

  function copiaAntes(motivo) {
    A().descargar("planifica-copia-antes-de-" + motivo + "-" + N().hoyISO() + ".json",
      JSON.stringify(APP().ESTADO, null, 2), "application/json");
  }

  function mover(arr, id_, dir) {
    const i = arr.findIndex(x => x.id === id_);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return false;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    return true;
  }

  const acc = {

    /* ---------- Ofertas ---------- */
    "nueva-oferta": () => {
      const nueva = M().nuevaOferta("Oferta sin título");
      APP().ESTADO.ofertas.push(nueva);
      APP().ESTADO.activa = nueva.id;
      APP().ESTADO.guiaVista = true;
      R().todo(); APP().guardar(); APP().toast("Oferta creada");
    },
    "dup-oferta": () => {
      const origen = o();
      const copia = M().normalizarOferta(Object.assign({}, N().clonar(origen), {
        nombre: origen.nombre + " (copia)", estado: "borrador", fotos: []
      }));
      copia.id = N().uid("of_");
      copia.guia = false;
      APP().ESTADO.ofertas.push(copia);
      APP().ESTADO.activa = copia.id;
      R().todo(); APP().guardar(); APP().toast("Oferta duplicada (sin sus fotos)");
    },
    "elim-oferta": () => {
      const actual = o();
      if (APP().ESTADO.ofertas.length <= 1) { APP().toast("Debe existir al menos una oferta"); return; }
      if (!confirm("¿Eliminar la oferta «" + actual.nombre + "» con todo su contenido?\n\nSe descargará antes una copia de seguridad.")) return;
      copiaAntes("eliminar-oferta");
      APP().ESTADO.ofertas = APP().ESTADO.ofertas.filter(x => x.id !== actual.id);
      APP().ESTADO.activa = APP().ESTADO.ofertas[0].id;
      R().todo(); APP().guardar(); APP().toast("Oferta eliminada");
    },

    /* ---------- Calendario ---------- */
    /* Meses ⇄ semanas: se convierte el calendario entero repartiendo las horas por
       días laborables reales. Se avisa antes y se cuenta lo que ha pasado. */
    "cal-unidad": b => {
      const u = (b && b.dataset && b.dataset.unidad) === "semana" ? "semana" : "mes";
      const of = o();
      if (P().normalizar(of.periodos).unidad === u) return;
      if (!confirm("¿Pasar el calendario a " + (u === "semana" ? "semanas" : "meses") + "?\n\n" +
        "Las horas se reparten por los días laborables reales de cada periodo y el total se mantiene. " +
        "Los rótulos de periodo personalizados se pierden.")) return;
      const r = PL.unidades.convertirOferta(of, u);
      if (!r) return;
      R().todo(); APP().guardar();
      APP().toast("Calendario en " + (u === "semana" ? "semanas" : "meses") + ": " +
        (u === "semana" ? r.nSemanas + " semanas" : r.nMesesDestino + " meses") + " · " +
        N().fmtCampo(r.totalHoras) + " h y " + r2texto(C().importeOferta(of, pf())) + " (total sin cambios)");
    },

    /* Cómo se teclean las horas: dedicación (% de jornada) u horas. */
    "modo-horas": b => {
      const m = (b && b.dataset && b.dataset.modo) === "h" ? "h" : "pct";
      APP().conModoHoras(m);
      R().trabajo(); R().datos(); APP().guardar();
      APP().toast(m === "pct" ? "Se teclean dedicaciones (% de jornada)" : "Se teclean horas");
    },

    "cal-antes": () => cambiarCalendario(P().desplazar(o().periodos, -1), "Calendario retrasado un mes"),
    "cal-despues": () => cambiarCalendario(P().desplazar(o().periodos, 1), "Calendario adelantado un mes"),
    "cal-zoom": () => cambiarCalendario(P().conZoom(o().periodos, P().siguienteZoom(o().periodos.zoom)), ""),
    "cal-rotulos-auto": () => {
      o().periodos = P().volverTodoAuto(o().periodos);
      R().todo(); APP().guardar(); APP().toast("Rótulos automáticos restaurados");
    },

    /* ---------- Estructura ---------- */
    "nueva-tarea": () => {
      o().tareas.push(M().nuevaTarea("Tarea " + (N().lista(o().tareas).length + 1)));
      R().todo(); APP().guardar();
    },
    "dup-tarea": b => {
      const t = M().buscarTarea(o(), id(b)); if (!t) return;
      const copia = C().clonarTarea(t);
      copia.nombre = t.nombre + " (copia)";
      o().tareas.splice(o().tareas.indexOf(t) + 1, 0, copia);
      R().todo(); APP().guardar();
    },
    "elim-tarea": b => {
      const t = M().buscarTarea(o(), id(b)); if (!t) return;
      if (!confirm("¿Eliminar la tarea «" + t.nombre + "» con sus subtareas, horas y entregables?")) return;
      o().tareas.splice(o().tareas.indexOf(t), 1);
      R().todo(); APP().guardar();
    },
    "subir-tarea": b => { if (mover(o().tareas, id(b), -1)) { R().todo(); APP().guardar(); } },
    "bajar-tarea": b => { if (mover(o().tareas, id(b), 1)) { R().todo(); APP().guardar(); } },

    "nueva-sub": b => {
      const t = M().buscarTarea(o(), id(b)); if (!t) return;
      t.subtareas.push(M().nuevaSubtarea("Subtarea " + (N().lista(t.subtareas).length + 1)));
      R().todo(); APP().guardar();
    },
    "dup-sub": b => {
      const r = M().buscarSubtarea(o(), id(b)); if (!r) return;
      const copia = C().clonarSubtarea(r.sub);
      copia.nombre = r.sub.nombre + " (copia)";
      r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub) + 1, 0, copia);
      R().todo(); APP().guardar();
    },
    "elim-sub": b => {
      const r = M().buscarSubtarea(o(), id(b)); if (!r) return;
      if (!confirm("¿Eliminar la subtarea «" + r.sub.nombre + "» con sus horas?")) return;
      r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub), 1);
      R().todo(); APP().guardar();
    },
    "subir-sub": b => {
      const r = M().buscarSubtarea(o(), id(b)); if (!r) return;
      if (mover(r.tarea.subtareas, id(b), -1)) { R().todo(); APP().guardar(); }
    },
    "bajar-sub": b => {
      const r = M().buscarSubtarea(o(), id(b)); if (!r) return;
      if (mover(r.tarea.subtareas, id(b), 1)) { R().todo(); APP().guardar(); }
    },

    "nueva-linea": b => {
      const r = M().buscarSubtarea(o(), id(b)); if (!r) return;
      const primero = N().lista(pf())[0];
      r.sub.lineas.push(M().nuevaLinea(primero ? primero.id : "", P().meses(o().periodos)));
      r.sub._abierta = true;
      R().todo(); APP().guardar();
    },
    "elim-linea": b => {
      const r = M().buscarLinea(o(), id(b)); if (!r) return;
      const p = C().perfilPorId(APP().ESTADO.perfiles, r.linea.perfilId);
      const h = C().lineaHoras(r.linea);
      /* Quitar una línea se lleva horas e importe: siempre se pregunta antes. */
      if (!confirm("¿Quitar a " + (p ? p.nombre : "este perfil") + " de «" + r.sub.nombre + "»?\n\n" +
        (h ? "Se van " + h.toLocaleString("es-ES") + " h y " + r2texto(C().lineaImporte(r.linea, APP().ESTADO.perfiles)) + "." : "La línea aún no tiene horas puestas."))) return;
      r.sub.lineas.splice(r.sub.lineas.indexOf(r.linea), 1);
      R().todo(); APP().guardar();
      APP().toast("Línea eliminada");
    },

    /* Plegar y desplegar por niveles: es la forma rápida de ver la oferta entera. */
    "toggle-tarea": b => {
      const t = M().buscarTarea(o(), id(b));
      if (!t) return;
      t._abierta = !t._abierta;
      R().trabajo(); APP().guardar();
    },
    "abrir-todo": () => {
      N().lista(o().tareas).forEach(t => { t._abierta = true; N().lista(t.subtareas).forEach(s => { s._abierta = true; }); });
      R().trabajo(); APP().guardar(); APP().toast("Todo desplegado");
    },
    "cerrar-todo": () => {
      N().lista(o().tareas).forEach(t => N().lista(t.subtareas).forEach(s => { s._abierta = false; }));
      R().trabajo(); APP().guardar(); APP().toast("Subtareas plegadas");
    },
    "solo-tareas": () => {
      N().lista(o().tareas).forEach(t => { t._abierta = true; N().lista(t.subtareas).forEach(s => { s._abierta = false; }); });
      R().trabajo(); APP().guardar(); APP().toast("Sólo las tareas a la vista");
    },
    "plegar-tareas": () => {
      N().lista(o().tareas).forEach(t => { t._abierta = false; });
      R().trabajo(); APP().guardar(); APP().toast("Tareas plegadas");
    },

    /* ---------- Entregables ---------- */
    /* Entregable colgado de una SUBTAREA: lo habitual, se entrega al cerrar el trabajo. */
    "nuevo-entregable-sub": b => {
      const s = M().buscarSubtarea(o(), id(b));
      if (!s) return;
      M().colgarEntregable(o(), "Entregable " + (N().lista(s.sub.entregables).length + 1), "subtarea", 0, s.tarea.id, s.sub.id);
      R().todo(); APP().guardar();
      APP().toast("Entregable añadido a «" + s.sub.nombre + "»");
    },

    "nuevo-entregable-tarea": b => {
      const t = M().buscarTarea(o(), id(b)); if (!t) return;
      M().colgarEntregable(o(), "Entregable " + (N().lista(t.entregables).length + 1), "tarea", 0, t.id);
      R().todo(); APP().guardar(); APP().toast("Entregable añadido a la tarea");
    },
    "nuevo-entregable-oferta": () => {
      M().colgarEntregable(o(), "Hito de la oferta " + (N().lista(o().entregables).length + 1), "oferta", 0, null);
      R().todo(); APP().guardar(); APP().toast("Entregable de la oferta añadido");
    },
    "dup-entregable": b => {
      const r = M().buscarEntregable(o(), id(b), tarea(b), b.dataset.subtarea || ""); if (!r) return;
      const copia = N().clonar(r.entregable);
      copia.id = N().uid("en_");
      copia.nombre = r.entregable.nombre + " (copia)";
      r.contenedor.splice(r.contenedor.indexOf(r.entregable) + 1, 0, copia);
      R().todo(); APP().guardar();
    },
    "elim-entregable": b => {
      const r = M().buscarEntregable(o(), id(b), tarea(b), b.dataset.subtarea || ""); if (!r) return;
      if (!confirm("¿Eliminar el entregable «" + r.entregable.nombre + "»?")) return;
      r.contenedor.splice(r.contenedor.indexOf(r.entregable), 1);
      R().todo(); APP().guardar();
    },

    /* ---------- Gastos ---------- */
    "nuevo-gasto": () => {
      o().gastos.push({ id: N().uid("g_"), nombre: "Concepto", unidades: 1, precio: 0 });
      R().todo(); APP().guardar();
    },
    "elim-gasto": b => {
      o().gastos = N().lista(o().gastos).filter(g => g.id !== id(b));
      R().todo(); APP().guardar();
    },

    /* ---------- Plantillas (en línea, sin ventanas) ---------- */
    "plantilla-toggle": () => {
      APP().ui.plantillasAbiertas = !APP().ui.plantillasAbiertas;
      R().trabajo();
    },
    "plantilla-aplicar": b => {
      const pl = N().lista(APP().ESTADO.plantillas).filter(x => x.id === id(b))[0];
      if (!pl) return;
      const reemplazar = b.dataset.modo === "reemplazar";
      const nTareas = N().lista(o().tareas).length;
      if (nTareas && !confirm(reemplazar
        ? "¿REEMPLAZAR las " + nTareas + " tareas actuales por la plantilla «" + pl.nombre + "»?"
        : "¿Añadir las " + N().lista(pl.tareas).length + " tareas de «" + pl.nombre + "» a la oferta actual?")) return;
      const nuevas = N().lista(pl.tareas).map(t => {
        const ta = M().nuevaTarea(t.nombre);
        ta.subtareas = N().lista(t.subtareas).map(s => M().nuevaSubtarea(s));
        ta.entregables = N().lista(t.entregables).map(e => Object.assign(M().nuevoEntregable(e.nombre, "tarea", e.periodo), {
          descripcion: e.descripcion || "", criterio: e.criterio || "", horas: N().num(e.horas)
        }));
        return ta;
      });
      o().tareas = reemplazar ? nuevas : N().lista(o().tareas).concat(nuevas);
      R().todo(); APP().guardar();
      APP().toast(reemplazar ? "Estructura reemplazada por la plantilla" : "Plantilla aplicada: " + nuevas.length + " tareas");
    },
    "plantilla-guardar": () => {
      const inp = V().nodo("plantilla-nombre");
      const nombre = N().texto(inp && inp.value, "");
      if (!nombre) { APP().toast("Ponle un nombre a la plantilla"); if (inp) inp.focus(); return; }
      if (!N().lista(o().tareas).length) { APP().toast("Esta oferta no tiene tareas que guardar"); return; }
      APP().ESTADO.plantillas.push(M().normalizarPlantilla({
        id: N().uid("pl_"), nombre: nombre, desc: "Guardada desde «" + o().nombre + "»", esDefecto: false,
        tareas: N().lista(o().tareas).map(t => ({
          nombre: t.nombre,
          subtareas: N().lista(t.subtareas).map(s => s.nombre),
          entregables: N().lista(t.entregables).map(e => ({
            nombre: e.nombre, descripcion: e.descripcion, criterio: e.criterio, periodo: e.periodo, horas: e.horas
          }))
        }))
      }));
      if (inp) inp.value = "";
      R().trabajo(); R().ajustes(); APP().guardar();
      APP().toast("Plantilla guardada: " + nombre);
    },
    "plantilla-borrar": b => {
      if (!confirm("¿Eliminar esta plantilla?")) return;
      APP().ESTADO.plantillas = N().lista(APP().ESTADO.plantillas).filter(x => x.id !== id(b));
      R().trabajo(); R().ajustes(); APP().guardar();
    },

    /* ---------- Escenarios y versiones (en línea) ---------- */
    "guardar-escenario": () => crearFoto("escenario"),
    "guardar-version": () => crearFoto("version"),
    "foto-comparar": b => {
      const f = M().buscarFoto(o(), id(b)); if (!f) return;
      APP().ui.comparacion = { cmp: X().comparar(o(), pf(), f.snapshot, X().foto(o()), f.nombre, "Oferta actual") };
      R().resumen();
      APP().toast("Comparando con «" + f.nombre + "»");
    },
    "foto-aplicar": b => {
      const f = M().buscarFoto(o(), id(b)); if (!f) return;
      if (!confirm("¿Aplicar «" + f.nombre + "» a la oferta?\n\nSe descargará antes una copia del estado actual.")) return;
      copiaAntes(f.tipo === "version" ? "restaurar-version" : "aplicar-escenario");
      const fotos = N().lista(o().fotos);
      X().aplicarFoto(o(), f.snapshot);
      o().fotos = fotos;   /* las fotos no se pierden al aplicar una foto */
      APP().ui.comparacion = null;
      R().todo(); APP().guardar();
      APP().toast("Aplicado: " + f.nombre);
    },
    "foto-borrar": b => {
      const f = M().buscarFoto(o(), id(b)); if (!f) return;
      if (!confirm("¿Eliminar la " + (f.tipo === "version" ? "versión" : "escenario") + " «" + f.nombre + "»?")) return;
      X().borrarFoto(o(), id(b));
      APP().ui.comparacion = null;
      R().resumen(); APP().guardar();
    },
    "foto-cerrar-comparacion": () => { APP().ui.comparacion = null; R().resumen(); },

    /* ---------- Cabecera y utilidades ---------- */
    "toggle-importes": () => {
      APP().ESTADO.mostrarImportes = !APP().ESTADO.mostrarImportes;
      R().todo(); APP().guardar();
      APP().toast(APP().ESTADO.mostrarImportes ? "Importes visibles" : "Modo solo tiempos: importes ocultos");
    },
    "cerrar-guia": () => { APP().ESTADO.guiaVista = true; R().trabajo(); APP().guardar(); },

    /* ---------- Logo ---------- */
    "cargar-logo": () => { const f = V().nodo("pa-logo-fichero"); if (f) f.click(); },
    "quitar-logo": () => { APP().ESTADO.marca.logo = ""; R().cabecera(); R().ajustes(); APP().guardar(); APP().toast("Logo quitado"); },

    /* ---------- Perfiles ---------- */
    "nuevo-perfil": () => { APP().ESTADO.perfiles.push(M().nuevoPerfil("Perfil nuevo", 0, "Otro", false)); R().ajustes(); R().todo(); APP().guardar(); },
    "elim-perfil": b => {
      const id_ = id(b);
      const p = C().perfilPorId(APP().ESTADO.perfiles, id_) || C().perfilPorId(APP().ESTADO.perfilesInactivos, id_);
      if (!p) return;
      const usos = C().usosPerfil(APP().ESTADO.ofertas, id_);
      if (usos > 0) {
        if (!confirm("«" + p.nombre + "» se usa en " + usos + " sitio(s). ¿Desactivarlo? Sus horas se conservan y podrás reactivarlo.")) return;
        APP().ESTADO.perfiles = APP().ESTADO.perfiles.filter(x => x.id !== id_);
        APP().ESTADO.perfilesInactivos.push(p);
      } else {
        if (!confirm("¿Eliminar el perfil «" + p.nombre + "»?")) return;
        APP().ESTADO.perfiles = APP().ESTADO.perfiles.filter(x => x.id !== id_);
        APP().ESTADO.perfilesInactivos = APP().ESTADO.perfilesInactivos.filter(x => x.id !== id_);
      }
      R().todo(); APP().guardar();
    },
    "reactivar-perfil": b => {
      const p = N().lista(APP().ESTADO.perfilesInactivos).filter(x => x.id === id(b))[0];
      if (!p) return;
      APP().ESTADO.perfilesInactivos = APP().ESTADO.perfilesInactivos.filter(x => x.id !== id(b));
      APP().ESTADO.perfiles.push(p);
      R().todo(); APP().guardar();
    },
    "restaurar-perfil": b => {
      const id_ = id(b);
      const actual = C().perfilPorId(APP().ESTADO.perfiles, id_);
      if (!actual || !actual.esDefecto) return;
      const original = N().lista(PL.ejemplo.perfilesDefecto()).filter(x => x.id === id_)[0];
      if (!original) { APP().toast("Este perfil ya no es de fábrica"); return; }
      if (!confirm("¿Restaurar «" + actual.nombre + "» a sus valores de fábrica?")) return;
      actual.nombre = original.nombre; actual.tarifa = original.tarifa;
      actual.categoria = original.categoria; actual.unidad = original.unidad;
      R().todo(); APP().guardar(); APP().toast("Perfil restaurado");
    },
    "restaurar-perfiles-defecto": () => {
      if (!confirm("¿Recrear los 7 perfiles de fábrica que falten? Los tuyos se conservan.")) return;
      N().lista(PL.ejemplo.perfilesDefecto()).forEach(d => {
        if (!C().perfilPorId(APP().ESTADO.perfiles, d.id) && !C().perfilPorId(APP().ESTADO.perfilesInactivos, d.id)) {
          APP().ESTADO.perfiles.push(d);
        }
      });
      R().todo(); APP().guardar(); APP().toast("Perfiles de fábrica disponibles");
    },

    /* ---------- Exportar / importar / imprimir ---------- */
    "exp-json-oferta": () => { A().exportarOferta(o()); APP().toast("Oferta exportada"); },
    "exp-json-todo": () => { A().exportarTodo(APP().ESTADO); APP().toast("Copia de seguridad descargada"); },
    /* Catálogo de perfiles: un fichero que se guarda y se vuelve a cargar cuando
       haga falta (puestos, categorías y precios por hora), sin base de datos. */
    "exp-perfiles": () => { A().exportarPerfiles(APP().ESTADO); APP().toast("Perfiles guardados en un fichero"); },
    "imp-perfiles": () => { const f = V().nodo("pa-fichero"); if (f) f.click(); },
    "exp-csv": () => {
      A().descargar(A().nombreFichero(o().nombre, "csv"), A().csvOferta(o(), pf(), APP().verImportes()), "text/csv;charset=utf-8");
      APP().toast("CSV exportado");
    },
    "imp-json": () => { const f = V().nodo("pa-fichero"); if (f) f.click(); },
    "imprimir": () => {
      APP().pestana("informe");
      R().informe();
      setTimeout(() => { try { window.print(); } catch (e) { APP().toast("Usa Ctrl+P para imprimir"); } }, 80);
    },

    /* ---------- Datos ---------- */
    /* Traer las ofertas de versiones anteriores (se añaden a las actuales). */
    "traer-heredados": () => {
      const migrado = A().leerHeredado();
      if (!migrado) { APP().toast("Ya no quedan datos de versiones anteriores"); return; }
      if (!confirm("Se van a añadir " + migrado.ofertas.length + " oferta(s) de la copia anterior a las que tienes ahora.\n\nAntes se descarga una copia de seguridad de tus datos actuales.")) return;
      A().descargar("planifica-copia-antes-de-traer-" + N().hoyISO() + ".json", JSON.stringify(APP().ESTADO, null, 2), "application/json");
      const r = A().aplicarImportacion(APP().ESTADO,
        { ok: true, tipo: "estado", datos: migrado, origen: 1 },
        { reemplazar: false, aplicarMarca: false });
      A().olvidarHeredados();
      R().todo(); APP().guardar();
      APP().toast(r.mensaje || "Datos antiguos traídos");
    },

    /* Descargar una copia de los datos antiguos sin tocarlos. */
    "descargar-heredados": () => {
      const migrado = A().leerHeredado();
      if (!migrado) { APP().toast("Ya no quedan datos de versiones anteriores"); return; }
      A().descargar("planifica-datos-antiguos-" + N().hoyISO() + ".json", JSON.stringify(migrado, null, 2), "application/json");
      APP().toast("Copia de los datos antiguos descargada");
    },

    "limpiar-heredados": () => {
      if (!confirm("¿Olvidar la copia de tus datos anteriores?\n\nLos datos que estás usando ahora no se tocan.")) return;
      A().olvidarHeredados();
      const e = APP().ESTADO;
      if (e && e.importadoAuto) delete e.importadoAuto;
      R().todo(); APP().guardar(); APP().toast("Copia anterior olvidada");
    },
    "restaurar-ejemplo": () => {
      if (!confirm("¿Volver al ejemplo de inicio? Se reemplazan los datos actuales (antes se descarga una copia).")) return;
      copiaAntes("restaurar-ejemplo");
      APP().reemplazarEstado(M().estadoInicial(), "trabajo");
      APP().toast("Ejemplo de inicio restaurado");
    },
    "borrar-todo": () => {
      if (!confirm("¿BORRAR todos los datos? Quedará una app vacía (antes se descarga una copia de seguridad).")) return;
      copiaAntes("borrar-todo");
      const e = M().estadoInicial();
      const vacia = M().nuevaOferta("Mi primera oferta");
      e.ofertas = [vacia];
      e.activa = vacia.id;
      e.perfiles = [];
      e.plantillas = [];
      e.guiaVista = true;
      APP().reemplazarEstado(e, "trabajo");
      APP().toast("Datos borrados");
    }
  };

  /** Cambia el calendario de la oferta y repinta todo. */
  function cambiarCalendario(periodos, mensaje) {
    const of = o();
    const antes = P().meses(of.periodos);
    of.periodos = periodos;
    const despues = P().meses(of.periodos);
    /* Al cambiar la duración, las horas de los periodos que desaparecen se tiran
       (y los entregables se acotan), igual que al editar el campo de duración. */
    if (despues !== antes) ajustarPeriodos(of, despues);
    R().todo(); APP().guardar();
    if (mensaje) APP().toast(mensaje);
  }

  /** Recorta o estira las horas de todas las líneas al nuevo número de periodos. */
  function ajustarPeriodos(of, n) {
    N().lista(of.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      const h = l.horas = l.horas || {};
      for (let i = 0; i < n; i++) if (h["p" + i] === undefined) h["p" + i] = 0;
      Object.keys(h).forEach(k => {
        const i = parseInt(k.slice(1), 10);
        if (isNaN(i) || i >= n) delete h[k];
      });
    })));
    N().lista(of.entregables).forEach(e => { e.periodo = Math.min(N().num(e.periodo), n - 1); });
    N().lista(of.tareas).forEach(t => N().lista(t.entregables).forEach(e => { e.periodo = Math.min(N().num(e.periodo), n - 1); }));
  }

  function crearFoto(tipo) {
    const nombreInp = V().nodo("foto-nombre");
    const notaInp = V().nodo("foto-nota");
    const nombre = N().texto(nombreInp && nombreInp.value, "");
    const porDefecto = tipo === "version"
      ? ("v" + (X().fotosDe(o(), "version").length + 1))
      : ("Escenario " + (X().fotosDe(o(), "escenario").length + 1));
    const f = X().crearFoto(o(), tipo, nombre || porDefecto, notaInp && notaInp.value);
    if (nombreInp) nombreInp.value = "";
    if (notaInp) notaInp.value = "";
    R().resumen(); APP().guardar();
    APP().toast((tipo === "version" ? "Versión congelada: " : "Escenario guardado: ") + f.nombre);
  }

  PL.acc = acc;
  PL.acciones = { copiaAntes: copiaAntes, ajustarPeriodos: ajustarPeriodos, cambiarCalendario: cambiarCalendario };
})(typeof window !== "undefined" ? window : globalThis);
