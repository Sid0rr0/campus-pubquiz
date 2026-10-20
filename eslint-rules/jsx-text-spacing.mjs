// JSX drops whitespace that spans a line break, so an inline element at a line
// end followed by text on the next line renders with no space between them:
// `<strong>5 points</strong>⏎for finishing` shows "5 pointsfor finishing".
// Prettier's reflow introduces these. Only text-level elements count: a label's
// text beside an <input> sits in a flex layout where the whitespace never shows.

const INLINE_ELEMENTS = new Set([
  'a',
  'abbr',
  'b',
  'cite',
  'code',
  'em',
  'i',
  'kbd',
  'Link',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
]);

/** Text starting on the line after the element: "\n   for finishing". */
const TEXT_ON_NEXT_LINE = /^[^\S\n]*\n\s*\S/;
/** Text ending a line before the element: "finishing\n   ". */
const TEXT_ON_PREVIOUS_LINE = /\S[^\S\n]*\n\s*$/;

function inlineName(node) {
  if (node?.type !== 'JSXElement') return null;
  const { name } = node.openingElement;
  return name.type === 'JSXIdentifier' && INLINE_ELEMENTS.has(name.name)
    ? name.name
    : null;
}

const rule = {
  meta: {
    type: 'problem',
    messages: {
      after:
        "Text after <{{name}}> starts on a new line, so it renders with no space: add {' '} after the element.",
      before:
        "Text before <{{name}}> ends a line, so it renders with no space: add {' '} before the element.",
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      const { children } = node;
      for (let i = 0; i + 1 < children.length; i++) {
        const [left, right] = [children[i], children[i + 1]];
        const leftName = inlineName(left);
        if (
          leftName &&
          right.type === 'JSXText' &&
          TEXT_ON_NEXT_LINE.test(right.value)
        ) {
          context.report({
            node: right,
            messageId: 'after',
            data: { name: leftName },
          });
        }
        const rightName = inlineName(right);
        if (
          rightName &&
          left.type === 'JSXText' &&
          TEXT_ON_PREVIOUS_LINE.test(left.value)
        ) {
          context.report({
            node: right,
            messageId: 'before',
            data: { name: rightName },
          });
        }
      }
    }
    return { JSXElement: check, JSXFragment: check };
  },
};

/** Flat-config entry turning the rule on. */
export function jsxTextSpacingRules() {
  return {
    plugins: { local: { rules: { 'jsx-text-spacing': rule } } },
    rules: { 'local/jsx-text-spacing': 'error' },
  };
}
