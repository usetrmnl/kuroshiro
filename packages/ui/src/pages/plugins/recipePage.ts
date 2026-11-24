import type { RecipeDetail, RecipeSummary } from 'kuroshiro-shared'
import { wordRefusal } from '@/api/refusalWording'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The Gallery card's own entry, handed to the Recipe's page in the navigation's state. What only the list carries
 * (screenshot, install count, author) is shown from it; reached any other way, the page has none of it.
 */
export function handedRecipe(state: unknown, recipeId: string): RecipeSummary | undefined {
  const handed = isRecord(state) ? state.recipe : undefined
  return isRecord(handed) && handed.id === recipeId && typeof handed.name === 'string' ? handed as unknown as RecipeSummary : undefined
}

/** Why the import would refuse the Recipe, in the import's own wording; none when it would go through. */
export function refusalLine(recipe: RecipeDetail): string | undefined {
  return recipe.refusal ? wordRefusal({ statusCode: 422, ...recipe.refusal }) : undefined
}

export const fieldNeed = (required: boolean) => required ? 'Required' : 'Optional'
