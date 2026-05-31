import { MigrationInterface, QueryRunner } from 'typeorm';

type SynagogueDescriptionSeed = {
  name: string;
  description: string;
};

export class BackfillSynagogueDescriptions1776202000000
  implements MigrationInterface
{
  private readonly destinationId = 464;

  private readonly rows: SynagogueDescriptionSeed[] = [
    {
      name: 'Anshei Lubavitch',
      description:
        'Orthodox synagogue located in Miami Beach led by Rabbi David Shapiro.',
    },
    {
      name: 'Beth Israel Congregation',
      description:
        'Orthodox synagogue in Miami Beach led by Rabbi Neil Turk.',
    },
    {
      name: 'Chabad in South Beach',
      description:
        'Provides Shabbat prayers, Friday night dinners, Cholent, Kiddush, holiday events, Torah classes and hosting for Jewish travelers and locals.',
    },
    {
      name: 'Chabad of Venetian Causeway',
      description:
        'Offers synagogue services, Shabbat meals and Jewish women empowerment circles.',
    },
    {
      name: 'Chabad of Miami Beach',
      description:
        'Provides regular prayers, candle lighting, Friday night meals and Shabbat meals for the Jewish community and visitors.',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');
    if (!synagogueTable) {
      throw new Error('Synagogues table not found during migration');
    }

    const destinationColumn = synagogueTable.findColumnByName('destinationId')
      ? 'destinationId'
      : synagogueTable.findColumnByName('destination_id')
      ? 'destination_id'
      : null;

    if (!destinationColumn) {
      throw new Error('Could not determine destination column on synagogues');
    }

    for (const row of this.rows) {
      await queryRunner.query(
        `
        UPDATE "synagogues"
        SET "description" = $1
        WHERE "name" = $2
          AND "${destinationColumn}" = $3
      `,
        [row.description, row.name, this.destinationId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');
    if (!synagogueTable) {
      throw new Error('Synagogues table not found during rollback');
    }

    const destinationColumn = synagogueTable.findColumnByName('destinationId')
      ? 'destinationId'
      : synagogueTable.findColumnByName('destination_id')
      ? 'destination_id'
      : null;

    if (!destinationColumn) {
      throw new Error('Could not determine destination column on synagogues');
    }

    for (const row of this.rows) {
      await queryRunner.query(
        `
        UPDATE "synagogues"
        SET "description" = NULL
        WHERE "name" = $1
          AND "${destinationColumn}" = $2
          AND "description" = $3
      `,
        [row.name, this.destinationId, row.description],
      );
    }
  }
}