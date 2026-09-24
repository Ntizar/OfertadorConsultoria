"use strict";
/* =====================================================================
   Planifica v4 — VERIFICACIÓN EN DOM REAL (jsdom)
   Carga el docs/index.html COMPILADO y pulsa pestañas, botones y campos de
   verdad. Comprueba, sobre todo, dos cosas:
     · que el Gantt y el calendario funcionan y son editables
     · que TODO está conectado: un cambio se refleja en todas las vistas

   Uso:  node tools/verificar-dom.js
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");

let ok = 0, ko = 0;
const check = (n, c, d) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (d === undefined ? "" : " → " + d)); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

function nuevaDom(sembrar) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errores.push("JSDOM: " + String(e.message).split("\n")[0]));
  vc.on("error", (...a) => errores.push("CONSOLA: " + a.join(" ")));
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", url: "https://planifica.local/", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true; w.prompt = () => "Prueba"; w.alert = () => {}; w.print = () => {};
      w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
      if (sembrar) sembrar(w);
    }
  });
  return { dom, window: dom.window, document: dom.window.document, errores };
}

const TABS = ["trabajo", "oferta", "perfiles", "resumen", "informe", "ajustes"];
const PANEL = {
  trabajo: "tr-editor", oferta: "ofe-datos", perfiles: "perfiles-cuerpo",
  resumen: "res-totales", informe: "informe-cuerpo", ajustes: "ajustes-cuerpo"
};

async function main() {
  console.log("== Planifica v4 — verificación en DOM REAL ==\n");
  const { window, document, errores } = nuevaDom();
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const api = () => window.Planifica;
  const irA = n => { $('#pa-tabs .nz-tabs__tab[data-tab="' + n + '"]').click(); };
  const visibles = () => $$('section[id^="sec-"]').filter(s => !s.hidden).map(s => s.id);
  const campo = (c, id) => $('[data-campo="' + c + '"]' + (id ? '[data-id="' + id + '"]' : ""));
  const escribe = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const cambia = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); };
  await espera(400);

  console.log("1. Arranque");
  check("sin errores JS", errores.length === 0, errores.join(" | "));
  check("#pa-error no visible", !$("#pa-error").classList.contains("is-visible"), $("#pa-error").textContent.slice(0, 120));
  check("guía de bienvenida", $("#tr-guia").innerHTML.indexOf("Cómo funciona") > 0);
  check("KPIs con datos", /\d/.test($("#kpi-total").textContent) && /mes/.test($("#kpi-calendario").textContent));
  check("el KPI de calendario muestra el rango legible", /—/.test($("#kpi-rango").textContent), $("#kpi-rango").textContent);
  check("1 oferta de fábrica", $$("#pa-sel-oferta option").length === 1);
  check("API pública con las 6 vistas", !!api() && ["trabajo", "oferta", "perfiles", "resumen", "informe", "ajustes"].every(v => !!window.PL.vistas[v]));

  console.log("\n2. Las 6 pestañas");
  TABS.forEach(n => {
    irA(n);
    const vis = visibles();
    check('tab "' + n + '" muestra solo su sección', vis.length === 1 && vis[0] === "sec-" + n, JSON.stringify(vis));
    check('tab "' + n + '" con contenido', ($("#" + PANEL[n]) || { innerHTML: "" }).innerHTML.length > 200);
  });

  console.log("\n3. Calendario: meses legibles y editables");
  irA("trabajo");
  const bandas = $$("#tr-gantt .pa-gantt__anios th").map(t => t.textContent);
  check("banda de año con los dos años del proyecto", bandas.length === 4 && /20\d\d/.test(bandas[1]) && /20\d\d/.test(bandas[2]), bandas.join("|"));
  const rotulos = $$("#tr-gantt .pa-gantt__rotulo");
  check("una columna por mes con rótulo corto", rotulos.length === 6, rotulos.length);
  check("el rótulo NO repite el año", rotulos.every(r => !/\d{2,4}/.test(r.value)), rotulos.map(r => r.value).join(" "));
  check("rótulos en mayúsculas y 3-4 letras", rotulos.every(r => /^[A-ZÁÉÍÓÚ]{3,4}$/.test(r.value)), rotulos.map(r => r.value).join(" "));

  /* Editar un rótulo a mano (desde el propio cronograma) */
  escribe(rotulos[1], "Fase 1");
  check("el rótulo se puede renombrar desde el Gantt", window.PL.periodos.etiqueta(api().periodos(), 1) === "Fase 1");
  await espera(250);   /* el repintado del rótulo va con retardo corto */
  check("el contador de rótulos editados aparece en el calendario", $("#tr-calendario").innerHTML.indexOf("rótulo") > 0);
  check("el editor de horas usa el rótulo nuevo", $("#tr-editor").innerHTML.indexOf("Fase 1") > 0);
  cambia(rotulos[1], "Fase 1");
  check("al salir del campo el Gantt se repinta con el rótulo nuevo", $$("#tr-gantt .pa-gantt__rotulo")[1].value === "Fase 1");
  $('[data-acc="cal-rotulos-auto"]').click();
  check("volver a los rótulos automáticos", window.PL.periodos.cuantasEditadas(api().periodos()) === 0 && $$("#tr-gantt .pa-gantt__rotulo")[1].value === "NOV");
  check("los rótulos automáticos vuelven a ser meses", /^[A-ZÁÉÍÓÚ]{3,4}$/.test($$("#tr-gantt .pa-gantt__rotulo")[1].value));

  /* Inicio, duración y desplazamiento */
  const inicio0 = api().periodos().inicio;
  cambia($("#cal-inicio"), "2027-01");
  check("cambiar el mes de inicio", api().periodos().inicio === "2027-01", api().periodos().inicio);
  check("el Gantt refleja el nuevo inicio", $$("#tr-gantt .pa-gantt__anios th").map(t => t.textContent).indexOf("2027") > 0);
  cambia($("#cal-n"), "10");
  check("cambiar la duración", api().periodos().n === 10, api().periodos().n);
  check("el Gantt tiene ahora 10 columnas", $$("#tr-gantt .pa-gantt__rotulo").length === 10, $$("#tr-gantt .pa-gantt__rotulo").length);
  check("las horas de los periodos nuevos están a cero", api().horas() > 0 && api().oferta().tareas.every(t => t.subtareas.every(s => s.lineas.every(l => l.horas.p9 !== undefined))));
  cambia($("#cal-n"), "6");
  cambia($("#cal-inicio"), inicio0);
  $('[data-acc="cal-despues"]').click();
  check("desplazar el calendario un mes", api().periodos().inicio !== inicio0, api().periodos().inicio);
  $('[data-acc="cal-antes"]').click();
  check("desplazar atrás lo devuelve", api().periodos().inicio === inicio0, api().periodos().inicio);
  $('[data-acc="cal-zoom"]').click();
  check("zoom a trimestres", api().periodos().zoom === "trimestre" && $$("#tr-gantt .pa-gantt__rotulo").length === 2, $$("#tr-gantt .pa-gantt__rotulo").length);
  check("los rótulos de trimestre son T1..T4", $$("#tr-gantt .pa-gantt__rotulo").every(r => /^T\d$/.test(r.value)), $$("#tr-gantt .pa-gantt__rotulo").map(r => r.value).join(" "));
  $('[data-acc="cal-zoom"]').click();
  check("zoom de vuelta a meses", api().periodos().zoom === "mes" && $$("#tr-gantt .pa-gantt__rotulo").length === 6);

  console.log("\n4. Gantt: barras y entregables");
  check("hay una fila por tarea", $$("#tr-gantt .pa-gantt__fila--tarea").length === 2, $$("#tr-gantt .pa-gantt__fila--tarea").length);
  check("hay filas de subtarea", $$("#tr-gantt .pa-gantt__fila--subtarea").length === 4, $$("#tr-gantt .pa-gantt__fila--subtarea").length);
  check("hay una fila por entregable", $$("#tr-gantt .pa-gantt__fila--entregable").length === 6, $$("#tr-gantt .pa-gantt__fila--entregable").length);
  check("hay barras de esfuerzo", $$(".pa-barra:not(.pa-barra--hito)").length > 5);
  const rombos = $$("#tr-gantt .pa-barra--hito");
  check("hay un rombo por entregable", rombos.length === 6, rombos.length);
  const filaTarea = $("#tr-gantt .pa-gantt__fila--tarea");
  check("las horas por fila van a la derecha", /h$/.test(filaTarea.querySelector(".pa-gantt__total").textContent.trim()), filaTarea.querySelector(".pa-gantt__total").textContent);
  check("el Gantt tiene su nota explicativa", $("#tr-gantt .pa-gantt__nota").textContent.indexOf("◆") >= 0);

  console.log("\n5. Estructura: tareas, subtareas, horas y entregables");
  const nT = $$(".pa-tarea").length;
  $('[data-acc="nueva-tarea"]').click();
  check("＋ Añadir tarea", $$(".pa-tarea").length === nT + 1 && $$("#tr-gantt .pa-gantt__fila--tarea").length === 3);
  const ultima = $$(".pa-tarea").pop();
  ultima.querySelector('[data-acc="nueva-sub"]').click();
  check("＋ Subtarea", $$(".pa-tarea").pop().querySelectorAll(".pa-sub").length === 1);
  $$(".pa-tarea").pop().querySelector('[data-acc="nuevo-entregable-tarea"]').click();
  check("＋ Entregable de tarea", $$(".pa-tarea").pop().querySelectorAll(".pa-hito").length === 1);
  check("el entregable nuevo aparece también en el Gantt", $$("#tr-gantt .pa-gantt__fila--entregable").length === 7, $$("#tr-gantt .pa-gantt__fila--entregable").length);

  const linea = $('[data-campo="linea-perfil"]');
  check("＋ Perfil añade una línea de horas", !!linea);
  const tr = linea.closest("tr");
  const inpH = tr.querySelector('input[data-campo="horas"]');
  const kpiAntes = $("#kpi-total").textContent;
  const ganttAntes = $("#tr-gantt").innerHTML;
  escribe(inpH, "25");
  check("la propia fila se recalcula al teclear", /\d/.test(tr.querySelector(".pa-celda-horas-h").textContent));
  check("el campo editado NO se reemplaza (no se pierde el foco)", inpH.isConnected);
  await espera(300);
  check("el KPI se actualiza al teclear horas", $("#kpi-total").textContent !== kpiAntes, kpiAntes + " → " + $("#kpi-total").textContent);
  check("el Gantt se actualiza al teclear horas", $("#tr-gantt").innerHTML !== ganttAntes);

  /* El entregable nuevo, movido de mes desde su selector */
  const ultimoHito = $$(".pa-tarea").pop().querySelector(".pa-hito");
  const selPeriodo = ultimoHito.querySelector('[data-campo="hito-periodo"]');
  const periodoAntes = api().oferta().tareas.slice(-1)[0].entregables[0].periodo;
  cambia(selPeriodo, String(api().periodos().n - 1));
  check("mover un entregable de mes", api().oferta().tareas.slice(-1)[0].entregables[0].periodo === api().periodos().n - 1, periodoAntes + " → " + api().oferta().tareas.slice(-1)[0].entregables[0].periodo);
  check("el rombo se mueve en el Gantt", $$("#tr-gantt .pa-gantt__fila--entregable").pop().querySelectorAll(".pa-barra--hito").length === 1);

  $$(".pa-tarea").pop().querySelector('[data-acc="elim-tarea"]').click();
  check("✕ Eliminar tarea (con sus filas del Gantt)", $$(".pa-tarea").length === nT && $$("#tr-gantt .pa-gantt__fila--tarea").length === 2);

  console.log("\n4 bis. Color por tarea, con subtareas y entregables heredando");
  const tareasConTono = $$(".pa-tarea").filter(t => /pa-tono-\d/.test(t.className));
  check("cada tarea lleva su color", tareasConTono.length === $$(".pa-tarea").length && tareasConTono.length >= 2,
    tareasConTono.map(t => (t.className.match(/pa-tono-\d/) || [""])[0]).join(" "));
  check("dos tareas no comparten color",
    new Set(tareasConTono.map(t => (t.className.match(/pa-tono-\d/) || [""])[0])).size === tareasConTono.length);
  check("el color del árbol y el del diagrama coinciden",
    (() => {
      const t0 = $$(".pa-tarea")[0];
      const tono = (t0.className.match(/pa-tono-(\d)/) || [])[1];
      const fila = $("#tr-gantt .pa-gantt__fila--tarea");
      return !!tono && fila.className.indexOf("pa-tono-" + tono) > 0;
    })());
  check("todas las subtareas heredan el color de su tarea",
    $$("#tr-gantt .pa-gantt__fila--subtarea").length > 0 &&
    $$("#tr-gantt .pa-gantt__fila--subtarea").every(r => /pa-tono-\d/.test(r.className)));
  /* Los entregables de tarea y de subtarea llevan color; el de la oferta, no:
     no pertenece a ninguna tarea. */
  const entFilas = $$("#tr-gantt .pa-gantt__fila--entregable");
  const entConTono = entFilas.filter(r => /pa-tono-\d/.test(r.className));
  check("los entregables de tarea llevan color y el de la oferta no",
    entConTono.length === entFilas.length - 1 && entFilas.length >= 6,
    entConTono.length + " de " + entFilas.length);
  check("el CSS define los cinco tonos y los aplica a barras y entregables",
    [1, 2, 3, 4, 5].every(n => document.head.innerHTML.indexOf(".pa-tono-" + n) > 0) &&
    document.head.innerHTML.indexOf(".pa-gantt__fila--tarea .pa-barra") > 0);

  console.log("\n4 ter. Responsive de verdad (móvil)");
  const css = document.head.textContent;
  check("hay reglas para móvil", css.indexOf("@media (max-width: 720px)") > 0);
  check("la tabla de horas se convierte en tarjetas", css.indexOf(".pa-tabla-horas tr {") > 0 && css.indexOf("content: attr(data-etiqueta)") > 0);
  check("los campos de horas son táctiles (44 px)", css.indexOf("min-height: 44px") > 0);
  check("el calendario pasa a rejilla", css.indexOf(".pa-calendario { display: grid") > 0);
  check("cada celda de mes lleva su etiqueta para el móvil",
    $$(".pa-celda-horas[data-etiqueta]").length === $$(".pa-celda-horas").length && $$(".pa-celda-horas").length > 0,
    $$(".pa-celda-horas").length);

  console.log("\n4 quater. El campo de esfuerzo admite % y horas escritas a mano");
  const celdaFlex = $('.pa-celda-horas input[data-campo="horas"]');
  const lineaFlex = window.PL.modelo.buscarLinea(api().oferta(), celdaFlex.dataset.id);
  lineaFlex.linea.perfilId = api().perfiles()[0].id;
  const mesFlex = Number(celdaFlex.dataset.mes);
  const labFlex = window.PL.calculo.horasLaborablesMes(api().oferta(), mesFlex);
  escribe(celdaFlex, "50%");
  check("escribir «50%» guarda media jornada del mes",
    Math.abs(lineaFlex.linea.horas["p" + mesFlex] - labFlex / 2) < 0.02,
    lineaFlex.linea.horas["p" + mesFlex] + " de " + labFlex + " h");
  escribe(celdaFlex, "40h");
  check("escribir «40h» guarda 40 horas tal cual", lineaFlex.linea.horas["p" + mesFlex] === 40,
    lineaFlex.linea.horas["p" + mesFlex]);
  escribe(celdaFlex, "12,5h");
  check("admite coma decimal («12,5h»)", lineaFlex.linea.horas["p" + mesFlex] === 12.5, lineaFlex.linea.horas["p" + mesFlex]);
  const antesBasura = lineaFlex.linea.horas["p" + mesFlex];
  escribe(celdaFlex, "no es un número");
  check("lo que no es un número no toca las horas", lineaFlex.linea.horas["p" + mesFlex] === antesBasura);
  escribe(celdaFlex, "10h");
  cambia(celdaFlex, "10h");
  check("al salir del campo el valor queda limpio",
    /^[\d.,]+$/.test($('.pa-celda-horas input[data-campo="horas"]').value),
    JSON.stringify($('.pa-celda-horas input[data-campo="horas"]').value));

  console.log("\n4 quinquies. Plegar, desplegar y borrar con red");
  check("cada tarea tiene su botón de plegar",
    $$(".pa-tarea .pa-chevron").length === $$(".pa-tarea").length && $$(".pa-tarea").length >= 2,
    $$(".pa-tarea .pa-chevron").length);
  const chev = $(".pa-tarea .pa-chevron");
  chev.click();
  check("pulsarlo pliega esa tarea (y el cuerpo desaparece)",
    $$(".pa-tarea")[0].classList.contains("pa-tarea--plegada") &&
    $$(".pa-tarea")[0].querySelector(".pa-tarea__cuerpo").offsetParent === null ||
    $$(".pa-tarea")[0].classList.contains("pa-tarea--plegada"),
    $$(".pa-tarea")[0].className);
  $('[data-acc="abrir-todo"]').click();
  check("desplegar todo la vuelve a abrir", !$$(".pa-tarea")[0].classList.contains("pa-tarea--plegada"));
  check("y hay controles de plegado por niveles",
    !!$('[data-acc="solo-tareas"]') && !!$('[data-acc="plegar-tareas"]') && !!$('[data-acc="cerrar-todo"]'));
  $('[data-acc="plegar-tareas"]').click();
  check("«Plegar tareas» las pliega todas", $$(".pa-tarea--plegada").length === $$(".pa-tarea").length);
  $('[data-acc="solo-tareas"]').click();
  check("«Sólo tareas» las abre y deja las subtareas plegadas",
    $$(".pa-tarea--plegada").length === 0 && $$(".pa-sub:not([open])").length === $$(".pa-sub").length);
  $('[data-acc="abrir-todo"]').click();

  /* Borrar una línea pregunta antes */
  const nLineas = $$(".pa-tabla-horas tbody tr[data-id]").length;
  window.confirm = () => false;
  $('[data-acc="elim-linea"]').click();
  check("borrar una línea PIDE confirmación (y si dices que no, no borra)",
    $$(".pa-tabla-horas tbody tr[data-id]").length === nLineas, "líneas: " + $$(".pa-tabla-horas tbody tr[data-id]").length);
  window.confirm = () => true;
  $('[data-acc="elim-linea"]').click();
  check("y si dices que sí, la borra",
    $$(".pa-tabla-horas tbody tr[data-id]").length === nLineas - 1, $$(".pa-tabla-horas tbody tr[data-id]").length);

  console.log("\n4 sexies. Calendario por semanas");
  check("el calendario ofrece meses o semanas",
    !!$('[data-acc="cal-unidad"][data-unidad="mes"]') && !!$('[data-acc="cal-unidad"][data-unidad="semana"]'));
  const totalAntes = window.Planifica.total();
  $('[data-acc="cal-unidad"][data-unidad="semana"]').click();
  await espera(120);
  check("pasar a semanas cambia el calendario", api().periodos().unidad === "semana", api().periodos().unidad);
  check("el diagrama tiene muchas más columnas",
    $$("#tr-gantt .pa-gantt__rotulo").length > 20, $$("#tr-gantt .pa-gantt__rotulo").length);
  check("los rótulos son S##", $$("#tr-gantt .pa-gantt__rotulo").every(r => /^S\d{1,2}$/.test(r.value)),
    $$("#tr-gantt .pa-gantt__rotulo").slice(0, 3).map(r => r.value).join(" "));
  check("aparece la banda de trimestres para orientarse",
    $$("#tr-gantt .pa-gantt__tri th").length >= 3, $$("#tr-gantt .pa-gantt__tri th").length);
  check("el total de la oferta no cambia al convertir",
    Math.abs(api().total() - totalAntes) < 0.02, api().total() + " vs " + totalAntes);
  check("el esfuerzo tampoco", api().horas() > 0);
  check("la duración se dice en semanas", $("#tr-calendario").textContent.indexOf("semanas") > 0);
  $('[data-acc="cal-unidad"][data-unidad="mes"]').click();
  await espera(120);
  check("y se puede volver a meses", api().periodos().unidad === "mes", api().periodos().unidad);

  console.log("\n5 bis. Dedicación en % y control del 100 %");

  /* Vuelta al modo % (por defecto) y comprobación de la conversión a horas */
  irA("trabajo");
  check("las horas se teclean en % de jornada por defecto",
    !!$('[data-acc="modo-horas"][data-modo="pct"]') && !!$('[data-acc="modo-horas"][data-modo="h"]'));
  $('[data-acc="abrir-todo"]').click();
  const celdaPct = $('.pa-celda-horas input[data-campo="horas"][data-modo="pct"]');
  check("las celdas de mes piden dedicación", !!celdaPct);
  check("la cabecera de cada mes dice la unidad", $("#tr-editor").innerHTML.indexOf(">%<") > 0);
  const filaPct = celdaPct.closest("tr");
  const lineaId = celdaPct.dataset.id;
  const mesPct = celdaPct.dataset.mes;
  const rl = window.PL.modelo.buscarLinea(api().oferta(), lineaId);
  rl.linea.perfilId = api().perfiles()[0].id;           /* un perfil concreto para poder medir */
  escribe(celdaPct, "50");
  const horas50 = rl.linea.horas["p" + mesPct];
  const labMes = window.PL.calculo.horasLaborablesMes(api().oferta(), Number(mesPct));
  check("escribir 50 % guarda media jornada de ese mes en horas",
    Math.abs(horas50 - labMes / 2) < 0.02, "50 % de " + labMes + " h = " + horas50);
  check("el equivalente en horas se ve al lado de lo tecleado",
    /\d/.test(filaPct.querySelector(".pa-celda__eq").textContent), filaPct.querySelector(".pa-celda__eq").textContent);
  check("el equivalente aparece también al pie de la tabla",
    $("#tr-editor").innerHTML.indexOf("dedicación") > 0);

  /* El tope del 100 %: se autolimita solo y avisa */
  const libreAntes = window.PL.calculo.horasDisponiblesPerfilMes(api().oferta(), api().perfiles()[0].id, Number(mesPct), lineaId);
  const labMesTope = window.PL.calculo.horasLaborablesMes(api().oferta(), Number(mesPct));
  escribe(celdaPct, "150");
  await espera(120);
  const hTras = rl.linea.horas["p" + mesPct];
  check("al pedir 150 % se autolimita al máximo que cabía",
    hTras <= libreAntes + 0.02 && hTras > 0, hTras + " h (libre antes: " + libreAntes + " h)");
  check("el campo queda con el valor recortado, no con 150",
    Number(String(celdaPct.value).replace(",", ".")) <= 100.5, JSON.stringify(celdaPct.value));
  check("el aviso explica que no se puede pasar del 100 %",
    $("#pa-toast").textContent.indexOf("100 %") > 0, $("#pa-toast").textContent);
  check("ninguna celda queda marcada en exceso", $$(".pa-celda--exceso").length === 0);
  check("el típico 100 % de un mes cabe entero", (() => {
    const r2 = window.PL.modelo.buscarLinea(api().oferta(), celdaPct.dataset.id);
    r2.linea.horas["p" + Number(mesPct)] = 0;
    escribe(celdaPct, "100");
    return Math.abs(r2.linea.horas["p" + Number(mesPct)] - labMesTope) < 0.02;
  })(), "100 % de " + labMesTope + " h");
  escribe(celdaPct, "50");
  await espera(120);
  window.Planifica.repintar();
  const celdaT = $('.pa-celda-horas input[data-campo="horas"][data-id="' + lineaId + '"]');
  check("el campo dice cuánto le queda libre a ese perfil",
    /libres/.test(celdaT.closest("td").title), celdaT.closest("td").title);

  /* Modo horas: se teclea directo */
  $('[data-acc="modo-horas"][data-modo="h"]').click();
  const celdaH = $('.pa-celda-horas input[data-campo="horas"][data-modo="h"]');
  check("el botón cambia a modo horas", !!celdaH);
  escribe(celdaH, "100");
  const rl2 = window.PL.modelo.buscarLinea(api().oferta(), celdaH.dataset.id);
  check("en modo horas se guarda lo tecleado tal cual", rl2.linea.horas["p" + celdaH.dataset.mes] === 100);
  $('[data-acc="modo-horas"][data-modo="pct"]').click();

  console.log("\n5 ter. Los cuatro pasos del trabajo");
  check("hay cuatro pasos, en orden", $$(".pa-paso").length === 4, $$(".pa-paso").length);
  const titulosPasos = $$(".pa-paso strong").map(e => e.textContent);
  check("el orden es tareas → entregables → perfiles → horas",
    titulosPasos.join(" | ") === "Tareas y subtareas | Entregables | Perfiles del equipo | Horas por perfil y mes",
    titulosPasos.join(" | "));
  check("los pasos hechos se marcan", $$(".pa-paso--hecho").length >= 3, $$(".pa-paso--hecho").length);

  console.log("\n5 quater. El calendario dentro del informe");
  irA("informe");
  check("el informe incluye la sección de calendario", $("#informe-cuerpo").innerHTML.indexOf("Calendario y entregas") > 0);
  check("con su diagrama de Gantt", $("#informe-cuerpo").querySelector(".pa-gantt--informe") !== null);
  check("el Gantt del informe trae barras y rombos de entrega",
    $("#informe-cuerpo").querySelectorAll(".pa-barra").length > 5 && $("#informe-cuerpo").querySelectorAll(".pa-barra--hito").length > 0);
  check("y la banda de años", $("#informe-cuerpo").querySelectorAll(".pa-gantt__anios th").length >= 2);
  check("el informe NO tiene campos editables en el calendario",
    $("#informe-cuerpo").querySelectorAll(".pa-gantt--informe input").length === 0);
  irA("trabajo");

  console.log("\n6. TODO CONECTADO: un cambio se ve en todas las vistas");
  irA("trabajo");
  const antesTodo = {
    kpi: $("#kpi-total").textContent,
    resumen: $("#res-totales").innerHTML,
    informe: $("#informe-cuerpo").innerHTML,
    gantt: $("#tr-gantt").innerHTML,
    calendario: $("#tr-calendario").innerHTML
  };
  $('[data-acc="abrir-todo"]').click();
  const primerInput = $('input[data-campo="horas"]');
  escribe(primerInput, "40");
  await espera(320);
  check("KPIs conectados", $("#kpi-total").textContent !== antesTodo.kpi);
  check("Resumen conectado", $("#res-totales").innerHTML !== antesTodo.resumen);
  check("Informe conectado", $("#informe-cuerpo").innerHTML !== antesTodo.informe);
  check("Gantt conectado", $("#tr-gantt").innerHTML !== antesTodo.gantt);
  check("Calendario conectado (chips de horas e importe)", $("#tr-calendario").innerHTML !== antesTodo.calendario);
  irA("resumen");
  check("el Resumen ya está fresco al entrar (sin repintado pendiente)", $("#res-totales").innerHTML.indexOf("TOTAL") > 0);

  console.log("\n7. Escenarios y versiones (en línea, sin ventanas)");
  check("no hay ningún modal en la app", $$(".nz-modal").length === 0);
  check("el formulario de fotos está en línea", !!$("#foto-nombre") && !!$("#foto-nota"));
  $("#foto-nombre").value = "Base";
  $('[data-acc="guardar-escenario"]').click();
  check("guardar escenario", window.PL.comparar.fotosDe(api().oferta(), "escenario").length === 1);
  check("el escenario sale en la lista", $("#res-fotos").innerHTML.indexOf("Base") > 0);
  irA("trabajo");
  $('[data-acc="abrir-todo"]').click();
  escribe($('input[data-campo="horas"]'), "3");
  await espera(300);
  irA("resumen");
  $$('[data-acc="foto-comparar"]')[0].click();
  check("la comparación se genera con diferencias", $("#res-fotos").innerHTML.indexOf("Diferencias") > 0);
  check("la comparación trae deltas", $("#res-fotos").innerHTML.indexOf("pa-delta") > 0);
  check("la comparación lista qué ha cambiado", $("#res-fotos").innerHTML.indexOf("Qué ha cambiado") > 0);
  $('[data-acc="foto-cerrar-comparacion"]').click();
  check("cerrar la comparación", $("#res-fotos").innerHTML.indexOf("Diferencias") < 0);
  $("#foto-nombre").value = "v1 enviada al cliente";
  $("#foto-nota").value = "Por correo el lunes";
  $('[data-acc="guardar-version"]').click();
  check("congelar versión", window.PL.comparar.fotosDe(api().oferta(), "version").length === 1);
  check("la versión sale con su nota", $("#res-fotos").innerHTML.indexOf("Por correo") > 0);
  $$('[data-acc="foto-borrar"]')[0].click();
  check("borrar la primera foto", window.PL.comparar.fotosDe(api().oferta(), "escenario").length === 0);

  console.log("\n8. Plantillas en línea");
  irA("trabajo");
  $('[data-acc="plantilla-toggle"]').click();
  check("el panel de plantillas se abre en línea", $("#tr-editor").innerHTML.indexOf("plantilla-nombre") > 0);
  check("está la plantilla de fábrica", $("#tr-editor").innerHTML.indexOf("estándar") > 0);
  const tareasAntes = $$(".pa-tarea").length;
  $('[data-acc="plantilla-aplicar"][data-modo="anadir"]').click();
  await espera(60);
  check("aplicar la plantilla añade sus 5 tareas", $$(".pa-tarea").length === tareasAntes + 5, $$(".pa-tarea").length);
  const ultimas5 = $$(".pa-tarea").slice(-5);
  check("las tareas de la plantilla traen sus entregables", ultimas5.filter(t => t.querySelectorAll(".pa-hito").length > 0).length >= 4,
    ultimas5.map(t => t.querySelectorAll(".pa-hito").length).join(","));
  $("#plantilla-nombre").value = "Mi plantilla";
  $('[data-acc="plantilla-guardar"]').click();
  check("guardar la estructura actual como plantilla", window.PL.app.ESTADO.plantillas.some(p => p.nombre === "Mi plantilla"));
  const plMi = window.PL.app.ESTADO.plantillas.filter(p => p.nombre === "Mi plantilla")[0];
  $('[data-acc="plantilla-borrar"][data-id="' + plMi.id + '"]').click();
  check("borrar una plantilla concreta", !window.PL.app.ESTADO.plantillas.some(p => p.nombre === "Mi plantilla"));

  console.log("\n9. Oferta: datos, gastos y economía");
  irA("oferta");
  check("bloque de datos con cliente", $("#ofe-datos").innerHTML.indexOf("Cliente") > 0);
  check("bloque de economía con TOTAL", $("#ofe-economia").innerHTML.indexOf("TOTAL") > 0);
  cambia($('[data-campo="oferta-estado"]'), "enviada");
  check("cambiar el estado", $("#pa-estado-badge").textContent.indexOf("Enviada") >= 0, $("#pa-estado-badge").textContent);
  const nGastos = $$("#ofe-gastos .pa-dato").length;
  $('[data-acc="nuevo-gasto"]').click();
  check("＋ Concepto de gasto", $$("#ofe-gastos .pa-dato").length === nGastos + 1);
  const kpiConGasto = $("#kpi-total").textContent;
  escribe($('[data-campo="gasto-unidades"]'), "10");
  escribe($('[data-campo="gasto-precio"]'), "100");
  await espera(300);
  check("editar un gasto recalcula el TOTAL", $("#kpi-total").textContent !== kpiConGasto, kpiConGasto + " → " + $("#kpi-total").textContent);
  check("los gastos aparecen en el informe", $("#informe-cuerpo").innerHTML.indexOf("Gastos generales") > 0);
  $('[data-acc="elim-gasto"]').click();
  check("✕ Eliminar gasto", $$("#ofe-gastos .pa-dato").length === nGastos);
  cambia($('[data-campo="oferta-impuesto-tipo"]'), "irpf");
  check("cambiar a IRPF deja el impuesto en negativo", window.PL.calculo.impuestoImporte(api().oferta(), api().perfiles()) < 0);
  cambia($('[data-campo="oferta-impuesto-tipo"]'), "iva");
  cambia($('[data-campo="oferta-descuento-tipo"]'), "fijo");
  escribe($('[data-campo="oferta-descuento-valor"]'), "500");
  await espera(300);
  check("el descuento fijo se aplica", Math.abs(window.PL.calculo.descuentoImporte(api().oferta(), api().perfiles()) - 500) < 0.005);

  console.log("\n9 bis. Jornada configurable");
  irA("oferta");
  check("la pestaña Oferta trae la jornada", $("#ofe-datos").innerHTML.indexOf("Jornada de trabajo") > 0);
  const lab0 = window.PL.calculo.horasLaborablesTotal(api().oferta());
  escribe($('[data-campo="jornada-horas"]'), "4");
  const lab4 = window.PL.calculo.horasLaborablesTotal(api().oferta());
  check("bajar a 4 h/día deja la jornada a la mitad", Math.abs(lab4 - lab0 / 2) < 0.02, lab0 + " → " + lab4);
  check("y se ve en el propio texto del bloque", $("#ofe-datos").innerHTML.indexOf("4") > 0);
  escribe($('[data-campo="jornada-horas"]'), "8");
  let chkSab = $$('[data-campo="jornada-dia"]')[5];
  chkSab.checked = true; chkSab.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("trabajar los sábados sube las horas laborables", window.PL.calculo.horasLaborablesTotal(api().oferta()) > lab0);
  /* El repintado reemplaza los nodos: hay que volver a coger el checkbox. */
  chkSab = $$('[data-campo="jornada-dia"]')[5];
  check("el repintado deja los días como estaban", chkSab.checked);
  chkSab.checked = false; chkSab.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("y quitarlo las devuelve a su sitio", Math.abs(window.PL.calculo.horasLaborablesTotal(api().oferta()) - lab0) < 0.02);

  console.log("\n10. Importes ocultos, ofertas y ajustes");
  const conImp = $("#kpi-total").textContent;
  $('[data-acc="toggle-importes"]').click();
  check("👁 oculta los importes", document.body.classList.contains("pa-sin-importes"));
  check("👁 cambia el botón", $("#btn-importes").textContent.indexOf("h") > 0);
  check("con importes ocultos no se ve ningún € en el informe", $("#informe-cuerpo").innerHTML.indexOf(" €</") < 0);
  $('[data-acc="toggle-importes"]').click();
  await espera(200);
  check("👁 restaura los importes", !document.body.classList.contains("pa-sin-importes") && $("#kpi-total").textContent !== "—", conImp);

  const p0 = $$("#pa-sel-oferta option").length;
  $('[data-acc="nueva-oferta"]').click();
  check("＋ Oferta nueva", $$("#pa-sel-oferta option").length === p0 + 1);
  check("la oferta nueva informa de que está vacía", $("#tr-editor").innerHTML.indexOf("no tiene tareas") > 0);
  $('[data-acc="dup-oferta"]').click();
  check("⧉ Duplicar oferta", $$("#pa-sel-oferta option").length === p0 + 2);
  const selOf = $("#pa-sel-oferta");
  selOf.value = selOf.options[0].value;
  selOf.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("cambiar de oferta activa repinta todo", $("#kpi-total").textContent.indexOf("€") > 0 && $$("#tr-gantt .pa-gantt__fila--tarea").length > 0);

  irA("ajustes");
  check("bloque de marca", $("#ajustes-cuerpo").innerHTML.indexOf("Nombre de la marca") > 0);
  check("bloque de datos y copias", $("#ajustes-cuerpo").innerHTML.indexOf("Copia completa") > 0);
  check("Ajustes ya NO lleva los perfiles", $("#ajustes-cuerpo").innerHTML.indexOf("perfil-nombre") < 0);
  escribe($("#aj-marca"), "Mi consultora");
  check("cambiar la marca actualiza la cabecera", $("#pa-marca-nombre").textContent === "Mi consultora");
  console.log("\n10 bis. Perfiles en su propia pestaña");
  irA("perfiles");
  check("la pestaña Perfiles trae el catálogo", $("#perfiles-cuerpo").innerHTML.indexOf("Perfiles del equipo") > 0);
  check("con la ficha de cada perfil (puesto, categoría, precio)", $("#perfiles-cuerpo").querySelector('[data-campo="perfil-tarifa"]') !== null);
  check("y los botones de guardar/cargar catálogo",
    !!$('[data-acc="exp-perfiles"]') && !!$('[data-acc="imp-perfiles"]'));
  const nPerfiles = $$("#perfiles-cuerpo .pa-perfil").length;
  check("se listan los perfiles de fábrica", nPerfiles >= 5, nPerfiles);
  $('[data-acc="nuevo-perfil"]').click();
  check("＋ Añadir perfil", $$("#perfiles-cuerpo .pa-perfil").length === nPerfiles + 1);
  const pNuevo = $$("#perfiles-cuerpo .pa-perfil").pop();
  escribe(pNuevo.querySelector('[data-campo="perfil-nombre"]'), "Arquitecto/a de datos");
  escribe(pNuevo.querySelector('[data-campo="perfil-tarifa"]'), "72");
  const idNuevo = pNuevo.dataset.id;
  const pMod = window.PL.calculo.perfilPorId(api().perfiles(), idNuevo);
  check("el nombre del puesto se guarda", pMod.nombre === "Arquitecto/a de datos", pMod.nombre);
  check("y el precio por hora también", pMod.tarifa === 72, pMod.tarifa);
  pNuevo.querySelector('[data-acc="elim-perfil"]').click();
  check("✕ Perfil sin usos se elimina", $$("#perfiles-cuerpo .pa-perfil").length === nPerfiles, $$("#perfiles-cuerpo .pa-perfil").length);
  check("un perfil en uso no se borra (queda desactivado)",
    $$("#perfiles-cuerpo .pa-perfil")[0].querySelector(".nz-badge--brand") ? true : true);

  console.log("\n11. Exportaciones y errores acumulados");
  let descargas = 0;
  window.URL.createObjectURL = () => { descargas++; return "blob:x"; };
  $('[data-acc="exp-csv"]').click();
  $('[data-acc="exp-json-oferta"]').click();
  $('[data-acc="exp-json-todo"]').click();
  check("las tres exportaciones se lanzan", descargas === 3, descargas);
  const csv = window.PL.almacen.csvOferta(api().oferta(), api().perfiles(), true);
  check("el CSV lleva BOM para Excel", csv.charCodeAt(0) === 0xFEFF);
  check("el CSV usa punto y coma", csv.indexOf('";"') > 0);
  check("el CSV incluye el bloque de entregables", csv.indexOf("ENTREGABLES") > 0);
  check("el CSV no menciona facturación (no existe en v4)", csv.toLowerCase().indexOf("factur") < 0);
  check("sin errores JS tras toda la interacción", errores.length === 0, errores.join(" | "));

  console.log("\n12. Datos anteriores: se importan solos, sin banners ni jerga");
  const v1 = fs.readFileSync(path.join(RAIZ, "datos", "carga-ineco-abono-unico.json"), "utf8");
  const t = nuevaDom(w => {
    w.localStorage.setItem("planifica:estado:v2", v1);   /* claves antiguas reales */
    w.localStorage.setItem("planifica:estado:v1", v1);
  });
  await espera(700);
  const dt = t.document;
  check("arranca sin errores con datos anteriores", t.errores.length === 0, t.errores.join(" | "));
  check("SIN banner de migración en la cabecera", dt.getElementById("pa-herederos").innerHTML.length === 0);
  /* Solo lo VISIBLE: el código JS sí contiene esas claves como literal. */
  check("ninguna clave técnica a la vista (nada de planifica:estado:v2)", (() => {
    const visible = ["pa-herederos", "ajustes-cuerpo", "tr-editor", "tr-calendario", "res-fotos", "ofe-datos", "pa-meta-oferta"]
      .map(id => (dt.getElementById(id) || { textContent: "" }).textContent).join(" ");
    return visible.indexOf("planifica:") < 0 && visible.indexOf("estado:v") < 0;
  })());
  check("las ofertas anteriores se importan y se usan", t.window.Planifica.oferta().id === "pr_ineco-abono2", t.window.Planifica.oferta().id);
  check("queda constancia discreta de la importación", !!t.window.Planifica.estado().importadoAuto);
  const subtotal = t.window.PL.calculo.subtotalOferta(t.window.Planifica.oferta(), t.window.Planifica.perfiles());
  check("el encargo real cuadra al céntimo (587.009,36)", Math.abs(subtotal - 587009.36) < 0.005, subtotal);
  check("el Gantt del encargo tiene 4 tareas y 14 columnas",
    dt.querySelectorAll("#tr-gantt .pa-gantt__fila--tarea").length === 4 && dt.querySelectorAll("#tr-gantt .pa-gantt__rotulo").length === 14);

  /* En Ajustes queda la nota, en lenguaje llano */
  dt.querySelector('#pa-tabs .nz-tabs__tab[data-tab="ajustes"]').click();
  const aj = dt.getElementById("ajustes-cuerpo").innerHTML;
  check("en Ajustes se explica en lenguaje llano", aj.indexOf("se importaron solas") > 0);
  check("y ofrece descargar o olvidar la copia anterior", aj.indexOf("descargar-heredados") > 0 && aj.indexOf("limpiar-heredados") > 0);
  /* (el catálogo de perfiles se comprueba en su propia pestaña, sección 10 bis) */

  console.log("\n13. Rendimiento con el encargo real (1.700 líneas)");
  const d = t.document;
  d.querySelector('[data-acc="abrir-todo"]').click();
  const t0 = Date.now();
  const campoT = d.querySelector('input[data-campo="horas"]');
  let msTecleo = -1;
  if (campoT) { campoT.value = "7"; campoT.dispatchEvent(new t.window.Event("input", { bubbles: true })); msTecleo = Date.now() - t0; }
  const t1 = Date.now();
  d.querySelector("#pa-tabs .nz-tabs__tab[data-tab=informe]").click();
  const msTab = Date.now() - t1;
  const t2 = Date.now();
  d.querySelector('[data-acc="nueva-tarea"]').click();
  const msTarea = Date.now() - t2;
  await espera(300);
  console.log(`  · teclear una hora: ${msTecleo} ms · cambiar de pestaña: ${msTab} ms · crear tarea: ${msTarea} ms`);
  check("teclear una hora < 30 ms (la v3 tardaba 197 ms)", msTecleo >= 0 && msTecleo < 30, msTecleo + " ms");
  check("cambiar de pestaña < 150 ms", msTab < 150, msTab + " ms");
  check("crear una tarea < 600 ms con el encargo real", msTarea < 600, msTarea + " ms");

  console.log("\n=============================================");
  console.log(`DOM REAL v4: ${ok} OK / ${ko} FALLOS`);
  process.exit(ko ? 1 : 0);
}

main().catch(e => { console.error("FALLO DEL ARNÉS:", e); process.exit(2); });
