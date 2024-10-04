import { ApiProperty } from '@nestjs/swagger';
import { Schema } from 'redis-om';

export class Player {
  @ApiProperty()
  playerId: string;

  @ApiProperty()
  socketId: string;

  @ApiProperty()
  connected: boolean;

  @ApiProperty()
  isOwner: boolean;

  @ApiProperty()
  score: number;
}

export class Lobby {
  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [Player] })
  players: Player[];
}

export const lobbySchema = new Schema('lobby', {
  name: { type: 'string' },
  status: { type: 'string' },
  playersIds: { type: 'string[]', path: '$.players[*].playerId' },
  playersSocketIds: { type: 'string[]', path: '$.players[*].socketId' },
  playersScore: { type: 'number[]', path: '$.players[*].score' },
});
