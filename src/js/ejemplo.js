"use strict";
/* =====================================================================
   Planifica v4 — EJEMPLO Y VALORES DE FÁBRICA
   Perfiles por defecto, plantilla de oferta y la oferta de ejemplo que se
   ve la primera vez (con entregables repartidos por el calendario).
   Sin DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;

  /** 7 perfiles de fábrica con IDs FIJOS (para poder restaurarlos uno a uno). */
  function perfilesDefecto() {
    const defs = [
      ["pf_dir-proy",    "Dirección de proyecto",    "Jefe/a de proyecto",             60],
      ["pf_senior-15",   "Consultoría senior",       "Consultor/a senior (+15 años)",  65],
      ["pf_senior-10",   "Consultoría senior",       "Consultor/a senior (10–15 años)", 55],
      ["pf_media-5",     "Consultoría media",        "Consultor/a (5–10 años)",        48],
      ["pf_junior-2",    "Consultoría junior",       "Consultor/a junior (2–5 años)",  42],
      ["pf_tecnico-tic", "Perfil técnico",           "Personal técnico TIC",           50],
      ["pf_admin-proy",  "Soporte y administración", "Administrativo/a de proyecto",   32]
    ];
    return defs.map(d => ({ id: d[0], nombre: d[2], unidad: "h", tarifa: d[3], categoria: d[1], esDefecto: true }));
  }

  /** Plantilla de fábrica: estructura habitual de una oferta de servicios,
      con sus entregables situados a lo largo del calendario. */
  function plantillasDefecto() {
    return [{
      id: "pl_estandar", nombre: "Oferta estándar de servicios", esDefecto: true,
      desc: "Análisis, diseño, ejecución, pruebas y gestión, con sus entregables",
      tareas: [
        {
          nombre: "1. Análisis y planificación",
          subtareas: ["1.1 Reunión de arranque", "1.2 Análisis de requisitos", "1.3 Plan de trabajo"],
          entregables: [
            { nombre: "Informe de requisitos validado", descripcion: "Alcance cerrado y firmado por el cliente.", criterio: "Acta de reunión con el alcance aprobado", periodo: 0 },
            { nombre: "Plan de trabajo detallado", descripcion: "Cronograma y reparto de esfuerzo.", criterio: "Cronograma aceptado por el cliente", periodo: 1 }
          ]
        },
        {
          nombre: "2. Diseño de la solución",
          subtareas: ["2.1 Arquitectura de la solución", "2.2 Diseño funcional"],
          entregables: [
            { nombre: "Diseño funcional aprobado", descripcion: "Documento de diseño de la solución.", criterio: "Aprobación formal del cliente", periodo: 2 }
          ]
        },
        {
          nombre: "3. Ejecución",
          subtareas: ["3.1 Desarrollo / ejecución", "3.2 Revisiones de calidad"],
          entregables: [
            { nombre: "Solución en preproducción", descripcion: "Versión completa en entorno de pruebas.", criterio: "Pruebas de aceptación superadas", periodo: 4 }
          ]
        },
        {
          nombre: "4. Pruebas y entrega",
          subtareas: ["4.1 Pruebas y validación", "4.2 Documentación y entrega"],
          entregables: [
            { nombre: "Entrega final y documentación", descripcion: "Puesta en producción y manual de uso.", criterio: "Acta de entrega firmada", periodo: 5 }
          ]
        },
        { nombre: "5. Gestión de proyecto", subtareas: ["5.1 Seguimiento y coordinación"], entregables: [] }
      ]
    }];
  }

  /** Oferta de ejemplo: 2 tareas, horas por perfil y periodo, y 5 entregables. */
  function ofertaEjemplo(perfiles) {
    const M2 = M();
    const porNombre = t => perfiles.filter(p => p.nombre.indexOf(t) >= 0)[0];
    const jp = porNombre("Jefe"), sen = porNombre("senior (+15"), med = porNombre("(5–10"),
          jru = porNombre("junior"), tec = porNombre("técnico TIC");

    const o = M2.nuevaOferta("Ejemplo — Rediseño de web corporativa");
    o.guia = true;
    o.cliente = { nombre: "Cliente de ejemplo, S.L.", contacto: "Ana García · ana@cliente.es", ref: "EF/2026-042" };
    o.periodos.inicio = N().mesISO(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
    o.periodos.n = 6;
    o.descripcion = "Rediseño completo de la web corporativa con nueva identidad visual y gestión de contenidos.";
    o.condicionesPago = "50 % a la firma de la oferta y 50 % a la entrega final.";
    o.impuestos = { tipo: "iva", tasa: 21, incluido: false };
    o.descuento = { tipo: "%", valor: 5 };
    o.gastos = [
      { id: N().uid("g_"), nombre: "Licencias y herramientas (6 meses)", unidades: 6, precio: 45 },
      { id: N().uid("g_"), nombre: "Formación del equipo cliente", unidades: 1, precio: 900 }
    ];

    /* ---- Tarea 1 ---- */
    const t1 = M2.nuevaTarea("1. Análisis y diseño");
    const s1 = M2.nuevaSubtarea("1.1 Descubrimiento y requisitos");
    s1.lineas = [
      M2.conHoras(M2.nuevaLinea(jp.id, 6), { p0: 4, p1: 2 }),
      M2.conHoras(M2.nuevaLinea(sen.id, 6), { p0: 12, p1: 10, p2: 4 }),
      M2.conHoras(M2.nuevaLinea(med.id, 6), { p0: 16, p1: 12, p2: 6 })
    ];
    const s2 = M2.nuevaSubtarea("1.2 Diseño UX/UI");
    s2.lineas = [
      M2.conHoras(M2.nuevaLinea(med.id, 6), { p1: 20, p2: 24, p3: 10 }),
      M2.conHoras(M2.nuevaLinea(tec.id, 6), { p1: 8, p2: 8 })
    ];
    t1.subtareas = [s1, s2];
    /* Los entregables cuelgan de la subtarea que los produce. */
    s1.entregables = [
      Object.assign(M2.nuevoEntregable("1.1 Informe de requisitos", "subtarea", 0), {
        descripcion: "Análisis de la web actual, usuarios y contenidos.",
        criterio: "Validado por el cliente en la reunión de alcance",
        responsablePerfilId: jp.id
      })
    ];
    s2.entregables = [
      Object.assign(M2.nuevoEntregable("1.2 Prototipo UX navegable", "subtarea", 2), {
        descripcion: "Prototipo de las 8 pantallas principales.",
        criterio: "Prototipo revisado y aprobado en Figma",
        responsablePerfilId: med.id
      })
    ];
    /* Y uno a nivel de la TAREA COMPLETA, porque también se entregan cosas así. */
    t1.entregables = [
      Object.assign(M2.nuevoEntregable("1.3 Manual de estilo", "tarea", 3), {
        descripcion: "Guía de estilo para que el cliente mantenga la web.",
        criterio: "Manual entregado y explicado al equipo del cliente",
        responsablePerfilId: med.id
      })
    ];

    /* ---- Tarea 2 ---- */
    const t2 = M2.nuevaTarea("2. Desarrollo y lanzamiento");
    const s3 = M2.nuevaSubtarea("2.1 Desarrollo front-end");
    s3.lineas = [
      M2.conHoras(M2.nuevaLinea(jru.id, 6), { p2: 40, p3: 60, p4: 40 }),
      M2.conHoras(M2.nuevaLinea(tec.id, 6), { p3: 20, p4: 20 })
    ];
    const s4 = M2.nuevaSubtarea("2.2 Pruebas y publicación");
    s4.lineas = [
      M2.conHoras(M2.nuevaLinea(sen.id, 6), { p4: 6 }),
      M2.conHoras(M2.nuevaLinea(jru.id, 6), { p4: 16, p5: 8 })
    ];
    t2.subtareas = [s3, s4];
    s3.entregables = [
      Object.assign(M2.nuevoEntregable("2.1 Web en preproducción", "subtarea", 4), {
        descripcion: "Sitio completo funcionando en entorno de pruebas.",
        criterio: "Checklist de pruebas funcionales superado",
        responsablePerfilId: jru.id
      })
    ];
    s4.entregables = [
      Object.assign(M2.nuevoEntregable("2.2 Puesta en producción", "subtarea", 5), {
        descripcion: "Publicación, dominios y formación al equipo.",
        criterio: "Acta de entrega y formación realizada",
        responsablePerfilId: sen.id
      })
    ];

    o.tareas = [t1, t2];

    /* Pasa por la normalización como cualquier oferta: así llegan los festivos del
       calendario, la jornada queda completa y no hay dos caminos distintos. */
    return M2.normalizarOferta(o);
  }

  PL.ejemplo = {
    perfilesDefecto: perfilesDefecto,
    plantillasDefecto: plantillasDefecto,
    ofertaEjemplo: ofertaEjemplo
  };
})(typeof window !== "undefined" ? window : globalThis);
