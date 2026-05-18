import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Controller('api/users')
@UseGuards(AuthGuard)
export class UsersController {
  @Get('me')
  getUserProfile(@Req() req: any) {
    return {
      msg: 'User profile retrieved successfully',
      data: req.user,
    };
  }
}
