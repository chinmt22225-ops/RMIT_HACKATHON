import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { get as httpGet, type IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const reserved = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) reserved.addSubnet(network, prefix, "ipv4");
const globalV6 = new BlockList(); globalV6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) reserved.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return !reserved.check(address, "ipv4");
  return version === 6 && globalV6.check(address, "ipv6") && !reserved.check(address, "ipv6");
}

export async function readPublicArticle(input: string): Promise<{ url: URL; html: string }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(20_000);
  for (let redirect = 0; redirect < 4; redirect++) {
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port && !["80", "443"].includes(url.port)) throw new Error("Use a public HTTP or HTTPS article URL.");
    signal.throwIfAborted();
    const addresses = await new Promise<Awaited<ReturnType<typeof lookup>>[]>((resolve, reject) => {
      const onAbort = () => reject(new Error("The article took too long to respond. Try pasting its text."));
      signal.addEventListener("abort", onAbort, { once: true });
      lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true }).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Only public article URLs can be imported.");
    const address = addresses.find(({ family }) => family === 4) || addresses[0];
    // Connect to the validated address without a second DNS lookup. Preserve the
    // original hostname for TLS certificate verification and the HTTP Host header.
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [address]); else callback(null, address.address, address.family);
    };
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const outgoing = (url.protocol === "https:" ? httpsGet : httpGet)(url, {
        lookup: pinnedLookup, family: address.family, agent: false, signal,
        headers: { "User-Agent": "Margin/0.1 article-reader", Accept: "text/html" },
      }, resolve);
      outgoing.on("error", reject);
    });
    const status = response.statusCode || 0;
    if (status >= 300 && status < 400) {
      response.destroy();
      if (!response.headers.location) throw new Error("Article redirected without a destination.");
      url = new URL(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) { response.destroy(); throw new Error("This page could not be imported. Try pasting its text instead."); }
    if (!response.headers["content-type"]?.includes("text/html")) { response.destroy(); throw new Error("Use an article URL, or upload a PDF or text file."); }
    const encoding = response.headers["content-encoding"];
    const decompress = encoding === "gzip" ? createGunzip() : encoding === "br" ? createBrotliDecompress() : encoding === "deflate" ? createInflate() : null;
    if (encoding && encoding !== "identity" && !decompress) { response.destroy(); throw new Error("Unsupported article encoding. Paste its text instead."); }
    const stream = decompress ? response.pipe(decompress) : response;
    if (decompress) response.once("error", (error) => decompress.destroy(error));
    const chunks: Buffer[] = []; let bytes = 0;
    try {
      for await (const chunk of stream) {
        const buffer = Buffer.from(chunk); bytes += buffer.byteLength;
        if (bytes > 3_000_000) throw new Error("Page is too large. Paste the relevant passage instead.");
        chunks.push(buffer);
      }
      return { url, html: Buffer.concat(chunks).toString("utf8") };
    } finally { stream.destroy(); response.destroy(); }
  }
  throw new Error("This article has too many redirects. Paste its text instead.");
}
