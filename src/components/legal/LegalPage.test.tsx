import { render, screen, within } from '@testing-library/react';
import { LegalPage, LegalTable } from '@/components/legal/LegalPage';
import PrivacyPage from '@/app/(app)/privacy/page';
import TermsPage from '@/app/(app)/terms/page';

it('numbers its sections, and lists them as links to each', () => {
  render(
    <LegalPage
      title="Privacy Policy"
      effective="November 16, 2026"
      intro={<p>What we collect.</p>}
      sections={[
        { id: 'data', title: 'Data we collect', body: <p>Your email address.</p> },
        { id: 'contact', title: 'Contact', body: <p>Write to us.</p> },
      ]}
    />,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
  expect(screen.getByText('Effective November 16, 2026')).toBeInTheDocument();

  const contents = screen.getByRole('navigation', { name: 'On this page' });
  expect(within(contents).getByRole('link', { name: '1. Data we collect' })).toHaveAttribute(
    'href',
    '#data',
  );
  expect(within(contents).getByRole('link', { name: '2. Contact' })).toHaveAttribute(
    'href',
    '#contact',
  );
  // Each link lands on the heading it names.
  expect(screen.getByRole('heading', { level: 2, name: '2. Contact' })).toHaveAttribute(
    'id',
    'contact',
  );
});

it('draws a table whose cells carry their column names, for a phone', () => {
  render(<LegalTable columns={['Provider', 'Purpose']} rows={[['Supabase', 'Database']]} />);
  expect(screen.getByRole('columnheader', { name: 'Provider' })).toBeInTheDocument();
  expect(screen.getByText('Database')).toHaveAttribute('data-label', 'Purpose');
});

describe('the policies themselves', () => {
  it('Privacy says how to export and delete, and where to write', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Your rights/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Service providers/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'contact@mybacklog.co' })[0]).toHaveAttribute(
      'href',
      'mailto:contact@mybacklog.co',
    );
  });

  it('Terms points to the Privacy Policy', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('links only to sections that exist, in both', () => {
    for (const Policy of [PrivacyPage, TermsPage]) {
      const { container, unmount } = render(<Policy />);
      const contents = screen.getByRole('navigation', { name: 'On this page' });
      for (const link of within(contents).getAllByRole('link')) {
        const id = link.getAttribute('href')!.slice(1);
        expect(container.querySelector(`h2#${id}`)).toBeInTheDocument();
      }
      unmount();
    }
  });
});
