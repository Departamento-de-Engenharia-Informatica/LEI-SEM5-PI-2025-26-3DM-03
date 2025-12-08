import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OemModule } from './oem/oem.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'oem.db',
      autoLoadEntities: true,
      synchronize: true, // ok for dev; disable in prod and use migrations
    }),
    OemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
//a
