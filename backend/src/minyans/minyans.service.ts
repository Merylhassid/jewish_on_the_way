import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import { Minyan } from '../minyan.entity';
import { MinyanRegistration } from '../minyan-registration.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { CreateMinyanDto } from './dto/create-minyan.dto';
import { AuditService } from '../audit/audit.service';

const ALMOST_FULL_THRESHOLD = 8;
const MINYAN_FULL = 10;

@Injectable()
export class MinyansService {
  constructor(
    @InjectRepository(Minyan) private minyansRepo: Repository<Minyan>,
    @InjectRepository(MinyanRegistration)
    private registrationsRepo: Repository<MinyanRegistration>,
    @InjectRepository(Destination) private destinationsRepo: Repository<Destination>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private audit: AuditService,
  ) {}

  // req 6.1 + 6.1.2 — upcoming minyans, no past events
  async findUpcoming(
    destinationId: number,
    filters: { date?: string; prayerType?: string },
  ) {
    const today = new Date().toISOString().split('T')[0];

    const where: FindOptionsWhere<Minyan> = {
      destination: { id: destinationId },
      date: MoreThanOrEqual(today),
    };
    if (filters.prayerType) where.prayerType = filters.prayerType;
    if (filters.date) where.date = filters.date;

    const minyans = await this.minyansRepo.find({
      where,
      order: { date: 'ASC', time: 'ASC' },
      relations: ['creator'],
    });

    return minyans.map((m) => this.format(m));
  }

  // req 6.1 — single minyan + registration status
  async findOne(id: number, userId: number) {
    const minyan = await this.minyansRepo.findOne({
      where: { id },
      relations: ['creator', 'destination'],
    });
    if (!minyan) throw new NotFoundException(`Minyan #${id} not found`);

    const isRegistered = await this.registrationsRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId AND r.minyanId = :minyanId', {
        userId,
        minyanId: id,
      })
      .getOne();

    return { ...this.format(minyan), isRegistered: !!isRegistered };
  }

  // req 6.3 + 6.3.1 — create minyan, auto-register creator
  async create(dto: CreateMinyanDto, creatorId: number) {
    const today = new Date().toISOString().split('T')[0];
    if (dto.date < today) throw new BadRequestException('Date must be today or in the future');

    const destination = await this.destinationsRepo.findOne({
      where: { id: dto.destinationId },
    });
    if (!destination) throw new NotFoundException(`Destination #${dto.destinationId} not found`);

    const creator = await this.usersRepo.findOneOrFail({
      where: { id: creatorId },
    });

    const minyan = this.minyansRepo.create({
      prayerType: dto.prayerType,
      date: dto.date,
      time: dto.time,
      locationText: dto.locationText,
      notes: dto.notes,
      participantsCount: 1,
      destination,
      creator,
    });
    const saved = await this.minyansRepo.save(minyan);

    await this.registrationsRepo.save(
      this.registrationsRepo.create({ user: creator, minyan: saved }),
    );

    this.audit.log('MINYAN_CREATED', creatorId, {
      minyanId: saved.id,
      destinationId: dto.destinationId,
      prayerType: dto.prayerType,
      date: dto.date,
    });

    return this.format(saved);
  }

  // req 6.4 — register user to minyan
  async register(minyanId: number, userId: number) {
    const minyan = await this.minyansRepo.findOne({ where: { id: minyanId } });
    if (!minyan) throw new NotFoundException(`Minyan #${minyanId} not found`);

    const today = new Date().toISOString().split('T')[0];
    if (minyan.date < today) throw new BadRequestException('Cannot register for a past minyan');

    const existing = await this.registrationsRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId AND r.minyanId = :minyanId', {
        userId,
        minyanId,
      })
      .getOne();
    if (existing) throw new ConflictException('Already registered for this minyan');

    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });

    await this.registrationsRepo.save(
      this.registrationsRepo.create({ user, minyan }),
    );

    await this.minyansRepo.increment({ id: minyanId }, 'participantsCount', 1);
    this.audit.log('MINYAN_REGISTERED', userId, { minyanId });

    return {
      registered: true,
      participantsCount: minyan.participantsCount + 1,
    };
  }

  // req 6.4.2 — cancel registration
  async unregister(minyanId: number, userId: number) {
    const minyan = await this.minyansRepo.findOne({
      where: { id: minyanId },
      relations: ['creator'],
    });
    if (!minyan) throw new NotFoundException(`Minyan #${minyanId} not found`);

    if (minyan.creator?.id === userId) {
      throw new ForbiddenException(
        'Creator cannot cancel their own minyan registration',
      );
    }

    const reg = await this.registrationsRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId AND r.minyanId = :minyanId', {
        userId,
        minyanId,
      })
      .getOne();
    if (!reg) throw new BadRequestException('Not registered for this minyan');

    await this.registrationsRepo.remove(reg);
    await this.minyansRepo.decrement({ id: minyanId }, 'participantsCount', 1);
    this.audit.log('MINYAN_UNREGISTERED', userId, { minyanId });

    return {
      registered: false,
      participantsCount: Math.max(0, minyan.participantsCount - 1),
    };
  }

  private format(m: Minyan) {
    const count = m.participantsCount;
    return {
      id: m.id,
      prayerType: m.prayerType,
      date: m.date,
      time: m.time,
      locationText: m.locationText,
      notes: m.notes ?? null,
      participantsCount: count,
      almostFull: count >= ALMOST_FULL_THRESHOLD && count < MINYAN_FULL,
      isFull: count >= MINYAN_FULL,
      createdAt: m.createdAt,
      creator: m.creator
        ? {
            id: m.creator.id,
            firstName: m.creator.firstName,
            lastName: m.creator.lastName,
          }
        : null,
      destination: m.destination
        ? { id: m.destination.id, city: m.destination.city }
        : null,
    };
  }
}
