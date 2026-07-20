const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const email = process.env.JOTW_EMAIL;
const password = process.env.JOTW_PASSWORD;
const baseUrl = process.env.JOTW_WEB_URL || 'http://localhost:8081';
const apiUrl = process.env.JOTW_API_URL || 'http://49.12.189.108:3000';
const chromePath = process.env.CHROME_PATH
  || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe');

if (!email || !password) throw new Error('Missing JOTW_EMAIL or JOTW_PASSWORD');
if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found at ${chromePath}`);

const outDir = path.join(__dirname, 'screenshots', 'real');
const userDataDir = path.join(__dirname, '.chrome-capture-profile');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: ok, reject: bad } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? bad(new Error(JSON.stringify(msg.error))) : ok(msg.result);
        } else if (msg.method) {
          this.events.push(msg);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

async function getDestination(token) {
  const queries = ['Afula', 'עפולה', 'Jerusalem', 'ירושלים'];
  for (const q of queries) {
    try {
      const res = await fetch(`${apiUrl}/destinations?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.items || data.data || data.results || [];
      if (list.length) {
        return list.find((d) => String(d.city || '').toLowerCase().includes('afula') || String(d.city || '').includes('עפולה')) || list[0];
      }
    } catch {}
  }
  try {
    const res = await fetch(`${apiUrl}/destinations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.items || data.data || data.results || [];
      if (list.length) return list[0];
    }
  } catch {}
  throw new Error('Could not find destination from API');
}

async function navigate(cdp, url, settleMs = 3500) {
  await cdp.send('Page.navigate', { url });
  await sleep(settleMs);
  const overlay = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `Boolean(document.body && /Runtime Error|Metro error|Unable to resolve|Cannot read/.test(document.body.innerText))`,
  });
  if (overlay.result.value) throw new Error(`Expo error overlay on ${url}`);
}

async function evalJs(cdp, expression, awaitPromise = false) {
  return cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
}

async function setInput(cdp, index, value) {
  const literal = JSON.stringify(value);
  await evalJs(cdp, `
    (() => {
      const input = document.querySelectorAll('input')[${index}];
      if (!input) throw new Error('missing input ${index}');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${literal});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return input.value;
    })()
  `);
}

async function clickText(cdp, textPattern) {
  const pattern = JSON.stringify(textPattern);
  return evalJs(cdp, `
    (() => {
      const re = new RegExp(${pattern}, 'i');
      const nodes = [...document.querySelectorAll('button,[role=button],a,div,span')].reverse();
      const node = nodes.find((el) => re.test((el.innerText || el.textContent || '').trim()));
      if (!node) return false;
      node.click();
      return true;
    })()
  `);
}

async function screenshot(cdp, name) {
  await sleep(2500);
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'));
  console.log(`saved ${name}.png`);
}

(async () => {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--window-size=390,844',
    '--force-device-scale-factor=2',
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const targets = await waitForJson('http://127.0.0.1:9222/json');
    const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error('Could not find Chrome page target');
    const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await navigate(cdp, `${baseUrl}/login`, 4000);
    await evalJs(cdp, `
      localStorage.setItem('language', 'he');
      localStorage.setItem('AsyncStorage:language', 'he');
      localStorage.setItem('hostingDisclaimerAccepted', 'true');
      localStorage.setItem('AsyncStorage:hostingDisclaimerAccepted', 'true');
    `);
    await navigate(cdp, `${baseUrl}/login`, 4000);
    await setInput(cdp, 0, email);
    await setInput(cdp, 1, password);
    const clicked = await clickText(cdp, 'התחברות|Sign In');
    if (!clicked.result.value) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    }
    await sleep(9000);

    const loginState = await evalJs(cdp, `({ href: location.href, text: document.body.innerText.slice(0, 500) })`);
    if (String(loginState.result.value.href).includes('/login')) {
      throw new Error(`Still on login page: ${JSON.stringify(loginState.result.value)}`);
    }

    const tokenResult = await evalJs(cdp, `localStorage.getItem('token') || localStorage.getItem('AsyncStorage:token') || ''`);
    const token = tokenResult.result.value;
    if (!token) throw new Error('Login succeeded but token was not found in localStorage');

    const destination = await getDestination(token);
    const id = destination.id;
    const city = destination.city || 'Afula';
    const cityParam = encodeURIComponent(city);

    const shots = [
      ['01-home', `${baseUrl}/`],
      ['02-destination', `${baseUrl}/destination/${id}`],
      ['03-restaurants', `${baseUrl}/restaurants/${id}?city=${cityParam}`],
      ['04-synagogues', `${baseUrl}/synagogues/${id}?city=${cityParam}`],
      ['05-community-feed', `${baseUrl}/chat/${id}?city=${cityParam}`],
      ['06-hosting-hub', `${baseUrl}/hosting/${id}?city=${cityParam}`],
      ['07-hosting-activity', `${baseUrl}/hosting/my-requests?destinationId=${id}&city=${cityParam}`],
    ];

    for (const [name, url] of shots) {
      await navigate(cdp, url, 5500);
      await screenshot(cdp, name);
    }

    cdp.close();
  } finally {
    chrome.kill();
  }
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
