import './styles.css';

const site = process.env.SITE_URL || 'https://trello.learnvibecode.online';
export const metadata = {
  metadataBase: new URL(site),
  title: 'Trello Learning | A little clarity for your next big idea',
  description: 'An independent learning project for organizing shared work with boards, lists, cards, and checklists.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Make room for great work.', description: 'A visual home for your ideas, plans, and everyday progress.', url: site, type: 'website' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
