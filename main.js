'use strict';

/**
 * main.js — CLI de MORDUK (núcleo).
 * La lógica real vive en lib/openclaw.js y el cerebro de voz en cerebro.js.
 */

const {
  getOpenClawStatus,
  sendMessageToOpenClaw,
} = require('./lib/openclaw');

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('MORDUK core CLI\n\nUso:\n  node main.js --status\n  node main.js --send "mensaje"\n  npm start (abre la interfaz de voz en el navegador)\n  node main.js --help');
    return;
  }

  if (args.includes('--send')) {
    const message = args.slice(args.indexOf('--send') + 1).join(' ').trim();
    const result = await sendMessageToOpenClaw(message);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  const status = await getOpenClawStatus();
  console.log(JSON.stringify(status, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
    process.exit(1);
  });
}

module.exports = { getOpenClawStatus, sendMessageToOpenClaw };