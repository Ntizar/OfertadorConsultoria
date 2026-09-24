"use strict";
/* =====================================================================
   Planifica v4 — ALMACÉN
   Persistencia en el navegador, importación/exportación (JSON y CSV) y
   detección de datos heredados de versiones anteriores.

   Único módulo que habla con localStorage y el único que provoca descargas.
   No pinta nada.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  const tieneLS = () => {
    try { return typeof localStorage !== "undefined" && !!localStorage; } catch (e) { return false; }
  };

  /* ---------- Cargar y guardar ---------- */

  /**
   * Lee el estado guardado. Si solo hay datos de versiones anteriores, los
   * migra y lo indica en `heredado` para que la app avise.
   * Devuelve {estado, origen, heredado, aviso}.
   */
  function cargar() {
    const M2 = M();
    if (!tieneLS()) return { estado: M2.estadoInicial(), origen: 0, heredado: false, aviso: "" };

    let bruto = null;
    try { bruto = localStorage.getItem(M2.CLAVE); } catch (e) { bruto = null; }
    if (bruto) {
      try {
        const d = JSON.parse(bruto);
        if (d && (Array.isArray(d.ofertas) || Array.isArray(d.proyectos))) {
          return { estado: M2.normalizarEstado(d), origen: M2.VERSION_DATOS, heredado: false, aviso: "" };
        }
      } catch (e) { /* datos corruptos: se intenta con los antiguos */ }
    }

    for (let i = 0; i < M2.CLAVES_ANTIGUAS.length; i++) {
      let viejo = null;
      try { viejo = localStorage.getItem(M2.CLAVES_ANTIGUAS[i]); } catch (e) { viejo = null; }
      if (!viejo) continue;
      try {
        const d = JSON.parse(viejo);
        const ofertas = d && (d.ofertas || d.proyectos);
        if (Array.isArray(ofertas)) {
          /* Hay datos de una versión anterior y todavía no hay datos v4: NO se
             imponen. La aplicación arranca con la oferta de ejemplo y los datos
             antiguos quedan disponibles para traerlos, copiarlos o descartarlos
             (así se empieza limpio sin perder nada). */
          const r = M2.migrar(d);
          return {
            estado: null, migrado: M2.normalizarEstado(r.estado), origen: r.origen, heredado: true,
            aviso: ""   /* el aviso (con sus tres salidas) lo pinta el arranque */
          };
        }
      } catch (e) { /* se prueba con la siguiente clave */ }
    }

    return { estado: M2.estadoInicial(), origen: 0, heredado: false, aviso: "" };
  }

  /** Los datos de versiones anteriores, migrados a la versión actual, o null.
      No toca nada: sólo lee y traduce. */
  function leerHeredado() {
    const M2 = M();
    if (!tieneLS()) return null;
    for (let i = 0; i < M2.CLAVES_ANTIGUAS.length; i++) {
      let viejo = null;
      try { viejo = localStorage.getItem(M2.CLAVES_ANTIGUAS[i]); } catch (e) { viejo = null; }
      if (!viejo) continue;
      try {
        const d = JSON.parse(viejo);
        if (d && Array.isArray(d.ofertas || d.proyectos)) return M2.normalizarEstado(M2.migrar(d).estado);
      } catch (e) { /* se prueba con la siguiente clave */ }
    }
    return null;
  }

  function datosHeredados() {
    const M2 = M();
    if (!tieneLS()) return [];
    const out = [];
    M2.CLAVES_ANTIGUAS.forEach(k => {
      let v = null;
      try { v = localStorage.getItem(k); } catch (e) { v = null; }
      if (v) out.push(k);
    });
    return out;
  }

  function guardar(estado) {
    const M2 = M();
    if (!tieneLS()) return "sin almacenamiento disponible";
    try {
      estado.version = M2.VERSION_DATOS;
      localStorage.setItem(M2.CLAVE, JSON.stringify(estado));
      return "";
    } catch (e) {
      return (e && e.name === "QuotaExceededError")
        ? "almacenamiento lleno (descarga una copia y borra ofertas antiguas)"
        : "no se pudo guardar";
    }
  }

  function olvidarHeredados() {
    const M2 = M();
    if (!tieneLS()) return;
    M2.CLAVES_ANTIGUAS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } });
  }

  /* ---------- Descargas ---------- */

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* nada */ } a.remove(); }, 400);
  }

  function nombreFichero(base, ext) { return N().slug(base) + "-" + N().hoyISO() + "." + ext; }

  function exportarOferta(o) {
    descargar(nombreFichero(o.nombre, "json"),
      JSON.stringify({ tipo: "planifica-oferta", version: M().VERSION_DATOS, oferta: o }, null, 2), "application/json");
  }

  function exportarTodo(estado) {
    descargar("planifica-datos-" + N().hoyISO() + ".json", JSON.stringify(estado, null, 2), "application/json");
  }

  function exportarBiblioteca(estado) {
    descargar("planifica-biblioteca-" + N().hoyISO() + ".json",
      JSON.stringify({
        tipo: "planifica-biblioteca", version: M().VERSION_DATOS,
        perfiles: estado.perfiles, perfilesInactivos: estado.perfilesInactivos, plantillas: estado.plantillas
      }, null, 2), "application/json");
  }

  /* ---------- CSV ---------- */

  /** CSV de la oferta: `;`, coma decimal y BOM, para Excel en español. */
  function csvOferta(o, pf, mostrarImportes) {
    const sep = ";";
    const n = P().meses(o.periodos);
    const imp = mostrarImportes !== false;
    const cell = v => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
    const numES = v => String(N().r2(v)).replace(".", ",");

    const f = [];
    f.push(["Oferta", o.nombre]);
    f.push(["Cliente", (o.cliente && o.cliente.nombre) || ""]);
    f.push(["Contacto", (o.cliente && o.cliente.contacto) || ""]);
    f.push(["Referencia", (o.cliente && o.cliente.ref) || ""]);
    f.push(["Estado", (M().ESTADOS_OFERTA[o.estado] || {}).texto || ""]);
    f.push(["Fecha", o.fecha || ""]);
    f.push(["Validez", P().duracionLegible(o.periodos)]);
    f.push(["Condiciones de pago", o.condicionesPago || ""]);
    f.push([]);

    /* Cabecera de periodos: banda de año y rótulo editado */
    const cols = P().columnas(o.periodos);
    f.push(["CALENDARIO"].concat(cols.map(c => cell([].concat(c.periodos.map(i => P().etiqueta(o.periodos, i))).join(" + ")))));
    f.push(["Año"].concat(cols.map(c => c.anio)));

    /* Esfuerzo */
    f.push(["Tarea", "Subtarea", "Perfil"].concat(Array.from({ length: n }, (_, i) => P().etiqueta(o.periodos, i)))
      .concat(["Total horas", "Tarifa", "Importe"]));
    N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      const p = C().perfilPorId(pf, l.perfilId);
      f.push(["Esfuerzo", t.nombre, s.nombre, p ? p.nombre : "(sin perfil)"]
        .concat(Array.from({ length: n }, (_, i) => numES(N().num((l.horas || {})["p" + i]))))
        .concat([numES(C().lineaHoras(l)), imp ? numES(p ? p.tarifa : 0) : "", imp ? numES(C().lineaImporte(l, pf)) : ""]));
    })));
    f.push([]);

    /* Entregables */
    const ents = E().todos(o);
    if (ents.length) {
      f.push(["ENTREGABLES", "Entregable", "Origen", "Entrega", "Fecha", "Responsable", "Criterio de aceptación", "Horas estimadas"]);
      ents.forEach(e => {
        const r = E().responsable(pf, e);
        f.push(["Entregable", e.nombre, e._contexto === "oferta" ? "Oferta" : e._tareaNombre,
          P().mesCorto(o.periodos, e.periodo), e.fecha || "", r ? r.nombre : "", e.criterio || "", numES(e.horas)]);
      });
      f.push([]);
    }

    /* Totales */
    const linea = (texto_, valor) => f.push([texto_, "", "", "", "", "", "", imp ? numES(valor) : ""]);
    linea("Consultoría", C().importeOferta(o, pf));
    if (C().gastosTotal(o)) linea("Gastos generales", C().gastosTotal(o));
    linea("Subtotal", C().subtotalOferta(o, pf));
    if (o.descuento && o.descuento.tipo) linea("Descuento", -C().descuentoImporte(o, pf));
    linea("Base imponible", C().baseImponible(o, pf));
    if (C().nombreImpuesto(o)) linea(C().nombreImpuesto(o) + " " + N().num(o.impuestos.tasa) + " %", C().impuestoImporte(o, pf));
    linea("TOTAL", C().totalOferta(o, pf));

    return "\uFEFF" + f.map(fila => fila.map(cell).join(sep)).join("\r\n");
  }

  /* ---------- Importación ---------- */

  function analizarImportacion(texto_) {
    let d = null;
    try { d = JSON.parse(texto_); }
    catch (e) { return { ok: false, error: "El archivo no es un JSON válido." }; }
    if (!d || typeof d !== "object") return { ok: false, error: "El JSON no contiene datos de Planifica." };

    if ((d.tipo === "planifica-oferta" || d.tipo === "planifica-proyecto") && (d.oferta || d.proyecto)) {
      return { ok: true, tipo: "oferta", datos: d.oferta || d.proyecto };
    }
    if (d.tipo === "planifica-biblioteca") return { ok: true, tipo: "biblioteca", datos: d };
    const ofertas = d.ofertas || d.proyectos;
    if (Array.isArray(ofertas)) {
      const origen = (d.version === 4) ? 4 : ((d.version === 3 || d.version === 2) ? d.version : 1);
      return { ok: true, tipo: "estado", origen: origen, datos: d };
    }
    return { ok: false, error: "Formato no reconocido: se espera una oferta, una biblioteca o una copia completa de Planifica." };
  }

  function aplicarImportacion(estado, analisis, opciones) {
    const M2 = M();
    const o = opciones || {};
    const r = { estado: estado, mensaje: "", ofertas: 0, perfiles: 0, plantillas: 0 };
    if (!analisis || !analisis.ok) { r.mensaje = (analisis && analisis.error) || "Importación no válida."; return r; }

    if (analisis.tipo === "oferta") {
      const nueva = M2.normalizarOferta(analisis.datos, false);
      const i = estado.ofertas.findIndex(x => x.id === nueva.id);
      if (i >= 0) estado.ofertas[i] = nueva; else estado.ofertas.push(nueva);
      estado.activa = nueva.id;
      r.ofertas = 1;
      r.mensaje = "Oferta importada: " + nueva.nombre;
      return r;
    }

    if (analisis.tipo === "biblioteca") {
      (analisis.datos.perfiles || []).forEach(p0 => {
        const p = M2.normalizarPerfil(p0);
        if (!C().perfilPorId(estado.perfiles, p.id) && !C().perfilPorId(estado.perfilesInactivos, p.id)) { estado.perfiles.push(p); r.perfiles++; }
      });
      (analisis.datos.perfilesInactivos || []).forEach(p0 => {
        const p = M2.normalizarPerfil(p0);
        if (!C().perfilPorId(estado.perfiles, p.id) && !C().perfilPorId(estado.perfilesInactivos, p.id)) { estado.perfilesInactivos.push(p); r.perfiles++; }
      });
      (analisis.datos.plantillas || []).forEach(p0 => {
        const pl = M2.normalizarPlantilla(p0);
        if (!N().lista(estado.plantillas).some(x => x.id === pl.id)) { estado.plantillas.push(pl); r.plantillas++; }
      });
      r.mensaje = "Biblioteca importada: " + r.perfiles + " perfil(es) y " + r.plantillas + " plantilla(s).";
      return r;
    }

    const mig = M2.migrar(analisis.datos);
    const nuevo = M2.normalizarEstado(mig.estado);
    if (o.reemplazar) {
      if (o.aplicarMarca !== false && nuevo.marca) estado.marca = nuevo.marca;
      estado.perfiles = nuevo.perfiles;
      estado.perfilesInactivos = nuevo.perfilesInactivos;
      estado.plantillas = nuevo.plantillas.length ? nuevo.plantillas : M2.estadoInicial().plantillas;
      estado.ofertas = nuevo.ofertas;
      estado.activa = nuevo.activa;
      r.ofertas = nuevo.ofertas.length;
      r.mensaje = "Datos reemplazados: " + r.ofertas + " oferta(s)" + (mig.origen < 4 ? ", migradas desde la versión " + mig.origen : "") + ".";
    } else {
      (nuevo.perfiles || []).forEach(p => { if (!C().perfilPorId(estado.perfiles, p.id)) { estado.perfiles.push(p); r.perfiles++; } });
      (nuevo.plantillas || []).forEach(pl => { if (!N().lista(estado.plantillas).some(x => x.id === pl.id)) { estado.plantillas.push(pl); r.plantillas++; } });
      (nuevo.ofertas || []).forEach(of => {
        const i = estado.ofertas.findIndex(x => x.id === of.id);
        if (i >= 0) estado.ofertas[i] = of; else estado.ofertas.push(of);
        r.ofertas++;
      });
      /* Al fusionar, se activa la última oferta importada: el usuario quiere ver
         sus datos, no seguir mirando el ejemplo. */
      const importadas = N().lista(nuevo.ofertas);
      if (importadas.length) estado.activa = importadas[importadas.length - 1].id;
      else if (!estado.ofertas.some(x => x.id === estado.activa)) estado.activa = estado.ofertas[0].id;
      r.mensaje = "Fusionado: " + r.ofertas + " oferta(s) y " + r.perfiles + " perfil(es) nuevo(s).";
    }
    return r;
  }

  PL.almacen = {
    tieneLS: tieneLS, cargar: cargar, guardar: guardar, datosHeredados: datosHeredados, leerHeredado: leerHeredado,
    olvidarHeredados: olvidarHeredados, descargar: descargar, nombreFichero: nombreFichero,
    exportarOferta: exportarOferta, exportarTodo: exportarTodo, exportarBiblioteca: exportarBiblioteca,
    csvOferta: csvOferta, analizarImportacion: analizarImportacion, aplicarImportacion: aplicarImportacion
  };
})(typeof window !== "undefined" ? window : globalThis);
