import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene'

// Night sea: navy surfaces taken from the sky and water, moonlight text,
// the girl's orange hair as the accent.
const { theme, problems } = makeColors({
  label: 'Moonlit beach',
  only: 'dark',
  roles: {
    accent: '#d9834f',
    danger: '#e0625a',
    success: '#6fbf8e',
    warning: '#e3b25c',
    pro: '#9b8cf0',
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#080d22',
        'surface-1': '#0f1730',
        'surface-2': '#141d3a',
        'surface-3': '#1a2444',
        'text-primary': '#ece8d4',
        'text-secondary': '#c3c3c8',
        'text-muted': '#9aa0b8',
      },
    },
  },
})

// The app strips pictures embedded in an SVG, so the scene is all vector
// (svg_scene.py in the moonlit-beach project builds hooks/scene.ts).
const LOOK: ThemeSetArgs = {
  colors: theme,
  // No frost: the default glass (blur 16) smeared the moon and the two of them
  // into fog. A light night-blue veil keeps the words readable instead.
  backdrop: { scene: 'moonlit-beach', glass: { blur: 0, tint: '#080d22', opacity: 0.4 } },
}

// Minimized, or covered by a fullscreen app, for a while, the window comes back
// with the backdrop's sandboxed frame no longer animating (the app's renderer
// pauses hidden pages and the frame's timeline isn't woken), and no event says
// so. So rebuild the frame whenever the person is clearly back: they send a
// prompt, a reply finishes, or the app reattaches. A changed source makes the
// app load the frame afresh. At most once a minute.
const REFRESH_MS = 60_000
let refreshes = 0
let lastRefresh = 0

type Refresher = { clock: { now: () => Promise<number> }; ui: { invalidate: (event: 'ui.render') => void } }

const refresh = async ($: Refresher) => {
  const now = await $.clock.now()

  if (now - lastRefresh >= REFRESH_MS) {
    lastRefresh = now
    refreshes += 1
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    // Clear a status line an earlier version of this mod left behind.
    $.ui.status(undefined)
    await $.theme.set(LOOK)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await refresh($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await refresh($)
    }

    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    await refresh($)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== 'moonlit-beach') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    // The sandboxed frame runs the scene's SMIL animation; as a plain image
    // the desktop app shows one still frame. The empty rect only changes the
    // source (inside the root: the app keeps a lone <svg> and may drop comments).
    const source =
      refreshes === 0 ? SCENE : SCENE.replace(/<\/svg>$/, `<rect width="0" height="0" x="${refreshes}"/></svg>`)

    return <Svg source={source} alt="Claude-chan and Clawd on a moonlit beach, waves rolling in" isInteractive />
  })
}
