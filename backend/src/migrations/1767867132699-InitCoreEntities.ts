import { MigrationInterface, QueryRunner } from "typeorm";

export class InitCoreEntities1767867132699 implements MigrationInterface {
    name = 'InitCoreEntities1767867132699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "minyans" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "nusach" character varying NOT NULL, "prayer_times" text NOT NULL, "location" geography(Point,4326) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "destinationId" integer, CONSTRAINT "PK_669c122c385cb67a4eb8020960e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hosting_offers" ("id" SERIAL NOT NULL, "available_from" date NOT NULL, "available_to" date NOT NULL, "max_guests" integer NOT NULL, "allows_children" boolean NOT NULL DEFAULT false, "allows_shabbat" boolean NOT NULL DEFAULT false, "kashrut_level" character varying, "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, "destination_id" integer, CONSTRAINT "PK_6cee37cb0a4b17abc28b80c9206" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "destinations" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text, "location" geography(Point,4326) NOT NULL, "country" character varying NOT NULL, "city" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_69c5e8db964dcb83d3a0640f3c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "restaurants" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "restaurant_type" character varying NOT NULL, "kashrut_level" character varying NOT NULL, "location" geography(Point,4326) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "destinationId" integer, CONSTRAINT "PK_e2133a72eb1cc8f588f7b503e68" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hosting_requests" ("id" SERIAL NOT NULL, "arrival_date" date NOT NULL, "departure_date" date NOT NULL, "guests_count" integer NOT NULL, "with_children" boolean NOT NULL DEFAULT false, "for_shabbat" boolean NOT NULL DEFAULT false, "special_requests" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, "destination_id" integer, CONSTRAINT "PK_cb1dae4fec5a4a3751d47bc3902" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "minyans" ADD CONSTRAINT "FK_4d85bd6776746366f9ec6d5cdb8" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hosting_offers" ADD CONSTRAINT "FK_de908a84bd233f275b9e6a53c48" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hosting_offers" ADD CONSTRAINT "FK_9f247f394762f7525667ef434a6" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD CONSTRAINT "FK_9683e18e60c6770691f0ec84000" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hosting_requests" ADD CONSTRAINT "FK_c91f56ede11d4733302ff4e86f2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hosting_requests" ADD CONSTRAINT "FK_99f0cd3cada16e3f08577c94ff9" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hosting_requests" DROP CONSTRAINT "FK_99f0cd3cada16e3f08577c94ff9"`);
        await queryRunner.query(`ALTER TABLE "hosting_requests" DROP CONSTRAINT "FK_c91f56ede11d4733302ff4e86f2"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP CONSTRAINT "FK_9683e18e60c6770691f0ec84000"`);
        await queryRunner.query(`ALTER TABLE "hosting_offers" DROP CONSTRAINT "FK_9f247f394762f7525667ef434a6"`);
        await queryRunner.query(`ALTER TABLE "hosting_offers" DROP CONSTRAINT "FK_de908a84bd233f275b9e6a53c48"`);
        await queryRunner.query(`ALTER TABLE "minyans" DROP CONSTRAINT "FK_4d85bd6776746366f9ec6d5cdb8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
        await queryRunner.query(`DROP TABLE "hosting_requests"`);
        await queryRunner.query(`DROP TABLE "restaurants"`);
        await queryRunner.query(`DROP TABLE "destinations"`);
        await queryRunner.query(`DROP TABLE "hosting_offers"`);
        await queryRunner.query(`DROP TABLE "minyans"`);
    }

}
