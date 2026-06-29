import { Body, Controller, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsService } from './payments.service';
import { voucherSchema, type VoucherDto } from './payments.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.createCheckout(user.userId);
  }

  // Webhook is public (called by Chapa) but authenticated by HMAC signature.
  @Public()
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody?.toString('utf-8') ?? JSON.stringify(req.body);
    const signature =
      (req.headers['chapa-signature'] as string | undefined) ??
      (req.headers['x-chapa-signature'] as string | undefined) ??
      '';
    return this.payments.handleWebhook(raw, signature);
  }

  @Post('voucher')
  voucher(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(voucherSchema)) dto: VoucherDto,
  ) {
    return this.payments.redeemVoucher(user.userId, dto.code);
  }
}
