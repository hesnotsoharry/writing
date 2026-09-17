// Tiny Chrome DevTools helper: launch headless Chrome, open a page, evaluate expressions.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openPage(url) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'wn-ad-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
    '--window-size=1400,600', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) { chrome.kill(); throw new Error('Chrome DevTools endpoint did not come up'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluation failed');
    return r.result.result.value;
  };
  await send('Page.enable');
  await send('Page.navigate', { url });
  return {
    send, evaluate,
    async waitFor(expr, ms = 20000) { for (let t = 0; t < ms; t += 200) { if (await evaluate(expr)) return true; await sleep(200); } return false; },
    close() { ws.close(); chrome.kill(); },
  };
}
