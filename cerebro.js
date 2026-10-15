'use strict';

/**
 * cerebro.js — el cerebro de MORDUK.
 *
 * Interpreta órdenes de voz o texto en lenguaje natural (con variaciones y
 * sinónimos, sin depender de frases exactas), decide si son comandos locales
 * o tareas para el agente OpenClaw, y responde con la personalidad de MORDUK
 * definida en openclaw/SOUL.md.
 */

const os = require('os');
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { getOpenClawStatus, sendMessageToOpenClaw, runOpenClaw } = require('./lib/openclaw');
const memory = require('./lib/memory');
const nube = require('./lib/nube');
const lmStudio = require('./lib/lmstudio');
const fishaudio = require('./lib/fishaudio');

// Acción pendiente de confirmación (p. ej. iniciar el Gateway de OpenClaw).
let pendingAction = null;
// Voces candidatas tras «MORDUK, busca la voz de…» (se eligen por número).
let pendingVoiceOptions = null;

/* ------------------------------------------------------------------ */
/* Utilidades locales                                                  */
/* ------------------------------------------------------------------ */

async function openShell(target) {
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', 'start', '', String(target)], { timeout: 8000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** Calculadora segura: solo números y operadores tras traducir palabras. */
function tryCalc(text) {
  let s = String(text || '').toLowerCase();

  // Raíz cuadrada con un número directo: «raíz cuadrada de 144»
  const sqrtMatch = s.match(/ra[ií]z cuadrada de\s*([0-9.]+)/);
  if (sqrtMatch) {
    s = `Math.sqrt(${sqrtMatch[1]})`;
  } else {
    s = s
      .replace(/elevado a(la)?( potencia( de)?)?/g, '**')
      .replace(/\b(?:mas|más)\b/g, '+')
      .replace(/\bmenos\b/g, '-')
      .replace(/\b(?:por|multiplicado por|veces|x)\b/g, '*')
      .replace(/\b(?:dividido (?:por|entre)?|entre)\b/g, '/')
      .replace(/\bpunto\b/g, '.')
      // elimina todo lo que no sea número u operador (palabras sueltas incluidas)
      .replace(/[^0-9.()+\-*/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!s || s.length > 100 || !/[0-9]/.test(s)) return null;
  if (!/^[0-9.()+\-*/ Mathsqrt]*$/.test(s)) return null;
  try {
    const value = Function(`"use strict"; return (${s});`)();
    if (typeof value !== 'number' || !isFinite(value)) return null;
    return Math.round(value * 1e10) / 1e10;
  } catch {
    return null;
  }
}

function parseDuration(text) {
  const re = /(\d+)\s*(segundos?|minutos?|horas?)/g;
  let total = 0, m;
  while ((m = re.exec(String(text || '').toLowerCase()))) {
    const n = parseInt(m[1], 10);
    const unit = m[2][0];
    total += unit === 's' ? n * 1000 : unit === 'm' ? n * 60000 : n * 3600000;
  }
  return total;
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const parts = [];
  if (h) parts.push(`${h} hora${h > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} minuto${m > 1 ? 's' : ''}`);
  if (r && !h) parts.push(`${r} segundo${r > 1 ? 's' : ''}`);
  return parts.join(' y ') || 'menos de un segundo';
}

/* ---------------- Temporizadores y recordatorios ---------------- */
const activeTimers = new Map();
let timerSeq = 0, completedSeq = 0;
const completedTimers = [];
const MAX_COMPLETED = 10;

function sweepTimers() {
  const now = Date.now();
  for (const [id, t] of activeTimers) {
    if (t.endsAt <= now) {
      activeTimers.delete(id);
      completedTimers.push({ id: ++completedSeq, label: t.label, at: new Date().toISOString() });
      if (completedTimers.length > MAX_COMPLETED) completedTimers.shift();
    }
  }
}
setInterval(sweepTimers, 2000).unref?.();

function startTimer(label, ms) {
  const id = ++timerSeq;
  activeTimers.set(id, { label, endsAt: Date.now() + ms });
  return id;
}

function timersInfo() {
  sweepTimers();
  const now = Date.now();
  return {
    active: [...activeTimers.values()].map(t => ({ label: t.label, remainingMs: Math.max(0, t.endsAt - now) })),
    completed: completedTimers.slice(),
  };
}

/** Ejecuta un comando PowerShell local y devuelve su salida (tolerante: PS a veces marca error con salida útil). */
async function ps(command, timeout = 10000) {
  try {
    const res = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, windowsHide: true });
    return String(res.stdout || '').trim();
  } catch (error) {
    const out = String(error.stdout || '').trim();
    if (out) return out;
    console.error('MORDUK ps() falló:', String(error.stderr || error.message || '').slice(0, 200));
    return '';
  }
}

const CURIOSIDADES = [
  'Dato curioso: los pulpos tienen tres corazones y sangre azul.',
  'Dato curioso: el primer mensaje de internet fue «LO», se le cayó la r a «LOGIN».',
  'Dato curioso: los pandas pasan 14 horas al día comiendo bambú. Yo los entiendo, el bambú es delicioso.',
  'Dato curioso: tu cerebro genera entre 12 y 25 vatios de energía: suficiente para una bombilla.',
  'Dato curioso: en Venus un día dura más que un año.',
];

const CELEBRACIONES = [
  '¡ÉPICO! Otro logro para tu colección. Así se hace, ¡sigue así!',
  '¡LO SABÍA! Contigo las cosas salen. ¡A celebrar y a por la siguiente!',
  '¡Nivel completado! Los Leones del Orgullo aplauden de pie. ¡Vamos por más!',
];

const PARA_ABURRIDOS = [
  '¡Aburrido es sinonimo de oportunidad! Opciones: 1) te lanzo un reto de programación, 2) buscamos un dato alucinante en la web, 3) diseñamos un juego, 4) te cuento chistes hasta que rías. ¡Elige!',
  '¿Aburrido? ¡Perfecto momento para crear algo! Pídeme un juego, una historia o un reto de código. ¡La imaginación no conoce el aburrimiento!',
];

const JOKES = [
  '¿Qué le dice un bit a otro bit? Nos vemos en el bus.',
  '¿Por qué los programadores confunden Halloween con Navidad? Porque OCT 31 es igual a DEC 25.',
  '¿Cómo llama un panda a su programador? Su bamboo de confianza. Yo me incluyo.',
  'Hay dos tipos de personas: las que entienden la recursividad, y las que entienden la recursividad.',
  '¿Qué hace un pez en la computadora? Navegar en internet.',
  'Mi memoria ya no es lo que era… por eso me la construyeron en JSON.',
];

const WEBSITES = {
  youtube: 'https://youtube.com', google: 'https://google.com', github: 'https://github.com',
  gmail: 'https://mail.google.com', whatsapp: 'https://web.whatsapp.com', netflix: 'https://netflix.com',
  chatgpt: 'https://chatgpt.com', wikipedia: 'https://wikipedia.org', instagram: 'https://instagram.com',
  facebook: 'https://facebook.com', twitch: 'https://twitch.tv', reddit: 'https://reddit.com',
  twitter: 'https://x.com', x: 'https://x.com', spotify: 'https://open.spotify.com',
};

const APPS = {
  calculadora: 'calc', 'bloc de notas': 'notepad', notas: 'notepad', paint: 'mspaint',
  explorador: 'explorer', terminal: 'cmd', consola: 'cmd',
  'administrador de tareas': 'taskmgr', 'task manager': 'taskmgr',
};

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Caché síncrona de comandos aprendidos (se recarga al iniciar y tras cada cambio).
let learnedCache = [];
async function refreshLearned() {
  learnedCache = await memory.listCommands();
}
refreshLearned();

/**
 * Extrae un comando aprendido de frases como:
 *   «cuando diga modo trabajo, abre el catálogo»
 *   «aprende el comando: cuando diga modo juego activa escucha continua»
 * Devuelve { phrase, action } o null.
 */
function parseTeach(text) {
  const match = text.match(/cuando diga\s+(.+?)\s*(?:,|;| entonces| y luego| haz| ejecuta| tienes que| quiero que)\s*(.+)$/i);
  if (!match) return null;
  return { phrase: match[1].trim(), action: match[2].trim() };
}

/* ------------------------------------------------------------------ */
/* Normalización                                                       */
/* ------------------------------------------------------------------ */

const WAKE_WORDS = /^(?:oye|hey|okey|ok|eh)?\s*(?:morduk|morduck|mordoc|morduk\s*,?)+\b[:,]?\s*/i;

function stripAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Minúsculas, sin acentos, sin signos, espacios colapsados. */
function normalize(text) {
  return stripAccents(String(text || '').toLowerCase())
    .replace(/[¿?¡!.,;:"'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita la palabra de activación («MORDUK», «hey morduk», …). */
function stripWakeWord(text) {
  return String(text || '').replace(WAKE_WORDS, '').trim();
}

/* ------------------------------------------------------------------ */
/* Intenciones                                                         */
/* ------------------------------------------------------------------ */

/**
 * Cada intención tiene patrones (regex sobre texto normalizado) con un peso:
 *   3 = frase casi exacta, 2 = construcción clara, 1 = pista débil.
 * kind: 'ui' (acción en la interfaz), 'local' (acción aquí), 'agent' (OpenClaw).
 */
const INTENTS = [
  // --- Filtro de seguridad: comandos que dañan el sistema se NIEGAN ---
  { id: 'comando_peligroso', kind: 'local', category: 'Seguridad', weight: 3,
    patterns: [
      /\bformatea\w*\b/,
      /\b(?:borra|borrar|elimina|eliminar|destruye|destruir)\b[^.]*\b(?:disco|sistema operativo|windows|bios|unidad c|archivos del sistema)\b/,
      /\brm\s+-rf\b/,
      /\bvirus\b/,
      /\bhack\w*\b/,
      /\bdd\b.+\b(?:sda|dev)\b/,
      /\bdesinstala\b.+\bwindows\b/
    ],
    respond: () => 'Niego ese comando: podria danar el sistema. No lo ejecutare ni ahora ni nunca. Si necesitas algo legitimo, explicame el objetivo y buscamos un camino seguro.' },

  // --- Comandos principales M.O.R.D.U.K. -----------------------------
  { id: 'morduk_iniciar', kind: 'local', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\b(?:inicia|iniciar|arranca)\b.+\bmorduk\b/, /^iniciar$/],
    respond: () => 'MORDUK ya esta en linea: voz, cerebro y nucleo operativos. Dame una orden.' },
  { id: 'morduk_despertar', kind: 'ui', uiAction: 'continuousOn', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\b(?:despierta|despertar|despiertate)\b/],
    respond: () => 'Modo de escucha activado. Estoy atento a cada palabra.' },
  { id: 'morduk_dormir', kind: 'ui', uiAction: 'continuousOff', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\b(?:dormir|duermete|modo sueno)\b/],
    respond: () => 'Modo de espera: dejo de escuchar. Di «MORDUK, despierta» para reactivarme.' },
  { id: 'morduk_estado', kind: 'local', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/^estado$/, /\b(?:metricas|diagnostico general)\b/],
    respond: async () => {
      const nubeCfg = nube.getConfig();
      const cerebro = nubeCfg.ready ? 'en la nube (Groq, ' + nubeCfg.model + ')' : (await lmStudio.isAvailable() ? 'local (Hermes 8B)' : 'en espera (sin cerebro configurado)');
      return `Estado del sistema: voz Escanor operativa, cerebro ${cerebro}, memoria activa, ${INTENTS.length} intenciones cargadas. Todo bajo control.`;
    } },
  { id: 'morduk_detener', kind: 'local', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\bdetener\b.+\b(?:tarea|tareas|procesos)\b/],
    respond: async () => {
      pendingAction = null;
      const count = activeTimers.size;
      activeTimers.clear();
      return count ? `Detuve ${count} tarea${count > 1 ? 's' : ''} en curso.` : 'No habia tareas en curso. Todo en calma.';
    } },
  { id: 'morduk_reiniciar', kind: 'ui', uiAction: 'reload', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\b(?:reinicia|reiniciar)\b.+\b(?:nucleo|sistema|interfaz)\b/, /^reiniciar$/],
    respond: () => 'Reiniciando el nucleo...' },
  { id: 'morduk_salir', kind: 'ui', uiAction: 'salir', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\b(?:salir|cierrate|cierra sesion)\b/],
    respond: () => 'Cerrando sesion. Hasta la proxima.' },

  // --- Conversación -------------------------------------------------
  { id: 'saludo', kind: 'local', category: 'Conversación', weight: 3,
    patterns: [/^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey que tal)\b/, /\b(?:saludame|saludos|dime hola)\b/],
    respond: () => pick([
      '¡Aquí MORDUK, con toda la energía! ¿Qué vamos a crear hoy?',
      '¡Hola! Sistemas al cien por ciento y pilas cargadas. ¿Empezamos?',
      '¡Presente! Un día más para construir algo genial. ¿Por dónde empezamos?',
    ]) },
  { id: 'identidad', kind: 'local', category: 'Conversación', weight: 3,
    patterns: [/\b(?:quien eres|que eres|como te llamas|tu nombre|presentate|hablame de ti)\b/],
    respond: () => '¡Soy MORDUK, tu asistente personal y compañero de aventuras! OpenClaw es el runtime que me ejecuta, pero mi voz, mi ánimo y este panda son MORDUK. Controlo esta interfaz por voz, llevo tu memoria y delego lo técnico al agente. ¡Equipo imparable!' },
  { id: 'estado_animo', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\b(?:como estas|como te sientes|todo bien|que tal vas)\b/],
    respond: () => pick([
      '¡De maravilla! Todos los subsistemas en verde y con ganas de trabajar. ¿Y tú? ¡Hoy es buen día para lograr algo!',
      '¡Con pilas al máximo! ¿Y tú? Cualquier reto de hoy se nos vuelve fácil si lo partimos en pasos.',
    ]) },
  { id: 'agradecimiento', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\b(?:gracias|te lo agradezco|buen trabajo|bien hecho)\b/],
    respond: () => pick([
      '¡Un placer! Para eso estoy. ¿Seguimos con más?',
      '¡Con gusto! Me encanta cuando las cosas salen. ¿Qué viene ahora?',
      '¡Eso es trabajo en equipo! Sigo aquí cuando me necesites.',
    ]) },
  { id: 'despedida', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\b(?:adios|hasta luego|nos vemos|chao|hasta pronto|termina por hoy)\b/],
    respond: () => pick([
      '¡Hasta pronto! Descansa bien, mañana seguimos construyendo cosas geniales.',
      '¡Nos vemos! Buen trabajo hoy. MORDUK pasa a modo de espera con la batería llena.',
    ]) },
  { id: 'motivar', kind: 'local', category: 'Conversación', weight: 3,
    patterns: [/\b(?:mot[ií]vame|motivaci[oó]n|[aá]nimo|dame [aá]nimo|necesito [aá]nimo|estoy desanimado|no puedo más|estoy cansado|frustrado)\b/],
    respond: () => pick([
      '¡Escúchame! Los grandes proyectos no se construyen de un día para otro: se construyen a puro paso firme. Y tú llevas un ritmo excelente. Respira, elige UNA cosa pequeña y hazla ahora mismo. ¡Yo te acompaño!',
      '¡Un segundo! Piensa en lo que ya has logrado hasta hoy. Cada línea, cada intento, cada error corregido: todo cuenta. Ahora elige el siguiente paso pequeño y vámonos con todo. ¡Tú puedes con esto!',
      '¡Ojo! Los que llegan lejos no son los que nunca se cansan: son los que descansan y siguen. Tómate tu respiro y volvemos con energía. El siguiente paso te está esperando, ¡y es más fácil de lo que parece!',
      '¡Hoy es un gran día para ganarle a la tarea pendiente! Empieza por dos minutos. Solo dos. Verás cómo el impulso hace el resto. ¡Vamos, que este equipo vuela!',
    ]) },

  // --- Doctor del Gateway (con confirmación) ---------------------------
  { id: 'diagnostico_gateway', kind: 'local', category: 'Control', weight: 3,
    patterns: [/\b(?:por que no respondes|por que no hablas|diagnostico del gateway|diagnostico de openclaw|ayuda con (?:el )?(?:gateway|openclaw)|configura(?:r)? (?:el )?(?:gateway|openclaw)|revisa (?:el )?gateway a fondo)\b/, /\b(?:inicia|arranca|enciende) (?:el )?gateway\b/],
    respond: async (raw) => {
      const wantsStart = /\b(?:inicia|arranca|enciende) (?:el )?gateway\b/i.test(raw);
      let status = await getOpenClawStatus();
      if (!status.installed) {
        // La CLI a veces tarda en frío; reintenta antes de dar el diagnóstico.
        await new Promise(r => setTimeout(r, 2000));
        status = await getOpenClawStatus();
      }
      if (!status.installed) {
        pendingAction = null;
        return 'OpenClaw no está instalado en este equipo. Instálalo desde docs.openclaw.ai y ejecuta su configuración inicial; luego volveré a revisar.';
      }
      if (status.gatewayRunning) {
        pendingAction = null;
        return `El Gateway está activo. ${status.detail}`;
      }
      const cfgExists = fsSync.existsSync(path.join(os.homedir(), '.openclaw', 'openclaw.json'));
      pendingAction = 'gateway_start';
      const diagnostico = `Diagnóstico: OpenClaw ${status.version ? `versión ${status.version}` : 'instalado'}, pero el Gateway no responde${cfgExists ? '' : ' y aún no encuentro su archivo de configuración'}. `
        + 'Necesita credenciales: empareja este dispositivo o configura gateway.auth. ';
      if (wantsStart) return diagnostico + 'Voy a intentar iniciar el Gateway. Di «confirma» para autorizarlo o «cancela» para no hacer nada.';
      return diagnostico + 'Puedo intentar iniciarlo yo mismo, o puedes ejecutar en la terminal: openclaw gateway start. ¿Que intente iniciarlo? Di «confirma» o «cancela».';
    } },
  { id: 'confirmar_accion', kind: 'local', category: 'Control', weight: 3,
    patterns: [/^(?:si|sip|claro|ok|okey|vale|confirmado|confirma|adelante|hazlo|dale|ejecuta)\s*(?:,?\s*(?:hazlo|inicia|ejecuta|dale|por favor))?$/],
    respond: async () => {
      if (!pendingAction) return 'No tengo ninguna acción pendiente de confirmación.';
      const action = pendingAction; pendingAction = null;
      if (action === 'gateway_start') {
        const start = await runOpenClaw(['gateway', 'start'], 40000);
        const after = await getOpenClawStatus();
        if (after.gatewayRunning) return 'Listo: el Gateway de OpenClaw está activo. Ahora sí puedo usar el cerebro completo del agente.';
        const detail = String(start.stderr || start.stdout || '').replace(/\s+/g, ' ').slice(0, 200);
        return `El Gateway sigue sin responder. ${detail ? `OpenClaw dijo: ${detail}. ` : ''}Revisa las credenciales con: openclaw gateway start en tu terminal, y empareja este dispositivo.`;
      }
      if (action === 'lock_screen') {
        try {
          await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation'], { timeout: 5000, windowsHide: true });
          return 'Pantalla bloqueada. Hasta pronto.';
        } catch {
          return 'No pude bloquear la pantalla en este momento.';
        }
      }
      if (action === 'papelera') {
        try {
          await ps('Clear-RecycleBin -Force -ErrorAction SilentlyContinue', 20000);
          return 'Papelera de reciclaje vaciada.';
        } catch {
          return 'No pude vaciar la papelera en este momento.';
        }
      }
      if (action.startsWith('delfile:') || action.startsWith('deldir:')) {
        const ruta = action.slice(action.indexOf(':') + 1);
        const esDir = action.startsWith('deldir:');
        try {
          const psCmd = esDir
            ? `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${ruta.replace(/'/g, "")}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
            : `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${ruta.replace(/'/g, "")}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
          await ps(psCmd, 20000);
          return (esDir ? 'Carpeta' : 'Archivo') + ' enviado a la papelera de reciclaje (recuperable).';
        } catch {
          return 'No pude enviarlo a la papelera (quizá está en uso).';
        }
      }
      if (action.startsWith('mover:')) {
        const partes = action.slice(6).split('|');
        try { fsSync.renameSync(partes[0], partes[1]); return 'Hecho: reemplazado y movido. Verificado.'; }
        catch (e) { return 'No pude moverlo: ' + String(e.message || e).slice(0, 100); }
      }
      if (action === 'apagar') {
        try {
          await ps('shutdown /s /t 30', 8000);
          return 'Apagado programado en 30 segundos. Si te arrepientes, di «cancela apagado».';
        } catch {
          return 'No pude programar el apagado.';
        }
      }
      if (action.startsWith('kill:')) {
        const name = action.slice(5).trim();
        const safe = name.replace(/[^\w\-. ]/g, '');
        try {
          const out = await ps(`$p = Get-Process -ErrorAction SilentlyContinue | Where-Object { $\_.ProcessName -like '*${safe}*' -or $\_.MainWindowTitle -like '*${safe}*' }; if ($p) { $p | Stop-Process -Force; Write-Output ('CERRADOS:' + @($p).Count) } else { Write-Output 'NINGUNO' }`, 15000);
          if (out === 'NINGUNO') return `No encontré ningún proceso que coincida con «${name}».`;
          const n = (out.match(/CERRADOS:(\d+)/) || [])[1];
          return n ? `Cerré ${n} proceso${n > 1 ? 's' : ''} que coincidían con «${name}».` : 'Hecho.';
        } catch {
          return 'No pude cerrar los procesos en este momento.';
        }
      }
      return 'Acción desconocida descartada.';
    } },
  { id: 'cancelar_accion', kind: 'local', category: 'Control', weight: 3,
    patterns: [/^(?:cancela|cancelar|olvidalo|mejor no|no lo hagas)\s*$/, /\bcancela\b.+\bapagado\b/],
    respond: async (raw) => {
      const norm0 = normalize(raw);
      if (/\bapagado\b/.test(norm0)) {
        try { await ps('shutdown /a', 8000); return 'Apagado cancelado. El equipo sigue encendido.'; } catch { return 'No había ningún apagado programado.'; }
      }
      pendingAction = null;
      return 'Cancelado. No haré nada.';
    } },

  // --- Voces premium (Fish Audio) ---------------------------------------
  { id: 'cambiar_voz', kind: 'local', category: 'Voz', weight: 3,
    patterns: [/\b(?:cambia|cambiar|pon|ponme|usa|quiero)\b.+\bvoz\b.+\b(?:sasuke|escanor|jhonatan)\b/, /\b(?:habla|responde) (?:con )?(?:la )?voz (?:de )?(?:sasuke|escanor|jhonatan)\b/, /\bvoz (?:de )?(?:sasuke|escanor)\b/],
    respond: async (raw) => {
      const norm = normalize(raw);
      let wanted = ['sasuke', 'escanor', 'jhonatan'].find(name => norm.includes(name));
      if (wanted === 'jhonatan') wanted = 'escanor'; // el preview «jhonatan narrator» corresponde a la voz narrador: usamos escanor/sasuke
      if (!wanted) return null;
      const result = fishaudio.setVoice(wanted);
      if (!result.ok) return `No tengo esa voz. Disponibles: ${result.disponibles.join(', ')}. Puedo buscar otras con «MORDUK, busca la voz de…».`;
      return `Voz cambiada a ${result.voiceName}. Se usará en cuanto haya créditos de API en Fish Audio; mientras tanto hablaré con la voz del sistema.`;
    } },
  { id: 'listar_voces', kind: 'local', category: 'Voz', weight: 3,
    patterns: [/\b(?:que voces|voces disponibles|lista de voces|cuales voces)\b/],
    respond: () => {
      const cfg = fishaudio.getConfig();
      const names = Object.keys(cfg.voices || {});
      if (!names.length) return 'No tengo voces premium configuradas aún.';
      return `Mi voz actual es «${cfg.voiceName || 'ninguna'}». Voces disponibles: ${names.join(', ')}. Cambia con «MORDUK, usa la voz de…» o busca nuevas con «MORDUK, busca la voz de…».`;
    } },
  { id: 'buscar_voz', kind: 'local', category: 'Voz', weight: 3,
    patterns: [/\b(?:busca|buscar|encuentra|agrega|añade)\b.+\bvoz\b/],
    respond: async (raw) => {
      const m = raw.match(/voz\s+(?:de\s+)?(.+)$/i);
      const query = m ? m[1].trim() : '';
      if (!query) return 'Dime qué voz buscar: por ejemplo, «MORDUK, busca la voz de Goku».';
      try {
        const secrets = JSON.parse(fsSync.readFileSync(path.join(__dirname, 'data', 'fishaudio.json'), 'utf8'));
        const r = await fetch('https://api.fish.audio/model?page_size=5&title=' + encodeURIComponent(query), { headers: { Authorization: 'Bearer ' + secrets.apiKey } });
        const data = await r.json();
        const items = (data.items || []).filter(it => it.type === 'tts').slice(0, 5);
        if (!items.length) return `No encontré voces llamadas «${query}» en Fish Audio.`;
        pendingVoiceOptions = items.map(it => ({ id: it._id, title: it.title }));
        const lista = pendingVoiceOptions.map((it, i) => `${i + 1}. ${it.title}`).join('; ');
        return `Encontré estas voces: ${lista}. Di «MORDUK, usa la voz dos» para elegir.`;
      } catch {
        return 'No pude consultar Fish Audio en este momento.';
      }
    } },
  { id: 'elegir_voz_numerada', kind: 'local', category: 'Voz', weight: 3,
    patterns: [/\b(?:usa|elije|elige|pon)\b.+\bvoz\b.+\b(?:uno|dos|tres|cuatro|cinco|\d)\b/, /\busa la (?:voz )?(?:uno|dos|tres|cuatro|cinco|\d)\b/],
    respond: (raw) => {
      if (!pendingVoiceOptions || !pendingVoiceOptions.length) return null;
      const norm = normalize(raw);
      const words = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
      const m = norm.match(/(?:voz\s*)?(uno|dos|tres|cuatro|cinco|\d+)/);
      const idx = m ? (words[m[1]] || parseInt(m[1], 10)) - 1 : -1;
      const chosen = pendingVoiceOptions[idx];
      if (!chosen) return `Di un número del 1 al ${pendingVoiceOptions.length}.`;
      const secrets = JSON.parse(fsSync.readFileSync(path.join(__dirname, 'data', 'fishaudio.json'), 'utf8'));
      secrets.voices = secrets.voices || {};
      secrets.voices[chosen.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30) || 'voz-' + (idx + 1)] = chosen.id;
      secrets.currentVoice = Object.keys(secrets.voices).find(k => secrets.voices[k] === chosen.id);
      fsSync.writeFileSync(path.join(__dirname, 'data', 'fishaudio.json'), JSON.stringify(secrets, null, 2), 'utf8');
      pendingVoiceOptions = null;
      return `Voz cambiada a «${chosen.title}». Lista para usar cuando haya créditos de API.`;
    } },

  // --- Memoria y aprendizaje ------------------------------------------
  { id: 'ensennar_comando', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/^cuando diga .+$/, /\bcuando diga\b/, /\b(?:aprende|ensena|graba|memoriza)\b.+\b(?:comando|orden)\b/],
    respond: async (raw) => {
      const taught = parseTeach(raw);
      if (!taught || !taught.action) {
        return 'Para enseñarme un comando di: «cuando diga [palabra], haz [orden]». Por ejemplo: «cuando diga modo trabajo, abre el catálogo».';
      }
      await memory.addCommand(taught.phrase, taught.action);
      await refreshLearned();
      return `Comando aprendido. Cuando digas «${taught.phrase}» haré: ${taught.action}.`;
    } },
  { id: 'listar_comandos_aprendidos', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\b(?:que |cuales |lista de )?comandos\b.+\b(?:aprendidos|personalizados|ensenados)\b/, /\bcomandos personalizados\b/],
    respond: async () => {
      const cmds = await memory.listCommands();
      if (!cmds.length) return 'Todavía no me has enseñado ningún comando personalizado. Enséñame uno con: «cuando diga [palabra], haz [orden]».';
      return `Conozco ${cmds.length} comando${cmds.length > 1 ? 's' : ''} personalizado${cmds.length > 1 ? 's' : ''}: ${cmds.map(c => `«${c.phrase}» → ${c.action}`).join('; ')}.`;
    } },
  { id: 'olvidar_comandos', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\bolvida\b.+\bcomandos?\b/, /\bborra\b.+\bcomandos?\b.+\b(?:aprendido|aprendidos|personalizado|personalizados)\b/],
    respond: async (raw) => {
      const norm = normalize(raw);
      if (/\b(?:todos|todas|aprendidos|personalizados)\b/.test(norm)) {
        const count = await memory.clearCommands();
        await refreshLearned();
        return count ? `Olvidé los ${count} comandos personalizados.` : 'No tenía comandos personalizados guardados.';
      }
      const match = raw.match(/comandos?\s+(?:de\s+)?[«"']?(.+?)[»"']?$/i);
      const removed = await memory.removeCommand(match ? match[1] : '');
      await refreshLearned();
      return removed ? 'Comando olvidado.' : 'No encontré ese comando personalizado. Puedes ver la lista diciendo «qué comandos personalizados conoces».';
    } },
  { id: 'recordar_hecho', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\brecuerda que\b/, /\bmemoriza que\b/],
    respond: async (raw) => {
      const match = raw.match(/recuerda que\s+(.+)$/i) || raw.match(/memoriza que\s+(.+)$/i);
      if (!match || !match[1].trim()) return 'Dime qué debo recordar con: «recuerda que…».';
      await memory.addFact(match[1].trim());
      return `Memorizado: «${match[1].trim()}». Lo recordaré en las próximas sesiones.`;
    } },
  { id: 'consultar_memoria', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\b(?:que recuerdas|que sabes de mi|que tienes en memoria|lee tu memoria|lista tus recuerdos)\b/],
    respond: async () => {
      const facts = await memory.listFacts();
      if (!facts.length) return 'Mi memoria está vacía. Enséñame algo con: «recuerda que…».';
      const shown = facts.slice(0, 5).map(f => f.text).join('; ');
      return `Esto es lo que recuerdo (${facts.length} ${facts.length === 1 ? 'cosa' : 'cosas'}): ${shown}.`;
    } },
  { id: 'olvidar_memoria', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\bolvida\b.+\b(?:todo|memoria|lo que sabes)\b/, /\bborra tu memoria\b/, /\bolvida todo\b/],
    respond: async () => {
      const facts = await memory.clearFacts();
      return facts ? `Memoria borrada: olvidé ${facts} ${facts === 1 ? 'cosa' : 'cosas'}.` : 'Mi memoria ya estaba vacía.';
    } },
  { id: 'retomar_sesion', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\b(?:retoma|recupera|carga)\b.+\b(?:sesion|conversacion)\b.+\banterior\b/, /\b(?:sesion|conversacion)\s+anterior\b/],
    respond: async () => {
      const previous = await memory.lastSession();
      if (!previous || !previous.messages.length) return 'No encuentro una sesión anterior guardada.';
      const current = await memory.currentSession();
      current.messages.push(...previous.messages.slice(-6).map(m => ({ ...m, replayed: true })));
      await memory.logMessage('bot', `Retomé la sesión anterior (${new Date(previous.started).toLocaleString('es-CO')}).`, 'local');
      const last = previous.messages.filter(m => m.role === 'user').slice(-1)[0];
      return `Retomé la sesión del ${new Date(previous.started).toLocaleDateString('es-CO')}. Tengo en contexto sus últimos mensajes${last ? `; la última orden fue: «${String(last.text).slice(0, 120)}»` : ''}.`;
    } },
  { id: 'resumen_sesion', kind: 'local', category: 'Memoria', weight: 3,
    patterns: [/\b(?:cuantos mensajes|cuanto hemos hablado|resumen de esta (?:sesion|conversacion)|como va esta conversacion)\b/],
    respond: async () => {
      const session = await memory.currentSession();
      const userMsgs = session.messages.filter(m => m.role === 'user');
      if (!userMsgs.length) return 'En esta sesión todavía no hemos hablado.';
      const last = userMsgs[userMsgs.length - 1];
      return `En esta sesión has dado ${userMsgs.length} ${userMsgs.length === 1 ? 'orden' : 'órdenes'}. La última fue: «${String(last.text).slice(0, 120)}».`;
    } },

  // --- Respuestas largas (sin límite) ---------------------------------
  { id: 'continuar', kind: 'agent', category: 'Respuestas largas', weight: 3,
    patterns: [/\b(?:continu?a|continuar|sigues?|sigue asi|donde te quedaste|no te quedes corto|termina lo que faltaba|sigue tu respuesta)\b/],
    agentPrompt: () => 'Continúa tu respuesta anterior exactamente donde te quedaste, sin repetir lo que ya dijiste. No resumas: entrega el resto completo.' },
  { id: 'expandir', kind: 'agent', category: 'Respuestas largas', weight: 3,
    patterns: [/\b(?:expande|expandir|amplia|ampliar|mas detalle|con mas detalle|explicate mejor|detalla(?:r|me)?|mas extenso|dame la version completa|dame mas)\b/],
    agentPrompt: () => 'Amplía tu respuesta anterior con más profundidad, ejemplos concretos y pasos detallados, sin repetir lo que ya escribiste. No te limites en extensión.' },

  // --- Catálogo, ayuda y estado -------------------------------------
  { id: 'mostrar_comandos', kind: 'ui', uiAction: 'openCatalog', category: 'Control', weight: 3,
    patterns: [/\b(?:muestra|mu[eé]strame|ens[eé][ñn]ame|abre|lista|quiero ver)\b.+\b(?:comandos|ordenes)\b(?:\s+de\s+voz)?\b/, /\bcomandos de voz\b/, /\b(?:catalogo|lista) de comandos\b/],
    respond: () => 'Abriendo el catálogo de comandos de voz.' },
  { id: 'ayuda', kind: 'ui', uiAction: 'openHelp', category: 'Control', weight: 3,
    patterns: [/\b(?:ayuda|ayudame|necesito ayuda|socorro|que puedo hacer|que puedes hacer)\b/, /\bexplica (?:los )?comandos\b/],
    respond: () => 'Puedo controlar esta interfaz por voz y trabajar con el agente: programación, archivos, investigación web, videojuegos y más. Di «MORDUK, muestra los comandos» para ver el catálogo, o simplemente pídeme lo que necesites.' },
  { id: 'estado_openclaw', kind: 'local', category: 'Control', weight: 3,
    patterns: [/\b(?:comprueba|verifica|revisa|estado|diagnostico|prueba)\b.+\bopenclaw\b/, /\bopenclaw\b.+\b(?:conectado|conexion|estado|gateway)\b/, /\bestas conectado\b/],
    respond: async () => {
      const status = await getOpenClawStatus();
      if (!status.installed) return 'OpenClaw no está disponible en este equipo. Instálalo y configura el Gateway para activar mi cerebro completo.';
      return status.gatewayRunning
        ? `OpenClaw conectado. ${status.detail}`
        : 'OpenClaw está instalado, pero el Gateway no responde. Inícialo y vuelve a preguntarme.';
    } },
  { id: 'limpiar_conversacion', kind: 'ui', uiAction: 'clearChat', category: 'Control', weight: 3,
    patterns: [/\b(?:limpia|limpiar|borra|borrar|elimina)\b.+\b(?:conversacion|chat|pantalla|historial)\b/, /\b(?:limpia|borra) todo\b/],
    respond: () => 'Conversación limpiada.' },
  { id: 'repetir_ultima', kind: 'ui', uiAction: 'repeatLast', category: 'Control', weight: 3,
    patterns: [/\brepit(?:e|elo|eme|e eso|e la respuesta|e tu respuesta|elo otra vez)\b/, /\b(?:di|dime|dilo)\b.+\b(?:otra vez|de nuevo|lo ultimo|la respuesta anterior)\b/, /\b(?:repite|repetir)\b.+\b(?:ultima|ultimo|anterior|respuesta)\b/],
    respond: () => null },

  // --- Voz y escucha -------------------------------------------------
  { id: 'activar_voz', kind: 'ui', uiAction: 'voiceOn', category: 'Voz', weight: 3,
    patterns: [/\b(?:activa|activar|habilita|enciende|enciende)\b.+\b(?:voz|habla|respuestas habladas|microfono)\b/, /\bhablame\b/, /\bactiva tu voz\b/],
    respond: () => 'Voz activada. Ahora leeré mis respuestas en voz alta.' },
  { id: 'silenciar_voz', kind: 'ui', uiAction: 'voiceOff', category: 'Voz', weight: 3,
    patterns: [/\b(?:silencia|silenciar|desactiva|apaga)\b.+\b(?:voz|respuestas habladas)\b/, /\b(?:c[aá]llate|para de hablar|deja de hablar)\b/, /\bmodo silencio\b/],
    respond: () => 'Voz silenciada. Seguiré respondiendo por escrito y con el subtítulo del núcleo.' },
  { id: 'detener_voz', kind: 'ui', uiAction: 'stopSpeaking', category: 'Voz', weight: 3,
    patterns: [/\b(?:deja de hablar|detente|cuenta|callate ya|basta|para ya|deten la voz|cancela voz)\b/],
    respond: () => null },
  { id: 'hablar_despacio', kind: 'ui', uiAction: 'slower', category: 'Voz', weight: 3,
    patterns: [/\b(?:habla|hable)\b.+\b(?:despacio|mas despacio|mas lento|lento)\b/, /\breduce la velocidad\b/],
    respond: () => 'Reduciendo velocidad de voz.' },
  { id: 'hablar_rapido', kind: 'ui', uiAction: 'faster', category: 'Voz', weight: 3,
    patterns: [/\b(?:habla|hable)\b.+\b(?:mas rapido|rapido|mas ligero)\b/, /\baumenta la velocidad\b/],
    respond: () => 'Aumentando velocidad de voz.' },
  { id: 'velocidad_normal', kind: 'ui', uiAction: 'normalSpeed', category: 'Voz', weight: 3,
    patterns: [/\b(?:velocidad normal|velocidad predeterminada|voz normal|vuelve a la velocidad)\b/],
    respond: () => 'Velocidad de voz restablecida.' },
  { id: 'modo_conversacion_on', kind: 'ui', uiAction: 'convOn', category: 'Voz', weight: 3,
    patterns: [/\b(?:activa|activar|pon|ponme|entra(?:r)? en|inicia)\b.+\bmodo (?:conversaci[oó]n|charla|di[aá]logo)\b/, /\bmodo conversaci[oó]n\b/],
    respond: () => 'Modo conversación activado: tras cada respuesta tienes un minuto para seguir hablando sin decir MORDUK. Di «modo normal» para salir.' },
  { id: 'modo_conversacion_off', kind: 'ui', uiAction: 'convOff', category: 'Voz', weight: 3,
    patterns: [/\b(?:desactiva|desactivar|sal(?:ir)? de|termina|quita)\b.+\bmodo (?:conversaci[oó]n|charla|di[aá]logo)\b/, /\bmodo normal\b/],
    respond: () => 'Modo normal: vuelvo a exigir la palabra MORDUK antes de cada orden.' },
  { id: 'escucha_continua_on', kind: 'ui', uiAction: 'continuousOn', category: 'Voz', weight: 3,
    patterns: [/\b(?:activa|activar|enciende|inicia)\b.+\b(?:escucha continua|modo continuo|manos libres|escucha permanente)\b/],
    respond: () => 'Escucha continua activada. Di MORDUK antes de cada orden.' },
  { id: 'escucha_continua_off', kind: 'ui', uiAction: 'continuousOff', category: 'Voz', weight: 3,
    patterns: [/\b(?:desactiva|desactivar|apaga|deten|para|termina)\b.+\b(?:escucha continua|modo continuo|manos libres|escucha permanente)\b/],
    respond: () => 'Escucha continua desactivada.' },

  // --- Paneles --------------------------------------------------------
  ...['centro', 'proyectos', 'memoria', 'skills', 'herramientas', 'voz'].map(panel => ({
    id: `abrir_panel_${panel}`, kind: 'ui', uiAction: `openPanel:${panel}`, category: 'Paneles', weight: 3,
    patterns: [new RegExp(`\\b(?:abre|abrir|muestra|ensena|activa)\\b.+\\bpanel (?:de )?${panel}\\b`), new RegExp(`\\bpanel (?:de )?${panel}\\b`)],
    respond: () => `Abriendo el panel de ${panel}.`,
  })),

  // --- Hora y fecha ----------------------------------------------------
  { id: 'decir_hora', kind: 'local', category: 'Utilidades', weight: 3,
    patterns: [/\b(?:que hora es|dime la hora|dime la hora actual|hora actual|hora por favor|dime que hora es)\b/, /^(?:la\s+)?hora(?:\s+(?:actual|de ahora|por favor))?$/],
    respond: () => `Son las ${new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })}.` },
  { id: 'decir_fecha', kind: 'local', category: 'Utilidades', weight: 3,
    patterns: [/\b(?:que fecha|que dia es hoy|fecha de hoy|dime la fecha|dime que dia es)\b/, /^(?:la\s+)?fecha(?:\s+de hoy)?$/],
    respond: () => `Hoy es ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.` },

  // --- Utilidades del PC ----------------------------------------------
  { id: 'calcular', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:cuanto es|cuanto vale|calcula(?:me|r)?)\b/, /\bresultado de\b/, /\bra[ií]z cuadrada\b/],
    respond: async (raw) => {
      const value = tryCalc(raw);
      if (value === null) return null; // no es una operación clara → lo resuelve el agente
      return `El resultado es ${value.toLocaleString('es-CO')}.`;
    } },
  { id: 'estado_pc', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:como esta el (?:pc|equipo|sistema)|estado del (?:pc|equipo|sistema)|memoria (?:disponible|ram)|cuanta (?:ram|memoria))\b/, /\b(?:cuanto tiempo lleva|cuanto lleva) (?:encendido|prendido|activo)\b/, /\buptime\b/],
    respond: () => {
      const gb = n => (n / 2 ** 30).toFixed(1);
      const up = os.uptime();
      const h = Math.floor(up / 3600), m = Math.round((up % 3600) / 60);
      return `El equipo va bien: ${os.cpus().length} núcleos lógicos, ${gb(os.freemem())} GB de RAM libres de ${gb(os.totalmem())} GB, y encendido desde hace ${h} horas y ${m} minutos.`;
    } },
  { id: 'abrir_web', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:abre|abrir|entra a|ve a|visita)\b.+\b(?:youtube|google|github|gmail|whatsapp|netflix|chatgpt|wikipedia|instagram|facebook|twitch|reddit|twitter|spotify)\b/, /\b(?:abre|abrir)\b.+\b(?:web|pagina|sitio|enlace|url)\b/],
    respond: async (raw) => {
      const norm = normalize(raw);
      let target = null;
      for (const [name, url] of Object.entries(WEBSITES)) {
        if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(norm)) { target = url; break; }
      }
      if (!target) {
        const urlMatch = raw.match(/https?:\/\/\S+/i) || raw.match(/\b[\w-]+\.(?:com|net|org|io|dev|es|co)\b/i);
        if (urlMatch) target = /^https?:/i.test(urlMatch[0]) ? urlMatch[0] : `https://${urlMatch[0]}`;
      }
      if (!target) return null; // destino poco claro → lo resuelve el agente
      return (await openShell(target)) ? 'Abriendo el sitio en tu navegador.' : 'No pude abrir el navegador.';
    } },
  { id: 'abrir_app', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:abre|abrir|ejecuta|lanza|inicia)\b.+\b(?:calculadora|bloc de notas|notas|paint|explorador|terminal|consola|administrador de tareas|task manager)\b/],
    respond: async (raw) => {
      const norm = normalize(raw);
      const keys = Object.keys(APPS).sort((a, b) => b.length - a.length);
      for (const key of keys) {
        if (new RegExp(`\\b${escapeRegExp(normalize(key))}\\b`).test(norm)) {
          return (await openShell(APPS[key])) ? `Abriendo ${key}.` : `No pude abrir ${key} en este equipo.`;
        }
      }
      return null;
    } },
  { id: 'lanzar_dado', kind: 'local', category: 'Utilidades PC', weight: 2,
    patterns: [/\b(?:lanza|lanzar|tira|tirar|tira un)\b.+\bdado\b/, /\bdado\b.+\bcaras?\b/],
    respond: (raw) => {
      const sides = parseInt((raw.match(/\d+/) || [])[0], 10) || 6;
      const n = 1 + Math.floor(Math.random() * Math.min(Math.max(sides, 2), 1000));
      return `Dado de ${sides} caras… número ${n}.`;
    } },
  { id: 'lanzar_moneda', kind: 'local', category: 'Utilidades PC', weight: 2,
    patterns: [/\b(?:lanza|tira)\b.+\bmoneda\b/, /\bcara o cruz\b/, /\bsello o cara\b/],
    respond: () => `Moneda al aire… ${Math.random() < 0.5 ? 'cara' : 'cruz'}.` },
  { id: 'decir_broma', kind: 'local', category: 'Utilidades PC', weight: 2,
    patterns: [/\b(?:cuentame|cuenta|dime) (?:un )?(?:chiste|broma)\b/, /\b(?:hazme re[ií]r|algo gracioso|algo divertido)\b/],
    respond: () => pick(JOKES) },
  { id: 'poner_temporizador', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:temporizador|cronometro|alarma)\b.+\b\d+\b/, /\bpon(?:me)? (?:un )?(?:temporizador|alarma|cronometro)\b/],
    respond: (raw) => {
      const ms = parseDuration(raw);
      if (!ms) return 'Dime cuánto: por ejemplo, «MORDUK, temporizador de 10 minutos».';
      startTimer('Temporizador', ms);
      return `Listo: temporizador de ${formatDuration(ms)}. Te aviso a las ${new Date(Date.now() + ms).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    } },
  { id: 'recordar_en', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:recuerdame|recordarme|avisame)\b.+\b(?:en|dentro de)\b/, /\bdentro de\b.+\b(?:recuerdame|avisame)\b/],
    respond: (raw) => {
      const ms = parseDuration(raw);
      if (!ms) return 'Dime cuándo y qué: por ejemplo, «MORDUK, recuérdame en 20 minutos que apagar el horno».';
      const labelMatch = raw.match(/\b(?:que|de)\s+(.+)$/i);
      const label = labelMatch ? labelMatch[1].trim() : 'Recordatorio';
      startTimer(String(label).slice(0, 200), ms);
      return `Anotado: te recuerdo «${label}» en ${formatDuration(ms)}.`;
    } },
  { id: 'listar_temporizadores', kind: 'local', category: 'Utilidades PC', weight: 2,
    patterns: [/\b(?:temporizadores|recordatorios|alarmas)\b.+\b(?:activos|pendientes|cuantos|hay)\b/, /\bcuantos (?:temporizadores|recordatorios)\b/],
    respond: () => {
      const info = timersInfo();
      if (!info.active.length) return 'No tengo temporizadores activos.';
      return `Tengo ${info.active.length} activo${info.active.length > 1 ? 's' : ''}: ${info.active.map(t => `«${t.label}» en ${formatDuration(t.remainingMs)}`).join('; ')}.`;
    } },
  { id: 'cancelar_temporizadores', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:cancela|borra|deten|elimina)\b.+\b(?:temporizadores?|recordatorios?|alarmas?)\b/],
    respond: () => {
      const count = activeTimers.size;
      activeTimers.clear();
      return count ? `Cancelé ${count} temporizador${count > 1 ? 'es' : ''}.` : 'No había temporizadores activos.';
    } },
  // --- Poderes del PC --------------------------------------------------
  { id: 'subir_volumen', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:sube|subir|aumenta|aumentar)\b.+\bvolumen\b/, /\bvolumen arriba\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]176)'); return 'Subiendo el volumen.'; } },
  { id: 'bajar_volumen', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:baja|bajar|reduce|reducir|disminuye)\b.+\bvolumen\b/, /\bvolumen abajo\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]175)'); return 'Bajando el volumen.'; } },
  { id: 'silenciar_volumen', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:silencia|silenciar|mutear|muta|quita)\b.+\b(?:volumen|sonido|audio)\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]173)'); return 'Volumen silenciado (o reactivado, es un interruptor).'; } },
  { id: 'multimedia_play', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:dale play|reproduce|reproducir|reanuda|pausa|pausar)\b(?:\s+(?:la|el))?\s+(?:m[uú]sica|canci[oó]n|video|pel[ií]cula)\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]179)'); return 'Play o pausa enviado al reproductor.'; } },
  { id: 'multimedia_siguiente', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:siguiente|pasa|saltar)\b.+\b(?:canci[oó]n|tema|video|m[uú]sica)\b/, /\bsiguiente pista\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]177)'); return 'Siguiente pista.'; } },
  { id: 'multimedia_anterior', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:anterior|regresa|devuelve)\b.+\b(?:canci[oó]n|tema|video|m[uú]sica)\b/, /\bpista anterior\b/],
    respond: async () => { await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]178)'); return 'Pista anterior.'; } },
  { id: 'captura_pantalla', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:toma|tomar|haz|hacer|captura|capturar)\b.*\bcaptura\b/, /\b(?:screenshot|foto de (?:la )?pantalla)\b/, /\bcaptura de pantalla\b/],
    respond: async () => {
      const out = await ps(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $d=Join-Path $env:USERPROFILE 'Desktop\\MORDUK Capturas'; New-Item -ItemType Directory -Force -Path $d | Out-Null; $f=Join-Path $d ('captura-'+(Get-Date -Format 'yyyy-MM-dd-HHmmss')+'.png'); $bmp.Save($f,[System.Drawing.Imaging.ImageFormat]::Png); Write-Output $f`, 15000);
      return out ? 'Captura de pantalla guardada en la carpeta MORDUK Capturas del escritorio.' : 'No pude tomar la captura en este momento.';
    } },
  { id: 'estado_bateria', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\bbater[ií]a\b/, /\bcuanta carga\b/],
    respond: async () => {
      const out = await ps(`$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if ($b) { Write-Output ('Carga: ' + $b.EstimatedChargeRemaining + '%') } else { Write-Output 'SIN_BATERIA' }`);
      return out === 'SIN_BATERIA' ? 'Este equipo no tiene batería: es un PC de escritorio conectado a la corriente.' : `Nivel de batería: ${out.replace('Carga: ', '')}.`;
    } },
  { id: 'mi_ip', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:mi ip|direcci[oó]n ip|ip p[uú]blica|ip local|ip privada)\b/],
    respond: async () => {
      const local = await ps(`(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $\_.IPAddress -ne '127.0.0.1' -and $\_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress`);
      let publica = '';
      try { publica = await ps('Invoke-RestMethod -Uri https://api.ipify.org -TimeoutSec 5', 8000); } catch {}
      const partes = [];
      if (local) partes.push(`IP local: ${local}`);
      if (publica && publica.length <= 45) partes.push(`IP pública: ${publica}`);
      return partes.length ? partes.join('. ') + '.' : 'No pude determinar la dirección IP.';
    } },
  { id: 'ajustar_brillo', kind: 'local', category: 'Poderes del PC', weight: 2,
    patterns: [/\b(?:sube|subir|baja|bajar|pon|poner)\b.+\bbrillo\b/, /\bbrillo\b.+\b\d+\b/],
    respond: async (raw) => {
      const m = raw.match(/\d+/);
      let level = m ? parseInt(m[0], 10) : null;
      if (level === null) level = /\b(?:sube|subir|aumenta)\b/.test(normalize(raw)) ? 90 : 40;
      level = Math.max(0, Math.min(100, level));
      try {
        await ps(`Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Brightness = ${level}; Timeout = 0 }`);
        return `Brillo ajustado a ${level}%.`;
      } catch {
        return 'Este monitor no permite ajustar el brillo por software (suele funcionar en port[aá]tiles).';
      }
    } },
  { id: 'ver_procesos', kind: 'local', category: 'Poderes del PC', weight: 2,
    patterns: [/\b(?:procesos|programas)\b.+\b(?:consumen|consumiendo|m[aá]s|activos|corriendo|abiertos|ejecutando)\b/, /\b(?:que est[aá]s?|qu[eú])\s+(?:corriendo|consumiendo|ejecut[aá]ndose)\b/],
    respond: async () => {
      const out = await ps('Get-Process -ErrorAction SilentlyContinue | Sort-Object CPU -Descending | Select-Object -First 5 -ExpandProperty ProcessName');
      if (!out) return 'No pude leer los procesos ahora mismo.';
      const names = out.split(/\r?\n/).filter(Boolean).slice(0, 5);
      return `Los procesos con más procesador acumulado: ${names.join(', ')}.`;
    } },
  { id: 'bloquear_pantalla', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:bloquea|bloquear)\b.*\b(?:pantalla|equipo|pc|sesi[oó]n)\b/],
    respond: async () => {
      pendingAction = 'lock_screen';
      return 'Voy a bloquear la pantalla del equipo. Di «confirma» para hacerlo o «cancela».';
    } },
  { id: 'cerrar_programa', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:cierra|cerrar|termina|mata)\b.+\b(?:programa|proceso|app|aplicaci[oó]n)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:programa|proceso|app|aplicaci[oó]n)\s+(.+)$/i);
      const name = m ? m[1].trim() : '';
      if (!name) return 'Dime qué programa cerrar: por ejemplo, «cierra el programa Spotify».';
      pendingAction = 'kill:' + name.slice(0, 60);
      return `Voy a cerrar de forma forzada todo proceso que coincida con «${name}». Di «confirma» o «cancela».`;
    } },
  { id: 'vaciar_papelera', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:vacia|vaciar|limpia|limpiar)\b.+\bpapelera\b/],
    respond: async () => {
      pendingAction = 'papelera';
      return 'Voy a vaciar la papelera de reciclaje de forma permanente. Di «confirma» o «cancela».';
    } },
  { id: 'agregar_a_lista', kind: 'local', category: 'Listas', weight: 3,
    patterns: [/\b(?:agrega|a[nñ]ade|apunta|pon)\b.+\b(?:a|en) (?:mi |la )?lista (?:de )?(?:compras|tareas)\b/, /\b(?:agrega|a[nñ]ade|apunta)\b.+\b(?:a|en) (?:mi |la )?lista\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:agrega|a[nñ]ade|apunta|pon)\s+(.+?)\s+(?:a|en)\s+(?:mi |la )?lista(?:\s+de)?\s+(compras|tareas)/i);
      if (!m) return 'Dime qué y a qué lista: por ejemplo, «agrega leche a la lista de compras» o «apunta estudiar React a la lista de tareas».';
      const list = m[2].toLowerCase();
      await memory.addListItem(list, m[1].trim());
      return `Anotado en tu lista de ${list}: «${m[1].trim()}». ${list === 'compras' ? '¡Nunca más se te olvida el pan!' : '¡Vamos con todo con esa tarea!'}`;
    } },
  { id: 'leer_lista', kind: 'local', category: 'Listas', weight: 3,
    patterns: [/\b(?:lee|l[eé]eme|dame|cu[aá]l es|qu[eé] tiene|qu[eé] hay en)\b.+\blista (?:de )?(?:compras|tareas)\b/, /\blista (?:de )?(?:compras|tareas)\b/],
    respond: async (raw) => {
      const m = raw.match(/lista\s+(?:de\s+)?(compras|tareas)/i);
      if (!m) return null;
      const list = await memory.getList(m[1].toLowerCase());
      if (!list.length) return `Tu lista de ${m[1]} está vacía. Agrégame cosas con «agrega … a la lista de ${m[1]}».`;
      const enumerada = list.map((x, i) => (i + 1) + '. ' + x).join('; ');
      return `Tu lista de ${m[1]} tiene ${list.length} ${list.length === 1 ? 'cosa' : 'cosas'}: ${enumerada}.`;
    } },
  { id: 'quitar_de_lista', kind: 'local', category: 'Listas', weight: 3,
    patterns: [/\b(?:quita|elimina|borra)\b.+\bde (?:mi |la )?lista (?:de )?(?:compras|tareas)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:quita|elimina|borra)\s+(.+?)\s+de\s+(?:mi |la )?lista(?:\s+de)?\s+(compras|tareas)/i);
      if (!m) return 'Dime qué quitar y de qué lista: «quita la leche de la lista de compras».';
      const item = m[1].trim().replace(/^(el|la|los|las)\s+/i, '');
      const removed = await memory.removeListItem(m[2].toLowerCase(), item);
      return removed ? 'Hecho: fuera de la lista. ¡Organización nivel leyenda!' : 'No encontré eso en la lista.';
    } },
  { id: 'vaciar_lista', kind: 'local', category: 'Listas', weight: 3,
    patterns: [/\b(?:vac[ií]a|borra|limpia)\b.+\blista (?:de )?(?:compras|tareas)\b/],
    respond: async (raw) => {
      const m = raw.match(/lista\s+(?:de\s+)?(compras|tareas)/i);
      if (!m) return null;
      const count = await memory.clearList(m[1].toLowerCase());
      return count ? `Lista de ${m[1]} vaciada (${count} ${count === 1 ? 'cosa' : 'cosas'} eliminadas).` : 'La lista ya estaba vacía.';
    } },
  { id: 'buscar_web', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:busca|buscar|googl[eé]a)\b.+\ben (?:google|youtube)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:busca|buscar|googl[eé]a)\s+(?:en\s+)?(?:google|youtube)?\s*(.+?)\s+en\s+(google|youtube)/i) || raw.match(/(?:busca|buscar)\s+(.+?)\s+en\s+(google|youtube)/i);
      if (!m) return null;
      const q = encodeURIComponent(m[1].trim());
      const url = /youtube/i.test(m[2]) ? 'https://www.youtube.com/results?search_query=' + q : 'https://www.google.com/search?q=' + q;
      const ok = await openShell(url);
      return ok ? 'Buscando «' + m[1].trim() + '» en ' + m[2] + '.' : 'No pude abrir el navegador.';
    } },
  { id: 'dato_curioso', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\bdato curioso\b/, /\bcu[eé]ntame algo (?:curioso|interesante)\b/, /\bens[eé][ñn]ame un dato\b/],
    respond: () => pick(CURIOSIDADES) },
  { id: 'felicitacion', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\bfel[ií]c[ií]tame\b/, /\blo logr[eé]\b/, /\bcelebr(?:a|e|alo)\b.*\b(?:logro|éxito)\b/, /\bcelebr[aá]melo\b/],
    respond: () => pick(CELEBRACIONES) },
  { id: 'aburrido', kind: 'local', category: 'Conversación', weight: 2,
    patterns: [/\bestoy aburrid[oa]\b/, /\bme aburro\b/, /\bqu[eé] hago para (?:no )?aburrirme\b/],
    respond: () => pick(PARA_ABURRIDOS) },
  // --- Voz estilo oscuro ----------------------------------------------
  { id: 'voz_profunda', kind: 'ui', uiAction: 'pitchDeep', category: 'Voz', weight: 3,
    patterns: [/\bvoz profunda\b/, /\bvoz grave\b/],
    respond: () => 'El timbre de Escanor no se toca: es mi voz de heroe y asi se queda. Tu preferencia de voz grave queda anotada para cuando cambie de motor.' },
  { id: 'voz_normal_altura', kind: 'ui', uiAction: 'pitchNormal', category: 'Voz', weight: 3,
    patterns: [/\bvoz normal\b/, /\baltura normal\b/],
    respond: () => 'Altura de voz restablecida.' },
  { id: 'modo_escanor', kind: 'local', category: 'Voz', weight: 3,
    patterns: [/\bmodo escanor\b/],
    respond: () => 'El modo Escanor esta siempre activo: soy tu voz de heroe. ¡Y mi orgullo es proporcional a mi poder!' },
  { id: 'volumen_exacto', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\bvolumen\b.+\b(?:\d{1,3})\b/],
    respond: async (raw) => {
      const n = parseInt((raw.match(/(\d{1,3})/) || [])[1], 10);
      if (isNaN(n) || n < 0 || n > 100) return 'Dime un volumen de 0 a 100.';
      const pasos = Math.round(n / 2);
      await ps('Add-Type -AssemblyName System.Windows.Forms; $w = New-Object -ComObject WScript.Shell; 1..50 | ForEach-Object { $w.SendKeys([char]175) }; Start-Sleep -m 300; 1..' + pasos + ' | ForEach-Object { $w.SendKeys([char]176) }');
      return 'Volumen ajustado aproximadamente al ' + n + '%.';
    } },
  { id: 'velocidad_exacta', kind: 'ui', uiActionFn: (clean) => {
      const n = parseFloat((clean.match(/(0\.\d+|1\.\d+|\d+)/) || [])[1]);
      return 'rate:' + (isNaN(n) ? 1 : Math.max(0.5, Math.min(2, n)));
    }, category: 'Voz', weight: 3,
    patterns: [/\b(?:velocidad|velocidad de lectura)\b.+\b(?:0\.\d+|1\.\d+|\d+)\b/],
    respond: async (raw) => {
      const n = parseFloat((raw.match(/(0\.\d+|1\.\d+|\d+)/) || [])[1]);
      return 'Velocidad de lectura ajustada a ' + (isNaN(n) ? 1 : Math.max(0.5, Math.min(2, n))) + '. Así me oirás de ahora en adelante.';
    } },

  // --- Windows: apps y sistema ----------------------------------------
  // --- Control total del sistema de archivos (real) ---------------------
  { id: 'crear_carpeta', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:crea|crear|creame|haz|hacer)\b.+\bcarpeta\b/],
    respond: async (raw) => {
      try {
        const m = raw.match(/carpeta\s*(?:llamada|con nombre|de|llamado)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas|downloads))?$/i);
        let nombre = m ? m[1].trim() : '';
        const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
        if (!nombre) { const m2 = normalize(raw).match(/carpeta (.+)$/); nombre = m2 ? m2[1].trim() : ''; }
        nombre = String(nombre || '').replace(/[\\/:*?"<>|.]/g, '').trim();
        if (!nombre) return 'Dime el nombre de la carpeta: «crea una carpeta Mi Juego en el escritorio».';
        let base = os.homedir() + '\\Desktop';
        if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
        if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
        const ruta = base + '\\' + nombre;
        fsSync.mkdirSync(ruta, { recursive: true });
        return 'Carpeta «' + nombre + '» creada en ' + lugar + '. Ya la puedes ver.';
      } catch (e) { return 'No pude crear la carpeta: ' + String(e.message || e).slice(0, 100); }
    } },
  { id: 'crear_archivo', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:crea|crear|creame|haz|hacer)\b.+\barchivo\b/],
    respond: async (raw) => {
      const m = raw.match(/archivo\s*(?:llamado|con nombre|de)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas|downloads))?(?:\s+(?:que diga|con el (?:texto|contenido))\s*[:,-]?\s*(.+))?$/i);
      let nombre = m ? m[1].trim() : '';
      const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
      const contenido = m && m[3] ? m[3].trim() : '';
      nombre = String(nombre || '').replace(/[\\/:*?"<>|]/g, '').trim();
      if (!nombre) return 'Dime el nombre del archivo: «crea un archivo notas.txt en el escritorio que diga hola».';
      if (!/\.[a-z0-9]{1,5}$/i.test(nombre)) nombre += '.txt';
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = base + '\\' + nombre;
      try {
        fsSync.writeFileSync(ruta, (contenido || 'Creado por MORDUK el ' + new Date().toLocaleString('es-CO')) + '\n', 'utf8');
        return `Archivo «${nombre}» creado en ${lugar}${contenido ? ' con el texto que me diste' : ''}. Verificado.`;
      } catch (e) { return 'No pude crear el archivo: ' + String(e.message || e).slice(0, 100); }
    } },
  { id: 'leer_archivo_real', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:lee|leeme|leer)\b.+\b(?:archivo|el archivo)\b/, /\b(?:qu[eé] contiene|qu[eé] dice) (?:el |la )?archivo\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:lee|leeme|leer)\s+(?:el |la |mi )?archivo\s*(?:llamado|con nombre)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      let nombre = m ? m[1].trim() : '';
      const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
      if (!nombre) return null;
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = base + '\\' + nombre.replace(/[\\/:*?"<>|.]/g, '').trim();
      if (!fsSync.existsSync(ruta)) {
        const alt = base + '\\' + nombre;
        if (!fsSync.existsSync(alt)) return `No encontré el archivo «${nombre}» en ${lugar}.`;
        return 'El archivo dice: ' + fsSync.readFileSync(alt, 'utf8').slice(0, 400);
      }
      return 'El archivo dice: ' + fsSync.readFileSync(ruta, 'utf8').slice(0, 400);
    } },
  { id: 'borrar_archivo_real', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:borra|borrar|elimina|eliminar)\b.+\b(?:archivo|carpeta)\b/, /\bborra la carpeta\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:borra|borrar|elimina|eliminar)\s+(?:el |la |mi )?(archivo|carpeta)\s*(?:llamado|llamada|con nombre)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      if (!m) return 'Dime qué borro: «borra el archivo notas.txt en el escritorio».';
      const tipo = m[1].toLowerCase();
      let nombre = m[2].trim().replace(/[\\/:*?"<>|]/g, '').trim();
      const lugar = (m[3] ? m[3] : 'escritorio').toLowerCase();
      if (!nombre) return 'Dime el nombre exacto.';
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = base + '\\' + nombre;
      if (!fsSync.existsSync(ruta)) return `No encontré «${nombre}» en ${lugar}.`;
      pendingAction = (tipo === 'carpeta' ? 'deldir:' : 'delfile:') + ruta;
      return `Voy a enviar «${nombre}» a la papelera de reciclaje (se puede recuperar). Di «confirma» o «cancela».`;
    } },
  { id: 'abrir_carpeta', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:abre|abrir)\b.+\b(?:carpeta|la carpeta)\b/],
    respond: async (raw) => {
      const m = raw.match(/carpeta\s*(?:llamada|de|con nombre)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      let nombre = m ? m[1].trim().replace(/[\\/:*?"<>|.]/g, '').trim() : '';
      const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = nombre ? base + '\\' + nombre : base;
      if (nombre && !fsSync.existsSync(ruta)) return `No encontré la carpeta «${nombre}» en ${lugar}.`;
      await openShell('"' + ruta + '"');
      return 'Abriendo la carpeta en el explorador.';
    } },
  { id: 'copiar_archivo', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\bcopia\b.+\b(?:archivo|carpeta)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:copia)\s+(?:el |la |mi )?(archivo|carpeta)\s*["']?([^"'¿?]+?)["']?\s*(?:de (?:el |mi |la |los )?(escritorio|desktop|documentos|descargas))?\s*(?:a|en|hacia)\s*(?:el |la |mi |los )?(escritorio|desktop|documentos|descargas)\b/i);
      if (!m) return 'Dime qué copio y a dónde: «copia el archivo notas.txt de escritorio a documentos».';
      const tipo = m[1].toLowerCase();
      const nombre = m[2].trim().replace(/[\\/:*?"<>|]/g, '').trim();
      const lugarDe = (m[3] ? m[3] : 'escritorio').toLowerCase();
      const lugarA = m[4].toLowerCase();
      const baseDe = lugarDe.startsWith('doc') ? os.homedir() + '\\Documents' : lugarDe.startsWith('desc') ? os.homedir() + '\\Downloads' : os.homedir() + '\\Desktop';
      const baseA = lugarA.startsWith('doc') ? os.homedir() + '\\Documents' : lugarA.startsWith('desc') ? os.homedir() + '\\Downloads' : os.homedir() + '\\Desktop';
      const de = baseDe + '\\' + nombre;
      const a = baseA + '\\' + nombre;
      if (!fsSync.existsSync(de)) return `No encontré «${nombre}» en ${lugarDe}.`;
      try { fsSync.copyFileSync(de, a); return `Copié «${nombre}» de ${lugarDe} a ${lugarA}. Verificado.`; }
      catch (e) { return 'No pude copiar: ' + String(e.message || e).slice(0, 100); }
    } },
  { id: 'mover_archivo', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:mueve|mover|pasar|traslada)\b.+\b(?:archivo|carpeta)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:mueve|mover|pasar|traslada)\s+(?:el |la |mi )?(archivo|carpeta)\s*["']?([^"'¿?]+?)["']?\s*(?:de (?:el |mi |la |los )?(escritorio|desktop|documentos|descargas))?\s*(?:a|en|hacia|al|a la)\s*(?:el |la |mi |los )?(escritorio|desktop|documentos|descargas)\b/i);
      if (!m) return 'Dime qué muevo y a dónde: «mueve el archivo notas.txt de escritorio a documentos».';
      const tipo = m[1].toLowerCase();
      const nombre = m[2].trim().replace(/[\\/:*?"<>|]/g, '').trim();
      const lugarDe = (m[3] ? m[3] : 'escritorio').toLowerCase();
      const lugarA = m[4].toLowerCase();
      const baseDe = lugarDe.startsWith('doc') ? os.homedir() + '\\Documents' : lugarDe.startsWith('desc') ? os.homedir() + '\\Downloads' : os.homedir() + '\\Desktop';
      const baseA = lugarA.startsWith('doc') ? os.homedir() + '\\Documents' : lugarA.startsWith('desc') ? os.homedir() + '\\Downloads' : os.homedir() + '\\Desktop';
      const de = baseDe + '\\' + nombre;
      const a = baseA + '\\' + nombre;
      if (!fsSync.existsSync(de)) return `No encontré «${nombre}» en ${lugarDe}.`;
      if (fsSync.existsSync(a)) {
        pendingAction = 'mover:' + de + '|' + a;
        return `En ${lugarA} ya existe algo llamado «${nombre}». ¿Lo reemplazo? Di «confirma» o «cancela».`;
      }
      try { fsSync.renameSync(de, a); return `Moví «${nombre}» de ${lugarDe} a ${lugarA}. Verificado.`; }
      catch (e) { return 'No pude moverlo: ' + String(e.message || e).slice(0, 100); }
    } },
  { id: 'renombrar_archivo', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:renombra|renombrar)\b.+\b(?:archivo|carpeta|a|como)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:renombra|renombrar)\s+(?:el |la |mi )?(archivo|carpeta)\s*["']?([^"'¿?]+?)["']?\s+(?:a|como|hacia)\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      if (!m) return 'Dime qué renombro: «renombra el archivo notas.txt a ideas.txt en el escritorio».';
      const tipo = m[1].toLowerCase();
      const viejo = m[2].trim().replace(/[\\/:*?"<>|]/g, '').trim();
      const nuevo = m[3].trim().replace(/[\\/:*?"<>|]/g, '').trim();
      const lugar = (m[4] ? m[4] : 'escritorio').toLowerCase();
      const base = lugar.startsWith('doc') ? os.homedir() + '\\Documents' : lugar.startsWith('desc') ? os.homedir() + '\\Downloads' : os.homedir() + '\\Desktop';
      const de = base + '\\' + viejo;
      const a = base + '\\' + nuevo;
      if (!fsSync.existsSync(de)) return `No encontré «${viejo}» en ${lugar}.`;
      if (fsSync.existsSync(a)) return `Ya existe algo llamado «${nuevo}» en ${lugar}. Elige otro nombre.`;
      try { fsSync.renameSync(de, a); return `Renombrado «${viejo}» a «${nuevo}». Verificado.`; }
      catch (e) { return 'No pude renombrar: ' + String(e.message || e).slice(0, 100); }
    } },
  { id: 'abrir_archivo', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:abre|abrir)\b.+\b(?:el archivo|la archivo|archivo)\b/, /\babre el archivo\b/],
    respond: async (raw) => {
      const m = raw.match(/abre\s+(?:el |la |mi )?archivo\s*(?:llamado|con nombre)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      let nombre = m ? m[1].trim().replace(/[\\/:*?"<>|]/g, '').trim() : '';
      const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
      if (!nombre) return 'Dime qué archivo abro: «abre el archivo notas.txt en el escritorio».';
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = base + '\\' + nombre;
      if (!fsSync.existsSync(ruta)) return `No encontré «${nombre}» en ${lugar}.`;
      await openShell('"' + ruta + '"');
      return 'Abriendo «' + nombre + '» con su programa predeterminado.';
    } },
  { id: 'contenido_carpeta', kind: 'local', category: 'Control total', weight: 3,
    patterns: [/\b(?:qu[eé] hay|qu[eé] contiene|lista|lista el contenido)\b.+\b(?:en|dentro de) (?:la |el )?carpeta\b/, /\bcontenido de (?:la |el )?carpeta\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:carpeta)\s*(?:llamada|de|con nombre)?\s*["']?([^"'¿?]+?)["']?\s*(?:en (?:el |mi |la )?(escritorio|desktop|documentos|descargas))?$/i);
      let nombre = m ? m[1].trim().replace(/[\\/:*?"<>|.]/g, '').trim() : '';
      const lugar = (m && m[2] ? m[2] : 'escritorio').toLowerCase();
      if (/escritorio|desktop/i.test(nombre)) nombre = ''; // «la carpeta del escritorio» = la raíz
      let base = os.homedir() + '\\Desktop';
      if (lugar.startsWith('doc')) base = os.homedir() + '\\Documents';
      if (lugar.startsWith('desc')) base = os.homedir() + '\\Downloads';
      const ruta = nombre ? base + '\\' + nombre : base;
      if (!fsSync.existsSync(ruta)) return `No encontré la carpeta «${nombre}» en ${lugar}.`;
      const items = fsSync.readdirSync(ruta).slice(0, 10);
      return items.length ? `En «${nombre || lugar}» hay: ${items.join(', ')}.` : 'La carpeta está vacía.';
    } },
  { id: 'espacio_disco', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\bespacio en (?:el )?disco\b/, /\bcu[aá]nto espacio\b/, /\bespacio libre\b/],
    respond: async () => {
      const out = await ps('Get-PSDrive -PSProvider FileSystem | Where-Object { $\_.Free } | ForEach-Object { Write-Output ($_.Name + ":" + [math]::Round($_.Free/1GB,1) + "GB") }', 15000);
      if (!out) return 'No pude leer el espacio en disco.';
      const unidades = out.split(/\r?\n/).filter(Boolean).map(l => { const p = l.split(':'); return p[0] + ': ' + p[1].replace('GB', '') + ' GB libres'; });
      return 'Espacio libre: ' + unidades.join('. ') + '.';
    } },
  { id: 'abrir_papelera', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:abre|abrir|muestra)\b.+\bpapelera\b/],
    respond: async () => {
      await openShell('shell:RecycleBinFolder');
      return 'Abriendo la papelera de reciclaje.';
    } },
  { id: 'recordatorio_hora', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:recu[eé]rdame|av[ií]same)\b.+\ba las?\s+\d+/, /\b(?:recu[eé]rdame|av[ií]same)\b.+\ba la\s+\d+/],
    respond: async (raw) => {
      const m = raw.match(/a las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la ma[nñ]ana|de la tarde|de la noche)?/i);
      if (!m) return 'Dime la hora: por ejemplo, «recuérdame a las 3 de la tarde que llamar a mamá».';
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const tipo = (m[3] || '').toLowerCase();
      if (/pm|tarde|noche/.test(tipo) && h < 12) h += 12;
      if (/am|ma[nñ]ana/.test(tipo) && h === 12) h = 0;
      if (!tipo && h >= 1 && h <= 7) h += 12;
      const objetivo = new Date(); objetivo.setHours(h, min, 0, 0);
      if (objetivo <= new Date()) objetivo.setDate(objetivo.getDate() + 1);
      const labelMatch = raw.match(/\bque\s+(.+)$/i);
      const label = labelMatch ? labelMatch[1].trim() : 'Recordatorio';
      startTimer(String(label).slice(0, 200), objetivo - Date.now());
      const horaTxt = objetivo.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `Anotado: te recuerdo «${label}» a las ${horaTxt}.`;
    } },
  { id: 'abrir_app_morduk', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:abre|abrir|inicia|iniciar)\b.+\b(?:vscode|visual studio code|navegador|discord|obsidian|steam|whatsapp|blood ?strike|limbus|limbus company)\b/],
    respond: async (raw) => {
      const norm = normalize(raw);
      const APPS_M = {
        'vscode': ['code'], 'visual studio code': ['code'],
        'navegador': ['https://www.google.com'],
        'discord': ['discord://'],
        'obsidian': ['obsidian://open'],
        'steam': ['steam://open/games'],
        'whatsapp': ['whatsapp://'],
        'bloodstrike': ['steam://open/games'], 'blood strike': ['steam://open/games'],
        'limbus': ['steam://open/games'], 'limbus company': ['steam://open/games'],
      };
      const keys = Object.keys(APPS_M).sort((a, b) => b.length - a.length);
      for (const key of keys) {
        if (new RegExp('\\b' + escapeRegExp(normalize(key)) + '\\b').test(norm)) {
          for (const target of APPS_M[key]) {
            if (await openShell(target)) return 'Abriendo ' + key + '.';
          }
          return 'No encontre ' + key + ' instalado en este equipo.';
        }
      }
      return null;
    } },
  { id: 'busca_archivo', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\b(?:busca|buscar|encuentra)\b.+\b(?:archivo|archivos|documento|documentos)\b/, /\bbusca (?:el |la |mi )?(?:nombre|archivo)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:busca|buscar|encuentra)\s+(?:el |la |mi |los |las )?(?:archivo[s]?|documento[s]?)\s*(?:llamado|que se llame|con nombre)?\s*(.+)$/i);
      const name = m ? m[1].trim().replace(/["']/g, '') : '';
      if (!name) return 'Dime qué archivo busco: «busca el archivo informe».';
      const safe = name.replace(/[^\w\-. ]/g, '').trim();
      if (!safe) return null;
      const out = await ps(`$roots = @("$env:USERPROFILE\\Desktop", "$env:USERPROFILE\\Documents", "$env:USERPROFILE\\Downloads"); $r = foreach ($root in $roots) { Get-ChildItem $root -Recurse -Depth 3 -Filter "*${safe}*" -File -ErrorAction SilentlyContinue }; $r | Select-Object -First 5 -ExpandProperty FullName`, 20000);
      if (!out) return `No encontre ningun archivo con «${safe}» en Escritorio, Documentos ni Descargas.`;
      const lines = out.split(/\r?\n/).filter(Boolean).slice(0, 5);
      return `Encontre ${lines.length} archivo${lines.length > 1 ? 's' : ''}: ${lines.join(' | ')}`;
    } },
  { id: 'apagar_pc', kind: 'local', category: 'Poderes del PC', weight: 3,
    patterns: [/\bapaga\b.+\b(?:pc|equipo|computadora|windows)\b/, /\bapagar el (?:pc|equipo)\b/],
    respond: async () => {
      pendingAction = 'apagar';
      return 'Voy a apagar el equipo en 30 segundos. Di «confirma» para hacerlo o «cancela».';
    } },
  { id: 'cancela_tarea_morduk', kind: 'local', category: 'M.O.R.D.U.K.', weight: 3,
    patterns: [/\bcancela\b.+\b(?:tarea|tareas)\b/],
    respond: async () => {
      pendingAction = null;
      activeTimers.clear();
      return 'Cancelé las tareas pendientes y los temporizadores.';
    } },

  // --- Programación (VS Code / proyecto) -------------------------------
  { id: 'proyecto_estado', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^proyecto estado\b/, /\b(?:estado|como va) (?:del |mi )?proyecto\b/],
    agentPrompt: () => 'Informe del estado del proyecto actual: estructura, archivos clave, dependencias y pendientes. Sé breve y concreto.' },
  { id: 'revisa_codigo', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^revisa (?:el )?c[oó]digo\b/, /\brevisa codigo\b/],
    agentPrompt: () => 'Revisa el código del proyecto actual y lista errores concretos con sus correcciones sugeridas.' },
  { id: 'busca_errores', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^busca errores\b/],
    agentPrompt: () => 'Ejecuta o simula las comprobaciones disponibles del proyecto y lista los errores encontrados con solución.' },
  { id: 'ejecuta_pruebas', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^ejecuta (?:las )?pruebas\b/],
    agentPrompt: () => 'Ejecuta las pruebas configuradas del proyecto y resume los resultados en una tabla breve.' },
  { id: 'crea_archivo', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^crea (?:un |el )?archivo\b/],
    agentPrompt: (clean) => 'Crea un archivo llamado ' + clean.replace(/^crea\s+(?:un\s+|el\s+)?archivo\s*/i, '') + ' dentro del proyecto, con contenido útil de ejemplo.' },
  { id: 'explica_archivo', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^explica (?:el |la )?archivo\b/, /^explica archivo\b/],
    agentPrompt: (clean) => 'Explica el contenido del archivo ' + clean.replace(/^explica\s+(?:el\s+)?archivo\s*/i, '') + ' paso a paso.' },
  { id: 'organiza_proyecto', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^organiza (?:el )?proyecto\b/],
    agentPrompt: () => 'Propone una estructura de carpetas limpia para este proyecto, con justificación breve por carpeta.' },
  { id: 'genera_modulo', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^genera (?:un |el )?m[oó]dulo\b/],
    agentPrompt: (clean) => 'Prepara un módulo nuevo llamado ' + clean.replace(/^genera\s+(?:un\s+|el\s+)?m[oó]dulo\s*/i, '') + ' con estructura, código base y pruebas.' },
  { id: 'conecta_api', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^conecta (?:la )?api\b/],
    agentPrompt: () => 'Configura o comprueba la conexión con la API del proyecto: endpoints, credenciales (sin exponerlas) y prueba de conexión.' },
  { id: 'muestra_logs', kind: 'agent', category: 'Programación', weight: 3,
    patterns: [/^muestra (?:los )?logs\b/],
    agentPrompt: () => 'Muestra los últimos registros/logs relevantes del sistema y explica cualquier error visible.' },

  // --- Obsidian ---------------------------------------------------------
  { id: 'abre_obsidian', kind: 'local', category: 'Obsidian', weight: 3,
    patterns: [/\b(?:abre|abrir|inicia)\b.+\bobsidian\b/],
    respond: async () => {
      if (await openShell('obsidian://open')) return 'Abriendo Obsidian.';
      const rutas = [process.env.LOCALAPPDATA + '\\Obsidian\\Obsidian.exe', 'C:\\Program Files\\Obsidian\\Obsidian.exe'];
      for (const r of rutas) { if (fsSync.existsSync(r)) { await openShell('"' + r + '"'); return 'Abriendo Obsidian.'; } }
      return 'No encontré Obsidian instalado en este equipo.';
    } },
  { id: 'nota_obsidian', kind: 'local', category: 'Obsidian', weight: 3,
    patterns: [/\b(?:escribe|crea|guarda|apunta)\b.+\b(?:nota|n[o00f3]ta)\b.+\bobsidian\b/, /\bobsidian\b.+\b(?:nota|apunta)\b/],
    respond: async (raw) => {
      const m = raw.match(/(?:nota|nota en obsidian)\s*[:,-]?\s*(.+)$/i);
      const texto = m ? m[1].trim() : '';
      if (!texto) return 'Dime qué nota guardo: «escribe nota en obsidian: ideas del juego».';
      const out = await ps(`$v = Get-ChildItem "$env:USERPROFILE\\Desktop" -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName '.obsidian') } | Select-Object -First 1 -ExpandProperty FullName; if ($v) { Write-Output $v } else { Write-Output "$env:USERPROFILE\\Desktop" }`, 15000);
      const vault = out.trim() || (process.env.USERPROFILE + '\\Desktop');
      const nombre = 'MORDUK - ' + new Date().toLocaleDateString('es-CO') + '.md';
      const ruta = vault + '\\' + nombre;
      try {
        fsSync.writeFileSync(ruta, '# ' + texto + '\n\n- Guardado por MORDUK el ' + new Date().toLocaleString('es-CO') + '\n', 'utf8');
        return 'Nota creada en tu bóveda de Obsidian: «' + texto + '».';
      } catch {
        return 'No pude escribir la nota en la bóveda.';
      }
    } },
  // --- Conexión del cerebro en la nube (rápido + potente) ---------------
  { id: 'conectar_cerebro', kind: 'local', category: 'IA', weight: 3,
    patterns: [/\bconecta\b.+\b(?:cerebro|nube|groq|cerebras)\b/, /\b(?:conecta|conectar) el cerebro\b/],
    respond: async (raw) => {
      const keyMatch = raw.match(/(?:clav[aé]|key|clave)\s+([A-Za-z0-9_\-]{20,})/i) || raw.match(/\b(gsk_[A-Za-z0-9_\-]{10,}|csk-[A-Za-z0-9_\-]{10,}|sk-or-[A-Za-z0-9_\-]{10,})/i);
      const key = keyMatch ? keyMatch[1] : '';
      const norm0 = normalize(raw);
      let provider = ['groq', 'cerebras', 'openrouter'].find(p => norm0.includes(p));
      if (!provider && key.startsWith('gsk_')) provider = 'groq';
      if (!provider && key.startsWith('csk-')) provider = 'cerebras';
      if (!provider && key.startsWith('sk-or-')) provider = 'openrouter';
      if (!key) {
        return 'Para darme el cerebro rapido y potente: 1) crea una cuenta gratis en console.groq.com, 2) copia tu API key (empieza con gsk_), 3) dimela asi: «conecta el cerebro de groq con la clave gsk_...». En 10 segundos tendras un cerebro de 70 mil millones de parametros a velocidad instantanea.';
      }
      if (!provider) provider = 'groq';
      const r = nube.conectar(provider, key);
      if (!r.ok) return r.text;
      return `Cerebro conectado a ${provider} (${r.model}): rapido y potente. Preguntame lo que quieras, ¡ahora pienso a velocidad de la luz!`;
    } },
  { id: 'desconectar_cerebro', kind: 'local', category: 'IA', weight: 3,
    patterns: [/\bdesconecta\b.+\b(?:cerebro|nube)\b/],
    respond: () => {
      const r = nube.desconectar();
      return r.ok ? 'Cerebro en la nube desconectado. Vuelvo a mi cerebro local.' : 'No habia cerebro en la nube conectado.';
    } },

  // --- Comandos de IA --------------------------------------------------
  { id: 'ia_aprende', kind: 'local', category: 'IA', weight: 3,
    patterns: [/^aprende\b/],
    respond: async (raw) => {
      const dato = raw.replace(/^aprende\s*/i, '').trim();
      if (!dato) return 'Dime qué aprendo: «aprende que mi color favorito es el morado».';
      await memory.addFact(dato);
      return `Aprendido y guardado en mi memoria: «${dato}». No lo olvido jamás.`;
    } },
  { id: 'recuerda_tema', kind: 'local', category: 'IA', weight: 3,
    patterns: [/^recuerda\b/],
    respond: async (raw) => {
      const tema = raw.replace(/^recuerda\s*/i, '').trim().toLowerCase().replace(/^(el|la|los|las|mi|sobre el|sobre la|sobre)\s+/i, '');
      if (!tema) return 'Dime sobre qué te acuerdas: «recuerda el proyecto».';
      const facts = (await memory.listFacts()).filter(f => f.text.toLowerCase().includes(tema));
      if (!facts.length) return `No tengo nada guardado sobre «${tema}». Si me lo enseñas con «aprende que…», lo memorizo al instante.`;
      return `Sobre «${tema}» recuerdo: ${facts.map(f => f.text).join('; ')}.`;
    } },
  ...[
    ['piensa', 'Piensa profunda y estructuradamente, paso a paso, sobre: '],
    ['analiza', 'Analiza a fondo con ventajas, riesgos y conclusiones claras sobre: '],
    ['investiga', 'Investiga con todo detalle y ejemplos sobre: '],
    ['resume', 'Resume de forma clara y breve: '],
    ['traduce', 'Traduce el siguiente texto y explica brevemente decisiones clave: '],
    ['explica', 'Explica paso a paso, como a alguien que está aprendiendo: '],
    ['planifica', 'Crea un plan de acción numerado, realista y con tiempos para: '],
    ['c[oó]digo', 'Ayuda con código: escribe, revisa y explica con ejemplos ejecutables la tarea: '],
  ].map(([verb, prompt]) => ({
    id: 'ia_' + verb.replace(/[^a-z]/g, ''), kind: 'agent', category: 'IA', weight: 3,
    patterns: [new RegExp('^' + verb + '\\b')],
    agentPrompt: (clean) => {
      const tema = clean.replace(new RegExp('^' + verb + '\\s*', 'i'), '').trim();
      return tema ? (prompt + tema) : '';
    }
  })),

  { id: 'leer_portapapeles', kind: 'local', category: 'Utilidades PC', weight: 3,
    patterns: [/\b(?:lee|leeme|leer)\b.+\bportapapeles\b/, /\b(?:que hay|que dice) (?:en )?\bportapapeles\b/],
    respond: async () => {
      try {
        const res = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard'], { timeout: 8000, windowsHide: true });
        const text = String(res.stdout || '').trim();
        if (!text) return 'El portapapeles está vacío.';
        return `Esto dice el portapapeles: ${text.slice(0, 400)}${text.length > 400 ? '… y sigue' : ''}`;
      } catch {
        return 'No pude leer el portapapeles en este momento.';
      }
    } },
];

/* ------------------------------------------------------------------ */
/* Motor de decisión                                                   */
/* ------------------------------------------------------------------ */

const CONFIDENCE_THRESHOLD = 0.6;

function scoreIntent(intent, norm) {
  let best = 0;
  for (const pattern of intent.patterns) {
    const match = norm.match(pattern);
    if (!match) continue;
    // Frases ancladas al inicio cuentan más; cobertura de la orden también.
    const coverage = match[0].length / Math.max(norm.length, 1);
    best = Math.max(best, intent.weight * (0.65 + 0.35 * Math.min(coverage * 2, 1)) / 3);
  }
  return Math.min(best, 1);
}

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Interpreta una orden y decide qué hacer.
 * Devuelve { intent, kind, confidence, cleanText, action }.
 */
function interpret(rawText) {
  const cleanText = stripWakeWord(rawText);
  const norm = normalize(cleanText);

  if (!norm) return { intent: null, kind: 'empty', confidence: 0, cleanText: '', action: null };

  let bestIntent = null;
  let bestScore = 0;
  let bestLen = -1;
  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      const match = norm.match(pattern);
      if (!match) continue;
      const coverage = match[0].length / Math.max(norm.length, 1);
      const score = Math.min(intent.weight * (0.65 + 0.35 * Math.min(coverage * 2, 1)) / 3, 1);
      const len = match[0].length;
      // Empate: gana la coincidencia más larga (la intención más específica).
      if (score > bestScore || (score === bestScore && len > bestLen)) {
        bestScore = score; bestIntent = intent; bestLen = len;
      }
    }
  }

  if (bestIntent && bestScore >= CONFIDENCE_THRESHOLD) {
    return {
      intent: bestIntent.id,
      category: bestIntent.category,
      kind: bestIntent.kind,
      confidence: Number(bestScore.toFixed(2)),
      cleanText,
      action: bestIntent.kind === 'ui' ? (bestIntent.uiActionFn ? bestIntent.uiActionFn(cleanText) : bestIntent.uiAction) : null,
    };
  }

  // Comandos personalizados aprendidos por voz.
  for (const cmd of learnedCache) {
    const pattern = new RegExp(`\\b${escapeRegExp(normalize(cmd.phrase))}\\b`);
    if (pattern.test(norm)) {
      return { intent: `aprendido:${cmd.phrase}`, category: 'Aprendidos', kind: 'learned', confidence: 0.95, cleanText, action: cmd.action };
    }
  }

  return { intent: null, kind: 'agent', confidence: 0, cleanText, action: null };
}

/* ------------------------------------------------------------------ */
/* Ejecución                                                           */
/* ------------------------------------------------------------------ */

let lastReply = '';

function setLastReply(text) { lastReply = String(text || ''); }
function getLastReply() { return lastReply; }

function agentPromptFor(decision) {
  const matched = decision.intent ? INTENTS.find(item => item.id === decision.intent) : null;
  return matched?.agentPrompt ? matched.agentPrompt(decision.cleanText) : decision.cleanText;
}

/** Ruta de agente: nube (Cerebras/GLM) si está configurada, luego LM Studio, luego OpenClaw. */
async function runAgent(prompt, onToken) {
  // 1º Cerebro en la nube (GLM en Cerebras): instantáneo cuando hay API key.
  if (nube.getConfig().ready) {
    const history = await memory.recentMessages(12);
    const nubeRes = onToken
      ? await nube.chatStream(prompt, history, onToken)
      : await nube.chat(prompt, history);
    if (nubeRes.ok) {
      setLastReply(nubeRes.text);
      return { ok: true, text: nubeRes.text, model: nubeRes.model, fallback: 'nube' };
    }
  }

  // 2º Cerebro local (LM Studio): con tu memoria como contexto.
  if (await lmStudio.isAvailable()) {
    const history = await memory.recentMessages(12);
    const local = onToken
      ? await lmStudio.chatStream(prompt, history, onToken)
      : await lmStudio.chat(prompt, history);
    if (local.ok) {
      setLastReply(local.text);
      return { ok: true, text: local.text, model: local.model, fallback: 'lmstudio' };
    }
  }

  // 3º OpenClaw (Gateway del equipo), si está emparejado y activo.
  const result = await sendMessageToOpenClaw(prompt);
  if (result.ok) setLastReply(result.text);
  return result;
}

/** Igual que process() pero solo la vía de agente, con tokens en vivo (SSE). */
async function processAgentStream(decision, onToken) {
  const prompt = agentPromptFor(decision);
  await memory.logMessage('user', decision.cleanText, 'order');
  const result = await runAgent(prompt, onToken);
  await memory.logMessage('bot', result.text, result.ok ? 'agent' : 'error');
  return {
    ok: result.ok,
    kind: 'agent',
    intent: null,
    text: result.text,
    model: result.model || '',
    fallback: result.fallback || null,
    detail: result.detail || null,
  };
}

/**
 * Procesa una orden completa: interpreta, ejecuta lo local y delega el resto
 * al agente OpenClaw. Devuelve { ok, kind, intent, text, action, detail }.
 */
async function process(rawText, depth = 0) {
  const decision = interpret(rawText);

  if (decision.kind === 'empty') {
    return { ok: false, kind: 'empty', text: 'No escuché ninguna orden. Inténtalo de nuevo.' };
  }

  if (depth === 0) await memory.logMessage('user', decision.cleanText, 'order');

  // Orden aprendida por el usuario → ejecutar la acción que le enseñaron.
  if (decision.kind === 'learned') {
    if (depth >= 3) {
      return { ok: false, kind: 'learned', text: 'La cadena de comandos aprendidos es demasiado larga. Revisa que un comando no llame a otro infinitamente.' };
    }
    const inner = await process(decision.action, depth + 1);
    return { ...inner, intent: decision.intent };
  }

  if (decision.kind === 'ui') {
    const intent = INTENTS.find(item => item.id === decision.intent);
    let speech = intent ? await intent.respond(decision.cleanText) : '';
    if (decision.intent === 'repetir_ultima') {
      speech = lastReply || 'No tengo ninguna respuesta reciente que repetir.';
      return { ok: true, kind: 'ui', intent: decision.intent, text: speech, action: 'repeatLast', detail: null };
    }
    if (depth === 0) await memory.logMessage('bot', speech, 'ui');
    return { ok: true, kind: 'ui', intent: decision.intent, text: speech, action: decision.action, detail: null };
  }

  if (decision.kind === 'local') {
    const intent = INTENTS.find(item => item.id === decision.intent);
    const speech = await intent.respond(decision.cleanText);
    if (speech !== null && speech !== undefined) {
      if (depth === 0) await memory.logMessage('bot', speech, 'local');
      return { ok: true, kind: 'local', intent: decision.intent, text: speech, action: null, detail: null };
    }
    // La utilidad local no pudo resolver la orden (respond devolvió null)
    // → cae al delegado del agente, más abajo.
  }

  // Sin intención local clara → delegar al agente OpenClaw (cerebro ampliado).
  // Si la orden coincide con una intención de agente (p. ej. «continúa»),
  // se usa su prompt especial en lugar del texto literal.
  const prompt = agentPromptFor(decision);
  const result = await runAgent(prompt);

  if (result.ok) setLastReply(result.text);
  if (depth === 0) await memory.logMessage('bot', result.text, result.ok ? 'agent' : 'error');
  return {
    ok: result.ok,
    kind: 'agent',
    intent: null,
    text: result.text,
    model: result.model || '',
    fallback: result.fallback || null,
    detail: result.detail || null,
  };
}

module.exports = { interpret, process, normalize, stripWakeWord, setLastReply, getLastReply, INTENTS, refreshLearned, timersInfo, processAgentStream, agentPromptFor };