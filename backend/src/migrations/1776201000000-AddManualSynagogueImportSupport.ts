import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddManualSynagogueImportSupport1776201000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');
    if (!synagogueTable) {
      throw new Error('Synagogues table not found during migration');
    }

    if (!synagogueTable.findColumnByName('address')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'address',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    const locationColumn = synagogueTable.findColumnByName('location');
    if (locationColumn && !locationColumn.isNullable) {
      await queryRunner.changeColumn(
        'synagogues',
        locationColumn,
        new TableColumn({
          name: 'location',
          type: 'geography',
          spatialFeatureType: 'Point',
          srid: 4326,
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('needs_location_verification')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'needs_location_verification',
          type: 'boolean',
          default: false,
          isNullable: false,
        }),
      );
    }

    // Create a destination+normalized-name index using the actual column names
    const destColumnName = synagogueTable.findColumnByName('destinationId')
      ? 'destinationId'
      : synagogueTable.findColumnByName('destination_id')
      ? 'destination_id'
      : null;

    const normalizedColumnName = synagogueTable.findColumnByName(
      'normalized_name',
    )
      ? 'normalized_name'
      : synagogueTable.findColumnByName('normalizedName')
      ? 'normalizedName'
      : null;

    if (destColumnName && normalizedColumnName) {
      if (
        !synagogueTable.indices.some(
          (index) => index.name === 'idx_synagogues_destination_normalized_name',
        )
      ) {
        await queryRunner.createIndex(
          'synagogues',
          new TableIndex({
            name: 'idx_synagogues_destination_normalized_name',
            columnNames: [destColumnName, normalizedColumnName],
          }),
        );
      }
    } else {
      // If either column is missing, skip creating this index to avoid failure.
      // This preserves backward compatibility with databases using different naming conventions.
      // Log a warning in case maintainers want to inspect schema mismatch.
      // (No runtime logger available in migrations; rely on migration output.)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');
    if (!synagogueTable) {
      throw new Error('Synagogues table not found during rollback');
    }

    if (
      synagogueTable.indices.some(
        (index) => index.name === 'idx_synagogues_destination_normalized_name',
      )
    ) {
      await queryRunner.dropIndex(
        'synagogues',
        'idx_synagogues_destination_normalized_name',
      );
    }

    if (synagogueTable.findColumnByName('needs_location_verification')) {
      await queryRunner.dropColumn('synagogues', 'needs_location_verification');
    }

    if (synagogueTable.findColumnByName('address')) {
      await queryRunner.dropColumn('synagogues', 'address');
    }

    const locationColumn = synagogueTable.findColumnByName('location');
    if (locationColumn && locationColumn.isNullable) {
      await queryRunner.changeColumn(
        'synagogues',
        locationColumn,
        new TableColumn({
          name: 'location',
          type: 'geography',
          spatialFeatureType: 'Point',
          srid: 4326,
          isNullable: false,
        }),
      );
    }
  }
}