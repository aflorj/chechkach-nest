import { Module } from '@nestjs/common';
import { BurekService } from './burek.service';
import { BurekController } from './burek.controller';

@Module({
  controllers: [BurekController],
  providers: [BurekService],
})
export class BurekModule {}
