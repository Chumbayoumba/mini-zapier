import { BadRequestException } from '@nestjs/common';
import { HttpRequestAction } from './http-request.action';

// Mock dns/promises
jest.mock('dns/promises', () => ({
  resolve4: jest.fn(),
  resolve6: jest.fn(),
}));

// Mock axios and axios-retry
jest.mock('axios', () => {
  const mockAxiosInstance = jest.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { ok: true },
  });
  const create = jest.fn(() => mockAxiosInstance);
  return {
    __esModule: true,
    default: { create },
    create,
  };
});
jest.mock('axios-retry', () => ({
  __esModule: true,
  default: jest.fn(),
  isNetworkOrIdempotentRequestError: jest.fn(),
  exponentialDelay: jest.fn(),
}));

import * as dns from 'dns/promises';

const mockResolve4 = dns.resolve4 as jest.MockedFunction<typeof dns.resolve4>;
const mockResolve6 = dns.resolve6 as jest.MockedFunction<typeof dns.resolve6>;

describe('HttpRequestAction — SSRF Protection', () => {
  let action: HttpRequestAction;

  beforeEach(() => {
    action = new HttpRequestAction();
    jest.clearAllMocks();
  });

  describe('IPv4 private ranges blocked', () => {
    const blockedIPs = [
      ['127.0.0.1', 'loopback start'],
      ['127.255.255.255', 'loopback end'],
      ['10.0.0.1', 'Class A private start'],
      ['10.255.255.255', 'Class A private end'],
      ['172.16.0.1', 'Class B private start'],
      ['172.31.255.255', 'Class B private end'],
      ['192.168.0.1', 'Class C private start'],
      ['192.168.255.255', 'Class C private end'],
      ['169.254.0.1', 'link-local start'],
      ['169.254.255.255', 'link-local end'],
      ['100.64.0.1', 'carrier-grade NAT start'],
      ['100.127.255.255', 'carrier-grade NAT end'],
      ['0.0.0.0', 'unspecified'],
    ];

    it.each(blockedIPs)('should reject %s (%s)', async (ip) => {
      await expect(
        action.execute({ url: `http://${ip}/test`, method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('IPv6 blocked', () => {
    const blockedIPv6 = [
      ['::1', 'loopback'],
      ['::', 'unspecified'],
      ['fc00::1', 'unique local fc00'],
      ['fd00::1', 'unique local fd00'],
      ['fe80::1', 'link-local'],
    ];

    it.each(blockedIPv6)('should reject [%s] (%s)', async (ip) => {
      await expect(
        action.execute({ url: `http://[${ip}]/test`, method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('IPv4-mapped IPv6 blocked', () => {
    it('should reject ::ffff:127.0.0.1', async () => {
      await expect(
        action.execute({ url: `http://[::ffff:127.0.0.1]/test`, method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject ::ffff:10.0.0.1', async () => {
      await expect(
        action.execute({ url: `http://[::ffff:10.0.0.1]/test`, method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject ::ffff:192.168.1.1', async () => {
      await expect(
        action.execute({ url: `http://[::ffff:192.168.1.1]/test`, method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DNS failure handling', () => {
    it('should reject hostname when DNS resolution fails (fail-closed)', async () => {
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        action.execute({ url: 'http://nonexistent.invalid/test', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject hostname resolving to private IP via A record', async () => {
      mockResolve4.mockResolvedValue(['127.0.0.1'] as any);
      mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        action.execute({ url: 'http://evil.example.com/test', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject hostname resolving to private IP via AAAA record', async () => {
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve6.mockResolvedValue(['::1'] as any);

      await expect(
        action.execute({ url: 'http://evil-ipv6.example.com/test', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Public IPs allowed', () => {
    const allowedIPs = [
      ['8.8.8.8', 'Google DNS'],
      ['1.1.1.1', 'Cloudflare DNS'],
      ['93.184.216.34', 'example.com'],
    ];

    it.each(allowedIPs)('should allow %s (%s)', async (ip) => {
      const result = await action.execute({ url: `http://${ip}/test`, method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });

    it('should allow hostname resolving to public IP', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'] as any);
      mockResolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946'] as any);

      const result = await action.execute({ url: 'http://example.com/test', method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });
  });

  describe('Protocol enforcement', () => {
    it('should reject ftp:// protocol', async () => {
      await expect(
        action.execute({ url: 'ftp://evil.com/file', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file:/// protocol', async () => {
      await expect(
        action.execute({ url: 'file:///etc/passwd', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow http:// protocol', async () => {
      const result = await action.execute({ url: 'http://8.8.8.8/test', method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });

    it('should allow https:// protocol', async () => {
      const result = await action.execute({ url: 'https://8.8.8.8/test', method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });
  });

  describe('Edge cases', () => {
    it('should reject invalid URL', async () => {
      await expect(
        action.execute({ url: 'not-a-url', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject localhost hostname', async () => {
      await expect(
        action.execute({ url: 'http://localhost/test', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 172.17.0.1 (Docker bridge)', async () => {
      await expect(
        action.execute({ url: 'http://172.17.0.1/test', method: 'GET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not reject 172.32.0.1 (outside private range)', async () => {
      const result = await action.execute({ url: 'http://172.32.0.1/test', method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });

    it('should not reject 100.128.0.1 (outside carrier-grade NAT)', async () => {
      const result = await action.execute({ url: 'http://100.128.0.1/test', method: 'GET' });
      expect(result).toHaveProperty('status', 200);
    });
  });
});
