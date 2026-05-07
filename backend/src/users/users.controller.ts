import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  Request,
  Body,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.getCurrentUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateCurrentUser(req.user.sub, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/password')
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.sub, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(@Request() req) {
    return this.usersService.deleteCurrentUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(@Request() req, @UploadedFile() file) {
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    return this.usersService.updateAvatar(req.user.sub, imageUrl);
  }
  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  async deleteAvatar(@Request() req) {
    return this.usersService.removeAvatar(req.user.sub);
  }
}
