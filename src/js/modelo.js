"use strict";
/* =====================================================================
   Planifica v3 — MODELO
   Esquema de datos v3, normalización defensiva (nada de datos corruptos
   pueden tumbar la app), migración v1/v2 → v3 y estado inicial.

   NO toca el DOM. NO calcula importes (eso es PL.calculo).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  /* Acceso tardío al núcleo: así el orden de concatenación es indiferente. */
  const N = () => PL.nucleo;

  const VERSION_DATOS = 3;
  const CLAVE = "planifica:estado:v3";
  const CLAVES_ANTIGUAS = ["planifica:estado:v2", "planifica:estado:v1"];

  const CATEGORIAS_PERFIL = [
    "Dirección de proyecto", "Consultoría senior", "Consultoría media", "Consultoría junior",
    "Perfil técnico", "Soporte y administración", "Otro"
  ];

  const ESTADOS_OFERTA = {
    borrador:   { texto: "Borrador",   badge: "nz-badge--neutral" },
    enviada:    { texto: "Enviada",    badge: "nz-badge--brand" },
    aprobada:   { texto: "Aprobada",   badge: "nz-badge--success" },
    descartada: { texto: "Descartada", badge: "nz-badge--danger" }
  };

  /* Estados del entregable. facturado: cuenta para el importe facturado. */
  const ESTADOS_ENTREGABLE = {
    pendiente: { texto: "Pendiente", badge: "nz-badge--neutral",  orden: 0, facturado: false },
    encurso:   { texto: "En curso",  badge: "nz-badge--brand",    orden: 1, facturado: false },
    entregado: { texto: "Entregado", badge: "nz-badge--info",     orden: 2, facturado: true  },
    aceptado:  { texto: "Aceptado",  badge: "nz-badge--success",  orden: 3, facturado: true  }
  };

  const BASES_FACTURACION = {
    tarea:  { texto: "Sobre el importe de su tarea" },
    oferta: { texto: "Sobre la base imponible de la oferta" }
  };

  const esEstadoEntregable = v => Object.prototype.hasOwnProperty.call(ESTADOS_ENTREGABLE, v);
  const esEstadoOferta = v => Object.prototype.hasOwnProperty.call(ESTADOS_OFERTA, v);

  /* ---------- Fábricas ---------- */

  function nuevoPerfil(nombre, tarifa, categoria, esDefecto) {
    return {
      id: N().uid("pf_"), nombre: N().texto(nombre, "Nuevo perfil"), unidades: "h",
      tarifa: N().num(tarifa), categoria: categoria || "Otro", esDefecto: !!esDefecto
    };
  }

  function nuevoProyecto(nombre) {
    return {
      id: N().uid("pr_"), nombre: N().texto(nombre, "Oferta sin título"),
      cliente: { nombre: "", contacto: "", ref: "" },
      estado: "borrador", fecha: N().hoyISO(), validezDias: 30,
      fechaInicio: N().mesActualISO(), meses: 12,
      descripcion: "", condicionesPago: "",
      impuestos: { tipo: "iva", tasa: 21, incluido: false },
      descuento: { tipo: "", valor: 0 },
      gastos: [], entregables: [], tareas: [], escenarios: [], versiones: []
    };
  }

  function nuevaTarea(nombre) {
    return { id: N().uid("ta_"), nombre: N().texto(nombre, "Nueva tarea"), entregables: [], subtareas: [] };
  }

  function nuevaSub(nombre) {
    return { id: N().uid("sb_"), nombre: N().texto(nombre, "Nueva subtarea"), _abierta: false, lineas: [] };
  }

  function nuevaLinea(perfilId, meses) {
    const horas = {};
    const n = N().acota(meses, 1, 60);
    for (let i = 0; i < n; i++) horas["m" + i] = 0;
    return { id: N().uid("ln_"), perfilId: perfilId || "", horas: horas };
  }

  /** Entregable (hito). contexto: "tarea" (por defecto) u "oferta". */
  function nuevoEntregable(nombre, contexto, mes) {
    return {
      id: N().uid("en_"), nombre: N().texto(nombre, "Nuevo entregable"),
      descripcion: "", mes: (mes === undefined || mes === null) ? 0 : N().acota(mes, 0, 59),
      fecha: "", estado: "pendiente", criterio: "", responsablePerfilId: "",
      facturacionPct: 0, baseFacturacion: contexto === "oferta" ? "oferta" : "tarea"
    };
  }

  /** Copia el contenido de un objeto de horas sobre una línea. */
  function lCon(linea, horas) {
    for (const k in horas) if (Object.prototype.hasOwnProperty.call(horas, k)) linea.horas[k] = horas[k];
    return linea;
  }

  /* ---------- Normalización defensiva ---------- */

  function normalizarPerfil(p) {
    const q = (p && typeof p === "object") ? p : {};
    q.id = q.id || N().uid("pf_");
    q.nombre = N().texto(q.nombre, "Perfil");
    q.unidades = N().texto(q.unidades, "h");
    q.tarifa = N().acota(q.tarifa, 0, 1e9);
    q.categoria = CATEGORIAS_PERFIL.indexOf(q.categoria) >= 0 ? q.categoria : "Otro";
    q.esDefecto = !!q.esDefecto;
    return q;
  }

  function normalizarPlantilla(pl) {
    const q = (pl && typeof pl === "object") ? pl : {};
    q.id = q.id || N().uid("pl_");
    q.nombre = N().texto(q.nombre, "Plantilla");
    q.desc = N().texto(q.desc, "");
    q.esDefecto = !!q.esDefecto;
    q.tareas = N().lista(q.tareas).map(t => ({
      nombre: N().texto(t && t.nombre, "Tarea"),
      subtareas: N().lista(t && t.subtareas).map(s => (typeof s === "string" ? s : N().texto(s && s.nombre, "Subtarea"))),
      entregables: N().lista(t && t.entregables).map(e => ({
        nombre: N().texto(typeof e === "string" ? e : (e && e.nombre), "Entregable"),
        descripcion: N().texto(e && e.descripcion, ""),
        criterio: N().texto(e && e.criterio, ""),
        mes: N().acota(e && e.mes, 0, 59),
        facturacionPct: N().acota(e && e.facturacionPct, 0, 100)
      }))
    }));
    return q;
  }

  /** Entregable normalizado. contexto define la base de facturación por defecto. */
  function normalizarEntregable(e, contexto, meses) {
    const q = (e && typeof e === "object") ? e : {};
    q.id = q.id || N().uid("en_");
    q.nombre = N().texto(q.nombre, "Entregable");
    q.descripcion = N().texto(q.descripcion, "");
    q.mes = N().acota(q.mes, 0, 59);
    if (meses) q.mes = Math.min(q.mes, N().acota(meses, 1, 60) - 1);
    q.fecha = N().texto(q.fecha, "");
    q.estado = esEstadoEntregable(q.estado) ? q.estado : "pendiente";
    q.criterio = N().texto(q.criterio, "");
    q.responsablePerfilId = N().texto(q.responsablePerfilId, "");
    q.facturacionPct = N().acota(q.facturacionPct, 0, 100);
    const baseOk = q.baseFacturacion === "oferta" ? "oferta" : "tarea";
    /* Un entregable colgado de la oferta no puede facturar contra una tarea. */
    q.baseFacturacion = contexto === "oferta" ? "oferta" : baseOk;
    return q;
  }

  /** Proyecto (oferta) normalizado. esMigracion: viene de v1/v2 (sin impuestos). */
  function normalizarProyecto(p, esMigracion) {
    const q = (p && typeof p === "object") ? p : {};
    const u = N();
    q.id = q.id || u.uid("pr_");
    q.nombre = u.texto(q.nombre, "Oferta sin título");
    if (typeof q.cliente === "string") q.cliente = { nombre: q.cliente, contacto: "", ref: "" };
    q.cliente = (q.cliente && typeof q.cliente === "object") ? q.cliente : { nombre: "", contacto: "", ref: "" };
    q.cliente.nombre = u.texto(q.cliente.nombre, "");
    q.cliente.contacto = u.texto(q.cliente.contacto, "");
    q.cliente.ref = u.texto(q.cliente.ref, "");
    q.estado = esEstadoOferta(q.estado) ? q.estado : "borrador";
    q.fecha = u.texto(q.fecha, u.hoyISO());
    q.validezDias = Math.round(u.acota(q.validezDias === undefined ? 30 : q.validezDias, 0, 3650));
    q.fechaInicio = u.texto(q.fechaInicio, u.mesActualISO());
    q.meses = Math.round(u.acota(q.meses === undefined ? 12 : q.meses, 1, 60));
    q.descripcion = u.texto(q.descripcion, "");
    q.condicionesPago = u.texto(q.condicionesPago, "");

    /* En migración, una oferta sin impuestos definidos se queda SIN impuestos:
       los presupuestos antiguos no los llevaban y no se los inventamos. */
    if (esMigracion && !q.impuestos) {
      q.impuestos = { tipo: "ninguno", tasa: 0, incluido: false };
    } else {
      q.impuestos = (q.impuestos && typeof q.impuestos === "object") ? q.impuestos : { tipo: "iva", tasa: 21, incluido: false };
      if (["iva", "irpf", "ninguno"].indexOf(q.impuestos.tipo) < 0) q.impuestos.tipo = "iva";
    }
    q.impuestos.tasa = u.acota(q.impuestos.tasa === undefined ? 21 : q.impuestos.tasa, 0, 100);
    q.impuestos.incluido = !!q.impuestos.incluido;

    q.descuento = (q.descuento && typeof q.descuento === "object") ? q.descuento : { tipo: "", valor: 0 };
    if (["", "%", "fijo"].indexOf(q.descuento.tipo) < 0) q.descuento.tipo = "";
    q.descuento.valor = u.acota(q.descuento.valor, 0, 1e9);
    if (q.descuento.tipo === "%") q.descuento.valor = Math.min(100, q.descuento.valor);

    q.gastos = u.lista(q.gastos).map(g => {
      const h = (g && typeof g === "object") ? g : {};
      h.id = h.id || u.uid("g_");
      h.nombre = u.texto(h.nombre, "Concepto");
      h.unidades = u.acota(h.unidades, 0, 1e6);
      h.precio = u.acota(h.precio, 0, 1e9);
      return h;
    });

    q.entregables = u.lista(q.entregables).map(e => normalizarEntregable(e, "oferta", q.meses));

    q.tareas = u.lista(q.tareas).map(t => {
      const ta = (t && typeof t === "object") ? t : {};
      ta.id = ta.id || u.uid("ta_");
      ta.nombre = u.texto(ta.nombre, "Tarea");
      ta.entregables = u.lista(ta.entregables).map(e => normalizarEntregable(e, "tarea", q.meses));
      ta.subtareas = u.lista(ta.subtareas).map(s => {
        const sb = (s && typeof s === "object") ? s : {};
        sb.id = sb.id || u.uid("sb_");
        sb.nombre = u.texto(sb.nombre, "Subtarea");
        if (typeof sb._abierta !== "boolean") sb._abierta = false;
        sb.lineas = u.lista(sb.lineas).map(l => {
          const ln = (l && typeof l === "object") ? l : {};
          ln.id = ln.id || u.uid("ln_");
          ln.perfilId = u.texto(ln.perfilId, "");
          const orig = (ln.horas && typeof ln.horas === "object") ? ln.horas : {};
          const horas = ln.horas = {};
          /* Solo meses válidos del proyecto: lo demás se descarta. */
          for (let i = 0; i < q.meses; i++) horas["m" + i] = u.acota(orig["m" + i], 0, 1e6);
          return ln;
        });
        return sb;
      });
      return ta;
    });

    q.escenarios = u.lista(q.escenarios).map(e => {
      const h = (e && typeof e === "object") ? e : {};
      h.id = h.id || u.uid("es_");
      h.nombre = u.texto(h.nombre, "Escenario");
      h.etiqueta = u.texto(h.etiqueta, "");
      h.creado = u.texto(h.creado, "");
      h.snapshot = (h.snapshot && typeof h.snapshot === "object") ? h.snapshot : null;
      return h;
    });

    q.versiones = u.lista(q.versiones).map(v => {
      const h = (v && typeof v === "object") ? v : {};
      h.id = h.id || u.uid("vs_");
      h.etiqueta = u.texto(h.etiqueta, "Versión");
      h.fecha = u.texto(h.fecha, "");
      h.nota = u.texto(h.nota, "");
      h.snapshot = (h.snapshot && typeof h.snapshot === "object") ? h.snapshot : null;
      h.resumen = (h.resumen && typeof h.resumen === "object") ? h.resumen : null;
      return h;
    });
    return q;
  }

  /* ---------- Migración ---------- */

  /** Detecta la versión de unos datos y los lleva a v3. Devuelve {estado, origen}. */
  function migrar(datos) {
    const d = (datos && typeof datos === "object") ? datos : {};
    const origen = (d.version === 3) ? 3 : (d.version === 2 ? 2 : 1);
    const esMigracion = origen < 3;

    const estado = {
      version: VERSION_DATOS,
      marca: d.marca && typeof d.marca === "object" ? d.marca : null,
      mostrarImportes: d.mostrarImportes !== false,
      guiaVista: !!d.guiaVista,
      perfiles: N().lista(d.perfiles).map(normalizarPerfil),
      perfilesInactivos: N().lista(d.perfilesInactivos).map(normalizarPerfil),
      plantillas: N().lista(d.plantillas).map(normalizarPlantilla),
      plantillasOferta: N().lista(d.plantillasOferta).map(normalizarPlantilla),
      proyectos: N().lista(d.proyectos).map(p => normalizarProyecto(p, esMigracion)),
      activo: d.activo || null,
      pestana: d.pestana || "estructura"
    };

    /* v1/v2 no traían entregables ni escenarios: la normalización ya los creó vacíos.
       v1 no traía plantillas de tareas: se le ponen las de fábrica. */
    if (origen === 1 && !estado.plantillas.length) estado.plantillas = PL.ejemplo.plantillasDefecto();

    /* Activa la oferta con más contenido (mejor primera impresión al migrar). */
    if (!estado.activo || !estado.proyectos.some(p => p.id === estado.activo)) {
      const mejor = estado.proyectos.slice().sort((a, b) =>
        (N().lista(b.tareas).length - N().lista(a.tareas).length) || (N().lista(b.entregables).length - N().lista(a.entregables).length))[0];
      if (mejor) estado.activo = mejor.id;
    }
    return { estado: estado, origen: origen };
  }

  function estadoInicial() {
    const perfiles = PL.ejemplo.perfilesDefecto();
    return {
      version: VERSION_DATOS,
      marca: { nombre: "Planifica", sub: "Ofertas y planificación de proyectos", moneda: "€", logo: "" },
      mostrarImportes: true, guiaVista: false,
      perfiles: perfiles, perfilesInactivos: [],
      plantillas: PL.ejemplo.plantillasDefecto(),
      plantillasOferta: [],
      proyectos: [PL.ejemplo.proyectoEjemplo(perfiles)],
      activo: null, pestana: "estructura"
    };
  }

  /** Asegura que un ESTADO recién cargado de disco cumple el esquema v3. */
  function normalizarEstado(e) {
    const u = N();
    const q = (e && typeof e === "object") ? e : {};
    q.version = VERSION_DATOS;
    q.marca = (q.marca && typeof q.marca === "object") ? q.marca : { nombre: "Planifica", sub: "", moneda: "€", logo: "" };
    q.marca.nombre = u.texto(q.marca.nombre, "Planifica");
    q.marca.sub = u.texto(q.marca.sub, "");
    q.marca.moneda = u.texto(q.marca.moneda, "€");
    q.marca.logo = u.texto(q.marca.logo, "");
    q.mostrarImportes = q.mostrarImportes !== false;
    q.guiaVista = !!q.guiaVista;
    q.perfiles = u.lista(q.perfiles).map(normalizarPerfil);
    q.perfilesInactivos = u.lista(q.perfilesInactivos).map(normalizarPerfil);
    q.plantillas = u.lista(q.plantillas).map(normalizarPlantilla);
    q.plantillasOferta = u.lista(q.plantillasOferta).map(normalizarPlantilla);
    q.proyectos = u.lista(q.proyectos).map(p => normalizarProyecto(p, false));
    if (!q.proyectos.length) q.proyectos = [nuevoProyecto("Mi primera oferta")];
    if (!q.activo || !q.proyectos.some(p => p.id === q.activo)) q.activo = q.proyectos[0].id;
    q.pestana = u.texto(q.pestana, "estructura");
    return q;
  }

  PL.modelo = {
    VERSION_DATOS: VERSION_DATOS, CLAVE: CLAVE, CLAVES_ANTIGUAS: CLAVES_ANTIGUAS,
    CATEGORIAS_PERFIL: CATEGORIAS_PERFIL, ESTADOS_OFERTA: ESTADOS_OFERTA,
    ESTADOS_ENTREGABLE: ESTADOS_ENTREGABLE, BASES_FACTURACION: BASES_FACTURACION,
    esEstadoEntregable: esEstadoEntregable, esEstadoOferta: esEstadoOferta,
    nuevoPerfil: nuevoPerfil, nuevoProyecto: nuevoProyecto, nuevaTarea: nuevaTarea,
    nuevaSub: nuevaSub, nuevaLinea: nuevaLinea, nuevoEntregable: nuevoEntregable, lCon: lCon,
    normalizarPerfil: normalizarPerfil, normalizarPlantilla: normalizarPlantilla,
    normalizarEntregable: normalizarEntregable, normalizarProyecto: normalizarProyecto,
    normalizarEstado: normalizarEstado, migrar: migrar, estadoInicial: estadoInicial
  };
})(typeof window !== "undefined" ? window : globalThis);
