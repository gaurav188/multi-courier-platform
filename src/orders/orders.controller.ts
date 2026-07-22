import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CreateOrderDto } from '../common/dtos/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUnifiedOrder(@Body() payload: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.processSingleOrder(payload, this.getRequestId(req));
  }

  @Get(':orderId/track')
  async trackOrder(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.ordersService.trackOrder(orderId, this.getRequestId(req));
  }

  @Post(':orderId/cancel')
  async cancelOrder(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.ordersService.cancelOrder(orderId, this.getRequestId(req));
  }

  @Post('bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  async createBulkOrders(@Body() payloads: CreateOrderDto[], @Req() req: Request) {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      throw new BadRequestException({ message: 'Request body must be a non-empty array of orders.', code: 'VALIDATION_ERROR' });
    }

    if (payloads.length > 100) {
      throw new BadRequestException({ message: 'Cannot process more than 100 orders in a single batch.', code: 'VALIDATION_ERROR' });
    }

    const batchId = uuidv4();
    await this.ordersService.queueBulkOrders(batchId, payloads, this.getRequestId(req));

    return {
      success: true,
      data: {
        batch_id: batchId,
        status: 'PROCESSING',
        message: 'Bulk processing started in the background.',
      },
    };
  }

  private getRequestId(req: Request) {
    const rawRequestId = req.headers['x-request-id'];
    return typeof rawRequestId === 'string' && rawRequestId.length > 0 ? rawRequestId : uuidv4();
  }
}