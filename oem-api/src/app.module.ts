import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OemModule } from './oem/oem.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'port.db',
      autoLoadEntities: true,
      synchronize: true,
      logging: ['error', 'schema', 'warn', 'migration'],
    }),
    OemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
//a
