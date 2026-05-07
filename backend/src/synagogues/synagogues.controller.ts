import { Controller, Get, Query, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { SynagoguesService } from './synagogues.service';

@Controller('synagogues')
export class SynagoguesController {
  constructor(private readonly synagoguesService: SynagoguesService) {}

  /**
   * GET /synagogues?destinationId=<id>
   * Returns a list of synagogues for a specific destination
   */
  @Get()
  async findByDestination(
    @Query('destinationId') destinationIdStr: string,
  ) {
    if (!destinationIdStr) {
      throw new BadRequestException('destinationId query parameter is required');
    }

    const destinationId = parseInt(destinationIdStr, 10);
    if (isNaN(destinationId)) {
      throw new BadRequestException('destinationId must be a valid integer');
    }

    return this.synagoguesService.findByDestination(destinationId);
  }

  /**
   * GET /synagogues/:id
   * Returns full details of a single synagogue
   */
  @Get(':id')
  async findOne(@Param('id') idStr: string) {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      throw new BadRequestException('id must be a valid integer');
    }

    const synagogue = await this.synagoguesService.findOne(id);
    if (!synagogue) {
      throw new NotFoundException('Synagogue not found');
    }

    return synagogue;
  }
}
