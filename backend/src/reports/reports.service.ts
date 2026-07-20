import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserReport, UserReportContext, UserReportStatus } from './user-report.entity';
import { User } from '../users/user.entity';
import { HostingRequest } from '../hosting/entities/hosting-request.entity';
import { HostingOffer } from '../hosting/entities/hosting-offer.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(UserReport) private reportsRepo: Repository<UserReport>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(HostingRequest) private requestsRepo: Repository<HostingRequest>,
    @InjectRepository(HostingOffer) private offersRepo: Repository<HostingOffer>,
  ) {}

  // Used by POST /reports — the client only says *what* it's reporting;
  // who is being reported is always resolved server-side from that entity.
  async create(reporterId: number, dto: CreateReportDto) {
    let reportedUserId: number;

    if (dto.context === 'hosting_chat') {
      const request = await this.requestsRepo.findOne({
        where: { id: dto.entityId },
        relations: ['user', 'offer', 'offer.user'],
      });
      if (!request) throw new NotFoundException('Hosting request not found');

      const guestId = request.user?.id;
      const hostId = request.offer?.user?.id ?? request.host_id ?? undefined;
      const isParticipant = reporterId === guestId || reporterId === hostId;
      if (!isParticipant) throw new ForbiddenException('Not a participant of this chat');

      reportedUserId = reporterId === guestId ? hostId! : guestId!;
      if (!reportedUserId) throw new BadRequestException('Could not determine the other participant');
    } else {
      // hosting_offer
      const offer = await this.offersRepo.findOne({ where: { id: dto.entityId }, relations: ['user'] });
      if (!offer) throw new NotFoundException('Hosting offer not found');
      if (offer.user.id === reporterId) throw new BadRequestException('Cannot report your own offer');
      reportedUserId = offer.user.id;
    }

    return this.createDirect(reporterId, reportedUserId, dto.context, dto.entityId, dto.reason);
  }

  // Lower-level entry point used internally (e.g. the community chat:report
  // websocket handler, which already knows the message author).
  async createDirect(
    reporterId: number,
    reportedUserId: number,
    context: UserReportContext,
    entityId: number,
    reason?: string,
  ) {
    const report = this.reportsRepo.create({
      reporterId,
      reportedUserId,
      context,
      entityId,
      reason: reason ?? null,
      status: 'open',
    });
    return this.reportsRepo.save(report);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async listReports(status?: UserReportStatus) {
    return this.reportsRepo.find({
      where: status ? { status } : {},
      relations: ['reporter', 'reportedUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async resolveReport(id: number, status: UserReportStatus) {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = status;
    return this.reportsRepo.save(report);
  }

  async disableUser(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isDisabled = true;
    await this.usersRepo.save(user);
    return { success: true };
  }

  async enableUser(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isDisabled = false;
    await this.usersRepo.save(user);
    return { success: true };
  }
}
