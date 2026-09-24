"use strict";
/* Arnés de verificación de Planifica v2 — ejecuta app.js en una sandbox con DOM falso,
   migra/importa el JSON de Ineco y comprueba los totales contra el Excel original. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const CODIGO = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
/* num() en el arnés (app.js tiene el suyo dentro del contexto) */
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };

let checks = 0, fallos = 0;
function comprobar(nombre, cond, detalle){
  checks++;
  if (cond){ console.log("  ✓ " + nombre); }
  else { fallos++; console.log("  ✗ " + nombre + (detalle ? " → " + detalle : "")); }
}
console.log("== Planifica v2 — verificación del motor ==\n");

/* ---------- DOM falso ---------- */
const elementos = new Map();
function mkEl(id){
  if (elementos.has(id)) return elementos.get(id);
  const el = {
    id, textContent:"", innerHTML:"", value:"", checked:false, hidden:false, files:null, src:"",
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    appendChild(){}, remove(){}, click(){}, closest(){ return null; },
    addEventListener(){}, dataset:{}, style:{}, children: []
  };
  elementos.set(id, el);
  return el;
}
const sandbox = {
  console, Math, JSON, Date, Number, String, Array, Object, Map, Set, RegExp, parseInt, parseFloat, isFinite, isNaN,
  URL: { createObjectURL: () => "blob:falso", revokeObjectURL(){} },
  Blob: class { constructor(){} }, FileReader: class { constructor(){} },
  localStorage: {
    _d: {},
    getItem(k){ return this._d[k] === undefined ? null : this._d[k]; },
    setItem(k, v){ this._d[k] = String(v); },
    removeItem(k){ delete this._d[k]; }
  },
  confirm: () => true,
  prompt: () => "Plantilla de prueba",
  alert(){},
  document: {
    title: "",
    body: { classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, appendChild(){} },
    addEventListener(){}, removeEventListener(){},
    querySelector(sel){
      const m = String(sel).match(/#[A-Za-z][\w-]*/);
      return mkEl(m ? m[0].slice(1) : sel);
    },
    querySelectorAll(){ return []; },
    createElement(){ return mkEl("el_" + Math.random()); }
  },
  window: { addEventListener(){}, matchMedia(){ return { matches:false }; } },
  setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){}
};
/* window DEBE ser el propio sandbox para que `window.addEventListener` y
   `window.confirm` funcionen dentro del contexto (app.js usa ambos). */
sandbox.addEventListener = sandbox.addEventListener || function(){};
sandbox.matchMedia = sandbox.matchMedia || function(){ return { matches:false }; };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(CODIGO, sandbox, { filename: "app.js" });

/* ---------- Handles desde el contexto ---------- */
let E = vm.runInContext("ESTADO", sandbox);
const fns = vm.runInContext("({ totalProyecto, subtotalProyecto, baseImponible, impuestoImporte, descuentoImporte, importeProyecto, gastosTotal, horasProyecto, tareaImporte, anualidades, normalizarProyecto, normalizarPerfil, normalizarPlantilla, importarJSON, aplicarPlantilla, guardarEstructuraComoPlantilla, perfilesDefecto, plantillasDefecto, estadoInicial, migrarV1, acc, renderInforme, renderTodo, mostrarPestana, exportarCSV, descargaObj }) => descargaObj", sandbox) || {};
const FUNCS = vm.runInContext(`({
  totalProyecto, subtotalProyecto, baseImponible, impuestoImporte, descuentoImporte,
  importeProyecto, gastosTotal, horasProyecto, tareaImporte, anualidades,
  normalizarProyecto, normalizarPerfil, normalizarPlantilla, importarJSON,
  aplicarPlantilla, guardarEstructuraComoPlantilla, perfilesDefecto, plantillasDefecto,
  estadoInicial, migrarV1, acc, renderInforme, renderTodo, mostrarPestana, exportarCSV
})`, sandbox);

/* ---------- 1. Estado inicial v2 ---------- */
console.log("1. Estado inicial");
comprobar("Versión 2", E.version === 2);
comprobar("7 perfiles por defecto precargados", E.perfiles.length === 7, "hay " + E.perfiles.length);
comprobar("Perfiles marcados esDefecto", E.perfiles.every(p => p.esDefecto === true));
comprobar("Perfiles con categoría", E.perfiles.every(p => p.categoria && p.categoria !== ""));
comprobar("Plantilla de fábrica presente", E.plantillas.length === 1 && E.plantillas[0].id === "pl_estandar", JSON.stringify(E.plantillas).slice(0,120));
comprobar("1 proyecto de ejemplo", E.proyectos.length === 1);
const ej = E.proyectos[0];
comprobar("Ejemplo: es guía (pr.guia)", ej.guia === true);
comprobar("Ejemplo: cliente estructurado", ej.cliente && typeof ej.cliente === "object" && !!ej.cliente.nombre);
comprobar("Ejemplo: tiene impuestos y descuento", ej.impuestos.tipo === "iva" && ej.descuento.tipo === "%" && num(ej.descuento.valor) > 0);
comprobar("Ejemplo: importe > 0", FUNCS.importeProyecto(ej) > 0, "importe=" + FUNCS.importeProyecto(ej));

/* ---------- 2. Cadena de totales ---------- */
console.log("\n2. Cadena de totales del ejemplo");
const st = FUNCS.subtotalProyecto(ej), ds = FUNCS.descuentoImporte(ej), bi = FUNCS.baseImponible(ej);
const iv = FUNCS.impuestoImporte(ej), tt = FUNCS.totalProyecto(ej);
comprobar("subtotal = consultoría + gastos", Math.abs(st - (FUNCS.importeProyecto(ej) + FUNCS.gastosTotal(ej))) < 0.005);
comprobar("descuento 5% correcto", Math.abs(ds - st*0.05) < 0.01, "ds=" + ds + " esperado " + r2s(st*0.05));
comprobar("base = subtotal − descuento", Math.abs(bi - (st - ds)) < 0.005);
comprobar("IVA 21% sobre base", Math.abs(iv - bi*0.21) < 0.01);
comprobar("total = base + IVA", Math.abs(tt - (bi + iv)) < 0.005);
comprobar("anualidades suman importe (sin gastos/impuestos)", (() => {
  let s=0; FUNCS.anualidades(ej).forEach(v=>s+=v); return Math.abs(s - FUNCS.importeProyecto(ej)) < 0.01;
})());

function r2s(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

/* ---------- 3. Ineco: flujo real (estado v1 → importarJSON → migración v2) ---------- */
console.log("\n3. Encargo Ineco (estado v1 completo → importarJSON → migración v2)");
const rutaIneco = path.join(__dirname, "..", "datos", "carga-ineco-abono-unico.json");
const dataIneco = JSON.parse(fs.readFileSync(rutaIneco, "utf8"));
const bruto = JSON.stringify(dataIneco);
vm.runInContext("importarJSON(" + JSON.stringify(bruto) + ")", sandbox);
const pr = vm.runInContext("proyectoActivo()", sandbox);
comprobar("importarJSON acepta estado v1 y activa el proyecto", pr && pr.id === "pr_ineco-abono2", "id=" + (pr && pr.id));
comprobar("biblioteca migrada: 13 perfiles del encargo", E.perfiles.length === 13, "n=" + E.perfiles.length);
comprobar("perfiles migrados con categoria valida", E.perfiles.every(p => p.categoria && p.categoria !== ""));
const catJp = E.perfiles.find(p => p.id === "pf_jp");
comprobar("perfil pf_jp con categoria 'Otro' (sin inventar)", catJp.categoria === "Otro");
comprobar("migración v1: sin impuestos inyectados (el Excel no llevaba)", pr.impuestos.tipo === "ninguno");
const totalesExcel = {
  "Tarea A": 155235.46,
  "Tarea B": 271269.94,
  "Tarea C": 137359.99,
  "Tarea D": 23143.97,
};
for (const t of pr.tareas){
  const clave = "Tarea " + t.nombre.charAt(0);
  const esperado = totalesExcel[clave];
  if (esperado === undefined) continue;
  const real = FUNCS.tareaImporte(t);
  comprobar(`${clave} = ${esperado.toLocaleString("es-ES", {minimumFractionDigits:2})}`, Math.abs(real - esperado) < 0.005, "real=" + real);
}
const totalExcel = 587009.36;
const subtotalApp = FUNCS.subtotalProyecto(pr);
comprobar("TOTAL sin impuestos = 587.009,36 (al céntimo del Excel)", Math.abs(subtotalApp - totalExcel) < 0.005, "app=" + subtotalApp);
comprobar("Proyecto migrado: cliente estructurado", pr.cliente && typeof pr.cliente === "object");
comprobar("Proyecto migrado: estado por defecto", pr.estado === "borrador");

/* ---------- 4. Perfiles por defecto: restauración (sobre la fábrica) ---------- */
console.log("\n4. Perfiles por defecto");
/* Tras importar Ineco la biblioteca son los 13 perfiles del encargo.
   Recreo el estado de fábrica para probar la restauración de perfiles.
   IMPORTANTE: refrescar E después (ESTADO se REASIGNA → referencia stale). */
vm.runInContext("ESTADO = estadoInicial(); ESTADO.activo = ESTADO.proyectos[0].id;", sandbox);
E = vm.runInContext("ESTADO", sandbox);
const pf = E.perfiles[0];
const nombreOriginal = pf.nombre, tarifaOriginal = pf.tarifa;
pf.nombre = "Editado"; pf.tarifa = 99;
FUNCS.acc["restaurar-perfil"](pf.id);
comprobar("restaurar-perfil devuelve nombre de fábrica", E.perfiles[0].nombre === nombreOriginal);
comprobar("restaurar-perfil devuelve tarifa de fábrica", E.perfiles[0].tarifa === tarifaOriginal);
const antes = E.perfiles.length;
FUNCS.acc["restaurar-perfiles-defecto"]();
comprobar("restaurar-perfiles-defecto no duplica", E.perfiles.length === antes);

/* ---------- 5. Plantillas ---------- */
console.log("\n5. Plantillas de tareas");
/* ej apuntaba al estado anterior (ESTADO fue reasignado en la sección 4): recapturar */
const ej2 = E.proyectos.find(p => p.guia === true) || E.proyectos[0];
FUNCS.guardarEstructuraComoPlantilla();
comprobar("guardarEstructuraComoPlantilla crea plantilla del ejemplo", E.plantillas.length === 2, "n=" + E.plantillas.length);
const nueva = E.plantillas[E.plantillas.length - 1];
comprobar("plantilla guardada con tareas y subtareas", nueva.tareas.length === ej2.tareas.length && nueva.tareas[0].subtareas.length > 0);
const antes2 = (ej2.tareas||[]).length;
FUNCS.acc["aplicar-plantilla"]("pl_estandar");
comprobar("aplicar-plantilla AÑADE 5 tareas a la oferta", (ej2.tareas||[]).length === antes2 + 5, "n=" + (ej2.tareas||[]).length);
FUNCS.acc["aplicar-plantilla"]("pl_estandar");
comprobar("aplicar-plantilla otra vez añade 5 más", (ej2.tareas||[]).length === antes2 + 10, "n=" + (ej2.tareas||[]).length);

/* ---------- 6. Exportaciones con datos ---------- */
console.log("\n6. Exportaciones");
let descargado = null;
sandbox.URL.createObjectURL = () => "blob:falso";
FUNCS.acc["exp-json-proy"]();
comprobar("exp-json-proy ejecuta sin excepción", true);
FUNCS.acc["exp-csv"]();
comprobar("exp-csv ejecuta sin excepción", true);
FUNCS.acc["exp-biblio"]();
comprobar("exp-biblio ejecuta sin excepción", true);
/* exportarCSV usa descargar(): Blob falso. Comprobar contenido vía blob */

/* ---------- 7. Normalización defensiva ---------- */
console.log("\n7. Normalización defensiva");
const roto = { id:"pr_roto", nombre:"", meses:999, fecha:"", validezDias:-5,
  cliente:"Texto plano v1",
  impuestos:{tipo:"cualquiera", tasa:-3}, descuento:{tipo:"loco", valor:-2},
  gastos:[{nombre:"x"}],
  tareas:[{nombre:"T", subtareas:[{lineas:[{perfilId:"pf_jp", horas:{m0:3, m99:7}}]}]}]};
const rn = FUNCS.normalizarProyecto(roto);
comprobar("meses acotados a 60", rn.meses === 60);
comprobar("validez no negativa", rn.validezDias >= 0);
comprobar("cliente texto plano → objeto", rn.cliente && typeof rn.cliente === "object" && rn.cliente.nombre === "Texto plano v1");
comprobar("tipo de impuesto inválido → iva", rn.impuestos.tipo === "iva");
comprobar("tasa acotada 0..100", rn.impuestos.tasa === 0, "tasa=" + rn.impuestos.tasa);
comprobar("descuento tipo inválido → vacío", rn.descuento.tipo === "");
comprobar("horas fuera de rango descartadas", rn.tareas[0].subtareas[0].lineas[0].horas.m99 === undefined && rn.tareas[0].subtareas[0].lineas[0].horas.m0 === 3);
comprobar("tasa decimal aceptada", FUNCS.normalizarProyecto({impuestos:{tipo:"iva",tasa:"21,5"}}).impuestos.tasa === 21.5);

/* ---------- 8. Render de punta a punta ---------- */
console.log("\n8. Render");
FUNCS.mostrarPestana("estructura");
FUNCS.mostrarPestana("resumen");
FUNCS.mostrarPestana("cronograma");
FUNFS_renderExtra();
function FUNFS_renderExtra(){
  FUNCS.mostrarPestana("gastos");
  FUNCS.mostrarPestana("informe");
  FUNCS.mostrarPestana("ajustes");
}
comprobar("render de las 6 pestañas sin excepciones", true);
const info = elementos.get("informe-cuerpo");
comprobar("informe contiene tabla de totales", info && /Totes|TOTAL/.test(info.innerHTML));
comprobar("informe menciona IVA 21%", info && /IVA 21%/.test(info.innerHTML));
comprobar("informe con badge de estado", info && /Borrador/.test(info.innerHTML));

/* ---------- 9. Guardado ---------- */
console.log("\n9. Persistencia");
sandbox.localStorage.setItem("planifica:estado:v2", "x");
comprobar("localStorage accesible", sandbox.localStorage.getItem("planifica:estado:v2") === "x");

/* ---------- Resumen ---------- */
console.log("\n=============================================");
if (fallos === 0){ console.log(`RESULTADO: ${checks}/${checks} comprobaciones OK`); process.exit(0); }
else { console.log(`RESULTADO: ${fallos} fallos de ${checks} comprobaciones`); process.exit(1); }
