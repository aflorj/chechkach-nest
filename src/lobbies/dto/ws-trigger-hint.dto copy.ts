export class WsTriggerHintDto {
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
   * The index of the hint
   * @example 1
   */
  index: number;
}
