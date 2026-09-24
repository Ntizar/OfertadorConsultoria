"use strict";
/* =====================================================================
   Planifica v4 — VISTA: CARGA
   La planificación vista de un vistazo, sin tocar nada: quién está pillado,
   quién tiene hueco y cómo se reparte el trabajo por subtarea.

   Tres bloques:
     1. Ocupación por perfil y periodo (mapa de color: del hueco al 100 %)
     2. Disponibilidad de cada perfil (asignado, laborable, libre)
     3. Reparto por subtarea y perfil

   Es sólo lectura: aquí se mira, se edita en Trabajo.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const P = () => PL.periodos;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /** Tramo de ocupación: clase de color y texto para la leyenda. */
  function tramo(pct) {
    if (pct > 100.5) return "pa-carga--pasado";
    if (pct >= 99.5) return "pa-carga--lleno";
    if (pct >= 85) return "pa-carga--alto";
    if (pct >= 50) return "pa-carga--medio";
    if (pct > 0) return "pa-carga--bajo";
    return "pa-carga--vacio";
  }

  /** Horas laborables de todo el calendario. */
  function laborables(o) {
    let t = 0;
    for (let i = 0; i < P().meses(o.periodos); i++) t += C().horasLaborablesMes(o, i);
    return N().r2(t);
  }

  /* ---------- 1. Ocupación por perfil y periodo ---------- */

  function ocupacion(o, pf, mPerfil) {
    const V2 = V();
    const cols = P().columnas(o.periodos);
    const usados = Object.keys(C().horasPorPerfil(o));
    if (!usados.length) {
      return V2.articulo("Ocupación por perfil y periodo",
        '<p class="pa-mini">Todavía no hay horas repartidas. Cuando pongas dedicación en la pestaña Trabajo, ' +
        "aquí verás la carga de cada perfil periodo a periodo.</p>");
    }

    const cabecera = "<tr><th>Perfil</th>" +
      cols.map(c => {
        const lab = c.periodos.reduce((s2, k) => s2 + C().horasLaborablesMes(o, k), 0);
        return '<th class="nz-table__right" title="' + Math.round(lab) + ' h laborables">' + N().esc(c.etiqueta) +
          '<br><span class="pa-mini">' + Math.round(lab) + " h</span></th>";
      }).join("") +
      '<th class="nz-table__right">Medio</th><th class="nz-table__right">Libre</th></tr>';

    const filas = usados.map(perfilId => {
      const perfil = C().perfilPorId(pf, perfilId);
      let libreTotal = 0;
      let labTotal = 0;
      const celdas = cols.map(c => {
        const idx = c.periodos[0];
        const ult = c.periodos[c.periodos.length - 1];
        let horas = 0;
        let lab = 0;
        for (let k = c.periodos[0]; k <= ult; k++) {
          horas += N().num((mPerfil[perfilId] || [])[k]);
          lab += C().horasLaborablesMes(o, k);
        }
        const pct = lab > 0 ? N().r2(horas / lab * 100) : 0;
        libreTotal = N().r2(libreTotal + Math.max(0, lab - horas));
        labTotal = N().r2(labTotal + lab);
        const texto = (perfil ? perfil.nombre : "Perfil") + " en " + c.etiqueta + ": " + N().fmtNum(pct, 0) +
          " % · " + V2.hor(horas) + " de " + Math.round(lab) + " h laborables";
        return '<td class="pa-carga ' + tramo(pct) + '" title="' + N().esc(texto) + '">' +
          (horas > 0 ? N().fmtNum(pct, 0) + "%" : "") + "</td>";
      }).join("");
      const medio = labTotal > 0 ? N().r2((labTotal - libreTotal) / labTotal * 100) : 0;
      return "<tr>" +
        "<th scope=\"row\"><span class=\"pa-tono-punto\"></span> " + N().esc(perfil ? perfil.nombre : "Perfil") + "</th>" +
        celdas +
        '<td class="nz-table__num nz-table__right"><strong>' + N().fmtNum(medio, 0) + "%</strong></td>" +
        '<td class="nz-table__num nz-table__right">' + N().fmtNum(libreTotal, 0) + " h</td></tr>";
    }).join("");

    const leyenda = '<p class="pa-mini">' +
      '<span class="pa-carga pa-carga--vacio"></span> libre · ' +
      '<span class="pa-carga pa-carga--bajo"></span> hasta 50 % · ' +
      '<span class="pa-carga pa-carga--medio"></span> 50-85 % · ' +
      '<span class="pa-carga pa-carga--alto"></span> 85-100 % · ' +
      '<span class="pa-carga pa-carga--lleno"></span> 100 %, sin hueco · ' +
      '<span class="pa-carga pa-carga--pasado"></span> por encima del 100 % · ' +
      "el número es la dedicación de ese perfil en ese periodo.</p>";

    return V2.articulo("Ocupación por perfil y periodo",
      '<p class="pa-mini">Cada celda dice la dedicación de ese perfil en ese periodo, sumando todo lo que tiene asignado: ' +
      "en verde hay hueco, en ámbar está al límite y en rojo no cabe más.</p>" + leyenda +
      '<div class="pa-tabla-horas"><table class="nz-table nz-table--compact">' +
      "<thead>" + cabecera + "</thead><tbody>" + filas + "</tbody></table></div>");
  }

  /* ---------- 2. Disponibilidad por perfil ---------- */

  function disponibilidad(o, pf, mPerfil) {
    const usados = Object.keys(C().horasPorPerfil(o));
    const lab = laborables(o);
    const excesos = C().excesosPerfil(o);

    const filas = usados.map(perfilId => {
      const perfil = C().perfilPorId(pf, perfilId);
      const asignadas = N().r2(N().suma(mPerfil[perfilId] || [], v => N().num(v)));
      const pct = lab > 0 ? N().r2(asignadas / lab * 100) : 0;
      const malos = excesos.filter(x => x.perfilId === perfilId).length;
      const clase = pct > 100.5 ? "nz-badge--danger" : (pct >= 85 ? "nz-badge--warning" : "nz-badge--neutral");
      return "<tr>" +
        '<td><span class="pa-tono-punto"></span> ' + N().esc(perfil ? perfil.nombre : "Perfil") + "</td>" +
        '<td class="nz-table__num nz-table__right">' + N().fmtNum(asignadas, 0) + " h</td>" +
        '<td class="nz-table__num nz-table__right">' + N().fmtNum(lab, 0) + " h</td>" +
        '<td class="nz-table__num nz-table__right"><span class="nz-badge ' + clase + '">' + N().fmtNum(pct, 0) + " %</span></td>" +
        '<td class="nz-table__num nz-table__right">' + N().fmtNum(Math.max(0, N().r2(lab - asignadas)), 0) + " h</td>" +
        "<td>" + (malos ? '<span class="nz-badge nz-badge--danger">' + malos + " periodo(s) pasado(s)</span>" : "") + "</td></tr>";
    }).join("");

    const totalAsignado = usados.reduce((a, id) => N().r2(a + N().suma(mPerfil[id] || [], v => N().num(v))), 0);

    return V().articulo("Qué le queda a cada perfil",
      '<p class="pa-mini">El calendario tiene <strong>' + N().fmtNum(lab, 0) +
      " h laborables por perfil</strong> y hay <strong>" + N().fmtNum(totalAsignado, 0) +
      " h</strong> repartidas. Lo que sobra de cada uno es lo que aún puedes planificar (o personal que no necesitas).</p>" +
      '<table class="nz-table nz-table--compact"><thead><tr><th>Perfil</th>' +
      '<th class="nz-table__right">Asignadas</th><th class="nz-table__right">Laborables</th>' +
      '<th class="nz-table__right">Dedicación media</th><th class="nz-table__right">Libres</th><th></th></tr></thead>' +
      "<tbody>" + (filas || '<tr><td colspan="6"><span class="pa-mini">Sin perfiles asignados todavía.</span></td></tr>') +
      "</tbody></table>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Coste del esfuerzo con las tarifas actuales: <strong>' +
      N().fmtNum(C().importeOferta(o, pf)) + " €</strong>.</p>");
  }

  /* ---------- 3. Reparto por subtarea y perfil ---------- */

  function abrevia(nombre) {
    const t = String(nombre || "").replace(/\(.*?\)/g, "").trim();
    const partes = t.split(/\s+/);
    return partes.length > 3 ? partes.slice(0, 3).join(" ") + "…" : t;
  }

  function reparto(o, pf) {
    const V2 = V();
    const porPerfil = {};
    const filas = [];
    N().lista(o.tareas).forEach(t => {
      N().lista(t.subtareas).forEach(s => {
        const lineas = N().lista(s.lineas);
        if (!lineas.length) return;
        const horas = lineas.reduce((a, l) => {
          const h = C().lineaHoras(l);
          if (h && l.perfilId) porPerfil[l.perfilId] = N().r2((porPerfil[l.perfilId] || 0) + h);
          return N().r2(a + h);
        }, 0);
        filas.push({ tarea: t.nombre, sub: s.nombre, lineas: lineas, horas: horas });
      });
    });

    /* Sólo las columnas de perfiles que se usan: si no, la tabla es un muro. */
    const cols = pf.filter(p => porPerfil[p.id]);
    if (!filas.length) {
      return V2.articulo("Reparto por subtarea y perfil",
        '<p class="pa-mini">Todavía no hay subtareas con trabajo asignado.</p>');
    }

    const cabecera = "<tr><th>Subtarea</th>" +
      cols.map(p => '<th class="nz-table__right" title="' + N().esc(p.nombre) + " · " + N().fmtNum(p.tarifa) + ' €/h">' +
        N().esc(abrevia(p.nombre)) + '<br><span class="pa-mini">' + N().fmtNum(p.tarifa) + " €/h</span></th>").join("") +
      '<th class="nz-table__right">Horas</th><th class="nz-table__right">Importe</th></tr>';

    const cuerpo = filas.map(f => {
      const suyos = {};
      let importe = 0;
      f.lineas.forEach(l => {
        if (l.perfilId) suyos[l.perfilId] = N().r2((suyos[l.perfilId] || 0) + C().lineaHoras(l));
        importe = N().r2(importe + C().lineaImporte(l, pf));
      });
      return '<tr><th scope="row"><span class="pa-mini">' + N().esc(f.tarea) + "</span><br>" + N().esc(f.sub) + "</th>" +
        cols.map(p => '<td class="nz-table__num nz-table__right">' +
          (suyos[p.id] ? N().fmtNum(suyos[p.id], 0) : "") + "</td>").join("") +
        '<td class="nz-table__num nz-table__right"><strong>' + N().fmtNum(f.horas, 0) + "</strong></td>" +
        '<td class="nz-table__num nz-table__right">' + N().fmtNum(importe) + " €</td></tr>";
    }).join("");

    const pie = '<tr><th scope="row">Total</th>' +
      cols.map(p => '<td class="nz-table__num nz-table__right"><strong>' + N().fmtNum(porPerfil[p.id] || 0, 0) + "</strong></td>").join("") +
      '<td class="nz-table__num nz-table__right"><strong>' + N().fmtNum(C().ofertaHoras(o), 0) + "</strong></td>" +
      '<td class="nz-table__num nz-table__right"><strong>' + N().fmtNum(C().importeOferta(o, pf)) + " €</strong></td></tr>";

    return V2.articulo("Reparto por subtarea y perfil",
      '<p class="pa-mini">Quién hace qué: las horas de cada perfil en cada subtarea.</p>' +
      '<div class="pa-tabla-horas"><table class="nz-table nz-table--compact">' +
      "<thead>" + cabecera + "</thead><tbody>" + cuerpo + pie + "</tbody></table></div>");
  }

  function render() {
    const V2 = V(), a = APP();
    const cont = "carga-cuerpo";
    const o = a.pr();
    if (!o) { V2.vaciar(cont); return; }
    const pf = a.pf();
    const mPerfil = C().horasPerfilPeriodo(o);
    const excesos = C().excesosPerfil(o);

    V2.escribir(cont,
      (excesos.length
        ? V2.aviso("warning", "<strong>Hay " + excesos.length + " caso(s) por encima del 100 %.</strong> " +
            "Suele venir de datos anteriores a la regla del tope: repártelos con otro perfil o muévelos de periodo.")
        : "") +
      ocupacion(o, pf, mPerfil) +
      disponibilidad(o, pf, mPerfil) +
      reparto(o, pf));
  }

  PL.vistas.carga = { render: render, tramo: tramo, laborables: laborables };
})(typeof window !== "undefined" ? window : globalThis);
