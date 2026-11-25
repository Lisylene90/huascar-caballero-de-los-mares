/* =========================================================================
   HUÁSCAR: EL CABALLERO DE LOS MARES
   motor.js  ->  lienzo, utilidades, sprites, audio, partículas, teclado
   Autora: Lizbeth Huaman - UTP - Diseño y Desarrollo de Juegos Interactivos II
   ========================================================================= */
'use strict';

const W = 960, H = 540;
const canvas = document.getElementById('juego');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function ajustarPantalla() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', ajustarPantalla);
ajustarPantalla();

/* ---------------------------------------------------------------- utilidades */
const TAU = Math.PI * 2;
const U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  elegir: arr => arr[Math.floor(Math.random() * arr.length)],
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  angulo: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  difAng(a, b) {                 // diferencia más corta entre ángulos
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  },
};

/* ---------------------------------------------------------------- sprites */
const SPRITESHEET = new Image();
SPRITESHEET.src = 'assets/sprites/spritesheet.png';

function spr(nombre, frame, x, y, escala = 2, angulo = 0, alfa = 1) {
  const s = ATLAS.sprites[nombre];
  if (!s) return;
  const f = ((frame | 0) % s.frames + s.frames) % s.frames;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(Math.round(x), Math.round(y));
  if (angulo) ctx.rotate(angulo);
  ctx.drawImage(SPRITESHEET, s.x + f * s.w, s.y, s.w, s.h,
    -s.w * escala / 2, -s.h * escala / 2, s.w * escala, s.h * escala);
  ctx.restore();
}

/* ---------------------------------------------------------------- texto */
function texto(str, x, y, opt = {}) {
  const t = Object.assign({ tam: 16, color: '#fff', alin: 'left', fuente: 'mono', sombra: true, base: 'alphabetic', peso: 'bold' }, opt);
  const fam = t.fuente === 'serif' ? 'Georgia, "Times New Roman", serif' : '"Courier New", Courier, monospace';
  ctx.font = `${t.peso} ${t.tam}px ${fam}`;
  ctx.textAlign = t.alin;
  ctx.textBaseline = t.base;
  if (t.sombra) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(str, x + 2, y + 2);
  }
  ctx.fillStyle = t.color;
  ctx.fillText(str, x, y);
}

// Divide un texto largo en líneas que caben en un ancho
function partirTexto(str, ancho, tam, fuente = 'serif') {
  const fam = fuente === 'serif' ? 'Georgia, serif' : '"Courier New", monospace';
  ctx.font = `bold ${tam}px ${fam}`;
  const palabras = str.split(' ');
  const lineas = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      lineas.push(linea);
      linea = p;
    } else linea = prueba;
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function panel(x, y, w, h, color = 'rgba(10,16,32,0.82)', borde = '#c9a14a') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borde;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function barra(x, y, w, h, v, colorLleno, colorFondo = '#2a1d1d') {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = colorFondo;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colorLleno;
  ctx.fillRect(x, y, Math.max(0, w * U.clamp(v, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, Math.max(0, w * U.clamp(v, 0, 1)), Math.max(1, h / 3));
}

/* ---------------------------------------------------------------- audio */
const AUDIO = {
  nombres: ['canon', 'explosion', 'salpicadura', 'cargar', 'espolon', 'rescate', 'impacto', 'voz_ok', 'voz_no',
    'campana', 'victoria', 'derrota', 'musica_portada', 'musica_batalla', 'mar'],
  sonidos: {},
  musica: null,
  ambiente: null,
  silencio: false,
  cargar() {
    for (const n of this.nombres) {
      const a = new Audio('assets/audio/' + n + '.wav');
      a.preload = 'auto';
      this.sonidos[n] = a;
    }
  },
  sfx(n, vol = 1) {
    if (this.silencio || !this.sonidos[n]) return;
    const a = this.sonidos[n].cloneNode();
    a.volume = U.clamp(vol, 0, 1);
    a.play().catch(() => {});
  },
  tocarMusica(n, vol = 0.45) {
    if (this.musica && this.musica._n === n) return;
    this.pararMusica();
    const a = this.sonidos[n];
    if (!a) return;
    a.loop = true;
    a.volume = this.silencio ? 0 : vol;
    a._vol = vol;
    a._n = n;
    a.currentTime = 0;
    a.play().catch(() => {});
    this.musica = a;
  },
  pararMusica() {
    if (this.musica) { this.musica.pause(); this.musica = null; }
  },
  tocarAmbiente(on) {
    const a = this.sonidos.mar;
    if (!a) return;
    a.loop = true;
    a.volume = this.silencio ? 0 : 0.5;
    if (on) a.play().catch(() => {}); else a.pause();
  },
  alternarSilencio() {
    this.silencio = !this.silencio;
    if (this.musica) this.musica.volume = this.silencio ? 0 : this.musica._vol;
    this.sonidos.mar.volume = this.silencio ? 0 : 0.5;
  },
};
AUDIO.cargar();

/* ---------------------------------------------------------------- efectos (partículas y animaciones) */
const FX = {
  particulas: [],
  anims: [],
  textos: [],
  temblor: 0,
  destello: 0,
  colorDestello: '255,255,255',
  limpiar() { this.particulas = []; this.anims = []; this.textos = []; this.temblor = 0; this.destello = 0; },
  // tipo: 'humo' | 'fuego' | 'espuma' | 'chispa' | 'gota' | 'resto' | 'niebla' | 'burbuja'
  p(x, y, o = {}) {
    if (this.particulas.length > 900) return;
    this.particulas.push(Object.assign({
      x, y, vx: 0, vy: 0, t: 0, vida: 1, tam: 3, crece: 0, color: '#fff', tipo: 'humo', arrastre: 0.98, alfa: 1, grav: 0,
    }, o));
  },
  anim(nombre, x, y, escala = 3, fps) {
    const s = ATLAS.sprites[nombre];
    this.anims.push({ nombre, x, y, escala, t: 0, fps: fps || s.fps, frames: s.frames });
  },
  flotante(str, x, y, color = '#fff', tam = 16) {
    this.textos.push({ str, x, y, color, tam, t: 0, vida: 1.2 });
  },
  sacudir(f) { this.temblor = Math.max(this.temblor, f); },
  flash(f = 0.6, color = '255,255,255') { this.destello = Math.max(this.destello, f); this.colorDestello = color; },

  explosion(x, y, grande = false) {
    this.anim('explosion', x, y, grande ? 4 : 2.5);
    const n = grande ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = U.rand(40, grande ? 220 : 130);
      this.p(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: U.rand(0.3, 0.7), tam: U.rand(1.5, 3), color: U.elegir(['#ffcd75', '#fa7828', '#fff3b0']), tipo: 'chispa', arrastre: 0.9 });
    }
    for (let i = 0; i < (grande ? 10 : 4); i++) {
      this.p(x + U.rand(-10, 10), y + U.rand(-10, 10), { vx: U.rand(-15, 15), vy: U.rand(-15, 15), vida: U.rand(1.2, 2.2), tam: U.rand(6, 10), crece: 10, color: '#3a3a44', tipo: 'humo', alfa: 0.7 });
    }
    if (grande) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * TAU, v = U.rand(60, 160);
        this.p(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: U.rand(0.8, 1.4), tam: U.rand(2, 4), color: '#5b3a22', tipo: 'resto', arrastre: 0.94 });
      }
    }
  },
  salpicadura(x, y, grande = false) {
    this.anim('salpicadura', x, y, grande ? 4 : 3);
    for (let i = 0; i < (grande ? 14 : 7); i++) {
      const a = Math.random() * TAU, v = U.rand(30, 90);
      this.p(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: U.rand(0.3, 0.6), tam: U.rand(1.5, 3), color: '#e6f0ff', tipo: 'gota', arrastre: 0.92 });
    }
  },

  actualizar(dt) {
    for (const p of this.particulas) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.arrastre, dt * 60);
      p.vy *= Math.pow(p.arrastre, dt * 60);
      p.vy += p.grav * dt;
      p.tam += p.crece * dt;
    }
    this.particulas = this.particulas.filter(p => p.t < p.vida);
    for (const a of this.anims) a.t += dt;
    this.anims = this.anims.filter(a => a.t * a.fps < a.frames);
    for (const t of this.textos) { t.t += dt; t.y -= 30 * dt; }
    this.textos = this.textos.filter(t => t.t < t.vida);
    this.temblor = Math.max(0, this.temblor - dt * 18);
    this.destello = Math.max(0, this.destello - dt * 2.5);
  },
  dibujarDebajo() {      // estelas y espuma (bajo los barcos)
    for (const p of this.particulas) {
      if (p.tipo !== 'espuma' && p.tipo !== 'burbuja') continue;
      const k = 1 - p.t / p.vida;
      ctx.globalAlpha = k * p.alfa;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
    }
    ctx.globalAlpha = 1;
  },
  dibujarEncima() {
    for (const p of this.particulas) {
      if (p.tipo === 'espuma' || p.tipo === 'burbuja') continue;
      const k = 1 - p.t / p.vida;
      ctx.globalAlpha = Math.max(0, k * p.alfa);
      ctx.fillStyle = p.tipo === 'fuego' ? (k > 0.6 ? '#fff3b0' : k > 0.3 ? '#fa7828' : '#b8321e') : p.color;
      if (p.tipo === 'humo' || p.tipo === 'niebla' || p.tipo === 'fuego') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.tam), 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(Math.round(p.x - p.tam / 2), Math.round(p.y - p.tam / 2), Math.ceil(p.tam), Math.ceil(p.tam));
      }
    }
    ctx.globalAlpha = 1;
    for (const a of this.anims) spr(a.nombre, Math.floor(a.t * a.fps), a.x, a.y, a.escala);
    for (const t of this.textos) {
      ctx.globalAlpha = 1 - t.t / t.vida;
      texto(t.str, t.x, t.y, { tam: t.tam, color: t.color, alin: 'center' });
    }
    ctx.globalAlpha = 1;
  },
};

/* ---------------------------------------------------------------- teclado */
const TECLAS = {
  abajo: new Set(),
  oyentes: [],
  init() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.abajo.add(e.key.toLowerCase());
      for (const f of this.oyentes) f(e.key);
    });
    window.addEventListener('keyup', e => this.abajo.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.abajo.clear());
  },
  esta(k) { return this.abajo.has(k.toLowerCase()); },
};
TECLAS.init();

// frame de parpadeo para retratos (ojos cerrados un instante cada 3 s)
function parpadeo(desfase = 0) { return ((tiempoGlobal + desfase) % 3) < 0.15 ? 1 : 0; }

/* ---------------------------------------------------------------- fondo de mar */
let tiempoGlobal = 0;
function dibujarMar(desX = 0, desY = 0, tinte = null) {
  const s = ATLAS.sprites.agua;
  const esc = 3, tam = s.w * esc;
  const fr = Math.floor(tiempoGlobal * 3) % s.frames;
  const ox = ((desX % tam) + tam) % tam, oy = ((desY % tam) + tam) % tam;
  for (let y = -tam; y < H + tam; y += tam) {
    for (let x = -tam; x < W + tam; x += tam) {
      ctx.drawImage(SPRITESHEET, s.x + fr * s.w, s.y, s.w, s.h, Math.round(x + ox), Math.round(y + oy), tam, tam);
    }
  }
  if (tinte) {
    ctx.fillStyle = tinte;
    ctx.fillRect(0, 0, W, H);
  }
}
