import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3"><Image src="/samadhan-setu-mark.svg" alt="Samadhan Setu logo" width={40} height={40} /><strong className="text-lg">Samadhan Setu</strong></div>
          <p className="max-w-sm text-sm text-slate-400">Independent citizen service prototype for grievances, demands, suggestions, and service tracking.</p>
          <span className="inline-flex rounded-full border border-amber-700/60 bg-amber-950/50 px-3 py-1 text-xs font-semibold text-amber-200">Prototype · not an official government portal</span>
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold">Official Uttarakhand channels</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="https://cmhelpline.uk.gov.in/" className="hover:text-white">CM Helpline 1905</a></li>
            <li><a href="https://eservices.uk.gov.in/" className="hover:text-white">Apuni Sarkar e-Services</a></li>
            <li><a href="https://uk.gov.in/" className="hover:text-white">Uttarakhand Government portal</a></li>
            <li><a href="tel:112" className="hover:text-white">Emergency services: 112</a></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold">Samadhan Setu</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/file" className="hover:text-white">Create a submission</Link></li>
            <li><Link href="/track" className="hover:text-white">Track a submission</Link></li>
            <li><Link href="/bridge" className="hover:text-white">Application delay bridge</Link></li>
            <li><Link href="/stats" className="hover:text-white">Public metrics</Link></li>
            <li><Link href="/accessibility" className="hover:text-white">Accessibility statement</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500">This prototype is not connected to Uttarakhand Government production systems. For an official complaint, use CM Helpline 1905.</div>
    </footer>
  );
}
