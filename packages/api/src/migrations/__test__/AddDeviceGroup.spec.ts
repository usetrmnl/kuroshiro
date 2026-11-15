import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceGroup1787440000000 } from '../1787440000000-AddDeviceGroup.js'

const DEVICE = '00000000-0000-4000-8000-0000000000a1'
const SCREEN = '00000000-0000-4000-8000-000000000a01'
const GROUP = '00000000-0000-4000-8000-0000000000b1'

describe('the Device Group migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceGroup1787440000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "order" integer NOT NULL, "deviceId" uuid NOT NULL REFERENCES "device"("id") ON DELETE CASCADE)`)
    await queryRunner.query(`CREATE TABLE "device_plugin" ("id" uuid PRIMARY KEY, "deviceId" uuid REFERENCES "device"("id") ON DELETE CASCADE, "pluginId" uuid REFERENCES "plugin"("id") ON DELETE CASCADE)`)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('${DEVICE}')`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceId") VALUES ('${SCREEN}', 1, '${DEVICE}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('keeps every existing Screen on its Device', async () => {
    await migration.up(queryRunner)

    expect(await queryRunner.query(`SELECT "deviceId", "deviceGroupId" FROM "screen"`)).toEqual([{ deviceId: DEVICE, deviceGroupId: null }])
  })

  it('lets a Screen belong to a Group, and refuses one with both owners or neither', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`INSERT INTO "device_group" ("id", "name") VALUES ('${GROUP}', 'Downstairs')`)

    await queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceGroupId") VALUES ('00000000-0000-4000-8000-000000000a02', 1, '${GROUP}')`)
    await expect(queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceId", "deviceGroupId") VALUES ('00000000-0000-4000-8000-000000000a03', 2, '${DEVICE}', '${GROUP}')`)).rejects.toThrow(/CHK_screen_exactly_one_owner/)
    await expect(queryRunner.query(`INSERT INTO "screen" ("id", "order") VALUES ('00000000-0000-4000-8000-000000000a04', 3)`)).rejects.toThrow(/CHK_screen_exactly_one_owner/)
  })

  it('keeps the Order unique within a Group, and a Group name unique', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`INSERT INTO "device_group" ("id", "name") VALUES ('${GROUP}', 'Downstairs')`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceGroupId") VALUES ('00000000-0000-4000-8000-000000000a02', 1, '${GROUP}')`)

    await expect(queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceGroupId") VALUES ('00000000-0000-4000-8000-000000000a03', 1, '${GROUP}')`)).rejects.toThrow(/UQ_screen_device_group_order/)
    await expect(queryRunner.query(`INSERT INTO "device_group" ("id", "name") VALUES ('00000000-0000-4000-8000-0000000000b2', 'Downstairs')`)).rejects.toThrow(/UQ_device_group_name/)
  })

  it('rolls back to Device-owned Screens only', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`INSERT INTO "device_group" ("id", "name") VALUES ('${GROUP}', 'Downstairs')`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "order", "deviceGroupId") VALUES ('00000000-0000-4000-8000-000000000a02', 1, '${GROUP}')`)

    await migration.down(queryRunner)

    expect(await queryRunner.query(`SELECT "id" FROM "screen"`)).toEqual([{ id: SCREEN }])
  })
})
