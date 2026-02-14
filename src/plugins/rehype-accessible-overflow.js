import { visit } from 'unist-util-visit'

/**
 * Rehype plugin that improves accessibility for overflow containers:
 * 1. Adds tabindex="0" to <pre> elements for keyboard scrolling
 * 2. Wraps <table> in a scrollable region div with role="region"
 */
export function rehypeAccessibleOverflow() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'pre') {
        node.properties = node.properties || {}
        node.properties.tabIndex = 0
      }

      if (node.tagName === 'table' && parent && index != null) {
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: {
            role: 'region',
            ariaLabel: 'Scrollable table',
            tabIndex: 0,
            className: ['table-wrapper'],
          },
          children: [node],
        }
        parent.children[index] = wrapper
      }
    })
  }
}
