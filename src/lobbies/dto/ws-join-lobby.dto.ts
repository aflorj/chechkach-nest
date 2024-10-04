export class WsJoinLobbyDto {
  /**
   * The name of the lobby the player is attempting to join
   * @example 'Test123'
   */
  lobbyName: string;

  /**
   * Player's display name
   * @example 'Pilot'
   */
  userName?: string;

  /**
   * The socketId that the players last used
   * @example 123
   */
  lastKnownSocketId?: string;
}
