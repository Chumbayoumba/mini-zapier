import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { URL } from 'url';
import * as net from 'net';
import * as dns from 'dns/promises';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class HttpRequestAction implements ActionHandler {
  readonly type = 'HTTP_REQUEST';
  private readonly logger = new Logger(HttpRequestAction.name);

  private static readonly ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
  private static readonly MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB

  async execute(config: any): Promise<any> {
    const { url, method = 'GET', headers = {}, body, timeout = 30000, retries = 3 } = config;

    if (!url || typeof url !== 'string') {
      throw new BadRequestException('URL is required and must be a string');
    }

    const upperMethod = String(method).toUpperCase();
    if (!HttpRequestAction.ALLOWED_METHODS.includes(upperMethod)) {
      throw new BadRequestException(
        `Invalid HTTP method '${method}'. Allowed: ${HttpRequestAction.ALLOWED_METHODS.join(', ')}`,
      );
    }

    await this.validateUrl(url);

    // Parse string headers as JSON
    let parsedHeaders = headers;
    if (typeof headers === 'string') {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch {
        throw new BadRequestException('Headers must be a valid JSON object');
      }
    }

    // Parse string body as JSON, keep as string if invalid JSON (plain text)
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        // keep as plain text string
      }
    }

    const client = axios.create({
      timeout,
      maxRedirects: 0,
      maxContentLength: HttpRequestAction.MAX_RESPONSE_SIZE,
      maxBodyLength: HttpRequestAction.MAX_RESPONSE_SIZE,
    });
    axiosRetry(client, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
      },
    });

    this.logger.log(`HTTP ${upperMethod} ${url}`);

    const response = await client({
      method: upperMethod,
      url,
      headers: parsedHeaders,
      data: parsedBody,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  }

  private async validateUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only http and https protocols are allowed');
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

    if (hostname === 'localhost' || hostname === '0.0.0.0') {
      throw new BadRequestException('Requests to localhost are not allowed');
    }

    if (net.isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestException(`Requests to private IP addresses are not allowed: ${hostname}`);
      }
    } else {
      // Resolve DNS (both A and AAAA records) to check actual IPs
      let ipv4Addresses: string[] = [];
      let ipv6Addresses: string[] = [];
      let ipv4Error = false;
      let ipv6Error = false;

      try {
        ipv4Addresses = await dns.resolve4(hostname);
      } catch {
        ipv4Error = true;
      }

      try {
        ipv6Addresses = await dns.resolve6(hostname);
      } catch {
        ipv6Error = true;
      }

      // Fail-closed: if both DNS lookups fail, reject the request
      if (ipv4Error && ipv6Error) {
        throw new BadRequestException('DNS resolution failed for hostname');
      }

      // Check all resolved addresses for private IPs
      const allAddresses = [...ipv4Addresses, ...ipv6Addresses];
      for (const addr of allAddresses) {
        if (this.isPrivateIp(addr)) {
          throw new BadRequestException(`Requests to private IP addresses are not allowed: ${addr}`);
        }
      }
    }
  }

  private isPrivateIp(ip: string): boolean {
    // Handle IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if (ip.startsWith('::ffff:')) {
      return this.isPrivateIp(ip.slice(7));
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
      if (lower.startsWith('fe80')) return true; // fe80::/10
      return false;
    }

    // IPv4 checks
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;

    return (
      parts[0] === 0 ||                                           // 0.0.0.0/8
      parts[0] === 127 ||                                         // 127.0.0.0/8
      parts[0] === 10 ||                                          // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||  // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) ||                   // 192.168.0.0/16
      (parts[0] === 169 && parts[1] === 254) ||                   // 169.254.0.0/16
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)    // 100.64.0.0/10
    );
  }
}
