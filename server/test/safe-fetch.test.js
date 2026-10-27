import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createSafeFetch, isPublicAddress, requestOnce } from "../lib/safe-fetch.js";

const publicDNS = async () => [{ address: "93.184.216.34", family: 4 }];
const ok = { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from("public article") };

test("reject private, reserved, mapped and alternate URL encodings before requesting", async () => {
  let requests = 0;
  const fetch = createSafeFetch({ lookup: publicDNS, request: async () => { requests++; return ok; } });
  for (const url of ["http://127.1", "http://2130706433", "http://0x7f000001", "http://0177.0.0.1",
    "http://10.0.0.1", "http://172.16.0.1", "http://192.168.0.1", "http://169.254.169.254",
    "http://0.0.0.0", "http://100.64.0.1", "http://198.18.0.1", "http://224.0.0.1",
    "http://[::1]", "http://[::ffff:127.0.0.1]", "http://[::127.0.0.1]", "http://[fd00::1]",
    "http://[fe80::1]", "http://[64:ff9b::7f00:1]", "http://[2002:7f00:1::]",
    "file:///etc/passwd", "https://user:password@news.example", "http://news.example:8080"]) {
    await assert.rejects(fetch(url), undefined, url);
  }
  assert.equal(requests, 0);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});

test("mixed DNS results and rebinding redirects are rejected", async () => {
  let requests = 0;
  const mixed = createSafeFetch({ lookup: async () => [...await publicDNS(), { address: "::1", family: 6 }], request: async () => { requests++; return ok; } });
  await assert.rejects(mixed("https://news.example"), /public/);
  assert.equal(requests, 0);
  let lookups = 0;
  const rebound = createSafeFetch({ lookup: async () => ++lookups === 1 ? publicDNS() : [{ address: "127.0.0.1", family: 4 }],
    request: async (_url, pinned) => {
      assert.equal(pinned.address, "93.184.216.34"); requests++;
      return { status: 302, headers: { location: "/second" }, body: Buffer.alloc(0) };
    } });
  await assert.rejects(rebound("https://news.example"), /public/);
  assert.equal(requests, 1); assert.equal(lookups, 2);
});

test("every redirect target is validated, including protocol-relative redirects", async () => {
  for (const location of ["http://127.0.0.1", "//169.254.169.254/latest", "http://[::1]", "file:///secret"]) {
    let requests = 0;
    const fetch = createSafeFetch({ lookup: publicDNS, request: async () => {
      requests++; return { status: 302, headers: { location }, body: Buffer.alloc(0) };
    } });
    await assert.rejects(fetch("https://publisher.example")); assert.equal(requests, 1);
  }
});

test("public content, relative redirects, final URL and POST conversion are preserved", async () => {
  const calls = [];
  const fetch = createSafeFetch({ lookup: publicDNS, request: async (url, pinned, init) => {
    calls.push({ url: url.href, pinned, init });
    return calls.length === 1 ? { status: 303, headers: { location: "/article" }, body: Buffer.alloc(0) } : ok;
  } });
  const res = await fetch("https://publisher.example/start", { method: "POST", body: "query", headers: { "content-type": "text/plain" } });
  assert.equal(await res.text(), "public article"); assert.equal(res.url, "https://publisher.example/article");
  assert.equal(calls[1].init.method, "GET"); assert.equal(calls[1].init.body, undefined);
  assert.equal(new URL("photo.jpg", res.url).href, "https://publisher.example/photo.jpg");
  assert.equal(calls[1].pinned.address, "93.184.216.34");
});

test("native transport pins the connection while preserving Host, and bounds response bytes", async t => {
  const hosts = [];
  const server = http.createServer((req, res) => { hosts.push(req.headers.host); res.end("bounded-content"); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = new URL(`http://must-not-resolve.invalid:${server.address().port}/article`);
  const options = { method: "GET", headers: {}, maxBytes: 100, signal: AbortSignal.timeout(1000) };
  const res = await requestOnce(url, { address: "127.0.0.1", family: 4 }, options);
  assert.equal(res.body.toString(), "bounded-content");
  assert.equal(hosts[0], url.host);
  await assert.rejects(requestOnce(url, { address: "127.0.0.1", family: 4 }, { ...options, maxBytes: 4 }), /too large/);
  // The production policy blocks this same local destination before transport.
  const guarded = createSafeFetch({ lookup: async () => [{ address: "127.0.0.1", family: 4 }] });
  await assert.rejects(guarded("http://must-not-resolve.invalid"), /public/);
  assert.equal(hosts.length, 2);
});
