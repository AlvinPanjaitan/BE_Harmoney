import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Membaca token dari Bearer Header
      ignoreExpiration: false, // Tolak jika token sudah kedaluwarsa
      secretOrKey: process.env.JWT_SECRET, // Kunci segel dari .env Anda
    });
  }

  async validate(payload: any) {
    // Data ini otomatis disuntikkan ke dalam objek Request (req.user)
    return { userId: payload.sub, email: payload.email };
  }
}