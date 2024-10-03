import { Test, TestingModule } from '@nestjs/testing';
import { BurekService } from './burek.service';

describe('BurekService', () => {
  let service: BurekService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BurekService],
    }).compile();

    service = module.get<BurekService>(BurekService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
