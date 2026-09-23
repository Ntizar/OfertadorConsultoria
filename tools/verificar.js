"use strict";
/* Arnés de verificación de Planifica: ejecuta app.js en una sandbox con DOM falso,
   importa el JSON de Ineco y comprueba los totales contra el Excel original. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const BASE = path.join(__dirname, "..");
const codigo = fs.readFileSync(path.join(BASE, "src", "app.js"), "utf8");
const ineco = fs.readFileSync(path.join(BASE, "datos", "carga-ineco-abono-unico.json"), "utf8");

function elementoFake(sel){
  return {
    textContent: "", innerHTML: "", value: "", checked: false, hidden: false,
    style: {}, dataset: {}, id: String(sel||"").replace("#",""),
    classList: { toggle(){}, add(){}, remove(){} },
    querySelector: () => null, querySelectorAll: () => [],
    setAttribute(){}, appendChild(){}
  };
}
const elementos = new Map();
const handlers = {};
const documentFake = {
  title: "",
  body: Object.assign(elementoFake("body"), { appendChild(){} }),
  querySelector(sel){ if (!elementos.has(sel)) elementos.set(sel, elementoFake(sel)); return elementos.get(sel); },
  querySelectorAll(){ return []; },
  addEventListener(tipo, fn){ (handlers[tipo] = handlers[tipo] || []).push(fn); },
  createElement(tag){ const el = elementoFake("<"+tag+">"); el.click = () => {}; el.remove = () => {}; return el; }
};
const sandbox = {
  console, setTimeout, clearTimeout, Math, JSON, Date, isNaN, parseFloat, parseInt,
  document: documentFake, window: { addEventListener(){} },
  confirm: () => true,
  alert: () => {},
  Blob: class { constructor(){} },
  URL: { createObjectURL: () => "blob:falso", revokeObjectURL(){} },
  FileReader: class { readAsText(){} },
  __cargados: null
};
sandbox.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };

let fallos = 0;
const comprobar = (nombre, ok, detalle) => {
  console.log((ok ? "  ✓ " : "  ✗ FALLO ") + nombre + (detalle ? " → " + detalle : ""));
  if (!ok) fallos++;
};

vm.createContext(sandbox);
try {
  vm.runInContext(codigo, sandbox, { filename: "app.js" });
  comprobar("La app arranca sin errores", true);
} catch (e) {
  comprobar("La app arranca sin errores", false, e.stack || e.message);
  process.exit(1);
}

const E = vm.runInContext("ESTADO", sandbox);
const fns = vm.runInContext("({importeProyecto, tareaImporte, totalProyecto, horasProyecto, anualidades, normalizarProyecto, renderInforme, acc, importarJSON, proyectoActivo, perfilPorId})", sandbox);
const projectActivo = () => vm.runInContext("proyectoActivo()", sandbox);
comprobar("Estado inicial creado", E && Array.isArray(E.proyectos) && E.proyectos.length === 2);
comprobar("Biblioteca de perfiles precargada", E.perfiles.length === 6, E.perfiles.length + " perfiles");
comprobar("Proyecto de ejemplo con datos", fns.importeProyecto(E.proyectos[1]) > 0,
  "importe=" + fns.importeProyecto(E.proyectos[1]) + " · " + JSON.stringify(E.proyectos[1]).slice(0, 220));

// Importar el proyecto Ineco (usa confirm=true, Blob/URL falsos)
try {
  fns.importarJSON(ineco);
  comprobar("Importación del proyecto Ineco", true);
} catch (e) {
  comprobar("Importación del proyecto Ineco", false, e.stack || e.message);
}

const pr = projectActivo();
comprobar("Proyecto activo = Ineco", pr && pr.id === "pr_ineco-abono2");
comprobar("Perfiles del encargo cargados (13 roles)", E.perfiles.length === 13, E.perfiles.length + " perfiles");

const totalesExcel = {
  "Tarea A": 165965.73, "Tarea B": 137329.44, "Tarea C": 195871.83, "Tarea D": 87842.36
};
for (const t of pr.tareas){
  const clave = "Tarea " + t.nombre.charAt(6);
  const esperado = totalesExcel[clave];
  const real = fns.tareaImporte(t);
  comprobar(`${clave} = ${esperado.toLocaleString("es-ES")} €`, Math.abs(real - esperado) < 0.005, "app: " + real);
}
const total = fns.totalProyecto(pr);
comprobar("TOTAL = 587.009,36 €", Math.abs(total - 587009.36) < 0.005, "app: " + total);
const horas = fns.horasProyecto(pr);
comprobar("Horas totales = 10.127,5 h", Math.abs(horas - 10127.5) < 0.005, "app: " + horas);

// Anualidades: deben sumar el importe del proyecto
const anual = fns.anualidades(pr);
const sumaAnual = [...anual.values()].reduce((a,b)=>a+b,0);
comprobar("Anualidades suman el importe del proyecto", Math.abs(sumaAnual - fns.importeProyecto(pr)) < 0.01);
console.log("  · Anualidades:", [...anual.entries()].map(([y,v]) => y + ": " + v.toLocaleString("es-ES", {maximumFractionDigits:2}) + " €").join(" · "));

// Normalización: proyecto con meses alterados y horas fuera de rango
const roto = { id: "pr_roto", nombre: "", meses: 999, fechaInicio: "",
  gastos: [{ nombre: "x" }],
  tareas: [{ nombre: "T", subtareas: [{ lineas: [{ perfilId: "pf_jp", horas: { m0: 3, m99: 7 } }] }] }] };
const rn = fns.normalizarProyecto(roto);
comprobar("Normalización: meses acotados a 60", rn.meses === 60);
comprobar("Normalización: horas fuera de rango descartadas", rn.tareas[0].subtareas[0].lineas[0].horas.m99 === undefined && rn.tareas[0].subtareas[0].lineas[0].horas.m0 === 3);

// Toggle de importes: el informe no debe contener cifras económicas
E.mostrarImportes = false;
fns.renderInforme();
const cuerpo = elementos.get("#informe-cuerpo");
const sinEuros = cuerpo && !cuerpo.innerHTML.includes("587.009") && !cuerpo.innerHTML.includes("165.965");
comprobar("Modo sin importes: informe sin cifras", !!sinEuros);
E.mostrarImportes = true;
fns.renderInforme();
const cuerpo2 = elementos.get("#informe-cuerpo");
comprobar("Modo con importes: informe con el total", !!cuerpo2 && cuerpo2.innerHTML.includes("587.009,36"));

// Estructura editable: añadir tarea y subtarea no rompe nada
const nAntes = pr.tareas.length;
fns.acc["nueva-tarea"]();
comprobar("Añadir tarea dinámicamente", pr.tareas.length === nAntes + 1);
fns.acc["elim-tarea"](pr.tareas[pr.tareas.length-1].id);
comprobar("Eliminar tarea dinámicamente", pr.tareas.length === nAntes);

console.log(fallos === 0 ? "\nRESULTADO: TODO OK" : `\nRESULTADO: ${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
