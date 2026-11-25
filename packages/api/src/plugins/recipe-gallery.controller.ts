import type { RecipeDetail, RecipeGalleryPage } from 'kuroshiro-shared'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { RecipeGalleryQueryDto } from './dto/recipe-gallery-query.dto.js'
import { toRecipeDetail } from './recipe-gallery.mapper.js'
import { PluginImporterService } from './services/plugin-importer.service.js'
import { RecipeGalleryService } from './services/recipe-gallery.service.js'

/** The Recipe Gallery's reads of TRMNL's published Recipes (ADR-0073). Importing one is `POST /plugins/import-recipe`. */
@Controller('recipes')
export class RecipeGalleryController {
  constructor(
    private readonly gallery: RecipeGalleryService,
    private readonly importer: PluginImporterService,
  ) {}

  @Get()
  async page(@Query() query: RecipeGalleryQueryDto): Promise<RecipeGalleryPage> {
    return this.gallery.page(query)
  }

  @Get('categories')
  async categories(): Promise<string[]> {
    return this.gallery.categories()
  }

  /** One Recipe as its archive describes it, nothing saved (ADR-0073). `:id` is a Recipe's id or the address of its page. */
  @Get(':id')
  async recipe(@Param('id') id: string): Promise<RecipeDetail> {
    return toRecipeDetail(await this.importer.previewRecipe(id))
  }
}
