"use strict";
/* =====================================================================
   Planifica v3 — EJEMPLO Y VALORES DE FÁBRICA
   Lo que ve el usuario la primera vez: perfiles por defecto, plantillas de
   tareas y la oferta de ejemplo completa (con entregables y su facturación).
   Sin DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;

  /** 7 perfiles de fábrica con IDs FIJOS (para poder restaurarlos uno a uno). */
  function perfilesDefecto() {
    const defs = [
      ["pf_dir-proy",    "Dirección de proyecto",   "Jefe/a de proyecto",               60],
      ["pf_senior-15",   "Consultoría senior",      "Consultor/a senior (+15 años)",    65],
      ["pf_senior-10",   "Consultoría senior",      "Consultor/a senior (10–15 años)",  55],
      ["pf_media-5",     "Consultoría media",       "Consultor/a (5–10 años)",          48],
      ["pf_junior-2",    "Consultoría junior",      "Consultor/a junior (2–5 años)",    42],
      ["pf_tecnico-tic", "Perfil técnico",          "Personal técnico TIC",             50],
      ["pf_admin-proy",  "Soporte y administración","Administrativo/a de proyecto",     32]
    ];
    return defs.map(d => ({ id: d[0], nombre: d[2], unidades: "h", tarifa: d[3], categoria: d[1], esDefecto: true }));
  }

  /** Plantilla de fábrica: estructura habitual de una oferta de servicios,
      ya con entregables repartidos al 100 % de cada tarea. */
  function plantillasDefecto() {
    return [{
      id: "pl_estandar", nombre: "Oferta estándar de servicios", esDefecto: true,
      desc: "Análisis, diseño, ejecución, pruebas y gestión, con entregables al 100 %",
      tareas: [
        {
          nombre: "1. Análisis y planificación",
          subtareas: ["1.1 Reunión de arranque", "1.2 Análisis de requisitos", "1.3 Plan de trabajo"],
          entregables: [
            { nombre: "Informe de requisitos validado", descripcion: "Alcance cerrado y firmado por el cliente.", criterio: "Acta de reunión con el alcance aprobado", mes: 0, facturacionPct: 40 },
            { nombre: "Plan de trabajo detallado",      descripcion: "Cronograma y reparto de esfuerzo.",         criterio: "Cronograma aceptado por el cliente",   mes: 1, facturacionPct: 60 }
          ]
        },
        {
          nombre: "2. Diseño de la solución",
          subtareas: ["2.1 Arquitectura de la solución", "2.2 Diseño funcional"],
          entregables: [
            { nombre: "Diseño funcional aprobado", descripcion: "Documento de diseño de la solución.", criterio: "Aprobación formal del cliente", mes: 2, facturacionPct: 100 }
          ]
        },
        {
          nombre: "3. Ejecución",
          subtareas: ["3.1 Desarrollo / ejecución", "3.2 Revisiones de calidad"],
          entregables: [
            { nombre: "Solución en preproducción", descripcion: "Versión completa desplegada en entorno de pruebas.", criterio: "Pruebas de aceptación superadas", mes: 4, facturacionPct: 100 }
          ]
        },
        {
          nombre: "4. Pruebas y entrega",
          subtareas: ["4.1 Pruebas y validación", "4.2 Documentación y entrega"],
          entregables: [
            { nombre: "Entrega final y documentación", descripcion: "Puesta en producción y manual de uso.", criterio: "Acta de entrega firmada", mes: 5, facturacionPct: 100 }
          ]
        },
        { nombre: "5. Gestión de proyecto", subtareas: ["5.1 Seguimiento y coordinación"], entregables: [] }
      ]
    }];
  }

  /** Oferta de ejemplo: 2 tareas con subtareas, horas por perfil y mes,
      entregables al 100 % por tarea y un hito de gestión en la oferta. */
  function proyectoEjemplo(perfiles) {
    const M2 = M();
    const porNombre = t => perfiles.filter(p => p.nombre.indexOf(t) >= 0)[0];
    const jp = porNombre("Jefe"), sen = porNombre("senior (+15"), med = porNombre("(5–10"),
          jru = porNombre("junior"), tec = porNombre("técnico TIC");
    const mesQueViene = i => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1 + (i || 0), 1).toISOString().slice(0, 7);
    };

    const p = M2.nuevoProyecto("Ejemplo — Rediseño de web corporativa");
    p.guia = true;
    p.cliente = { nombre: "Cliente de ejemplo, S.L.", contacto: "Ana García · ana@cliente.es", ref: "EF/2026-042" };
    p.fechaInicio = mesQueViene(0);
    p.meses = 6;
    p.descripcion = "Rediseño completo de la web corporativa con nueva identidad visual y gestión de contenidos.";
    p.condicionesPago = "Facturación por entregables aceptados, a 30 días fecha de factura.";
    p.impuestos = { tipo: "iva", tasa: 21, incluido: false };
    p.descuento = { tipo: "%", valor: 5 };
    p.gastos = [
      { id: N().uid("g_"), nombre: "Licencias y herramientas (6 meses)", unidades: 6, precio: 45 },
      { id: N().uid("g_"), nombre: "Formación del equipo cliente", unidades: 1, precio: 900 }
    ];

    /* ---- Tarea 1 ---- */
    const t1 = M2.nuevaTarea("1. Análisis y diseño");
    const s1 = M2.nuevaSub("1.1 Descubrimiento y requisitos");
    s1.lineas = [
      M2.lCon(M2.nuevaLinea(jp.id, 6), { m0: 4, m1: 2 }),
      M2.lCon(M2.nuevaLinea(sen.id, 6), { m0: 12, m1: 10, m2: 4 }),
      M2.lCon(M2.nuevaLinea(med.id, 6), { m0: 16, m1: 12, m2: 6 })
    ];
    const s2 = M2.nuevaSub("1.2 Diseño UX/UI");
    s2.lineas = [
      M2.lCon(M2.nuevaLinea(med.id, 6), { m1: 20, m2: 24, m3: 10 }),
      M2.lCon(M2.nuevaLinea(tec.id, 6), { m1: 8, m2: 8 })
    ];
    t1.subtareas = [s1, s2];
    t1.entregables = [
      Object.assign(M2.nuevoEntregable("1.1 Informe de requisitos", "tarea", 0), {
        descripcion: "Análisis de la web actual, usuarios y contenidos.", estado: "aceptado",
        criterio: "Validado por el cliente en la reunión de alcance",
        responsablePerfilId: jp.id, facturacionPct: 40
      }),
      Object.assign(M2.nuevoEntregable("1.2 Prototipo UX navegable", "tarea", 2), {
        descripcion: "Prototipo de las 8 pantallas principales.", estado: "entregado",
        criterio: "Prototipo revisado y aprobado en Figma",
        responsablePerfilId: med.id, facturacionPct: 60
      })
    ];

    /* ---- Tarea 2 ---- */
    const t2 = M2.nuevaTarea("2. Desarrollo y lanzamiento");
    const s3 = M2.nuevaSub("2.1 Desarrollo front-end");
    s3.lineas = [
      M2.lCon(M2.nuevaLinea(jru.id, 6), { m2: 40, m3: 60, m4: 40 }),
      M2.lCon(M2.nuevaLinea(tec.id, 6), { m3: 20, m4: 20 })
    ];
    const s4 = M2.nuevaSub("2.2 Pruebas y publicación");
    s4.lineas = [
      M2.lCon(M2.nuevaLinea(sen.id, 6), { m4: 6 }),
      M2.lCon(M2.nuevaLinea(jru.id, 6), { m4: 16, m5: 8 })
    ];
    t2.subtareas = [s3, s4];
    t2.entregables = [
      Object.assign(M2.nuevoEntregable("2.1 Web en preproducción", "tarea", 4), {
        descripcion: "Sitio completo funcionando en entorno de pruebas.", estado: "encurso",
        criterio: "Checklist de pruebas funcionales superado",
        responsablePerfilId: jru.id, facturacionPct: 50
      }),
      Object.assign(M2.nuevoEntregable("2.2 Puesta en producción", "tarea", 5), {
        descripcion: "Publicación, dominios y formación al equipo.", estado: "pendiente",
        criterio: "Acta de entrega y formación realizada",
        responsablePerfilId: sen.id, facturacionPct: 50
      })
    ];

    p.tareas = [t1, t2];

    /* ---- Hitos de oferta (sin importe: informativos) ---- */
    p.entregables = [
      Object.assign(M2.nuevoEntregable("Reunión mensual de seguimiento", "oferta", 5), {
        descripcion: "Seguimiento del proyecto con el cliente.",
        criterio: "Acta de cada reunión", estado: "pendiente", facturacionPct: 0
      })
    ];

    return p;
  }

  PL.ejemplo = {
    perfilesDefecto: perfilesDefecto,
    plantillasDefecto: plantillasDefecto,
    proyectoEjemplo: proyectoEjemplo
  };
})(typeof window !== "undefined" ? window : globalThis);
