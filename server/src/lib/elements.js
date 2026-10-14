// Which element a click was on, as one key per element (M4-D2 in docs/v2-plan.md).
// Clicks from the tracker carry a CSS selector; older clicks only have the tag,
// id, classes and text. An element with an id gets `#id` either way, which is
// also the selector the tracker builds for it, so its old and new clicks agree.

/** The element key of a click's target. */
export function elementKey(target = {}) {
  if (target.selector) return target.selector;
  if (target.id) return `#${target.id}`;
  const classes = target.classes ? `.${target.classes.split(' ').join('.')}` : '';
  const text = target.text ? ` "${target.text}"` : '';
  return `${target.tag ?? '?'}${classes}${text}`;
}

const ifSet = (field, then) => ({ $cond: [{ $gt: [field, null] }, then, ''] });

/** elementKey as an aggregation expression over `$target`. */
export const ELEMENT_KEY = {
  $ifNull: [
    '$target.selector',
    {
      $cond: [
        { $gt: ['$target.id', null] },
        { $concat: ['#', '$target.id'] },
        {
          $concat: [
            { $ifNull: ['$target.tag', '?'] },
            ifSet('$target.classes', { $concat: ['.', { $replaceAll: { input: '$target.classes', find: ' ', replacement: '.' } }] }),
            ifSet('$target.text', { $concat: [' "', '$target.text', '"'] }),
          ],
        },
      ],
    },
  ],
};
