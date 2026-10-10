'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Shield, PhoneCall, Globe, Menu, X, Sparkles, MessageSquare, BarChart3, Building2, UserCheck } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>('normal');
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('samadhan_lang') as 'hi' | 'en';
    if (!savedLang || savedLang === lang) return;
    const timer = window.setTimeout(() => setLang(savedLang), 0);
    return () => window.clearTimeout(timer);
  }, [lang]);

  const toggleLang = () => {
    const next = lang === 'hi' ? 'en' : 'hi';
    setLang(next);
    localStorage.setItem('samadhan_lang', next);
    window.dispatchEvent(new Event('samadhan_lang_change'));
  };

  const setScale = (size: 'small' | 'normal' | 'large') => {
    setFontSize(size);
    document.body.classList.remove('font-small', 'font-normal', 'font-large');
    document.body.classList.add(`font-${size}`);
  };

  const toggleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    if (next) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      {/* Top Accessibility & Emergency Strip */}
      <div className="bg-slate-900 text-slate-100 text-xs px-4 py-1.5 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-3">
          <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
            <PhoneCall className="w-3 h-3 animate-pulse" /> 112 आपातकालीन
          </span>
          <span className="hidden sm:inline text-slate-300">
            उत्तराखंड शासन | Independent prototype · official CM Helpline 1905
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Font Resizer */}
          <div className="flex items-center space-x-1 border-r border-slate-700 pr-2">
            <button
              onClick={() => setScale('small')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'small' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}
              title="Small text"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <button
              onClick={() => setScale('normal')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'normal' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}
              title="Normal text"
              aria-label="Reset font size"
            >
              A
            </button>
            <button
              onClick={() => setScale('large')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'large' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}
              title="Large text"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>

          {/* High Contrast */}
          <button
            onClick={toggleContrast}
            className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 border border-slate-600"
            title="Toggle High Contrast"
          >
            {highContrast ? 'सामान्य' : 'Contrast'}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 font-medium bg-brand-700 text-white px-2 py-0.5 rounded text-[11px] hover:bg-brand-600 transition"
          >
            <Globe className="w-3 h-3" /> {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Portal Identity */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/samadhan-setu-mark.svg" alt="Samadhan Setu logo" width={42} height={42} priority />
            <div>
              <div className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                समाधान सेतु <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-300">CM 1905 2.0</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Uttarakhand grievance and service tracking prototype
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-3 text-sm font-medium">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md transition ${pathname === '/' ? 'text-brand-700 font-bold bg-brand-50' : 'text-slate-700 hover:text-brand-700 hover:bg-slate-50'}`}
            >
              {lang === 'hi' ? 'मुख्य पृष्ठ' : 'Home'}
            </Link>

            <Link
              href="/file"
              className={`px-3 py-2 rounded-md transition flex items-center gap-1.5 ${pathname === '/file' ? 'bg-brand-600 text-white font-bold shadow' : 'bg-brand-50 text-brand-700 hover:bg-brand-100 font-semibold'}`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              {lang === 'hi' ? 'शिकायत दर्ज करें' : 'File Grievance'}
            </Link>

            <Link
              href="/track"
              className={`px-3 py-2 rounded-md transition ${pathname === '/track' ? 'text-brand-700 font-bold bg-brand-50' : 'text-slate-700 hover:text-brand-700 hover:bg-slate-50'}`}
            >
              {lang === 'hi' ? 'स्थिति देखें' : 'Track Status'}
            </Link>

            <Link
              href="/bridge"
              className={`px-3 py-2 rounded-md transition flex items-center gap-1 ${pathname === '/bridge' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-50'}`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              {lang === 'hi' ? 'अपनी सरकार सेतु' : 'Apuni Sarkar Bridge'}
            </Link>

            <Link
              href="/stats"
              className={`px-3 py-2 rounded-md transition flex items-center gap-1 ${pathname === '/stats' ? 'text-brand-700 font-bold bg-brand-50' : 'text-slate-700 hover:text-brand-700 hover:bg-slate-50'}`}
            >
              <BarChart3 className="w-4 h-4" />
              {lang === 'hi' ? 'पारदर्शिता' : 'Live Stats'}
            </Link>

            <Link
              href="/officer"
              className={`px-3 py-2 rounded-md transition flex items-center gap-1 text-slate-600 hover:text-indigo-600 ${pathname === '/officer' ? 'text-indigo-700 font-bold bg-indigo-50' : ''}`}
            >
              <UserCheck className="w-4 h-4" />
              {lang === 'hi' ? 'अधिकारी लॉगिन' : 'Officer Console'}
            </Link>

            <Link
              href="/dev/messages"
              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-full"
              title="SMS/WhatsApp Mock Outbox"
            >
              <MessageSquare className="w-4 h-4" />
            </Link>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 text-sm font-medium">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100"
          >
            {lang === 'hi' ? 'मुख्य पृष्ठ' : 'Home'}
          </Link>
          <Link
            href="/file"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md bg-brand-600 text-white font-semibold"
          >
            {lang === 'hi' ? 'शिकायत दर्ज करें (बोलकर / लिखकर)' : 'File Grievance (Voice / Text)'}
          </Link>
          <Link
            href="/track"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100"
          >
            {lang === 'hi' ? 'शिकायत की स्थिति ट्रैक करें' : 'Track Grievance'}
          </Link>
          <Link
            href="/bridge"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-emerald-700 hover:bg-emerald-50"
          >
            {lang === 'hi' ? 'अपनी सरकार सेतु (प्रमाण पत्र विलंब)' : 'Apuni Sarkar Bridge'}
          </Link>
          <Link
            href="/stats"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100"
          >
            {lang === 'hi' ? 'पारदर्शिता आंकड़े' : 'Transparency Dashboard'}
          </Link>
          <Link
            href="/officer"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-indigo-700 hover:bg-indigo-50 font-semibold"
          >
            {lang === 'hi' ? 'अधिकारी कार्यक्षेत्र (Officer Workspace)' : 'Officer Workspace'}
          </Link>
          <Link
            href="/dev/messages"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-amber-700 hover:bg-amber-50"
          >
            {lang === 'hi' ? 'एसएमएस / व्हाट्सएप संदेश आउटबॉक्स' : 'SMS / WhatsApp Outbox'}
          </Link>
        </div>
      )}
    </header>
  );
}
