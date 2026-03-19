import { BadRequestException } from '@nestjs/common';
import { EmailAction } from './email.action';

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

import * as nodemailer from 'nodemailer';
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

const mockConfigService = {
  get: jest.fn((key: string) => {
    const env: Record<string, any> = {
      SMTP_HOST: 'smtp.env.com',
      SMTP_PORT: 587,
      SMTP_USER: 'env@test.com',
      SMTP_PASSWORD: 'envpass',
    };
    return env[key];
  }),
};

describe('EmailAction', () => {
  let action: EmailAction;

  beforeEach(() => {
    action = new EmailAction(mockConfigService as any);
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({
      messageId: '<msg-001@test.com>',
      accepted: ['user@test.com'],
    });
  });

  describe('input validation', () => {
    it('should reject missing "to"', async () => {
      await expect(action.execute({ subject: 'Hi', body: 'Hello' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject missing "subject"', async () => {
      await expect(action.execute({ to: 'user@test.com', body: 'Hello' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject invalid email address', async () => {
      await expect(action.execute({ to: 'not-an-email', subject: 'Hi', body: 'Hello' }))
        .rejects.toThrow(/Invalid.*email address/);
    });

    it('should reject invalid CC email', async () => {
      await expect(
        action.execute({ to: 'user@test.com', subject: 'Hi', body: 'Hello', cc: 'bad-cc' }),
      ).rejects.toThrow(/Invalid CC email/);
    });

    it('should reject invalid BCC email', async () => {
      await expect(
        action.execute({ to: 'user@test.com', subject: 'Hi', body: 'Hello', bcc: 'bad-bcc' }),
      ).rejects.toThrow(/Invalid BCC email/);
    });
  });

  describe('successful send', () => {
    it('should send plain text email', async () => {
      const result = await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
      });
      expect(result.messageId).toBe('<msg-001@test.com>');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@test.com', subject: 'Test', text: 'Hello' }),
      );
    });

    it('should send HTML email when isHtml is true', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: '<b>Hello</b>',
        isHtml: true,
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ html: '<b>Hello</b>' }),
      );
    });

    it('should use custom "from" field', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
        from: 'custom@sender.com',
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'custom@sender.com' }),
      );
    });

    it('should accept multiple comma-separated recipients', async () => {
      await action.execute({
        to: 'a@test.com, b@test.com',
        subject: 'Test',
        body: 'Hello',
      });
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('CC/BCC', () => {
    it('should include CC in mail options', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
        cc: 'cc@test.com',
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ cc: 'cc@test.com' }),
      );
    });

    it('should include BCC in mail options', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
        bcc: 'bcc@test.com',
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ bcc: 'bcc@test.com' }),
      );
    });
  });

  describe('SMTP config priority', () => {
    it('should use per-step SMTP config first', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
        smtpHost: 'step.smtp.com',
        smtpPort: 465,
        smtpUser: 'step@test.com',
        smtpPassword: 'steppass',
      });
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'step.smtp.com', port: 465 }),
      );
    });

    it('should use _context integrations when no per-step config', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
        _context: {
          integrations: {
            email: { host: 'ctx.smtp.com', port: 2525, user: 'ctx@test.com', password: 'ctxpass' },
          },
        },
      });
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'ctx.smtp.com', port: 2525 }),
      );
    });

    it('should fall back to env vars when no other config', async () => {
      await action.execute({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
      });
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.env.com', port: 587 }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw on sendMail failure', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection refused'));
      await expect(
        action.execute({ to: 'user@test.com', subject: 'Test', body: 'Hello' }),
      ).rejects.toThrow(/Email sending failed/);
    });
  });
});
