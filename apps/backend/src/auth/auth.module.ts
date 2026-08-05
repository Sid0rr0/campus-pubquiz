import { Module } from '@nestjs/common';
import { AuthBootstrapService } from '@/auth/auth-bootstrap.service';
import { AuthService } from '@/auth/auth.service';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { SessionService } from '@/auth/session.service';

@Module({
  providers: [
    AuthService,
    SessionService,
    SessionGuard,
    RolesGuard,
    AuthBootstrapService,
  ],
  exports: [AuthService, SessionService, SessionGuard, RolesGuard],
})
export class AuthModule {}
