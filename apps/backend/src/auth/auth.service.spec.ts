import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'findById' | 'create' | 'updateRefreshToken'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2b$10$hashedpassword',
    role: 'USER',
    refreshToken: '$2b$10$hashedrefreshtoken',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
    };

    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();

    jwtService.signAsync
      .mockResolvedValueOnce('mock-access-token')
      .mockResolvedValueOnce('mock-refresh-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      usersService.create.mockResolvedValue(mockUser as any);
      usersService.updateRefreshToken.mockResolvedValue(undefined as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
      });
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith('user-1', 'mock-refresh-token');
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login and return user with tokens', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.updateRefreshToken.mockResolvedValue(undefined as any);

      const result = await service.login('test@example.com', 'password123');

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.passwordHash);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login('nobody@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens if refresh token is valid', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.updateRefreshToken.mockResolvedValue(undefined as any);

      const result = await service.refreshTokens('user-1', 'valid-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('valid-refresh-token', mockUser.refreshToken);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('no-user', 'token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user has no refresh token', async () => {
      usersService.findById.mockResolvedValue({ ...mockUser, refreshToken: null } as any);

      await expect(service.refreshTokens('user-1', 'token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token does not match', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens('user-1', 'invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      usersService.updateRefreshToken.mockResolvedValue(undefined as any);

      await service.logout('user-1');

      expect(usersService.updateRefreshToken).toHaveBeenCalledWith('user-1', null);
    });
  });

  describe('validateUser', () => {
    it('should return user data if credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      });
    });

    it('should return null if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nope@example.com', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });
  });
});
