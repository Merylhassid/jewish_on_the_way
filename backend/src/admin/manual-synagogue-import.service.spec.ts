import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Synagogue } from '../synagogue.entity';
import { ManualSynagogueImportService } from './manual-synagogue-import.service';

describe('ManualSynagogueImportService', () => {
  let service: ManualSynagogueImportService;
  let destinationsRepo: Repository<Destination>;
  let synagoguesRepo: Repository<Synagogue>;

  const mockDestination: Destination = {
    id: 7,
    name: 'Gan Yavne',
    slug: 'gan-yavne',
    city: 'Gan Yavne',
    country: 'Israel',
    countryCode: 'IL',
    location: { type: 'Point', coordinates: [34.7167, 31.7833] },
    timezone: 'Asia/Jerusalem',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const makeManager = () => ({
    transaction: jest.fn(async (callback: any) =>
      callback({ getRepository: () => synagoguesRepo }),
    ),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualSynagogueImportService,
        {
          provide: getRepositoryToken(Destination),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Synagogue),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            manager: makeManager(),
          },
        },
      ],
    }).compile();

    service = module.get(ManualSynagogueImportService);
    destinationsRepo = module.get(getRepositoryToken(Destination));
    synagoguesRepo = module.get(getRepositoryToken(Synagogue));

    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => [{ lat: '31.7833', lon: '34.7167' }],
      } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a manual synagogue and geocodes missing coordinates', async () => {
    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 101,
    }));

    const result = await service.bulkImport([
      {
        name: 'Gan Yavne Synagogue',
        destinationId: 7,
        address: 'Gan Yavne, Israel',
        website: 'https://example.com',
        denomination: 'Orthodox',
        notes: 'Curated manually',
      },
    ] as any);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.results[0].needsLocationVerification).toBe(false);
    expect(result.results[0].locationResolved).toBe(true);
    expect(synagoguesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'manual',
        manuallyVerified: true,
        needsLocationVerification: false,
        address: 'Gan Yavne, Israel',
      }),
    );
  });

  it('keeps the row when geocoding fails and marks it for verification', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => [],
      } as any;
    });

    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 102,
    }));

    const result = await service.bulkImport([
      {
        name: 'No Location Synagogue',
        destinationId: 7,
        address: 'Unknown Address, Gan Yavne',
      },
    ] as any);

    expect(result.created).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.results[0].needsLocationVerification).toBe(true);
    expect(result.results[0].locationResolved).toBe(false);
    expect(synagoguesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        location: null,
        needsLocationVerification: true,
      }),
    );
  });

  it('updates an existing synagogue matched by destination and normalized name', async () => {
    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([
      {
        id: 22,
        name: 'Old Name',
        normalizedName: 'gan yavne synagogue',
        address: 'Gan Yavne, Israel',
        location: { type: 'Point', coordinates: [34.7, 31.7] },
        manuallyVerified: true,
        needsLocationVerification: true,
      } as any,
    ]);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 22,
    }));

    const result = await service.bulkImport([
      {
        name: 'Gan Yavne Synagogue',
        destinationId: 7,
        address: 'Gan Yavne, Israel',
        phone: '+972-50-000-0000',
      },
    ] as any);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(synagoguesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 22,
        source: 'manual',
        manuallyVerified: true,
        needsLocationVerification: false,
        phone: '+972-50-000-0000',
      }),
    );
  });

  it('updates when exact coordinates match even if names differ', async () => {
    const savedRows: any[] = [];
    let queryCount = 0;

    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    // Do not match by coordinates when names differ — always return null for exact-location lookup
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockImplementation(() => {
      return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any;
    });
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => {
      const saved = { ...entity, id: savedRows.length + 1 };
      savedRows.push(saved);
      return saved;
    });

    const result = await service.bulkImport([
      {
        name: 'Original Prague Synagogue',
        destinationId: 7,
        address: 'Somewhere in Prague',
        latitude: 50.0898,
        longitude: 14.4201,
      },
      {
        name: 'Different Prague Synagogue',
        destinationId: 7,
        address: 'Another Prague address',
        latitude: 50.0898,
        longitude: 14.4201,
      },
    ] as any);

    // With strict matching: different names + same coords -> create two separate rows
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(savedRows).toHaveLength(2);
  });

  it('creates separate rows for the Prague synagogues when only the coordinates are nearby', async () => {
    const pragueDestination: Destination = {
      id: 323,
      name: 'Prague',
      slug: 'prague',
      city: 'Prague',
      country: 'Czech Republic',
      countryCode: 'CZ',
      location: { type: 'Point', coordinates: [14.4208, 50.088] },
      timezone: 'Europe/Prague',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const savedRows: any[] = [];

    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(pragueDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockImplementation(async () => savedRows);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockImplementation(() => {
      return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any;
    });
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => {
      const saved = { ...entity, id: savedRows.length + 200 };
      savedRows.push(saved);
      return saved;
    });

    const result = await service.bulkImport([
      {
        name: 'Maisel Synagogue',
        destinationId: 323,
        address: 'Maiselova 10',
        latitude: 50.08981,
        longitude: 14.41696,
      },
      {
        name: 'Pinkas Synagogue',
        destinationId: 323,
        address: 'Široká 23/3',
        latitude: 50.08986,
        longitude: 14.41712,
      },
      {
        name: 'Klaus Synagogue',
        destinationId: 323,
        address: 'U starého hřbitova 3a',
        latitude: 50.08975,
        longitude: 14.41725,
      },
      {
        name: 'Beit Simcha',
        destinationId: 323,
        address: 'Maiselova 4',
        latitude: 50.08992,
        longitude: 14.41683,
      },
    ] as any);

    expect(result.created).toBe(4);
    expect(result.updated).toBe(0);
    expect(savedRows).toHaveLength(4);
    expect(result.results.filter((row) => row.action === 'created')).toHaveLength(4);
  });

  it('does not merge unrelated Hebrew Prague names when geocoding fails', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => [],
      } as any;
    });

    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 300 + Math.floor(Math.random() * 100),
    }));

    const result = await service.bulkImport([
      {
        name: 'בית הכנסת מייזל מוזיאון',
        destinationId: 7,
        address: "Maiselova 10 עיר עתיקה, פראג, 110 00, הרפובליקה הצ'כית",
      },
      {
        name: 'בית הכנסת פנקס מוזיאון',
        destinationId: 7,
        address: "Široká 23/3 עיר עתיקה, פראג, 110 00, הרפובליקה הצ'כית",
      },
      {
        name: 'בית הכנסת קלאוס מוזיאון',
        destinationId: 7,
        address: "U starého hřbitova 3a עיר עתיקה, פראג, 110 00, הרפובליקה הצ'כית",
      },
    ] as any);

    expect(result.created).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.results.filter((row) => row.action === 'created')).toHaveLength(3);
  });

  it('does not update existing synagogue when incoming record has no coordinates', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => [],
      } as any;
    });

    const existingSynagogue = {
      id: 106,
      name: 'Maisel Synagogue',
      normalizedName: 'maisel synagogue',
      location: { type: 'Point', coordinates: [14.41696, 50.08981] },
      manuallyVerified: true,
      needsLocationVerification: false,
    } as any;

    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(existingSynagogue);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);

    const savedIds: number[] = [];
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => {
      const saved = { ...entity, id: entity.id || 200 + savedIds.length };
      savedIds.push(saved.id);
      return saved;
    });

    const result = await service.bulkImport([
      {
        name: 'Maisel Synagogue',
        destinationId: 7,
        address: 'Maiselova 10, Prague',
      },
    ] as any);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.results[0].action).toBe('created');
    expect(result.results[0].needsLocationVerification).toBe(true);
  });

  it('still updates by exact normalized-name when coordinates are resolved', async () => {
    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    const existingSynagogue = {
      id: 22,
      name: 'Old Name',
      normalizedName: 'gan yavne synagogue',
      address: 'Gan Yavne, Israel',
      location: { type: 'Point', coordinates: [34.7, 31.7] },
      manuallyVerified: false,
      needsLocationVerification: false,
    } as any;

    // Return this candidate via find() so name+address matching succeeds
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([existingSynagogue]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 22,
    }));

    const result = await service.bulkImport([
      {
        name: 'Gan Yavne Synagogue',
        destinationId: 7,
        address: 'Gan Yavne, Israel',
        latitude: 31.7833,
        longitude: 34.7167,
      },
    ] as any);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(result.results[0].action).toBe('updated');
    expect(result.results[0].synagogueId).toBe(22);
  });

  it('skips exact duplicate rows in the same payload', async () => {
    jest.spyOn(destinationsRepo, 'findOne').mockResolvedValue(mockDestination);
    jest.spyOn(synagoguesRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(synagoguesRepo, 'find').mockResolvedValue([]);
    jest.spyOn(synagoguesRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(synagoguesRepo, 'save').mockImplementation(async (entity: any) => ({
      ...entity,
      id: 103,
    }));

    const result = await service.bulkImport([
      {
        name: 'Duplicate Synagogue',
        destinationId: 7,
        address: 'Gan Yavne, Israel',
      },
      {
        name: 'Duplicate Synagogue',
        destinationId: 7,
        address: 'Gan Yavne, Israel',
      },
    ] as any);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
  });
});