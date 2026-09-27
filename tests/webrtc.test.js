import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWebRtcInfo } from '../dist/index.js';

const setPeer = value => Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value });
const setFetch = value => Object.defineProperty(globalThis, 'fetch', { configurable: true, value });
const candidate = line => ({ candidate: line, type: null, address: null, port: null, protocol: null, relatedAddress: null, relatedPort: null });

class FakePeer extends EventTarget {
  static peers = [];
  iceGatheringState = 'new';
  constructor(configuration) {
    super();
    this.url = configuration.iceServers[0].urls;
    FakePeer.peers.push(this);
  }
  createDataChannel() { return {}; }
  async createOffer() { return {}; }
  async setLocalDescription() {
    if (this.url.includes('cloudflare')) this.dispatchEvent(new Event('icecandidateerror'));
    else for (const line of [
      'candidate:1 1 udp 1 192.168.1.7 51000 typ host',
      'candidate:2 1 udp 1 203.0.113.9 62000 typ srflx raddr 192.168.1.7 rport 51000',
      'candidate:3 1 udp 1 2001:db8::7 51001 typ host',
      'candidate:4 1 udp 1 browser.local 51002 typ host'
    ]) this.dispatchEvent(Object.assign(new Event('icecandidate'), { candidate: candidate(line) }));
    this.iceGatheringState = 'complete';
    this.dispatchEvent(new Event('icegatheringstatechange'));
  }
  close() { this.closed = true; }
}

test('isolated STUN checks report each server and never return local addresses', async () => {
  FakePeer.peers = [];
  setPeer(FakePeer);
  setFetch(async (url, options) => {
    assert.equal(url, 'https://api6.ipify.org/');
    assert.equal(options.mode, 'no-cors');
    return { type: 'opaque' };
  });
  const result = await getWebRtcInfo();
  assert.equal(FakePeer.peers.length, 2);
  assert.ok(FakePeer.peers.every(peer => peer.closed));
  assert.deepEqual(result.servers.map(server => server.name), ['Google', 'Cloudflare']);
  const [google, cloudflare] = result.servers;
  assert.equal(google.status, 'complete');
  assert.deepEqual(google.natObserved, { value: true, source: 'derived' });
  assert.deepEqual(google.natIndicated, { value: true, source: 'derived' });
  assert.deepEqual(result.ipv6Reachable, { value: true, source: 'measured' });
  assert.deepEqual(google.ipv6Observed, { value: true, source: 'measured' });
  assert.deepEqual(google.stunAddresses.value, [{ address: '203.0.113.9', port: 62000, family: 'ipv4', protocol: 'udp' }]);
  assert.equal(cloudflare.status, 'error');
  assert.equal(cloudflare.stunAddresses.value, null);
  for (const privateAddress of ['192.168.1.7', '2001:db8::7', 'browser.local'])
    assert.equal(JSON.stringify(result).includes(privateAddress), false);
  for (const field of [google.stunAddresses, google.ipv6Observed, google.natObserved, google.natIndicated, result.ipv6Reachable])
    assert.deepEqual(Object.keys(field).sort(), ['source', 'value']);
});

test('missing API and stalled gathering do not fabricate addresses or NAT verdicts', async () => {
  setPeer(undefined);
  setFetch(async () => { throw new TypeError('Network blocked'); });
  const unsupported = await getWebRtcInfo();
  assert.ok(unsupported.servers.every(server => server.status === 'unsupported' && server.natObserved.value === null));
  assert.deepEqual(unsupported.ipv6Reachable, { value: null, source: 'unavailable' });
  FakePeer.peers = [];
  setPeer(class extends FakePeer { async setLocalDescription() {} });
  const timeout = await getWebRtcInfo(10);
  assert.ok(timeout.servers.every(server => server.status === 'timeout' && server.natObserved.value === null));
  assert.ok(FakePeer.peers.every(peer => peer.closed));
});


test('reflexive address suggests NAT even when the browser hides its base address', async () => {
  setFetch(async () => { throw new TypeError('Network blocked'); });
  setPeer(class extends FakePeer {
    async setLocalDescription() {
      this.dispatchEvent(Object.assign(new Event('icecandidate'), {
        candidate: candidate('candidate:2 1 udp 1 203.0.113.9 62000 typ srflx raddr 0.0.0.0 rport 9')
      }));
      this.iceGatheringState = 'complete';
      this.dispatchEvent(new Event('icegatheringstatechange'));
    }
  });
  const result = await getWebRtcInfo();
  assert.equal(result.servers[0].natObserved.value, null);
  assert.deepEqual(result.servers[0].natIndicated, { value: true, source: 'derived' });
});
