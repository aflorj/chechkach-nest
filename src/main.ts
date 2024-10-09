import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };

  const config = new DocumentBuilder()
    .setTitle('Chechkach API')
    .setDescription('Some description')
    .setVersion('1.0')
    .addTag('lobbies')
    .addServer('/api')
    .build();
  const document = SwaggerModule.createDocument(app, config, options);

  SwaggerModule.setup('swagger', app, document);

  // position of the next line matters!
  // if you move it above the DocumentBuilder it the prefix will be applied to the openapi spec
  // keep it underneath to generate the spec without the prefix and expose the api on /api
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT);
}
bootstrap();
