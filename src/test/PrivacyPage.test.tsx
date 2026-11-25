import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from '../pages/PrivacyPage';

describe('PrivacyPage', () => {
  it('documents local IndexedDB storage, R2 security boundary, SW exclusions, and disabled adapter', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Privacy & Security Boundary/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/ag-pocket-db/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Never extracts, stores, or reuses Google OAuth tokens/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/accounts\.google\.com/i)).toBeInTheDocument();
    expect(screen.getByText('enabled: false')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Settings/i })).toHaveAttribute(
      'href',
      '/settings'
    );
  });
});
