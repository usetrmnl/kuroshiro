import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { FilterCompletion } from './codeCompletion'
import type { CodeEditorMode } from './codeEditor'
import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { html } from '@codemirror/lang-html'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { closePercentBrace, liquidCompletionSource, liquidLanguage } from '@codemirror/lang-liquid'
import { LanguageSupport, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { definedTemplatesIn, keysUnder, namesOf, tagAskOf } from './codeCompletion'

/** What Liquid completion reads: the preview's data and the filters the dialect adds, each with the dialect that did. */
export interface LiquidCompletion {
  data: Record<string, unknown>
  filters: readonly FilterCompletion[]
  /** The tags the engine renders; without them completion offers the language's own list. */
  tags?: readonly string[]
}

const LIQUID_NODES = ['Interpolation', 'Tag', 'EndTag', 'Comment']
const washMark = Decoration.mark({ class: 'cm-liquid' })

function washBehindLiquid(view: EditorView): DecorationSet {
  const marks = new RangeSetBuilder<Decoration>()
  view.visibleRanges.forEach(({ from, to }) => syntaxTree(view.state).iterate({
    from,
    to,
    enter: (node) => {
      if (!LIQUID_NODES.includes(node.name))
        return
      marks.add(node.from, node.to, washMark)
      return false
    },
  }))
  return marks.finish()
}

/** The `wash` ground behind every `{{ … }}`, `{% … %}` and comment, which is how Liquid is told from HTML. */
const liquidWash = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = washBehindLiquid(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state))
      this.decorations = washBehindLiquid(update.view)
  }
}, { decorations: plugin => plugin.decorations })

const JAVASCRIPT_KEYWORDS = 'async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof var void while yield'
  .split(' ')
  .map(label => ({ label, type: 'keyword' }))

/** Liquid and HTML complete what their language offers, JavaScript only its keywords, JSON nothing. */
export function completionOf(mode: CodeEditorMode): Extension {
  if (mode === 'json')
    return []
  return autocompletion({ icons: false, override: mode === 'javascript' ? [completeFromList(JAVASCRIPT_KEYWORDS)] : undefined })
}

/**
 * After `{%` the engine's tags, and after `{% render "` the names defined above the cursor, in place of the language's
 * tags (which cannot be pruned, only added to); everything else is the language's completion.
 */
function liquidSource(stock: CompletionSource, tags: readonly string[]): CompletionSource {
  const tagOptions = tags.map(label => ({ label, type: 'keyword' }))
  return (context: CompletionContext) => {
    const before = context.state.sliceDoc(0, context.pos)
    const ask = tagAskOf(before)
    if (!ask)
      return stock(context)
    const from = context.pos - ask.typed.length
    if (ask.kind === 'tag') {
      return context.explicit || ask.typed ? { from, options: tagOptions, validFor: /^\w*$/ } : null
    }
    const options = definedTemplatesIn(before.slice(0, from)).map(label => ({ label, type: 'variable' }))
    return options.length ? { from, options, validFor: /^[\w/]*$/ } : null
  }
}

function liquidLanguageOf({ data, filters, tags }: LiquidCompletion): Extension {
  const stock = liquidCompletionSource({
    variables: namesOf(data).map(name => ({ ...name, type: 'variable' })),
    filters: filters.map(({ label, dialect }) => ({ label, type: 'function', detail: dialect })),
    properties: path => keysUnder(data, path).map(key => ({ ...key, type: 'property' })),
  })
  const base = html()
  return new LanguageSupport(liquidLanguage, [
    base.support,
    liquidLanguage.data.of({ autocomplete: tags ? liquidSource(stock, tags) : stock }),
    base.language.data.of({ closeBrackets: { brackets: ['{'] } }),
    closePercentBrace,
  ])
}

export function languageOf(mode: CodeEditorMode, completion: LiquidCompletion): Extension {
  if (mode === 'liquid')
    return [liquidLanguageOf(completion), liquidWash]
  if (mode === 'html')
    return html()
  return mode === 'javascript' ? javascriptLanguage : json()
}
