export class JoinLobbyDto {
  /**
   * The name of the lobby the player is attempting to join
   * @example 'Test123'
   */
  lobbyName: string;

  /**
   * The socketId that the players last used
   * @example 123
   */
  lastKnownSocketId?: string;
}
