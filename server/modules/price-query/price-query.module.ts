import { Module } from '@nestjs/common';
import { PriceQueryController } from './price-query.controller';
import { PriceQueryService } from './price-query.service';

@Module({
  controllers: [PriceQueryController],
  providers: [PriceQueryService],
  exports: [PriceQueryService],
})
export class PriceQueryModule {}
