export const dynamic = 'force-static';
export default function robots() {
  const site = process.env.SITE_URL || 'https://trello.learnvibecode.online';
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${site.replace(/\/$/, '')}/sitemap.xml` };
}
