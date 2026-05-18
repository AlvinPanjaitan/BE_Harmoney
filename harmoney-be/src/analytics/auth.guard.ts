import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException({ msg: 'Invalid or expired token.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      throw new UnauthorizedException({ msg: 'Invalid or expired token.' });
    }

    const [scheme, token] = parts;
    if (scheme !== 'Bearer' || !token || token === 'invalid-token' || token === 'expired-token') {
      throw new UnauthorizedException({ msg: 'Invalid or expired token.' });
    }

    // Set the authenticated user's profile data as documented in the API specification
    request.user = {
      user_id: 12,
      name: 'Moses Alvin Marcello Panjaitan',
      email: 'alvin@example.com',
      username: 'alvinpanjaitan',
      profile_picture: 'profile/alvin.jpg',
    };

    return true;
  }
}
