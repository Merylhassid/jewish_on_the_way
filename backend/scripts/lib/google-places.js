'use strict';

/**
 * Thin client for Google Places API (New). Tracks call counts per SKU so the
 * caller can enforce a budget guard. Never logs the API key.
 */

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'businessStatus',
  'types',
  'primaryType',
  'rating',
  'userRatingCount',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'regularOpeningHours',
  'googleMapsUri',
  'photos',
].join(',');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class GooglePlaces {
  constructor(apiKey, { rateMs = 120, maxRetries = 3 } = {}) {
    if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY');
    this.apiKey = apiKey;
    this.rateMs = rateMs;
    this.maxRetries = maxRetries;
    this.calls = { textSearch: 0, details: 0, photo: 0 };
  }

  async _fetch(url, opts) {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      let res;
      try {
        res = await fetch(url, opts);
      } catch (e) {
        // Network/DNS errors (getaddrinfo ENOTFOUND, ECONNRESET, fetch failed)
        // are transient — back off and retry rather than burning the row.
        if (attempt > this.maxRetries + 3) throw e;
        await sleep(this.rateMs * attempt * 6);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt > this.maxRetries) {
          throw new Error(`Google API ${res.status} after ${attempt} attempts`);
        }
        await sleep(this.rateMs * attempt * 4);
        continue;
      }
      return res;
    }
  }

  // Text Search, IDs-Only field mask => free SKU. Returns first place_id or null.
  async findPlaceId(textQuery, { lat, lng, radius = 500 } = {}) {
    const body = {
      textQuery,
      maxResultCount: 1,
      languageCode: 'he',
    };
    if (lat != null && lng != null) {
      body.locationBias = {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      };
    }
    const res = await this._fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify(body),
    });
    this.calls.textSearch++;
    await sleep(this.rateMs);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`TextSearch ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.places && data.places[0] ? data.places[0].id : null;
  }

  // Text Search, IDs-Only field mask, multiple results, NO location bias.
  // Used by the re-search pilot: our stored coords are broken so biasing by
  // them is exactly what produced the wrong candidates the first time.
  async searchIds(textQuery, { max = 5 } = {}) {
    const res = await this._fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery, maxResultCount: max, languageCode: 'he' }),
    });
    this.calls.textSearch++;
    await sleep(this.rateMs);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`TextSearch ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.places || []).map((p) => p.id);
  }

  // Place Details. Default = Enterprise mask; pass a custom minimal mask (e.g.
  // name/address/location/status/types only) to hit a cheaper SKU for judgment.
  async getDetails(placeId, { mask } = {}) {
    const res = await this._fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': mask || DETAILS_FIELD_MASK,
        },
      },
    );
    this.calls.details++;
    await sleep(this.rateMs);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Details ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
  }

  // Downloads photo bytes for a photo resource name. Returns { buffer, contentType }.
  async getPhotoBytes(photoName, { maxWidthPx = 800 } = {}) {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=false`;
    const res = await this._fetch(url, {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': this.apiKey },
    });
    this.calls.photo++;
    await sleep(this.rateMs);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Photo ${res.status}: ${t.slice(0, 200)}`);
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  }
}

module.exports = { GooglePlaces };
