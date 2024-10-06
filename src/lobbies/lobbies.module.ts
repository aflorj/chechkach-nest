import { Module } from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { LobbiesController } from './lobbies.controller';
import { LobbiesGateway } from './lobbies.gateway';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [LobbiesController],
  providers: [LobbiesService, LobbiesGateway, PrismaService],
})
export class LobbiesModule {}
