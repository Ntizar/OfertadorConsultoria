"use strict";
/* =====================================================================
   Planifica v4 — MODELO
   Esquema de datos de una OFERTA (no de un proyecto en ejecución: aquí no
   hay seguimiento ni facturación). Normalización defensiva, migración de
   versiones anteriores y estado inicial.

   Jerarquía:
       OFERTA → tareas → subtareas → líneas (perfil × periodo, con horas)
                 └── entregables (compromisos de entrega)
       OFERTA → entregables  (hitos sueltos: gestión, reuniones…)
       OFERTA → fotos        (escenarios y versiones, para comparar)
   Sin DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;

  const VERSION_DATOS = 4;
  const CLAVE = "planifica:v4";
  const CLAVES_ANTIGUAS = ["planifica:estado:v3", "planifica:estado:v2", "planifica:estado:v1"];

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

  const TIPOS_FOTO = {
    escenario: { texto: "Escenario", plural: "Escenarios", ayuda: "Alternativas de la misma oferta (base, recortada, ampliada…)" },
    version:   { texto: "Versión",   plural: "Versiones",   ayuda: "La oferta tal como se envió o se acordó un día concreto" }
  };

  const esEstadoOferta = v => Object.prototype.hasOwnProperty.call(ESTADOS_OFERTA, v);

  /* ---------- Fábricas ---------- */

  function nuevoPerfil(nombre, tarifa, categoria, esDefecto) {
    return {
      id: N().uid("pf_"), nombre: N().texto(nombre, "Nuevo perfil"), unidad: "h",
      tarifa: N().acota(tarifa, 0, 1e9), categoria: categoria || "Otro", esDefecto: !!esDefecto
    };
  }

  /* Jornada de trabajo: es lo que convierte dedicación (%) en horas. Va dentro de
     la oferta para que cada oferta sea autocontenida y exportable. */
  const JORNADA_DEFECTO = { horasDia: 8, diasSemana: [1, 2, 3, 4, 5] };   /* 1=lunes … 7=domingo */

  /** Festivos: [{fecha:"aaaa-mm-dd", nombre, ambito}] sin duplicados y ordenados. */
  function normalizarFestivos(l) {
    const N2 = N();
    const vistos = {};
    const salida = [];
    N2.lista(l).forEach(f => {
      const fecha = String(f && f.fecha ? f.fecha : "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || vistos[fecha]) return;
      const d = new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
      if (isNaN(d.getTime()) || N2.diaISO(d) !== fecha) return;
      vistos[fecha] = true;
      salida.push({
        fecha: fecha,
        nombre: String((f && f.nombre) || "Festivo").slice(0, 80),
        ambito: String((f && f.ambito) || "Propio").slice(0, 24)
      });
    });
    return salida.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }

  /* Memo: normalizar la jornada en cada consulta multiplicaba por miles las
     llamadas por repintado (ahora se recorre día a día y con festivos). */
  const CACHE_JORNADA = new WeakMap();

  function normalizarJornada(j) {
    if (j && typeof j === "object" && CACHE_JORNADA.has(j)) return CACHE_JORNADA.get(j);
    const salida = normalizarJornadaCruda(j);
    if (j && typeof j === "object") CACHE_JORNADA.set(j, salida);
    return salida;
  }

  function normalizarJornadaCruda(j) {
    const u = N();
    const q = (j && typeof j === "object") ? j : {};
    let dias = Array.isArray(q.diasSemana)
      ? q.diasSemana.map(d => Math.round(u.acota(d, 1, 7))).filter(d => d >= 1 && d <= 7)
      : [];
    dias = Array.from(new Set(dias)).sort((a, b) => a - b);
    if (!dias.length) dias = JORNADA_DEFECTO.diasSemana.slice();
    const horasDia = u.acota(q.horasDia === undefined ? JORNADA_DEFECTO.horasDia : q.horasDia, 0.5, 24);
    /* Horas de cada día de la semana: así el viernes puede ser más corto sin dejar
       de ser laborable. Lo que no venga, se hereda de horasDia. */
    const porDia = {};
    for (let d = 1; d <= 7; d++) {
      const propio = (q.horasPorDia && typeof q.horasPorDia === "object") ? q.horasPorDia[d] : undefined;
      if (dias.indexOf(d) < 0) { porDia[d] = 0; continue; }
      const v = (propio === undefined || propio === null) ? horasDia : u.acota(propio, 0, 24);
      /* Un día marcado como laborable con 0 horas no tiene sentido: manda la casilla,
         así al activar el sábado aparece con las horas generales y no con un cero. */
      porDia[d] = u.r2(v > 0 ? v : horasDia);
    }
    return {
      horasDia: horasDia,
      diasSemana: dias.filter(d => porDia[d] > 0),
      horasPorDia: porDia,
      festivos: normalizarFestivos(q.festivos)
    };
  }

  function nuevaOferta(nombre) {
    return {
      id: N().uid("of_"), nombre: N().texto(nombre, "Oferta sin título"),
      cliente: { nombre: "", contacto: "", ref: "" },
      estado: "borrador", fecha: N().hoyISO(), validezDias: 30,
      periodos: P().porDefecto(),
      jornada: normalizarJornada(null),
      descripcion: "", condicionesPago: "",
      impuestos: { tipo: "iva", tasa: 21, incluido: false },
      descuento: { tipo: "", valor: 0 },
      gastos: [], entregables: [], tareas: [], fotos: []
    };
  }

  function nuevaTarea(nombre) {
    return { id: N().uid("ta_"), nombre: N().texto(nombre, "Nueva tarea"), _abierta: true, entregables: [], subtareas: [] };
  }

  function nuevaSubtarea(nombre) {
    return { id: N().uid("sb_"), nombre: N().texto(nombre, "Nueva subtarea"), _abierta: true, entregables: [], lineas: [] };
  }

  function nuevaLinea(perfilId, nPeriodos) {
    const horas = {};
    const n = N().acota(nPeriodos, 1, P().MAX);
    for (let i = 0; i < n; i++) horas["p" + i] = 0;
    return { id: N().uid("ln_"), perfilId: perfilId || "", horas: horas };
  }

  /** Entregable: compromiso de entrega. contexto: "tarea" | "oferta". */
  function nuevoEntregable(nombre, contexto, periodo) {
    return {
      id: N().uid("en_"), nombre: N().texto(nombre, "Nuevo entregable"),
      descripcion: "", criterio: "", periodo: Math.round(N().acota(periodo, 0, P().MAX - 1)),
      fecha: "", responsablePerfilId: "", horas: 0
    };
  }

  /** Rellena las horas de una línea (usado por el ejemplo). */
  function conHoras(linea, horas) {
    for (const k in horas) if (Object.prototype.hasOwnProperty.call(horas, k)) linea.horas[k] = horas[k];
    return linea;
  }

  /* ---------- Normalización defensiva ---------- */

  function normalizarPerfil(p) {
    const q = (p && typeof p === "object") ? p : {};
    q.id = q.id || N().uid("pf_");
    q.nombre = N().texto(q.nombre, "Perfil");
    q.unidad = N().texto(q.unidad || q.unidades, "h");
    q.tarifa = N().acota(q.tarifa, 0, 1e9);
    q.categoria = CATEGORIAS_PERFIL.indexOf(q.categoria) >= 0 ? q.categoria : "Otro";
    q.notas = N().texto(q.notas, "");
    q.esDefecto = !!q.esDefecto;
    return q;
  }

  function normalizarEntregable(e, nPeriodos) {
    const q = (e && typeof e === "object") ? e : {};
    q.id = q.id || N().uid("en_");
    q.nombre = N().texto(q.nombre, "Entregable");
    q.descripcion = N().texto(q.descripcion, "");
    q.criterio = N().texto(q.criterio, "");
    /* `mes` es el nombre antiguo del periodo: se acepta al migrar. */
    const per = (q.periodo === undefined) ? q.mes : q.periodo;
    q.periodo = Math.round(N().acota(per === undefined ? 0 : per, 0, Math.max(0, nPeriodos - 1)));
    q.fecha = N().texto(q.fecha, "");
    q.responsablePerfilId = N().texto(q.responsablePerfilId, "");
    /* Un entregable no lleva horas: el esfuerzo lo ponen las líneas de su subtarea. */
    delete q.horas;
    delete q.mes; delete q.estado; delete q.facturacionPct; delete q.baseFacturacion;
    return q;
  }

  function normalizarTarea(t, nPeriodos) {
    const q = (t && typeof t === "object") ? t : {};
    q.id = q.id || N().uid("ta_");
    q.nombre = N().texto(q.nombre, "Tarea");
    if (typeof q._abierta !== "boolean") q._abierta = true;
    q.entregables = N().lista(q.entregables).map(e => normalizarEntregable(e, nPeriodos));
    q.subtareas = N().lista(q.subtareas).map(s => {
      const sb = (s && typeof s === "object") ? s : {};
      sb.id = sb.id || N().uid("sb_");
      sb.nombre = N().texto(sb.nombre, "Subtarea");
      if (typeof sb._abierta !== "boolean") sb._abierta = true;
      sb.entregables = N().lista(sb.entregables).map(e => normalizarEntregable(e, nPeriodos));
      sb.lineas = N().lista(sb.lineas).map(l => {
        const ln = (l && typeof l === "object") ? l : {};
        ln.id = ln.id || N().uid("ln_");
        ln.perfilId = N().texto(ln.perfilId, "");
        const orig = (ln.horas && typeof ln.horas === "object") ? ln.horas : {};
        const horas = ln.horas = {};
        for (let i = 0; i < nPeriodos; i++) {
          /* Se aceptan las claves nuevas (p3) y las antiguas (m3). */
          const v = (orig["p" + i] !== undefined) ? orig["p" + i] : orig["m" + i];
          horas["p" + i] = N().acota(v, 0, 1e6);
        }
        return ln;
      });
      return sb;
    });
    return q;
  }

  function normalizarFoto(f) {
    const q = (f && typeof f === "object") ? f : {};
    q.id = q.id || N().uid("ft_");
    q.tipo = (q.tipo === "version") ? "version" : "escenario";
    q.nombre = N().texto(q.nombre, q.tipo === "version" ? "Versión" : "Escenario");
    q.nota = N().texto(q.nota, "");
    q.fecha = N().texto(q.fecha, N().hoyISO());
    q.snapshot = (q.snapshot && typeof q.snapshot === "object") ? q.snapshot : null;
    return q;
  }

  function normalizarOferta(o, esMigracion) {
    const q = (o && typeof o === "object") ? o : {};
    const u = N();
    q.id = q.id || u.uid("of_");
    q.nombre = u.texto(q.nombre, "Oferta sin título");
    if (typeof q.cliente === "string") q.cliente = { nombre: q.cliente, contacto: "", ref: "" };
    q.cliente = (q.cliente && typeof q.cliente === "object") ? q.cliente : { nombre: "", contacto: "", ref: "" };
    q.cliente.nombre = u.texto(q.cliente.nombre, "");
    q.cliente.contacto = u.texto(q.cliente.contacto, "");
    q.cliente.ref = u.texto(q.cliente.ref, "");
    q.estado = esEstadoOferta(q.estado) ? q.estado : "borrador";
    q.fecha = u.texto(q.fecha, u.hoyISO());
    q.validezDias = Math.round(u.acota(q.validezDias === undefined ? 30 : q.validezDias, 0, 3650));
    q.descripcion = u.texto(q.descripcion, "");
    q.condicionesPago = u.texto(q.condicionesPago, "");

    /* Periodos: en migración se construyen desde `fechaInicio` + `meses`. */
    if (!q.periodos) {
      q.periodos = P().porDefecto();
      if (q.fechaInicio) q.periodos.inicio = q.fechaInicio;
      if (q.meses) q.periodos.n = Math.round(u.acota(q.meses, 1, P().MAX));
    }
    q.periodos = P().normalizar(q.periodos);
    delete q.fechaInicio; delete q.meses;
    q.jornada = normalizarJornada(q.jornada);
    /* Si la oferta no trae festivos, se cargan los de España y Madrid de los años
       que abarca el calendario. Son editables: los locales cambian cada año. */
    if (!q.jornada.festivos.length && PL.festivos) {
      q.jornada.festivos = normalizarFestivos(
        PL.festivos.paraRango(q.periodos.inicio, P().meses(q.periodos), q.periodos.unidad));
    }

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

    q.entregables = u.lista(q.entregables).map(e => normalizarEntregable(e, q.periodos.n));
    q.tareas = u.lista(q.tareas).map(t => normalizarTarea(t, q.periodos.n));

    /* Fotos: en v3 había dos listas (escenarios y versiones) → se unifican. */
    const fotos = u.lista(q.fotos).map(normalizarFoto);
    u.lista(q.escenarios).forEach(e => {
      fotos.push(normalizarFoto({ id: e.id, tipo: "escenario", nombre: e.nombre || e.etiqueta, nota: e.etiqueta || "", fecha: e.creado, snapshot: e.snapshot }));
    });
    u.lista(q.versiones).forEach(v => {
      fotos.push(normalizarFoto({ id: v.id, tipo: "version", nombre: v.etiqueta, nota: v.nota, fecha: v.fecha, snapshot: v.snapshot }));
    });
    q.fotos = fotos;
    delete q.escenarios; delete q.versiones;

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
        periodo: Math.round(N().acota(e && e.periodo, 0, P().MAX - 1)),
      }))
    }));
    return q;
  }

  /* ---------- Estado ---------- */

  function estadoInicial() {
    const perfiles = PL.ejemplo.perfilesDefecto();
    const oferta = PL.ejemplo.ofertaEjemplo(perfiles);
    return {
      version: VERSION_DATOS,
      marca: { nombre: "Planifica", sub: "Ofertas y planificación de proyectos", moneda: "€", logo: "" },
      mostrarImportes: true, guiaVista: false,
      perfiles: perfiles, perfilesInactivos: [],
      plantillas: PL.ejemplo.plantillasDefecto(),
      ofertas: [oferta], activa: oferta.id,
      ui: { pestana: "trabajo", plantillasAbiertas: false, fotosAbiertas: false }
    };
  }

  function normalizarEstado(e) {
    const u = N();
    const q = (e && typeof e === "object") ? e : {};
    q.version = VERSION_DATOS;
    q.marca = (q.marca && typeof q.marca === "object") ? q.marca : {};
    q.marca.nombre = u.texto(q.marca.nombre, "Planifica");
    q.marca.sub = u.texto(q.marca.sub, "");
    q.marca.moneda = u.texto(q.marca.moneda, "€");
    q.marca.logo = u.texto(q.marca.logo, "");
    q.mostrarImportes = q.mostrarImportes !== false;
    q.guiaVista = !!q.guiaVista;
    q.perfiles = u.lista(q.perfiles).map(normalizarPerfil);
    q.perfilesInactivos = u.lista(q.perfilesInactivos).map(normalizarPerfil);
    q.plantillas = u.lista(q.plantillas).map(normalizarPlantilla);
    q.ofertas = u.lista(q.ofertas || q.proyectos).map(o => normalizarOferta(o, false));
    if (!q.ofertas.length) q.ofertas = [nuevaOferta("Mi primera oferta")];
    const activa = q.activa || q.activo;
    q.activa = q.ofertas.some(o => o.id === activa) ? activa : q.ofertas[0].id;
    q.ui = (q.ui && typeof q.ui === "object") ? q.ui : {};
    q.ui.pestana = u.texto(q.ui.pestana, "trabajo");
    q.ui.plantillasAbiertas = !!q.ui.plantillasAbiertas;
    q.ui.fotosAbiertas = !!q.ui.fotosAbiertas;
    delete q.proyectos; delete q.activo; delete q.pestana;
    return q;
  }

  /** Lleva cualquier versión anterior (v1, v2, v3) al esquema v4. */
  function migrar(datos) {
    const d = (datos && typeof datos === "object") ? datos : {};
    const origen = (d.version === 4) ? 4 : ((d.version === 3 || d.version === 2) ? d.version : 1);
    const esMigracion = origen < 4;

    const estado = {
      version: VERSION_DATOS,
      marca: d.marca || null,
      mostrarImportes: d.mostrarImportes !== false,
      guiaVista: !!d.guiaVista,
      perfiles: N().lista(d.perfiles).map(normalizarPerfil),
      perfilesInactivos: N().lista(d.perfilesInactivos).map(normalizarPerfil),
      plantillas: N().lista(d.plantillas).map(normalizarPlantilla),
      ofertas: N().lista(d.ofertas || d.proyectos).map(o => normalizarOferta(o, esMigracion)),
      activa: d.activa || d.activo || null,
      ui: (d.ui && typeof d.ui === "object") ? d.ui : {}
    };

    if (!estado.plantillas.length) estado.plantillas = PL.ejemplo.plantillasDefecto();

    if (!estado.activa || !estado.ofertas.some(o => o.id === estado.activa)) {
      const mejor = estado.ofertas.slice().sort((a, b) => N().lista(b.tareas).length - N().lista(a.tareas).length)[0];
      if (mejor) estado.activa = mejor.id;
    }
    return { estado: estado, origen: origen };
  }

  /* ---------- Búsquedas en el árbol ---------- */

  function buscarTarea(o, id) {
    const l = N().lista(o && o.tareas);
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function buscarSubtarea(o, id) {
    const tareas = N().lista(o && o.tareas);
    for (let i = 0; i < tareas.length; i++) {
      const subs = N().lista(tareas[i].subtareas);
      for (let j = 0; j < subs.length; j++) if (subs[j].id === id) return { tarea: tareas[i], sub: subs[j] };
    }
    return null;
  }

  function buscarLinea(o, id) {
    const tareas = N().lista(o && o.tareas);
    for (let i = 0; i < tareas.length; i++) {
      const subs = N().lista(tareas[i].subtareas);
      for (let j = 0; j < subs.length; j++) {
        const lineas = N().lista(subs[j].lineas);
        for (let k = 0; k < lineas.length; k++) if (lineas[k].id === id) return { tarea: tareas[i], sub: subs[j], linea: lineas[k] };
      }
    }
    return null;
  }

  /** Entregable por id, con su contenedor, en los TRES niveles donde puede vivir:
      la oferta (gestión, reuniones), una tarea completa o una subtarea concreta. */
  function buscarEntregable(o, id, tareaId, subtareaId) {
    /* En la subtarea concreta */
    if (subtareaId) {
      const r = buscarSubtarea(o, subtareaId);
      if (!r) return null;
      const l = N().lista(r.sub.entregables);
      for (let i = 0; i < l.length; i++) {
        if (l[i].id === id) return { entregable: l[i], tarea: r.tarea, sub: r.sub, contexto: "subtarea", contenedor: r.sub.entregables };
      }
      return null;
    }
    /* En la tarea completa */
    if (tareaId) {
      const t = buscarTarea(o, tareaId);
      if (!t) return null;
      const l = N().lista(t.entregables);
      for (let i = 0; i < l.length; i++) {
        if (l[i].id === id) return { entregable: l[i], tarea: t, sub: null, contexto: "tarea", contenedor: t.entregables };
      }
      return null;
    }
    /* Sin pistas: se busca en los tres niveles */
    const deOferta = N().lista(o && o.entregables);
    for (let i = 0; i < deOferta.length; i++) {
      if (deOferta[i].id === id) return { entregable: deOferta[i], tarea: null, sub: null, contexto: "oferta", contenedor: o.entregables };
    }
    const tareas = N().lista(o && o.tareas);
    for (let i = 0; i < tareas.length; i++) {
      const l = N().lista(tareas[i].entregables);
      for (let j = 0; j < l.length; j++) {
        if (l[j].id === id) return { entregable: l[j], tarea: tareas[i], sub: null, contexto: "tarea", contenedor: tareas[i].entregables };
      }
      const subs = N().lista(tareas[i].subtareas);
      for (let k = 0; k < subs.length; k++) {
        const ls = N().lista(subs[k].entregables);
        for (let j = 0; j < ls.length; j++) {
          if (ls[j].id === id) return { entregable: ls[j], tarea: tareas[i], sub: subs[k], contexto: "subtarea", contenedor: subs[k].entregables };
        }
      }
    }
    return null;
  }

  function buscarFoto(o, id) {
    const l = N().lista(o && o.fotos);
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  /** Cuelga un entregable nuevo en la oferta, en una tarea o en una subtarea. */
  function colgarEntregable(o, nombre, contexto, periodo, tareaId, subtareaId) {
    const e = nuevoEntregable(nombre, contexto, periodo);
    if (subtareaId) {
      const r = buscarSubtarea(o, subtareaId);
      if (r) { r.sub.entregables = N().lista(r.sub.entregables); r.sub.entregables.push(e); return e; }
    }
    if (contexto === "oferta" || !tareaId) { o.entregables.push(e); return e; }
    const t = buscarTarea(o, tareaId);
    if (!t) { o.entregables.push(e); return e; }
    t.entregables = N().lista(t.entregables);
    t.entregables.push(e);
    return e;
  }

  PL.modelo = {
    VERSION_DATOS: VERSION_DATOS, CLAVE: CLAVE, CLAVES_ANTIGUAS: CLAVES_ANTIGUAS,
    CATEGORIAS_PERFIL: CATEGORIAS_PERFIL, ESTADOS_OFERTA: ESTADOS_OFERTA, TIPOS_FOTO: TIPOS_FOTO,
    esEstadoOferta: esEstadoOferta,
    nuevoPerfil: nuevoPerfil, nuevaOferta: nuevaOferta, nuevaTarea: nuevaTarea,
    nuevaSubtarea: nuevaSubtarea, nuevaLinea: nuevaLinea, nuevoEntregable: nuevoEntregable, conHoras: conHoras,
    normalizarPerfil: normalizarPerfil, normalizarPlantilla: normalizarPlantilla,
    normalizarEntregable: normalizarEntregable, normalizarTarea: normalizarTarea,
    normalizarOferta: normalizarOferta, normalizarFoto: normalizarFoto,
    normalizarEstado: normalizarEstado, migrar: migrar, estadoInicial: estadoInicial,
    JORNADA_DEFECTO: JORNADA_DEFECTO, normalizarJornada: normalizarJornada,
    normalizarFestivos: normalizarFestivos,
    buscarTarea: buscarTarea, buscarSubtarea: buscarSubtarea, buscarLinea: buscarLinea,
    buscarEntregable: buscarEntregable, buscarFoto: buscarFoto, colgarEntregable: colgarEntregable
  };
})(typeof window !== "undefined" ? window : globalThis);
