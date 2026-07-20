import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountDeletionService } from './account-deletion.service';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';

@Controller('account-deletion')
export class AccountDeletionController {
  constructor(private readonly deletionService: AccountDeletionService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  async requestDeletion(@Body() dto: RequestAccountDeletionDto) {
    await this.deletionService.requestDeletion(dto.email);
    return {
      message:
        'If an account exists for this email, a confirmation link has been sent.',
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async confirmDeletion(@Body() dto: ConfirmAccountDeletionDto) {
    await this.deletionService.confirmDeletion(dto.token);
    return { message: 'Account deleted successfully.' };
  }
}
