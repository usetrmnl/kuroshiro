import type { Logger } from '@nestjs/common'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TRMNL_MODELS_SNAPSHOT } from '../../device-models/data/trmnl-snapshot.js'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { convertToPng, readImageSize } from '../imageUtils.js'

const execFileAsync = promisify(execFile)

/** A 90/270 rotation swaps the panel's physical width and height. */
function rotatedDimensions({ width, height, rotation }: { width: number, height: number, rotation: number }) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }
}

// One case per distinct (size, rotation, offset) combination in the offline
// snapshot, so every geometry TRMNL actually ships is exercised, not just
// the amazon_kindle_2024/offset case.
const snapshotGeometries = Array.from(
  new Map(
    TRMNL_MODELS_SNAPSHOT.map(m => [
      `${m.width}x${m.height}@${m.rotation}+${m.offset_x}+${m.offset_y}`,
      makeDeviceModel({ name: m.name, width: m.width, height: m.height, rotation: m.rotation, offsetX: m.offset_x, offsetY: m.offset_y }),
    ]),
  ).values(),
)

function magickAvailable(): boolean {
  try {
    execFileSync('magick', ['--version'])
    return true
  }
  catch {
    return false
  }
}

// amazon_kindle_2024 from the TRMNL snapshot: the one model with a non-zero
// offset, and the case #751 found producing an undersized output.
const KINDLE_MODEL = makeDeviceModel({
  name: 'amazon_kindle_2024',
  width: 1400,
  height: 840,
  rotation: 90,
  offsetX: 75,
  offsetY: 25,
})

const GRAY_256 = makePalette({ id: 'gray-256', grays: 256, colors: null, frameworkClass: 'screen--8bit' })

describe.runIf(magickAvailable())('convertToPng (real magick)', () => {
  let tmpDir: string
  let inputPath: string
  let outputPath: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-imageutils-'))
    inputPath = path.join(tmpDir, 'input.png')
    outputPath = path.join(tmpDir, 'output.png')
    await execFileAsync('magick', ['-size', '1400x840', 'xc:red', inputPath])
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  it('reads the pixel size of the image as it is stored', async () => {
    await expect(readImageSize(inputPath, logger)).resolves.toEqual({ width: 1400, height: 840 })
  })

  it('produces an output at the model\'s rotated dimensions for a model with an offset', async () => {
    await convertToPng(inputPath, outputPath, { model: KINDLE_MODEL, palette: GRAY_256 }, logger)

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h', outputPath])
    expect(stdout).toBe('840x1400')
  })

  it.each(snapshotGeometries)('renders $name at its rotated model dimensions', async (model) => {
    const { width, height } = rotatedDimensions(model)

    await convertToPng(inputPath, outputPath, { model, palette: GRAY_256 }, logger)

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h', outputPath])
    expect(stdout).toBe(`${width}x${height}`)
  })
})

describe.runIf(magickAvailable())('convertToPng dither regions (real magick)', () => {
  let tmpDir: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })
  const GRAY_4 = makePalette({ id: 'gray-4-regions', grays: 4, colors: null, frameworkClass: 'screen--2bit' })
  const REGION = { x: 40, y: 60, width: 200, height: 100 }

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-regions-'))
    await execFileAsync('magick', ['-size', '800x480', 'gradient:#202020-#e0e0e0', '-rotate', '90', '-resize', '800x480!', `png:${path.join(tmpDir, 'in.png')}`])
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  async function convert(name: string, model: ReturnType<typeof makeDeviceModel>, options: Parameters<typeof convertToPng>[4]): Promise<string> {
    const out = path.join(tmpDir, `${name}.png`)
    await convertToPng(path.join(tmpDir, 'in.png'), out, { model, palette: GRAY_4 }, logger, options)
    return out
  }

  async function differing(first: string, second: string, crop: string): Promise<number> {
    const { stderr } = await execFileAsync('magick', ['compare', '-metric', 'AE', `${first}[${crop}]`, `${second}[${crop}]`, 'null:']).catch(error => error as { stderr: string })
    return Number.parseInt(stderr, 10)
  }

  it('dithers only the region, as a dithered conversion would, and leaves the rest undithered', async () => {
    const model = makeDeviceModel({ width: 800, height: 480 })
    const regional = await convert('regional', model, { dither: false, ditherRegions: [REGION] })
    const plain = await convert('plain', model, { dither: false })
    const dithered = await convert('dithered', model, { dither: true })

    expect(await differing(regional, dithered, '200x100+40+60')).toBe(0)
    expect(await differing(regional, plain, '200x100+40+60')).toBeGreaterThan(0)
    expect(await differing(regional, plain, '560x480+240+0')).toBe(0)
    expect(await differing(regional, plain, '800x60+0+0')).toBe(0)
    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h %z-bit', regional])
    expect(stdout).toBe('800x480 2-bit')
  })

  it('follows the region through the model\'s rotation', async () => {
    const model = makeDeviceModel({ width: 800, height: 480, rotation: 90 })
    const regional = await convert('rot-regional', model, { dither: false, ditherRegions: [REGION] })
    const plain = await convert('rot-plain', model, { dither: false })
    const dithered = await convert('rot-dithered', model, { dither: true })

    // 90° clockwise: (x, y) in an 800x480 source lands at (480 - y - h, x) in the 480x800 output.
    const crop = '100x200+320+40'
    expect(await differing(regional, dithered, crop)).toBe(0)
    expect(await differing(regional, plain, '480x40+0+0')).toBe(0)
  })

  it('leaves an undithered conversion untouched when no region is given, and ignores regions on a dithered one', async () => {
    const model = makeDeviceModel({ width: 800, height: 480 })
    const dithered = await convert('d1', model, { dither: true })
    const ignored = await convert('d2', model, { dither: true, ditherRegions: [REGION] })
    expect(await differing(dithered, ignored, '800x480+0+0')).toBe(0)
  })
})
