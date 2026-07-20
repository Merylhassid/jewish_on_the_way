import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ChatPublicFeedService } from './chat-public-feed.service';

const ALLOWED_POST_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('chat')
export class ChatController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly publicFeedService: ChatPublicFeedService,
  ) {}

  @Get('public/:destinationId')
  getPublicFeed(
    @Param('destinationId', ParseIntPipe) destinationId: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.publicFeedService.getFeed(destinationId, limit, offset);
  }

  @Get('public/:destinationId/posts/:messageId')
  getPublicPost(
    @Param('destinationId', ParseIntPipe) destinationId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.publicFeedService.getPost(destinationId, messageId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_POST_IMAGE_MIME_TYPES.has(file.mimetype)) {
          return callback(new BadRequestException('Image must be a JPEG, PNG, or WebP file'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadPostImage(@UploadedFile() file) {
    if (!file) throw new BadRequestException('Image file is required');
    const imageUrl = await this.cloudinaryService.uploadImage(file, 'community-posts');
    return { imageUrl };
  }
}
