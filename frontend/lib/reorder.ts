/**
 * Moving one item in a list.
 *
 * Used by the homepage layout builder and by every repeatable list in the
 * homepage editor -- quick links, editorial tiles, ranges, FAQs. All of them
 * render in stored order, and until this existed the only way to change that
 * order was to delete entries and retype them, which for an editorial tile
 * meant re-uploading its image.
 */

/**
 * `items` with the entry at `index` moved one place.
 *
 * Returns the list unchanged at the ends rather than wrapping. A list that
 * teleports its first item to the bottom when somebody presses up once too
 * often is a worse answer than one that does nothing, and the buttons that
 * call this are disabled there anyway -- this is the half that holds when they
 * are not.
 *
 * Never mutates: the caller is React state.
 */
export function moveEntry<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
