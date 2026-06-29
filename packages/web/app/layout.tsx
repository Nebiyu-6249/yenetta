import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { APP_TAGLINE, APP_WORDMARK } from '@yenetta/shared';
import { Providers } from '../components/providers';
import { SITE_URL } from '../lib/config';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const description =
  'Yenetta is an AI study companion for Ethiopian high-school students (Grades 9–12), grounded in the national curriculum and past national exams — with study tools, exam practice, and an entrance-exam coach.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_WORDMARK} — ${APP_TAGLINE}`,
    template: `%s · ${APP_WORDMARK}`,
  },
  description,
  keywords: [
    'Ethiopia',
    'ESSLCE',
    'EUEE',
    'entrance exam',
    'study app',
    'AI tutor',
    'Grade 9',
    'Grade 12',
  ],
  openGraph: {
    title: `${APP_WORDMARK} — ${APP_TAGLINE}`,
    description,
    url: SITE_URL,
    siteName: APP_WORDMARK,
    locale: 'en',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: APP_WORDMARK, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="bg-paper font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
