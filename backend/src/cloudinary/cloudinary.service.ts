import { Injectable } from '@nestjs/common';
import { v2 as Cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    Cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: any): Promise<string> {
    return new Promise((resolve, reject) => {
      Cloudinary.uploader
        .upload_stream({ folder: 'avatars' }, (error: any, result: any) => {
          if (error) return reject(new Error(error.message));
          resolve(result.secure_url);
        })
        .end(file.buffer);
    });
  }
}
