/* =========================================================================
   entidades.js  ->  Barcos, el Huáscar, balas, botes de rescate y náufragos
   Autora: Lizbeth Huaman
   ========================================================================= */
'use strict';

class Barco {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, a: 0, v: 0, aObj: null, giro: 1.0, vmax: 60, sprite: 'huascar', esc: 2,
      hp: 100, hpMax: 100, bando: 'peru', nombre: '', golpe: 0, hundir: 0, hundiendo: false, muerto: false,
      choqueCD: 0, lado: Math.random() < 0.5 ? 1 : -1,
    }, o);
    const s = ATLAS.sprites[this.sprite];
    this.L = s.w; this.B = s.h; this.fps = s.fps;
    if (this.aObj === null) this.aObj = this.a;
  }
  get activo() { return !this.muerto && !this.hundiendo; }
  // tres círculos a lo largo del casco para colisiones
  circulos() {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    const r = (this.B - 6) / 2 * this.esc + 3;
    return [-0.32, 0, 0.32].map(k => ({ x: this.x + c * k * this.L * this.esc, y: this.y + s * k * this.L * this.esc, r }));
  }
  punto(adelante, lateral = 0) {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    return { x: this.x + c * adelante * this.esc - s * lateral * this.esc, y: this.y + s * adelante * this.esc + c * lateral * this.esc };
  }
  proa() { return this.punto(this.L / 2 + 1); }
  contiene(p, margen = 0) {
    return this.circulos().some(c => Math.hypot(p.x - c.x, p.y - c.y) < c.r + margen);
  }
  mover(dt, lim) {
    if (this.hundiendo) {
      this.hundir += dt;
      this.v *= Math.pow(0.3, dt);
      this.x += Math.cos(this.a) * this.v * dt;
      this.y += Math.sin(this.a) * this.v * dt;
      if (Math.random() < dt * 25) FX.p(this.x + U.rand(-25, 25), this.y + U.rand(-8, 8), { tipo: 'burbuja', color: '#e6f0ff', vida: 1, tam: U.rand(2, 4), alfa: 0.8 });
      if (this.hundir < 1.4 && Math.random() < dt * 6) {
        const c = U.elegir(this.circulos());
        FX.explosion(c.x + U.rand(-8, 8), c.y + U.rand(-6, 6));
      }
      if (this.hundir > 3.5) this.muerto = true;
      return;
    }
    const d = U.difAng(this.a, this.aObj);
    const tasa = this.giro * (0.35 + 0.65 * Math.min(1, Math.abs(this.v) / 50));
    this.a += U.clamp(d, -tasa * dt, tasa * dt);
    this.x += Math.cos(this.a) * this.v * dt;
    this.y += Math.sin(this.a) * this.v * dt;
    if (lim) {
      const m = this.L * this.esc * 0.3;
      const x0 = this.x, y0 = this.y;
      this.x = U.clamp(this.x, lim.x1 + m, lim.x2 - m);
      this.y = U.clamp(this.y, lim.y1 + m * 0.5, lim.y2 - m * 0.5);
      if (x0 !== this.x || y0 !== this.y) this.v *= Math.pow(0.2, dt);
    }
    this.golpe = Math.max(0, this.golpe - dt);
    this.choqueCD = Math.max(0, this.choqueCD - dt);
    // estela de espuma
    const vel = Math.abs(this.v);
    if (vel > 8 && Math.random() < dt * vel / 4) {
      const p = this.punto(-this.L / 2, U.rand(-3, 3));
      FX.p(p.x, p.y, { tipo: 'espuma', color: '#e6f0ff', vida: U.rand(1.2, 2.2), tam: U.rand(2, 4), alfa: 0.75, vx: U.rand(-6, 6), vy: U.rand(-6, 6) });
    }
    if (vel > 30 && Math.random() < dt * vel / 8) {      // olas de proa
      const p = this.punto(this.L / 2 - 4, this.lado * (this.B / 2));
      FX.p(p.x, p.y, { tipo: 'espuma', color: '#ffffff', vida: 0.8, tam: 2, alfa: 0.9 });
    }
    // humo de la chimenea
    if (Math.random() < dt * 10) {
      const p = this.punto(-this.L * 0.1);
      FX.p(p.x, p.y, { tipo: 'humo', color: '#25252c', vx: 14 + U.rand(-4, 4), vy: -8 + U.rand(-4, 4), vida: U.rand(1.2, 2), tam: 2.5, crece: 5, alfa: 0.55 });
    }
    // fuego si está dañado
    if (this.hp < this.hpMax * 0.5 && Math.random() < dt * (this.hp < this.hpMax * 0.25 ? 30 : 12)) {
      const c = U.elegir(this.circulos());
      FX.p(c.x + U.rand(-6, 6), c.y + U.rand(-4, 4), { tipo: 'fuego', vx: U.rand(-5, 5) + 8, vy: U.rand(-20, -8), vida: U.rand(0.4, 0.8), tam: U.rand(2, 4), crece: -2 });
      if (Math.random() < 0.3) FX.p(c.x, c.y, { tipo: 'humo', color: '#1b1b20', vx: 15, vy: -12, vida: 1.8, tam: 3, crece: 6, alfa: 0.6 });
    }
  }
  dibujar() {
    if (this.muerto) return;
    const fr = Math.floor(tiempoGlobal * this.fps);
    const alfa = this.hundiendo ? Math.max(0, 1 - this.hundir / 3.5) : 1;
    // halo de agua alrededor del casco
    ctx.save();
    ctx.globalAlpha = 0.25 * alfa;
    ctx.fillStyle = '#0b2a4a';
    ctx.translate(this.x, this.y + 3);
    ctx.rotate(this.a);
    ctx.beginPath();
    ctx.ellipse(0, 0, this.L * this.esc / 2 + 2, this.B * this.esc / 2 - 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (this.golpe > 0 && Math.floor(this.golpe * 20) % 2 === 0) ctx.filter = 'brightness(2.2)';
    const esc = this.hundiendo ? this.esc * (1 - this.hundir * 0.06) : this.esc;
    spr(this.sprite, fr, this.x, this.y, esc, this.a, alfa);
    ctx.filter = 'none';
  }
  dibujarVida() {
    if (!this.activo || this.hpMax > 900) return;
    const w = 46;
    barra(this.x - w / 2, this.y - this.L * this.esc * 0.32 - 10, w, 4, this.hp / this.hpMax, this.bando === 'peru' ? '#5fd35f' : '#e05050');
    texto(this.nombre, this.x, this.y - this.L * this.esc * 0.32 - 14, { tam: 11, alin: 'center', color: '#fff' });
  }
}

/* ---------------------------------------------------------------- el Huáscar (controlado por los jugadores) */
class Huascar extends Barco {
  constructor(o) {
    super(Object.assign({ sprite: 'huascar', hp: 100, hpMax: 100, bando: 'peru', nombre: 'Huáscar', giro: 1.6 }, o));
    this.marcha = 1;                    // 0 = alto, 1 = media, 2 = toda máquina
    this.velMarchas = [0, 55, 95];
    this.torre = this.a;
    this.cargados = 2;                  // dos cañones Armstrong en la torre
    this.cargando = 0;
    this.espolonT = 0;
    this.espolonCD = 0;
    this.ramCD = 0;
    this.objetivo = null;
    this.retroceso = 0;
    this.v = 40;
  }

  ordenar(cmd, nivel) {
    switch (cmd) {
      case 'babor': this.aObj = this.a - Math.PI / 4; return 'Timón a babor';
      case 'estribor': this.aObj = this.a + Math.PI / 4; return 'Timón a estribor';
      case 'vuelta': this.aObj = this.a + Math.PI; return 'Media vuelta';
      case 'avante':
        this.marcha = Math.min(2, this.marcha + 1);
        return this.marcha === 2 ? 'Avante: ¡toda máquina!' : 'Avante: media máquina';
      case 'alto': this.marcha = 0; this.espolonT = 0; return 'Alto: máquinas detenidas';
      case 'cargar':
        if (this.cargados >= 2) return 'Cañones ya cargados';
        if (this.cargando > 0) return 'Cargando...';
        this.cargando = 1.4;
        AUDIO.sfx('cargar', 0.7);
        return 'Cargando cañones';
      case 'fuego': return this.disparar(nivel);
      case 'espolon':
        if (this.espolonCD > 0) { AUDIO.sfx('voz_no', 0.4); return 'Espolón no listo'; }
        this.espolonT = 1.7;
        this.espolonCD = 4;
        FX.sacudir(3);
        return '¡Espolón! ¡A embestir!';
    }
    return '';
  }

  disparar(nivel) {
    if (this.cargados <= 0) {
      AUDIO.sfx('voz_no', 0.5);
      FX.flotante('¡SIN CARGA! Di "CARGAR"', this.x, this.y - 40, '#ff9a6a', 14);
      return 'Sin carga';
    }
    this.cargados--;
    G.stats.disparos++;
    const p = this.punto(6 + 14, 0);
    const ang = this.torre + U.rand(-0.05, 0.05);
    const boca = { x: p.x + Math.cos(this.torre) * 6, y: p.y + Math.sin(this.torre) * 6 };
    nivel.balas.push(new Bala(boca.x, boca.y, ang, 430, { bando: 'peru', dano: nivel.danoHuascar || 12, alcance: 560, tipo: 'bala_fuego' }));
    for (let i = 0; i < 10; i++) {
      FX.p(boca.x, boca.y, { tipo: 'humo', color: '#d8d8d8', vx: Math.cos(ang) * U.rand(20, 70) + U.rand(-15, 15), vy: Math.sin(ang) * U.rand(20, 70) + U.rand(-15, 15), vida: U.rand(0.8, 1.6), tam: 3, crece: 9, alfa: 0.6 });
    }
    FX.p(boca.x, boca.y, { tipo: 'fuego', vida: 0.15, tam: 9, crece: -20 });
    AUDIO.sfx('canon', 0.9);
    FX.sacudir(5);
    this.retroceso = 0.2;
    return '¡Fuego!';
  }

  actualizar(dt, nivel) {
    if (this.activo) {
      // teclado: mantener A / D para girar de forma continua
      if (TECLAS.esta('a')) this.aObj = this.a - 0.6;
      if (TECLAS.esta('d')) this.aObj = this.a + 0.6;
      let vObj = this.velMarchas[this.marcha], k = 1.1;
      if (this.espolonT > 0) {
        this.espolonT -= dt;
        vObj = 180; k = 4;
        if (Math.random() < dt * 40) {
          const p = this.punto(this.L / 2, U.rand(-6, 6));
          FX.p(p.x, p.y, { tipo: 'espuma', color: '#fff', vida: 0.6, tam: 3, alfa: 1, vx: U.rand(-30, 30), vy: U.rand(-30, 30) });
        }
      }
      this.v = U.lerp(this.v, vObj, 1 - Math.exp(-dt * k));
      this.espolonCD = Math.max(0, this.espolonCD - dt);
      this.ramCD = Math.max(0, this.ramCD - dt);
      this.retroceso = Math.max(0, this.retroceso - dt);
      if (this.cargando > 0) {
        this.cargando -= dt;
        if (this.cargando <= 0) { this.cargados = 2; FX.flotante('CAÑONES LISTOS', this.x, this.y - 40, '#ffd27a', 13); }
      }
      // la torre apunta sola al enemigo más cercano (torre giratoria Coles)
      this.objetivo = null;
      let mejor = 1e9;
      for (const b of nivel.barcos) {
        if (b.bando === 'peru' || !b.activo || b.sinObjetivo) continue;
        const d = U.dist(this, b);
        if (d < mejor && d < 700) { mejor = d; this.objetivo = b; }
      }
      let aT = this.a;
      if (this.objetivo) {
        const o = this.objetivo, t = mejor / 430;
        aT = U.angulo(this, { x: o.x + Math.cos(o.a) * o.v * t, y: o.y + Math.sin(o.a) * o.v * t });
      }
      const d = U.difAng(this.torre, aT);
      this.torre += U.clamp(d, -2.4 * dt, 2.4 * dt);
    }
    this.mover(dt, nivel.lim);
  }

  dibujar() {
    super.dibujar();
    if (this.muerto || this.hundiendo) return;
    // torre giratoria con dos cañones
    const p = this.punto(6 - this.retroceso * 10, 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.torre);
    ctx.fillStyle = '#14161f';
    ctx.fillRect(4, -4, 14 - this.retroceso * 20, 3);
    ctx.fillRect(4, 1, 14 - this.retroceso * 20, 3);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4e607a';
    ctx.beginPath();
    ctx.arc(-1, -1, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.cargados > 0 ? '#ffcd75' : '#7a2a2a';
    ctx.fillRect(-2, -2, 3, 3);
    ctx.restore();
    // aura del espolón
    if (this.espolonT > 0) {
      const pr = this.proa();
      ctx.strokeStyle = `rgba(255,220,120,${0.5 + 0.5 * Math.sin(tiempoGlobal * 30)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 10, 0, TAU);
      ctx.stroke();
    }
  }

  dibujarMira() {
    if (!this.objetivo || !this.activo) return;
    const o = this.objetivo;
    const enRango = U.dist(this, o) < 560;
    ctx.strokeStyle = enRango ? 'rgba(255,210,120,0.9)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const r = 26 + Math.sin(tiempoGlobal * 6) * 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2 + tiempoGlobal;
      ctx.moveTo(o.x + Math.cos(a0) * r, o.y + Math.sin(a0) * r);
      ctx.arc(o.x, o.y, r, a0, a0 + 0.8);
    }
    ctx.stroke();
    // línea de tiro punteada
    const p = this.punto(6, 0);
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = 'rgba(255,230,160,0.35)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(this.torre) * 560, p.y + Math.sin(this.torre) * 560);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ---------------------------------------------------------------- balas */
class Bala {
  constructor(x, y, ang, vel, o = {}) {
    Object.assign(this, { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vel, recorrido: 0, alcance: 500, dano: 5, bando: 'chile', tipo: 'bala', muerta: false }, o);
  }
  actualizar(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.recorrido += this.vel * dt;
    if (this.tipo !== 'fusil' && Math.random() < dt * 30) {
      FX.p(this.x, this.y - this.altura(), { tipo: 'humo', color: '#bbb', vida: 0.35, tam: 1.5, crece: 3, alfa: 0.4 });
    }
    if (this.recorrido >= this.alcance) {
      this.muerta = true;
      FX.salpicadura(this.x, this.y, this.tipo !== 'fusil');
      if (this.tipo !== 'fusil') AUDIO.sfx('salpicadura', 0.35);
    }
  }
  altura() { return this.tipo === 'fusil' ? 0 : Math.sin(Math.min(1, this.recorrido / this.alcance) * Math.PI) * 16; }
  dibujar() {
    if (this.tipo === 'fusil') {
      ctx.fillStyle = '#ffe8a0';
      ctx.fillRect(this.x - 1, this.y - 1, 3, 3);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, 4, 2, 0, 0, TAU);
    ctx.fill();
    spr(this.tipo, Math.floor(tiempoGlobal * 12), this.x, this.y - this.altura(), 2);
  }
}

/* ---------------------------------------------------------------- náufragos y botes */
class Naufrago {
  constructor(x, y) {
    Object.assign(this, { x, y, vx: U.rand(-4, 4), vy: U.rand(-4, 4), fase: Math.random() * 4, asignado: false, rescatado: false });
  }
  actualizar(dt, lim) {
    this.x = U.clamp(this.x + this.vx * dt, lim.x1 + 10, lim.x2 - 10);
    this.y = U.clamp(this.y + this.vy * dt, lim.y1 + 10, lim.y2 - 10);
    if (Math.random() < dt * 2) FX.p(this.x + U.rand(-8, 8), this.y + 8, { tipo: 'espuma', color: '#e6f0ff', vida: 0.8, tam: 2, alfa: 0.6 });
  }
  dibujar() {
    if (this.rescatado) return;
    spr('naufrago', Math.floor(tiempoGlobal * 6 + this.fase), this.x, this.y, 3);
    if (!this.asignado) {
      const s = 0.5 + 0.5 * Math.sin(tiempoGlobal * 5 + this.fase);
      ctx.strokeStyle = `rgba(255,200,80,${0.3 + 0.5 * s})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 16 + s * 4, 0, TAU);
      ctx.stroke();
    }
  }
}

class Bote {
  constructor(x, y, objetivo) {
    Object.assign(this, { x, y, a: 0, objetivo, estado: 'ida', v: 140, listo: false, remo: 0 });
  }
  actualizar(dt, huascar) {
    const destino = this.estado === 'ida' ? this.objetivo : huascar;
    this.a = U.angulo(this, destino);
    this.x += Math.cos(this.a) * this.v * dt;
    this.y += Math.sin(this.a) * this.v * dt;
    this.remo += dt;
    if (Math.random() < dt * 20) FX.p(this.x - Math.cos(this.a) * 8, this.y - Math.sin(this.a) * 8, { tipo: 'espuma', color: '#fff', vida: 0.7, tam: 2, alfa: 0.7 });
    const d = U.dist(this, destino);
    if (this.estado === 'ida' && d < 8) {
      this.estado = 'vuelta';
      this.objetivo.rescatado = true;
      FX.salpicadura(this.x, this.y);
      FX.flotante('¡A BORDO!', this.x, this.y - 14, '#ffe08a', 12);
    } else if (this.estado === 'vuelta' && d < 26) {
      this.listo = true;
    }
  }
  dibujar() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    ctx.fillStyle = '#14161f';
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = '#8c5c36';
    ctx.fillRect(-8, -4, 16, 8);
    ctx.fillStyle = '#be925c';
    ctx.fillRect(-6, -2, 12, 4);
    // remos
    const r = Math.sin(this.remo * 10) * 3;
    ctx.fillStyle = '#e6d2a0';
    ctx.fillRect(-2 + r, -9, 2, 5);
    ctx.fillRect(-2 + r, 4, 2, 5);
    if (this.estado === 'vuelta') {
      ctx.fillStyle = '#e6b282';
      ctx.fillRect(2, -2, 3, 3);
    }
    ctx.restore();
  }
}
