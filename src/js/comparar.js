"use strict";
/* =====================================================================
   Planifica v3 — COMPARADOR (escenarios y versiones)
   Un escenario es una alternativa de la misma oferta (base / recortada /
   ampliada); una versión es lo que se envió al cliente un día concreto.
   Los dos se guardan igual —una foto (snapshot) de la planificación— y se
   comparan con el mismo motor de deltas.

   Motor PURO: no toca el DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  /* Campos que viajan en una foto. Los importes NO se guardan: se recalculan
     con los perfiles vigentes, que es lo que interesa al comparar. */
  const CAMPOS = ["nombre", "estado", "meses", "fechaInicio", "descripcion", "condicionesPago",
    "impuestos", "descuento", "gastos", "entregables", "tareas"];

  function foto(pr) {
    const s = { creado: N().hoyISO() };
    CAMPOS.forEach(k => { s[k] = N().clonar(pr[k]); });
    return s;
  }

  /** Reconstruye una oferta temporal a partir de una foto (para calcularla). */
  function comoOferta(snap, pr) {
    const base = PL.modelo.nuevoProyecto((pr && pr.nombre) || "Oferta");
    if (!snap) return base;
    CAMPOS.forEach(k => { if (snap[k] !== undefined) base[k] = N().clonar(snap[k]); });
    /* Los ids de la oferta no se tocan: solo interesa el contenido. */
    base.id = (pr && pr.id) || base.id;
    return base;
  }

  /** Cifras clave de una oferta (o de una foto). */
  function resumen(pr, pf, snap) {
    const o = snap ? comoOferta(snap, pr) : pr;
    const r = E().resumenFacturacion(o, pf);
    const est = E().porEstado(o);
    return {
      importe: C().importeProyecto(o, pf),
      gastos: C().gastosTotal(o),
      subtotal: C().subtotalProyecto(o, pf),
      descuento: C().descuentoImporte(o, pf),
      base: C().baseImponible(o, pf),
      impuesto: C().impuestoImporte(o, pf),
      total: C().totalProyecto(o, pf),
      horas: C().horasProyecto(o),
      meses: C().mesesProyecto(o),
      tareas: N().lista(o.tareas).length,
      subtareas: N().suma(o.tareas, t => N().lista(t.subtareas).length),
      entregables: est.total,
      entregablesFinalizados: est.finalizados,
      avance: est.pct,
      facturadoTotal: r.total,
      facturado: r.facturado
    };
  }

  /* ---------- Deltas ---------- */

  function d(a, b) { return N().r2(N().num(b) - N().num(a)); }

  /** Compara dos fotos (o una foto y la oferta actual). Devuelve todo lo que la
      vista necesita para pintar el cuadro de diferencias. */
  function comparar(pr, pf, snapA, snapB, etiquetaA, etiquetaB) {
    const ra = resumen(pr, pf, snapA), rb = resumen(pr, pf, snapB);

    const lineas = (clave, texto) => ({ clave: clave, texto: texto, a: ra[clave], b: rb[clave], d: d(ra[clave], rb[clave]) });

    const economia = [
      lineas("importe", "Consultoría"), lineas("gastos", "Gastos generales"),
      lineas("descuento", "Descuento"), lineas("base", "Base imponible"),
      lineas("impuesto", "Impuestos"), lineas("total", "TOTAL")
    ];
    const estructura = [
      lineas("meses", "Meses"), lineas("tareas", "Tareas"), lineas("subtareas", "Subtareas"),
      lineas("entregables", "Entregables"), lineas("entregablesFinalizados", "Entregables finalizados"),
      lineas("horas", "Horas"), lineas("facturadoTotal", "Facturación planificada")
    ];

    /* Horas e importe por perfil */
    const oA = comoOferta(snapA, pr), oB = comoOferta(snapB, pr);
    const hA = C().horasPorPerfil(oA), hB = C().horasPorPerfil(oB);
    const ids = Object.keys(Object.assign({}, hA, hB));
    const porPerfil = ids.map(id => {
      const p = C().perfilPorId(pf, id);
      return {
        perfilId: id, nombre: p ? p.nombre : "(perfil eliminado)",
        a: N().num(hA[id]), b: N().num(hB[id]), d: d(hA[id], hB[id]),
        importeA: C().importePerfil(oA, pf, id), importeB: C().importePerfil(oB, pf, id),
        importeD: d(C().importePerfil(oA, pf, id), C().importePerfil(oB, pf, id))
      };
    }).filter(x => x.a || x.b);
    porPerfil.sort((x, y) => Math.abs(y.importeD) - Math.abs(x.importeD));

    /* Importe por mes */
    const meses = Math.max(ra.meses, rb.meses);
    const porMes = [];
    for (let i = 0; i < meses; i++) {
      const va = C().importeMes(oA, pf, i), vb = C().importeMes(oB, pf, i);
      porMes.push({ i: i, etiqueta: N().etiquetaMes((snapB || {}).fechaInicio || pr.fechaInicio, i), a: va, b: vb, d: d(va, vb) });
    }

    return {
      etiquetaA: etiquetaA || "Antes", etiquetaB: etiquetaB || "Ahora",
      a: ra, b: rb,
      economia: economia, estructura: estructura,
      porPerfil: porPerfil, porMes: porMes,
      cambios: cambios(pr, snapA, snapB),
      hayDiferencias: economia.some(l => Math.abs(l.d) > 0.005) || estructura.some(l => l.d !== 0) || porPerfil.some(x => x.d !== 0)
    };
  }

  /** Lista legible de cambios de estructura entre dos fotos. */
  function cambios(pr, snapA, snapB) {
    const out = [];
    const A = comoOferta(snapA, pr), B = comoOferta(snapB, pr);

    const idx = arr => { const m = {}; N().lista(arr).forEach(x => { m[x.id] = x; }); return m; };
    const ta = idx(A.tareas), tb = idx(B.tareas);

    Object.keys(tb).forEach(id => {
      if (!ta[id]) out.push({ tipo: "tarea+", texto: "Tarea nueva: " + N().texto(tb[id].nombre, "") });
    });
    Object.keys(ta).forEach(id => {
      if (!tb[id]) out.push({ tipo: "tarea-", texto: "Tarea eliminada: " + N().texto(ta[id].nombre, "") });
      else {
        const x = ta[id], y = tb[id];
        if (x.nombre !== y.nombre) out.push({ tipo: "tarea~", texto: "Tarea renombrada: «" + x.nombre + "» → «" + y.nombre + "»" });
        const ha = C().tareaHoras(x), hb = C().tareaHoras(y);
        if (Math.abs(ha - hb) > 0.005) out.push({ tipo: "horas~", texto: "Horas en «" + y.nombre + "»: " + N().fmtHoras(ha) + " → " + N().fmtHoras(hb) });
      }
    });

    /* Entregables: altas, bajas y cambios de estado */
    const ea = {}, eb = {};
    E().todos(A).forEach(e => { ea[e.id] = e; });
    E().todos(B).forEach(e => { eb[e.id] = e; });
    Object.keys(eb).forEach(id => {
      const b = eb[id], a = ea[id];
      if (!a) out.push({ tipo: "hito+", texto: "Entregable nuevo: " + b.nombre + (b._tareaNombre ? " (" + b._tareaNombre + ")" : " (oferta)") });
      else if (a.estado !== b.estado) out.push({ tipo: "hito~", texto: "Entregable «" + b.nombre + "»: " + a.estado + " → " + b.estado });
      else if (N().num(a.facturacionPct) !== N().num(b.facturacionPct)) out.push({ tipo: "hito~", texto: "Entregable «" + b.nombre + "»: " + a.facturacionPct + " % → " + b.facturacionPct + " %" });
    });
    Object.keys(ea).forEach(id => {
      if (!eb[id]) out.push({ tipo: "hito-", texto: "Entregable eliminado: " + ea[id].nombre });
    });

    /* Gastos y condiciones */
    const ga = N().suma(N().lista(A.gastos), g => N().num(g.unidades) * N().num(g.precio));
    const gb = N().suma(N().lista(B.gastos), g => N().num(g.unidades) * N().num(g.precio));
    if (Math.abs(ga - gb) > 0.005) out.push({ tipo: "gastos~", texto: "Gastos generales: " + N().fmtImporte(ga) + " → " + N().fmtImporte(gb) });
    if (N().num(A.meses) !== N().num(B.meses)) out.push({ tipo: "meses~", texto: "Duración: " + A.meses + " → " + B.meses + " meses" });
    if ((A.estado || "") !== (B.estado || "")) out.push({ tipo: "oferta~", texto: "Estado de la oferta: " + A.estado + " → " + B.estado });

    return out;
  }

  /* ---------- Escenarios y versiones ---------- */

  function crearEscenario(pr, nombre, etiqueta) {
    pr.escenarios = N().lista(pr.escenarios);
    const e = {
      id: N().uid("es_"), nombre: N().texto(nombre, "Escenario"), etiqueta: N().texto(etiqueta, ""),
      creado: N().hoyISO(), snapshot: foto(pr)
    };
    pr.escenarios.push(e);
    return e;
  }

  function crearVersion(pr, pf, etiqueta, nota) {
    pr.versiones = N().lista(pr.versiones);
    const v = {
      id: N().uid("vs_"), etiqueta: N().texto(etiqueta, "Versión"), fecha: N().hoyISO(),
      nota: N().texto(nota, ""), snapshot: foto(pr), resumen: resumen(pr, pf)
    };
    pr.versiones.push(v);
    return v;
  }

  /** Aplica una foto (escenario o versión) sobre la oferta. Devuelve la oferta. */
  function aplicarFoto(pr, snap) {
    if (!snap) return pr;
    CAMPOS.forEach(k => { if (snap[k] !== undefined) pr[k] = N().clonar(snap[k]); });
    return pr;
  }

  function borrarEscenario(pr, id) { pr.escenarios = N().lista(pr.escenarios).filter(e => e.id !== id); }
  function borrarVersion(pr, id) { pr.versiones = N().lista(pr.versiones).filter(v => v.id !== id); }

  PL.comparar = {
    CAMPOS: CAMPOS, foto: foto, comoOferta: comoOferta, resumen: resumen, comparar: comparar,
    cambios: cambios, crearEscenario: crearEscenario, crearVersion: crearVersion,
    aplicarFoto: aplicarFoto, borrarEscenario: borrarEscenario, borrarVersion: borrarVersion
  };
})(typeof window !== "undefined" ? window : globalThis);
