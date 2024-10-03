import { Test, TestingModule } from '@nestjs/testing';
import { BurekController } from './burek.controller';
import { BurekService } from './burek.service';

describe('BurekController', () => {
  let controller: BurekController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BurekController],
      providers: [BurekService],
    }).compile();

    controller = module.get<BurekController>(BurekController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
