import { Pixel } from './ws-draw.dto';

export class WsFullLineDto {
  fullLine: Pixel[];

  /**
   * The name of the lobby
   * @example 'Test123'
   */
  lobbyName: string;
}
