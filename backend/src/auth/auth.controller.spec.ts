import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('delegates to AuthService.register and returns the result', async () => {
      const dto: RegisterDto = {
        email: 'user@example.com',
        password: 'pass123',
        firstName: 'Test',
        lastName: 'User',
      };
      const expected = { id: 1, email: 'user@example.com', firstName: 'Test', lastName: 'User' };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('login', () => {
    it('delegates to AuthService.login and returns access_token', async () => {
      const dto: LoginDto = { email: 'user@example.com', password: 'pass123' };
      const expected = {
        access_token: 'jwt-token',
        user: { id: 1, email: 'user@example.com', firstName: 'Test', lastName: 'User' },
      };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('forgotPassword', () => {
    it('calls AuthService.forgotPassword and always returns the confirmation message', async () => {
      const dto: ForgotPasswordDto = { email: 'user@example.com' };
      mockAuthService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'If this email exists, a reset link has been sent.' });
    });
  });

  describe('resetPassword', () => {
    it('calls AuthService.resetPassword and returns the confirmation message', async () => {
      const dto: ResetPasswordDto = { token: 'some-token', newPassword: 'newpass123' };
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Password reset successfully.' });
    });
  });
});
