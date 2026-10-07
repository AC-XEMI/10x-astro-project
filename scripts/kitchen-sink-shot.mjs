// Kitchen-sink screenshot: full-page PNG of one URL at one viewport width, for the visual gate of
// a UI change (e.g. context/changes/<change-id>/screenshots/kitchen-sink-{desktop,390}.png).
// Usage: node scripts/kitchen-sink-shot.mjs <url> <width> <out.png>
// Zero dependencies: launches the locally installed Chrome headless and drives it over the
// Chrome DevTools Protocol with Node's global fetch + WebSocket (Node >= 22). Chrome headless on
// Windows ignores window widths under ~485px, so the width is set with CDP device emulation
// (Emulation.setDeviceMetricsOverride) instead of --window-size. Chrome path: CHROME_PATH env,
// default "C:/Program Files/Google/Chrome/Application/chrome.exe".
// Prints {out, vw, sw, h}: vw = clientWidth, sw = scrollWidth (sw > vw means horizontal overflow),
// h = full page height captured.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATH = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const VIEWPORT_HEIGHT = 900;

const [url, widthArg, out] = process.argv.slice(2);
const width = Number(widthArg);
if (!url || !out || !Number.isInteger(width) || width <= 0) {
  console.error("Usage: node scripts/kitchen-sink-shot.mjs <url> <width> <out.png>");
  process.exit(1);
}
if (!existsSync(CHROME_PATH)) {
  console.error(`Chrome not found at ${CHROME_PATH} - set CHROME_PATH.`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const profileDir = mkdtempSync(join(tmpdir(), "kitchen-sink-shot-"));
const chrome = spawn(CHROME_PATH, [
  "--headless=new",
  "--no-proxy-server",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
]);

function cleanup() {
  chrome.kill();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome may still hold the profile for a moment; a leftover temp dir is harmless.
  }
}

function fail(message) {
  console.error(message);
  cleanup();
  process.exit(1);
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // DevTools endpoint not up yet.
    }
    await sleep(200);
  }
  return null;
}

try {
  const page = await findPageTarget();
  if (!page) fail(`No page target on the DevTools port ${port} - did Chrome start?`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => {
      reject(new Error("WebSocket connection to Chrome failed"));
    });
  });

  let nextId = 0;
  const pending = new Map();
  const events = new Set();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) {
      events.add(message.method);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) => {
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const setViewport = (height) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });

  await setViewport(VIEWPORT_HEIGHT);
  await send("Page.enable");
  await send("Page.navigate", { url });
  for (let i = 0; i < 100 && !events.has("Page.loadEventFired"); i++) await sleep(100);
  if (!events.has("Page.loadEventFired")) fail(`Page did not finish loading within 10 s: ${url}`);
  await sleep(1500); // let client:load islands hydrate

  const evaluated = await send("Runtime.evaluate", {
    expression:
      "JSON.stringify({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })",
    returnByValue: true,
  });
  const metrics = JSON.parse(evaluated.result.value);

  await setViewport(metrics.h);
  await sleep(500);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(shot.data, "base64"));

  console.log(JSON.stringify({ out, ...metrics }));
  ws.close();
  cleanup();
  process.exit(0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
