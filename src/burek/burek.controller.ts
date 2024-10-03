import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BurekService } from './burek.service';
import { CreateBurekDto } from './dto/create-burek.dto';
import { UpdateBurekDto } from './dto/update-burek.dto';

@Controller('burek')
export class BurekController {
  constructor(private readonly burekService: BurekService) {}

  @Post()
  create(@Body() createBurekDto: CreateBurekDto) {
    return this.burekService.create(createBurekDto);
  }

  @Get()
  findAll() {
    return this.burekService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.burekService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBurekDto: UpdateBurekDto) {
    return this.burekService.update(+id, updateBurekDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.burekService.remove(+id);
  }
}
