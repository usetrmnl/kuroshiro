export interface MoveAction {
  label: string
  /** How many places the Screen moves in the Order; an infinite number is the top or the end. */
  by: number
  disabled: boolean
}

/** The move buttons of an opened Screen at `place` (from 0) among `total`, with the two jumps on a long Order. */
export function moveActions(place: number, total: number, jumps: boolean): MoveAction[] {
  const isFirst = place === 0
  const isLast = place === total - 1
  return [
    { label: 'Move up', by: -1, disabled: isFirst },
    { label: 'Move down', by: 1, disabled: isLast },
    ...jumps
      ? [
          { label: 'Move to top', by: Number.NEGATIVE_INFINITY, disabled: isFirst },
          { label: 'Move to end', by: Number.POSITIVE_INFINITY, disabled: isLast },
        ]
      : [],
  ]
}
