import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  
  async signUp(dto: any) {
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Password and Confirm Password do not match!');
    }

    const userExists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (userExists) {
      throw new BadRequestException('Email is already registered!');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        currency: 'IDR',
        auth_credentials: {
          create: {
            provider: 'LOCAL',
            password: hashedPassword,
          },
        },
      },
    });

    return { message: 'Sign up successful!', userId: newUser.user_id };
  }

  
  async signIn(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { auth_credentials: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password!');
    }

    const localCred = user.auth_credentials.find(cred => cred.provider === 'LOCAL');
    if (!localCred || !localCred.password) {
      throw new UnauthorizedException('This account was registered via Google. Please sign in using Google OAuth!');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, localCred.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password!');
    }

    const payload = { sub: user.user_id, email: user.email };
    return {
      message: 'Sign in successful!',
      access_token: this.jwtService.sign(payload),
    };
  }

  

  async forgotPassword(dto: any) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Email address not found!');
    }

    const simulatedToken = `reset-${user.user_id}-${Date.now()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordReset.create({
      data: {
        user_id: user.user_id,
        token_hash: simulatedToken,
        expires_at: expiresAt,
      },
    });

    return {
      message: 'Simulation: Password reset link has been generated successfully.',
      token: simulatedToken, 
    };
  }

  
  async resetPassword(dto: any) {
    
    const resetRequest = await this.prisma.passwordReset.findUnique({
      where: { token_hash: dto.token }, 
      include: { user: true },
    });

    if (!resetRequest || resetRequest.expires_at < new Date()) {
      throw new BadRequestException('Reset token is invalid or has expired!');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.authCredential.update({
      where: {
        user_id_provider: {
          user_id: resetRequest.user_id,
          provider: 'LOCAL',
        },
      },
      data: { password: hashedPassword },
    });

    await this.prisma.passwordReset.delete({
      where: { reset_id: resetRequest.reset_id },
    });

    return { message: 'Password updated successfully! Please sign in again.' };
  }

  
  async logOut() {
    return { message: 'Log out successful! Please remove the token from the client side.' };
  }
}