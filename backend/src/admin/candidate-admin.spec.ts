import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { CandidateMapperService } from '../places/candidate-mapper';
import { Synagogue } from '../synagogue.entity';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { Destination } from '../destination.entity';

describe('Candidate Admin & Mapper', () => {
  let mapperService: CandidateMapperService;
  let synagogueRepo: Repository<Synagogue>;
  let candidateRepo: Repository<CandidateSynagogue>;

  const mockDestination: Destination = {
    id: 1,
    name: 'Tel Aviv',
    slug: 'tel-aviv',
    city: 'Tel Aviv',
    country: 'Israel',
    countryCode: 'IL',
    location: { type: 'Point', coordinates: [34.7683, 32.0853] },
    timezone: 'Asia/Jerusalem',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateMapperService,
        {
          provide: getRepositoryToken(Synagogue),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CandidateSynagogue),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    mapperService = module.get<CandidateMapperService>(CandidateMapperService);
    synagogueRepo = module.get<Repository<Synagogue>>(getRepositoryToken(Synagogue));
    candidateRepo = module.get<Repository<CandidateSynagogue>>(getRepositoryToken(CandidateSynagogue));
  });

  describe('mapCandidateToSynagogue', () => {
    it('should create a new synagogue when no match is found', async () => {
      const candidate = {
        id: 100,
        name: 'New Synagogue',
        normalizedName: 'new synagogue',
        location: { type: 'Point', coordinates: [34.7683, 32.0853] },
        website: 'https://example.com',
        phone: '+972123456789',
        destination: mockDestination,
        wikidata: undefined,
        source: 'osm',
        sourceConfidence: 0.85,
        rawOsm: {},
      } as any;

      // Mock findOne to return null (no existing match)
      jest.spyOn(synagogueRepo, 'findOne').mockResolvedValue(null);

      // Mock query builder for spatial search
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any;

      jest.spyOn(synagogueRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder);

      // Mock save to return what's passed to it with an id
      jest.spyOn(synagogueRepo, 'save').mockImplementation((obj: any) => {
        return Promise.resolve({ ...obj, id: 200 });
      });

      const result = await mapperService.mapCandidateToSynagogue(candidate);

      expect(result.isNew).toBe(true);
      expect(result.synagogue.manuallyVerified).toBe(false);
    });

    it('should find existing synagogue by wikidata QID', async () => {
      const candidate = {
        id: 100,
        name: 'Existing Synagogue',
        wikidata: 'Q12345',
        destination: mockDestination,
      } as any;

      const existingSynagogue = {
        id: 50,
        name: 'Existing Synagogue',
        wikidata: 'Q12345',
        manuallyVerified: false,
      } as any;

      jest.spyOn(synagogueRepo, 'findOne').mockResolvedValue(existingSynagogue);

      const result = await mapperService.mapCandidateToSynagogue(candidate);

      expect(result.isNew).toBe(false);
      expect(result.synagogue.id).toBe(50);
      expect(synagogueRepo.findOne).toHaveBeenCalledWith({
        where: {
          wikidata: 'Q12345',
          destination: { id: mockDestination.id },
        },
      });
    });

    it('should respect manuallyVerified flag when merging', async () => {
      const candidate = {
        id: 100,
        name: 'Updated Name',
        normalizedName: 'manual name', // Must match existing to find it
        website: 'https://newsite.com',
        phone: '+972987654321',
        destination: mockDestination,
        location: { type: 'Point', coordinates: [34.7683, 32.0853] },
        source: 'osm',
        sourceConfidence: 0.8,
        rawOsm: {},
      } as any;

      const manuallyVerifiedSynagogue = {
        id: 50,
        name: 'Manual Name',
        normalizedName: 'manual name',
        website: 'https://manual.com',
        manuallyVerified: true,
        verificationSource: 'admin',
        destination: mockDestination,
      } as any;

      // Mock findOne for wikidata search (returns null)
      jest.spyOn(synagogueRepo, 'findOne').mockResolvedValue(null);

      // Mock query builder for spatial search to find the existing synagogue
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(manuallyVerifiedSynagogue),
      } as any;

      jest.spyOn(synagogueRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder);

      // Mock save to return what's passed to it (the merged object)
      jest.spyOn(synagogueRepo, 'save').mockImplementation((obj: any) => {
        return Promise.resolve(obj);
      });

      const result = await mapperService.mapCandidateToSynagogue(candidate);

      // Should preserve manually verified data
      expect(result.synagogue.name).toBe('Manual Name'); // Not overwritten
      expect(result.synagogue.website).toBe('https://manual.com'); // Not overwritten
      expect(result.synagogue.manuallyVerified).toBe(true); // Preserved
      expect(result.synagogue.verificationSource).toBe('admin'); // Preserved
    });

    it('should aggressively merge unverified synagogues', async () => {
      const candidate = {
        id: 100,
        name: 'New Data',
        website: 'https://newsite.com',
        phone: '+972987654321',
        destination: mockDestination,
        source: 'osm',
      } as any;

      const unverifiedSynagogue = {
        id: 50,
        name: 'Old Data',
        website: 'https://oldsite.com',
        manuallyVerified: false,
      } as any;

      jest.spyOn(synagogueRepo, 'findOne').mockResolvedValue(unverifiedSynagogue);
      jest.spyOn(synagogueRepo, 'save').mockResolvedValue({
        ...unverifiedSynagogue,
        ...candidate,
      } as any);

      const result = await mapperService.mapCandidateToSynagogue(candidate);

      // Should update with new data
      expect(result.synagogue.name).toBe('New Data');
      expect(result.synagogue.website).toBe('https://newsite.com');
      expect(result.synagogue.phone).toBe('+972987654321');
    });
  });
});
