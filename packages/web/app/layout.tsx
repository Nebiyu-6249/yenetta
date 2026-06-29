import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { APP_TAGLINE, APP_WORDMARK } from '@yenetta/shared';
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

export const metadata: Metadata = {
  title: `${APP_WORDMARK} — ${APP_TAGLINE}`,
  description:
    'Yenetta is an AI study companion for Ethiopian high-school students (Grades 9–12), grounded in the national curriculum and past exams.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
