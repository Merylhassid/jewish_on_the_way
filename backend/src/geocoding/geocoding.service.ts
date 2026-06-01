import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface Coords {
  lat: number;
  lng: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(address: string, city: string, country: string): Promise<Coords | null> {
    const queries = [
      `${address}, ${city}, ${country}`,
      `${city}, ${country}`,
    ];

    for (const q of queries) {
      try {
        await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit 1 req/sec
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'json', limit: 1 },
          headers: { 'User-Agent': 'JewishOnTheWay/1.0' },
          timeout: 8000,
        });
        if (res.data?.length) {
          return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
        }
      } catch (err) {
        this.logger.warn(`Geocoding failed for "${q}": ${err}`);
      }
    }
    return null;
  }
}
