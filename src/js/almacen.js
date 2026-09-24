"use strict";
/* =====================================================================
   Planifica v3 — ALMACÉN
   Persistencia en el navegador, importación/exportación (JSON y CSV) y
   detección de datos heredados de versiones antiguas.

   Es el único módulo que habla con localStorage y el único que provoca
   descargas (crea un <a> temporal). No pinta nada.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  const tieneLS = () => {
    try { return typeof localStorage !== "undefined" && !!localStorage; } catch (e) { return false; }
  };

  /* ---------- Carga y guardado ---------- */

  /**
   * Lee el estado guardado. Si solo hay datos de versiones anteriores (v1/v2),
   * los migra y lo indica en `heredado` para que la app avise al usuario.
   * Devuelve {estado, origen, heredado, aviso}.
   */
  function cargar() {
    const M2 = M();
    if (!tieneLS()) return { estado: M2.estadoInicial(), origen: 0, heredado: false, aviso: "" };

    /* 1) Estado actual (v3) */
    let bruto = null;
    try { bruto = localStorage.getItem(M2.CLAVE); } catch (e) { bruto = null; }
    if (bruto) {
      try {
        const d = JSON.parse(bruto);
        if (d && Array.isArray(d.proyectos)) {
          return { estado: M2.normalizarEstado(d), origen: M2.VERSION_DATOS, heredado: false, aviso: "" };
        }
      } catch (e) { /* datos corruptos: se intenta con los antiguos */ }
    }

    /* 2) Datos antiguos (v2 o v1) */
    for (let i = 0; i < M2.CLAVES_ANTIGUAS.length; i++) {
      let viejo = null;
      try { viejo = localStorage.getItem(M2.CLAVES_ANTIGUAS[i]); } catch (e) { viejo = null; }
      if (!viejo) continue;
      try {
        const d = JSON.parse(viejo);
        if (d && Array.isArray(d.proyectos)) {
          const r = M2.migrar(d);
          return {
            estado: M2.normalizarEstado(r.estado), origen: r.origen, heredado: true,
            aviso: "Datos de la versión " + r.origen + " migrados a la actual (" + r.estado.proyectos.length + " oferta(s), " + r.estado.perfiles.length + " perfil(es))."
          };
        }
      } catch (e) { /* se prueba la siguiente clave */ }
    }

    return { estado: M2.estadoInicial(), origen: 0, heredado: false, aviso: "" };
  }

  /** ¿Quedan datos de versiones anteriores en el navegador? */
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

  /** Guarda el estado. Devuelve "" si fue bien o el motivo del fallo. */
  function guardar(estado) {
    const M2 = M();
    if (!tieneLS()) return "sin almacenamiento";
    try {
      estado.version = M2.VERSION_DATOS;
      localStorage.setItem(M2.CLAVE, JSON.stringify(estado));
      return "";
    } catch (e) {
      return (e && e.name === "QuotaExceededError")
        ? "almacenamiento lleno (borra ofertas antiguas o descarga una copia)"
        : "no se pudo guardar";
    }
  }

  /** Limpia las claves de versiones anteriores (tras avisar y respaldar). */
  function olvidarHeredados() {
    const M2 = M();
    if (!tieneLS()) return;
    M2.CLAVES_ANTIGUAS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } });
  }

  /* ---------- Descarga de ficheros ---------- */

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

  const nombreFichero = (base, ext) => N().slug(base) + "-" + N().hoyISO() + "." + ext;

  /* ---------- Exportación ---------- */

  function exportarProyecto(pr, pf) {
    descargar(nombreFichero(pr.nombre, "json"),
      JSON.stringify({ tipo: "planifica-proyecto", version: M().VERSION_DATOS, proyecto: pr }, null, 2),
      "application/json");
  }

  function exportarTodo(estado) {
    descargar("planifica-datos-" + N().hoyISO() + ".json", JSON.stringify(estado, null, 2), "application/json");
  }

  function exportarBiblioteca(estado) {
    descargar("planifica-biblioteca-" + N().hoyISO() + ".json",
      JSON.stringify({
        tipo: "planifica-biblioteca", version: M().VERSION_DATOS,
        perfiles: estado.perfiles, perfilesInactivos: estado.perfilesInactivos, plantillas: estado.plantillas
      }, null, 2),
      "application/json");
  }

  /** CSV de la oferta: `;`, coma decimal y BOM para que Excel lo abra en español. */
  function csvProyecto(pr, pf, moneda, mostrarImportes) {
    const sep = ";";
    const meses = C().mesesProyecto(pr);
    const imp = mostrarImportes !== false;
    const cell = v => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
    const numES = v => String(N().r2(v)).replace(".", ",");

    const filas = [];
    filas.push(["Oferta", pr.nombre]);
    filas.push(["Cliente", (pr.cliente && pr.cliente.nombre) || ""]);
    filas.push(["Referencia", (pr.cliente && pr.cliente.ref) || ""]);
    filas.push(["Estado", (M().ESTADOS_OFERTA[pr.estado] || {}).texto || ""]);
    filas.push(["Fecha", pr.fecha || ""]);
    filas.push(["Válida hasta", N().fechaValidez(pr)]);
    filas.push(["Duración", meses + " meses desde " + N().etiquetaMes(pr.fechaInicio, 0)]);
    filas.push([]);

    /* Detalle de esfuerzo */
    filas.push(["BLOQUE", "Tarea", "Subtarea", "Perfil"].concat(
      Array.from({ length: meses }, (_, i) => N().etiquetaMes(pr.fechaInicio, i))
    ).concat(["Total horas", "Tarifa", "Importe"]));
    N().lista(pr.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      const p = C().perfilPorId(pf, l.perfilId);
      filas.push(["Horas", t.nombre, s.nombre, p ? p.nombre : "(sin perfil)"].concat(
        Array.from({ length: meses }, (_, i) => numES(N().num((l.horas || {})["m" + i])))
      ).concat([
        numES(C().lineaHoras(l)),
        imp ? numES(p ? p.tarifa : 0) : "",
        imp ? numES(C().lineaImporte(l, pf)) : ""
      ]));
    })));
    filas.push([]);

    /* Entregables */
    const plan = E().planFacturacion(pr, pf);
    if (plan.length) {
      filas.push(["ENTREGABLES", "Entregable", "Dónde", "Mes", "Estado", "Criterio de aceptación", "%", "Importe", "Facturado"]);
      plan.forEach(h => filas.push([
        h.contexto === "oferta" ? "Oferta" : "Tarea", h.nombre, h.tareaNombre || "—", h.mesEtiqueta,
        h.estadoTexto, h.criterio || "", numES(h.pct), imp ? numES(h.importe) : "", h.facturado ? "Sí" : "No"
      ]));
      filas.push([]);
    }

    /* Totales */
    const linea = (texto, valor) => filas.push([texto, "", "", "", "", "", "", imp ? numES(valor) : ""]);
    linea("Consultoría", C().importeProyecto(pr, pf));
    if (C().gastosTotal(pr)) linea("Gastos generales", C().gastosTotal(pr));
    linea("Subtotal", C().subtotalProyecto(pr, pf));
    if (pr.descuento && pr.descuento.tipo) linea("Descuento", -C().descuentoImporte(pr, pf));
    linea("Base imponible", C().baseImponible(pr, pf));
    if (C().nombreImpuesto(pr)) linea(C().nombreImpuesto(pr) + " " + N().num(pr.impuestos.tasa) + " %", C().impuestoImporte(pr, pf));
    linea("TOTAL", C().totalProyecto(pr, pf));

    const res = E().resumenFacturacion(pr, pf);
    if (res.hitos) {
      filas.push([]);
      filas.push(["PLAN DE FACTURACIÓN", "", "", "", "", "", "", imp ? numES(res.total) : ""]);
      filas.push(["Facturado (entregado/aceptado)", "", "", "", "", "", "", imp ? numES(res.facturado) : ""]);
      filas.push(["Pendiente de facturar", "", "", "", "", "", "", imp ? numES(res.pendienteFacturar) : ""]);
    }

    void moneda;
    return "\uFEFF" + filas.map(f => f.map(cell).join(sep)).join("\r\n");
  }

  /* ---------- Importación ---------- */

  /** Parsea y clasifica un JSON importado. No aplica nada todavía. */
  function analizarImportacion(texto) {
    let d = null;
    try { d = JSON.parse(texto); }
    catch (e) { return { ok: false, error: "El archivo no es un JSON válido." }; }
    if (!d || typeof d !== "object") return { ok: false, error: "El JSON no contiene datos de Planifica." };

    if (d.tipo === "planifica-proyecto" && d.proyecto) return { ok: true, tipo: "proyecto", datos: d.proyecto };
    if (d.tipo === "planifica-biblioteca") return { ok: true, tipo: "biblioteca", datos: d };
    if (Array.isArray(d.proyectos)) {
      const origen = (d.version === 3) ? 3 : (d.version === 2 ? 2 : 1);
      return { ok: true, tipo: "estado", origen: origen, datos: d };
    }
    return { ok: false, error: "Formato no reconocido: se espera una oferta, una biblioteca o una copia completa de Planifica." };
  }

  /** Aplica una importación ya analizada. opciones: {reemplazar, aplicarMarca}. */
  function aplicarImportacion(estado, analisis, opciones) {
    const M2 = M();
    const o = opciones || {};
    const r = { estado: estado, mensaje: "", ofertas: 0, perfiles: 0, plantillas: 0 };

    if (!analisis || !analisis.ok) { r.mensaje = (analisis && analisis.error) || "Importación no válida."; return r; }

    if (analisis.tipo === "proyecto") {
      const p = M2.normalizarProyecto(analisis.datos, false);
      const i = estado.proyectos.findIndex(x => x.id === p.id);
      if (i >= 0) { estado.proyectos[i] = p; r.ofertas = 1; } else { estado.proyectos.push(p); r.ofertas = 1; }
      estado.activo = p.id;
      r.mensaje = "Oferta importada: " + p.nombre;
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
      r.mensaje = "Biblioteca importada: " + r.perfiles + " perfil(es), " + r.plantillas + " plantilla(s).";
      return r;
    }

    /* Copia completa (estado), de cualquier versión */
    const mig = M2.migrar(analisis.datos);
    const nuevo = M2.normalizarEstado(mig.estado);
    if (o.reemplazar) {
      if (o.aplicarMarca !== false && nuevo.marca) estado.marca = nuevo.marca;
      estado.perfiles = nuevo.perfiles;
      estado.perfilesInactivos = nuevo.perfilesInactivos;
      estado.plantillas = nuevo.plantillas.length ? nuevo.plantillas : M2.estadoInicial().plantillas;
      estado.plantillasOferta = nuevo.plantillasOferta;
      estado.proyectos = nuevo.proyectos;
      estado.activo = nuevo.activo;
      r.ofertas = nuevo.proyectos.length;
      r.mensaje = "Datos reemplazados: " + r.ofertas + " oferta(s)" + (mig.origen < 3 ? ", migradas desde la versión " + mig.origen : "") + ".";
    } else {
      /* Fusionar: se añade lo que no exista y se actualiza por id */
      (nuevo.perfiles || []).forEach(p => { if (!C().perfilPorId(estado.perfiles, p.id)) { estado.perfiles.push(p); r.perfiles++; } });
      (nuevo.plantillas || []).forEach(pl => { if (!N().lista(estado.plantillas).some(x => x.id === pl.id)) { estado.plantillas.push(pl); r.plantillas++; } });
      (nuevo.proyectos || []).forEach(p => {
        const i = estado.proyectos.findIndex(x => x.id === p.id);
        if (i >= 0) estado.proyectos[i] = p; else estado.proyectos.push(p);
        r.ofertas++;
      });
      if (!C().perfilPorId(estado.perfiles, estado.activo)) estado.activo = estado.proyectos[0].id;
      r.mensaje = "Fusionado: " + r.ofertas + " oferta(s), " + r.perfiles + " perfil(es) nuevo(s).";
    }
    return r;
  }

  PL.almacen = {
    tieneLS: tieneLS, cargar: cargar, guardar: guardar, datosHeredados: datosHeredados,
    olvidarHeredados: olvidarHeredados, descargar: descargar, nombreFichero: nombreFichero,
    exportarProyecto: exportarProyecto, exportarTodo: exportarTodo, exportarBiblioteca: exportarBiblioteca,
    csvProyecto: csvProyecto, analizarImportacion: analizarImportacion, aplicarImportacion: aplicarImportacion
  };
})(typeof window !== "undefined" ? window : globalThis);
