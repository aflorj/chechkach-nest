import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client, Repository } from 'redis-om';
import { Lobby, lobbySchema } from '../lobbies/entities/lobby.entity';

@Injectable()
export class RedisClientService extends Client implements OnModuleDestroy {
  constructor() {
    super();
    (async () => {
      await this.open(process.env.REDIS_URL);
    })();
  }

  public async onModuleDestroy() {
    await this.close();
  }
}
