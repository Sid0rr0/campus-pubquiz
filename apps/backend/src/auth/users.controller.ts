import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ApproveUserRequest,
  UsersListedPayload,
} from '@campus-pubquiz/types';
import { AuthService, UserNotFoundError } from '@/auth/auth.service';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';

function requireRole(body: Partial<ApproveUserRequest>): ApproveUserRequest {
  if (body.role !== 'admin' && body.role !== 'moderator') {
    throw new BadRequestException('role must be "admin" or "moderator"');
  }
  return { role: body.role };
}

@Controller('users')
@UseGuards(SessionGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async list(): Promise<UsersListedPayload> {
    return this.authService.listUsers();
  }

  @Post(':id/approve')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<ApproveUserRequest>,
  ): Promise<void> {
    const { role } = requireRole(body);
    try {
      await this.authService.approve(id, role);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<void> {
    try {
      await this.authService.deactivate(id);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
