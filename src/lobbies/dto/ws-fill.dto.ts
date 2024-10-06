export class FillInfoDto {
  /**
   * RGB value of the fill
   * @example 'rgb(192,64,0)'
   */
  color: string;

  /**
   * x offset on canvas where the fill originates
   * @example 10
   */
  startX: string;

  /**
   * y offset on canvas where the fill originates
   * @example 10
   */
  startY: string;
}

export class WsFillDto {
  /**
   * FillInfoDto
   * @example
   * {
   *   color: 'rgb(192,64,0)';
   *   startX: 10;
   *   startY: 10;
   * }
   */
  fillInfo: FillInfoDto;

  /**
   * The name of the lobby
   * @example 'Test123'
   */
  lobbyName: string;
}
