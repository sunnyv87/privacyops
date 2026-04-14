import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';

/**
 * SsrfError is thrown whenever a URL guard check rejects a target. Callers
 * should translate this to a 400/502 depending on whether the target came from
 * user input or an upstream service.
 */
export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'scheme'
      | 'port'
      | 'host'
      | 'ip_private'
      | 'ip_loopback'
      | 'ip_linklocal'
      | 'ip_metadata'
      | 'ip_multicast'
      | 'dns_failure',
  ) {
    super(message);
    this.name = 'SsrfError';
  }
}

export interface UrlGuardOptions {
  /** Schemes permitted for this call. Default: ['https']. */
  allowedSchemes?: string[];
  /** Ports permitted. Default: [80, 443] (plus 80 only if http allowed). */
  allowedPorts?: number[];
  /**
   * If provided, only hostnames matching the allowlist (exact match or suffix
   * match with a leading `.`) are accepted. Use this for OAuth token URLs.
   */
  allowedHosts?: string[];
}

const DEFAULT_OPTIONS: Required<UrlGuardOptions> = {
  allowedSchemes: ['https:'],
  allowedPorts: [443],
  allowedHosts: [],
};

/**
 * UrlGuardService validates that an outbound HTTP URL does not resolve to a
 * private, loopback, link-local, metadata, or multicast address before we
 * attach authentication headers and dispatch the request.
 *
 * This is the primary defense against SSRF attacks where tenant-supplied
 * baseUrls or OAuth token URLs could be used to pivot into internal services
 * or cloud metadata endpoints (e.g., 169.254.169.254).
 */
@Injectable()
export class UrlGuardService {
  private readonly logger = new Logger(UrlGuardService.name);

  /**
   * Validate the given URL and return its resolved IP. Throws SsrfError on
   * any policy violation.
   */
  async assertSafe(
    rawUrl: string,
    options: UrlGuardOptions = {},
  ): Promise<{ url: URL; resolvedIp: string }> {
    const opts: Required<UrlGuardOptions> = {
      allowedSchemes: options.allowedSchemes ?? DEFAULT_OPTIONS.allowedSchemes,
      allowedPorts: options.allowedPorts ?? DEFAULT_OPTIONS.allowedPorts,
      allowedHosts: options.allowedHosts ?? DEFAULT_OPTIONS.allowedHosts,
    };

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new SsrfError(`Invalid URL: ${rawUrl}`, 'host');
    }

    if (!opts.allowedSchemes.includes(url.protocol)) {
      throw new SsrfError(
        `Scheme ${url.protocol} is not allowed. Allowed: ${opts.allowedSchemes.join(', ')}`,
        'scheme',
      );
    }

    const port = url.port
      ? Number(url.port)
      : url.protocol === 'https:'
        ? 443
        : 80;

    if (!opts.allowedPorts.includes(port)) {
      throw new SsrfError(
        `Port ${port} is not allowed. Allowed: ${opts.allowedPorts.join(', ')}`,
        'port',
      );
    }

    const hostname = url.hostname;

    if (!hostname) {
      throw new SsrfError('URL has no hostname', 'host');
    }

    // Enforce host allowlist if configured.
    if (opts.allowedHosts.length > 0) {
      const lowered = hostname.toLowerCase();
      const allowed = opts.allowedHosts.some((pattern) => {
        const p = pattern.toLowerCase();
        if (p.startsWith('.')) {
          return lowered === p.slice(1) || lowered.endsWith(p);
        }
        return lowered === p;
      });
      if (!allowed) {
        throw new SsrfError(
          `Host ${hostname} is not in the allowlist`,
          'host',
        );
      }
    }

    // Resolve the hostname and verify every resolved address is routable to
    // a public destination.
    const resolvedIp = await this.resolveAndCheck(hostname);

    return { url, resolvedIp };
  }

  private async resolveAndCheck(hostname: string): Promise<string> {
    // If hostname is already a literal IP, validate directly.
    if (net.isIP(hostname)) {
      this.assertPublicIp(hostname);
      return hostname;
    }

    let records: dns.LookupAddress[];
    try {
      records = await dns.lookup(hostname, { all: true });
    } catch (err) {
      throw new SsrfError(`DNS lookup failed for ${hostname}`, 'dns_failure');
    }

    if (records.length === 0) {
      throw new SsrfError(`DNS returned no records for ${hostname}`, 'dns_failure');
    }

    // Reject if ANY resolved address is private. This is stricter than
    // necessary but defends against round-robin DNS poisoning.
    for (const record of records) {
      this.assertPublicIp(record.address);
    }

    return records[0].address;
  }

  /**
   * Throws SsrfError if the IP is in a disallowed range.
   * Covers:
   *   - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC1918)
   *   - 127.0.0.0/8 (loopback)
   *   - 169.254.0.0/16 (link-local, including 169.254.169.254 cloud metadata)
   *   - 100.64.0.0/10 (CGNAT)
   *   - 192.0.0.0/24 (IETF)
   *   - 198.18.0.0/15 (benchmarking)
   *   - 224.0.0.0/4 (multicast)
   *   - 240.0.0.0/4 (reserved)
   *   - ::1 (loopback v6)
   *   - fc00::/7 (unique local)
   *   - fe80::/10 (link-local v6)
   *   - ::ffff:0:0/96 (IPv4-mapped)
   */
  private assertPublicIp(ip: string): void {
    if (net.isIPv4(ip)) {
      this.assertPublicIpv4(ip);
    } else if (net.isIPv6(ip)) {
      this.assertPublicIpv6(ip);
    } else {
      throw new SsrfError(`Invalid IP address: ${ip}`, 'host');
    }
  }

  private assertPublicIpv4(ip: string): void {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      throw new SsrfError(`Invalid IPv4 address: ${ip}`, 'host');
    }
    const [a, b] = parts;

    // 0.0.0.0/8
    if (a === 0) throw new SsrfError(`${ip} is reserved`, 'ip_private');
    // 10.0.0.0/8
    if (a === 10) throw new SsrfError(`${ip} is private (RFC1918)`, 'ip_private');
    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127)
      throw new SsrfError(`${ip} is CGNAT`, 'ip_private');
    // 127.0.0.0/8
    if (a === 127) throw new SsrfError(`${ip} is loopback`, 'ip_loopback');
    // 169.254.0.0/16 — includes 169.254.169.254 cloud metadata
    if (a === 169 && b === 254) {
      const isMetadata = ip === '169.254.169.254' || ip === '169.254.170.2';
      throw new SsrfError(
        `${ip} is ${isMetadata ? 'cloud metadata' : 'link-local'}`,
        isMetadata ? 'ip_metadata' : 'ip_linklocal',
      );
    }
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31)
      throw new SsrfError(`${ip} is private (RFC1918)`, 'ip_private');
    // 192.0.0.0/24
    if (a === 192 && b === 0 && parts[2] === 0)
      throw new SsrfError(`${ip} is reserved`, 'ip_private');
    // 192.168.0.0/16
    if (a === 192 && b === 168)
      throw new SsrfError(`${ip} is private (RFC1918)`, 'ip_private');
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19))
      throw new SsrfError(`${ip} is reserved`, 'ip_private');
    // 224.0.0.0/4 (multicast)
    if (a >= 224 && a <= 239)
      throw new SsrfError(`${ip} is multicast`, 'ip_multicast');
    // 240.0.0.0/4 (reserved)
    if (a >= 240) throw new SsrfError(`${ip} is reserved`, 'ip_private');
  }

  private assertPublicIpv6(ip: string): void {
    const lower = ip.toLowerCase();
    // Loopback
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1')
      throw new SsrfError(`${ip} is loopback`, 'ip_loopback');
    // Unspecified
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0')
      throw new SsrfError(`${ip} is unspecified`, 'ip_private');
    // IPv4-mapped ::ffff:a.b.c.d — extract and validate the IPv4 portion.
    if (lower.startsWith('::ffff:')) {
      const rest = lower.slice(7);
      if (net.isIPv4(rest)) {
        this.assertPublicIpv4(rest);
        return;
      }
    }
    // Link-local fe80::/10
    if (/^fe[89ab]/.test(lower))
      throw new SsrfError(`${ip} is link-local`, 'ip_linklocal');
    // Unique local fc00::/7
    if (/^f[cd]/.test(lower))
      throw new SsrfError(`${ip} is unique-local`, 'ip_private');
    // Multicast ff00::/8
    if (/^ff/.test(lower))
      throw new SsrfError(`${ip} is multicast`, 'ip_multicast');
  }

  /**
   * Perform a guarded fetch. Resolves the hostname, verifies the IP, then
   * dispatches the request to the URL (not the raw IP) so TLS SNI / cert
   * validation still work correctly.
   *
   * Note: this does not defend against DNS rebinding between the lookup and
   * the actual socket connect. For the highest-sensitivity surfaces, callers
   * should pin to the resolved IP and pass the original hostname as Host +
   * SNI, or use undici with a custom `connect` hook. For now we accept the
   * narrow race window.
   */
  async safeFetch(
    rawUrl: string,
    init: RequestInit,
    options: UrlGuardOptions = {},
  ): Promise<Response> {
    const { url } = await this.assertSafe(rawUrl, options);
    // Apply a hard timeout so a misbehaving upstream cannot stall the
    // connector worker indefinitely.
    const timeoutMs = 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url.toString(), {
        ...init,
        signal: init.signal ?? controller.signal,
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
