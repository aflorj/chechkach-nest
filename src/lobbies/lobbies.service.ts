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

  create(createLobbyDto: CreateLobbyDto) {
    const lobbyName = createLobbyDto.name;

    this.lobbyRepository
      .search()
      .where('name')
      .equals(lobbyName)
      .returnAll()
      .then((response) => {
        if (response?.length === 0) {
          // lobby doesn't exist yet - create it
          this.lobbyRepository
            .save({
              name: lobbyName,
              status: 'open',
              players: [],
            })
            .then((resp) => {
              console.log('lobby creation response: ', resp);
              return resp;
            })
            .catch((err) => {
              console.log('lobby creation error: ', err);
            });
        } else {
          // lobbby with this name already exists
          console.log(`server ${lobbyName} ze obstaja`);
          // res.status(400).json({
          //   message: `Lobby with name "${lobbyName}" alerady exists.`,
          // });
        }
      })
      .catch((err) => {
        console.log('error pri iskanju 222: ', err);
      });
  }
}
