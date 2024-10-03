import { Injectable } from '@nestjs/common';
import { CreateBurekDto } from './dto/create-burek.dto';
import { UpdateBurekDto } from './dto/update-burek.dto';

@Injectable()
export class BurekService {
  create(createBurekDto: CreateBurekDto) {
    return 'This action adds a new burek';
  }

  findAll() {
    return `This action returns all burek`;
  }

  findOne(id: number) {
    return `This action returns a #${id} burek`;
  }

  update(id: number, updateBurekDto: UpdateBurekDto) {
    return `This action updates a #${id} burek`;
  }

  remove(id: number) {
    return `This action removes a #${id} burek`;
  }
}
