import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
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

  async findAll(): Promise<Lobby[]> {
    const lobbies = (await this.lobbyRepository
      .search()
      .return.all()) as unknown as Lobby[];

    return lobbies;
  }

  async findOne(name: string): Promise<Lobby> {
    const matchingLobbies = await this.lobbyRepository
      .search()
      .where('name')
      .equals(name)
      .returnAll();

    if (matchingLobbies.length) {
      const lobby: Lobby = {
        name: matchingLobbies[0].name as string,
        status: matchingLobbies[0].status as string,
        playersIds: (matchingLobbies[0].playersIds || []) as string[],
        playersSocketIds: (matchingLobbies[0].playersSocketIds ||
          []) as string[],
        playersScore: (matchingLobbies[0].playersScore || []) as number[],
      };

      return lobby;
    } else {
      throw new NotFoundException(`Lobby with name "${name}" doesn\'t exist`);
    }
  }
}
