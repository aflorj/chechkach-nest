import { ApiProperty } from '@nestjs/swagger';
import { Schema } from 'redis-om';

export class Lobby {
  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  playersIds: string[];

  @ApiProperty()
  playersSocketIds: string[];

  @ApiProperty()
  playersScore: number[];
}

export const lobbySchema = new Schema('lobby', {
  name: { type: 'string' },
  status: { type: 'string' },
  playersIds: { type: 'string[]', path: '$.players[*].playerId' },
  playersSocketIds: { type: 'string[]', path: '$.players[*].socketId' },
  playersScore: { type: 'number[]', path: '$.players[*].score' },
});
