import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ComplementaryTaskCategoryService, OperationPlanService } from './oem/services';
import { readFileSync } from 'fs';

const logger = new Logger('Bootstrap');

function loadHttpsOptions() {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  if (!keyPath || !certPath) {
    return undefined;
  }

  try {
    const key = readFileSync(keyPath);
    const cert = readFileSync(certPath);
    const passphrase = process.env.SSL_PASSPHRASE;
    logger.log(`HTTPS enabled using cert at ${certPath}`);
    return passphrase ? { key, cert, passphrase } : { key, cert };
  } catch (error) {
    logger.error('Failed to load SSL key/cert. Falling back to HTTP.', error as Error);
    return undefined;
  }
}

async function bootstrap() {
  const httpsOptions = loadHttpsOptions();
  const app = await NestFactory.create(AppModule, { cors: true, httpsOptions });

  logger.log(`OEM DB path: ${process.env.DATABASE_PATH || 'port.db'}`);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OEM Module API')
    .setDescription('Operations & Execution Management service endpoints')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const categoryService = app.get(ComplementaryTaskCategoryService);
  const planService = app.get(OperationPlanService);
  try {
    await categoryService.ensureDevSeed();
  } catch (error) {
    logger.warn(`Dev seed skipped for complementary task categories: ${(error as Error).message}`);
  }
  try {
    await planService.ensureDevSeed();
  } catch (error) {
    logger.warn(`Dev seed skipped: ${(error as Error).message}`);
  }

  await app.listen(process.env.PORT ?? 3000);
  logger.log(
    `Server listening on ${httpsOptions ? 'https' : 'http'}://localhost:${process.env.PORT ?? 3000}`,
  );
}

bootstrap();
