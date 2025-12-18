import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'JewishOnTheWay API',
      timestamp: new Date().toISOString(),
    };
  }
}
