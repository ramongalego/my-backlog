import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { LegalContents } from './LegalContents';

export interface LegalSection {
  /** The heading's id, linked from "On this page". */
  id: string;
  title: string;
  body: ReactNode;
}

// Styled from here so the pages themselves are just their words.
const PROSE =
  'space-y-4 text-base leading-relaxed text-ink-300 ' +
  '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:marker:text-ink-600 ' +
  '[&_a]:text-ink-100 [&_a]:underline [&_a]:decoration-ink-600 [&_a]:underline-offset-4 ' +
  '[&_a]:transition-colors hover:[&_a]:decoration-ink-300 ' +
  // About 72 characters to a line (a ch is wider than the average letter);
  // a table takes the column's whole width, where its three columns have room.
  '[&>*:not(table)]:max-w-[65ch]';

/** A policy page (Privacy, Terms): a document to read, not an app screen. */
export function LegalPage({
  title,
  effective,
  intro,
  sections,
}: {
  title: string;
  /** Written out: "November 16, 2026". */
  effective: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <Page>
      {/* From `lg`, the contents sit beside the text and stay in view; the text
          keeps its reading width, and the tables take the rest of the column. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-x-16">
        <div className="min-w-0 max-w-[65ch]">
          <PageHeader title={title} description={`Effective ${effective}`} />
          <div className={PROSE}>{intro}</div>
        </div>

        <LegalContents
          sections={sections}
          className="mt-8 border-y border-ink-800 py-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:border-y-0 lg:py-0"
        />

        <div className="mt-10 min-w-0 space-y-10">
          {sections.map((section, i) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2
                id={section.id}
                // Jumped to, it lands clear of the fixed header by the page's own
                // scroll-padding-top (globals.css): no offset of its own on top.
                className="max-w-[65ch] text-lg font-semibold tracking-tight text-ink-50 sm:text-xl"
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
 * On a phone, where three columns of sentences don't fit, each row is a block
 * with the column names beside the values.
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
