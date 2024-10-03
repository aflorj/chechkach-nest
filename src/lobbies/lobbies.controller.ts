import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyDto } from './dto/update-lobby.dto';
import { ApiCreatedResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Lobby } from './entities/lobby.entity';

@Controller('lobbies')
@ApiTags('lobbies')
export class LobbiesController {
  constructor(private readonly lobbiesService: LobbiesService) {}

  @Post()
  @ApiCreatedResponse({
    status: 201,
    description: 'Lobby was successfully created.',
    type: Lobby,
  })
  create(@Body() createLobbyDto: CreateLobbyDto) {
    return this.lobbiesService.create(createLobbyDto);
  }

  @Get()
  @ApiResponse({
    status: 200,
    description: 'List of lobbies',
    type: Lobby,
    isArray: true,
  })
  findAll() {
    return this.lobbiesService.findAll();
  }

  @Get(':name')
  @ApiResponse({
    status: 200,
    description: 'Lobby details',
    type: Lobby,
  })
  findOne(@Param('name') name: string) {
    return this.lobbiesService.findOne(name);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateLobbyDto: UpdateLobbyDto) {
  //   return this.lobbiesService.update(+id, updateLobbyDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.lobbiesService.remove(+id);
  // }
}
