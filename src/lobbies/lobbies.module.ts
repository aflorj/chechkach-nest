import { Module } from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { LobbiesController } from './lobbies.controller';
import { LobbiesGateway } from './lobbies.gateway';

@Module({
  controllers: [LobbiesController],
  providers: [LobbiesService, LobbiesGateway],
})
export class LobbiesModule {}
