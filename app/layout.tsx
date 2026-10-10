import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EmergencyBanner from '@/components/EmergencyBanner';

export const metadata: Metadata = {
  title: 'Samadhan Setu | Uttarakhand citizen service prototype',
  description: 'Independent citizen grievance, demand, suggestion, and service tracking prototype. Official CM Helpline 1905 and Apuni Sarkar channels remain available.',
  keywords: ['CM Helpline Uttarakhand', '1905', 'Samadhan Setu', 'Apuni Sarkar', 'e-District Uttarakhand', 'Grievance Redressal'],
  applicationName: 'Samadhan Setu',
  icons: { icon: '/samadhan-setu-mark.svg' }
};

// CSP nonces are generated per request in proxy.ts; prerendered HTML cannot carry them safely.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <EmergencyBanner />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
