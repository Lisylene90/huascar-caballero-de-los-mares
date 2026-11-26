"""
Generador de sprites pixel art para "Huáscar: El Caballero de los Mares".
Autora: Lizbeth Huaman

Crea:
  assets/sprites/<nombre>.png        -> tira horizontal de frames (tamaño real, 1x)
  assets/sprites/spritesheet.png     -> atlas con todos los sprites
  assets/sprites/spritesheet.json    -> coordenadas de cada frame
  assets/piskel/<nombre>.piskel      -> archivos editables para Piskel (editor pixel art)
  docs/sprites_preview/<nombre>.png  -> vista ampliada x6 para la presentación

Uso: python3 tools/generar_sprites.py   (desde la carpeta del proyecto)
"""
import base64, io, json, math, os, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sprites")
PISKEL = os.path.join(ROOT, "assets", "piskel")
PREV = os.path.join(ROOT, "docs", "sprites_preview")
for d in (OUT, PISKEL, PREV):
    os.makedirs(d, exist_ok=True)

# Paleta (inspirada en "Sweetie 16" + colores navales)
P = {
    ".": (0, 0, 0, 0),
    "k": (20, 22, 36, 255),     # contorno
    "h": (44, 52, 76, 255),     # casco hierro oscuro
    "H": (78, 96, 122, 255),    # casco hierro claro
    "m": (96, 62, 38, 255),     # casco madera oscuro
    "M": (140, 92, 54, 255),    # casco madera claro
    "d": (150, 108, 66, 255),   # cubierta
    "D": (190, 146, 92, 255),   # cubierta clara
    "g": (120, 130, 140, 255),  # gris
    "G": (176, 188, 196, 255),  # gris claro
    "f": (28, 28, 32, 255),     # chimenea
    "r": (190, 38, 51, 255),    # rojo bandera
    "w": (244, 244, 244, 255),  # blanco
    "b": (40, 80, 170, 255),    # azul bandera
    "y": (255, 205, 117, 255),  # bronce
    "s": (238, 220, 190, 255),  # velas
    "S": (206, 186, 156, 255),  # velas sombra
    "p": (230, 178, 130, 255),  # piel
    "P": (186, 128, 90, 255),   # piel sombra
    "n": (40, 30, 26, 255),     # pelo/barba
    "u": (30, 40, 90, 255),     # uniforme azul
    "U": (58, 76, 150, 255),    # uniforme claro
    "o": (250, 120, 40, 255),   # naranja (salvavidas/fuego)
    "c": (60, 150, 200, 255),   # agua clara
    "C": (30, 90, 150, 255),    # agua
    "e": (20, 60, 110, 255),    # agua profunda
    "z": (230, 240, 255, 255),  # espuma
}


def from_grid(rows):
    h = len(rows)
    w = max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            px[x, y] = P.get(ch, (255, 0, 255, 255))
    return im


def outline(im, color=P["k"]):
    """Añade contorno de 1 px alrededor de los píxeles opacos."""
    w, h = im.size
    src = im.load()
    out = im.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0:
                        dst[x, y] = color
                        break
    return out


# ---------------------------------------------------------------- BARCOS (vista cenital, proa a la derecha)
def hull_shape(L, B, ram=False):
    """Polígono del casco: popa redondeada, proa aguda (o con espolón)."""
    cy = B / 2
    pts = []
    # costado de babor (arriba) de popa a proa
    for i in range(0, L + 1):
        x = i
        t = i / L
        if t < 0.12:          # popa redondeada
            k = math.sqrt(max(0, 1 - ((0.12 - t) / 0.12) ** 2))
            half = (B / 2 - 0.5) * (0.55 + 0.45 * k)
        elif t > 0.72:        # proa afinada
            k = (t - 0.72) / 0.28
            half = (B / 2 - 0.5) * (1 - k ** 1.6)
        else:
            half = B / 2 - 0.5
        pts.append((x, cy - half))
    tip = (L + (3 if ram else 1), cy)
    back = [(x, 2 * cy - y) for (x, y) in reversed(pts)]
    return pts + [tip] + back


def make_ship(L, B, hull, hull2, deck, turrets=(), funnels=(), masts=(), ram=False,
              flag=("r", "w", "r"), boats=(), frames=2, sails=False, smoke_seed=1):
    W, Hh = L + 6, B + 6
    out = []
    for fr in range(frames):
        im = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        poly = [(x + 1, y + 3) for x, y in hull_shape(L, B, ram)]
        dr.polygon(poly, fill=P[hull], outline=P["k"])
        inner = [(x + 1, y + 3) for x, y in hull_shape(L - 4, B - 4, False)]
        inner = [(x + 2, y + 2) for x, y in inner]
        dr.polygon(inner, fill=P[deck])
        # tablas de cubierta
        px = im.load()
        for x in range(4, L - 2, 3):
            for y in range(5, B + 1):
                if px[x, y] == P[deck] and deck == "d":
                    px[x, y] = P["D"] if (x // 3) % 2 == 0 else P[deck]
                elif px[x, y] == P[deck] and (x // 3) % 2 == 0 and y in (5, B):
                    px[x, y] = P["G"]
        # franja de luz del casco
        for x in range(3, L - 3):
            y = 4
            if px[x, y][3] and px[x, y] == P[hull]:
                px[x, y] = P[hull2]
        cy = B // 2 + 3
        for (tx, r) in turrets:
            dr.ellipse((tx - r, cy - r, tx + r, cy + r), fill=P["h"], outline=P["k"])
            dr.ellipse((tx - r + 1, cy - r + 1, tx + r - 2, cy + r - 2), fill=P["H"])
            # cañones gemelos de la torre
            dr.line((tx + r, cy - 1, tx + r + 4, cy - 1), fill=P["k"])
            dr.line((tx + r, cy + 1, tx + r + 4, cy + 1), fill=P["k"])
            px[tx, cy] = P["y"]
        for fx in funnels:
            dr.rectangle((fx - 2, cy - 2, fx + 2, cy + 2), fill=P["f"], outline=P["k"])
            px[fx, cy] = P["g"]
        for i, mx in enumerate(masts):
            if sails:
                sw = max(B - 2, 4)
                dr.rectangle((mx - 1, cy - sw // 2 - 2, mx + 1, cy + sw // 2 + 2), fill=P["s"], outline=P["S"])
                dr.line((mx, cy - sw // 2 - 2, mx, cy + sw // 2 + 2), fill=P["S"])
            px[mx, cy] = P["m"]
        for bx in boats:
            dr.rectangle((bx - 2, 4, bx + 2, 5), fill=P["M"])
            dr.rectangle((bx - 2, B + 1, bx + 2, B + 2), fill=P["M"])
        # bandera en popa (ondea con el frame)
        fx0 = 2
        fy = cy - 1
        wave = fr % 2
        for j, col in enumerate(flag):
            for yy in range(2):
                xx = fx0 - 1 - j
                if xx >= 0:
                    px[xx, fy + yy + (wave if j == 2 else 0)] = P[col]
        # humo de chimenea
        if funnels:
            rnd = random.Random(smoke_seed * 10 + fr)
            fx = funnels[0]
            for s in range(3):
                sx = fx - 3 - s * 2 - fr
                sy = cy - 1 + rnd.choice((-1, 0, 1))
                if 0 <= sx < W:
                    px[sx, sy] = P["G"] if s else P["g"]
        out.append(im)
    return out


def strip(frames):
    w, h = frames[0].size
    s = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * w, 0))
    return s


SPRITES = {}  # nombre -> lista de frames

# Huáscar: monitor blindado, torre giratoria a proa, una chimenea, espolón
SPRITES["huascar"] = make_ship(44, 12, "h", "H", "g", turrets=[(30, 4)], funnels=[20],
                               masts=[12, 37], ram=True, flag=("r", "w", "r"), boats=[16], smoke_seed=1)
# Unión: corbeta peruana (madera, 3 palos, 1 chimenea)
SPRITES["union"] = make_ship(40, 10, "m", "M", "d", funnels=[20], masts=[10, 26, 33],
                             flag=("r", "w", "r"), sails=True, boats=[15], smoke_seed=2)
# Esmeralda: corbeta chilena de madera (vela y vapor)
SPRITES["esmeralda"] = make_ship(38, 10, "m", "M", "d", funnels=[19], masts=[9, 25, 32],
                                 flag=("b", "w", "r"), sails=True, boats=[14], smoke_seed=3)
# Covadonga: goleta pequeña
SPRITES["covadonga"] = make_ship(28, 8, "m", "M", "d", funnels=[14], masts=[8, 21],
                                 flag=("b", "w", "r"), sails=True, smoke_seed=4)
# Cochrane / Blanco Encalada: blindados de batería central
SPRITES["cochrane"] = make_ship(48, 13, "h", "H", "H", turrets=[(22, 4), (32, 4)], funnels=[16],
                                masts=[9, 40], flag=("b", "w", "r"), boats=[12], smoke_seed=5)
SPRITES["blanco"] = make_ship(48, 13, "k", "h", "H", turrets=[(22, 4), (32, 4)], funnels=[16],
                              masts=[9, 40], flag=("b", "w", "r"), boats=[12], smoke_seed=6)

# Náufrago en el agua, agitando los brazos (4 frames)
naufrago_grids = [
    ["...nn...", "..npp...", "p.pPp..p", ".pUUUUp.", "..UuuU..", "zcCCCCcz", "CCzCCzCC", "........"],
    ["...nn...", "p.npp..p", ".ppPpp..", "..UUUU..", "..UuuU..", "cCCzzCCc", "CzCCCCzC", "........"],
    ["...nn...", "..npp...", "p.pPp..p", ".pUUUUp.", "..UuuU..", "CzcCCczC", "zCCCCCCz", "........"],
    ["...nn...", "..npp...", "..pPp...", "ppUUUUpp", "..UuuU..", "zCCzzCCz", "CCCCCCCC", "........"],
]
SPRITES["naufrago"] = [outline(from_grid(g)) for g in naufrago_grids]

# Salvavidas (2 frames, flota)
sv = ["..oooo..", ".owwwwo.", "ow....wo", "ow....wo", "ow....wo", ".owwwwo.", "..oooo..", "........"]
SPRITES["salvavidas"] = [from_grid(sv), from_grid(["........"] + sv[:-1])]

# Bala de cañón y proyectil incandescente
SPRITES["bala"] = [from_grid([".kk.", "kgGk", "kggk", ".kk."])]
SPRITES["bala_fuego"] = [from_grid([".oy.", "oyyo", "oyyo", ".oo."]), from_grid([".yo.", "yoyy", "oyyo", ".oy."])]


# Explosión (8 frames, 24x24)
def explosion_frames(n=8, size=24):
    fr = []
    rnd = random.Random(7)
    for i in range(n):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        c = size / 2
        t = i / (n - 1)
        r = 3 + t * 9
        if t < 0.8:
            dr.ellipse((c - r, c - r, c + r, c + r), fill=P["o"])
            r2 = r * (0.7 - t * 0.5)
            if r2 > 0.5:
                dr.ellipse((c - r2, c - r2, c + r2, c + r2), fill=P["y"])
            if t < 0.25:
                dr.ellipse((c - 2, c - 2, c + 2, c + 2), fill=P["w"])
        # humo
        for k in range(6):
            a = k / 6 * math.tau + i * 0.2
            sr = 2 + t * 3
            sx, sy = c + math.cos(a) * r * 0.9, c + math.sin(a) * r * 0.9
            col = P["g"] if t > 0.4 else P["k"]
            if t > 0.15:
                dr.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=col)
        fr.append(im)
    return fr


SPRITES["explosion"] = explosion_frames()


# Salpicadura de agua (6 frames, 16x16)
def splash_frames(n=6, size=16):
    fr = []
    for i in range(n):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        c = size / 2
        t = i / (n - 1)
        r = 2 + t * 6
        dr.ellipse((c - r, c - r, c + r, c + r), outline=P["z"] if t < 0.7 else P["c"])
        if t < 0.5:
            for k in range(8):
                a = k / 8 * math.tau
                d = 1 + t * 10
                x, y = c + math.cos(a) * d, c + math.sin(a) * d
                dr.point((x, y), fill=P["w"])
            dr.ellipse((c - 2, c - 2, c + 2, c + 2), fill=P["z"])
        fr.append(im)
    return fr


SPRITES["salpicadura"] = splash_frames()


# Agua (tile 32x32, 4 frames animados)
def water_frames(n=4, size=32):
    fr = []
    for i in range(n):
        im = Image.new("RGBA", (size, size), P["C"])
        px = im.load()
        for y in range(size):
            for x in range(size):
                v = math.sin((x + i * 8) / size * math.tau) + math.sin((y * 2 + x + i * 8) / size * math.tau)
                if v > 1.45:
                    px[x, y] = P["c"]
                elif v < -1.5:
                    px[x, y] = P["e"]
        fr.append(im)
    return fr


SPRITES["agua"] = water_frames()

# Costa: arena y roca (tiles 16x16)
rnd = random.Random(3)
arena = Image.new("RGBA", (16, 16), (214, 186, 130, 255))
roca = Image.new("RGBA", (16, 16), (110, 98, 90, 255))
for im, cols in ((arena, [(196, 166, 112, 255), (232, 206, 150, 255)]), (roca, [(84, 74, 70, 255), (140, 126, 116, 255)])):
    p = im.load()
    for _ in range(40):
        p[rnd.randrange(16), rnd.randrange(16)] = rnd.choice(cols)
SPRITES["costa"] = [arena, roca]

# Personajes (retratos para HUD y diálogos) 16x16 - genéricos, no retratos de personas reales
timonel = [
    "....kkkkkk......",
    "...kuuuuuuk.....",
    "..kuUUUUUUuk....",
    "..kkkkkkkkkk....",
    "...kppppppk.....",
    "...kpkppkpk.....",
    "...kppppppk.....",
    "...kpPPPPpk.....",
    "....kppppk......",
    "...kwbwwbwk.....",
    "..kwwbwwbwwk....",
    "..kwwwwwwwwk....",
    "..kuuuuuuuuk....",
    "..kuuu..uuuk....",
    "..kkk....kkk....",
    "................",
]
artillero = [
    "....kkkkkk......",
    "...kwwwwwwk.....",
    "..kwwwwwwwwk....",
    "..kkbbbbbbkk....",
    "...kppppppk.....",
    "...kpkppkpk.....",
    "...kppppppk.....",
    "...knnnnnnk.....",
    "....knnnnk......",
    "...krwwwwrk.....",
    "..kwrwwwwrwk....",
    "..kwwwwwwwwk....",
    "..kuuuuuuuuk....",
    "..kuuu..uuuk....",
    "..kkk....kkk....",
    "................",
]
almirante = [
    "...kkkkkkkk.....",
    "..kuuuuuuuuk....",
    ".kuuuyyyyuuuk...",
    ".kkkkkkkkkkkk...",
    "..knppppppnk....",
    "..knpkppkpnk....",
    "..knppppppnk....",
    "..knnnnnnnnk....",
    "...kpnnnnpk.....",
    "..kuyuuuuyuk....",
    ".kUuyuwwuyuUk...",
    ".kUuuuwwuuuUk...",
    ".kuuyuuuuyuuk...",
    ".kuuuu..uuuuk...",
    ".kkkk....kkkk...",
    "................",
]


def blink(g):
    g2 = list(g)
    g2[5] = g2[5].replace("pkppkp", "pppppp")
    return g2


SPRITES["timonel"] = [from_grid(timonel), from_grid(blink(timonel))]
SPRITES["artillero"] = [from_grid(artillero), from_grid(blink(artillero))]
SPRITES["almirante"] = [from_grid(almirante), from_grid(blink(almirante))]

# Iconos HUD: corazón (blindaje), bala (munición), boya (rescatados)
SPRITES["icono_blindaje"] = [from_grid([".kk.kk.", "krrkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."])]
SPRITES["icono_municion"] = [from_grid(["..kk...", ".kyyk..", ".kyyk..", "kyyyyk.", "kyyyyk.", "kkkkkk."])]

# ---------------------------------------------------------------- EXPORTAR
FPS = {"explosion": 14, "salpicadura": 12, "naufrago": 6, "agua": 4, "default": 6}


def to_b64(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


atlas_items = []
for name, frames in SPRITES.items():
    s = strip(frames)
    s.save(os.path.join(OUT, f"{name}.png"))
    w, h = frames[0].size
    # Piskel (editable)
    layer = {"name": "Capa 1", "opacity": 1, "frameCount": len(frames),
             "chunks": [{"layout": [[i] for i in range(len(frames))], "base64PNG": to_b64(s)}]}
    pk = {"modelVersion": 2, "piskel": {"name": name, "description": "Huáscar: El Caballero de los Mares - Lizbeth Huaman",
                                         "fps": FPS.get(name, FPS["default"]), "height": h, "width": w,
                                         "layers": [json.dumps(layer)], "hiddenFrames": []}}
    with open(os.path.join(PISKEL, f"{name}.piskel"), "w") as f:
        json.dump(pk, f)
    # vista previa ampliada
    sc = 6 if w * len(frames) * 6 < 1800 else 3
    s.resize((s.width * sc, s.height * sc), Image.NEAREST).save(os.path.join(PREV, f"{name}.png"))
    atlas_items.append((name, frames))

# Atlas: empaquetado por filas
MAXW = 512
x = y = rowh = 0
placements = []
for name, frames in atlas_items:
    w, h = frames[0].size
    tw = w * len(frames)
    if x + tw > MAXW:
        x, y, rowh = 0, y + rowh + 1, 0
    placements.append((name, x, y, w, h, len(frames)))
    x += tw + 1
    rowh = max(rowh, h)
AH = y + rowh
atlas = Image.new("RGBA", (MAXW, AH), (0, 0, 0, 0))
meta = {"meta": {"image": "spritesheet.png", "size": {"w": MAXW, "h": AH}, "autora": "Lizbeth Huaman"}, "sprites": {}}
for (name, ax, ay, w, h, n), (_, frames) in zip(placements, atlas_items):
    for i, f in enumerate(frames):
        atlas.paste(f, (ax + i * w, ay))
    meta["sprites"][name] = {"x": ax, "y": ay, "w": w, "h": h, "frames": n, "fps": FPS.get(name, FPS["default"])}
atlas.save(os.path.join(OUT, "spritesheet.png"))
with open(os.path.join(OUT, "spritesheet.json"), "w") as f:
    json.dump(meta, f, indent=2)
atlas.resize((MAXW * 3, AH * 3), Image.NEAREST).save(os.path.join(PREV, "_spritesheet_x3.png"))
print("OK", len(SPRITES), "sprites; atlas", MAXW, "x", AH)

# Copia de las coordenadas en JS (permite abrir el juego con doble clic, sin servidor)
os.makedirs(os.path.join(ROOT, "js"), exist_ok=True)
with open(os.path.join(ROOT, "js", "atlas.js"), "w") as f:
    f.write("// Generado por tools/generar_sprites.py - no editar a mano\nwindow.ATLAS = " + json.dumps(meta) + ";\n")
