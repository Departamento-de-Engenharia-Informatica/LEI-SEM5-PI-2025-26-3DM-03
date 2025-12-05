import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OemModule } from './oem/oem.module';

@Module({
  imports: [OemModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
//a