import { describe, expect, it } from 'vitest'
import { definedTemplatesIn, keysUnder, kindOf, namesOf, tagAskOf } from '../codeCompletion'

const data = {
  location: 'Lindenplatz',
  show_wind: true,
  forecast: {
    current: { temperature: 14.3, summary: 'Rain from 15:00' },
    hourly: [{ time: 12, rain: 5 }, { time: 13, rain: 10 }],
    updated: null,
  },
}

describe('completion from the preview\'s data', () => {
  it('names the kind of a value as the admin would', () => {
    expect([kindOf('x'), kindOf(3), kindOf(true), kindOf(null), kindOf({}), kindOf([1, 2, 3])])
      .toEqual(['string', 'number', 'boolean', 'null', 'object', 'list of 3'])
  })

  it('offers every name with its kind', () => {
    expect(namesOf(data)).toEqual([
      { label: 'location', detail: 'string' },
      { label: 'show_wind', detail: 'boolean' },
      { label: 'forecast', detail: 'object' },
    ])
  })

  it('offers the keys under a path with their kinds', () => {
    expect(keysUnder(data, ['forecast'])).toEqual([
      { label: 'current', detail: 'object' },
      { label: 'hourly', detail: 'list of 2' },
      { label: 'updated', detail: 'null' },
    ])
  })

  it('offers first, last and size for a list', () => {
    expect(keysUnder(data, ['forecast', 'hourly']).map(key => key.label)).toEqual(['first', 'last', 'size'])
  })

  it('reads on through the first and the last of a list', () => {
    expect(keysUnder(data, ['forecast', 'hourly', 'first'])).toEqual([
      { label: 'time', detail: 'number' },
      { label: 'rain', detail: 'number' },
    ])
    expect(keysUnder(data, ['forecast', 'hourly', 'last']).map(key => key.label)).toEqual(['time', 'rain'])
  })

  it('offers nothing under a plain value or a path the data does not have', () => {
    expect(keysUnder(data, ['location'])).toEqual([])
    expect(keysUnder(data, ['forcast', 'current'])).toEqual([])
    expect(keysUnder(data, ['forecast', 'updated', 'at'])).toEqual([])
  })
})

describe('completion of tags and a Template\'s own names', () => {
  it('asks for a tag after {% and for a name after render', () => {
    expect(tagAskOf('<p>{% te')).toEqual({ kind: 'tag', typed: 'te' })
    expect(tagAskOf('{%- ')).toEqual({ kind: 'tag', typed: '' })
    expect(tagAskOf('{% render "ma')).toEqual({ kind: 'template', typed: 'ma' })
    expect(tagAskOf('{% render \'')).toEqual({ kind: 'template', typed: '' })
    expect(tagAskOf('{% for item in ')).toBeNull()
    expect(tagAskOf('{{ te')).toBeNull()
  })

  it('finds the names {% template %} defines, once each, in order', () => {
    const text = '{% template b %}x{% endtemplate %}{%- template a/c -%}{% endtemplate %}{% template b %}{% endtemplate %}{% render "z" %}'
    expect(definedTemplatesIn(text)).toEqual(['b', 'a/c'])
  })
})
