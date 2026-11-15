import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * The per-Device runtime of a Screen (ADR-0078) moves off the Screen row onto
 * a record keyed by (Device, Screen): the Active Screen mark, the cached
 * Plugin output, the Render Signal and `generatedAt`. Each existing Screen
 * gets exactly one record, for the Device that owns it, carrying its values.
 */
export class AddDeviceScreen1787430000000 implements MigrationInterface {
  name = 'AddDeviceScreen1787430000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "device_screen" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "isActive" boolean NOT NULL DEFAULT false,
        "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "cachedPluginOutput" text,
        "renderSignal" text,
        "deviceId" uuid NOT NULL,
        "screenId" uuid NOT NULL,
        CONSTRAINT "PK_device_screen_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_screen_device_screen" UNIQUE ("deviceId", "screenId"),
        CONSTRAINT "FK_device_screen_device" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_device_screen_screen" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `)
    await queryRunner.query(`
      INSERT INTO "device_screen" ("isActive", "generatedAt", "cachedPluginOutput", "renderSignal", "deviceId", "screenId")
      SELECT "isActive", "generatedAt", "cachedPluginOutput", "renderSignal", "deviceId", "id" FROM "screen" WHERE "deviceId" IS NOT NULL
    `)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "isActive"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "generatedAt"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "cachedPluginOutput"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "renderSignal"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" ADD "isActive" boolean NOT NULL DEFAULT false`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "generatedAt" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "cachedPluginOutput" text`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "renderSignal" text`)
    await queryRunner.query(`
      UPDATE "screen" SET "isActive" = "ds"."isActive", "generatedAt" = "ds"."generatedAt", "cachedPluginOutput" = "ds"."cachedPluginOutput", "renderSignal" = "ds"."renderSignal"
      FROM "device_screen" "ds" WHERE "ds"."screenId" = "screen"."id" AND "ds"."deviceId" = "screen"."deviceId"
    `)
    await queryRunner.query(`UPDATE "screen" SET "generatedAt" = now() WHERE "generatedAt" IS NULL`)
    await queryRunner.query(`ALTER TABLE "screen" ALTER COLUMN "generatedAt" SET NOT NULL`)
    await queryRunner.query(`DROP TABLE "device_screen"`)
  }
}
