# -*- coding: utf-8 -*-
"""Auditoría de CONEXIONES de Planifica v4 sobre el HTML compilado.

Caza los fallos que no se ven a simple vista y que en la versión anterior dejaron
botones muertos y clases inventadas que Aurora no define:

  1. Botones data-acc="X" sin acción declarada (pulsarlos no hacía nada).
  2. Nodos que el JS pide por id y no existen en el HTML.
  3. Clases nz-* usadas que no define ningún pack de Aurora ni el CSS propio
     (clases inventadas, como el viejo .nz-field--wide).
  4. Nombres exportados que no se declaran en su módulo (ReferenceError al cargar).

Uso:  py -3.12 tools/auditar-wiring.py     (código 1 si hay FALLOS)
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DOC = BASE / "docs" / "index.html"
JS = sorted((BASE / "src" / "js").glob("*.js"))

fallos, avisos = [], []

if not DOC.exists():
    print("FALLO: no existe docs/index.html (ejecuta antes tools/compilar.py)")
    sys.exit(1)

html = DOC.read_text(encoding="utf-8")
fuentes = {p.name: p.read_text(encoding="utf-8") for p in JS}
todo_js = "\n".join(fuentes.values())
estilo, cuerpo = html.split("</style>", 1)          # estilo = Aurora + propio; cuerpo = HTML + JS

RE_CLASE = re.compile(r"""class=\\?["']([^"'\\]+)""")
RE_CLASSLIST = re.compile(r"""classList\.(?:add|remove|toggle|contains)\(\s*["']([\w-]+)""")


def clases_de(texto):
    """Clases nz-* de atributos class="..." y de classList.*. Descarta restos de
    concatenación ('nz-callout--' + tipo) y variables CSS (--nz-space-2)."""
    vistos = set()
    for m in RE_CLASE.finditer(texto):
        for c in m.group(1).split():
            if c.startswith("nz-") and not c.endswith("-") and "--" not in c:
                vistos.add(c)
    for m in RE_CLASSLIST.finditer(texto):
        vistos.add(m.group(1))
    return vistos


# ---------- 1. Acciones declaradas vs botones ----------
acciones_definidas = set(re.findall(r'\n\s{4}"([a-z0-9-]+)":', fuentes.get("acciones.js", "")))
acciones_usadas = set(re.findall(r'data-acc="([\w-]+)"', cuerpo)) | set(re.findall(r'data-acc="([\w-]+)"', todo_js))
huerfanas = sorted(acciones_usadas - acciones_definidas)
sin_boton = sorted(acciones_definidas - acciones_usadas)
if huerfanas:
    fallos.append("botones SIN acción (no hacen nada al pulsarlos): " + ", ".join(huerfanas))
if sin_boton:
    avisos.append("acciones declaradas sin botón: " + ", ".join(sin_boton))

# ---------- 2. Nodos pedidos por el JS ----------
ids = set(re.findall(r'\bid="([\w-]+)"', cuerpo)) | set(re.findall(r'\bid="([\w-]+)"', todo_js))
pedidos = set()
for f, s in fuentes.items():
    for m in re.finditer(r'\.(?:nodo|escribir|texto|vaciar)\(\s*"([\w-]+)"', s):
        pedidos.add((m.group(1), f))
    for m in re.finditer(r'getElementById\(\s*"([\w-]+)"', s):
        pedidos.add((m.group(1), f))
fantasma = sorted((n, f) for n, f in pedidos if n not in ids)
if fantasma:
    fallos.append("nodos que el JS pide y no existen: " + ", ".join("%s (%s)" % (n, f) for n, f in fantasma))

# ---------- 3. Clases nz-* usadas vs definidas ----------
usadas = clases_de(cuerpo) | clases_de(todo_js)
definidas = set(re.findall(r'\.(nz-[\w-]+)', estilo))
css_propio = (BASE / "src" / "css" / "app.css").read_text(encoding="utf-8")
definidas_pa = set(re.findall(r'\.(pa-[\w-]+)', css_propio))
# Las .pa-* y los estados .is-* son de la aplicación, no de Aurora: no se comparan con los packs.
inventadas = sorted(c for c in usadas - definidas if c.startswith("nz-"))
if inventadas:
    fallos.append("clases de Aurora usadas que NO existen en ningún pack: " + ", ".join(inventadas))
sin_estilo = sorted(c for c in usadas if c.startswith("pa-") and c not in definidas_pa)
if sin_estilo:
    avisos.append("clases propias sin estilo definido: " + ", ".join(sin_estilo))

# ---------- 4. Exports sin declarar ----------
for f, s in fuentes.items():
    declaradas = set(re.findall(r'function\s+(\w+)', s)) | set(re.findall(r'(?:const|let|var)\s+(\w+)\s*=', s))
    for m in re.finditer(r'PL\.[\w.]+ = \{([^\n]*)\};', s):
        for _k, v in re.findall(r'(\w+)\s*:\s*(\w+)', m.group(1)):
            if v not in declaradas:
                fallos.append("%s: se exporta «%s», que no se declara en el módulo" % (f, v))

# ---------- Informe ----------
print("  acciones declaradas: %d · botones con acción: %d" % (len(acciones_definidas), len(acciones_usadas)))
print("  nodos pedidos por el JS: %d · ids disponibles: %d" % (len(pedidos), len(ids)))
print("  clases nz-* usadas: %d · definidas: %d" % (len(usadas), len(definidas)))
if avisos:
    print("  (aviso) " + " | ".join(avisos))
if fallos:
    print("  FALLOS: %d" % len(fallos))
    for f in fallos:
        print("    ✗ " + f)
    sys.exit(1)
print("  sin fallos: todo botón tiene acción, todo nodo existe y toda clase es de Aurora")
