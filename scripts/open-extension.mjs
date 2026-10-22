import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const browser = process.argv[2] || "chrome";
if (!["chrome", "firefox"].includes(browser)) throw new Error("Use npm run extension:open -- chrome (or firefox).");
execFileSync(process.execPath, ["scripts/build-extension.mjs"], { stdio: "inherit" });
const extension = resolve(`artifacts/extension-${browser}`);
const profile = resolve(`.runtime/demo-${browser}-profile`);
mkdirSync(profile, { recursive: true, mode: 0o700 });
function findBinary(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (existsSync(candidate)) return candidate;
    try { return execFileSync(process.platform === "win32" ? "where" : "which", [candidate], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/)[0]; } catch {}
  }
  throw new Error(`Browser not found. Set ${browser === "chrome" ? "CHROMIUM_PATH" : "FIREFOX_PATH"} to its executable.`);
}
let command, args;
if (browser === "firefox") {
  command = process.execPath;
  args = [resolve("node_modules/web-ext/bin/web-ext.js"), "run", "--source-dir", extension, "--firefox", findBinary([process.env.FIREFOX_PATH, "firefox", "librewolf", "/Applications/Firefox.app/Contents/MacOS/firefox.exe", "/Applications/Firefox.app/Contents/MacOS/firefox"]), "--firefox-profile", profile, "--keep-profile-changes", "--start-url", "http://localhost:3000", "--no-reload"];
} else {
  // Chrome's branded releases restrict this switch; Chromium/Chrome for Testing support it.
  command = findBinary([process.env.CHROMIUM_PATH, "chromium", "chromium-browser", "/Applications/Chromium.app/Contents/MacOS/Chromium"]);
  args = [`--user-data-dir=${profile}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--no-first-run", "http://localhost:3000"];
}
console.log(`Opening the ${browser} development demo in its own profile. Your normal profile is untouched.`);
console.log("This is a local development load. Firefox removes the temporary add-on when the demo browser closes; run this command again next time.");
const child = spawn(command, args, { stdio: "inherit", shell: false });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code || 0; });
