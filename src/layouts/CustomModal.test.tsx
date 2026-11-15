import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import CustomModal from './CustomModal'

describe('CustomModal', () => {
  it('renders its content only while open', () => {
    const { rerender } = renderWithProviders(<CustomModal open={false} onClose={vi.fn()}><p>content</p></CustomModal>)
    expect(screen.queryByText('content')).toBeNull()
    rerender(<CustomModal open onClose={vi.fn()}><p>content</p></CustomModal>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('closes with Escape and by clicking outside', async () => {
    const onClose = vi.fn()
    const { user } = renderWithProviders(<CustomModal open onClose={onClose}><p>content</p></CustomModal>)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(document.querySelector('.MuiBackdrop-root')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
