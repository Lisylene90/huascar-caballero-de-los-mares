/* =========================================================================
   voz.js  ->  Control por voz con la Web Speech API (SpeechRecognition)
   Funciona en Google Chrome y Microsoft Edge, en https:// o localhost.
   Autora: Lizbeth Huaman
   ========================================================================= */
'use strict';

const VOZ = {
  soportado: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  rec: null,
  activo: false,        // queremos escuchar
  escuchando: false,    // el reconocedor está corriendo
  error: '',
  oido: '',             // último texto escuchado
  oidoT: 0,
  ultimoCmd: null,      // {rol, cmd, palabra, t}
  procesadas: {},       // índice de resultado -> nº de palabras ya procesadas
  alComando: null,      // función(rol, cmd, palabra)

  /* Diccionario de órdenes. Incluye sinónimos y errores típicos del reconocedor
     (por ejemplo "luego" o "juego" en lugar de "fuego"). */
  DICCIONARIO: {
    // ---- TIMONEL (jugador 1)
    babor: ['timonel', 'babor'], vabor: ['timonel', 'babor'], babur: ['timonel', 'babor'], vapor: ['timonel', 'babor'],
    'va por': ['timonel', 'babor'], izquierda: ['timonel', 'babor'],
    estribor: ['timonel', 'estribor'], estribo: ['timonel', 'estribor'], tribor: ['timonel', 'estribor'], derecha: ['timonel', 'estribor'],
    avante: ['timonel', 'avante'], avanti: ['timonel', 'avante'], adelante: ['timonel', 'avante'], avanza: ['timonel', 'avante'], avance: ['timonel', 'avante'], avant: ['timonel', 'avante'],
    alto: ['timonel', 'alto'], alta: ['timonel', 'alto'], para: ['timonel', 'alto'], pare: ['timonel', 'alto'], stop: ['timonel', 'alto'], detente: ['timonel', 'alto'],
    vuelta: ['timonel', 'vuelta'], 'media vuelta': ['timonel', 'vuelta'], gira: ['timonel', 'vuelta'],
    // ---- ARTILLERO (jugador 2)
    fuego: ['artillero', 'fuego'], fuegos: ['artillero', 'fuego'], luego: ['artillero', 'fuego'], juego: ['artillero', 'fuego'],
    dispara: ['artillero', 'fuego'], disparen: ['artillero', 'fuego'], disparo: ['artillero', 'fuego'], disparar: ['artillero', 'fuego'],
    cargar: ['artillero', 'cargar'], carga: ['artillero', 'cargar'], cargue: ['artillero', 'cargar'], carguen: ['artillero', 'cargar'],
    recarga: ['artillero', 'cargar'], recargar: ['artillero', 'cargar'], cargas: ['artillero', 'cargar'],
    rescate: ['artillero', 'rescate'], rescata: ['artillero', 'rescate'], rescatar: ['artillero', 'rescate'], rescaten: ['artillero', 'rescate'],
    salvar: ['artillero', 'rescate'], salven: ['artillero', 'rescate'], bote: ['artillero', 'rescate'], botes: ['artillero', 'rescate'],
    espolon: ['artillero', 'espolon'], espolones: ['artillero', 'espolon'], espanol: ['artillero', 'espolon'], embiste: ['artillero', 'espolon'],
    embestir: ['artillero', 'espolon'], espolin: ['artillero', 'espolon'], embestida: ['artillero', 'espolon'],
    // ---- MENÚS
    zarpar: ['menu', 'ok'], zarpa: ['menu', 'ok'], sarpar: ['menu', 'ok'], jugar: ['menu', 'ok'], comenzar: ['menu', 'ok'], empezar: ['menu', 'ok'],
    iniciar: ['menu', 'ok'], continuar: ['menu', 'ok'], siguiente: ['menu', 'ok'], listo: ['menu', 'ok'], listos: ['menu', 'ok'],
    uno: ['menu', 'uno'], un: ['menu', 'uno'], '1': ['menu', 'uno'], solo: ['menu', 'uno'],
    dos: ['menu', 'dos'], '2': ['menu', 'dos'], multijugador: ['menu', 'dos'],
    reintentar: ['menu', 'reintentar'], repetir: ['menu', 'reintentar'], otra: ['menu', 'reintentar'],
    menu: ['menu', 'menu'], salir: ['menu', 'menu'], inicio: ['menu', 'menu'],
    pausa: ['menu', 'pausa'], pausar: ['menu', 'pausa'],
    instrucciones: ['menu', 'ayuda'], ayuda: ['menu', 'ayuda'],
    creditos: ['menu', 'creditos'],
  },
  PREFIJOS: new Set(['va', 'media']),   // primeras palabras de órdenes de dos palabras

  normalizar(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  },

  iniciar() {
    if (!this.soportado) {
      this.error = 'Sin voz en este navegador: usa Chrome o Edge';
      return;
    }
    if (this.rec) { this.activo = true; this._arrancar(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'es-PE';
    rec.continuous = true;
    rec.interimResults = true;      // procesar mientras habla = respuesta más rápida
    rec.maxAlternatives = 1;
    rec.onstart = () => { this.escuchando = true; this.error = ''; };
    rec.onend = () => {
      this.escuchando = false;
      this.procesadas = {};
      if (this.activo) setTimeout(() => this._arrancar(), 150);   // Chrome corta tras un silencio: reiniciar
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.error = 'Micrófono bloqueado: permítelo en el candado de la barra';
        this.activo = false;
      } else if (e.error === 'no-speech' || e.error === 'aborted') {
        // normal: se reinicia solo
      } else if (e.error === 'network') {
        this.error = 'Sin internet: la voz de Chrome necesita conexión';
      } else {
        this.error = 'Voz: ' + e.error;
      }
    };
    rec.onresult = e => this._resultado(e);
    this.rec = rec;
    this.activo = true;
    this._arrancar();
  },

  _arrancar() {
    try { this.rec.start(); } catch (err) { /* ya estaba iniciado */ }
  },

  detener() {
    this.activo = false;
    if (this.rec) try { this.rec.stop(); } catch (err) {}
  },

  _resultado(e) {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = this.normalizar(r[0].transcript);
      if (!txt) continue;
      this.oido = txt.split(' ').slice(-6).join(' ');
      this.oidoT = performance.now();
      const palabras = txt.split(' ');
      let j = this.procesadas[i] || 0;
      while (j < palabras.length) {
        const p = palabras[j];
        const sig = palabras[j + 1];
        // orden de dos palabras ("media vuelta", "va por")
        if (this.PREFIJOS.has(p)) {
          if (sig === undefined && !r.isFinal) break;          // esperar la siguiente palabra
          if (sig !== undefined && this.DICCIONARIO[p + ' ' + sig]) {
            this._emitir(this.DICCIONARIO[p + ' ' + sig], p + ' ' + sig);
            j += 2;
            continue;
          }
        }
        if (this.DICCIONARIO[p]) this._emitir(this.DICCIONARIO[p], p);
        j++;
      }
      this.procesadas[i] = j;
    }
  },

  _emitir([rol, cmd], palabra) {
    this.ultimoCmd = { rol, cmd, palabra, t: performance.now() };
    if (this.alComando) this.alComando(rol, cmd, palabra, 'voz');
  },
};
