import { PartialType } from '@nestjs/swagger';
import { CreateBurekDto } from './create-burek.dto';

export class UpdateBurekDto extends PartialType(CreateBurekDto) {}
