import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { Synagogue } from '../synagogue.entity';
import { normalizeNameForDedup } from './name-normalizer';

/**
 * Candidate-to-Synagogue mapper that implements safe merge logic.
 *
 * Rules:
 * 1. If candidate has `wikidata`: try to find existing Synagogue by wikidata value.
 * 2. Else: try spatial (50m) + normalizedName dedupe.
 * 3. If found and existing `manuallyVerified=true`: preserve verified fields, only update clearly enriched values.
 * 4. If found and existing `manuallyVerified=false`: update all fields from candidate (safe).
 * 5. If not found: create new Synagogue, set `manuallyVerified=false`.
 * 6. Always set `source='osm'` and `sourceConfidence` from candidate.
 */
@Injectable()
export class CandidateMapperService {
  private readonly logger = new Logger(CandidateMapperService.name);

  constructor(
    @InjectRepository(Synagogue) private synagoguesRepo: Repository<Synagogue>,
  ) {}

  /**
   * Map a candidate to a Synagogue entity (for creation or update).
   *
   * Returns:
   * - { synagogue, isNew: boolean } where synagogue is ready to save, and isNew indicates if it's a new record.
   */
  async mapCandidateToSynagogue(
    candidate: CandidateSynagogue,
  ): Promise<{ synagogue: Synagogue; isNew: boolean }> {
    let existing: Synagogue | null = null;

    // Step 1: Try to find existing by wikidata (most reliable)
    if (candidate.wikidata) {
      existing = await this.synagoguesRepo.findOne({
        where: {
          wikidata: candidate.wikidata,
          destination: { id: candidate.destination.id },
        },
      });

      if (existing) {
        this.logger.debug(
          `Found existing Synagogue by wikidata: ${candidate.wikidata}`,
        );
      }
    }

    // Step 2: Try spatial + name dedupe if not found by wikidata
    if (!existing && candidate.normalizedName) {
      const query = this.synagoguesRepo
        .createQueryBuilder('s')
        .where('s.destination_id = :destId', {
          destId: candidate.destination.id,
        })
        .andWhere('s.normalized_name = :normalizedName', {
          normalizedName: candidate.normalizedName,
        });

      // Use PostGIS ST_DWithin for spatial proximity (50m)
      if (
        candidate.location &&
        typeof candidate.location === 'object' &&
        'coordinates' in candidate.location
      ) {
        const coordinates = (
          candidate.location as { coordinates: [number, number] }
        ).coordinates;
        const [lon, lat] = coordinates;
        query.andWhere(
          `ST_DWithin(s.location, ST_GeographyFromText('SRID=4326;POINT(${lon} ${lat})'), 50)`,
        );
      }

      existing = await query.getOne();

      if (existing) {
        this.logger.debug(
          `Found existing Synagogue by spatial + name proximity: ${candidate.name}`,
        );
      }
    }

    if (!existing) {
      // Create new Synagogue
      this.logger.debug(
        `Creating new Synagogue from candidate: ${candidate.name}`,
      );
      return {
        synagogue: this.candidateToNewSynagogue(candidate),
        isNew: true,
      };
    }

    // Merge with existing (respecting manual verification)
    return {
      synagogue: this.mergeCandidateIntoSynagogue(candidate, existing),
      isNew: false,
    };
  }

  /**
   * Create a new Synagogue from a candidate.
   */
  private candidateToNewSynagogue(candidate: CandidateSynagogue): Synagogue {
    const synagogue = new Synagogue();
    synagogue.name = candidate.name;
    synagogue.normalizedName = candidate.normalizedName;
    synagogue.location = candidate.location;
    synagogue.destination = candidate.destination;

    // Copy enriched fields
    synagogue.website = candidate.website;
    synagogue.phone = candidate.phone;
    synagogue.openingHours = candidate.openingHours;
    synagogue.addrStreet = candidate.addrStreet;
    synagogue.addrHousenumber = candidate.addrHousenumber;
    synagogue.addrPostcode = candidate.addrPostcode;
    synagogue.addrCity = candidate.addrCity;
    synagogue.wikidata = candidate.wikidata;
    synagogue.wikipedia = candidate.wikipedia;
    synagogue.denomination = candidate.denomination;
    synagogue.operator = candidate.operator;

    // Set source tracking
    synagogue.source = candidate.source;
    synagogue.sourceConfidence = candidate.sourceConfidence;
    synagogue.rawOsm = candidate.rawOsm;

    // New synagogues start unverified
    synagogue.manuallyVerified = false;
    synagogue.verificationSource = undefined;
    synagogue.verificationNotes = undefined;

    return synagogue;
  }

  /**
   * Merge candidate into existing Synagogue, respecting manual verification.
   */
  private mergeCandidateIntoSynagogue(
    candidate: CandidateSynagogue,
    existing: Synagogue,
  ): Synagogue {
    // If existing is manually verified, be cautious about updates
    if (existing.manuallyVerified) {
      return this.mergeIntoVerifiedSynagogue(candidate, existing);
    } else {
      // If not verified, update more aggressively from candidate
      return this.mergeIntoUnverifiedSynagogue(candidate, existing);
    }
  }

  /**
   * Merge into a manually verified Synagogue (conservative approach).
   * Only update fields if candidate provides clearly better (non-empty, enriched) values.
   */
  private mergeIntoVerifiedSynagogue(
    candidate: CandidateSynagogue,
    existing: Synagogue,
  ): Synagogue {
    this.logger.debug(
      `Merging candidate into manually verified Synagogue: ${existing.id}`,
    );

    // Update name only if candidate is significantly different and verified
    // (usually keep verified name)
    // existing.name = existing.name; // Keep verified name

    // Update enriched fields only if they add clear value and existing is empty/null
    if (!existing.website && candidate.website) {
      existing.website = candidate.website;
      this.logger.debug(`Added website: ${candidate.website}`);
    }

    if (!existing.phone && candidate.phone) {
      existing.phone = candidate.phone;
      this.logger.debug(`Added phone: ${candidate.phone}`);
    }

    if (!existing.openingHours && candidate.openingHours) {
      existing.openingHours = candidate.openingHours;
      this.logger.debug(`Added opening hours`);
    }

    // Address fields: add if missing
    if (!existing.addrStreet && candidate.addrStreet) {
      existing.addrStreet = candidate.addrStreet;
    }
    if (!existing.addrHousenumber && candidate.addrHousenumber) {
      existing.addrHousenumber = candidate.addrHousenumber;
    }
    if (!existing.addrPostcode && candidate.addrPostcode) {
      existing.addrPostcode = candidate.addrPostcode;
    }
    if (!existing.addrCity && candidate.addrCity) {
      existing.addrCity = candidate.addrCity;
    }

    // Wikidata: add if missing, but don't overwrite if already verified
    if (!existing.wikidata && candidate.wikidata) {
      existing.wikidata = candidate.wikidata;
      this.logger.debug(`Added wikidata: ${candidate.wikidata}`);
    }

    // Wikipedia: add if missing
    if (!existing.wikipedia && candidate.wikipedia) {
      existing.wikipedia = candidate.wikipedia;
    }

    // Denomination: add if missing
    if (!existing.denomination && candidate.denomination) {
      existing.denomination = candidate.denomination;
    }

    // Operator: add if missing
    if (!existing.operator && candidate.operator) {
      existing.operator = candidate.operator;
    }

    // Always update source tracking to reflect latest import
    existing.source = candidate.source;
    existing.sourceConfidence = candidate.sourceConfidence;
    existing.rawOsm = candidate.rawOsm;

    return existing;
  }

  /**
   * Merge into an unverified Synagogue (aggressive approach).
   * Update most fields from candidate to enrich.
   */
  private mergeIntoUnverifiedSynagogue(
    candidate: CandidateSynagogue,
    existing: Synagogue,
  ): Synagogue {
    this.logger.debug(
      `Merging candidate into unverified Synagogue: ${existing.id}`,
    );

    // Update all fields from candidate if candidate has them
    if (candidate.name) existing.name = candidate.name;
    if (candidate.normalizedName)
      existing.normalizedName = candidate.normalizedName;
    if (candidate.location) existing.location = candidate.location;
    if (candidate.website) existing.website = candidate.website;
    if (candidate.phone) existing.phone = candidate.phone;
    if (candidate.openingHours) existing.openingHours = candidate.openingHours;
    if (candidate.addrStreet) existing.addrStreet = candidate.addrStreet;
    if (candidate.addrHousenumber)
      existing.addrHousenumber = candidate.addrHousenumber;
    if (candidate.addrPostcode) existing.addrPostcode = candidate.addrPostcode;
    if (candidate.addrCity) existing.addrCity = candidate.addrCity;
    if (candidate.wikidata) existing.wikidata = candidate.wikidata;
    if (candidate.wikipedia) existing.wikipedia = candidate.wikipedia;
    if (candidate.denomination) existing.denomination = candidate.denomination;
    if (candidate.operator) existing.operator = candidate.operator;

    // Update source tracking
    existing.source = candidate.source;
    existing.sourceConfidence = candidate.sourceConfidence;
    existing.rawOsm = candidate.rawOsm;

    return existing;
  }
}
