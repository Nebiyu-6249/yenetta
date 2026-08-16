import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), UsersModule, EntitlementsModule],
  controllers: [AuthController, MfaController],
  providers: [AuthService, OtpService, TokenService, MfaService],
  exports: [TokenService],
})
export class AuthModule {}
