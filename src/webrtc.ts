import type { DetectedValue } from './types.js';

export type WebRtcAddressFamily = 'ipv4' | 'ipv6' | 'mdns' | 'unknown';

export interface WebRtcCandidate {
  address: string;
  port: number | null;
  family: WebRtcAddressFamily;
  type: 'host' | 'srflx';
  protocol: 'udp' | 'tcp' | null;
  server: string | null;
  relatedAddress: string | null;
  relatedPort: number | null;
}

export interface WebRtcInfo {
  status: 'complete' | 'timeout' | 'unsupported' | 'error';
  candidates: DetectedValue<WebRtcCandidate[]>;
  /** True only when a reflexive candidate exposes a different base address or port. Null is inconclusive. */
  natObserved: DetectedValue<boolean>;
}

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }
];
const unavailable = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const measured = <T>(value: T): DetectedValue<T> => ({ value, source: 'measured' });
const derived = <T>(value: T): DetectedValue<T> => ({ value, source: 'derived' });

function family(address: string): WebRtcAddressFamily {
  if (address.toLowerCase().endsWith('.local')) return 'mdns';
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address) &&
      address.split('.').every(part => Number(part) <= 255)) return 'ipv4';
  if (/^[0-9a-f:]+(?:%[a-z0-9_.-]+)?$/i.test(address) && address.includes(':')) return 'ipv6';
  return 'unknown';
}

function parse(candidate: RTCIceCandidate): WebRtcCandidate | null {
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
    server: (candidate as RTCIceCandidate & { url?: string | null }).url ?? null,
    relatedAddress: related && family(related) !== 'unknown' && related !== '0.0.0.0' && related !== '::' ? related : null,
    relatedPort
  };
}

/** On-demand ICE gathering. Contacts the listed STUN servers; no signaling or peer transfer. */
export async function getWebRtcInfo(timeoutMs = 6000): Promise<WebRtcInfo> {
  if (typeof RTCPeerConnection === 'undefined') return { status: 'unsupported', candidates: unavailable(), natObserved: unavailable() };
  return new Promise(resolve => {
    const candidates: WebRtcCandidate[] = [];
    let peer: RTCPeerConnection | undefined;
    let settled = false;
    const finish = (status: WebRtcInfo['status']) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { peer?.close(); } catch { /* The result is still useful if close fails. */ }
      const natObserved = candidates.some(item => item.type === 'srflx' && item.relatedAddress &&
        family(item.relatedAddress) === item.family &&
        (item.address !== item.relatedAddress || item.relatedPort !== null && item.port !== item.relatedPort));
      resolve({
        status,
        candidates: status === 'error' && candidates.length === 0 ? unavailable() : measured(candidates),
        natObserved: natObserved ? derived(true) : unavailable()
      });
    };
    const timer = setTimeout(() => finish('timeout'), Math.max(1, timeoutMs));
    try {
      peer = new RTCPeerConnection({ iceServers });
      peer.addEventListener('icecandidate', event => {
        if (!event.candidate) { finish('complete'); return; }
        try {
          const item = parse(event.candidate);
          if (item && !candidates.some(existing => JSON.stringify(existing) === JSON.stringify(item))) candidates.push(item);
        } catch { /* Ignore malformed or privacy-filtered candidates. */ }
      });
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer?.iceGatheringState === 'complete') finish('complete');
      });
      peer.createDataChannel('address-probe');
      void (async () => { await peer!.setLocalDescription(await peer!.createOffer()); })().catch(() => finish('error'));
    } catch { finish('error'); }
  });
}
