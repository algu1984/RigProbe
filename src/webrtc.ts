import type { DetectedValue } from './types.js';

export interface WebRtcStunAddress {
  address: string;
  port: number | null;
  family: 'ipv4' | 'ipv6';
  protocol: 'udp' | 'tcp' | null;
}

export interface WebRtcStunServerResult {
  name: string;
  url: string;
  status: 'complete' | 'no-address' | 'timeout' | 'unsupported' | 'error';
  /** STUN-mapped addresses only; local host addresses are never returned. */
  stunAddresses: DetectedValue<WebRtcStunAddress[]>;
  /** True if any numeric IPv6 ICE candidate was seen, including an undisclosed host candidate. */
  ipv6Observed: DetectedValue<boolean>;
  /** True only when a reflexive candidate exposes a different base address or port. Null is inconclusive. */
  natObserved: DetectedValue<boolean>;
}

export interface WebRtcInfo {
  servers: WebRtcStunServerResult[];
}

const servers = [
  { name: 'Google', url: 'stun:stun.l.google.com:19302' },
  { name: 'Cloudflare', url: 'stun:stun.cloudflare.com:3478' }
] as const;
const unavailable = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const measured = <T>(value: T): DetectedValue<T> => ({ value, source: 'measured' });
const derived = <T>(value: T): DetectedValue<T> => ({ value, source: 'derived' });

type AddressFamily = 'ipv4' | 'ipv6' | 'mdns' | 'unknown';
function family(address: string): AddressFamily {
  if (address.toLowerCase().endsWith('.local')) return 'mdns';
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address) &&
      address.split('.').every(part => Number(part) <= 255)) return 'ipv4';
  if (/^[0-9a-f:]+(?:%[a-z0-9_.-]+)?$/i.test(address) && address.includes(':')) return 'ipv6';
  return 'unknown';
}

interface ParsedCandidate {
  address: string;
  port: number | null;
  family: AddressFamily;
  type: 'host' | 'srflx';
  protocol: 'udp' | 'tcp' | null;
  relatedAddress: string | null;
  relatedPort: number | null;
}

function parse(candidate: RTCIceCandidate): ParsedCandidate | null {
  const fields = candidate.candidate.trim().split(/\s+/);
  const type = candidate.type ?? fields[fields.indexOf('typ') + 1];
  if (type !== 'host' && type !== 'srflx') return null;
  const address = candidate.address ?? fields[4];
  if (!address) return null;
  const numericPort = Number(fields[5]);
  const port = candidate.port ?? (Number.isInteger(numericPort) && numericPort > 0 && numericPort <= 65535 ? numericPort : null);
  const rawProtocol = candidate.protocol ?? fields[2]?.toLowerCase();
  const protocol = rawProtocol === 'udp' || rawProtocol === 'tcp' ? rawProtocol : null;
  const rawRelated = fields[fields.indexOf('raddr') + 1];
  const related = candidate.relatedAddress ?? (fields.includes('raddr') ? rawRelated : null);
  const rawRelatedPort = Number(fields[fields.indexOf('rport') + 1]);
  const relatedPort = candidate.relatedPort ?? (fields.includes('rport') && Number.isInteger(rawRelatedPort) && rawRelatedPort > 0 && rawRelatedPort <= 65535 ? rawRelatedPort : null);
  return {
    address, port, family: family(address), type, protocol,
    relatedAddress: related && family(related) !== 'unknown' && related !== '0.0.0.0' && related !== '::' ? related : null,
    relatedPort
  };
}

function checkServer(server: typeof servers[number], timeoutMs: number): Promise<WebRtcStunServerResult> {
  if (typeof RTCPeerConnection === 'undefined') return Promise.resolve({
    ...server, status: 'unsupported', stunAddresses: unavailable(), ipv6Observed: unavailable(), natObserved: unavailable()
  });
  return new Promise(resolve => {
    const stunAddresses: WebRtcStunAddress[] = [];
    let ipv6Observed = false;
    let natObserved = false;
    let iceError = false;
    let peer: RTCPeerConnection | undefined;
    let settled = false;
    const finish = (status: WebRtcStunServerResult['status']) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { peer?.close(); } catch { /* The result is still useful if close fails. */ }
      const finalStatus = status === 'complete' && stunAddresses.length === 0 ?
        (iceError ? 'error' : 'no-address') : status;
      resolve({
        ...server, status: finalStatus,
        stunAddresses: (finalStatus === 'error' || finalStatus === 'unsupported') && stunAddresses.length === 0 ? unavailable() : measured(stunAddresses),
        ipv6Observed: ipv6Observed ? measured(true) : unavailable(),
        natObserved: natObserved ? derived(true) : unavailable()
      });
    };
    const timer = setTimeout(() => finish('timeout'), Math.max(1, timeoutMs));
    try {
      peer = new RTCPeerConnection({ iceServers: [{ urls: server.url }] });
      peer.addEventListener('icecandidate', event => {
        if (!event.candidate) { finish('complete'); return; }
        try {
          const item = parse(event.candidate);
          if (!item) return;
          if (item.family === 'ipv6') ipv6Observed = true;
          if (item.type !== 'srflx' || item.family !== 'ipv4' && item.family !== 'ipv6') return;
          if (item.relatedAddress && family(item.relatedAddress) === item.family &&
              (item.address !== item.relatedAddress || item.relatedPort !== null && item.port !== item.relatedPort)) natObserved = true;
          const address: WebRtcStunAddress = {
            address: item.address, port: item.port, family: item.family, protocol: item.protocol
          };
          if (!stunAddresses.some(existing => JSON.stringify(existing) === JSON.stringify(address))) stunAddresses.push(address);
        } catch { /* Ignore malformed or privacy-filtered candidates. */ }
      });
      peer.addEventListener('icecandidateerror', () => { iceError = true; });
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer?.iceGatheringState === 'complete') finish('complete');
      });
      peer.createDataChannel('address-probe');
      void (async () => { await peer!.setLocalDescription(await peer!.createOffer()); })().catch(() => finish('error'));
    } catch { finish('error'); }
  });
}

/** On-demand, isolated ICE checks for each STUN server. No signaling or peer transfer. */
export async function getWebRtcInfo(timeoutMs = 6000): Promise<WebRtcInfo> {
  return { servers: await Promise.all(servers.map(server => checkServer(server, timeoutMs))) };
}
