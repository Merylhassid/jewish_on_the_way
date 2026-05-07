import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateMapperService } from '../../src/places/candidate-mapper';
import { Synagogue } from '../../src/synagogue.entity';
import { CandidateSynagogue } from '../../src/candidate-synagogue.entity';
import { Destination } from '../../src/destination.entity';

describe('Candidate Admin & Mapper', () => {
  let mapperService: CandidateMapperService;
  let synagoguesRepo: Repository<Synagogue>;

  // Mock data
  const mockDestination: Destination = {
    id: 1,
    name: 'Tel Aviv',
    city: 'Tel Aviv',
    country: 'Israel',
    countryCode: 'IL',
    location: { type: 'Point', coordinates: [34.7683, 32.0853] },
  } as any;

  const createMockCandidate = (overrides: any = {}): CandidateSynagogue => ({
    id: 1,
    name: 'Beth David Synagogue',
    normalizedName: 'beth david synagogue',
    location: { type: 'Point', coordinates: [34.7683, 32.0853] },
    destination: mockDestination,
    website: 'https://bethdavid.org',
    phone: '+1-555-1234',
    openingHours: 'Mo-Fr 08:00-17:00',
    addrStreet: 'Main St',
    addrHousenumber: '123',
    addrPostcode: '69000',
    addrCity: 'Tel Aviv',
    wikidata: 'Q12345',
    wikipedia: 'https://en.wikipedia.org/wiki/Beth_David',
    denomination: 'Orthodox',
    operator: 'Jewish Community',
    source: 'osm',
    sourceId: 'n123456',
    sourceConfidence: 0.8,
    rawOsm: { amenity: 'place_of_worship', religion: 'jewish' },
    status: 'pending',
    validationReasons: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockSynagogue = (overrides: any = {}): Synagogue => ({
    id: 1,
    name: 'Beth David Synagogue',
    normalizedName: 'beth david synagogue',
    location: { type: 'Point', coordinates: [34.7683, 32.0853] },
    destination: mockDestination,
    website: null,
    phone: null,
    openingHours: null,
    addrStreet: null,
    addrHousenumber: null,
    addrPostcode: null,
    addrCity: null,
    wikidata: null,
    wikipedia: null,
    denomination: null,
    operator: null,
    source: 'osm',
    sourceConfidence: null,
    rawOsm: null,
    manuallyVerified: false,
    verificationSource: null,
    verificationNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateMapperService,
        {
          provide: getRepositoryToken(Synagogue),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    mapperService = module.get<CandidateMapperService>(CandidateMapperService);
    synagoguesRepo = module.get<Repository<Synagogue>>(
      getRepositoryToken(Synagogue),
    );
  });

  describe('mapCandidateToSynagogue - Create New', () => {
    it('should create new Synagogue from candidate when none exists', async () => {
      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const candidate = createMockCandidate();
      const { synagogue, isNew } =
        await mapperService.mapCandidateToSynagogue(candidate);

      expect(isNew).toBe(true);
      expect(synagogue.name).toBe(candidate.name);
      expect(synagogue.website).toBe(candidate.website);
      expect(synagogue.manuallyVerified).toBe(false);
    });

    it('should copy all enriched fields to new Synagogue', async () => {
      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const candidate = createMockCandidate({
        website: 'https://example.com',
        phone: '+1-555-9999',
        denomination: 'Reform',
        wikidata: 'Q54321',
      });

      const { synagogue } =
        await mapperService.mapCandidateToSynagogue(candidate);

      expect(synagogue.website).toBe('https://example.com');
      expect(synagogue.phone).toBe('+1-555-9999');
      expect(synagogue.denomination).toBe('Reform');
      expect(synagogue.wikidata).toBe('Q54321');
    });
  });

  describe('mapCandidateToSynagogue - Find by Wikidata', () => {
    it('should find existing Synagogue by wikidata QID', async () => {
      const existing = createMockSynagogue({ id: 99, wikidata: 'Q12345' });
      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(existing);

      const candidate = createMockCandidate({ wikidata: 'Q12345' });
      const { synagogue, isNew } =
        await mapperService.mapCandidateToSynagogue(candidate);

      expect(isNew).toBe(false);
      expect(synagogue.id).toBe(99);
      expect(synagoguesRepo.findOne).toHaveBeenCalledWith({
        where: { wikidata: 'Q12345', destination: { id: mockDestination.id } },
      });
    });
  });

  describe('mapCandidateToSynagogue - Merge to Verified Synagogue', () => {
    it('should preserve verified fields on manually verified Synagogue', async () => {
      const existing = createMockSynagogue({
        id: 99,
        name: 'Official Beth David',
        website: 'https://official.org',
        phone: '+1-555-OFFICIAL',
        manuallyVerified: true,
        verificationSource: 'community',
        verificationNotes: 'Verified by Rabbi',
      });

      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      });

      const candidate = createMockCandidate({
        name: 'Beth David',
        website: 'https://candidate.org',
        phone: '+1-555-CANDIDATE',
        addrStreet: '123 Main St',
      });

      const { synagogue, isNew } =
        await mapperService.mapCandidateToSynagogue(candidate);

      expect(isNew).toBe(false);
      // Verified fields should be preserved
      expect(synagogue.name).toBe('Official Beth David');
      expect(synagogue.website).toBe('https://official.org');
      expect(synagogue.phone).toBe('+1-555-OFFICIAL');
      // But enrichment fields can be added
      expect(synagogue.addrStreet).toBe('123 Main St');
    });

    it('should only add missing fields to verified Synagogue', async () => {
      const existing = createMockSynagogue({
        id: 99,
        website: 'https://existing.org',
        phone: null,
        addrCity: null,
        manuallyVerified: true,
      });

      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      });

      const candidate = createMockCandidate({
        website: 'https://candidate.org',
        phone: '+1-555-1234',
        addrCity: 'Tel Aviv',
      });

      const { synagogue } =
        await mapperService.mapCandidateToSynagogue(candidate);

      // Preserve existing website
      expect(synagogue.website).toBe('https://existing.org');
      // Add missing phone
      expect(synagogue.phone).toBe('+1-555-1234');
      // Add missing address
      expect(synagogue.addrCity).toBe('Tel Aviv');
    });
  });

  describe('mapCandidateToSynagogue - Merge to Unverified Synagogue', () => {
    it('should update all fields on unverified Synagogue', async () => {
      const existing = createMockSynagogue({
        id: 99,
        name: 'Old Name',
        website: 'https://old.org',
        phone: null,
        manuallyVerified: false,
      });

      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      });

      const candidate = createMockCandidate({
        name: 'New Name',
        website: 'https://new.org',
        phone: '+1-555-NEW',
      });

      const { synagogue } =
        await mapperService.mapCandidateToSynagogue(candidate);

      // Update fields on unverified record
      expect(synagogue.name).toBe('New Name');
      expect(synagogue.website).toBe('https://new.org');
      expect(synagogue.phone).toBe('+1-555-NEW');
    });
  });

  describe('mapCandidateToSynagogue - Spatial Proximity Dedupe', () => {
    it('should find existing Synagogue by spatial proximity + normalized name', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue(
            createMockSynagogue({ id: 77, name: 'Beth David' }),
          ),
      };

      (synagoguesRepo.findOne as jest.Mock).mockResolvedValue(null);
      (synagoguesRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        queryBuilder,
      );

      const candidate = createMockCandidate({
        wikidata: undefined, // No wikidata to trigger spatial search
        normalizedName: 'beth david',
      });

      const { synagogue, isNew } =
        await mapperService.mapCandidateToSynagogue(candidate);

      expect(isNew).toBe(false);
      expect(synagogue.id).toBe(77);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        expect.any(Object),
      );
    });
  });
});
