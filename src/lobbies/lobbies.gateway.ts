import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJoinLobbyDto } from './dto/ws-join-lobby.dto';
import { LobbiesService } from './lobbies.service';
import { EntityId } from 'redis-om';
import { WsMessageDto } from './dto/ws-message.dto';
import { isCloseGuess } from 'src/utils/close-guess.util';
import { determineNextDrawer } from 'src/utils/next-drawer.util';
import { generateHints } from 'src/utils/generate-hints.util';
import { WsStartGameDto } from './dto/ws-start-game.dto';
import { ForbiddenException } from '@nestjs/common';
import { WsWordPickDto } from './dto/ws-word-pick.dto';
import { WsDrawDto } from './dto/ws-draw.dto';
import { WsFillDto } from './dto/ws-fill.dto';
import { WsFullLineDto } from './dto/ws-full-line.dto';
import { WsUndoDto } from './dto/ws-undo.dto';
import { WsTriggerRoundEndByTimerDto } from './dto/ws-trigger-round-end-by-timer.dto';
import { WsTriggerHintDto } from './dto/ws-trigger-hint.dto copy';
import { PrismaService } from 'src/prisma.service';
import { Lobby } from './entities/lobby.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LobbiesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly lobbiesService: LobbiesService,
    private readonly prismaService: PrismaService,
  ) {}
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect = async (client: Socket) => {
    console.log(`Client disconnected: ${client.id}`);

    const disconnectLobby = (await this.lobbiesService.repository
      .search()
      .where('socketIds')
      .contains(client.id)
      .returnFirst()) as unknown as Lobby;

    let tempLobby = disconnectLobby;

    let playerIndex = tempLobby?.players?.findIndex(
      (player) => player?.socketId === client.id,
    );

    // check if disconnecting player is owner and find a new owner
    // and if there is more than 1 player find the index of the first connected non-owner player
    if (
      tempLobby?.players?.[playerIndex]?.isOwner &&
      tempLobby?.players?.length > 1
    ) {
      let newOwnerIndex = tempLobby?.players?.findIndex(
        (player) => player.connected && !player.isOwner,
      );

      if (newOwnerIndex !== -1) {
        // there are still connected players that can become the owner
        tempLobby.players[newOwnerIndex].isOwner = true;
      }
    }

    // we also check if the person who disconnected is the person drawing - in this case we end (abort) the round
    // TODO
    const didDrawingUserDisconnect =
      tempLobby?.players?.[playerIndex]?.playerId ===
      tempLobby?.gameState?.drawingUser;

    // depending on the game status remove or just change the connection status of the disconnecting player
    if (
      disconnectLobby?.status === 'open' ||
      disconnectLobby?.status === 'gameOver'
    ) {
      // if the status of the lobby equals 'open' or 'gameOver' we remove the player on disconnect
      tempLobby?.players?.splice?.(playerIndex, 1);
    } else {
      // if the game is active, we change their 'connected' to false
      tempLobby.players[playerIndex].connected = false;
    }

    // @ts-expect-error
    const saveDisconnect = await this.lobbiesService.repository.save(tempLobby);

    // check how many CONNECTED players remain in the lobbby - if the lobby is empty after the disconnect, delete it
    // @ts-expect-error
    let throwawayPlayers = [...saveDisconnect?.players];
    let stillConnected = throwawayPlayers?.filter?.(
      (player) => player?.connected,
    )?.length;

    if (stillConnected === 0) {
      // delete the lobbby as there is no more connected players in it
      await this.lobbiesService.repository.remove(disconnectLobby[EntityId]);
    } else if (stillConnected === 1) {
      // TODO
      // only one player remains - end the game because not enough active players left
      // gameover status with extra message about there not beeing enought players to keep the game going

      // TODO remove, temp for testing on local
      this.prepareNextRound(tempLobby);
      // temp for testing on local
    } else {
      // someone disconnected but the game goes on

      // if the disconnected player was drawing, trigger prepareNextRound DOING
      this.prepareNextRound(tempLobby);
    }

    // emit the new lobby state as a 'lobbyUpdate' to all players in the lobby
    this.server.to(disconnectLobby?.name).emit('userStateChange', {
      newUserState: saveDisconnect.players,
    });
    //
  };

  prepareNextRound = async (tempLobby) => {
    // calculate points for winner and the person drawing
    // TODO balance this at some point down the road

    // map over players and check if they had a correct guess and then score them on based on their placement
    let roundScoreboard = tempLobby?.players?.map((player) => ({
      playerId: player?.playerId,
      score:
        tempLobby?.gameState?.roundWinners?.findIndex(
          (pl) => pl?.userName === player?.playerId,
        ) === -1
          ? 0
          : 500 -
            tempLobby?.gameState?.roundWinners?.findIndex(
              (pl) => pl?.userName === player?.playerId,
            ) *
              50,
    }));

    // find the drawer and award them points based the number of correct guesses
    let drawerIndexOnTheRoundScoreboard = roundScoreboard?.findIndex(
      (el) => el?.playerId === tempLobby?.gameState?.drawingUser,
    );
    roundScoreboard[drawerIndexOnTheRoundScoreboard].score =
      tempLobby?.gameState?.roundWinners?.length === 0
        ? 0
        : 200 + tempLobby?.gameState?.roundWinners?.length * 50; // 0 pts if noone guessed correcty and 200 base + 50 per correct guess if there are round winners

    // and finnally sort the roundScoreboard array
    let sortedRoundScoreboard = roundScoreboard?.sort(
      (a, b) => b?.score - a?.score,
    );

    // add points to players total
    sortedRoundScoreboard
      ?.filter((pws) => pws?.score > 0)
      ?.forEach((sbtz) => {
        let tindex = tempLobby?.players?.findIndex(
          (tlp) => tlp?.playerId === sbtz?.playerId,
        );
        tempLobby.players[tindex].score += sbtz?.score;
      });

    let tempUnmaskedWord = tempLobby.gameState.wordToGuess;
    // determine who is drawing next

    let socketIdForDrawingNext = null;

    let nextDrawer = determineNextDrawer(tempLobby);
    if (
      // currentDrawerIndex + 1 >= tempLobby?.players?.length &&
      nextDrawer === null &&
      tempLobby?.gameState?.totalRounds === tempLobby?.gameState?.roundNo
    ) {
      // gameOver
      tempLobby.status = 'roundOver';
      tempLobby.gameState.wordToGuess = null;
      tempLobby.gameState.roundWinners = [];
      tempLobby.gameState.hints = [];
      tempLobby.gameState.canvas = [];

      const saveLobbby = await this.lobbiesService.repository.save(tempLobby);

      this.server.to(tempLobby.name).emit('lobbyStatusChange', {
        newStatus: 'roundOver',
        info: {
          unmaskedWord: tempUnmaskedWord,
          roundScoreboard: sortedRoundScoreboard,
          players: tempLobby?.players,
        },
      });

      setTimeout(() => {
        tempLobby.status = 'gameOver';

        const gameOverLobby = this.lobbiesService.repository.save(tempLobby);

        this.server.to(tempLobby.name).emit('lobbyStatusChange', {
          newStatus: 'gameOver',
        });
      }, 7500);
    } else {
      // apply changes/resets to the lobby
      tempLobby.status = 'roundOver';
      tempLobby.gameState.wordToGuess = null;
      tempLobby.gameState.roundWinners = [];
      tempLobby.gameState.hints = [];
      tempLobby.gameState.canvas = [];

      if (nextDrawer === null) {
        // next round
        tempLobby.gameState.roundNo = tempLobby.gameState.roundNo + 1;
        let allConnected = tempLobby?.players?.filter(
          (player) => player.connected,
        );
        tempLobby.gameState.drawingUser =
          allConnected[allConnected?.length - 1]?.playerId;
        socketIdForDrawingNext =
          allConnected[allConnected?.length - 1]?.socketId;
      } else {
        // next player
        tempLobby.gameState.drawingUser = nextDrawer?.playerId;
        socketIdForDrawingNext = nextDrawer?.socketId;
      }

      // emit roundOver
      const roundOver = (await this.lobbiesService.repository.save(
        tempLobby,
      )) as unknown as Lobby;

      this.server.to(tempLobby.name).emit('lobbyStatusChange', {
        newStatus: 'roundOver',
        info: {
          drawingNext: roundOver.gameState.drawingUser,
          unmaskedWord: tempUnmaskedWord,
          roundScoreboard: sortedRoundScoreboard,
          players: tempLobby?.players,
        },
      });

      // hardcoded to SL but should be a parameter based on the lobby settings
      let wordsToPickFromQuery: { word: string }[] = await this.prismaService
        .$queryRaw`
        SELECT "word" FROM "Word"
        WHERE "languageCode" = 'sl'
        ORDER BY RANDOM()
        LIMIT 3;
      `;

      let wordsToPickFrom = wordsToPickFromQuery.map(
        (row: { word: string }) => row.word,
      );

      setTimeout(() => {
        // TODO rework with words from db in different languages
        // let wordsToPickFrom = getRandomWords(3);

        this.server.to(tempLobby.name).emit('lobbyStatusChange', {
          newStatus: 'pickingWord',
          info: { drawingUser: roundOver.gameState.drawingUser },
        });

        this.server.to(socketIdForDrawingNext).emit('pickAWord', {
          arrayOfWordOptions: wordsToPickFrom,
        });
      }, 10000);
    }
  };

  // Join
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody()
    message: WsJoinLobbyDto,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(
      `Message received: ${message.lobbyName}, ${message.userName}, ${message.lastKnownSocketId} from client: ${client.id}`,
    );

    const normalConnectAttempt = async () => {
      // join the socket and lobby if it exist or return an error if it doesn't

      const lobbies = (await this.lobbiesService.repository
        .search()
        .where('name')
        .equals(message.lobbyName)
        .returnAll()) as unknown as Lobby[];

      if (lobbies?.length === 0) {
        // lobby that we are trying to join doesn't exist - return an error
        // TODO figure this out
        // res.status(404).json({
        //   message: `Lobby "${lobbyName}" doesn't exist.`,
        // });
      } else {
        // lobbby with this name exists

        // we join the socket
        client.join(message.lobbyName);

        // and we join the lobby
        let lobbyToJoin = lobbies?.[0];
        let oldPlayers = lobbyToJoin?.players;
        lobbyToJoin.players = [
          ...oldPlayers,
          {
            playerId: message.userName,
            socketId: client.id,
            connected: true,
            isOwner: lobbyToJoin?.players?.length === 0 ? true : false, // become lobby owner if you are joining an empty lobby
            score: 0,
          },
        ];

        const saveJoinLobbby =
          // @ts-expect-error
          await this.lobbiesService.repository.save(lobbyToJoin);
        // send update message to all players in the room
        this.server.to(message.lobbyName).emit('userStateChange', {
          newUserState: saveJoinLobbby.players,
        });

        // send success response to join message to the player joining
        // TODO refactor
        this.server.to(client.id).emit('connectAttemptResponse', {
          response: {
            allGood: true,
          },
        });

        this.server.to(message.lobbyName).emit('message', {
          message: {
            type: 'playerJoiningOrLeaving',
            content: `Player ${message.userName} joined the lobby.`,
          },
          userName: 'server',
          serverMessage: true,
        });

        // console.log('lobbies after join: ', lobbies);
        // console.log(
        //   'all rooms after connect: ',
        //   socketIO?.sockets?.adapter?.rooms
        // );
      }
    };

    // DOING

    // use client's socketId to check if they are already in any of the lobbies

    if (message.lastKnownSocketId) {
      // we need to check if this person is 1) reconnecting or 2) already active in another lobby

      const lobbyWithLastKnown = (await this.lobbiesService.repository
        .search()
        .where('socketIds')
        .contains(message.lastKnownSocketId)
        .returnFirst()) as unknown as Lobby;

      if (lobbyWithLastKnown) {
        // this user is already connected to a lobby - check if this is the current lobby he is trying to (re)connect to or a different lobby
        if (lobbyWithLastKnown?.name == message.lobbyName) {
          let tempReconnectLobby = lobbyWithLastKnown;

          // reconnecting
          // we join the socket
          client.join(message.lobbyName);

          // find index
          let reconnectedPlayerIndex = tempReconnectLobby?.players?.findIndex(
            (player) => player?.socketId === message.lastKnownSocketId,
          );

          // change connected to true
          tempReconnectLobby.players[reconnectedPlayerIndex].connected = true;

          // set the new socketId
          tempReconnectLobby.players[reconnectedPlayerIndex].socketId =
            client.id;

          const reconnectLobbby =
            // @ts-expect-error
            await this.lobbiesService.repository.save(tempReconnectLobby);
          this.server.to(message.lobbyName).emit('userStateChange', {
            newUserState: reconnectLobbby.players,
          });

          // TODO refactor
          this.server.to(client.id).emit('connectAttemptResponse', {
            response: {
              allGood: true,
            },
          });

          this.server.to(message.lobbyName).emit('message', {
            message: {
              type: 'playerJoiningOrLeaving',
              content: `Player ${message.userName} reconnected.`,
            },
            userName: 'server',
            serverMessage: true,
          });
        } else {
          // TODO active somewhere else
          this.server.to(client.id).emit('connectAttemptResponse', {
            response: {
              alreadyActive: true,
            },
          });

          //
        }
      } else {
        // this person was active before but the lobby he was a part of doesn't exist anymore
        normalConnectAttempt();
      }
    } else {
      // completely fresh connect attempt
      normalConnectAttempt();
    }
  }

  // Message
  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody()
    message: WsMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // the types of messages that we should handle:
    // 1. drawer - just broadcast the message to the lobby
    // 2. player who is still guessing - check if correct, close call or normal message

    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    let tempLobby = ourLobby;

    // check that the message is not coming from the person drawing
    // TODO gamestate, drawing user should be part of the schema
    if (tempLobby?.gameState?.drawingUser !== message.userName) {
      // if the lobby's status is 'playing' we are considering this a guess and will compare it to the 'wordToGuess'
      if (tempLobby.status === 'playing') {
        if (
          tempLobby?.gameState?.roundWinners?.filter(
            (winner) => winner?.userName === message.userName,
          )?.length > 0
        ) {
          // the player is one of the winners -> broadcast the message to other round winners
          tempLobby.gameState.roundWinners.forEach((winner) => {
            this.server.to(winner.socketId)?.emit('message', {
              message: {
                type: 'winnersOnly',
                content: message.messageContent,
              },
              userName: message.userName,
              serverMessage: false,
            });
          });

          // and the person drawing
          let personDrawingSocketId = tempLobby.players.filter(
            (player) => player.playerId === tempLobby.gameState.drawingUser,
          )[0].socketId;

          this.server.to(personDrawingSocketId)?.emit('message', {
            message: {
              type: 'winnersOnly',
              content: message.messageContent,
            },
            userName: message.userName,
            serverMessage: false,
          });

          return;
        } else {
          // console.log('checking for correct guess');
          let wordToGuess = ourLobby.gameState.wordToGuess;
          let guess = message.messageContent?.trim()?.toLowerCase();
          if (guess === wordToGuess) {
            // correct guess
            // console.log('correct guess!');

            // don't broadcast the correct guess - broadcast the correct guess server alert instead

            // add the player to the winners array
            tempLobby.gameState.roundWinners.push({
              userName: message.userName,
              socketId: client.id,
            });

            // if this was the first correct guess and there is at least 31s left in the round we set time timeleft to 30s and emit the event
            if (
              tempLobby?.gameState?.roundWinners?.length === 1 &&
              tempLobby?.gameState?.roundEndTimeStamp -
                new Date().getTime() / 1000 >=
                31
            ) {
              let newRoundEndTimeStamp =
                Math.floor(new Date().getTime() / 1000) + 30;
              tempLobby.gameState.roundEndTimeStamp = newRoundEndTimeStamp;

              this.server.to(message.lobbyName).emit('newRoundEndTimeStamp', {
                newRoundEndTimeStamp: newRoundEndTimeStamp,
              });
            }

            const winnerSave = (await this.lobbiesService.repository.save(
              // @ts-expect-error
              tempLobby,
            )) as unknown as Lobby;
            // check if all the players have guessed the word and finish the round
            if (
              winnerSave?.gameState?.roundWinners?.length ===
              winnerSave?.players?.length - 1
            ) {
              this.prepareNextRound(winnerSave);
            }

            // emit the correctGuess message to the whole lobby
            this.server.to(message.lobbyName).emit('message', {
              message: { type: 'correctGuess', content: message.userName },
              serverMessage: true,
            });

            // emit unmaskedWord to the person correctly guessing
            // TODO do we need a specific event just to send unmasked?
            this.server.to(client.id).emit('unmaskedWord', {
              unmaskedWord: wordToGuess,
            });
            return;
          } else if (isCloseGuess(guess, wordToGuess)) {
            // TODO check if this is implemented on the FE
            this.server.to(client.id).emit('message', {
              message: { type: 'closeGuess' },
              serverMessage: true,
            });
          }
        }
      }
    }

    // The message did not fall into any of the special categories so it's a normal message that should be broadcasted to the lobby
    this.server.to(message.lobbyName).emit('message', {
      userName: message.userName,
      message: { type: message.messageType, content: message.messageContent },
      serverMessage: false,
    });
  }

  @SubscribeMessage('startGame')
  async startGame(
    @MessageBody()
    message: WsStartGameDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    // find index of our player in the lobby
    let tempLobby = ourLobby;
    let playerIndex = tempLobby?.players?.findIndex(
      (player) => player?.playerId === message.userName,
    );

    // check if the player even has the permission to start the game (isOwner === true)
    if (tempLobby.players[playerIndex].isOwner) {
      // they are the owner - start

      // starting the game
      tempLobby.status = 'pickingWord';
      tempLobby.gameState = {
        totalRounds: 3, // TODO lobby owner should be able to set the # of rounds
        roundNo: 1,
        drawingUser:
          tempLobby?.players?.[tempLobby?.players?.length - 1]?.playerId,
        wordToGuess: null,
        roundWinners: [],
        roundEndTimeStamp: null,
        canvas: [],
        hints: [],
      };

      // hardcoded to SL but should be a parameter based on the lobby settings
      let wordsToPickFromQuery: { word: string }[] = await this.prismaService
        .$queryRaw`
          SELECT "word" FROM "Word"
          WHERE "languageCode" = 'sl'
          ORDER BY RANDOM()
          LIMIT 3;
        `;

      let wordsToPickFrom = wordsToPickFromQuery.map(
        (row: { word: string }) => row.word,
      );

      let drawerSocketId =
        tempLobby?.players?.[tempLobby?.players?.length - 1]?.socketId;

      // @ts-expect-error
      await this.lobbiesService.repository.save(tempLobby);

      this.server.to(message.lobbyName).emit('lobbyStatusChange', {
        newStatus: 'pickingWord',
        info: {
          drawingUser:
            tempLobby?.players?.[tempLobby?.players?.length - 1]?.playerId,
        },
      });

      this.server.to(drawerSocketId).emit('pickAWord', {
        arrayOfWordOptions: wordsToPickFrom,
      });
    } else {
      throw new ForbiddenException('You are not the drawer');
    }
  }

  @SubscribeMessage('wordPick')
  async wordPick(
    @MessageBody()
    message: WsWordPickDto,
    @ConnectedSocket() client: Socket,
  ) {
    const epochNow = Math.floor(new Date().getTime() / 1000);

    // ackn the choice
    this.server
      .to(client.id)
      .emit('startDrawing', { wordToDraw: message.pickedWord });

    // redis game state
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    // find index of our player in the lobby
    let tempLobby = ourLobby;

    tempLobby.status = 'playing';
    tempLobby.gameState.wordToGuess = message.pickedWord;
    tempLobby.gameState.roundEndTimeStamp = epochNow + 60;
    tempLobby.gameState.hints = generateHints(message.pickedWord);

    // @ts-expect-error
    await this.lobbiesService.repository.save(tempLobby);
    // notify the players but send the masked version of the word
    // TODO just send the word length?
    let maskedWord = message.pickedWord?.replace(/\S/g, '_');

    this.server.to(message.lobbyName).emit('lobbyStatusChange', {
      newStatus: 'playing',
      info: {
        maskedWord: maskedWord,
        drawingUser: message.userName,
        roundEndTimeStamp: epochNow + 60,
      },
    });
  }

  @SubscribeMessage('draw')
  async draw(
    @MessageBody()
    message: WsDrawDto,
    @ConnectedSocket() client: Socket,
  ) {
    // emit new paths as a 'newLine' to all players in the lobby except the person drawing
    client.to(message.lobbyName).emit('newLine', {
      newLine: message.newLine,
    });
  }

  @SubscribeMessage('fill')
  async fill(
    @MessageBody()
    message: WsFillDto,
    @ConnectedSocket() client: Socket,
  ) {
    // emit to all the players in the lobby except the person drawing
    client.to(message.lobbyName).emit('fill', {
      fillInfo: message.fillInfo,
    });

    // store in Redis
    const ourLobby = await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst();

    let tempLobby = ourLobby;
    //@ts-expect-error
    tempLobby.gameState.canvas.push({
      type: 'fill',
      content: message.fillInfo,
    });

    await this.lobbiesService.repository.save(tempLobby);
  }

  @SubscribeMessage('fullLine')
  async fullLine(
    @MessageBody()
    message: WsFullLineDto,
    @ConnectedSocket() client: Socket,
  ) {
    // this is a 'full-line' coming in - it is an array of pixels coming in after the player relases the mouse button hold. It is used to update the state in redis which allows the 'undo' action and reconnects to work
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    let tempLobby = ourLobby;
    tempLobby.gameState.canvas.push({
      type: 'line',
      content: message.fullLine,
    });

    // @ts-expect-error
    await this.lobbiesService.repository.save(tempLobby);
  }

  @SubscribeMessage('undo')
  async undo(
    @MessageBody()
    message: WsUndoDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    let tempLobby = ourLobby;

    let preUndoCanvas = tempLobby.gameState.canvas;
    preUndoCanvas.pop();
    tempLobby.gameState.canvas = preUndoCanvas;

    const savedLobby = (await this.lobbiesService.repository.save(
      // @ts-expect-error
      tempLobby,
    )) as unknown as Lobby;

    // emit the full drawing to all the users to reset the canvas to full-1
    this.server.to(message.lobbyName).emit('canvasAfterUndo', {
      newCanvas: savedLobby.gameState.canvas,
      isCanvasEmpty: savedLobby.gameState.canvas.length === 0 ? true : false,
    });
  }

  @SubscribeMessage('triggerRoundEndByTimer')
  async triggerRoundEndByTimer(
    @MessageBody()
    message: WsTriggerRoundEndByTimerDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    let tempLobby = ourLobby;

    // make sure the player that triggered this event is the person drawing
    if (tempLobby.gameState.drawingUser === message.userName) {
      this.prepareNextRound(tempLobby);
    }
  }

  @SubscribeMessage('triggerHint')
  async triggerHint(
    @MessageBody()
    message: WsTriggerHintDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ourLobby = (await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst()) as unknown as Lobby;

    // make sure the player that triggered this event is the person drawing
    if (ourLobby.gameState.drawingUser === message.userName) {
      // emit hint
      client.to(message.lobbyName).emit('hint', {
        hint: ourLobby?.gameState?.hints[message.index],
      });
    }
  }
}
