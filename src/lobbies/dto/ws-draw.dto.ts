export class Pixel {
  /**
   * x coordinate of the new pixel
   * @example 1
   */
  x: number;

  /**
   * x coordinate of the new pixel
   * @example 2
   */
  y: number;

  /**
   * Hex color of the pixel
   * @example '#000000'
   */
  color: string;

  /**
   * Height and width of the pixel
   * @example 4
   */
  brushSize: number;

  /**
   * Is this the line-ending pixel
   * @example true
   */
  isEnding: boolean;
}

export class WsDrawDto {
  /**
   * PixelDto
   * @example
   * {
   *  color: '#000000';
   *  brushSize: 4;
   *  isEnding: true;
   * }
   */
  newLine: Pixel;

  /**
   * The name of the lobby
   * @example 'Test123'
   */
  lobbyName: string;
}
