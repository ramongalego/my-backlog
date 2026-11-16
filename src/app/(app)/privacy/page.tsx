import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalTable, type LegalSection } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'The personal data MyBacklog collects, how it is used, who processes it, and how to export or delete it.',
};

const contact = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
/** A link to another company's site. */
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' };

// Every statement here describes what the code does. When what's stored, who
// it's sent to or how it's deleted changes, this page changes with it, and so
// does its date.
//
// Written plainly, as a person would write it: whole sentences, one idea
// each, said once. No bold lead-ins on list items, no colons setting up a
// list, no sentence fragments, straight quotes as in the rest of the app.
const sections: LegalSection[] = [
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: (
      <>
        <p>Most of the information we hold comes directly from you.</p>
        <LegalTable
          columns={['Category', 'What it includes']}
          rows={[
            [
              'Account',
              'Your email address and password. The password is stored as a salted hash by our authentication provider, and we cannot read it.',
            ],
            [
              'Library',
              'The games you add, with the status, hours played, dates, rating and notes you record for each, plus your queue and your favorite games.',
            ],
            [
              'Steam',
              "If you connect a Steam account, your Steam ID, display name, avatar and the games Steam lists as owned by you, with your playtime in each. Steam shares your games only when the game details on your Steam profile are public. Sign-in happens on Steam's site, so we never receive your Steam password.",
            ],
            ['Profile', 'A display name and a profile picture, if you choose to set them.'],
            ['Messages', 'Anything you send us through Report an issue or by email.'],
            [
              'Generated text',
              'The player profile and roast on the Stats page, saved after you request them so that you can read them again.',
            ],
            [
              'Technical',
              'Request logs kept by our hosting provider, containing IP address, browser type, the page requested and the time. We also keep rate-limit counters linked to your account or, for signed-out visitors, to an IP address.',
            ],
          ]}
        />
        <p>We do not collect payment information. The Service is free.</p>
      </>
    ),
  },
  {
    id: 'how-we-use-information',
    title: 'How we use information',
    body: (
      <>
        <p>
          We use personal data to provide the Service. That covers displaying and organizing your
          library, keeping your diary and statistics, suggesting games to play, and keeping a
          connected Steam library up to date.
        </p>
        <p>
          We also use it to send account emails, such as address confirmations, password resets and
          notices that your email or password has changed, to protect the Service against abuse, and
          to reply when you contact us.
        </p>
        <p>
          We do not sell or rent personal data or share it for advertising. The Service has no ads,
          and we do not send marketing email.
        </p>
        <p>
          Pick My Game suggestions and the player profile and roast are generated automatically from
          your library when you request them. We do not make automated decisions about you that have
          legal or similarly significant effects.
        </p>
        <p>
          For users in the European Economic Area and the United Kingdom, the legal bases for this
          processing are the performance of our contract with you and our legitimate interest in
          keeping the Service secure and reliable.
        </p>
      </>
    ),
  },
  {
    id: 'service-providers',
    title: 'Service providers',
    body: (
      <>
        <p>
          The companies listed below process personal data on our behalf. Each one receives the data
          needed for its purpose and handles it under its own privacy policy, which is linked from
          its name.
        </p>
        <LegalTable
          columns={['Provider', 'Purpose', 'Data it receives']}
          rows={[
            [
              <a key="supabase" href="https://supabase.com/privacy" {...EXTERNAL}>
                Supabase
              </a>,
              'Database, authentication and file storage',
              'Your account, library and profile data',
            ],
            [
              <a key="vercel" href="https://vercel.com/legal/privacy-notice" {...EXTERNAL}>
                Vercel
              </a>,
              'Hosting and usage statistics',
              'Request logs and page-view statistics, which are collected without cookies',
            ],
            [
              <a key="openai" href="https://openai.com/policies/privacy-policy" {...EXTERNAL}>
                OpenAI
              </a>,
              'Generating Pick My Game suggestions and the player profile and roast',
              'The games in your library, including their names, tags, length, hours played, status and ratings, and your answers to the Pick My Game questions. OpenAI does not receive your email address, password or notes.',
            ],
            [
              <a key="valve" href="https://store.steampowered.com/privacy_agreement/" {...EXTERNAL}>
                Valve (Steam)
              </a>,
              'Reading your Steam library when you connect or refresh it',
              'Your Steam ID',
            ],
            [
              'IGDB, HowLongToBeat and SteamGridDB',
              'Game details, time to beat and artwork',
              'The name or ID of a game. These requests contain nothing that identifies you.',
            ],
            ['Our email delivery provider', 'Sending account emails', 'Your email address'],
          ]}
        />
        <p>
          Some providers process data in countries other than your own, including the United States.
          We may also disclose personal data where the law requires it.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <>
        <p>
          The Service stores a small number of cookies and local storage entries in your browser.
          Each one is needed for the Service to work or remembers a preference.
        </p>
        <ul>
          <li>Sign-in cookies that keep you signed in</li>
          <li>A cookie that remembers whether you view your games as a grid or a list</li>
          <li>A cookie set while you connect a Steam account, which expires after five minutes</li>
          <li>Local storage entries recording when your library was last refreshed</li>
        </ul>
        <p>We do not use advertising cookies or cross-site tracking.</p>
      </>
    ),
  },
  {
    id: 'share-pages',
    title: 'Share pages',
    body: (
      <p>
        After finishing a game, you can create a share page for it. Share pages are public, and
        anyone with the link can view them. A share page shows the game, your rating and hours, a
        count of the games in your library and, where you have one, the next game in your queue. It
        does not include your name, email address or Steam account. Share pages are deleted along
        with your account.
      </p>
    ),
  },
  {
    id: 'data-retention',
    title: 'Data retention',
    body: (
      <>
        <p>
          We keep your data for as long as your account exists. Deleting your account immediately
          deletes your account record, library, diary, queue, favorites, profile picture, share
          pages and the messages you sent through Report an issue. Copies may persist in our
          database provider&apos;s backups until those backups expire.
        </p>
        <p>
          If you disconnect Steam, your Steam games and everything recorded on them are removed. Our
          hosting provider retains request logs for a limited period.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          You can download a copy of your data at any time. Go to{' '}
          <Link href="/profile">your Profile</Link>, open More options and choose Export data. The
          export is available as a JSON file containing everything, or as a CSV file of your games.
        </p>
        <p>
          You can correct your games, notes, ratings, display name and picture in the Service, and
          change your email address or password from your Profile. You can also disconnect Steam or
          delete your account there.
        </p>
        <p>
          Depending on where you live, you may have additional rights under local law. These include
          the right to access, correct or delete your personal data, to receive it in a portable
          format, to restrict or object to its use, and to lodge a complaint with your data
          protection authority. To exercise these rights, email {contact}. We respond within 30
          days. Requests are free, and making one will not affect your access to the Service.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Data is encrypted in transit. Database access rules limit each account&apos;s data to that
        account, and passwords are stored only as hashes. No system is completely secure, and we
        cannot guarantee that your data will never be accessed without authorization.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        The Service is not intended for children under 13, and we do not knowingly collect their
        personal data. If you believe a child has provided personal data, email {contact} and we
        will delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy from time to time. The effective date at the top of the page shows
        when it was last changed. We will notify you in the Service or by email before any change
        that significantly affects how we use your personal data.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>For questions about this policy or your personal data, email {contact}.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="November 16, 2026"
      intro={
        <>
          <p>
            This Privacy Policy describes the personal data MyBacklog (&quot;MyBacklog&quot;,
            &quot;we&quot;, &quot;us&quot;) collects through the MyBacklog website and app (the
            &quot;Service&quot;), how that data is used, and the choices you have.
          </p>
          <p>
            We collect only what the Service needs to work. We do not sell personal data, and the
            Service has no ads.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
