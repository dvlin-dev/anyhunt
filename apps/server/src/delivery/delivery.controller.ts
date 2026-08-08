/**
 * [INPUT]: Signed email unsubscribe token
 * [OUTPUT]: Confirmation form and idempotent email opt-out
 * [POS]: Public token-authenticated Delivery endpoint
 */

import { Controller, Get, Header, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { DeliveryService } from './delivery.service';

@Controller({ path: 'deliveries', version: '1' })
export class DeliveryController {
  constructor(private readonly deliveries: DeliveryService) {}

  @Public()
  @Get('unsubscribe/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  confirmation(@Param('token') token: string): string {
    const action = `/api/v1/deliveries/unsubscribe/${encodeURIComponent(token)}`;
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body><main><h1>Stop email updates?</h1><form method="post" action="${action}"><button type="submit">Unsubscribe</button></form></main></body></html>`;
  }

  @Public()
  @Post('unsubscribe/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Param('token') token: string): Promise<string> {
    await this.deliveries.unsubscribeEmail(token);
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><body><main><h1>Email updates stopped</h1><p>You can enable them again from your subscription settings.</p></main></body></html>';
  }
}
