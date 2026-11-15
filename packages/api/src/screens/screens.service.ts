import type { ApiErrorCode, ScreenOwner } from 'kuroshiro-shared'
import type { Buffer } from 'node:buffer'
import type { DeepPartial } from 'typeorm'
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js'
import type { DeviceRenderTarget } from '../device-models/device-models.service.js'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, Repository } from 'typeorm'
import { DeviceGroup } from '../device-groups/device-group.entity.js'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng, downloadImage, readImageSize } from '../utils/imageUtils.js'
import { assertPublicUrl, requesterFor } from '../utils/ssrfGuard.js'
import { assertUploadAllowed, deleteFileIfExists, refusingUnreadableImage, writeUpload } from '../utils/stagedImageUpload.js'
import { DeviceScreen } from './device-screen.entity.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { UpdateScreenDto } from './dto/update-screen.dto.js'
import { originalImagePath, screenImagePath } from './screen-image-paths.js'
import { closeGapInOrder, joinEndOfOrder, writeOrder } from './screen-order.js'
import { ownedBy, ownerOfRequest, ownerOfScreen } from './screen-owner.js'
import { Screen } from './screens.entity.js'

type FileFacts = Pick<Screen, 'fileOriginalName' | 'fileWidth' | 'fileHeight' | 'fileBytes' | 'fileUploadedAt'>

const EDITABLE_FIELDS: Record<Screen['type'], ReadonlyArray<keyof UpdateScreenDto>> = {
  external: ['name', 'url', 'fetchManual', 'dither'],
  file: ['name', 'dither'],
  html: ['name', 'html', 'dither'],
  mashup: ['name'],
  plugin: [],
}

type Refuse = <T>(operation: () => Promise<T>) => Promise<T>

/** An External link's own columns as edited, and whether its kept image was fetched again for them. */
interface ExternalLinkChange {
  columns: QueryDeepPartialEntity<Screen>
  fetched: boolean
}

/** The Screens drawn from markup at poll time, which a new render target leaves with no stored image to convert. */
const RENDERED_SCREEN_TYPES: ReadonlyArray<Screen['type']> = ['html', 'plugin', 'mashup']

@Injectable()
export class ScreensService {
  private readonly logger = new Logger(ScreensService.name)
  constructor(
    @InjectRepository(Screen)
    private screensRepository: Repository<Screen>,
    @InjectRepository(DeviceScreen)
    private deviceScreensRepository: Repository<DeviceScreen>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    private readonly configService: ConfigService,
    private readonly deviceModels: DeviceModelsService,
  ) {}

  /** Adds an External link, File or HTML Screen at the end of the owner's Order and answers its id. */
  async add(input: CreateScreenDto, file?: Express.Multer.File): Promise<string> {
    const owner = ownerOfRequest(input)
    if (!owner)
      throw new ValidationException([{ path: 'owner', message: 'A Screen needs an owner.' }])
    this.logger.log(`Adding ${input.kind} screen to ${owner.kind} ${owner.id}`)
    this.assertFileMatchesKind(input, file)
    const targets = await this.targetsOf(owner)

    const id = randomUUID()
    const dither = input.dither ?? true
    const content = await this.prepareContent(input, owner, targets, id, dither, file)
    try {
      await joinEndOfOrder(this.screensRepository.manager, owner, { id, type: input.kind, filename: input.name, dither, ...content })
    }
    catch (err) {
      await this.deleteImages(owner.id, targets.map(target => target.id), id)
      throw err
    }
    this.logger.log(`Screen created with id: ${id} for ${owner.kind}: ${owner.id}`)
    return id
  }

  /** The Devices a loaded Screen is drawn for: its owner Device, or its Device Group's members. */
  private async targetsOfScreen(screen: Screen): Promise<Device[]> {
    if (screen.device)
      return [screen.device]
    return this.devicesRepository.find({ where: { deviceGroup: { id: screen.deviceGroup!.id } } })
  }

  /** The Devices an owner's Screens are drawn for: the Device itself, or the members of the Device Group. Refuses an owner that does not exist. */
  private async targetsOf(owner: ScreenOwner): Promise<Device[]> {
    if (owner.kind === 'device') {
      const device = isUUID(owner.id) ? await this.devicesRepository.findOneBy({ id: owner.id }) : null
      if (!device)
        throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: owner.id })
      return [device]
    }
    if (!isUUID(owner.id) || !await this.devicesRepository.manager.getRepository(DeviceGroup).existsBy({ id: owner.id }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-group-not-found', 'Device Group not found', { id: owner.id })
    return this.devicesRepository.find({ where: { deviceGroup: { id: owner.id } } })
  }

  private assertFileMatchesKind(input: CreateScreenDto, file?: Express.Multer.File): void {
    if (input.kind !== 'file') {
      if (file)
        throw new ValidationException([{ path: 'file', message: 'Only a File Screen takes a file.' }])
      return
    }
    assertUploadAllowed(this.configService, file, 'A File Screen needs a file.')
  }

  /** The kind's own columns, with its image stored under the given Screen id when the kind keeps one. */
  private async prepareContent(input: CreateScreenDto, owner: ScreenOwner, targets: Device[], screenId: string, dither: boolean, file?: Express.Multer.File): Promise<DeepPartial<Screen>> {
    switch (input.kind) {
      case 'html':
        return { html: input.html }
      case 'external':
        if (input.fetchManual)
          await this.storeImages(owner, targets, screenId, dither, original => this.fetchOriginal(input.url!, original), this.refuseFetchedImage)
        return { externalLink: input.url, fetchManual: input.fetchManual }
      case 'file':
        return this.storeImages(owner, targets, screenId, dither, original => this.writeUploadedOriginal(file!, original), this.refuseUnreadable)
    }
  }

  /** Changes the fields of a Screen that belong to its kind; the Order and the Active Screen stay as they are. */
  async update(id: string, input: UpdateScreenDto): Promise<string> {
    this.logger.log(`Updating screen ${id}`)
    const screen = await this.findScreenWithOwner(id)
    this.assertFieldsBelongToKind(screen, input)

    const external = screen.type === 'external' ? await this.changeExternalLink(screen, input) : null
    const changes = this.screenChanges(input, external)
    const rendered = this.recordChanges(screen, input, external)
    if (Object.keys(changes).length > 0)
      await this.screensRepository.update({ id }, changes)
    if (Object.keys(rendered).length > 0)
      await this.updateRecords(screen, rendered)
    await this.reconvertForDither(screen, input, { fetchManual: changes.fetchManual as boolean | undefined, regenerated: rendered.generatedAt !== undefined })
    return id
  }

  private screenChanges(input: UpdateScreenDto, external: ExternalLinkChange | null): QueryDeepPartialEntity<Screen> {
    return {
      ...(input.name !== undefined && { filename: input.name }),
      ...(input.html !== undefined && { html: input.html }),
      ...(input.dither !== undefined && { dither: input.dither }),
      ...external?.columns,
    }
  }

  /** What the edit does to the records of the Screen: an edited HTML drops the remembered Render Signal, and a new render or fetch moves the render time. */
  private recordChanges(screen: Screen, input: UpdateScreenDto, external: ExternalLinkChange | null): QueryDeepPartialEntity<DeviceScreen> {
    return {
      ...(input.html !== undefined && { renderSignal: null }),
      ...((external?.fetched || this.changesHtmlRender(screen, input)) && { generatedAt: new Date() }),
    }
  }

  /** Whether the edit changes what an HTML Screen renders to; `/display` names the image after `generatedAt`, and the Device redraws only on a new name. */
  private changesHtmlRender(screen: Screen, input: UpdateScreenDto): boolean {
    return screen.type === 'html'
      && ((input.html !== undefined && input.html !== screen.html) || (input.dither !== undefined && input.dither !== screen.dither))
  }

  /** A flip of Dithering converts a File Screen's stored image, or an External link's kept one, again from its retained original, unless the change fetched a new one. */
  private async reconvertForDither(screen: Screen, input: UpdateScreenDto, changes: { fetchManual?: boolean, regenerated: boolean }): Promise<void> {
    const kept = screen.type === 'file' || (screen.type === 'external' && (changes.fetchManual ?? screen.fetchManual))
    if (input.dither === undefined || input.dither === screen.dither || changes.regenerated || !kept)
      return
    const owner = ownerOfScreen(screen)
    for (const target of await this.targetsOfScreen(screen))
      await this.reconvertScreen(target, await this.deviceModels.renderTargetFor(target), { ...screen, dither: input.dither }, owner.id)
  }

  /** The columns of an External link's own fields, its kept image fetched first when the URL or the choice to keep it changed. */
  private async changeExternalLink(screen: Screen, input: UpdateScreenDto): Promise<ExternalLinkChange> {
    const url = input.url ?? screen.externalLink!
    const fetchManual = input.fetchManual ?? screen.fetchManual
    const needsFetch = fetchManual && (url !== screen.externalLink || !screen.fetchManual)
    if (needsFetch) {
      const owner = ownerOfScreen(screen)
      await this.storeImages(owner, await this.targetsOfScreen(screen), screen.id, input.dither ?? screen.dither, original => this.fetchOriginal(url, original), this.refuseFetchedImage)
    }
    return { columns: { externalLink: url, fetchManual }, fetched: needsFetch }
  }

  private assertFieldsBelongToKind(screen: Screen, input: UpdateScreenDto): void {
    const allowed = EDITABLE_FIELDS[screen.type]
    const misplaced = (Object.keys(input) as Array<keyof UpdateScreenDto>).filter(field => input[field] !== undefined && !allowed.includes(field))
    if (misplaced.length > 0)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'screen-field-not-for-kind', `A ${screen.type} Screen has no ${misplaced.join(', ')}.`, { fields: misplaced })
  }

  /** The image `file` would become for the Screen's first Device (a Group's first member), as PNG bytes; nothing of the Screen changes. */
  async previewImage(id: string, file?: Express.Multer.File): Promise<Buffer> {
    const screen = await this.findFileScreen(id, file)
    const [device] = await this.targetsOfScreen(screen)
    const token = randomUUID()
    const target = await this.deviceModels.renderTargetFor(device ?? {})
    const originalPath = originalImagePath(ownerOfScreen(screen).id, `${token}.preview`)
    const imagePath = screenImagePath(device?.id ?? ownerOfScreen(screen).id, `${token}.preview`)
    try {
      await this.writeUploadedOriginal(file!, originalPath)
      await this.refuseUnreadable(() => convertToPng(originalPath, imagePath, target, this.logger, { dither: screen.dither }))
      return await fs.promises.readFile(imagePath)
    }
    finally {
      await deleteFileIfExists(originalPath, this.logger)
      await deleteFileIfExists(imagePath, this.logger)
    }
  }

  /** Swaps a File Screen's image for `file`, keeping its name, Order and Schedule, once the new image converted. */
  async replaceImage(id: string, file?: Express.Multer.File): Promise<string> {
    this.logger.log(`Replacing the image of screen ${id}`)
    const screen = await this.findFileScreen(id, file)
    const owner = ownerOfScreen(screen)
    const facts = await this.storeImages(owner, await this.targetsOfScreen(screen), id, screen.dither, original => this.writeUploadedOriginal(file!, original), this.refuseUnreadable)
    await this.screensRepository.update({ id }, facts)
    await this.updateRecords(screen, { generatedAt: new Date() })
    return id
  }

  private async findFileScreen(id: string, file?: Express.Multer.File): Promise<Screen> {
    const screen = await this.findScreenWithOwner(id)
    if (screen.type !== 'file')
      throw new ApiException(HttpStatus.BAD_REQUEST, 'screen-field-not-for-kind', 'Only a File Screen has an image to replace.')
    assertUploadAllowed(this.configService, file, 'A File Screen needs a file.')
    return screen
  }

  /**
   * Stores a Screen's original under its owner and its converted image for each
   * Device that shows it, where an image is first written beside the final one
   * so a failed fetch or conversion leaves the stored images alone. `writeOriginal`
   * fills the staged original and answers what the caller keeps; `refuse` words a
   * failure of either step.
   */
  private async storeImages<T>(owner: ScreenOwner, targets: Device[], screenId: string, dither: boolean, writeOriginal: (originalPath: string) => Promise<T>, refuse: Refuse): Promise<T> {
    const token = randomUUID()
    const originalPath = originalImagePath(owner.id, screenId)
    const stagedOriginal = path.join(path.dirname(originalPath), `${token}.staging.original`)
    const staged = targets.map(target => ({ target, final: screenImagePath(target.id, screenId), staged: path.join(path.dirname(screenImagePath(target.id, screenId)), `${token}.staging.png`) }))
    try {
      await fs.promises.mkdir(path.dirname(originalPath), { recursive: true })
      const result = await writeOriginal(stagedOriginal)
      for (const { target, staged: stagedImage } of staged) {
        await fs.promises.mkdir(path.dirname(stagedImage), { recursive: true })
        await refuse(async () => convertToPng(stagedOriginal, stagedImage, await this.deviceModels.renderTargetFor(target), this.logger, { dither }))
      }
      await fs.promises.rename(stagedOriginal, originalPath)
      for (const { final, staged: stagedImage } of staged)
        await fs.promises.rename(stagedImage, final)
      return result
    }
    catch (err) {
      await deleteFileIfExists(stagedOriginal, this.logger)
      for (const { staged: stagedImage } of staged)
        await deleteFileIfExists(stagedImage, this.logger)
      throw err
    }
  }

  private readonly refuseUnreadable: Refuse = operation => refusingUnreadableImage(this.logger, operation)

  private readonly refuseFetchedImage: Refuse = async (operation) => {
    try {
      return await operation()
    }
    catch (err) {
      if (err instanceof ApiException)
        throw err
      const reason = 'The address did not answer with an image Kuroshiro can read.'
      throw this.refuseImage(err, HttpStatus.UNPROCESSABLE_ENTITY, 'image-fetch-failed', reason, { reason })
    }
  }

  private async fetchOriginal(url: string, originalPath: string): Promise<void> {
    const demoMode = this.configService.get<boolean>('demo_mode')
    if (demoMode)
      assertPublicUrl(url)
    try {
      await downloadImage(url, originalPath, this.logger, requesterFor(demoMode))
    }
    catch (err) {
      const reason = getErrorMessage(err)
      throw this.refuseImage(err, HttpStatus.UNPROCESSABLE_ENTITY, 'image-fetch-failed', `The image could not be fetched: ${reason}`, { reason })
    }
  }

  private async writeUploadedOriginal(file: Express.Multer.File, originalPath: string): Promise<FileFacts> {
    await writeUpload(originalPath, file)
    return this.refuseUnreadable(async () => {
      const { width, height } = await readImageSize(originalPath, this.logger)
      return { fileOriginalName: file.originalname, fileWidth: width, fileHeight: height, fileBytes: file.size, fileUploadedAt: new Date() }
    })
  }

  /** Builds the refusal of an image; the cause goes to the log, not to the client. */
  private refuseImage(cause: unknown, status: HttpStatus, code: ApiErrorCode, message: string, details?: Record<string, unknown>): ApiException {
    this.logger.error(`Refusing an image (${code}): ${getErrorMessage(cause)}`)
    return new ApiException(status, code, message, details)
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.findScreenWithOwner(id)
    const owner = ownerOfScreen(screen)
    await this.deleteImages(owner.id, await this.devicesShowing(screen), id)
    await this.screensRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Screen).delete(id)
      if (screen.devicePluginId)
        await manager.getRepository(DevicePlugin).delete(screen.devicePluginId)
      await closeGapInOrder(manager, owner)
    })
    this.logger.log(`Screen deleted: ${id}`)
  }

  /** The Devices that have, or would have, a converted image of the Screen: its owner Device, or its Group's members and any former one with a record. */
  private async devicesShowing(screen: Screen): Promise<string[]> {
    const records = await this.deviceScreensRepository.find({ where: { screen: { id: screen.id } }, relations: { device: true } })
    const ids = new Set(records.map(record => record.device.id))
    if (screen.deviceGroup)
      (await this.devicesRepository.find({ where: { deviceGroup: { id: screen.deviceGroup.id } } })).forEach(member => ids.add(member.id))
    else if (screen.device)
      ids.add(screen.device.id)
    return [...ids]
  }

  /** Removes the images of every Screen a Device Group owns, ahead of the Group's delete, which cascades to the Screens. */
  async deleteFilesOfGroup(groupId: string): Promise<void> {
    const screens = await this.screensRepository.find({ where: { deviceGroup: { id: groupId } }, relations: { deviceGroup: true } })
    for (const screen of screens)
      await this.deleteImages(groupId, await this.devicesShowing(screen), screen.id)
  }

  /** Puts an owner's Screens in the given Order, which has to name each of them once. */
  async reorder(owner: ScreenOwner, screenIds: string[]): Promise<void> {
    this.logger.log(`Reordering screens for ${owner.kind} ${owner.id}`)
    await this.targetsOf(owner)

    const screens = await this.screensRepository.find({ where: ownedBy(owner) })
    const screensById = new Map(screens.map(screen => [screen.id, screen]))
    const ordered = screenIds.flatMap(screenId => screensById.get(screenId) ?? [])
    if (new Set(screenIds).size !== screenIds.length || screens.length !== screenIds.length || ordered.length !== screens.length)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'order-not-a-permutation', `screenIds must name each of the ${owner.kind === 'device' ? 'Device' : 'Device Group'}'s Screens exactly once.`)

    await this.screensRepository.manager.transaction(manager => writeOrder(manager, ordered))
    this.logger.log(`Reordered screens for ${owner.kind} ${owner.id}`)
  }

  /** Fetches a kept External link's image again; the earlier image stays when the fetch fails. */
  async refresh(id: string): Promise<string> {
    this.logger.log(`Refetching screen: ${id}`)
    const screen = await this.findScreenWithOwner(id)
    if (screen.type !== 'external' || !screen.fetchManual)
      throw new BadRequestException('Only an External link that keeps its image can be refreshed.')
    const owner = ownerOfScreen(screen)
    await this.storeImages(owner, await this.targetsOfScreen(screen), id, screen.dither, original => this.fetchOriginal(screen.externalLink!, original), this.refuseFetchedImage)
    await this.updateRecords(screen, { generatedAt: new Date() })
    return id
  }

  /**
   * Has every Screen a device can show drawn again for its current model and
   * palette: regenerates each stored image (uploads and cached external images)
   * from the retained original where one exists and from the previous PNG
   * otherwise, and moves the render time of HTML, Plugin and Mashup Screens,
   * dropping their cached output, so `/display` serves them under a new filename
   * (ADR-0031). The Device's own Screens and its Device Group's are both drawn
   * again, for this Device only; no other member's image is touched.
   * Answers how many stored images were converted.
   */
  async redrawForRenderTarget(device: Device): Promise<number> {
    const owners = this.ownersOf(device)
    await this.discardRenders(device, owners)
    return this.reconvertImageScreens(device, owners)
  }

  /** Converts the Device Group's file and kept External Screens for a Device that has just joined it, from their retained originals. */
  async convertGroupScreensFor(device: Device): Promise<void> {
    if (device.deviceGroup)
      await this.reconvertImageScreens(device, [{ kind: 'deviceGroup', id: device.deviceGroup.id }])
  }

  private ownersOf(device: Device): ScreenOwner[] {
    const own: ScreenOwner = { kind: 'device', id: device.id }
    return device.deviceGroup ? [own, { kind: 'deviceGroup', id: device.deviceGroup.id }] : [own]
  }

  /** Drops what the HTML, Plugin and Mashup Screens a device can show were rendered to, so the next poll renders them afresh under a new filename. */
  private async discardRenders(device: Device, owners: ScreenOwner[]): Promise<void> {
    const screens = await this.screensRepository.find({ where: owners.map(ownedBy).map(where => ({ ...where, type: In(RENDERED_SCREEN_TYPES) })), select: { id: true } })
    if (screens.length === 0)
      return
    await this.deviceScreensRepository.update(
      { device: { id: device.id }, screen: { id: In(screens.map(screen => screen.id)) } },
      { generatedAt: new Date(), cachedPluginOutput: null, renderSignal: null },
    )
  }

  private async reconvertImageScreens(device: Device, owners: ScreenOwner[]): Promise<number> {
    const target = await this.deviceModels.renderTargetFor(device)
    let converted = 0
    for (const owner of owners) {
      const screens = await this.screensRepository.find({ where: ownedBy(owner) })
      for (const screen of screens.filter(s => s.type === 'file' || (s.type === 'external' && s.fetchManual))) {
        if (await this.reconvertScreen(device, target, screen, owner.id))
          converted++
      }
    }
    this.logger.log(`Reconverted ${converted} image screen(s) for device ${device.id} as ${target.model.name}/${target.palette.id}`)
    return converted
  }

  /** Converts one Screen's image again for the target, with the Screen's own Dithering; `false` when there was nothing to convert or it failed. */
  private async reconvertScreen(device: Device, target: DeviceRenderTarget, screen: Screen, ownerId: string): Promise<boolean> {
    const outputPath = screenImagePath(device.id, screen.id)
    const originalPath = originalImagePath(ownerId, screen.id)
    const sourcePath = await fileExists(originalPath) ? originalPath : outputPath
    if (!await fileExists(sourcePath)) {
      this.logger.warn(`No image to reconvert for screen ${screen.id}`)
      return false
    }
    const tempPath = path.join(path.dirname(outputPath), `tmp-${screen.id}.png`)
    try {
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
      await convertToPng(sourcePath, tempPath, target, this.logger, { dither: screen.dither })
      await fs.promises.rename(tempPath, outputPath)
      await this.deviceScreensRepository.update({ device: { id: device.id }, screen: { id: screen.id } }, { generatedAt: new Date() })
      return true
    }
    catch (err) {
      this.logger.error(`Failed to reconvert screen ${screen.id}: ${getErrorMessage(err)}`)
      await fs.promises.unlink(tempPath).catch(() => {})
      return false
    }
  }

  /** Writes every Device's record of the Screen. */
  private async updateRecords(screen: Screen, values: QueryDeepPartialEntity<DeviceScreen>): Promise<void> {
    await this.deviceScreensRepository.update({ screen: { id: screen.id } }, values)
  }

  private async findScreenWithOwner(id: string): Promise<Screen> {
    const screen = isUUID(id) ? await this.screensRepository.findOne({ where: { id }, relations: { device: true, deviceGroup: true } }) : null
    if (!screen)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id })
    return screen
  }

  private async deleteImages(ownerId: string, deviceIds: string[], screenId: string): Promise<void> {
    for (const deviceId of deviceIds)
      await deleteFileIfExists(screenImagePath(deviceId, screenId), this.logger)
    await deleteFileIfExists(originalImagePath(ownerId, screenId), this.logger)
  }
}
