"use strict";
/* =====================================================================
   Planifica v3 — ACCIONES
   Todo lo que hacen los botones (data-acc). Las acciones NUNCA tocan el
   DOM a mano: cambian el modelo y piden un repintado a PL.repintar.
   Las destructivas descargan antes una copia de seguridad.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;
  const X = () => PL.comparar;
  const A = () => PL.almacen;
  const R = () => PL.repintar;
  const APP = () => PL.app;

  const pr = () => APP().pr();
  const pf = () => APP().pf();

  /* ---------- Utilidades de acción ---------- */

  function copiaAntes(motivo) {
    A().descargar("planifica-copia-antes-de-" + motivo + "-" + N().hoyISO() + ".json",
      JSON.stringify(APP().ESTADO, null, 2), "application/json");
  }

  function idDe(btn) { return btn.dataset.id || ""; }
  function tareaDe(btn) { return btn.dataset.tarea || ""; }

  function clonarTarea(t) {
    const c = X().foto({ tareas: [t], entregables: [], gastos: [], meses: 1, impuestos: {}, descuento: {} }).tareas[0];
    c.id = N().uid("ta_");
    N().lista(c.subtareas).forEach(s => {
      s.id = N().uid("sb_");
      N().lista(s.lineas).forEach(l => { l.id = N().uid("ln_"); });
    });
    N().lista(c.entregables).forEach(e => { e.id = N().uid("en_"); });
    return c;
  }

  function clonarSub(s) {
    const c = N().clonar(s);
    c.id = N().uid("sb_");
    N().lista(c.lineas).forEach(l => { l.id = N().uid("ln_"); });
    c._abierta = true;
    return c;
  }

  /* ---------- Acciones ---------- */

  const acc = {

    /* --- Ofertas --- */
    "nueva-oferta": () => {
      const p = M().nuevoProyecto("Oferta sin título");
      APP().ESTADO.proyectos.push(p);
      APP().ESTADO.activo = p.id;
      APP().ESTADO.guiaVista = true;
      R().todo();
      APP().guardar();
      APP().toast("Oferta creada");
    },
    "dup-oferta": () => {
      const o = pr();
      const c = X().foto(o);
      const nueva = M().normalizarProyecto(Object.assign({}, c, { nombre: o.nombre + " (copia)", estado: "borrador", versiones: [], escenarios: [] }));
      nueva.id = N().uid("pr_");
      nueva.guia = false;
      APP().ESTADO.proyectos.push(nueva);
      APP().ESTADO.activo = nueva.id;
      R().todo();
      APP().guardar();
      APP().toast("Oferta duplicada (sin versiones ni escenarios)");
    },
    "elim-oferta": () => {
      const o = pr();
      if (APP().ESTADO.proyectos.length <= 1) { APP().toast("Debe existir al menos una oferta"); return; }
      if (!confirm("¿Eliminar la oferta «" + o.nombre + "» y todo su contenido?\n\nSe descargará antes una copia de seguridad.")) return;
      copiaAntes("eliminar-oferta");
      APP().ESTADO.proyectos = APP().ESTADO.proyectos.filter(p => p.id !== o.id);
      APP().ESTADO.activo = APP().ESTADO.proyectos[0].id;
      R().todo();
      APP().guardar();
      APP().toast("Oferta eliminada");
    },

    /* --- Estructura --- */
    "nueva-tarea": () => { pr().tareas.push(M().nuevaTarea("Tarea " + (N().lista(pr().tareas).length + 1))); R().estructura(); R().datos(); APP().guardar(); },
    "dup-tarea": b => {
      const t = M().buscarTarea(pr(), idDe(b)); if (!t) return;
      const c = clonarTarea(t);
      c.nombre = t.nombre + " (copia)";
      pr().tareas.splice(pr().tareas.indexOf(t) + 1, 0, c);
      R().estructura(); R().datos(); APP().guardar();
    },
    "elim-tarea": b => {
      const t = M().buscarTarea(pr(), idDe(b)); if (!t) return;
      if (!confirm("¿Eliminar la tarea «" + t.nombre + "» con sus subtareas, horas y entregables?")) return;
      pr().tareas.splice(pr().tareas.indexOf(t), 1);
      R().estructura(); R().entregables(); R().datos(); APP().guardar();
    },
    "subir-tarea": b => mover("tarea", idDe(b), -1),
    "bajar-tarea": b => mover("tarea", idDe(b), 1),

    "nueva-sub": b => {
      const t = M().buscarTarea(pr(), idDe(b)); if (!t) return;
      t.subtareas.push(M().nuevaSub("Subtarea " + (N().lista(t.subtareas).length + 1)));
      R().estructura(); APP().guardar();
    },
    "dup-sub": b => {
      const r = M().buscarSub(pr(), idDe(b)); if (!r) return;
      const c = clonarSub(r.sub);
      c.nombre = r.sub.nombre + " (copia)";
      r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub) + 1, 0, c);
      R().estructura(); R().datos(); APP().guardar();
    },
    "elim-sub": b => {
      const r = M().buscarSub(pr(), idDe(b)); if (!r) return;
      if (!confirm("¿Eliminar la subtarea «" + r.sub.nombre + "» con sus horas?")) return;
      r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub), 1);
      R().estructura(); R().datos(); APP().guardar();
    },
    "subir-sub": b => mover("sub", idDe(b), -1),
    "bajar-sub": b => mover("sub", idDe(b), 1),
    "toggle-sub": b => {
      const r = M().buscarSub(pr(), idDe(b)); if (!r) return;
      r.sub._abierta = !r.sub._abierta;
      R().estructura();
    },
    "abrir-todo": () => { N().lista(pr().tareas).forEach(t => N().lista(t.subtareas).forEach(s => { s._abierta = true; })); R().estructura(); },
    "cerrar-todo": () => { N().lista(pr().tareas).forEach(t => N().lista(t.subtareas).forEach(s => { s._abierta = false; })); R().estructura(); },

    "nueva-linea": b => {
      const r = M().buscarSub(pr(), idDe(b)); if (!r) return;
      const p0 = N().lista(pf())[0];
      r.sub.lineas.push(M().nuevaLinea(p0 ? p0.id : "", C().mesesProyecto(pr())));
      r.sub._abierta = true;
      R().estructura(); R().datos(); APP().guardar();
    },
    "elim-linea": b => {
      const r = M().buscarLinea(pr(), idDe(b)); if (!r) return;
      r.sub.lineas.splice(r.sub.lineas.indexOf(r.linea), 1);
      R().estructura(); R().datos(); APP().guardar();
    },

    /* --- Entregables --- */
    "nuevo-entregable-tarea": b => {
      const t = M().buscarTarea(pr(), idDe(b)); if (!t) return;
      const e = M().colgarEntregable(pr(), "Entregable " + (N().lista(t.entregables).length + 1), "tarea", 0, t.id);
      e.responsablePerfilId = "";
      R().estructura(); R().entregables(); R().datos(); APP().guardar();
      APP().toast("Entregable añadido a la tarea");
    },
    "nuevo-entregable-oferta": () => {
      M().colgarEntregable(pr(), "Hito de la oferta " + (N().lista(pr().entregables).length + 1), "oferta", 0, null);
      R().entregables(); R().cronograma(); R().datos(); APP().guardar();
      APP().toast("Entregable de oferta añadido");
    },
    "dup-entregable": b => {
      const r = M().buscarEntregable(pr(), idDe(b), tareaDe(b)); if (!r) return;
      const c = N().clonar(r.entregable);
      c.id = N().uid("en_");
      c.nombre = r.entregable.nombre + " (copia)";
      r.contenedor.splice(r.contenedor.indexOf(r.entregable) + 1, 0, c);
      R().estructura(); R().entregables(); R().datos(); APP().guardar();
    },
    "elim-entregable": b => {
      const r = M().buscarEntregable(pr(), idDe(b), tareaDe(b)); if (!r) return;
      if (!confirm("¿Eliminar el entregable «" + r.entregable.nombre + "»?")) return;
      r.contenedor.splice(r.contenedor.indexOf(r.entregable), 1);
      R().estructura(); R().entregables(); R().cronograma(); R().datos(); APP().guardar();
    },

    /* --- Plantillas --- */
    "plantilla-dialogo": () => {
      const lista = N().lista(APP().ESTADO.plantillas);
      PL.vistas.escribir("pa-modal-plantillas-lista", lista.length
        ? lista.map(pl =>
          '<div class="pa-fila-dato">' +
          '<span class="pa-crece2"><strong>' + N().esc(pl.nombre) + "</strong><br><span class=\"pa-mini\">" +
          N().esc(pl.desc || "") + " · " + N().lista(pl.tareas).length + " tareas · " +
          N().suma(pl.tareas, t => N().lista(t.entregables).length) + " entregables</span></span>" +
          '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="aplicar-plantilla" data-id="' + pl.id + '">Aplicar</button>' +
          "</div>").join("")
        : '<p class="pa-mini">No hay plantillas guardadas.</p>');
      const modal = PL.vistas.nodo("pa-modal-plantillas");
      if (modal) modal.checked = true;
    },
    "cerrar-modal-plantillas": () => { const m = PL.vistas.nodo("pa-modal-plantillas"); if (m) m.checked = false; },
    "aplicar-plantilla": b => {
      const pl = N().lista(APP().ESTADO.plantillas).filter(x => x.id === idDe(b))[0];
      if (!pl) return;
      const reem = PL.vistas.nodo("pa-modal-plantillas-reem");
      const reemplazar = !!(reem && reem.checked);
      const nTareas = N().lista(pr().tareas).length;
      if (nTareas && !reemplazar && !confirm("¿Añadir las " + pl.tareas.length + " tareas de «" + pl.nombre + "» a la oferta actual?")) return;
      if (reemplazar && nTareas && !confirm("¿REEMPLAZAR las " + nTareas + " tareas actuales por la plantilla «" + pl.nombre + "»?")) return;
      const nuevas = N().lista(pl.tareas).map(t => {
        const ta = M().nuevaTarea(t.nombre);
        ta.subtareas = N().lista(t.subtareas).map(s => M().nuevaSub(s));
        ta.entregables = N().lista(t.entregables).map(e => Object.assign(M().nuevoEntregable(e.nombre, "tarea", e.mes), {
          descripcion: e.descripcion || "", criterio: e.criterio || "", facturacionPct: N().num(e.facturacionPct)
        }));
        return ta;
      });
      pr().tareas = reemplazar ? nuevas : N().lista(pr().tareas).concat(nuevas);
      acc["cerrar-modal-plantillas"]();
      R().todo();
      APP().guardar();
      APP().toast(reemplazar ? "Estructura reemplazada por la plantilla" : "Plantilla aplicada: " + nuevas.length + " tareas");
    },
    "guardar-plantilla": () => {
      const o = pr();
      if (!N().lista(o.tareas).length) { APP().toast("La oferta activa no tiene tareas que guardar"); return; }
      const nombre = prompt("Nombre de la plantilla:", "Plantilla — " + o.nombre);
      if (!nombre) return;
      APP().ESTADO.plantillas.push(M().normalizarPlantilla({
        id: N().uid("pl_"), nombre: nombre, desc: "Guardada desde «" + o.nombre + "»", esDefecto: false,
        tareas: N().lista(o.tareas).map(t => ({
          nombre: t.nombre,
          subtareas: N().lista(t.subtareas).map(s => s.nombre),
          entregables: N().lista(t.entregables).map(e => ({
            nombre: e.nombre, descripcion: e.descripcion, criterio: e.criterio, mes: e.mes, facturacionPct: e.facturacionPct
          }))
        }))
      }));
      R().ajustes();
      APP().guardar();
      APP().toast("Plantilla guardada: " + nombre);
    },
    "elim-plantilla": b => {
      if (!confirm("¿Eliminar esta plantilla?")) return;
      APP().ESTADO.plantillas = N().lista(APP().ESTADO.plantillas).filter(x => x.id !== idDe(b));
      R().ajustes(); APP().guardar();
    },
    "restaurar-plantillas-defecto": () => {
      if (!confirm("¿Recuperar la plantilla de fábrica? (las tuyas se conservan)")) return;
      N().lista(PL.ejemplo.plantillasDefecto()).forEach(d => {
        if (!N().lista(APP().ESTADO.plantillas).some(x => x.id === d.id)) APP().ESTADO.plantillas.push(d);
      });
      R().ajustes(); APP().guardar(); APP().toast("Plantilla de fábrica disponible");
    },

    /* --- Perfiles --- */
    "nuevo-perfil": () => { APP().ESTADO.perfiles.push(M().nuevoPerfil("Perfil nuevo", 0, "Otro", false)); R().ajustes(); APP().guardar(); },
    "elim-perfil": b => {
      const id = idDe(b);
      const p = C().perfilPorId(APP().ESTADO.perfiles, id) || C().perfilPorId(APP().ESTADO.perfilesInactivos, id);
      if (!p) return;
      const usos = C().usosPerfil(APP().ESTADO.proyectos, id);
      if (usos > 0) {
        if (!confirm("«" + p.nombre + "» se usa en " + usos + " sitio(s). ¿Desactivarlo? Sus horas se conservan y puedes reactivarlo después.")) return;
        APP().ESTADO.perfiles = APP().ESTADO.perfiles.filter(x => x.id !== id);
        APP().ESTADO.perfilesInactivos.push(p);
      } else {
        if (!confirm("¿Eliminar el perfil «" + p.nombre + "»?")) return;
        APP().ESTADO.perfiles = APP().ESTADO.perfiles.filter(x => x.id !== id);
        APP().ESTADO.perfilesInactivos = APP().ESTADO.perfilesInactivos.filter(x => x.id !== id);
      }
      R().ajustes(); R().todo(); APP().guardar();
    },
    "reactivar-perfil": b => {
      const p = N().lista(APP().ESTADO.perfilesInactivos).filter(x => x.id === idDe(b))[0];
      if (!p) return;
      APP().ESTADO.perfilesInactivos = APP().ESTADO.perfilesInactivos.filter(x => x.id !== idDe(b));
      APP().ESTADO.perfiles.push(p);
      R().ajustes(); R().todo(); APP().guardar();
    },
    "restaurar-perfil": b => {
      const id = idDe(b);
      const actual = C().perfilPorId(APP().ESTADO.perfiles, id);
      if (!actual || !actual.esDefecto) return;
      const orig = N().lista(PL.ejemplo.perfilesDefecto()).filter(x => x.id === id)[0];
      if (!orig) { APP().toast("Este perfil ya no es de fábrica"); return; }
      if (!confirm("¿Restaurar «" + actual.nombre + "» a sus valores de fábrica?")) return;
      actual.nombre = orig.nombre; actual.tarifa = orig.tarifa; actual.categoria = orig.categoria; actual.unidades = orig.unidades;
      R().ajustes(); R().todo(); APP().guardar(); APP().toast("Perfil restaurado");
    },
    "restaurar-perfiles-defecto": () => {
      if (!confirm("¿Añadir los 7 perfiles de fábrica que falten? Los tuyos se conservan.")) return;
      N().lista(PL.ejemplo.perfilesDefecto()).forEach(d => {
        if (!C().perfilPorId(APP().ESTADO.perfiles, d.id) && !C().perfilPorId(APP().ESTADO.perfilesInactivos, d.id)) APP().ESTADO.perfiles.push(d);
      });
      R().ajustes(); APP().guardar(); APP().toast("Perfiles de fábrica disponibles");
    },

    /* --- Escenarios y versiones --- */
    "escenario-abrir": () => { const m = PL.vistas.nodo("pa-modal-escenario"); if (m) m.checked = true; },
    "escenario-guardar": () => {
      const nom = PL.vistas.nodo("pa-esc-nombre");
      const nota = PL.vistas.nodo("pa-esc-nota");
      const nombre = (nom && nom.value || "").trim();
      if (!nombre) { APP().toast("Ponle un nombre al escenario"); if (nom) nom.focus(); return; }
      X().crearEscenario(pr(), nombre, (nota && nota.value || "").trim());
      if (nom) nom.value = ""; if (nota) nota.value = "";
      const m = PL.vistas.nodo("pa-modal-escenario"); if (m) m.checked = false;
      R().escenarios();
      APP().guardar();
      APP().toast("Escenario guardado: " + nombre);
    },
    "escenario-comparar": b => {
      const e = N().lista(pr().escenarios).filter(x => x.id === idDe(b))[0];
      if (!e) return;
      APP().ui.comparacion = {
        cmp: X().comparar(pr(), pf(), e.snapshot, X().foto(pr()), e.nombre, "Oferta actual")
      };
      APP().pestana("escenarios");
      R().escenarios();
    },
    "escenario-aplicar": b => {
      const e = N().lista(pr().escenarios).filter(x => x.id === idDe(b))[0];
      if (!e) return;
      if (!confirm("¿Aplicar el escenario «" + e.nombre + "» a la oferta?\n\nSe descargará antes una copia del estado actual.")) return;
      copiaAntes("aplicar-escenario");
      X().aplicarFoto(pr(), e.snapshot);
      APP().ui.comparacion = null;
      R().todo(); APP().guardar(); APP().toast("Escenario aplicado: " + e.nombre);
    },
    "escenario-borrar": b => {
      const e = N().lista(pr().escenarios).filter(x => x.id === idDe(b))[0];
      if (!e || !confirm("¿Eliminar el escenario «" + e.nombre + "»?")) return;
      X().borrarEscenario(pr(), idDe(b));
      APP().ui.comparacion = null;
      R().escenarios(); APP().guardar();
    },
    "escenario-cerrar-comparacion": () => { APP().ui.comparacion = null; R().escenarios(); },

    "version-abrir": () => { const m = PL.vistas.nodo("pa-modal-version"); if (m) m.checked = true; },
    "version-guardar": () => {
      const et = PL.vistas.nodo("pa-ver-etiqueta");
      const no = PL.vistas.nodo("pa-ver-nota");
      const etiqueta = (et && et.value || "").trim() || ("v" + (N().lista(pr().versiones).length + 1));
      X().crearVersion(pr(), pf(), etiqueta, (no && no.value || "").trim());
      if (et) et.value = ""; if (no) no.value = "";
      const m = PL.vistas.nodo("pa-modal-version"); if (m) m.checked = false;
      R().escenarios(); APP().guardar(); APP().toast("Versión congelada: " + etiqueta);
    },
    "version-comparar": b => {
      const v = N().lista(pr().versiones).filter(x => x.id === idDe(b))[0];
      if (!v) return;
      APP().ui.comparacion = { cmp: X().comparar(pr(), pf(), v.snapshot, X().foto(pr()), v.etiqueta, "Oferta actual") };
      APP().pestana("escenarios");
      R().escenarios();
    },
    "version-aplicar": b => {
      const v = N().lista(pr().versiones).filter(x => x.id === idDe(b))[0];
      if (!v) return;
      if (!confirm("¿Restaurar la oferta tal y como estaba en «" + v.etiqueta + "»?\n\nSe descargará antes una copia del estado actual. Las versiones y escenarios se conservan.")) return;
      copiaAntes("restaurar-version");
      const esc = N().lista(pr().escenarios), ver = N().lista(pr().versiones);
      X().aplicarFoto(pr(), v.snapshot);
      pr().escenarios = esc; pr().versiones = ver;
      APP().ui.comparacion = null;
      R().todo(); APP().guardar(); APP().toast("Versión restaurada: " + v.etiqueta);
    },
    "version-borrar": b => {
      const v = N().lista(pr().versiones).filter(x => x.id === idDe(b))[0];
      if (!v || !confirm("¿Eliminar la versión «" + v.etiqueta + "»?")) return;
      X().borrarVersion(pr(), idDe(b));
      R().escenarios(); APP().guardar();
    },

    /* --- Gastos --- */
    "nuevo-gasto": () => { pr().gastos.push({ id: N().uid("g_"), nombre: "Concepto", unidades: 1, precio: 0 }); R().gastos(); R().datos(); APP().guardar(); },
    "elim-gasto": b => {
      pr().gastos = N().lista(pr().gastos).filter(g => g.id !== idDe(b));
      R().gastos(); R().datos(); APP().guardar();
    },

    /* --- Cabecera, guía, importes --- */
    "toggle-importes": () => {
      APP().ESTADO.mostrarImportes = !APP().ESTADO.mostrarImportes;
      R().todo(); APP().guardar();
      APP().toast(APP().ESTADO.mostrarImportes ? "Importes visibles" : "Modo solo tiempos: importes ocultos");
    },
    "cerrar-guia": () => { APP().ESTADO.guiaVista = true; R().estructura(); APP().guardar(); },

    /* --- Logo --- */
    "cargar-logo": () => { const f = PL.vistas.nodo("pa-logo-fichero"); if (f) f.click(); },
    "quitar-logo": () => { APP().ESTADO.marca.logo = ""; R().cabecera(); R().ajustes(); APP().guardar(); APP().toast("Logo quitado"); },

    /* --- Exportar / importar --- */
    "exp-json-proy": () => { A().exportarProyecto(pr(), pf()); APP().toast("Oferta exportada"); },
    "exp-json-todo": () => { A().exportarTodo(APP().ESTADO); APP().toast("Copia de seguridad descargada"); },
    "exp-biblio": () => { A().exportarBiblioteca(APP().ESTADO); APP().toast("Biblioteca exportada"); },
    "exp-csv": () => { A().descargar(A().nombreFichero(pr().nombre, "csv"), A().csvProyecto(pr(), pf(), APP().moneda(), APP().verImportes()), "text/csv;charset=utf-8"); APP().toast("CSV exportado"); },
    "imp-json": () => { const f = PL.vistas.nodo("pa-fichero"); if (f) f.click(); },
    "imprimir": () => {
      APP().pestana("informe");
      R().informe();
      setTimeout(() => { try { window.print(); } catch (e) { APP().toast("Imprime con Ctrl+P"); } }, 60);
    },

    /* --- Datos --- */
    "limpiar-heredados": () => {
      if (!confirm("¿Borrar los datos de versiones anteriores guardados en este navegador? La app seguirá con los actuales.")) return;
      A().olvidarHeredados();
      R().ajustes(); APP().toast("Datos antiguos borrados");
    },
    "restaurar-ejemplo": () => {
      if (!confirm("¿Volver al ejemplo de inicio? Se reemplazan los datos actuales (antes se descarga una copia).")) return;
      copiaAntes("restaurar-ejemplo");
      const e = M().estadoInicial();
      e.activo = e.proyectos[0].id;
      APP().reemplazarEstado(e, "estructura");
      APP().toast("Ejemplo de inicio restaurado");
    },
    "borrar-todo": () => {
      if (!confirm("¿BORRAR todos los datos? Se queda una app vacía (antes se descarga una copia de seguridad).")) return;
      copiaAntes("borrar-todo");
      const e = M().estadoInicial();
      e.proyectos = [M().nuevoProyecto("Mi primera oferta")];
      e.perfiles = [];
      e.plantillas = [];
      e.plantillasOferta = [];
      e.guiaVista = true;
      e.activo = e.proyectos[0].id;
      APP().reemplazarEstado(e, "estructura");
      APP().toast("Datos borrados");
    }
  };

  function mover(que, id, dir) {
    const o = pr();
    if (que === "tarea") {
      const arr = o.tareas, i = arr.findIndex(t => t.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    } else {
      const r = M().buscarSub(o, id); if (!r) return;
      const arr = r.tarea.subtareas, i = arr.indexOf(r.sub), j = i + dir;
      if (j < 0 || j >= arr.length) return;
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    R().estructura(); R().datos(); APP().guardar();
  }

  PL.acc = acc;
  PL.acciones = { copiaAntes: copiaAntes, mover: mover, clonarTarea: clonarTarea, clonarSub: clonarSub };
})(typeof window !== "undefined" ? window : globalThis);
