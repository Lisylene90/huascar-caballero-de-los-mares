"""
Generador de sonidos y música (síntesis procedural) para
"Huáscar: El Caballero de los Mares" - Lizbeth Huaman

Crea archivos WAV en assets/audio/. Todo el audio es original, sintetizado con numpy.
Uso: python3 tools/generar_sonidos.py
"""
import os, wave
import numpy as np

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.005, d=0.3, curve=4.0):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-curve * x / max(d, 1e-4))
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def noise(d):
    return rng.uniform(-1, 1, int(SR * d))


def save(name, x, gain=0.9):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) or 1
    x = np.clip(x / m * gain, -1, 1)
    data = (x * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("  ", name, f"{len(x)/SR:.2f}s")


def tone(freq, d, kind="sine"):
    tt = t(d)
    ph = 2 * np.pi * freq * tt
    if kind == "sine":
        return np.sin(ph)
    if kind == "square":
        return np.sign(np.sin(ph)) * 0.6
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "saw":
        return 2 * (tt * freq % 1) - 1


# --- Efectos ---
d = 1.0
boom = lowpass(noise(d), 500) * env(int(SR * d), 0.002, 0.35, 3)
sub = np.sin(2 * np.pi * (70 * np.exp(-t(d) * 3)) * t(d)) * env(int(SR * d), 0.002, 0.4, 3)
crack = highpass(noise(d), 2000) * env(int(SR * d), 0.001, 0.04, 6)
save("canon", boom * 1.2 + sub * 0.9 + crack * 0.5)

d = 1.6
rumble = lowpass(noise(d), 300) * env(int(SR * d), 0.01, 0.8, 2.5)
mid = lowpass(noise(d), 1500) * env(int(SR * d), 0.002, 0.25, 4)
save("explosion", rumble * 1.5 + mid * 0.7 + np.sin(2 * np.pi * 45 * t(d)) * env(int(SR * d), 0.01, 0.6, 3))

d = 0.6
sp = highpass(lowpass(noise(d), 4000), 600) * env(int(SR * d), 0.01, 0.25, 4)
save("salpicadura", sp)

d = 0.5
clk = np.zeros(int(SR * d))
for k, at in enumerate((0.0, 0.18, 0.32)):
    i = int(at * SR)
    n = int(0.06 * SR)
    seg = (highpass(noise(0.06), 1500) * 0.6 + tone(900 + k * 300, 0.06, "square") * 0.4) * env(n, 0.001, 0.03, 5)
    clk[i:i + n] += seg[: len(clk) - i]
save("cargar", clk, 0.7)

d = 1.1
crash = lowpass(noise(d), 900) * env(int(SR * d), 0.002, 0.5, 3)
creak = tone(110, d, "saw") * np.sin(2 * np.pi * 7 * t(d)) * env(int(SR * d), 0.05, 0.6, 2.5)
save("espolon", crash * 1.2 + lowpass(creak, 800) * 0.6 + np.sin(2 * np.pi * 55 * t(d)) * env(int(SR * d), 0.002, 0.5, 3))

d = 0.9
bell = np.zeros(int(SR * d))
for k, f in enumerate((784, 988, 1175)):
    i = int(k * 0.11 * SR)
    n = len(bell) - i
    bell[i:] += (np.sin(2 * np.pi * f * t(n / SR)) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t(n / SR))) * env(n, 0.002, 0.5, 4)
save("rescate", bell, 0.6)

d = 0.7
clang = sum(np.sin(2 * np.pi * f * t(d)) for f in (320, 507, 811, 1290)) * env(int(SR * d), 0.001, 0.3, 4)
save("impacto", clang + lowpass(noise(d), 1200) * env(int(SR * d), 0.001, 0.08, 5) * 2, 0.8)

d = 0.15
save("voz_ok", tone(1320, d, "square") * env(int(SR * d), 0.002, 0.08, 5), 0.35)
save("voz_no", tone(220, 0.2, "square") * env(int(SR * 0.2), 0.002, 0.1, 5), 0.3)

d = 2.2
bellship = np.zeros(int(SR * d))
for at in (0.0, 0.35, 1.0, 1.35):
    i = int(at * SR)
    n = len(bellship) - i
    tt_ = t(n / SR)
    bellship[i:] += (np.sin(2 * np.pi * 660 * tt_) + 0.5 * np.sin(2 * np.pi * 1650 * tt_) + 0.25 * np.sin(2 * np.pi * 2480 * tt_)) * env(n, 0.002, 0.9, 3)
save("campana", bellship, 0.6)

NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def f(n):
    name, octv = n[:-1], int(n[-1])
    return NOTE[name] * 2 ** (octv - 4)


def seq(notes, bpm, kind="tri", vol=1.0, dec=0.5, total=None):
    beat = 60 / bpm
    dur = sum(b for _, b in notes) * beat
    out = np.zeros(int(SR * (total or dur)) + SR)
    pos = 0.0
    for n, b in notes:
        L = b * beat
        if n != "-":
            seg = tone(f(n), L * 1.05, kind) * env(int(SR * L * 1.05), 0.01, dec * L, 2.5)
            i = int(pos * SR)
            out[i:i + len(seg)] += seg * vol
        pos += L
    return out[: int(SR * (total or dur))]


def fanfare(notes, bpm):
    return seq(notes, bpm, "square", 0.5, 0.9) + seq([(n[:-1] + str(int(n[-1]) - 1) if n != "-" else n, b) for n, b in notes], bpm, "tri", 0.6, 0.9)


save("victoria", fanfare([("D4", .5), ("F4", .5), ("A4", .5), ("D5", 1.5), ("C5", .5), ("D5", 2)], 132), 0.6)
save("derrota", fanfare([("A4", 1), ("F4", 1), ("D4", 1), ("C#4", 1), ("D4", 3)], 70), 0.55)

# --- Música original (loops) ---
# Portada: himno solemne en Re menor, 72 bpm
bpm = 72
mel = [("D4", 1), ("F4", .5), ("G4", .5), ("A4", 1.5), ("A4", .5), ("A#4", 1), ("A4", .5), ("G4", .5), ("A4", 2),
       ("D5", 1), ("C5", .5), ("A#4", .5), ("A4", 1.5), ("G4", .5), ("F4", 1), ("E4", 1), ("D4", 2),
       ("F4", 1), ("G4", .5), ("A4", .5), ("C5", 1.5), ("A#4", .5), ("A4", 1), ("G4", 1), ("A4", 2),
       ("D5", 1), ("A4", 1), ("A#4", 1), ("G4", 1), ("A4", 1), ("E4", 1), ("D4", 2)]
bass = []
for ch in ["D2", "D2", "A#1", "A1", "D2", "A#1", "A1", "D2", "F2", "C2", "D2", "A1", "A#1", "G1", "A1", "D2"]:
    bass.append((ch, 2))
total = sum(b for _, b in mel) * 60 / bpm
m1 = seq(mel, bpm, "tri", 0.6, 0.9, total)
m2 = seq(bass, bpm, "sine", 0.7, 0.9, total)
pad = seq([(n[:-1] + str(int(n[-1]) + 1), b) for n, b in bass], bpm, "saw", 0.08, 1.2, total)
waves = lowpass(noise(total), 400) * (0.5 + 0.5 * np.sin(2 * np.pi * t(total) / 4)) * 0.25
save("musica_portada", m1 + m2 + lowpass(pad, 1200) + waves, 0.55)

# Batalla: ostinato 132 bpm con tambores
bpm = 132
beat = 60 / bpm
bars = 8
total = bars * 4 * beat
ost = []
for bar in range(bars):
    root = ["D3", "D3", "A#2", "C3", "D3", "D3", "A#2", "A2"][bar]
    fifth = {"D3": "A3", "A#2": "F3", "C3": "G3", "A2": "E3"}[root]
    ost += [(root, .5), (root, .5), (fifth, .5), (root, .5), (root, .5), (fifth, .5), (root[:-1] + str(int(root[-1]) + 1), .5), (fifth, .5)]
b1 = seq(ost, bpm, "square", 0.35, 0.4, total)
lead_notes = [("A4", 2), ("D5", 1), ("C5", 1), ("A#4", 2), ("A4", 2), ("G4", 1), ("A4", 1), ("A#4", 1), ("C5", 1), ("A4", 4),
              ("D5", 2), ("F5", 1), ("E5", 1), ("D5", 2), ("C5", 2), ("A#4", 1), ("A4", 1), ("G4", 1), ("E4", 1), ("D4", 4)]
lead = seq(lead_notes, bpm, "tri", 0.45, 0.8, total)
drums = np.zeros(int(SR * total))
for i in range(bars * 4):
    at = int(i * beat * SR)
    k = (np.sin(2 * np.pi * 60 * np.exp(-t(0.25) * 12) * t(0.25)) * env(int(SR * 0.25), 0.001, 0.15, 4))
    drums[at:at + len(k)] += k[: len(drums) - at] * (1.0 if i % 2 == 0 else 0.6)
    if i % 2 == 1:
        sn = highpass(noise(0.15), 1500) * env(int(SR * 0.15), 0.001, 0.06, 5)
        drums[at:at + len(sn)] += sn[: len(drums) - at] * 0.5
    hh = highpass(noise(0.04), 6000) * env(int(SR * 0.04), 0.001, 0.02, 5)
    at2 = int((i + 0.5) * beat * SR)
    drums[at2:at2 + len(hh)] += hh[: max(0, len(drums) - at2)] * 0.25
save("musica_batalla", b1 + lead + drums, 0.5)

# Mar ambiental
total = 8.0
waves = lowpass(noise(total), 600) * (0.6 + 0.4 * np.sin(2 * np.pi * t(total) / 4 - np.pi / 2))
save("mar", waves, 0.35)
print("Listo:", OUT)
