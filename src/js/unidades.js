"use strict";
/* =====================================================================
   Planifica v4 — UNIDADES DEL CALENDARIO
   El mismo trabajo se puede planificar por MESES o por SEMANAS. Aquí vive la
   conversión de una a otra, que reparte las horas por días laborables reales
   (no a partes iguales): así una semana de agosto no se lleva lo mismo que una
   de octubre, y la dedicación no se dispara sola.

   Regla: la conversión la decide el usuario y con aviso. Nada se convierte por
   sorpresa.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;

  /* ---------- Semanas de un mes ---------- */

  /** El lunes de la semana en la que cae una fecha. */
  function lunes(d) {
    const dia = d.getDay();                       /* 0 = domingo */
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (dia === 0 ? -6 : 1 - dia));
  }

  /** Días laborables que hay entre dos fechas (ambas dentro), según los días trabajados. */
  function diasLaborablesEntre(desde, hasta, diasSemana) {
    const dias = (Array.isArray(diasSemana) && diasSemana.length) ? diasSemana : [1, 2, 3, 4, 5];
    let n = 0;
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    while (d <= hasta) {
      const wd = d.getDay();
      if (dias.indexOf(wd === 0 ? 7 : wd) >= 0) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  /** Las semanas (por su lunes) que tocan un mes, con los días laborables que caen
      DENTRO de ese mes. Es la clave para repartir sin inventarse jornadas. */
  function semanasDelMes(anio, mes, jornada) {
    const primero = new Date(anio, mes - 1, 1);
    const ultimo = new Date(anio, mes, 0);
    const out = [];
    let l = lunes(primero);
    while (l <= ultimo) {
      const desde = l < primero ? primero : l;
      const fin = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 6);
      const hasta = fin > ultimo ? ultimo : fin;
      const dias = diasLaborablesEntre(desde, hasta, jornada && jornada.diasSemana);
      if (dias > 0) out.push({ lunes: l, dias: dias });
      l = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 7);
    }
    return out;
  }

  /** Mes al que pertenece una semana: el del jueves (criterio ISO). */
  function mesDeSemana(l, anioMes) {
    const jueves = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 3);
    void anioMes;
    return { anio: jueves.getFullYear(), mes: jueves.getMonth() + 1 };
  }

  /** Las semanas del rango del calendario, en orden y sin repetir: desde el lunes
      de la semana del primer día hasta el último día del último mes. Cada semana
      pertenece al mes de su jueves (criterio ISO), así que el reparto del mes entre
      sus semanas nunca cuenta dos veces la misma. */
  function mapaSemanas(periodos, jornada) {
    const P = PL.periodos;
    const p = P.normalizar(periodos);
    const nMeses = p.n;
    const partes = p.inicio.split("-").map(Number);
    const mesCero = partes[0] * 12 + (partes[1] - 1);
    const primero = new Date(partes[0], partes[1] - 1, 1);
    const ultimo = new Date(partes[0], partes[1] - 1 + nMeses, 0);
    const dias = (jornada && jornada.diasSemana) || [1, 2, 3, 4, 5];
    const base = lunes(primero);
    const semanas = [];
    const porMes = {};
    for (let i = 0; i < nMeses; i++) porMes[i] = [];
    let l = base;
    while (l <= ultimo) {
      const fin = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 6);
      const desde = l < primero ? primero : l;
      const hasta = fin > ultimo ? ultimo : fin;
      const jueves = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 3);
      const mes = (jueves.getFullYear() * 12 + jueves.getMonth()) - mesCero;
      const diasLab = diasLaborablesEntre(desde, hasta, dias);
      const indice = semanas.push({ lunes: l, mes: mes, dias: diasLab }) - 1;
      if (porMes[mes]) porMes[mes].push({ indice: indice, dias: diasLab });
      l = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 7);
    }
    return { semanas: semanas, porMes: porMes };
  }

  /* ---------- Reparto de horas ---------- */

  /** Reparte `horas` entre varios tramos según su peso, cuadrando al final para no
      perder ni ganar céntimos de hora. */
  function reparte(horas, pesos) {
    const total = pesos.reduce((a, b) => a + b, 0);
    if (total <= 0 || horas <= 0) return pesos.map(() => 0);
    const out = [];
    let acumulado = 0;
    pesos.forEach((peso, i) => {
      if (i === pesos.length - 1) { out.push(N().r2(horas - acumulado)); return; }
      const v = N().r2(horas * peso / total);
      out.push(v);
      acumulado = N().r2(acumulado + v);
    });
    return out;
  }

  /* ---------- Conversión de una oferta ---------- */

  /** Pasa una oferta de meses a semanas (o al revés). Devuelve un resumen con lo que
      ha pasado, para poder avisar de forma honesta. */
  function convertirOferta(o, destino) {
    const P = PL.periodos, M = PL.modelo;
    if (!o || (destino !== "semana" && destino !== "mes")) return null;
    if (P.normalizar(o.periodos).unidad === destino) return null;

    const jornada = M.normalizarJornada(o.jornada);
    const nMeses = P.meses(o.periodos);
    const resumen = { de: P.normalizar(o.periodos).unidad, a: destino, nMeses: nMeses, totalHoras: 0 };

    /* Se trabaja con TODAS las horas por mes, sumando todas las líneas. */
    const horasMes = [];
    for (let i = 0; i < nMeses; i++) horasMes.push(0);
    N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
      for (let i = 0; i < nMeses; i++) horasMes[i] = N().r2(horasMes[i] + N().num((l.horas || {})["p" + i]));
    })));
    resumen.totalHoras = N().r2(horasMes.reduce((a, b) => a + b, 0));

    /* --- Meses → semanas --- */
    if (destino === "semana") {
      const mapa = mapaSemanas(o.periodos, jornada);
      const nSemanas = mapa.semanas.length;
      const horasLinea = l => {
        const out = [];
        for (let i = 0; i < nMeses; i++) {
          const h = N().num((l.horas || {})["p" + i]);
          const tramos = mapa.porMes[i] || [];
          const valores = reparte(h, tramos.map(x => x.dias));
          tramos.forEach((x, k) => { out[x.indice] = N().r2((out[x.indice] || 0) + valores[k]); });
        }
        for (let k = 0; k < nSemanas; k++) if (out[k] === undefined) out[k] = 0;
        return out;
      };
      N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s => N().lista(s.lineas).forEach(l => {
        const valores = horasLinea(l);
        l.horas = {};
        valores.forEach((v, k) => { l.horas["p" + k] = v; });
      })));
      /* Los entregables caen en la primera semana de su mes. */
      N().lista(o.tareas).forEach(t => N().lista(t.entregables).forEach(e => {
        const tramos = mapa.porMes[e.periodo];
        e.periodo = (tramos && tramos.length) ? tramos[0].indice : 0;
      }));
      N().lista(o.entregables).forEach(e => {
        const tramos = mapa.porMes[e.periodo];
        e.periodo = (tramos && tramos.length) ? tramos[0].indice : 0;
      });
      o.periodos = P.normalizar({ inicio: o.periodos.inicio, n: nSemanas, zoom: "mes", unidad: "semana", etiquetas: {} }, nSemanas);
      resumen.nSemanas = nSemanas;
      return resumen;
    }

    /* --- Semanas → meses --- */
    /* Cada semana se lleva sus horas al mes en el que cae (según su jueves). */
    const partesIni = o.periodos.inicio.split("-").map(Number);
    const mesCero = partesIni[0] * 12 + (partesIni[1] - 1);
    const mesDe = [];
    let mesMax = 0;
    for (let k = 0; k < nMeses; k++) {
      const l = P.fecha(o.periodos, k);
      const jueves = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 3);
      const m = (jueves.getFullYear() * 12 + jueves.getMonth()) - mesCero;
      mesDe.push(m);
      if (m > mesMax) mesMax = m;
    }
    const nDestino = mesMax + 1;

    N().lista(o.tareas).forEach(t => N().lista(t.subtareas).forEach(s2 => N().lista(s2.lineas).forEach(l => {
      const nuevo = {};
      for (let k = 0; k < nMeses; k++) {
        const v = N().num((l.horas || {})["p" + k]);
        if (v) nuevo["p" + mesDe[k]] = N().r2((nuevo["p" + mesDe[k]] || 0) + v);
      }
      l.horas = nuevo;
    })));
    const reubica = e => { const k = Math.round(N().acota(e.periodo, 0, nMeses - 1)); e.periodo = mesDe[k] || 0; };
    N().lista(o.tareas).forEach(t => N().lista(t.entregables).forEach(reubica));
    N().lista(o.entregables).forEach(reubica);

    o.periodos = P.normalizar({ inicio: o.periodos.inicio, n: nDestino, zoom: "mes", unidad: "mes", etiquetas: {} }, nDestino);
    resumen.nMesesDestino = nDestino;
    return resumen;
  }

  PL.unidades = {
    semanasDelMes: semanasDelMes, mapaSemanas: mapaSemanas, reparte: reparte,
    convertirOferta: convertirOferta, lunes: lunes
  };
})(typeof window !== "undefined" ? window : globalThis);
