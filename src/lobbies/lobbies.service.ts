import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from 'redis-om';
import { RedisClientService } from '../redis-client/redis-client.service';
import { Lobby, lobbySchema } from './entities/lobby.entity';

@Injectable()
export class LobbiesService implements OnModuleInit {
  // private readonly lobbyRepository: Repository;

  constructor(private readonly redisClient: RedisClientService) {
    // this.lobbyRepository = redisClient.fetchRepository(lobbySchema);
  }

  public async onModuleInit() {
    // await this.lobbyRepository.createIndex();
  }
}
