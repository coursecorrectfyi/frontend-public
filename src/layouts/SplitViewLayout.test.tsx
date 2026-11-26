import { act } from '@testing-library/react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { allowConsole } from '@/test/console'
import { renderWithProviders } from '@/test/render'
import SplitViewLayout, { SPLIT_VIEW_IDS } from './SplitViewLayout'

// The split view (chat | results) on search, subject and course pages, built on react-resizable-panels.

const view = <SplitViewLayout leftContent={<p>chat</p>} rightContent={<p>results</p>} />

describe('SplitViewLayout', () => {
  it('gives the panel group, both panels and the handle fixed ids', () => {
    const { container } = renderWithProviders(view)
    expect(container.querySelector('[data-panel-group]')).toHaveAttribute('data-panel-group-id', SPLIT_VIEW_IDS.group)
    expect([...container.querySelectorAll('[data-panel]')].map(p => p.getAttribute('data-panel-id'))).toEqual([
      SPLIT_VIEW_IDS.left,
      SPLIT_VIEW_IDS.right,
    ])
    expect(container.querySelector('[data-panel-resize-handle-id]')).toHaveAttribute(
      'data-panel-resize-handle-id',
      SPLIT_VIEW_IDS.handle,
    )
  })

  describe('hydration when the browser computes different React ids than the server', () => {
    // Reproduces the production crash "No group found for id": React's useId depends on the shape of the component
    // tree, so any difference above the split view between server and browser gives the panels different generated
    // ids. React doesn't repair attribute differences while hydrating, so the DOM kept the server's id, and the
    // library's effect, looking up the group by the browser's id, threw and took down the page.
    let container: HTMLDivElement | undefined
    afterEach(() => container?.remove())

    // Same HTML, different component tree: an extra component that renders nothing shifts React's ids.
    const Nothing = () => null
    const ServerShape = ({ children }: { children: ReactNode }) => <Fragment><Nothing />{children}</Fragment>
    // The browser side also re-renders once after hydrating, as the real pages do (chat and results update right after
    // load): the library only looks the group up from the second render on, once it knows the group's DOM element.
    const Browser = () => {
      const [updated, setUpdated] = useState(false)
      useEffect(() => setUpdated(true), [])
      void updated // the state change re-renders the split view; the HTML stays the same
      return <SplitViewLayout leftContent={<p>chat</p>} rightContent={<p>results</p>} />
    }

    it('hydrates without errors', async () => {
      container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = renderToString(<ServerShape>{view}</ServerShape>)
      // Elsewhere in the split view (MUI, useId-based attributes) a mismatch is only a dev warning, not this crash.
      allowConsole('error', /didn't match the client properties|hydration-mismatch/)

      const errors: unknown[] = []
      await act(async () => {
        hydrateRoot(container!, <Browser />, {
          onUncaughtError: error => errors.push(error),
          onCaughtError: error => errors.push(error),
          onRecoverableError: error => errors.push(error),
        })
      })

      expect(errors.map(e => (e instanceof Error ? e.message : String(e)))).toEqual([])
      expect(container.querySelector('[data-panel-group]')).toHaveAttribute('data-panel-group-id', SPLIT_VIEW_IDS.group)
    })
  })
})
