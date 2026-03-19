import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, any>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2b$10$hashedpassword',
    role: 'USER',
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('user-999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2b$10$hashedpassword',
      });

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: '$2b$10$hashedpassword',
        },
      });
    });
  });

  describe('updateRefreshToken', () => {
    it('should hash and update refresh token', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      prisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: 'hashed-refresh-token' });

      await service.updateRefreshToken('user-1', 'raw-refresh-token');

      expect(bcrypt.hash).toHaveBeenCalledWith('raw-refresh-token', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: 'hashed-refresh-token' },
      });
    });

    it('should set refresh token to null on logout', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: null });

      await service.updateRefreshToken('user-1', null);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [
        { id: 'user-1', email: 'a@b.com', name: 'A', role: 'USER', createdAt: new Date() },
      ];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({
        users,
        total: 1,
        page: 1,
        totalPages: 1,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle page 2', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(25);

      const result = await service.findAll(2, 20);

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('should use default pagination when no args', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(50);

      const result = await service.findAll(1, 15);

      expect(result.totalPages).toBe(4); // ceil(50/15)
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Updated Name',
        role: 'USER',
      });

      const result = await service.update('user-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
        select: { id: true, email: true, name: true, role: true },
      });
    });

    it('should update user role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
      });

      const result = await service.update('user-1', { role: 'ADMIN' });

      expect(result.role).toBe('ADMIN');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('user-999', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.delete('user-1');

      expect(result).toEqual({ message: 'User deleted' });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('user-999')).rejects.toThrow(NotFoundException);
    });
  });
});
