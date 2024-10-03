import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LobbiesModule } from './lobbies/lobbies.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { RedisClientModule } from './redis-client/redis-client.module';
import { BurekService } from './burek/burek.service';
import { BurekModule } from './burek/burek.module';

@Module({
  imports: [ConfigModule.forRoot(), LobbiesModule, RedisClientModule, BurekModule],
  providers: [BurekService],
})
export class AppModule {}
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(LoggerMiddleware).forRoutes('lobbies');
//   }
// }
