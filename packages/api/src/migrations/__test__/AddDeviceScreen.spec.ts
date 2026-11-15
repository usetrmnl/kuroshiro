import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceScreen1787430000000 } from '../1787430000000-AddDeviceScreen.js'

const DEVICE_A = '00000000-0000-4000-8000-0000000000a1'
const DEVICE_B = '00000000-0000-4000-8000-0000000000b1'
const SCREEN_A1 = '00000000-0000-4000-8000-000000000a01'
const SCREEN_A2 = '00000000-0000-4000-8000-000000000a02'
const SCREEN_B1 = '00000000-0000-4000-8000-000000000b01'
const SCREEN_B2 = '00000000-0000-4000-8000-000000000b02'
const EARLIER = '2026-09-30T08:15:00.000Z'
const LATER = '2026-10-01T09:30:00.000Z'

describe('the Device Screen migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceScreen1787430000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`
      CREATE TABLE "screen" (
        "id" uuid PRIMARY KEY, "type" text NOT NULL, "order" integer NOT NULL, "deviceId" uuid REFERENCES "device"("id") ON DELETE CASCADE,
        "isActive" boolean NOT NULL DEFAULT false, "generatedAt" timestamptz NOT NULL, "cachedPluginOutput" text, "renderSignal" text
      )
    `)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function seedTwoDevicesWithTwoScreensEach(): Promise<void> {
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('${DEVICE_A}'), ('${DEVICE_B}')`)
    await queryRunner.query(`
      INSERT INTO "screen" ("id", "type", "order", "deviceId", "isActive", "generatedAt", "cachedPluginOutput", "renderSignal") VALUES
        ('${SCREEN_A1}', 'plugin', 1, '${DEVICE_A}', true, '${EARLIER}', '<div>a1</div>', 'skip'),
        ('${SCREEN_A2}', 'html', 2, '${DEVICE_A}', false, '${LATER}', NULL, NULL),
        ('${SCREEN_B1}', 'html', 1, '${DEVICE_B}', false, '${EARLIER}', NULL, NULL),
        ('${SCREEN_B2}', 'plugin', 2, '${DEVICE_B}', true, '${LATER}', '<div>b2</div>', NULL)
    `)
  }

  async function recordOf(deviceId: string, screenId: string) {
    const [row] = await queryRunner.query(`SELECT * FROM "device_screen" WHERE "deviceId" = '${deviceId}' AND "screenId" = '${screenId}'`)
    return row
  }

  it('gives each Screen one record carrying the values its columns held', async () => {
    await seedTwoDevicesWithTwoScreensEach()

    await migration.up(queryRunner)

    const [count] = await queryRunner.query(`SELECT count(*)::int AS n FROM "device_screen"`)
    expect(count.n).toBe(4)
    expect(await recordOf(DEVICE_A, SCREEN_A1)).toMatchObject({ isActive: true, cachedPluginOutput: '<div>a1</div>', renderSignal: 'skip' })
    expect((await recordOf(DEVICE_A, SCREEN_A1)).generatedAt.toISOString()).toBe(EARLIER)
    expect(await recordOf(DEVICE_A, SCREEN_A2)).toMatchObject({ isActive: false, cachedPluginOutput: null, renderSignal: null })
    expect((await recordOf(DEVICE_A, SCREEN_A2)).generatedAt.toISOString()).toBe(LATER)
    expect(await recordOf(DEVICE_B, SCREEN_B1)).toMatchObject({ isActive: false })
    expect(await recordOf(DEVICE_B, SCREEN_B2)).toMatchObject({ isActive: true, cachedPluginOutput: '<div>b2</div>' })
  })

  it('leaves the Screen table without the four columns', async () => {
    await seedTwoDevicesWithTwoScreensEach()

    await migration.up(queryRunner)

    const columns = await queryRunner.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'screen'`)
    const names = columns.map((column: { column_name: string }) => column.column_name)
    expect(names).not.toContain('isActive')
    expect(names).not.toContain('cachedPluginOutput')
    expect(names).not.toContain('renderSignal')
    expect(names).not.toContain('generatedAt')
    expect(names).toContain('order')
  })

  it('runs on an empty database', async () => {
    await migration.up(queryRunner)

    const [count] = await queryRunner.query(`SELECT count(*)::int AS n FROM "device_screen"`)
    expect(count.n).toBe(0)
  })

  it('drops a Screen\'s record with the Screen', async () => {
    await seedTwoDevicesWithTwoScreensEach()
    await migration.up(queryRunner)

    await queryRunner.query(`DELETE FROM "screen" WHERE "id" = '${SCREEN_A1}'`)

    expect(await recordOf(DEVICE_A, SCREEN_A1)).toBeUndefined()
  })

  it('puts the values back on the Screen going down', async () => {
    await seedTwoDevicesWithTwoScreensEach()
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    const [screen] = await queryRunner.query(`SELECT * FROM "screen" WHERE "id" = '${SCREEN_A1}'`)
    expect(screen).toMatchObject({ isActive: true, cachedPluginOutput: '<div>a1</div>', renderSignal: 'skip' })
    await expect(queryRunner.query(`SELECT * FROM "device_screen"`)).rejects.toThrow()
  })
})
