import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import ipaddr from "ipaddr.js";

export function isPublicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    // Reject transition mechanisms as well as private, reserved and local ranges.
    if (ip.range() !== "unicast") return false;
    if (ip.kind() === "ipv4") return !ip.match(ipaddr.parse("198.18.0.0"), 15);
    return ip.match(ipaddr.parse("2000::"), 3) && !ip.match(ipaddr.parse("2001::"), 23);
  } catch { return false; }
}

export async function resolvePublic(url, lookup = dns.lookup) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsafe outbound URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const answers = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(a => !isPublicAddress(a.address))) throw new Error("Outbound destination must be public");
  return answers[0];
}

export function requestOnce(url, pinned, { signal, method, headers, body, maxBytes }) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, {
      method, headers, signal, agent: false,
      // Connect to the address we checked; retain the original Host and TLS SNI.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family),
    }, res => {
      const chunks = [];
      let size = 0;
      res.on("error", reject);
      res.on("data", chunk => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(new Error("Outbound response too large")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

// Dependency injection is only for deterministic offline transport tests.
export function createSafeFetch({ lookup = dns.lookup, request = requestOnce } = {}) {
  return async function safeFetch(input, init = {}) {
    const signal = AbortSignal.any([AbortSignal.timeout(10000), ...(init.signal ? [init.signal] : [])]);
    let url = new URL(input), method = init.method || "GET", body = init.body;
    const headers = new Headers(init.headers);
    // This client buffers bounded responses, and never asks for compressed data.
    headers.set("accept-encoding", "identity");
    for (let hops = 0; hops <= 5; hops++) {
      signal.throwIfAborted();
      const pinned = await new Promise((resolve, reject) => {
        const aborted = () => reject(signal.reason);
        signal.addEventListener("abort", aborted, { once: true });
        resolvePublic(url, lookup).then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
      });
      signal.throwIfAborted();
      const result = await request(url, pinned, { signal, method, body, headers: Object.fromEntries(headers), maxBytes: init.maxBytes || 8 * 1024 * 1024 });
      if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
        if (hops === 5) throw new Error("Too many outbound redirects");
        const next = new URL(result.headers.location, url);
        if (next.origin !== url.origin) { headers.delete("authorization"); headers.delete("cookie"); }
        if (result.status === 303 || ([301, 302].includes(result.status) && method === "POST")) {
          method = "GET"; body = undefined; headers.delete("content-type"); headers.delete("content-length");
        }
        url = next;
        continue;
      }
      if (result.headers["content-encoding"] && result.headers["content-encoding"] !== "identity") throw new Error("Unsupported content encoding");
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(result.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
      const response = new Response([204, 205, 304].includes(result.status) ? null : result.body, { status: result.status, headers: responseHeaders });
      Object.defineProperty(response, "url", { value: url.href });
      return response;
    }
  };
}
export const safeFetch = createSafeFetch();
