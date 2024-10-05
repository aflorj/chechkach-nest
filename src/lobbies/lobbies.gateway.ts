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
import { WsMessageDto } from './dto/ws-message.dto';
import { checkForCloseGuess } from 'src/utils/close-guess.util';
import { determineNextDrawer } from 'src/utils/next-drawer.util';

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

  constructor(private readonly lobbiesService: LobbiesService) {}
  // This method runs when a client connects to the server
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  // This method runs when a client disconnects from the server
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

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
      tempLobby.gameState.drawState = [];
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
      tempLobby.gameState.drawState = [];
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
      const roundOver = await this.lobbiesService.repository.save(tempLobby);

      this.server.to(tempLobby.name).emit('lobbyStatusChange', {
        newStatus: 'roundOver',
        info: {
          // @ts-expect-error
          drawingNext: roundOver.gameState.drawingUser,
          unmaskedWord: tempUnmaskedWord,
          roundScoreboard: sortedRoundScoreboard,
          players: tempLobby?.players,
        },
      });

      setTimeout(() => {
        // TODO rework with words from db in different languages
        // let wordsToPickFrom = getRandomWords(3);
        let wordsToPickFrom = ['foo', 'boo', 'hoo'];

        this.server.to(tempLobby.name).emit('lobbyStatusChange', {
          newStatus: 'pickingWord',
          // @ts-expect-error
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
  async hanleJoin(
    @MessageBody()
    message: WsJoinLobbyDto,
    @ConnectedSocket() client: Socket, // The client that sent the message
  ) {
    console.log(
      `Message received: ${message.lobbyName}, ${message.userName}, ${message.lastKnownSocketId} from client: ${client.id}`,
    );

    const normalConnectAttempt = async () => {
      // join the socket and lobby if it exist or return an error if it doesn't

      const lobbies = await this.lobbiesService.repository
        .search()
        .where('name')
        .equals(message.lobbyName)
        .returnAll();

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
          //@ts-expect-error
          ...oldPlayers,
          {
            playerId: message.userName,
            socketId: client.id,
            connected: true,
            //@ts-expect-error
            isOwner: lobbyToJoin?.players?.length === 0 ? true : false, // become lobby owner if you are joining an empty lobby
            score: 0,
          },
        ];

        const saveJoinLobbby =
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

      const lobbyWithLastKnown = await this.lobbiesService.repository
        .search()
        .where('playersSocketIds')
        .contains(message.lastKnownSocketId)
        .returnFirst();

      if (lobbyWithLastKnown) {
        // this user is already connected to a lobby - check if this is the current lobby he is trying to (re)connect to or a different lobby
        if (lobbyWithLastKnown?.name == message.lobbyName) {
          let tempReconnectLobby = lobbyWithLastKnown;

          // reconnecting
          // we join the socket
          client.join(message.lobbyName);

          // find index
          let reconnectedPlayerIndex = // @ts-expect-error
            tempReconnectLobby?.players?.findIndex(
              (player) => player?.socketId === message.lastKnownSocketId,
            );

          // change connected to true
          tempReconnectLobby.players[reconnectedPlayerIndex].connected = true;

          // set the new socketId
          tempReconnectLobby.players[reconnectedPlayerIndex].socketId =
            client.id;

          const reconnectLobbby =
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
    @ConnectedSocket() client: Socket, // The client that sent the message
  ) {
    // the types of messages that we should handle:
    // 1. drawer - just broadcast the message to the lobby
    // 2. player who is still guessing - check if correct, close call or normal message

    const ourLobby = await this.lobbiesService.repository
      .search()
      .where('name')
      .equals(message.lobbyName)
      .returnFirst();

    let tempLobby = ourLobby;

    // check that the message is not coming from the person drawing
    // TODO gamestate, drawing user should be part of the schema
    // @ts-expect-error
    if (tempLobby.gameState.drawingUser !== message.userName) {
      // if the lobby's status is 'playing' we are considering this a guess and will compare it to the 'wordToGuess'
      if (tempLobby.status === 'playing') {
        if (
          // TODO
          // @ts-expect-error
          tempLobby?.gameState?.roundWinners?.filter(
            (winner) => winner?.userName === message.userName,
          )?.length > 0
        ) {
          // the player is one of the winners -> broadcast the message to other round winners
          // TODO
          // @ts-expect-error
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
          // TODO
          // @ts-expect-error
          let personDrawingSocketId = tempLobby.players.filter(
            (player) =>
              // TODO
              // @ts-expect-error
              player.playerId === tempLobby.gameState.drawingUser,
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
          // TODO
          // @ts-expect-error
          let wordToGuess = ourLobby.gameState.wordToGuess;
          let guess = message.messageContent?.trim()?.toLowerCase();
          if (guess === wordToGuess) {
            // correct guess
            // console.log('correct guess!');

            // don't broadcast the correct guess - broadcast the correct guess server alert instead

            // add the player to the winners array
            // TODO
            // @ts-expect-error
            tempLobby.gameState.roundWinners.push({
              userName: message.userName,
              socketId: client.id,
            });

            // if this was the first correct guess and there is at least 31s left in the round we set time timeleft to 30s and emit the event
            if (
              // TODO
              // @ts-expect-error
              tempLobby?.gameState?.roundWinners?.length === 1 &&
              // TODO
              // @ts-expect-error
              tempLobby?.gameState?.roundEndTimeStamp -
                new Date().getTime() / 1000 >=
                31
            ) {
              let newRoundEndTimeStamp =
                Math.floor(new Date().getTime() / 1000) + 30;
              // TODO
              // @ts-expect-error
              tempLobby.gameState.roundEndTimeStamp = newRoundEndTimeStamp;

              this.server.to(message.lobbyName).emit('newRoundEndTimeStamp', {
                newRoundEndTimeStamp: newRoundEndTimeStamp,
              });
            }

            const winnerSave =
              await this.lobbiesService.repository.save(tempLobby);
            // check if all the players have guessed the word and finish the round
            if (
              // TODO
              // @ts-expect-error
              winnerSave?.gameState?.roundWinners?.length ===
              // TODO
              // @ts-expect-error
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
          } else if (checkForCloseGuess(guess, wordToGuess)) {
            // TODO broadcast the 'close guess' message to the user only + broadcast as a normal message to all the users (so no return here)
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
}
