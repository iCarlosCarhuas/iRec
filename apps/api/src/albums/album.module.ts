import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AlbumController } from './album.controller.js';
import { AlbumMembersController } from './album-members.controller.js';
import { AlbumMembersService } from './album-members.service.js';
import { AlbumService } from './album.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AlbumController, AlbumMembersController],
  providers: [AlbumService, AlbumMembersService],
})
export class AlbumModule {}
