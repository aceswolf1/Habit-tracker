// scripts/preview/cdp-screenshot.mjs — single-shot CDP screenshot helper.
//
// Flow:
//   1. Open CDP WebSocket to a freshly-created page target.
//   2. Page.enable + Runtime.enable + Emulation.setDeviceMetricsOverride.
//   3. Page.navigate(URL).
//   4. Wait for Page.loadEventFired, then poll Runtime.evaluate until the
//      body shows distinctive cycle content (not "LOADING WORLD") or a
//      generous timeout elapses.
//   5. Page.captureScreenshot with captureBeyondViewport.

import { writeFileSync } from 'node:fs';

const [, , WS_URL, URL, W_STR, OUT_PNG] = process.argv;
if (!WS_URL || !URL || !W_STR || !OUT_PNG) {
  console.error('usage: node cdp-screenshot.mjs <ws-url> <url> <width> <out-png>');
  process.exit(2);
}
const W = parseInt(W_STR, 10);

const ws = new WebSocket(WS_URL);
let nextId = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return id;
}

function captureScreenshot() {
  // Measure the full document height first, then clip to
  // (viewport WIDTH × full document HEIGHT). Clipping the width keeps
  // off-canvas elements like the closed Settings drawer
  // (fixed + translateX(110%)) out of the PNG.
  const metricsId = send('Page.getLayoutMetrics');
  pending.set(metricsId, (mm) => {
    const size = (mm.result && (mm.result.cssContentSize || mm.result.contentSize)) || {};
    const height = Math.max(800, Math.ceil(size.height || 800));
    doCapture(height);
  });
}

function doCapture(height) {
  const id = send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: W, height, scale: 1 },
    captureBeyondViewport: true,
    fromSurface: true,
  });
  pending.set(id, (m) => {
    if (m.result && m.result.data) {
      writeFileSync(OUT_PNG, Buffer.from(m.result.data, 'base64'));
      console.log('  wrote ' + OUT_PNG);
      ws.close();
      process.exit(0);
    }
    console.error('no data', m);
    process.exit(12);
  });
}

ws.addEventListener('error', (e) => {
  console.error('ws error', e && e.message);
  process.exit(11);
});

ws.addEventListener('open', () => {
  send('Page.enable');
  send('Runtime.enable');
  send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: 800,
    deviceScaleFactor: 1,
    mobile: W <= 768,
  });
  send('Page.navigate', { url: URL });
});

ws.addEventListener('message', (evt) => {
  const msg = JSON.parse(String(evt.data));
  if (msg.id && pending.has(msg.id)) {
    const cb = pending.get(msg.id);
    pending.delete(msg.id);
    cb(msg);
    return;
  }
  if (msg.method === 'Page.loadEventFired') {
    // Poll for distinctive cycle content. Nuxt SSR + Pinia hydration +
    // first /api/cycles fetch take ~25 s on a cold dev server; headless
    // Chrome alone doesn't force the reactivity cycle without user
    // interaction. We poll for up to 45 s (200 ms × 225 polls) so the
    // dev-server case is well covered; an explicit LOADING-WORLD timeout
    // warning fires at 45 s so we still surface a real hang.
    let polls = 0;
    const poll = () => {
      polls += 1;
      const id = send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.body ? document.body.innerText : '';
          const up = el.toUpperCase();
          const looksLoading = up.includes('LOADING WORLD');
          const looksLoaded = !looksLoading && (
            up.includes('WEEK 1') ||
            up.includes('OVERALL PROGRESS') ||
            !!document.querySelector('[data-task-uuid], .task, button[aria-label*="oggle" i]')
          );
          return JSON.stringify({ looksLoaded, looksLoading, len: el.length });
        })()`,
        returnByValue: true,
      });
      pending.set(id, (m) => {
        const v = (m.result && m.result.value) || '{}';
        let parsed;
        try { parsed = JSON.parse(v); } catch { parsed = { looksLoading: true }; }
        if (parsed.looksLoaded) {
          setTimeout(captureScreenshot, 300);
          return;
        }
        if (polls > 225) {
          console.error('  WARNING: page still shows LOADING WORLD after 45s, capturing as-is');
          setTimeout(captureScreenshot, 200);
          return;
        }
        if (polls === 12 || polls === 60) {
          // Nudge reactivity once or twice in case Vue settled on a stale
          // render. These events are no-ops visually.
          send('Runtime.evaluate', {
            expression: `(() => {
              window.dispatchEvent(new Event('focus'));
              window.dispatchEvent(new Event('resize'));
              document.body.offsetHeight;
            })()`,
            returnByValue: true,
          });
        }
        setTimeout(poll, 200);
      });
    };
    poll();
  }
});

setTimeout(() => {
  console.error('timeout after 120s');
  process.exit(13);
}, 120000);