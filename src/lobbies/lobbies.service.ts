import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Lobby, lobbySchema, Player } from './entities/lobby.entity';
import { RedisClientType } from 'redis';
import { EntityId, Repository, Schema } from 'redis-om';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { JoinLobbyDto } from './dto/join-lobby.dto';

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

  // Expose the lobbyRepository as a getter
  get repository(): Repository {
    return this.lobbyRepository;
  }

  async create(createLobbyDto: CreateLobbyDto): Promise<Lobby> {
    const lobbyName = createLobbyDto.lobbyName;

    const existingLobbies = await this.lobbyRepository
      .search()
      .where('name')
      .equals(lobbyName)
      .returnAll();

    if (existingLobbies.length === 0) {
      const createdLobbyEntity = await this.lobbyRepository.save({
        name: lobbyName,
        status: 'open',
        players: [],
      });

      const createdLobby: Lobby = {
        name: createdLobbyEntity.name as string,
        status: createdLobbyEntity.status as string,
        players: (createdLobbyEntity.players || []) as unknown as Player[],
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

  async findOne(lobbyName: string): Promise<Lobby> {
    const matchingLobbies = await this.lobbyRepository
      .search()
      .where('name')
      .equals(lobbyName)
      .returnAll();

    if (matchingLobbies.length) {
      const lobby: Lobby = {
        name: matchingLobbies[0].name as string,
        status: matchingLobbies[0].status as string,
        players: (matchingLobbies[0].players || []) as unknown as Player[],
      };

      return lobby;
    } else {
      throw new NotFoundException(`Lobby "${lobbyName}" doesn't exist`);
    }
  }

  async join(joinLobbyDto: JoinLobbyDto): Promise<Lobby> {
    const { lastKnownSocketId, lobbyName } = joinLobbyDto;

    // if request has lastKnownSocketId check if we are already in a lobby and is it this one (reconnecting user)

    if (joinLobbyDto.lastKnownSocketId) {
      const lobbyWithLastKnown = await this.lobbyRepository
        .search()
        .where('playersSocketIds')
        .contains(lastKnownSocketId)
        .returnFirst();

      if (lobbyWithLastKnown) {
        // this user is already connected to a lobby - check if it is this one
        if (lobbyName == lobbyWithLastKnown.name) {
          // this is a reconnect
          console.log(
            `lobby ${lobbyName} exist and the user is reconnecting to it`,
          );

          const lobby: Lobby = {
            name: lobbyWithLastKnown.name as string,
            status: lobbyWithLastKnown.status as string,
            players: (lobbyWithLastKnown.players || []) as unknown as Player[],
          };

          return lobby;
        } else {
          // not a reconnect but player is in another active game (only 1 allowed)
          // TODO handle this better
          throw new ForbiddenException(
            'Player is already in another active game',
          );
        }
      }
    }

    // normal first connect
    const lobbyToJoin = await this.lobbyRepository
      .search()
      .where('name')
      .equals(lobbyName)
      .returnFirst();

    if (lobbyToJoin) {
      // lobby exist - check extra conditions (empty slots,...)
      //@ts-expect-error
      if (lobbyToJoin?.players?.length == 10) {
        // full
        throw new ForbiddenException(`Lobby "${lobbyName}" is full`);
      } else {
        // can join
        // TODO check FE - was lobbyinfo.lobby

        const lobby: Lobby = {
          name: lobbyToJoin.name as string,
          status: lobbyToJoin.status as string,
          players: (lobbyToJoin.players || []) as unknown as Player[],
        };

        return lobby;
      }
    } else {
      throw new NotFoundException(`Lobby "${lobbyName}" doesn't exist`);
    }
  }
}
