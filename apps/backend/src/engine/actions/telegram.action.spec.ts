import { BadRequestException } from '@nestjs/common';
import { TelegramAction } from './telegram.action';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

import axios from 'axios';
const mockPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('TelegramAction', () => {
  let action: TelegramAction;

  beforeEach(() => {
    action = new TelegramAction();
    jest.clearAllMocks();
    mockPost.mockResolvedValue({
      data: { ok: true, result: { message_id: 42 } },
    });
  });

  describe('input validation', () => {
    it('should throw when botToken is missing', async () => {
      await expect(
        action.execute({ chatId: '123', message: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when chatId is missing', async () => {
      await expect(
        action.execute({ botToken: 'token123', message: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when chatId is non-numeric', async () => {
      await expect(
        action.execute({ botToken: 'token123', chatId: 'abc', message: 'Hi' }),
      ).rejects.toThrow(/must be a numeric value/);
    });

    it('should throw when message exceeds 4096 characters', async () => {
      const longMessage = 'a'.repeat(4097);
      await expect(
        action.execute({ botToken: 'token123', chatId: '123', message: longMessage }),
      ).rejects.toThrow(/exceeds Telegram limit/);
    });

    it('should throw when parseMode is invalid', async () => {
      await expect(
        action.execute({ botToken: 'token123', chatId: '123', message: 'Hi', parseMode: 'XML' }),
      ).rejects.toThrow(/Invalid parseMode/);
    });
  });

  describe('token resolution', () => {
    it('should use botToken from config first', async () => {
      await action.execute({
        botToken: 'direct-token',
        chatId: '123',
        message: 'Hi',
        _context: { integrations: { telegram: { botToken: 'ctx-token' } } },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('direct-token'),
        expect.anything(),
      );
    });

    it('should fall back to _context.integrations.telegram.botToken', async () => {
      await action.execute({
        chatId: '123',
        message: 'Hi',
        _context: { integrations: { telegram: { botToken: 'ctx-token' } } },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('ctx-token'),
        expect.anything(),
      );
    });

    it('should fall back to _context.triggerData.botToken', async () => {
      await action.execute({
        chatId: '123',
        message: 'Hi',
        _context: { triggerData: { botToken: 'trigger-token' } },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('trigger-token'),
        expect.anything(),
      );
    });
  });

  describe('chatId resolution', () => {
    it('should use chatId from config first', async () => {
      await action.execute({
        botToken: 'token',
        chatId: '100',
        message: 'Hi',
        _context: { triggerData: { chat: { id: 200 } } },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chat_id: '100' }),
      );
    });

    it('should fall back to _context.triggerData.chat.id', async () => {
      await action.execute({
        botToken: 'token',
        message: 'Hi',
        _context: { triggerData: { chat: { id: 200 } } },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chat_id: 200 }),
      );
    });

    it('should allow negative chatId for groups', async () => {
      const result = await action.execute({
        botToken: 'token',
        chatId: '-100123456',
        message: 'Group msg',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('successful send', () => {
    it('should return ok=true and messageId', async () => {
      const result = await action.execute({
        botToken: 'token',
        chatId: '123',
        message: 'Hello',
      });
      expect(result).toEqual({ ok: true, messageId: 42, chatId: '123' });
    });

    it('should use default message when none provided', async () => {
      await action.execute({ botToken: 'token', chatId: '123' });
      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ text: 'Hello!' }),
      );
    });

    it('should pass parseMode to Telegram API', async () => {
      await action.execute({
        botToken: 'token',
        chatId: '123',
        message: 'Hi',
        parseMode: 'MarkdownV2',
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parse_mode: 'MarkdownV2' }),
      );
    });

    it('should accept message exactly 4096 characters', async () => {
      const msg = 'a'.repeat(4096);
      const result = await action.execute({ botToken: 'token', chatId: '123', message: msg });
      expect(result.ok).toBe(true);
    });

    it('should call correct Telegram API URL', async () => {
      await action.execute({ botToken: 'mybot123', chatId: '456', message: 'test' });
      expect(mockPost).toHaveBeenCalledWith(
        'https://api.telegram.org/botmybot123/sendMessage',
        expect.anything(),
      );
    });
  });

  describe('error handling', () => {
    it('should throw on axios failure', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));
      await expect(
        action.execute({ botToken: 'token', chatId: '123', message: 'Hi' }),
      ).rejects.toThrow(/Telegram sending failed/);
    });
  });

  describe('interpolation removed', () => {
    it('should NOT interpolate template variables in message', async () => {
      await action.execute({
        botToken: 'token',
        chatId: '123',
        message: 'Hello {{name}}',
        _context: { name: 'World' },
      });
      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ text: 'Hello {{name}}' }),
      );
    });

    it('should not have interpolateMessage method', () => {
      expect((action as any).interpolateMessage).toBeUndefined();
    });
  });
});
