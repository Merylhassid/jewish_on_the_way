import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityPostCommentsLikes1783500000000 implements MigrationInterface {
  name = 'AddCommunityPostCommentsLikes1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "category" character varying(40)
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "image_url" text
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "parent_message_id" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_chat_messages_parent_message'
        ) THEN
          ALTER TABLE "chat_messages"
          ADD CONSTRAINT "FK_chat_messages_parent_message"
          FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_messages_parent_message_id"
      ON "chat_messages" ("parent_message_id")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_likes" (
        "id" SERIAL NOT NULL,
        "message_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_message_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_message_likes_message" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_message_likes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_chat_message_likes_message_user" UNIQUE ("message_id", "user_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_message_likes_message_id"
      ON "chat_message_likes" ("message_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_likes_message_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_likes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_messages_parent_message_id"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "FK_chat_messages_parent_message"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "parent_message_id"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "image_url"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "category"`);
  }
}
