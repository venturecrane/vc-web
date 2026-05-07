import satori from 'satori'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

let wasmInitialized = false

async function ensureWasm() {
  if (wasmInitialized) return
  const wasmPath = _require.resolve('@resvg/resvg-wasm/index_bg.wasm')
  const wasmBinary = readFileSync(wasmPath)
  await initWasm(wasmBinary)
  wasmInitialized = true
}

const fontPath = _require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff')
const interBold = readFileSync(fontPath)

interface OgImageOptions {
  title: string
  tags: string[]
  type: 'Article' | 'Ship Log'
}

function titleFontSize(title: string): string {
  if (title.length > 60) return '36px'
  if (title.length > 40) return '42px'
  return '48px'
}

function typeLabelNode(type: string) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#a0a0b8',
      },
      children: type,
    },
  }
}

function tagPillNode(tag: string) {
  return {
    type: 'div',
    props: {
      style: {
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        color: '#818cf8',
        padding: '4px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 700,
      },
      children: tag,
    },
  }
}

function titleAndTagsNode(title: string, tags: string[]) {
  const tagsNode =
    tags.length > 0
      ? {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
            children: tags.map(tagPillNode),
          },
        }
      : null

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        flexGrow: 1,
        justifyContent: 'center',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: titleFontSize(title),
              fontWeight: 700,
              color: '#e8e8f0',
              lineHeight: 1.2,
            },
            children: title,
          },
        },
        tagsNode,
      ].filter(Boolean),
    },
  }
}

function domainNode() {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        fontSize: '16px',
        color: '#a0a0b8',
      },
      children: 'venturecrane.com',
    },
  }
}

function rootNode(title: string, tags: string[], type: string) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#1a1a2e',
        padding: '60px',
      },
      children: [typeLabelNode(type), titleAndTagsNode(title, tags), domainNode()],
    },
  }
}

export async function generateOgImage(options: OgImageOptions): Promise<Uint8Array> {
  await ensureWasm()

  const { title, tags, type } = options
  const displayTags = tags.slice(0, 3)

  const svg = await satori(rootNode(title, displayTags, type), {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: interBold, weight: 700, style: 'normal' }],
  })

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  const png = resvg.render()
  return new Uint8Array(png.asPng())
}
