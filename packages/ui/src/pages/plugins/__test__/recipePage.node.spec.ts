import { describe, expect, it } from 'vitest'
import { buildRecipeDetail, buildRecipeSummary } from '@/testing/fixtures/plugins'
import { fieldNeed, handedRecipe, refusalLine } from '../recipePage'

describe('a Recipe\'s own page', () => {
  it('takes the entry a card handed on only when it is the page\'s own Recipe', () => {
    const summary = buildRecipeSummary()

    expect(handedRecipe({ recipe: summary }, '41120')).toEqual(summary)
    expect(handedRecipe({ recipe: summary }, '999')).toBeUndefined()
    expect(handedRecipe({ recipe: 'nope' }, '41120')).toBeUndefined()
    expect(handedRecipe(null, '41120')).toBeUndefined()
  })

  it('words a refusal as the import does, and none for a Recipe that imports', () => {
    expect(refusalLine(buildRecipeDetail())).toBeUndefined()
    expect(refusalLine(buildRecipeDetail({ refusal: { code: 'recipe-serverless-language', message: 'x', details: { language: 'ruby' } } })))
      .toBe('This Recipe\'s serverless code is ruby; Kuroshiro runs only JavaScript transforms.')
  })

  it('says whether a field is required', () => {
    expect([fieldNeed(true), fieldNeed(false)]).toEqual(['Required', 'Optional'])
  })
})
