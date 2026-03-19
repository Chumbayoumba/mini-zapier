import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'register' | 'login' | 'refreshTokens' | 'logout'>>;

  const mockAuthResponse = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test', role: UserRole.USER },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
      const result = await controller.register(dto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('should propagate ConflictException from service', async () => {
      authService.register.mockRejectedValue(new Error('Email already registered'));

      await expect(
        controller.register({ email: 'dup@example.com', password: 'pass', name: 'Dup' }),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const dto = { email: 'test@example.com', password: 'password123' };
      const result = await controller.login(dto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should propagate UnauthorizedException from service', async () => {
      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        controller.login({ email: 'wrong@example.com', password: 'bad' }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      authService.refreshTokens.mockResolvedValue(tokens);

      const req = { user: { sub: 'user-1', refreshToken: 'old-refresh' } };
      const result = await controller.refresh(req);

      expect(result).toEqual(tokens);
      expect(authService.refreshTokens).toHaveBeenCalledWith('user-1', 'old-refresh');
    });

    it('should propagate UnauthorizedException on invalid refresh', async () => {
      authService.refreshTokens.mockRejectedValue(new Error('Access denied'));

      const req = { user: { sub: 'user-1', refreshToken: 'expired' } };
      await expect(controller.refresh(req)).rejects.toThrow('Access denied');
    });
  });

  describe('logout', () => {
    it('should logout and return success message', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('user-1');

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith('user-1');
    });
  });

  describe('me', () => {
    it('should return current user', async () => {
      const user = { sub: 'user-1', email: 'test@example.com', role: UserRole.USER };

      const result = await controller.me(user);

      expect(result).toEqual(user);
    });
  });
});
