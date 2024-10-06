export class WsWordPickDto {
  /**
   * The word that the drawer pickekd to draw
   * @example 'pes'
   */
  pickedWord: string;

  /**
   * The name of the lobby
   * @example 'Test123'
   */
  lobbyName: string;

  /**
   * Player's display name
   * @example 'Pilot'
   */
  userName: string;
}
