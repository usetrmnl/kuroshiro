import type { Logger } from '@nestjs/common'
import type { RenderSignal } from 'kuroshiro-shared'
import type { Page } from 'puppeteer'
import type { ConversionOptions, PixelRegion } from '../utils/imageUtils.js'
import type { DeviceRenderTarget } from './device-models.service.js'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { convertToPng } from '../utils/imageUtils.js'
import { withSharedPage } from './shared-browser.js'

export interface RenderHtmlToPngOptions {
  /**
   * Whether a `skip` or `hold` Render Signal should leave `outputPath`
   * untouched. Only the `/display` poll's Rotation evaluates the signal
   * (ADR-0031); every other caller renders unconditionally, as it always has.
   */
  honorRenderSignal?: boolean
}

/**
 * TRMNL's own pair of JS flags, read at the page's `load` event, the moment
 * the screenshot is taken: `window.TRMNL_SKIP_DISPLAY` raises `skip`,
 * `window.TRMNL_SKIP_SCREEN_GENERATION` raises `hold`. `skip` wins when a
 * page sets both (ADR-0031).
 */
async function readRenderSignal(page: Page): Promise<RenderSignal | null> {
  const { skip, hold } = await page.evaluate(() => {
    const flags = window as unknown as { TRMNL_SKIP_DISPLAY?: unknown, TRMNL_SKIP_SCREEN_GENERATION?: unknown }
    return { skip: Boolean(flags.TRMNL_SKIP_DISPLAY), hold: Boolean(flags.TRMNL_SKIP_SCREEN_GENERATION) }
  })
  return skip ? 'skip' : hold ? 'hold' : null
}

/**
 * The viewport boxes of every element carrying TRMNL's `image-dither` class,
 * rounded outward to whole pixels and clipped to the viewport; elements with
 * nothing visible are left out.
 */
async function readDitherRegions(page: Page): Promise<PixelRegion[]> {
  return await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = window.innerHeight
    const regions: PixelRegion[] = []
    for (const element of document.querySelectorAll('.image-dither')) {
      const box = element.getBoundingClientRect()
      const left = Math.max(0, Math.floor(box.left))
      const top = Math.max(0, Math.floor(box.top))
      const right = Math.min(viewportWidth, Math.ceil(box.right))
      const bottom = Math.min(viewportHeight, Math.ceil(box.bottom))
      if (right > left && bottom > top)
        regions.push({ x: left, y: top, width: right - left, height: bottom - top })
    }
    return regions
  })
}

/**
 * Screenshots an already-shelled HTML document at the render target's native
 * pixel size and converts the screenshot to the target's PNG at `outputPath`,
 * reporting the Render Signal observed at the same moment. `honorRenderSignal`
 * leaves `outputPath` as it was on a `skip` or `hold`, instead of overwriting it.
 */
export async function renderHtmlToPng(html: string, target: DeviceRenderTarget, outputPath: string, logger: Logger, conversion: ConversionOptions = {}, options: RenderHtmlToPngOptions = {}): Promise<RenderSignal | null> {
  const tmpPath = `${outputPath}.tmp-source`
  try {
    return await withSharedPage(async (page) => {
      await page.setViewport({ width: target.model.width, height: target.model.height })
      await page.setContent(html, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      const renderSignal = await readRenderSignal(page)
      if (renderSignal && options.honorRenderSignal)
        return renderSignal

      const image: Uint8Array = await page.screenshot()

      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.promises.writeFile(tmpPath, buffer.Buffer.from(image))
      // A Screen that is not dithered as a whole still dithers what the page marks `image-dither`.
      const ditherRegions = conversion.dither === false ? await readDitherRegions(page) : []
      await convertToPng(tmpPath, outputPath, target, logger, ditherRegions.length > 0 ? { ...conversion, ditherRegions } : conversion)
      return renderSignal
    })
  }
  finally {
    try {
      await fs.promises.unlink(tmpPath)
    }
    catch {
      // best-effort cleanup
    }
  }
}

/**
 * The Render Signal an already-shelled HTML document raises on a page of its
 * own, read at its `load` event as `renderHtmlToPng` reads it, without taking
 * a screenshot: how a Mashup slot's own signal is told apart from the rest of
 * its Mashup's page, which shares one `window` (ADR-0067).
 */
export async function readHtmlRenderSignal(html: string, target: DeviceRenderTarget): Promise<RenderSignal | null> {
  return await withSharedPage(async (page) => {
    await page.setViewport({ width: target.model.width, height: target.model.height })
    await page.setContent(html, { waitUntil: 'load' })
    return await readRenderSignal(page)
  })
}
