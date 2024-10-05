export class WsMessageDto {
  /**
   * The name of the lobby the player is attempting to join
   * @example 'Test123'
   */
  lobbyName: string;

  /**
   * Player's display name
   * @example 'Pilot'
   */
  userName: string;

  /**
   * The type of message (TODO enum)
   * @example 'public'
   */
  messageType: string;

  /**
   * Chat message
   * @example 'Hello, world'
   */
  messageContent: string;
}
