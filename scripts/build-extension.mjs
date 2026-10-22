import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");
for (const file of readdirSync("extension").filter((file) => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", `extension/${file}`]);
mkdirSync("public", { recursive: true });
execFileSync("zip", ["-j", "-q", "public/margin-extension.zip", ...readdirSync("extension").filter((file) => /\.(json|js|html|css)$/.test(file)).map((file) => `extension/${file}`)]);
console.log(`Packaged Margin extension ${manifest.version} in public/margin-extension.zip`);
