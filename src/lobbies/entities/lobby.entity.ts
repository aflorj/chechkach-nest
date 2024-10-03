import { Schema } from 'redis-om';

export class Lobby {
  name: string;
  status: string;
  playersIds: string[];
  playersSocketIds: string[];
  playersScore: number[];
}

export const lobbySchema = new Schema('lobby', {
  name: { type: 'string' },
  status: { type: 'string' },
  playersIds: { type: 'string[]', path: '$.players[*].playerId' },
  playersSocketIds: { type: 'string[]', path: '$.players[*].socketId' },
  playersScore: { type: 'number[]', path: '$.players[*].score' },
});
