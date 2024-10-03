export class CreateLobbyDto {
  /**
   * The name of the lobby
   * @example 'Test lobby'
   */
  name: string;

  /**
   * Password to enter the lobby
   * @example password123
   */
  password?: string;

  /**
   * Private lobbies are hidden from the lobby list
   * @example true
   */
  private?: boolean;
}
