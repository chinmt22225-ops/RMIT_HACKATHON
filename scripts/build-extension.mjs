import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");
for (const file of readdirSync("extension").filter((file) => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", `extension/${file}`]);
mkdirSync("artifacts", { recursive: true });
// The package is for the store's developer dashboard, never a user download.
rmSync("public/margin-extension.zip", { force: true });
rmSync("artifacts/margin-extension.zip", { force: true });
for (const browser of ["chrome", "firefox"]) {
  const directory = `artifacts/extension-${browser}`;
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  for (const file of readdirSync("extension").filter(file => !file.startsWith("manifest"))) cpSync(`extension/${file}`, `${directory}/${file}`, { recursive: true });
  const config = browser === "chrome" ? manifest : JSON.parse(readFileSync("extension/manifest.firefox.json", "utf8"));
  writeFileSync(`${directory}/manifest.json`, JSON.stringify(config, null, 2) + "\n");
  const filename = `margin-${browser}.${browser === "chrome" ? "zip" : "unsigned.xpi"}`;
  rmSync(`artifacts/${filename}`, { force: true });
  execFileSync(process.execPath, [resolve("node_modules/web-ext/bin/web-ext.js"), "build", "--source-dir", directory, "--artifacts-dir", "artifacts", "--filename", filename, "--overwrite-dest", "--no-config-discovery"], { stdio: "pipe" });
  console.log(`${browser}: ${directory}/ for development; artifacts/${filename} for store submission. Not a signed public release.`);
}
