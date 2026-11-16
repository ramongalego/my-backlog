import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';

export interface LegalSection {
  /** For the link from "On this page": the section's heading id. */
  id: string;
  title: string;
  body: ReactNode;
}

// The text inside a section: paragraphs, lists and links, styled from here so
// the pages themselves are just their words.
const PROSE =
  'space-y-4 text-base leading-relaxed text-ink-300 ' +
  '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:marker:text-ink-600 ' +
  '[&_a]:text-ink-100 [&_a]:underline [&_a]:decoration-ink-600 [&_a]:underline-offset-4 ' +
  '[&_a]:transition-colors hover:[&_a]:decoration-ink-300';

/**
 * A policy page (Privacy, Terms): a document to read, not an app screen. The
 * title with the date it took effect, a short opening, the numbered sections
 * listed as links, then the sections in a column narrow enough to read.
 */
export function LegalPage({
  title,
  effective,
  intro,
  sections,
}: {
  title: string;
  /** The date it took effect, written out: "November 16, 2026". */
  effective: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <Page>
      {/* About 72 characters to a line (a ch is wider than the average letter): a column to read, not to fill. */}
      <div className="max-w-[65ch]">
        <PageHeader title={title} description={`Effective ${effective}`} />
        <div className={PROSE}>{intro}</div>

        <nav aria-label="On this page" className="mt-8 border-y border-ink-800 py-5">
          <h2 className="text-sm font-semibold text-ink-200">On this page</h2>
          <ol className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  // py-1: about 24px to tap.
                  className="block py-1 text-ink-400 transition-colors hover:text-ink-100"
                >
                  <span className="text-ink-500">{i + 1}.</span> {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section, i) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2
                id={section.id}
                // Clear of the fixed header when jumped to.
                className="scroll-mt-24 text-lg font-semibold tracking-tight text-ink-50 sm:text-xl"
              >
                {i + 1}. {section.title}
              </h2>
              <div className={`mt-3 ${PROSE}`}>{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
}

/**
 * A table inside a policy: columns from `sm` up, and each row a block with
 * its column names beside the values on a phone, where three columns of
 * sentences don't fit.
 */
export function LegalTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="block w-full border-y border-ink-800 text-sm sm:table">
      <thead className="hidden text-left text-ink-200 sm:table-header-group">
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col" className="py-3 pr-6 font-semibold last:pr-0">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block divide-y divide-ink-800 sm:table-row-group sm:border-t sm:border-ink-800">
        {rows.map((row, r) => (
          <tr key={r} className="block py-3 sm:table-row sm:py-0">
            {row.map((value, c) => (
              <td
                key={c}
                data-label={columns[c]}
                className={`block py-1 align-top before:block before:text-xs before:text-ink-500 before:content-[attr(data-label)] sm:table-cell sm:py-3 sm:pr-6 sm:before:hidden sm:last:pr-0 ${
                  c === 0 ? 'font-medium text-ink-100 sm:w-40' : ''
                }`}
              >
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
