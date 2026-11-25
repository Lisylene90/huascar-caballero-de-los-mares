/* =========================================================================
   niveles.js  ->  Nivel 1 (Combate de Iquique) y Nivel 2 (Combate de Angamos)
   Autora: Lizbeth Huaman
   ========================================================================= */
'use strict';

const JUEGO_Y1 = 40, JUEGO_Y2 = 462;      // zona de juego entre el HUD superior e inferior

class NivelBase {
  constructor() {
    this.balas = [];
    this.barcos = [];
    this.t = 0;
    this.fin = null;          // {gano, motivo}
    this.finT = 0;
    this.objetivo = '';
    this.bitacora = [];       // mensajes históricos
    this.banner = null;
  }
  radio(txt, color = '#ffe7b0') {
    this.bitacora.push({ txt, t: 0, color });
    if (this.bitacora.length > 3) this.bitacora.shift();
  }
  mostrarBanner(titulo, sub = '', dur = 2.5, color = '#ffd27a') {
    this.banner = { titulo, sub, t: 0, dur, color };
  }
  terminar(gano, motivo) {
    if (this.fin) return;
    this.fin = { gano, motivo };
    this.finT = 0;
  }

  comando(rol, cmd) {
    const h = this.huascar;
    if (!h.activo || this.fin) return '';
    if (cmd === 'rescate') return this.rescatar ? this.rescatar() : 'No hay náufragos';
    return h.ordenar(cmd, this);
  }

  actualizarComun(dt) {
    this.t += dt;
    for (const b of this.barcos) {
      if (b === this.huascar) b.actualizar(dt, this);
      else b.mover(dt, b.sinLimite ? null : this.lim);
    }
    // balas
    for (const bala of this.balas) {
      bala.actualizar(dt);
      if (bala.muerta) continue;
      for (const b of this.barcos) {
        if (b.bando === bala.bando || !b.activo) continue;
        if (b.contiene(bala, 1)) {
          bala.muerta = true;
          this.impacto(b, bala);
          break;
        }
      }
    }
    this.balas = this.balas.filter(b => !b.muerta);
    // choques entre barcos
    const vivos = this.barcos.filter(b => b.activo);
    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) this.choque(vivos[i], vivos[j]);
    }
    for (const m of this.bitacora) m.t += dt;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.fin) this.finT += dt;
    // derrota si el Huáscar es destruido
    const h = this.huascar;
    if (h.activo && h.hp <= 0) {
      h.hundiendo = true;
      FX.explosion(h.x, h.y, true);
      AUDIO.sfx('explosion', 1);
      FX.sacudir(14);
      this.terminar(false, 'El Huáscar quedó fuera de combate.');
    }
  }

  impacto(barco, bala) {
    barco.hp -= bala.dano;
    barco.golpe = 0.3;
    FX.explosion(bala.x, bala.y, false);
    if (barco === this.huascar) {
      AUDIO.sfx('impacto', 0.8);
      FX.sacudir(7);
      FX.flash(0.35, '255,60,40');
      FX.flotante('-' + bala.dano, bala.x, bala.y - 10, '#ff7a6a', 14);
    } else if (bala.bando === 'peru') {
      AUDIO.sfx('explosion', 0.7);
      FX.sacudir(3);
      G.stats.aciertos++;
      G.sumar(100, 'artillero', bala.x, bala.y - 10);
    }
  }

  choque(a, b) {
    for (const ca of a.circulos()) {
      for (const cb of b.circulos()) {
        const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
        const sol = ca.r + cb.r - d;
        if (sol > 0 && d > 0.01) {
          const nx = (ca.x - cb.x) / d, ny = (ca.y - cb.y) / d;
          a.x += nx * sol * 0.5; a.y += ny * sol * 0.5;
          b.x -= nx * sol * 0.5; b.y -= ny * sol * 0.5;
          const h = this.huascar;
          const otro = a === h ? b : b === h ? a : null;
          if (otro && otro.bando !== 'peru') {
            if (h.espolonT > 0 && h.ramCD <= 0 && otro.contiene(h.proa(), 6)) {
              this.espolonazo(otro);
            } else if (h.choqueCD <= 0) {
              h.choqueCD = 1.2;
              h.hp -= 1;
              h.v *= 0.3;
              AUDIO.sfx('impacto', 0.4);
              FX.flotante('Usa "ESPOLÓN" para embestir', h.x, h.y - 40, '#ffd27a', 12);
            }
          }
          return;
        }
      }
    }
  }

  espolonazo(e) {
    const h = this.huascar;
    h.ramCD = 1.2;
    h.espolonT = 0;
    h.v = -40;
    h.hp -= 2;
    e.v *= 0.2;
    e.golpe = 0.6;
    const p = h.proa();
    FX.explosion(p.x, p.y, true);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU;
      FX.p(p.x, p.y, { tipo: 'resto', color: '#6b4426', vx: Math.cos(a) * U.rand(60, 180), vy: Math.sin(a) * U.rand(60, 180), vida: 1, tam: 3, arrastre: 0.92 });
    }
    AUDIO.sfx('espolon', 1);
    FX.sacudir(16);
    FX.flash(0.5);
    G.stats.espolonazos++;
    G.sumar(250, 'timonel', p.x, p.y - 30);
    G.sumar(250, 'artillero');
    this.alEspolonazo(e);
  }

  /* ----- dibujo común */
  dibujarEntidades() {
    FX.dibujarDebajo();
    if (this.naufragos) for (const n of this.naufragos) n.dibujar();
    for (const b of this.barcos) b.dibujar();
    if (this.botes) for (const b of this.botes) b.dibujar();
    this.huascar.dibujarMira();
    for (const b of this.balas) b.dibujar();
    FX.dibujarEncima();
    for (const b of this.barcos) b.dibujarVida();
  }

  dibujarBitacora() {
    let y = JUEGO_Y1 + 18;
    for (const m of this.bitacora.slice(-2)) {
      const a = (m.t < 7 ? 0.85 : Math.max(0, 0.85 - (m.t - 7)));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      for (const l of partirTexto(m.txt, 560, 13, 'serif')) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(8, y - 13, 574, 18);
        texto(l, 14, y, { tam: 13, color: m.color, fuente: 'serif' });
        y += 18;
      }
      y += 3;
    }
    ctx.globalAlpha = 1;
  }

  dibujarBanner() {
    const b = this.banner;
    if (!b) return;
    const a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 190, W, 90);
    texto(b.titulo, W / 2, 238, { tam: 34, color: b.color, alin: 'center', fuente: 'serif' });
    if (b.sub) texto(b.sub, W / 2, 266, { tam: 16, color: '#fff', alin: 'center', fuente: 'serif' });
    ctx.globalAlpha = 1;
  }
}

/* =========================================================================
   NIVEL 1: COMBATE DE IQUIQUE (21 de mayo de 1879)
   Objetivo A: embestir 3 veces a la Esmeralda con el espolón.
   Objetivo B: rescatar al menos 6 náufragos antes de 75 segundos.
   ========================================================================= */
class Nivel1 extends NivelBase {
  constructor() {
    super();
    this.numero = 1;
    this.nombre = 'NIVEL 1 · RADA DE IQUIQUE';
    this.costaX = 860;
    this.lim = { x1: 20, x2: this.costaX - 10, y1: JUEGO_Y1 + 10, y2: JUEGO_Y2 - 6 };
    this.huascar = new Huascar({ x: 110, y: 250, a: 0 });
    this.esmeralda = new Barco({ sprite: 'esmeralda', x: 700, y: 230, a: Math.PI / 2, aObj: Math.PI / 2, vmax: 22, v: 15, hp: 3, hpMax: 3, bando: 'chile', nombre: 'Esmeralda', giro: 0.5 });
    this.covadonga = new Barco({ sprite: 'covadonga', x: 770, y: 360, a: Math.PI / 2, aObj: Math.PI * 0.6, v: 45, hp: 999, hpMax: 999, bando: 'chile', nombre: 'Covadonga', sinLimite: true, sinObjetivo: true });
    this.barcos = [this.huascar, this.esmeralda, this.covadonga];
    this.botes = [];
    this.naufragos = [];
    this.fase = 'combate';
    this.rescatados = 0;
    this.meta = 6;
    this.tiempoRescate = 75;
    this.relojEsm = 3.5;
    this.relojCosta = 5;
    this.relojCova = 2;
    this.balasCanon = 0;
    this.danoHuascar = 12;
    this.objetivo = 'Embiste a la Esmeralda con el ESPOLÓN (0/3)';
    this.mostrarBanner('COMBATE DE IQUIQUE', '21 de mayo de 1879', 3);
    this.radio('El Huáscar, al mando de Miguel Grau, entra a la rada de Iquique.');
    this.radio('La corbeta Esmeralda, al mando de Arturo Prat, defiende el bloqueo del puerto.');
    // casas del puerto
    this.casas = [];
    for (let y = 70; y < 450; y += U.randi(26, 40)) {
      this.casas.push({ x: this.costaX + U.randi(30, 60), y, w: U.randi(18, 30), h: U.randi(14, 22), c: U.elegir(['#d9c8a6', '#c7a77c', '#e8dcc4', '#b98e6a']) });
    }
  }

  actualizar(dt) {
    this.actualizarComun(dt);
    const h = this.huascar, e = this.esmeralda, c = this.covadonga;
    // Covadonga: escapa hacia el sur disparando un par de veces
    if (!c.muerto) {
      c.v = 45;
      this.relojCova -= dt;
      if (this.relojCova < 0 && this.t < 8 && U.dist(c, h) < 600) {
        this.relojCova = 3;
        this.disparoEnemigo(c, h, 1, 4, 0.12);
      }
      if (c.y > H + 80) c.muerto = true;
    }
    if (this.fase === 'combate') {
      // Esmeralda: patrulla frente al puerto y dispara andanadas
      if (e.activo) {
        if (e.y < 120) e.aObj = Math.PI / 2;
        if (e.y > 380) e.aObj = -Math.PI / 2;
        e.v = U.lerp(e.v, e.vmax * (e.hp / 3), dt);
        e.x = U.lerp(e.x, 720, dt * 0.2);
        this.relojEsm -= dt;
        if (this.relojEsm <= 0 && U.dist(e, h) < 470) {
          this.relojEsm = U.rand(2.6, 3.6);
          this.disparoEnemigo(e, h, 3, 3, 0.2);
        }
      }
      // fusilería desde la costa
      this.relojCosta -= dt;
      if (this.relojCosta <= 0) {
        this.relojCosta = U.rand(4, 6);
        if (h.x > this.costaX - 360) {
          const o = { x: this.costaX + 8, y: U.rand(80, 430) };
          for (let i = 0; i < 4; i++) {
            const a = U.angulo(o, h) + U.rand(-0.12, 0.12);
            this.balas.push(new Bala(o.x, o.y + i * 4, a, 300, { dano: 1, alcance: 420, tipo: 'fusil' }));
            FX.p(o.x, o.y + i * 4, { tipo: 'humo', color: '#ddd', vida: 0.8, tam: 2, crece: 4, alfa: 0.6 });
          }
        }
      }
    } else if (this.fase === 'rescate' && !this.fin) {
      this.tiempoRescate -= dt;
      for (const n of this.naufragos) n.actualizar(dt, this.lim);
      for (const b of this.botes) b.actualizar(dt, h);
      for (const b of this.botes.filter(b => b.listo)) {
        this.rescatados++;
        G.stats.rescatados++;
        AUDIO.sfx('rescate', 0.8);
        G.sumar(125, 'timonel', h.x, h.y - 40);
        G.sumar(125, 'artillero');
        FX.flotante(`RESCATADOS ${this.rescatados}/${this.meta}`, h.x, h.y - 58, '#9fffa0', 15);
      }
      this.botes = this.botes.filter(b => !b.listo);
      this.objetivo = `Rescata náufragos: ${this.rescatados}/${this.meta}  ·  quedan ${Math.max(0, Math.ceil(this.tiempoRescate))} s`;
      const quedan = this.naufragos.filter(n => !n.rescatado).length;
      if (this.rescatados >= this.meta && (quedan === 0 || this.botes.length === 0)) {
        G.sumar(Math.ceil(this.tiempoRescate) * 20, 'timonel');
        this.terminar(true, `Rescataste a ${this.rescatados} marinos enemigos. Grau ordenó salvar a los náufragos de la Esmeralda.`);
      } else if (this.tiempoRescate <= 0) {
        if (this.rescatados >= this.meta) this.terminar(true, `Rescataste a ${this.rescatados} marinos de la Esmeralda.`);
        else this.terminar(false, `Solo rescataste ${this.rescatados} de ${this.meta} náufragos. ¡Cada vida cuenta!`);
      }
    }
    if (this.fin && this.fin.gano && this.finT < 0.1) AUDIO.sfx('campana', 0.6);
  }

  disparoEnemigo(desde, hacia, n, dano, disp) {
    for (let i = 0; i < n; i++) {
      const lado = (i % 2 ? 1 : -1);
      const p = desde.punto(U.rand(-desde.L * 0.3, desde.L * 0.3), lado * desde.B / 2);
      const t = U.dist(p, hacia) / 320;
      const pred = { x: hacia.x + Math.cos(hacia.a) * hacia.v * t * 0.7, y: hacia.y + Math.sin(hacia.a) * hacia.v * t * 0.7 };
      const a = U.angulo(p, pred) + U.rand(-disp, disp);
      this.balas.push(new Bala(p.x, p.y, a, 320, { dano, alcance: Math.min(520, U.dist(p, pred) + U.rand(-20, 70)), bando: 'chile' }));
      for (let k = 0; k < 6; k++) FX.p(p.x, p.y, { tipo: 'humo', color: '#cfcfcf', vx: Math.cos(a) * U.rand(10, 40), vy: Math.sin(a) * U.rand(10, 40), vida: 1.2, tam: 3, crece: 7, alfa: 0.55 });
    }
    AUDIO.sfx('canon', 0.45);
  }

  impacto(barco, bala) {
    if (barco === this.esmeralda && bala.bando === 'peru') {
      // los cañonazos no hunden a la Esmeralda: solo el espolón (como en la historia)
      barco.golpe = 0.3;
      FX.explosion(bala.x, bala.y);
      AUDIO.sfx('explosion', 0.6);
      G.stats.aciertos++;
      G.sumar(100, 'artillero', bala.x, bala.y - 10);
      this.balasCanon++;
      if (this.balasCanon === 3) this.radio('Los disparos no bastan para hundirla: ¡prepara el ESPOLÓN y embiste!', '#ffd27a');
      return;
    }
    super.impacto(barco, bala);
  }

  alEspolonazo(e) {
    if (e !== this.esmeralda) return;
    e.hp--;
    this.objetivo = `Embiste a la Esmeralda con el ESPOLÓN (${3 - e.hp}/3)`;
    if (e.hp === 2) {
      this.mostrarBanner('¡PRIMER ESPOLONAZO!', '', 1.8);
      this.radio('Primer espolonazo. Arturo Prat salta al abordaje del Huáscar y cae en cubierta.');
    } else if (e.hp === 1) {
      this.mostrarBanner('¡SEGUNDO ESPOLONAZO!', '', 1.8);
      this.radio('La Esmeralda sigue combatiendo con valor.');
    } else if (e.hp <= 0) {
      e.hundiendo = true;
      AUDIO.sfx('explosion', 1);
      this.mostrarBanner('LA ESMERALDA SE HUNDE', 'con su bandera izada', 3, '#ffffff');
      this.radio('Grau ordena arriar los botes y rescatar a los sobrevivientes. Di "RESCATE".', '#9fffa0');
      this.fase = 'rescate';
      this.balas = this.balas.filter(b => b.bando === 'peru');
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU, r = U.rand(60, 200);
        const n = new Naufrago(U.clamp(e.x + Math.cos(a) * r, 60, this.costaX - 40), U.clamp(e.y + Math.sin(a) * r, JUEGO_Y1 + 30, JUEGO_Y2 - 30));
        this.naufragos.push(n);
      }
      setTimeout(() => this.mostrarBanner('¡RESCATE!', `Salva al menos ${this.meta} náufragos · di "RESCATE" cerca de ellos`, 3.5, '#9fffa0'), 3200);
    }
  }

  rescatar() {
    if (this.fase !== 'rescate') {
      AUDIO.sfx('voz_no', 0.4);
      return 'Aún no hay náufragos';
    }
    if (this.botes.length >= 2) return 'Los dos botes ya están en el agua';
    const h = this.huascar;
    let mejor = null, md = 280;
    for (const n of this.naufragos) {
      if (n.asignado || n.rescatado) continue;
      const d = U.dist(n, h);
      if (d < md) { md = d; mejor = n; }
    }
    if (!mejor) {
      AUDIO.sfx('voz_no', 0.4);
      FX.flotante('Acércate más a los náufragos', h.x, h.y - 40, '#ffd27a', 13);
      return 'Nadie al alcance';
    }
    mejor.asignado = true;
    const lado = U.difAng(h.a, U.angulo(h, mejor)) > 0 ? 1 : -1;
    const p = h.punto(0, lado * 10);
    this.botes.push(new Bote(p.x, p.y, mejor));
    AUDIO.sfx('salpicadura', 0.5);
    return '¡Bote al agua!';
  }

  dibujarFondo() {
    dibujarMar(tiempoGlobal * 6, 0);
    // costa de Iquique
    const cx = this.costaX;
    ctx.fillStyle = '#d6ba82';
    ctx.fillRect(cx, 0, W - cx, H);
    for (let y = 0; y < H; y += 8) {
      const o = Math.sin(y * 0.11) * 4 + Math.sin(y * 0.031) * 6;
      ctx.fillStyle = '#e6f0ff';
      ctx.fillRect(cx - 6 + o + Math.sin(tiempoGlobal * 2 + y) * 2, y, 6, 8);
      ctx.fillStyle = '#b89c66';
      ctx.fillRect(cx + o, y, 10, 8);
    }
    for (const c of this.casas) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(c.x + 3, c.y + 3, c.w, c.h);
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#8a3b2a';
      ctx.fillRect(c.x, c.y, c.w, 4);
    }
    ctx.save();
    ctx.translate(this.costaX + 42, 300);
    ctx.rotate(-Math.PI / 2);
    texto('IQUIQUE', 0, 0, { tam: 18, color: '#5a3a1a', alin: 'center', fuente: 'serif', sombra: false });
    ctx.restore();
  }

  dibujar() {
    this.dibujarFondo();
    this.dibujarEntidades();
  }
}

/* =========================================================================
   NIVEL 2: COMBATE DE ANGAMOS (8 de octubre de 1879)
   Objetivo: atraer el fuego de los blindados Cochrane y Blanco Encalada
   para que la corbeta Unión logre escapar (resistir 90 segundos).
   ========================================================================= */
class Nivel2 extends NivelBase {
  constructor() {
    super();
    this.numero = 2;
    this.nombre = 'NIVEL 2 · PUNTA ANGAMOS';
    this.lim = { x1: 10, x2: W - 10, y1: JUEGO_Y1 + 10, y2: JUEGO_Y2 - 6 };
    this.punta = { x: W + 30, y: JUEGO_Y2 + 40, r: 190 };
    this.duracion = 90;
    this.huascar = new Huascar({ x: 260, y: 300, a: 0 });
    this.union = new Barco({ sprite: 'union', x: 70, y: 165, a: -0.05, v: 0, vmax: 10, hp: 60, hpMax: 60, bando: 'peru', nombre: 'Unión', giro: 0.4, sinLimite: true });
    this.cochrane = new Barco({ sprite: 'cochrane', x: -60, y: 380, a: 0, v: 40, vmax: 40, hp: 140, hpMax: 140, bando: 'chile', nombre: 'Cochrane', giro: 0.7, aggro: 0, reloj: 3, sinLimite: true });
    this.blanco = new Barco({ sprite: 'blanco', x: -80, y: 200, a: 0, v: 40, vmax: 36, hp: 140, hpMax: 140, bando: 'chile', nombre: 'Blanco Encalada', giro: 0.7, aggro: 0, reloj: 4, sinLimite: true, espera: 12 });
    this.enemigos = [this.cochrane, this.blanco];
    this.barcos = [this.union, this.huascar, this.cochrane];
    this.danoHuascar = 10;
    this.objetivo = 'Protege a la Unión: atrae el fuego enemigo';
    this.mostrarBanner('COMBATE DE ANGAMOS', '8 de octubre de 1879', 3);
    this.radio('Frente a Punta Angamos, la escuadra chilena intercepta al Huáscar y a la Unión.');
    this.radio('Grau decide combatir para que la Unión pueda escapar. Atrae el fuego: dispara a los blindados.');
  }

  actualizar(dt) {
    const h = this.huascar, u = this.union;
    // la Unión avanza hacia el norte (borde derecho) a lo largo de 90 s
    if (u.activo) {
      const avance = Math.min(1, this.t / this.duracion);
      const objX = U.lerp(70, W + 60, avance);
      u.v = U.clamp((objX - u.x) * 1.5 + 9, 0, 40);
      u.aObj = U.angulo(u, { x: u.x + 100, y: 165 + Math.sin(this.t * 0.1) * 25 });
    }
    // entrada del Blanco Encalada
    if (this.blanco.espera > 0) {
      this.blanco.espera -= dt;
      if (this.blanco.espera <= 0) {
        this.barcos.push(this.blanco);
        this.radio('¡Se une el Blanco Encalada! Dos blindados contra el Huáscar.', '#ff9a6a');
      }
    }
    this.actualizarComun(dt);
    // la punta de tierra: empujar a los barcos fuera
    for (const b of this.barcos) {
      const d = U.dist(b, this.punta);
      if (d < this.punta.r + 30) {
        const a = U.angulo(this.punta, b);
        b.x = this.punta.x + Math.cos(a) * (this.punta.r + 30);
        b.y = this.punta.y + Math.sin(a) * (this.punta.r + 30);
      }
    }
    // IA de los blindados
    for (const e of this.enemigos) {
      if (!this.barcos.includes(e) || !e.activo) continue;
      const dH = U.dist(e, h);
      if (dH < 240) e.aggro = Math.min(100, e.aggro + 7 * dt);
      e.aggro = Math.max(0, e.aggro - 6 * dt);
      const objetivo = (e.aggro > 25 || !u.activo || u.x > W - 20) ? h : u;
      e.objetivo = objetivo;
      if (e.retirada > 0) {
        e.retirada -= dt;
        e.aObj = U.angulo(e, { x: 30, y: U.clamp(e.y, JUEGO_Y1 + 60, JUEGO_Y2 - 60) });
        e.v = U.lerp(e.v, 30, dt);
        if (e.retirada <= 0) { e.hp = Math.min(e.hpMax, e.hp + 70); e.sinObjetivo = false; e.entro = false; this.radio(`El ${e.nombre} vuelve al combate.`, '#ff9a6a'); }
      } else {
        const d = U.dist(e, objetivo);
        let ang = U.angulo(e, objetivo);
        if (d < 200) ang += e.lado * Math.PI * 0.55;
        else if (d < 300) ang += e.lado * Math.PI * 0.35;
        e.aObj = ang;
        e.v = U.lerp(e.v, e.vmax, dt);
        if (e.x > 60) e.entro = true;
        e.x = U.clamp(e.x, e.entro ? 50 : -120, W - 40);
        e.y = U.clamp(e.y, JUEGO_Y1 + 20, JUEGO_Y2 - 20);
        if (e.hp < 35) {
          e.retirada = 8;
          e.sinObjetivo = true;
          this.radio(`El ${e.nombre} se retira dañado. ¡Ganaste tiempo para la Unión!`, '#9fffa0');
          G.sumar(300, 'artillero', e.x, e.y - 30);
        }
        e.reloj -= dt;
        if (e.reloj <= 0 && d < 480 && e.x > 0) {
          e.reloj = U.rand(3.0, 3.8) * (this.t > 60 ? 0.85 : 1);
          this.disparoEnemigo(e, objetivo);
        }
      }
    }
    // niebla y humo del combate
    if (Math.random() < dt * 1.2) FX.p(-60, U.rand(JUEGO_Y1, JUEGO_Y2), { tipo: 'niebla', color: '#cfd8e0', vx: U.rand(18, 30), vy: U.rand(-3, 3), vida: 45, tam: U.rand(50, 90), alfa: 0.05, arrastre: 1 });

    const resta = Math.max(0, this.duracion - this.t);
    this.objetivo = `Protege a la Unión · escape ${Math.floor(Math.min(1, this.t / this.duracion) * 100)}% · ${Math.ceil(resta)} s`;
    if (!this.fin) {
      if (!u.activo || u.hp <= 0) {
        if (u.activo) { u.hundiendo = true; FX.explosion(u.x, u.y, true); AUDIO.sfx('explosion', 1); }
        this.terminar(false, 'La Unión fue alcanzada. Debes atraer el fuego enemigo hacia el Huáscar.');
      } else if (this.t >= this.duracion && h.activo) {
        G.sumar(2000, 'timonel', W / 2, 200);
        G.sumar(Math.round(h.hp) * 10, 'artillero');
        this.terminar(true, 'La Unión logró escapar gracias al sacrificio del Huáscar.');
        this.mostrarBanner('¡LA UNIÓN ESCAPÓ!', 'Misión cumplida', 3, '#9fffa0');
        AUDIO.sfx('campana', 0.7);
      }
    }
  }

  disparoEnemigo(e, obj) {
    const lado = U.difAng(e.a, U.angulo(e, obj)) > 0 ? 1 : -1;
    const p = e.punto(U.rand(-6, 6), lado * e.B / 2);
    const t = U.dist(p, obj) / 330;
    const pred = { x: obj.x + Math.cos(obj.a) * obj.v * t * 0.6, y: obj.y + Math.sin(obj.a) * obj.v * t * 0.6 };
    const a = U.angulo(p, pred) + U.rand(-0.11, 0.11);
    this.balas.push(new Bala(p.x, p.y, a, 330, { dano: 4, alcance: Math.min(520, U.dist(p, pred) + U.rand(-25, 60)), bando: 'chile' }));
    for (let k = 0; k < 8; k++) FX.p(p.x, p.y, { tipo: 'humo', color: '#cfcfcf', vx: Math.cos(a) * U.rand(10, 50), vy: Math.sin(a) * U.rand(10, 50), vida: 1.4, tam: 3, crece: 8, alfa: 0.55 });
    AUDIO.sfx('canon', 0.5);
  }

  impacto(barco, bala) {
    super.impacto(barco, bala);
    if (barco.aggro !== undefined) barco.hp = Math.max(5, barco.hp);   // los blindados no se hunden
    if (bala.bando === 'peru' && barco.aggro !== undefined) {
      barco.aggro = Math.min(100, barco.aggro + 45);
      if (barco.aggro > 25 && !barco._avisado) {
        barco._avisado = true;
        FX.flotante(`¡El ${barco.nombre} te persigue!`, barco.x, barco.y - 40, '#ffd27a', 13);
      }
    }
    if (barco === this.union) {
      AUDIO.sfx('impacto', 0.5);
      FX.flotante('¡La Unión recibe fuego!', barco.x, barco.y - 30, '#ff7a6a', 13);
    }
  }

  alEspolonazo(e) {
    e.hp = Math.max(5, e.hp - 35);
    if (e.aggro !== undefined) e.aggro = 100;
    this.radio(`¡Espolonazo al ${e.nombre}!`, '#ffd27a');
  }

  dibujar() {
    dibujarMar(tiempoGlobal * 10, tiempoGlobal * 2, 'rgba(40,50,70,0.18)');
    // Punta Angamos
    const p = this.punta;
    ctx.fillStyle = '#e6f0ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 + Math.sin(tiempoGlobal * 2) * 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9ab74';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8f7a62';
    ctx.beginPath(); ctx.arc(p.x + 30, p.y + 30, p.r - 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6f5e4c';
    ctx.beginPath(); ctx.arc(p.x + 50, p.y + 50, p.r - 90, 0, TAU); ctx.fill();
    texto('PUNTA ANGAMOS', W - 95, JUEGO_Y2 - 70, { tam: 14, color: '#3a2a1a', alin: 'center', fuente: 'serif', sombra: false });
    // flecha de escape de la Unión
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tiempoGlobal * 4);
    texto('NORTE ➜ escape de la Unión', W - 16, JUEGO_Y1 + 22, { tam: 13, color: '#9fffa0', alin: 'right' });
    ctx.globalAlpha = 1;
    this.dibujarEntidades();
    // línea de amenaza enemiga
    for (const e of this.enemigos) {
      if (!this.barcos.includes(e) || !e.activo || !e.objetivo || e.retirada > 0) continue;
      if (e.objetivo === this.union) {
        ctx.strokeStyle = 'rgba(255,80,60,0.35)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(this.union.x, this.union.y); ctx.stroke();
        ctx.setLineDash([]);
        texto('¡apunta a la Unión!', e.x, e.y + 34, { tam: 11, color: '#ff8a7a', alin: 'center' });
      }
    }
  }
}
