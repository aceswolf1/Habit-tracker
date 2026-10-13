// scripts/preview/w1-screenshot-with-actions.mjs — Node 18 CDP helper that
// takes a screenshot AFTER optionally clicking elements matching a
// selector (so we can capture the Stats panel, Settings drawer, etc.).
//
// Usage: node w1-screenshot-with-actions.mjs <url> <width> <out-dir> [selector]

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("/Users/cace/Desktop/cloud-copy/projects/Habit-tracker/frontend/node_modules/ws");

const [, , URL, W_STR, OUT_DIR, CLICK_SELECTOR] = process.argv;
if (!URL || !W_STR || !OUT_DIR) {
  console.error(
    "usage: node w1-screenshot-with-actions.mjs <url> <width> <out-dir> [selector]"
  );
  process.exit(2);
}
const W = parseInt(W_STR, 10);
const OUT = OUT_DIR.endsWith("/") ? OUT_DIR : OUT_DIR + "/";

async function main() {
  const profileDir = mkdtempSync(join(tmpdir(), "w1-shot-"));
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
    { stdio: "ignore", detached: false }
  );

  await new Promise((r) => setTimeout(r, 1500));

  const targetsRes = await fetch("http://localhost:9274/json");
  const targets = await targetsRes.json();
  let target = targets.find((t) => t.type === "page");
  if (!target) {
    const r2 = await fetch("http://localhost:9274/json/new", { method: "PUT" });
    target = await r2.json();
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  function send(method, params = {}) {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return id;
  }

  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg);
    }
  });

  function call(method, params) {
    const id = send(method, params);
    return new Promise((res) => {
      pending.set(id, (msg) => res(msg.result || msg.error));
    });
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

  // Optionally click an element before screenshotting.
  if (CLICK_SELECTOR) {
    const click = await call("Runtime.evaluate", {
      expression: `(function(){
        const el = document.querySelector(${JSON.stringify(CLICK_SELECTOR)});
        if (!el) return JSON.stringify({error:'not_found'});
        el.click();
        return JSON.stringify({ok:true, tag: el.tagName, text: (el.textContent||'').trim().slice(0,80)});
      })()`,
      returnByValue: true,
    });
    if (click && click.value) {
      console.log("click", CLICK_SELECTOR, "→", JSON.parse(click.value));
    } else {
      console.log("click", CLICK_SELECTOR, "→", click);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  const metrics = await call("Page.getLayoutMetrics");
  const cssSize = (metrics && (metrics.cssContentSize || metrics.contentSize)) || {};
  const height = Math.max(800, Math.ceil(cssSize.height || 800));

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

  const suffix = CLICK_SELECTOR ? "-" + CLICK_SELECTOR.replace(/[^a-z0-9]+/gi, "_").slice(0, 30) : "";
  const outPath = `${OUT}${W}${suffix}.png`;
  writeFileSync(outPath, Buffer.from(capture.data, "base64"));
  console.log(`wrote ${outPath} (${W}px wide, ${height}px tall)`);

  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});