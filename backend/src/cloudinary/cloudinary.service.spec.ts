import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    service = new CloudinaryService();
  });

  it('extracts a versioned Cloudinary public ID from an uploaded image URL', () => {
    const result = (service as any).publicIdFromUrl(
      'https://res.cloudinary.com/demo/image/upload/v1780000000/community-posts/post-1.jpg',
    );

    expect(result).toBe('community-posts/post-1');
  });

  it('extracts an unversioned Cloudinary public ID', () => {
    const result = (service as any).publicIdFromUrl(
      'https://res.cloudinary.com/demo/image/upload/avatars/avatar-1.png',
    );

    expect(result).toBe('avatars/avatar-1');
  });

  it('ignores URLs that are not hosted by Cloudinary', () => {
    const result = (service as any).publicIdFromUrl(
      'https://example.com/profile/avatar.jpg',
    );

    expect(result).toBeNull();
  });
});
