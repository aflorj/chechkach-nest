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

export class Hint {
  index: number;
  word: string;
}

export class GameState {
  @ApiProperty()
  totalRounds: number;

  @ApiProperty()
  roundNo: number;

  @ApiProperty()
  drawingUser: string;

  @ApiProperty()
  wordToGuess: string | null;

  @ApiProperty()
  roundWinners: { userName: string; socketId: string }[];

  @ApiProperty()
  roundEndTimeStamp: number;

  @ApiProperty()
  canvas: {
    type: string;
    content: any;
  }[];

  @ApiProperty({ type: [Hint] })
  hints: Hint[];
}

export class Lobby {
  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [Player] })
  players: Player[];

  @ApiProperty({ type: GameState })
  gameState: GameState;
}

// TODO should canvas and hints be in the schema?
export const lobbySchema = new Schema('lobby', {
  name: { type: 'string' },
  status: { type: 'string' },
  playerIds: { type: 'string[]', path: '$.players[*].playerId' },
  socketIds: { type: 'string[]', path: '$.players[*].socketId' },
  // connecteds: { type: 'boolean', path: '$.players[*].connected' },
  // isOwners: { type: 'boolean', path: '$.players[*].isOwner' },
  scores: { type: 'number[]', path: '$.players[*].score' },
  totalRoundss: { type: 'number[]', path: '$.gameState[*].totalRounds' },
  roundNos: { type: 'number[]', path: '$.gameState[*].roundNo' },
  drawingUsers: { type: 'string[]', path: '$.gameState[*].drawingUser' },
  drawStates: { type: 'string[]', path: '$.gameState[*].drawState' },
  wordToGuesess: { type: 'string[]', path: '$.gameState[*].wordToGuess' },
  roundWinnerss: { type: 'string[]', path: '$.gameState[*].roundWinners' },
  roundEndTimeStampss: {
    type: 'number[]',
    path: '$.gameState[*].roundEndTimeStamp',
  },
});
