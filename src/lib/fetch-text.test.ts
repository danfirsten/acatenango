import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { MAX_BYTES, checkBulletinUrl, fetchWithRetry } from './fetch-text';

describe('checkBulletinUrl', () => {
  it('accepts an https address on INSIVUMEH', () => {
    assert.equal(checkBulletinUrl('https://insivumeh.gob.gt/x.pdf').hostname, 'insivumeh.gob.gt');
    assert.equal(checkBulletinUrl('https://www.insivumeh.gob.gt/x.pdf').hostname, 'www.insivumeh.gob.gt');
  });

  for (const bad of [
    'http://insivumeh.gob.gt/x.pdf',
    'data:application/pdf;base64,AAAA',
    'file:///etc/passwd',
    'https://insivumeh.gob.gt.example.com/x.pdf',
    'https://evilinsivumeh.gob.gt/x.pdf',
    'https://example.com/?insivumeh.gob.gt',
    'not a url',
  ]) {
    it(`refuses ${bad}`, () => assert.throws(() => checkBulletinUrl(bad)));
  }
});

describe('fetchWithRetry', () => {
  async function serve(handler: Parameters<typeof createServer>[1]) {
    let hits = 0;
    const srv = createServer((req, res) => { hits += 1; handler!(req, res); });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`;
    return { url, hits: () => hits, close: () => { srv.closeAllConnections(); return new Promise((r) => srv.close(r)); } };
  }

  it('refuses an oversized body without retrying', async () => {
    const s = await serve((_q, res) => { res.writeHead(200, { 'content-length': String(MAX_BYTES + 1) }); res.flushHeaders(); });
    await assert.rejects(fetchWithRetry(s.url), /over the/);
    assert.equal(s.hits(), 1);
    await s.close();
  });

  it('does not retry a 404', async () => {
    const s = await serve((_q, res) => res.writeHead(404).end());
    await assert.rejects(fetchWithRetry(s.url), /returned 404/);
    assert.equal(s.hits(), 1);
    await s.close();
  });
});
