import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('v1');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AI Leader ID API')
      .setVersion('1.0.0')
      .build(),
  );

  const turn = document.paths['/v1/simulations/{simulationId}/turns']?.post;
  if (turn?.requestBody && 'content' in turn.requestBody) {
    turn.requestBody.content = {
      'application/json': { schema: { $ref: '#/components/schemas/TextTurnDto' } },
      'multipart/form-data': { schema: { $ref: '#/components/schemas/AudioTurnDto' } },
    };
  }

  await writeFile(join(process.cwd(), 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void generateOpenApi();
