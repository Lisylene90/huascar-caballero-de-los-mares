/* =========================================================================
   escenas.js  ->  Control general (G), HUD, escenas y bucle principal
   Escenas: Carga -> Portada -> Instrucciones -> Historia -> Juego -> Resultado
            -> (Nivel 2) -> Epílogo -> Créditos
   Autora: Lizbeth Huaman
   ========================================================================= */
'use strict';

const AUTORA = 'Lizbeth Huaman';

const G = {
  escena: null,
  modo: 1,                 // 1 = un jugador (ambos roles), 2 = cooperativo
  puntaje: 0,
  puntos: { timonel: 0, artillero: 0 },
  stats: null,
  fundido: 0,
  ultimaOrden: { timonel: null, artillero: null },
  pausa: false,

  reiniciarStats() {
    this.stats = { disparos: 0, aciertos: 0, espolonazos: 0, rescatados: 0, ordenesVoz: 0, ordenesTeclado: 0, coordinacion: 0, tiempo: 0 };
    this.puntosNivel = { timonel: 0, artillero: 0 };
  },
  cambiar(esc) {
    this.escena = esc;
    this.fundido = 1;
    this.pausa = false;
    if (esc.entrar) esc.entrar();
  },
  sumar(n, rol, x, y) {
    this.puntaje += n;
    this.puntos[rol] += n;
    if (this.puntosNivel) this.puntosNivel[rol] += n;
    if (x !== undefined) FX.flotante('+' + n, x, y, '#ffe08a', 15);
  },
  // todas las órdenes (voz o teclado) pasan por aquí
  comando(rol, cmd, palabra, fuente) {
    const e = this.escena;
    if (!e) return;
    if (rol === 'menu') {
      if (cmd === 'pausa' && e instanceof EscenaJuego) { this.pausa = true; return; }
      if (cmd === 'ok' && this.pausa) { this.pausa = false; return; }
      if (e.menu) e.menu(cmd, fuente);
      return;
    }
    if (!(e instanceof EscenaJuego) || this.pausa) return;
    const res = e.nivel.comando(rol, cmd);
    if (!res) return;
    if (fuente === 'voz') { this.stats.ordenesVoz++; AUDIO.sfx('voz_ok', 0.35); } else this.stats.ordenesTeclado++;
    const ahora = performance.now();
    this.ultimaOrden[rol] = { cmd, txt: res, t: ahora, fuente, palabra };
    // bonificación de coordinación (modo cooperativo): órdenes de ambos roles en menos de 1.2 s
    const otro = this.ultimaOrden[rol === 'timonel' ? 'artillero' : 'timonel'];
    if (this.modo === 2 && otro && ahora - otro.t < 1200 && !otro.combo) {
      this.stats.coordinacion++;
      this.ultimaOrden[rol].combo = true;
      const h = e.nivel.huascar;
      this.sumar(25, 'timonel'); this.sumar(25, 'artillero');
      FX.flotante('¡COORDINACIÓN! +50', h.x, h.y - 70, '#8fd3ff', 14);
    }
  },
};

/* ---------------------------------------------------------------- teclado -> órdenes */
const MAPA_TECLAS = {
  w: ['timonel', 'avante'], s: ['timonel', 'alto'], a: ['timonel', 'babor'], d: ['timonel', 'estribor'], x: ['timonel', 'vuelta'],
  arrowup: ['artillero', 'fuego'], arrowdown: ['artillero', 'cargar'], arrowleft: ['artillero', 'rescate'], arrowright: ['artillero', 'espolon'],
  ' ': ['artillero', 'fuego'], r: ['artillero', 'cargar'], f: ['artillero', 'espolon'], e: ['artillero', 'rescate'],
  enter: ['menu', 'ok'], '1': ['menu', 'uno'], '2': ['menu', 'dos'], escape: ['menu', 'menu'], p: ['menu', 'pausa'],
  i: ['menu', 'ayuda'], c: ['menu', 'creditos'],
};
TECLAS.oyentes.push(k => {
  const key = k.toLowerCase();
  if (G.escena instanceof EscenaCarga) { G.escena.comenzar(); return; }
  if (key === 'm') { AUDIO.alternarSilencio(); return; }
  if (key === 'p' && G.pausa) { G.pausa = false; return; }
  const m = MAPA_TECLAS[key];
  if (!m) return;
  // en modo cooperativo, A/D no se envían como orden única (se mantienen para girar) — igual se registran
  G.comando(m[0], m[1], key, 'teclado');
});
canvas.addEventListener('click', () => {
  if (G.escena instanceof EscenaCarga) G.escena.comenzar();
  else if (G.escena && G.escena.clic) G.escena.clic();
});
VOZ.alComando = (rol, cmd, palabra, fuente) => G.comando(rol, cmd, palabra, fuente);

/* ---------------------------------------------------------------- indicador de micrófono */
function dibujarMicrofono(x, y, alin = 'center') {
  let estado, color;
  if (!VOZ.soportado) { estado = 'VOZ NO DISPONIBLE · usa teclado'; color = '#ff9a6a'; }
  else if (VOZ.error) { estado = VOZ.error; color = '#ff9a6a'; }
  else if (VOZ.escuchando) { estado = 'MICRÓFONO ACTIVO · habla claro'; color = '#9fffa0'; }
  else { estado = 'Activando micrófono...'; color = '#ffd27a'; }
  const pul = VOZ.escuchando ? 0.6 + 0.4 * Math.sin(tiempoGlobal * 6) : 1;
  ctx.globalAlpha = pul;
  ctx.fillStyle = color;
  const tw = (ctx.font = 'bold 12px "Courier New", monospace', ctx.measureText(estado).width);
  const cx = alin === 'center' ? x - tw / 2 - 12 : x;
  ctx.beginPath(); ctx.arc(cx, y - 4, 5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  texto(estado, cx + 10, y, { tam: 12, color });
  if (VOZ.oido && performance.now() - VOZ.oidoT < 3500) {
    texto('Oído: "' + VOZ.oido + '"', alin === 'center' ? x : cx, y + 16, { tam: 12, color: '#cfe3ff', alin: alin === 'center' ? 'center' : 'left' });
  }
}

/* ---------------------------------------------------------------- escena: carga */
class EscenaCarga {
  comenzar() {
    if (!SPRITESHEET.complete) return;
    AUDIO.sfx('campana', 0.6);
    VOZ.iniciar();
    G.cambiar(new EscenaPortada());
  }
  actualizar() {}
  dibujar() {
    ctx.fillStyle = '#081426';
    ctx.fillRect(0, 0, W, H);
    if (!SPRITESHEET.complete) {
      texto('Cargando...', W / 2, H / 2, { tam: 20, alin: 'center' });
      return;
    }
    dibujarMar(tiempoGlobal * 8, 0, 'rgba(0,10,30,0.55)');
    texto('HUÁSCAR', W / 2, 200, { tam: 56, color: '#f0d18a', alin: 'center', fuente: 'serif' });
    const a = 0.5 + 0.5 * Math.sin(tiempoGlobal * 4);
    ctx.globalAlpha = a;
    texto('HAZ CLIC O PRESIONA UNA TECLA PARA COMENZAR', W / 2, 300, { tam: 18, alin: 'center' });
    ctx.globalAlpha = 1;
    texto('El navegador pedirá permiso para usar tu MICRÓFONO: elige "Permitir".', W / 2, 350, { tam: 14, alin: 'center', color: '#cfe3ff' });
    texto('Recomendado: Google Chrome o Microsoft Edge, con audífonos.', W / 2, 372, { tam: 14, alin: 'center', color: '#cfe3ff' });
  }
}

/* ---------------------------------------------------------------- escena: portada */
class EscenaPortada {
  constructor() { this.sel = G.modo - 1; this.bx = 160; this.t = 0; }
  entrar() { AUDIO.tocarMusica('musica_portada', 0.5); AUDIO.tocarAmbiente(true); FX.limpiar(); }
  menu(cmd) {
    if (cmd === 'uno') { this.sel = 0; this.elegir(); }
    else if (cmd === 'dos') { this.sel = 1; this.elegir(); }
    else if (cmd === 'ok') this.elegir();
    else if (cmd === 'ayuda') { G.modo = this.sel + 1; G.cambiar(new EscenaInstrucciones(false)); }
    else if (cmd === 'creditos') G.cambiar(new EscenaCreditos());
  }
  clic() { this.elegir(); }
  elegir() {
    G.modo = this.sel + 1;
    G.puntaje = 0;
    G.puntos = { timonel: 0, artillero: 0 };
    AUDIO.sfx('campana', 0.6);
    G.cambiar(new EscenaInstrucciones(true));
  }
  actualizar(dt) {
    this.t += dt;
    this.bx += dt * 40;
    if (this.bx > W + 200) this.bx = -200;
    if (TECLAS.esta('arrowleft') || TECLAS.esta('arrowup')) this.sel = 0;
    if (TECLAS.esta('arrowright') || TECLAS.esta('arrowdown')) this.sel = 1;
    FX.actualizar(dt);
    if (Math.random() < dt * 30) FX.p(this.bx - 120, 300 + U.rand(-6, 6), { tipo: 'espuma', color: '#e6f0ff', vida: 2, tam: U.rand(3, 6), alfa: 0.7 });
    if (Math.random() < dt * 14) FX.p(this.bx - 25, 300, { tipo: 'humo', color: '#25252c', vx: -20, vy: -20, vida: 2.5, tam: 6, crece: 12, alfa: 0.5 });
  }
  dibujar() {
    // cielo de atardecer sobre el mar
    dibujarMar(tiempoGlobal * 15, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(14,8,32,0.92)');
    g.addColorStop(0.45, 'rgba(90,30,40,0.55)');
    g.addColorStop(1, 'rgba(0,10,30,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sol
    ctx.fillStyle = 'rgba(255,190,110,0.25)';
    ctx.beginPath(); ctx.arc(870, 250, 60, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,140,0.5)';
    ctx.beginPath(); ctx.arc(870, 250, 38, 0, TAU); ctx.fill();
    FX.dibujarDebajo();
    spr('huascar', Math.floor(tiempoGlobal * 4), this.bx, 300, 6, 0);
    FX.dibujarEncima();
    // título
    texto('Basado en hechos reales · Guerra del Pacífico · 1879', W / 2, 70, { tam: 15, color: '#e8d6b0', alin: 'center', fuente: 'serif' });
    texto('HUÁSCAR', W / 2, 150, { tam: 92, color: '#f0d18a', alin: 'center', fuente: 'serif' });
    texto('El Caballero de los Mares', W / 2, 196, { tam: 30, color: '#ffffff', alin: 'center', fuente: 'serif' });
    // bandera peruana
    ctx.fillStyle = '#c8102e'; ctx.fillRect(W / 2 - 30, 210, 20, 8);
    ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 10, 210, 20, 8);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(W / 2 + 10, 210, 20, 8);
    // opciones
    const ops = ['1 JUGADOR', '2 JUGADORES · cooperativo'];
    for (let i = 0; i < 2; i++) {
      const x = W / 2 + (i === 0 ? -170 : 170), y = 395;
      const s = this.sel === i;
      panel(x - 150, y - 28, 300, 46, s ? 'rgba(120,80,20,0.85)' : 'rgba(10,16,32,0.7)', s ? '#ffd27a' : '#6a5a3a');
      texto(ops[i], x, y + 2, { tam: 18, alin: 'center', color: s ? '#fff' : '#cbb' });
    }
    texto('Di "UNO" o "DOS" · o usa las teclas 1 / 2 / ENTER', W / 2, 446, { tam: 15, alin: 'center', color: '#ffe7b0' });
    texto('"INSTRUCCIONES" (I) · "CRÉDITOS" (C) · M = silencio', W / 2, 466, { tam: 12, alin: 'center', color: '#b8c4d8' });
    dibujarMicrofono(W / 2, 494);
    // autora
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - 26, W, 26);
    texto(`Videojuego desarrollado por: ${AUTORA}`, 14, H - 8, { tam: 14, color: '#ffd27a' });
    texto('UTP · Diseño y Desarrollo de Juegos Interactivos II · 2026', W - 14, H - 8, { tam: 12, color: '#cfd8e0', alin: 'right' });
  }
}

/* ---------------------------------------------------------------- escena: instrucciones */
class EscenaInstrucciones {
  constructor(continuar) { this.continuar = continuar; }
  menu(cmd) { if (cmd === 'ok') this.seguir(); if (cmd === 'menu') G.cambiar(new EscenaPortada()); }
  clic() { this.seguir(); }
  seguir() {
    if (this.continuar) { G.puntaje = 0; G.cambiar(new EscenaHistoria(1)); }
    else G.cambiar(new EscenaPortada());
  }
  actualizar() {}
  dibujar() {
    dibujarMar(tiempoGlobal * 6, 0, 'rgba(5,10,25,0.75)');
    texto('CÓMO SE JUEGA', W / 2, 52, { tam: 30, color: '#f0d18a', alin: 'center', fuente: 'serif' });
    const sub = G.modo === 2
      ? 'Modo cooperativo: cada jugador da las órdenes de su puesto. ¡Coordínense para ganar puntos extra!'
      : 'Un jugador: das las órdenes de los dos puestos.';
    texto(sub, W / 2, 80, { tam: 14, color: '#fff', alin: 'center', fuente: 'serif' });
    const col = (x, rol, titulo, cmds, teclas) => {
      panel(x, 100, 420, 270);
      spr(rol, parpadeo(x), x + 40, 145, 4);
      texto(titulo, x + 80, 140, { tam: 20, color: '#ffd27a' });
      texto(teclas, x + 80, 162, { tam: 11, color: '#b8c4d8' });
      let y = 200;
      for (const [c, d] of cmds) {
        if (!c) continue;
        texto('"' + c + '"', x + 20, y, { tam: 17, color: '#fff' });
        texto(d, x + 170, y, { tam: 13, color: '#cfe3ff', fuente: 'serif' });
        y += 32;
      }
    };
    col(40, 'timonel', G.modo === 2 ? 'JUGADOR 1 · TIMONEL' : 'TIMONEL', [
      ['BABOR', 'girar 45° a la izquierda'], ['ESTRIBOR', 'girar 45° a la derecha'],
      ['AVANTE', 'más velocidad'], ['ALTO', 'detener máquinas'], ['MEDIA VUELTA', 'girar 180°']], 'Teclado: W A S D  ·  X = media vuelta');
    col(500, 'artillero', G.modo === 2 ? 'JUGADOR 2 · ARTILLERO' : 'ARTILLERO', [
      ['FUEGO', 'disparar la torre'], ['CARGAR', 'recargar los 2 cañones'],
      ['ESPOLÓN', 'embestir a toda máquina'], ['RESCATE', 'bajar un bote salvavidas'], ['', '']], 'Teclado: ↑fuego ↓cargar →espolón ←rescate');
    texto('La torre apunta sola al enemigo más cercano. Una orden a la vez, en voz alta y clara.', W / 2, 400, { tam: 14, color: '#ffe7b0', alin: 'center', fuente: 'serif' });
    texto('"PAUSA" o P para pausar · "CONTINUAR" para seguir', W / 2, 422, { tam: 13, color: '#b8c4d8', alin: 'center' });
    dibujarMicrofono(W / 2, 456);
    const a = 0.5 + 0.5 * Math.sin(tiempoGlobal * 4);
    ctx.globalAlpha = a;
    texto(this.continuar ? 'Di "ZARPAR" o presiona ENTER' : 'Di "CONTINUAR" o presiona ENTER', W / 2, 512, { tam: 20, alin: 'center', color: '#fff' });
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- escena: historia (antes de cada nivel) */
const HISTORIAS = {
  1: {
    titulo: 'Rada de Iquique · 21 de mayo de 1879',
    paginas: [
      'Abril de 1879. Comienza la Guerra del Pacífico entre Chile y la alianza del Perú y Bolivia. El control del mar es decisivo.',
      'El monitor Huáscar, al mando del capitán de navío Miguel Grau Seminario, llega a Iquique para romper el bloqueo del puerto. Allí lo enfrenta la corbeta Esmeralda, al mando del capitán Arturo Prat.',
      'Misión: embiste tres veces a la Esmeralda con el ESPOLÓN. Luego, como hizo Grau, rescata a los náufragos del barco enemigo.',
    ],
  },
  2: {
    titulo: 'Punta Angamos · 8 de octubre de 1879',
    paginas: [
      'Durante meses, el Huáscar burló a la escuadra chilena y protegió la costa peruana. Por su respeto al enemigo vencido, Grau fue llamado "el Caballero de los Mares".',
      'En la madrugada del 8 de octubre, frente a Punta Angamos, los blindados Cochrane y Blanco Encalada interceptan al Huáscar y a la corbeta Unión.',
      'Misión: atrae el fuego de los blindados hacia el Huáscar para que la Unión logre escapar. Resiste 90 segundos.',
    ],
  },
};

class EscenaHistoria {
  constructor(n) { this.n = n; this.pag = 0; this.t = 0; }
  entrar() { AUDIO.tocarMusica('musica_portada', 0.4); }
  menu(cmd) {
    if (cmd === 'ok') this.avanzar();
    if (cmd === 'menu') G.cambiar(new EscenaPortada());
  }
  clic() { this.avanzar(); }
  avanzar() {
    const h = HISTORIAS[this.n];
    const largo = h.paginas[this.pag].length;
    if (this.t * 45 < largo) { this.t = 999; return; }       // completar el texto
    if (this.pag < h.paginas.length - 1) { this.pag++; this.t = 0; return; }
    G.cambiar(new EscenaJuego(this.n));
  }
  actualizar(dt) { this.t += dt; }
  dibujar() {
    dibujarMar(tiempoGlobal * 6, 0, 'rgba(5,10,25,0.7)');
    const h = HISTORIAS[this.n];
    texto(`NIVEL ${this.n}`, W / 2, 70, { tam: 18, color: '#b8c4d8', alin: 'center' });
    texto(h.titulo, W / 2, 110, { tam: 32, color: '#f0d18a', alin: 'center', fuente: 'serif' });
    panel(80, 150, 800, 250, 'rgba(30,22,14,0.88)', '#c9a14a');
    spr('almirante', parpadeo(), 150, 230, 6);
    texto('Bitácora', 150, 300, { tam: 14, color: '#c9a14a', alin: 'center', fuente: 'serif' });
    const txt = h.paginas[this.pag].slice(0, Math.floor(this.t * 45));
    const lineas = partirTexto(txt, 620, 20, 'serif');
    lineas.forEach((l, i) => texto(l, 230, 195 + i * 30, { tam: 20, color: '#f4ead6', fuente: 'serif' }));
    texto(`${this.pag + 1} / ${h.paginas.length}`, 860, 390, { tam: 12, color: '#c9a14a', alin: 'right' });
    const a = 0.5 + 0.5 * Math.sin(tiempoGlobal * 4);
    ctx.globalAlpha = a;
    const ultima = this.pag === h.paginas.length - 1;
    texto(ultima ? 'Di "ZARPAR" o presiona ENTER para comenzar' : 'Di "CONTINUAR" o presiona ENTER', W / 2, 450, { tam: 18, alin: 'center' });
    ctx.globalAlpha = 1;
    dibujarMicrofono(W / 2, 495);
  }
}

/* ---------------------------------------------------------------- escena: juego */
class EscenaJuego {
  constructor(n) {
    this.n = n;
    FX.limpiar();
    G.reiniciarStats();
    G.ultimaOrden = { timonel: null, artillero: null };
    this.puntajeInicial = G.puntaje;
    this.nivel = n === 1 ? new Nivel1() : new Nivel2();
  }
  entrar() { AUDIO.tocarMusica('musica_batalla', 0.32); AUDIO.sfx('campana', 0.5); }
  menu(cmd) {
    if (cmd === 'menu') G.cambiar(new EscenaPortada());
  }
  actualizar(dt) {
    if (G.pausa) return;
    this.nivel.actualizar(dt);
    G.stats.tiempo += dt;
    FX.actualizar(dt);
    if (this.nivel.fin && this.nivel.finT > 3) {
      G.cambiar(new EscenaResultado(this.n, this.nivel.fin.gano, this.nivel.fin.motivo, this.puntajeInicial));
    }
  }
  dibujar() {
    ctx.save();
    if (FX.temblor > 0) ctx.translate(U.rand(-FX.temblor, FX.temblor), U.rand(-FX.temblor, FX.temblor));
    this.nivel.dibujar();
    ctx.restore();
    this.nivel.dibujarBitacora();
    this.nivel.dibujarBanner();
    // viñeta roja si el blindaje está bajo
    const h = this.nivel.huascar;
    if (h.hp < 30 && h.activo) {
      const a = (0.25 + 0.15 * Math.sin(tiempoGlobal * 6)) * (1 - h.hp / 30);
      const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${a + 0.2})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (FX.destello > 0) {
      ctx.fillStyle = `rgba(${FX.colorDestello},${FX.destello * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    dibujarHUD(this.nivel);
    if (G.pausa) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      texto('PAUSA', W / 2, 240, { tam: 48, alin: 'center', color: '#f0d18a', fuente: 'serif' });
      texto('Di "CONTINUAR" o presiona P · "MENÚ" o ESC para salir', W / 2, 290, { tam: 16, alin: 'center' });
    }
  }
}

function dibujarHUD(nivel) {
  const h = nivel.huascar;
  // barra superior
  ctx.fillStyle = 'rgba(8,12,24,0.88)';
  ctx.fillRect(0, 0, W, JUEGO_Y1);
  ctx.fillStyle = '#c9a14a';
  ctx.fillRect(0, JUEGO_Y1 - 2, W, 2);
  texto(nivel.nombre, 12, 26, { tam: 15, color: '#f0d18a', fuente: 'serif' });
  texto(nivel.objetivo, W / 2 + 40, 26, { tam: 14, color: '#fff', alin: 'center' });
  texto(`PUNTAJE ${String(G.puntaje).padStart(6, '0')}`, W - 12, 26, { tam: 15, color: '#ffe08a', alin: 'right' });

  // panel inferior
  const y0 = JUEGO_Y2;
  ctx.fillStyle = 'rgba(8,12,24,0.92)';
  ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = '#c9a14a';
  ctx.fillRect(0, y0, W, 2);
  const ahora = performance.now();
  const rolPanel = (x, rol, titulo, cmds, extra) => {
    const u = G.ultimaOrden[rol];
    const reciente = u && ahora - u.t < 1500;
    if (reciente) {
      ctx.fillStyle = `rgba(255,210,120,${0.25 * (1 - (ahora - u.t) / 1500)})`;
      ctx.fillRect(x, y0 + 2, 340, H - y0 - 2);
    }
    spr(rol, reciente ? 0 : parpadeo(x / 100), x + 26, y0 + 38, 3);
    texto(titulo, x + 52, y0 + 22, { tam: 13, color: '#ffd27a' });
    texto(cmds, x + 52, y0 + 40, { tam: 11, color: '#b8c4d8' });
    if (reciente) texto('» ' + u.txt + (u.fuente === 'voz' ? '  🎤' : '  ⌨'), x + 52, y0 + 60, { tam: 13, color: '#fff' });
    else extra && extra(x + 52, y0 + 60);
  };
  const j = G.modo === 2;
  rolPanel(6, 'timonel', j ? 'J1 · TIMONEL' : 'TIMONEL', 'BABOR·ESTRIBOR·AVANTE·ALTO', (x, y) => {
    texto('Máquinas: ' + ['ALTO', 'MEDIA', 'TODA'][h.marcha] + (h.espolonT > 0 ? ' · ¡ESPOLÓN!' : ''), x, y, { tam: 12, color: '#cfe3ff' });
  });
  rolPanel(W - 346, 'artillero', j ? 'J2 · ARTILLERO' : 'ARTILLERO', 'FUEGO·CARGAR·ESPOLÓN·RESCATE', (x, y) => {
    texto(h.cargando > 0 ? 'Cargando...' : h.cargados === 0 ? 'Sin carga: di CARGAR' : 'Torre lista', x, y, { tam: 12, color: h.cargados ? '#cfe3ff' : '#ff9a6a' });
  });
  // centro: blindaje, munición, espolón, micrófono
  const cx = W / 2 - 128;
  spr('icono_blindaje', 0, cx + 6, y0 + 16, 2);
  texto('BLINDAJE', cx + 18, y0 + 20, { tam: 11, color: '#cfd8e0' });
  barra(cx + 84, y0 + 11, 170, 9, h.hp / h.hpMax, h.hp > 50 ? '#5fd35f' : h.hp > 25 ? '#e0c050' : '#e05050');
  spr('icono_municion', 0, cx + 6, y0 + 34, 2);
  texto('CAÑONES', cx + 18, y0 + 38, { tam: 11, color: '#cfd8e0' });
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = i < h.cargados ? '#ffcd75' : '#3a2a2a';
    ctx.fillRect(cx + 84 + i * 22, y0 + 29, 18, 10);
  }
  if (h.cargando > 0) barra(cx + 132, y0 + 31, 122, 6, 1 - h.cargando / 1.4, '#ffcd75');
  texto('ESPOLÓN', cx + 18, y0 + 55, { tam: 11, color: '#cfd8e0' });
  barra(cx + 84, y0 + 47, 170, 6, 1 - h.espolonCD / 4, h.espolonCD > 0 ? '#887755' : '#ffd27a');
  if (nivel.union) {
    texto('UNIÓN', cx + 18, y0 + 71, { tam: 11, color: '#cfd8e0' });
    barra(cx + 84, y0 + 63, 170, 6, nivel.union.hp / nivel.union.hpMax, '#7fb8ff');
  } else if (nivel.fase === 'rescate') {
    texto('BOTES', cx + 18, y0 + 71, { tam: 11, color: '#cfd8e0' });
    texto(`${2 - nivel.botes.length}/2 libres`, cx + 84, y0 + 71, { tam: 11, color: '#9fffa0' });
  }
  // micrófono (arriba a la derecha de la zona de juego)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W - 330, JUEGO_Y1 + 4, 324, 38);
  dibujarMicrofono(W - 322, JUEGO_Y1 + 20, 'left');
}

/* ---------------------------------------------------------------- escena: resultado */
class EscenaResultado {
  constructor(n, gano, motivo, puntajeInicial) {
    Object.assign(this, { n, gano, motivo, puntajeInicial });
    this.s = Object.assign({}, G.stats);
    this.pn = Object.assign({}, G.puntosNivel);
    if (!gano) G.puntaje = puntajeInicial;      // al reintentar se descuenta lo ganado en el intento
  }
  entrar() { AUDIO.pararMusica(); AUDIO.sfx(this.gano ? 'victoria' : 'derrota', 0.7); }
  menu(cmd) {
    if (cmd === 'menu') return G.cambiar(new EscenaPortada());
    if (cmd === 'ok' || cmd === 'reintentar') {
      if (!this.gano) return G.cambiar(new EscenaJuego(this.n));
      if (this.n === 1) return G.cambiar(new EscenaHistoria(2));
      return G.cambiar(new EscenaEpilogo());
    }
  }
  clic() { this.menu('ok'); }
  actualizar() {}
  dibujar() {
    dibujarMar(tiempoGlobal * 6, 0, this.gano ? 'rgba(10,30,20,0.72)' : 'rgba(40,5,5,0.75)');
    texto(this.gano ? '¡MISIÓN CUMPLIDA!' : 'MISIÓN FALLIDA', W / 2, 80, { tam: 44, color: this.gano ? '#9fffa0' : '#ff8a7a', alin: 'center', fuente: 'serif' });
    partirTexto(this.motivo, 760, 17, 'serif').forEach((l, i) => texto(l, W / 2, 118 + i * 24, { tam: 17, color: '#fff', alin: 'center', fuente: 'serif' }));
    panel(170, 170, 620, 230);
    const s = this.s;
    const prec = s.disparos ? Math.round(s.aciertos / s.disparos * 100) : 0;
    const filas = [
      ['Tiempo de combate', `${Math.round(s.tiempo)} s`],
      ['Disparos / aciertos', `${s.disparos} / ${s.aciertos}  (${prec}%)`],
      ['Espolonazos', s.espolonazos],
      ['Náufragos rescatados', s.rescatados],
      ['Órdenes por voz / teclado', `${s.ordenesVoz} / ${s.ordenesTeclado}`],
    ];
    if (G.modo === 2) {
      filas.push(['Coordinaciones J1 + J2', s.coordinacion]);
      filas.push(['Puntos J1 Timonel / J2 Artillero', `${this.pn.timonel} / ${this.pn.artillero}`]);
    }
    filas.push(['PUNTAJE TOTAL', String(G.puntaje)]);
    filas.forEach(([a, b], i) => {
      texto(a, 200, 200 + i * 25, { tam: 15, color: i === filas.length - 1 ? '#ffe08a' : '#cfe3ff' });
      texto(String(b), 760, 200 + i * 25, { tam: 15, color: i === filas.length - 1 ? '#ffe08a' : '#fff', alin: 'right' });
    });
    const a = 0.5 + 0.5 * Math.sin(tiempoGlobal * 4);
    ctx.globalAlpha = a;
    const sig = this.gano ? (this.n === 1 ? 'Di "CONTINUAR" para el Nivel 2' : 'Di "CONTINUAR" para el epílogo') : 'Di "REINTENTAR" o presiona ENTER';
    texto(sig, W / 2, 450, { tam: 20, alin: 'center' });
    ctx.globalAlpha = 1;
    texto('"MENÚ" o ESC para volver a la portada', W / 2, 476, { tam: 13, alin: 'center', color: '#b8c4d8' });
    dibujarMicrofono(W / 2, 510);
  }
}

/* ---------------------------------------------------------------- escena: epílogo (impacto) */
const EPILOGO = [
  'En Angamos, la Unión logró escapar. El Huáscar combatió casi solo durante más de una hora.',
  'Un proyectil impactó en la torre de mando y el contraalmirante Miguel Grau murió en combate el 8 de octubre de 1879.',
  'Meses antes, tras el combate de Iquique, Grau había rescatado a los náufragos de la Esmeralda y escribió a Carmela Carvajal, viuda de Arturo Prat, para devolverle las pertenencias de su esposo.',
  'Por ese gesto fue llamado "el Caballero de los Mares". Hoy es héroe nacional del Perú y es respetado también en Chile.',
  'El honor y el respeto por la vida humana también se defienden en los momentos más difíciles.',
];

class EscenaEpilogo {
  constructor() { this.t = 0; this.pag = 0; }
  entrar() { AUDIO.tocarMusica('musica_portada', 0.45); FX.limpiar(); }
  menu(cmd) { if (cmd === 'ok') this.avanzar(); if (cmd === 'menu') G.cambiar(new EscenaPortada()); }
  clic() { this.avanzar(); }
  avanzar() {
    if (this.pag < EPILOGO.length - 1) { this.pag++; this.t = 0; }
    else G.cambiar(new EscenaCreditos());
  }
  actualizar(dt) {
    this.t += dt;
    if (this.t > 9) this.avanzar();
  }
  dibujar() {
    dibujarMar(tiempoGlobal * 4, 0, 'rgba(10,5,20,0.65)');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,140,60,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    spr('huascar', Math.floor(tiempoGlobal * 3), W / 2, 380, 5, 0, 0.85);
    texto('EL CABALLERO DE LOS MARES', W / 2, 70, { tam: 30, color: '#f0d18a', alin: 'center', fuente: 'serif' });
    const a = Math.min(1, this.t * 1.5);
    ctx.globalAlpha = a;
    partirTexto(EPILOGO[this.pag], 760, 22, 'serif').forEach((l, i) => texto(l, W / 2, 150 + i * 32, { tam: 22, color: '#fff', alin: 'center', fuente: 'serif' }));
    ctx.globalAlpha = 1;
    texto('Di "CONTINUAR" o presiona ENTER', W / 2, 500, { tam: 14, alin: 'center', color: '#cfd8e0' });
  }
}

/* ---------------------------------------------------------------- escena: créditos */
class EscenaCreditos {
  constructor() { this.t = 0; }
  entrar() { AUDIO.tocarMusica('musica_portada', 0.45); }
  menu(cmd) { if (cmd === 'ok' || cmd === 'menu') G.cambiar(new EscenaPortada()); }
  clic() { this.menu('ok'); }
  actualizar(dt) { this.t += dt; }
  dibujar() {
    dibujarMar(tiempoGlobal * 4, 0, 'rgba(5,10,25,0.8)');
    const lineas = [
      ['HUÁSCAR: EL CABALLERO DE LOS MARES', 30, '#f0d18a'],
      ['', 12],
      ['Diseño, programación, pixel art y sonido', 15, '#b8c4d8'],
      [AUTORA, 26, '#ffffff'],
      ['', 12],
      ['Universidad Tecnológica del Perú', 15, '#b8c4d8'],
      ['Diseño y Desarrollo de Juegos Interactivos II · 2026', 15, '#b8c4d8'],
      ['', 12],
      ['Tecnologías: JavaScript (Canvas 2D) · Web Speech API · Web Audio', 14, '#cfe3ff'],
      ['Gestión de calidad: ciclo PDCA y 14 puntos de W. Edwards Deming', 14, '#cfe3ff'],
      ['', 12],
      [`Puntaje final: ${G.puntaje}`, 20, '#ffe08a'],
      ['', 12],
      ['En memoria de los marinos peruanos y chilenos del combate naval de 1879.', 14, '#e8d6b0'],
    ];
    let y = 560 - Math.min(this.t * 40, 490);
    for (const [s, t, c] of lineas) {
      if (s) texto(s, W / 2, y, { tam: t, color: c, alin: 'center', fuente: 'serif' });
      y += t + 16;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, H - 30, W, 30);
    texto('Di "MENÚ" o presiona ENTER', W / 2, H - 10, { tam: 13, alin: 'center', color: '#cfd8e0' });
  }
}

/* ---------------------------------------------------------------- bucle principal */
G.cambiar(new EscenaCarga());
let ultimo = performance.now();
function bucle(ahora) {
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  tiempoGlobal += dt;
  G.escena.actualizar(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  G.escena.dibujar();
  if (G.fundido > 0) {
    ctx.fillStyle = `rgba(0,0,0,${G.fundido})`;
    ctx.fillRect(0, 0, W, H);
    G.fundido = Math.max(0, G.fundido - dt * 2.5);
  }
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);
