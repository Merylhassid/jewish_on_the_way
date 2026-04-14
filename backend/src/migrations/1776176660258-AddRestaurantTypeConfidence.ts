import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRestaurantTypeConfidence1776176660258 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE restaurants
            ALTER COLUMN restaurant_type DROP NOT NULL,
            ADD COLUMN restaurant_type_confidence DECIMAL(3,2) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE restaurants
            DROP COLUMN restaurant_type_confidence,
            ALTER COLUMN restaurant_type SET NOT NULL
        `);
    }

}
