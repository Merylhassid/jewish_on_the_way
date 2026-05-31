import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Synagogue } from '../synagogue.entity';

@Injectable()
export class SynagoguesService {
  constructor(
    @InjectRepository(Synagogue)
    private synagoguesRepo: Repository<Synagogue>,
  ) {}

  /**
   * Find all synagogues by destination ID
   * Returns basic fields: id, name, address, description, phone, website, location
   */
  // מיפוי denomination (מהמודל) → ערכי DB אפשריים
  private readonly DENOM_MAP: Record<string, string[]> = {
    ashkenaz:  ['אשכנז', 'אשכנזי', 'ליטאי', 'Ashkenazi', 'Orthodox'],
    sfarad:    ['ספרדי', 'ספרד', 'עדות המזרח', 'מרוקאי', 'הודי', 'בוכרה', 'אתיופי'],
    chabad:    ['חב"ד', 'חסידי', 'Chabad'],
    teimanim:  ['תימני', 'תימן', 'שאמי', 'בלאדי', 'ירושלמי'],
  };

  async findByDestination(destinationId: number, denomination?: string) {
    // ── ללא פילטר נוסח — כולם ──────────────────────────
    if (!denomination) {
      return this.synagoguesRepo.find({
        where: { destination: { id: destinationId } },
        select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
        order: { name: 'ASC' },
      });
    }

    // ── עם פילטר נוסח — OR על כל הערכים האפשריים ───────
    const dbValues = this.DENOM_MAP[denomination] ?? [];
    if (dbValues.length === 0) {
      return this.synagoguesRepo.find({
        where: { destination: { id: destinationId } },
        select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
        order: { name: 'ASC' },
      });
    }

    const { In } = await import('typeorm');
    return this.synagoguesRepo.find({
      where: {
        destination: { id: destinationId },
        denomination: In(dbValues),
      },
      select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Find a single synagogue by ID
   * Returns full details including denomination, opening hours, etc.
   */
  async findOne(id: number) {
    const synagogue = await this.synagoguesRepo.findOne({
      where: { id },
      relations: ['destination'],
    });

    return synagogue;
  }
}
