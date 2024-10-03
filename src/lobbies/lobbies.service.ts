import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { Lobby, lobbySchema } from './entities/lobby.entity';
import { RedisClientType } from 'redis';
import { EntityId, Repository, Schema } from 'redis-om';
import { CreateLobbyDto } from './dto/create-lobby.dto';

@Injectable()
export class LobbiesService implements OnModuleInit {
  private lobbyRepository: Repository;
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: RedisClientType,
  ) {}

  public async onModuleInit() {
    this.lobbyRepository = new Repository(lobbySchema, this.redis);
    await this.lobbyRepository.createIndex();
  }

  async create(createLobbyDto: CreateLobbyDto): Promise<Lobby> {
    const lobbyName = createLobbyDto.name;

    const existingLobbies = await this.lobbyRepository
      .search()
      .where('name')
      .equals(lobbyName)
      .returnAll();

    if (existingLobbies.length === 0) {
      const createdLobbyEntity = await this.lobbyRepository.save({
        name: lobbyName,
        status: 'open',
        playersIds: [],
        playersSocketIds: [],
        playersScore: [],
      });

      const createdLobby: Lobby = {
        name: createdLobbyEntity.name as string,
        status: createdLobbyEntity.status as string,
        playersIds: (createdLobbyEntity.playersIds || []) as string[],
        playersSocketIds: (createdLobbyEntity.playersSocketIds ||
          []) as string[],
        playersScore: (createdLobbyEntity.playersScore || []) as number[],
      };

      return createdLobby;
    } else {
      throw new BadRequestException(
        `Lobby with name "${lobbyName}" already exists.`,
      );
    }
  }
}
