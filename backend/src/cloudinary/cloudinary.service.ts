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

  async uploadImage(file: any, folder = 'avatars'): Promise<string> {
    return new Promise((resolve, reject) => {
      Cloudinary.uploader
        .upload_stream({ folder }, (error: any, result: any) => {
          if (error) return reject(new Error(error.message));
          resolve(result.secure_url);
        })
        .end(file.buffer);
    });
  }

  async deleteImageByUrl(imageUrl: string): Promise<boolean> {
    const publicId = this.publicIdFromUrl(imageUrl);
    if (!publicId) return false;

    const result = await Cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }

    return result.result === 'ok';
  }

  private publicIdFromUrl(imageUrl: string): string | null {
    try {
      const url = new URL(imageUrl);
      if (url.hostname !== 'res.cloudinary.com') return null;

      const uploadMarker = '/upload/';
      const uploadIndex = url.pathname.indexOf(uploadMarker);
      if (uploadIndex === -1) return null;

      const pathParts = url.pathname
        .slice(uploadIndex + uploadMarker.length)
        .split('/')
        .filter(Boolean);

      if (pathParts[0]?.match(/^v\d+$/)) pathParts.shift();
      if (pathParts.length === 0) return null;

      const lastPart = pathParts[pathParts.length - 1];
      pathParts[pathParts.length - 1] = lastPart.replace(/\.[^.]+$/, '');
      return decodeURIComponent(pathParts.join('/'));
    } catch {
      return null;
    }
  }
}
