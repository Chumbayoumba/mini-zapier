import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { URL } from 'url';
import * as net from 'net';
import * as dns from 'dns/promises';

@Injectable()
export class HttpRequestAction {
  private readonly logger = new Logger(HttpRequestAction.name);

  private readonly BLOCKED_IP_RANGES = [
    { prefix: '127.', mask: 8 },
    { prefix: '10.', mask: 8 },
    { prefix: '0.0.0.0', exact: true },
    { prefix: '169.254.169.254', exact: true },
  ];

  async execute(config: any): Promise<any> {
    const { url, method = 'GET', headers = {}, body, timeout = 30000, retries = 3 } = config;

    await this.validateUrl(url);

    const client = axios.create({ timeout, maxRedirects: 0 });
    axiosRetry(client, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
      },
    });

    this.logger.log(`HTTP ${method} ${url}`);

    const response = await client({
      method,
      url,
      headers,
      data: body,
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

    const hostname = parsed.hostname;

    if (hostname === 'localhost' || hostname === '0.0.0.0') {
      throw new BadRequestException('Requests to localhost are not allowed');
    }

    if (net.isIP(hostname)) {
      this.assertNotPrivateIp(hostname);
    } else {
      // Resolve DNS to check the actual IP
      try {
        const addresses = await dns.resolve4(hostname);
        for (const addr of addresses) {
          this.assertNotPrivateIp(addr);
        }
      } catch {
        // DNS resolution failed — let axios handle it
      }
    }
  }

  private assertNotPrivateIp(ip: string): void {
    const parts = ip.split('.').map(Number);

    const isPrivate =
      ip === '0.0.0.0' ||
      ip === '169.254.169.254' ||
      parts[0] === 127 ||                              // 127.0.0.0/8
      parts[0] === 10 ||                               // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168);           // 192.168.0.0/16

    if (isPrivate) {
      throw new BadRequestException(`Requests to private IP addresses are not allowed: ${ip}`);
    }
  }
}
