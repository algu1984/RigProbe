import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWebRtcInfo } from '../dist/index.js';

const setPeer = value => Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value });
const candidate = line => ({ candidate: line, type: null, address: null, port: null, protocol: null, relatedAddress: null, relatedPort: null, url: null });

class FakePeer extends EventTarget {
  static latest;
  iceGatheringState = 'new';
  constructor() { super(); FakePeer.latest = this; }
  createDataChannel() { return {}; }
  async createOffer() { return {}; }
  async setLocalDescription() {
    for (const line of [
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

test('WebRTC probe stays opt-in and reports exposed IPv4, IPv6, mDNS and confirmed translation', async () => {
  setPeer(FakePeer);
  const result = await getWebRtcInfo();
  assert.equal(result.status, 'complete');
  assert.equal(FakePeer.latest.closed, true);
  assert.deepEqual(result.natObserved, { value: true, source: 'derived' });
  assert.deepEqual(result.candidates.value.map(item => item.family), ['ipv4', 'ipv4', 'ipv6', 'mdns']);
  assert.equal(result.candidates.value[1].type, 'srflx');
  assert.equal(result.candidates.value[1].port, 62000);
  assert.equal(result.candidates.value[1].relatedAddress, '192.168.1.7');
  for (const field of [result.candidates, result.natObserved]) assert.deepEqual(Object.keys(field).sort(), ['source', 'value']);
});

test('missing API and stalled gathering do not fabricate a NAT verdict', async () => {
  setPeer(undefined);
  const unsupported = await getWebRtcInfo();
  assert.equal(unsupported.status, 'unsupported');
  assert.deepEqual(unsupported.natObserved, { value: null, source: 'unavailable' });
  setPeer(class extends FakePeer { async setLocalDescription() {} });
  const timeout = await getWebRtcInfo(10);
  assert.equal(timeout.status, 'timeout');
  assert.equal(timeout.natObserved.value, null);
  assert.equal(FakePeer.latest.closed, true);
});
