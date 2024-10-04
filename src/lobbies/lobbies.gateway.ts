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

  // Listen to custom 'join' events from the client
  @SubscribeMessage('join')
  async handleMessage(
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
}
