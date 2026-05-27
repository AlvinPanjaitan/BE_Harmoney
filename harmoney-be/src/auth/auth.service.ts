import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
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


  async googleSync(dto: any) {
    if (!dto.email) {
      throw new BadRequestException('Email from Google OAuth is required!');
    }

    
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {
        name: dto.name, 
      },
      create: {
        email: dto.email,
        name: dto.name || 'Google User',
        currency: 'IDR',
      },
    });

    await this.prisma.authCredential.upsert({
      where: {
        user_id_provider: {
          user_id: user.user_id, 
          provider: 'GOOGLE',  
        },
      },
      update: {},
      create: {
        user_id: user.user_id,
        provider: 'GOOGLE',
        password: null, 
      },
    });

    
    const payload = { sub: user.user_id, email: user.email };
    return {
      message: 'Google account synchronized successfully!',
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async forgotPassword(dto: any) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Email address not found!');
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const secureTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordReset.create({
      data: {
        user_id: user.user_id,
        token_hash: secureTokenHash,
        expires_at: expiresAt,
      },
    });

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; 
    const resetLink = `${frontendBaseUrl}/reset-password?token=${rawResetToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Reset Password - Harmoney',
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 450px; margin: 40px auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #10b981; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">HARMONEY</h1>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">Reset My Password</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />

            <div style="color: #334155; font-size: 15px; line-height: 1.6;">
              <p style="margin: 0 0 12px 0;">Hello, <strong style="color: #0f172a;">${user.name || 'User'}</strong>.</p>
              <p style="margin: 0 0 24px 0; color: #475569;">You requested to reset your password.</p>
              <p style="margin: 0 0 24px 0; color: #475569;">Please click the button below to set up a new password for your account:</p>
            </div>

            <div style="margin: 32px 0; text-align: center;">
              <a href="${resetLink}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">Reset Password</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-top: 24px;" />

            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center; margin: 20px 0 0 0;">
              If you didn't request this, you can safely ignore this email.<br />
              The link will expire in <span style="color: #64748b; font-weight: 600;">1 hour</span>.
            </p>
          </div>
        `,
      });
    } catch (error) {
      throw new BadRequestException('Failed to send reset password email. Please try again later.');
    }

    return {
      message: 'Password reset link has been sent to your email successfully.',
    };
  }

  async resetPassword(dto: any) {
    if (!dto.token || !dto.email) {
      throw new BadRequestException('Token and email are required!');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match!');
    }

    const inputTokenHash = crypto.createHash('sha256').update(String(dto.token)).digest('hex');

    const resetRequest = await this.prisma.passwordReset.findFirst({
      where: { 
        token_hash: inputTokenHash,
        user: { email: String(dto.email) }
      },
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