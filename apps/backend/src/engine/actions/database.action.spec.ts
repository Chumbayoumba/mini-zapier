import { BadRequestException } from '@nestjs/common';
import { DatabaseAction } from './database.action';

// Create a mock PrismaService
const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
};

describe('DatabaseAction — DB Restriction', () => {
  let action: DatabaseAction;

  beforeEach(() => {
    action = new DatabaseAction(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('SELECT on allowed tables', () => {
    it('should allow SELECT on workflows', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: '1', name: 'test' }]);

      const result = await action.execute({
        operation: 'SELECT',
        table: 'workflows',
      });
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount', 1);
    });

    it('should allow SELECT on workflow_executions', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await action.execute({
        operation: 'SELECT',
        table: 'workflow_executions',
      });
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount', 0);
    });

    it('should allow SELECT on execution_step_logs', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }]);

      const result = await action.execute({
        operation: 'SELECT',
        table: 'execution_step_logs',
      });
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount', 1);
    });
  });

  describe('users table not allowed', () => {
    it('should reject SELECT on users table', async () => {
      await expect(
        action.execute({ operation: 'SELECT', table: 'users' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include table name in error for users', async () => {
      await expect(
        action.execute({ operation: 'SELECT', table: 'users' }),
      ).rejects.toThrow("Table 'users' is not allowed");
    });
  });

  describe('Only SELECT operations allowed', () => {
    it('should reject INSERT operation', async () => {
      await expect(
        action.execute({
          operation: 'INSERT',
          table: 'workflows',
          fields: { name: 'test' },
        }),
      ).rejects.toThrow('Only SELECT operations are allowed');
    });

    it('should reject UPDATE operation', async () => {
      await expect(
        action.execute({
          operation: 'UPDATE',
          table: 'workflows',
          fields: { name: 'updated' },
          where: { id: '1' },
        }),
      ).rejects.toThrow('Only SELECT operations are allowed');
    });

    it('should reject DELETE operation', async () => {
      await expect(
        action.execute({
          operation: 'DELETE',
          table: 'workflows',
          where: { id: '1' },
        }),
      ).rejects.toThrow('Only SELECT operations are allowed');
    });

    it('should reject RAW operation', async () => {
      await expect(
        action.execute({
          operation: 'RAW',
          query: 'DROP TABLE users',
        }),
      ).rejects.toThrow('Only SELECT operations are allowed');
    });

    it('should reject default (no operation specified = RAW)', async () => {
      await expect(
        action.execute({} as any),
      ).rejects.toThrow('Only SELECT operations are allowed');
    });
  });

  describe('Table validation', () => {
    it('should reject invalid table names with special characters', async () => {
      await expect(
        action.execute({ operation: 'SELECT', table: 'users; DROP TABLE--' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing table name for SELECT', async () => {
      await expect(
        action.execute({ operation: 'SELECT' }),
      ).rejects.toThrow('Table name is required');
    });
  });
});
