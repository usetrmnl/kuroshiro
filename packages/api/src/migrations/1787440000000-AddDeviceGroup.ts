import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Device Group (ADR-0078) is a named Screen set Devices join. A Screen is
 * owned by a Device or a Device Group, exactly one of them; every existing
 * Screen keeps its Device.
 */
export class AddDeviceGroup1787440000000 implements MigrationInterface {
  name = 'AddDeviceGroup1787440000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "device_group" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        CONSTRAINT "PK_device_group_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_group_name" UNIQUE ("name")
      )
    `)
    await queryRunner.query(`ALTER TABLE "device" ADD "deviceGroupId" uuid`)
    await queryRunner.query(`ALTER TABLE "device" ADD CONSTRAINT "FK_device_device_group" FOREIGN KEY ("deviceGroupId") REFERENCES "device_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "screen" ALTER COLUMN "deviceId" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "deviceGroupId" uuid`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "FK_screen_device_group" FOREIGN KEY ("deviceGroupId") REFERENCES "device_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "UQ_screen_device_group_order" UNIQUE ("deviceGroupId", "order") DEFERRABLE INITIALLY DEFERRED`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "CHK_screen_exactly_one_owner" CHECK (("deviceId" IS NULL) <> ("deviceGroupId" IS NULL))`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD "deviceGroupId" uuid`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "FK_device_plugin_device_group" FOREIGN KEY ("deviceGroupId") REFERENCES "device_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "UQ_device_plugin_plugin_device_group" UNIQUE ("pluginId", "deviceGroupId")`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "CHK_device_plugin_exactly_one_owner" CHECK (("deviceId" IS NULL) <> ("deviceGroupId" IS NULL))`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A Group's Screens have no Device to go back to.
    await queryRunner.query(`DELETE FROM "screen" WHERE "deviceId" IS NULL`)
    await queryRunner.query(`DELETE FROM "device_plugin" WHERE "deviceId" IS NULL`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "CHK_device_plugin_exactly_one_owner"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "UQ_device_plugin_plugin_device_group"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "FK_device_plugin_device_group"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP COLUMN "deviceGroupId"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "CHK_screen_exactly_one_owner"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "UQ_screen_device_group_order"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "FK_screen_device_group"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "deviceGroupId"`)
    await queryRunner.query(`ALTER TABLE "screen" ALTER COLUMN "deviceId" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "device" DROP CONSTRAINT "FK_device_device_group"`)
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "deviceGroupId"`)
    await queryRunner.query(`DROP TABLE "device_group"`)
  }
}
