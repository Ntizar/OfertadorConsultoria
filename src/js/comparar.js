"use strict";
/* =====================================================================
   Planifica v4 — FOTOS, ESCENARIOS Y VERSIONES
   Una FOTO es una copia de la planificación de la oferta. Se usa para dos
   cosas:
     · escenario → alternativa de la misma oferta (base, recortada, ampliada)
     · versión   → la oferta tal como se envió o se acordó un día concreto
   Las dos se comparan con el mismo cuadro de diferencias.

   Motor puro, sin DOM.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const E = () => PL.entregables;

  /* Lo que viaja en una foto. Los importes NO se guardan: se recalculan con
     los perfiles vigentes, que es lo que interesa al comparar. */
  const CAMPOS = ["nombre", "estado", "descripcion", "condicionesPago", "periodos",
    "impuestos", "descuento", "gastos", "entregables", "tareas"];

  function foto(o) {
    const f = { fecha: N().hoyISO() };
    CAMPOS.forEach(k => { f[k] = N().clonar(o[k]); });
    return f;
  }

  /** Oferta temporal reconstruida desde una foto (para calcularla). */
  function comoOferta(f, o) {
    const base = PL.modelo.nuevaOferta((o && o.nombre) || "Oferta");
    if (!f) return base;
    CAMPOS.forEach(k => { if (f[k] !== undefined) base[k] = N().clonar(f[k]); });
    base.id = (o && o.id) || base.id;
    return base;
  }

  /** Cifras clave de una oferta o de una foto. */
  function resumen(o, pf, f) {
    const of = f ? comoOferta(f, o) : o;
    const conteo = E().porContexto(of);
    return {
      importe: C().importeOferta(of, pf),
      gastos: C().gastosTotal(of),
      subtotal: C().subtotalOferta(of, pf),
      descuento: C().descuentoImporte(of, pf),
      base: C().baseImponible(of, pf),
      impuesto: C().impuestoImporte(of, pf),
      total: C().totalOferta(of, pf),
      horas: C().ofertaHoras(of),
      periodos: P().meses(of.periodos),
      tareas: N().lista(of.tareas).length,
      subtareas: N().suma(of.tareas, t => N().lista(t.subtareas).length),
      entregables: conteo.total,
    };
  }

  /* ---------- Comparación ---------- */

  function d(a, b) { return N().r2(N().num(b) - N().num(a)); }

  function comparar(o, pf, fA, fB, etiquetaA, etiquetaB) {
    const ra = resumen(o, pf, fA), rb = resumen(o, pf, fB);
    const linea = (clave, texto_) => ({ clave: clave, texto: texto_, a: ra[clave], b: rb[clave], d: d(ra[clave], rb[clave]) });

    const economia = [
      linea("importe", "Consultoría"), linea("gastos", "Gastos generales"),
      linea("descuento", "Descuento"), linea("base", "Base imponible"),
      linea("impuesto", "Impuestos"), linea("total", "TOTAL")
    ];
    const estructura = [
      linea("periodos", "Periodos"), linea("tareas", "Tareas"), linea("subtareas", "Subtareas"),
    ];

    const oA = comoOferta(fA, o), oB = comoOferta(fB, o);

    /* Horas por perfil */
    const hA = C().horasPorPerfil(oA), hB = C().horasPorPerfil(oB);
    const ids = Object.keys(Object.assign({}, hA, hB));
    const porPerfil = ids.map(id => {
      const p = C().perfilPorId(pf, id);
      const ia = C().importePerfil(oA, pf, id), ib = C().importePerfil(oB, pf, id);
      return {
        perfilId: id, nombre: p ? p.nombre : "(perfil eliminado)",
        a: N().num(hA[id]), b: N().num(hB[id]), d: d(hA[id], hB[id]),
        importeA: ia, importeB: ib, importeD: d(ia, ib)
      };
    }).filter(x => x.a || x.b).sort((x, y) => Math.abs(y.importeD) - Math.abs(x.importeD));

    /* Importe por periodo (sobre el calendario más largo de los dos) */
    const nMax = Math.max(ra.periodos, rb.periodos);
    const porPeriodo = [];
    for (let i = 0; i < nMax; i++) {
      const va = C().importePeriodo(oA, pf, i), vb = C().importePeriodo(oB, pf, i);
      porPeriodo.push({
        i: i, etiqueta: P().etiqueta((fB && fB.periodos) || oB.periodos, i),
        a: va, b: vb, d: d(va, vb)
      });
    }

    const economiaCambia = economia.some(l => Math.abs(l.d) > 0.005);
    const estructuraCambia = estructura.some(l => l.d !== 0);
    return {
      etiquetaA: etiquetaA || "Antes", etiquetaB: etiquetaB || "Ahora",
      a: ra, b: rb, economia: economia, estructura: estructura,
      porPerfil: porPerfil, porPeriodo: porPeriodo,
      cambios: cambios(o, fA, fB),
      hayDiferencias: economiaCambia || estructuraCambia || porPerfil.some(x => x.d !== 0)
    };
  }

  /** Lista legible de cambios entre dos fotos. */
  function cambios(o, fA, fB) {
    const out = [];
    const A = comoOferta(fA, o), B = comoOferta(fB, o);

    const porId = arr => { const m = {}; N().lista(arr).forEach(x => { m[x.id] = x; }); return m; };

    /* Tareas */
    const ta = porId(A.tareas), tb = porId(B.tareas);
    Object.keys(tb).forEach(id => { if (!ta[id]) out.push({ tipo: "alta", texto: "Tarea nueva: " + tb[id].nombre }); });
    Object.keys(ta).forEach(id => {
      if (!tb[id]) { out.push({ tipo: "baja", texto: "Tarea eliminada: " + ta[id].nombre }); return; }
      const x = ta[id], y = tb[id];
      if (x.nombre !== y.nombre) out.push({ tipo: "cambio", texto: "Tarea renombrada: «" + x.nombre + "» → «" + y.nombre + "»" });
      const ha = C().tareaHoras(x), hb = C().tareaHoras(y);
      if (Math.abs(ha - hb) > 0.005) out.push({ tipo: "cambio", texto: "Horas en «" + y.nombre + "»: " + N().fmtHoras(ha) + " → " + N().fmtHoras(hb) });
    });

    /* Entregables (altas, bajas y cambios de periodo) */
    const ea = {}, eb = {};
    E().todos(A).forEach(e => { ea[e.id] = e; });
    E().todos(B).forEach(e => { eb[e.id] = e; });
    Object.keys(eb).forEach(id => {
      const b = eb[id], a = ea[id];
      if (!a) { out.push({ tipo: "alta", texto: "Entregable nuevo: " + b.nombre + (b._tareaNombre ? " (" + b._tareaNombre + ")" : " (oferta)") }); return; }
      if (a.nombre !== b.nombre) out.push({ tipo: "cambio", texto: "Entregable renombrado: «" + a.nombre + "» → «" + b.nombre + "»" });
      if (N().num(a.periodo) !== N().num(b.periodo)) {
        out.push({ tipo: "cambio", texto: "Entrega de «" + b.nombre + "»: " + P().mesCorto(A.periodos, a.periodo) + " → " + P().mesCorto(B.periodos, b.periodo) });
      }
      if (N().num(a.horas) !== N().num(b.horas)) out.push({ tipo: "cambio", texto: "Horas de «" + b.nombre + "»: " + N().fmtHoras(a.horas) + " → " + N().fmtHoras(b.horas) });
    });
    Object.keys(ea).forEach(id => { if (!eb[id]) out.push({ tipo: "baja", texto: "Entregable eliminado: " + ea[id].nombre }); });

    /* Gastos, calendario y estado */
    const ga = C().gastosTotal(A), gb = C().gastosTotal(B);
    if (Math.abs(ga - gb) > 0.005) out.push({ tipo: "cambio", texto: "Gastos generales: " + N().fmtImporte(ga) + " → " + N().fmtImporte(gb) });
    if (P().meses(A.periodos) !== P().meses(B.periodos)) {
      out.push({ tipo: "cambio", texto: "Duración: " + P().meses(A.periodos) + " → " + P().meses(B.periodos) + " periodos" });
    }
    if (A.periodos.inicio !== B.periodos.inicio) {
      out.push({ tipo: "cambio", texto: "Inicio: " + P().mesLargo(A.periodos, 0) + " → " + P().mesLargo(B.periodos, 0) });
    }
    if ((A.estado || "") !== (B.estado || "")) out.push({ tipo: "cambio", texto: "Estado de la oferta: " + A.estado + " → " + B.estado });

    return out;
  }

  /* ---------- Alta, aplicación y baja de fotos ---------- */

  function crearFoto(o, tipo, nombre, nota) {
    o.fotos = N().lista(o.fotos);
    const f = PL.modelo.normalizarFoto({
      tipo: (tipo === "version") ? "version" : "escenario",
      nombre: N().texto(nombre, tipo === "version" ? ("v" + (o.fotos.filter(x => x.tipo === "version").length + 1)) : "Escenario"),
      nota: N().texto(nota, ""),
      fecha: N().hoyISO(), snapshot: foto(o)
    });
    f.resumen = resumen(o, PL.app ? PL.app.pf() : [], f.snapshot);
    o.fotos.push(f);
    return f;
  }

  function fotosDe(o, tipo) { return N().lista(o && o.fotos).filter(f => f.tipo === tipo); }

  function borrarFoto(o, id) { o.fotos = N().lista(o.fotos).filter(f => f.id !== id); }

  /** Aplica una foto sobre la oferta (la oferta sigue siendo la misma). */
  function aplicarFoto(o, snapshot) {
    if (!snapshot) return o;
    CAMPOS.forEach(k => { if (snapshot[k] !== undefined) o[k] = N().clonar(snapshot[k]); });
    return o;
  }

  PL.comparar = {
    CAMPOS: CAMPOS, foto: foto, comoOferta: comoOferta, resumen: resumen, comparar: comparar,
    cambios: cambios, crearFoto: crearFoto, fotosDe: fotosDe, borrarFoto: borrarFoto, aplicarFoto: aplicarFoto
  };
})(typeof window !== "undefined" ? window : globalThis);
