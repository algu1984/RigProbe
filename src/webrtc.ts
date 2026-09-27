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
  /** True when STUN returned a reflexive mapping; suggests NAT if the base address is hidden. */
  natIndicated: DetectedValue<boolean>;
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
  const bare = address.replace(/^\[|\]$/g, '').replace(/%[a-z0-9_.-]+$/i, '');
  if (/^[0-9a-f:.]+$/i.test(bare) && bare.includes(':')) {
    try { new URL(`http://[${bare}]/`); return 'ipv6'; } catch { /* Not a valid IPv6 literal. */ }
  }
  return 'unknown';
}

function canonicalAddress(address: string, addressFamily: AddressFamily): string {
  if (addressFamily !== 'ipv6') return address;
  const bare = address.replace(/^\[|\]$/g, '').replace(/%[a-z0-9_.-]+$/i, '');
  try { return new URL(`http://[${bare}]/`).hostname.slice(1, -1); }
  catch { return bare.toLowerCase(); }
}

interface ParsedCandidate {
  address: string;
  port: number | null;
  family: AddressFamily;
  type: 'host' | 'srflx' | 'prflx';
  protocol: 'udp' | 'tcp' | null;
  relatedAddress: string | null;
  relatedPort: number | null;
}

function parse(candidate: RTCIceCandidate): ParsedCandidate | null {
  const fields = candidate.candidate.trim().split(/\s+/);
  const type = candidate.type ?? fields[fields.indexOf('typ') + 1];
  if (type !== 'host' && type !== 'srflx' && type !== 'prflx') return null;
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
    ...server, status: 'unsupported', stunAddresses: unavailable(), ipv6Observed: unavailable(), natObserved: unavailable(), natIndicated: unavailable()
  });
  return new Promise(resolve => {
    const stunAddresses: WebRtcStunAddress[] = [];
    let ipv6Observed = false;
    let natObserved = false;
    let iceError = false;
    let peer: RTCPeerConnection | undefined;
    let settled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const collect = (item: ParsedCandidate) => {
      if (item.family === 'ipv6') ipv6Observed = true;
      if (item.type !== 'srflx' || item.family !== 'ipv4' && item.family !== 'ipv6') return;
      const mappedAddress = canonicalAddress(item.address, item.family);
      const baseAddress = item.relatedAddress && canonicalAddress(item.relatedAddress, family(item.relatedAddress));
      if (baseAddress && family(baseAddress) === item.family &&
          (mappedAddress !== baseAddress || item.relatedPort !== null && item.port !== item.relatedPort)) natObserved = true;
      const address: WebRtcStunAddress = {
        address: mappedAddress, port: item.port, family: item.family, protocol: item.protocol
      };
      if (!stunAddresses.some(existing => JSON.stringify(existing) === JSON.stringify(address))) stunAddresses.push(address);
    };
    const finish = (status: WebRtcStunServerResult['status']) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(completionTimer);
      void (async () => {
        // Some browsers expose gathered candidates in stats but not in candidate events.
        // Read them before closing, without ever returning host addresses.
        try {
          if (peer?.getStats) {
            let deadline: ReturnType<typeof setTimeout> | undefined;
            const report = await Promise.race([
              peer.getStats(),
              new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 250); })
            ]);
            clearTimeout(deadline);
            report?.forEach(stat => {
              if (stat.type !== 'local-candidate') return;
              const item = stat as RTCStats & {
                address?: string; ip?: string; port?: number; protocol?: string;
                candidateType?: string; relatedAddress?: string; relatedPort?: number;
              };
              const address = item.address ?? item.ip;
              if (!address || !['host', 'srflx', 'prflx'].includes(item.candidateType ?? '')) return;
              const addressFamily = family(address);
              const protocol = item.protocol?.toLowerCase();
              collect({ address, port: item.port ?? null, family: addressFamily,
                type: item.candidateType as ParsedCandidate['type'],
                protocol: protocol === 'udp' || protocol === 'tcp' ? protocol : null,
                relatedAddress: item.relatedAddress ?? null, relatedPort: item.relatedPort ?? null });
            });
          }
        } catch { /* Candidate events remain the primary source. */ }
        try { peer?.close(); } catch { /* The result is still useful if close fails. */ }
        const finalStatus = stunAddresses.length ? 'complete' : status === 'complete' ?
          (iceError ? 'error' : 'no-address') : status;
        resolve({
          ...server, status: finalStatus,
          stunAddresses: (finalStatus === 'error' || finalStatus === 'unsupported') && stunAddresses.length === 0 ? unavailable() : measured(stunAddresses),
          ipv6Observed: ipv6Observed ? measured(true) : unavailable(),
          natObserved: natObserved ? derived(true) : unavailable(),
          natIndicated: stunAddresses.length ? derived(true) : unavailable()
        });
      })();
    };
    const scheduleCompletion = () => {
      if (settled || completionTimer) return;
      completionTimer = setTimeout(() => finish('complete'), 250);
    };
    const timer = setTimeout(() => finish('timeout'), Math.max(1, timeoutMs));
    try {
      peer = new RTCPeerConnection({ iceServers: [{ urls: server.url }] });
      peer.addEventListener('icecandidate', event => {
        if (!event.candidate) { scheduleCompletion(); return; }
        clearTimeout(completionTimer);
        completionTimer = undefined;
        try {
          const item = parse(event.candidate);
          if (item) collect(item);
        } catch { /* Ignore malformed or privacy-filtered candidates. */ }
        if (peer?.iceGatheringState === 'complete') scheduleCompletion();
      });
      peer.addEventListener('icecandidateerror', () => { iceError = true; });
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer?.iceGatheringState === 'complete') scheduleCompletion();
      });
      peer.createDataChannel('address-probe');
      void (async () => { await peer!.setLocalDescription(await peer!.createOffer()); })().catch(() => finish('error'));
    } catch { finish('error'); }
  });
}

/** On-demand, isolated ICE checks for each STUN server. No HTTP IP lookup. */
export async function getWebRtcInfo(timeoutMs = 6000): Promise<WebRtcInfo> {
  return { servers: await Promise.all(servers.map(server => checkServer(server, timeoutMs))) };
}
