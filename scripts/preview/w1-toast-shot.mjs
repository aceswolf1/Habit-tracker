// scripts/preview/w1-toast-shot.mjs — open the Task modal, fill in the
// description, submit, then screenshot the resulting success toast.

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("/Users/cace/Desktop/cloud-copy/projects/Habit-tracker/frontend/node_modules/ws");

const [, , URL, W_STR, OUT] = process.argv;
if (!URL || !W_STR || !OUT) {
  console.error("usage: node w1-toast-shot.mjs <url> <width> <out-png>");
  process.exit(2);
}
const W = parseInt(W_STR, 10);

async function main() {
  const profileDir = mkdtempSync(join(tmpdir(), "w1-toast-"));
  const chrome = spawn(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      "--remote-debugging-port=9274",
      "--user-data-dir=" + profileDir,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-features=DialMediaRouteProvider",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  await new Promise((r) => setTimeout(r, 1500));
  const targets = await (await fetch("http://localhost:9274/json")).json();
  let target = targets.find((t) => t.type === "page");
  if (!target)
    target = await (
      await fetch("http://localhost:9274/json/new", { method: "PUT" })
    ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  function send(m, p = {}) {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method: m, params: p }));
    return id;
  }
  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) {
      const cb = pending.get(m.id);
      pending.delete(m.id);
      cb(m);
    }
  });
  function call(m, p) {
    const id = send(m, p);
    return new Promise((res) => pending.set(id, (msg) => res(msg.result || msg.error)));
  }

  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: W,
    height: 900,
    deviceScaleFactor: 1,
    mobile: W < 768,
  });
  await call("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 3000));

  // Inject a toast by adding it to the ToastNotification component's exposed
  // `add()` method. Since the component doesn't keep a global ref, we
  // hook into the notify adapter that's exposed via `window.__notifyToast`
  // (debug helper we'll set up via a small `app.vue` patch? Easier: fire
  // the success by actually creating a task through the modal.)

  // 1. Click NEW HABIT to open the modal.
  await call("Runtime.evaluate", {
    expression: "document.querySelector(\"[aria-label='NEW HABIT']\").click()",
  });
  await new Promise((r) => setTimeout(r, 800));

  // 2. Fill the description input.
  await call("Runtime.evaluate", {
    expression: `
      (function() {
        const input = document.querySelector('.task-modal-sheet input.tm-input');
        if (!input) return 'no input';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Drink water');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
      })()
    `,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 300));

  // 3. Click START QUEST.
  await call("Runtime.evaluate", {
    expression: `
      (function() {
        const btns = Array.from(document.querySelectorAll('.task-modal-sheet button.task-btn'));
        const start = btns.find(b => b.textContent.includes('START QUEST'));
        if (!start) return 'no start';
        start.click();
        return 'clicked';
      })()
    `,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const metrics = await call("Page.getLayoutMetrics");
  const height = Math.max(
    800,
    Math.ceil(((metrics.cssContentSize || metrics.contentSize) || {}).height || 800)
  );
  const capture = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: {
      x: 0,
      y: 0,
      width: W,
      height: Math.min(height, 4000),
      scale: 1,
    },
  });
  writeFileSync(OUT, Buffer.from(capture.data, "base64"));
  console.log("wrote", OUT);
  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});