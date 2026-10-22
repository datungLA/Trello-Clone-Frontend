export const dynamic = 'force-static';
export default function sitemap() {
  return [{ url: process.env.SITE_URL || 'https://trello.learnvibecode.online', changeFrequency: 'monthly', priority: 1 }];
}
