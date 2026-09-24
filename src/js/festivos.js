"use strict";
/* =====================================================================
   Planifica v4 — FESTIVOS
   Los días que no se trabaja aunque caigan en día de diario. Se precargan los
   de España, la Comunidad de Madrid y los locales de Madrid capital, y todos se
   pueden editar: los locales cambian de año en año y cada empresa tiene los suyos.

   El Viernes Santo no se copia de ninguna lista: se CALCULA a partir del domingo
   de Pascua (algoritmo de Gauss/Meeus), así que vale para cualquier año sin
   depender de tener la lista a mano. Comprobado: Pascua 2026 = 5 de abril →
   Viernes Santo 3 de abril, que es lo que publica el calendario oficial.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;

  /** Domingo de Pascua de un año (algoritmo de Gauss/Meeus, calendario gregoriano). */
  function pascua(anio) {
    const a = anio % 19;
    const b = Math.floor(anio / 100);
    const c = anio % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(anio, mes - 1, dia);
  }

  function iso(f) {
    return N().diaISO ? N().diaISO(f) : f.toISOString().slice(0, 10);
  }

  /** Viernes Santo: dos días antes del domingo de Pascua. */
  function viernesSanto(anio) {
    const p = pascua(anio);
    return new Date(p.getFullYear(), p.getMonth(), p.getDate() - 2);
  }

  /* Fijos, iguales todos los años. */
  const FIJOS = [
    { mes: 1, dia: 1, nombre: "Año Nuevo", ambito: "España" },
    { mes: 1, dia: 6, nombre: "Epifanía del Señor", ambito: "España" },
    { mes: 5, dia: 1, nombre: "Fiesta del Trabajo", ambito: "España" },
    { mes: 8, dia: 15, nombre: "Asunción de la Virgen", ambito: "España" },
    { mes: 10, dia: 12, nombre: "Fiesta Nacional de España", ambito: "España" },
    { mes: 11, dia: 1, nombre: "Todos los Santos", ambito: "España" },
    { mes: 12, dia: 6, nombre: "Día de la Constitución", ambito: "España" },
    { mes: 12, dia: 8, nombre: "Inmaculada Concepción", ambito: "España" },
    { mes: 12, dia: 25, nombre: "Natividad del Señor", ambito: "España" },
    { mes: 5, dia: 2, nombre: "Fiesta de la Comunidad de Madrid", ambito: "Madrid" },
    { mes: 5, dia: 15, nombre: "San Isidro (Madrid capital)", ambito: "Local" },
    { mes: 11, dia: 9, nombre: "La Almudena (Madrid capital)", ambito: "Local" }
  ];

  /** Festivos de España + Comunidad de Madrid + Madrid capital para un año. */
  function deEspanaMadrid(anio) {
    const a = Math.round(N().acota(anio, 1900, 2200));
    const lista = FIJOS.map(f => ({
      fecha: a + "-" + (f.mes < 10 ? "0" : "") + f.mes + "-" + (f.dia < 10 ? "0" : "") + f.dia,
      nombre: f.nombre,
      ambito: f.ambito
    }));
    const vs = viernesSanto(a);
    lista.push({ fecha: iso(vs), nombre: "Viernes Santo", ambito: "España" });
    return lista.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
  }

  /** Todos los años que abarca un rango de periodos (año de inicio … año de fin). */
  function aniosDe(inicio, nPeriodos, unidad) {
    const partes = String(inicio || "").split("-").map(Number);
    if (!partes[0]) return [];
    const n = Math.max(0, Math.round(N().num(nPeriodos)));
    const fin = (unidad === "semana")
      ? new Date(partes[0], partes[1] - 1, 1 + 7 * n)
      : new Date(partes[0], partes[1] - 1 + n, 0);
    const a1 = partes[0], a2 = fin.getFullYear();
    const salida = [];
    for (let a = a1; a <= a2; a++) salida.push(a);
    return salida;
  }

  /** Festivos para todos los años de un rango, sin repetir fechas. */
  function paraRango(inicio, nPeriodos, unidad) {
    const vistos = {};
    const salida = [];
    aniosDe(inicio, nPeriodos, unidad).forEach(a => {
      deEspanaMadrid(a).forEach(f => {
        if (!vistos[f.fecha]) { vistos[f.fecha] = true; salida.push(f); }
      });
    });
    return salida.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
  }

  /** ¿Es festivo ese día? */
  function esFestivo(festivos, fecha) {
    if (!Array.isArray(festivos) || !festivos.length) return false;
    const f = iso(fecha);
    for (let i = 0; i < festivos.length; i++) if (festivos[i] && festivos[i].fecha === f) return true;
    return false;
  }

  PL.festivos = {
    pascua: pascua, viernesSanto: viernesSanto, deEspanaMadrid: deEspanaMadrid,
    aniosDe: aniosDe, paraRango: paraRango, esFestivo: esFestivo, FIJOS: FIJOS
  };
})(typeof window !== "undefined" ? window : globalThis);
