'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mic,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  PhoneCall
} from 'lucide-react';
import { formatPublicCount, parsePublicStats } from '@/lib/public-stats';

export default function HomePage() {
  const router = useRouter();
  const [ticketInput, setTicketInput] = useState('');
  const [stats, setStats] = useState<ReturnType<typeof parsePublicStats>>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/public/stats')
      .then(async response => {
        if (!response.ok) return null;
        return parsePublicStats(await response.json());
      })
      .then(metrics => { if (!cancelled && metrics) setStats(metrics); })
      .catch(() => { /* Statistics are optional; the page remains usable if they cannot load. */ });
    return () => { cancelled = true; };
  }, []);


  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketInput.trim()) {
      router.push(`/track?ticket=${encodeURIComponent(ticketInput.trim())}`);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-sky-900 via-sky-800 to-slate-900 text-white overflow-hidden py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-400/30 text-sky-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>PRAYAS 2026 - स्मार्ट, त्वरित एवं पारदर्शी नागरिक सेवा</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            आपकी समस्या, उत्तराखंड सरकार का संकल्प
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-sky-100 font-normal leading-relaxed">
            मुख्यमंत्री हेल्पलाइन 1905 एवं अपनी सरकार ई-सेवा सेतु। अब बिना किसी परेशानी के सीधे बोलकर या लिखकर शिकायत दर्ज करें और हर कदम पर पारदर्शी निगरानी रखें।
          </p>

          {/* Hero Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href="/file?mode=voice"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-bold px-6 py-4 rounded-xl shadow-lg shadow-amber-500/30 hover:scale-[1.02] transition text-base"
            >
              <Mic className="w-5 h-5 text-slate-950 animate-bounce" />
              <span>बोलकर शिकायत दर्ज करें (Voice Input)</span>
            </Link>

            <Link
              href="/file"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-4 rounded-xl backdrop-blur-sm transition text-base"
            >
              <FileText className="w-5 h-5 text-sky-300" />
              <span>लिखकर दर्ज करें (Online Form)</span>
            </Link>
          </div>

          {/* Quick Track Input in Hero */}
          <div className="max-w-xl mx-auto pt-6">
            <form onSubmit={handleTrackSubmit} className="relative flex items-center">
              <input
                aria-label="शिकायत क्रमांक / Complaint ticket number"
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder="शिकायत क्रमांक दर्ज करें (उदा. UK-2026-000101)..."
                className="w-full pl-11 pr-28 py-3.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5" />
              <button
                type="submit"
                className="absolute right-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition"
              >
                ट्रैक करें
              </button>
            </form>
            <div className="flex items-center justify-center gap-2 text-xs text-sky-200/80 pt-2">
              <span>डेमो टिकट:</span>
              <button
                type="button"
                onClick={() => setTicketInput('UK-2026-000101')}
                className="underline hover:text-white"
              >
                UK-2026-000101
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setTicketInput('UK-2026-000102')}
                className="underline hover:text-white"
              >
                UK-2026-000102
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setTicketInput('UK-2026-000103')}
                className="underline hover:text-white"
              >
                UK-2026-000103
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live State Performance Metrics (Solving C3: Zero Stats Issue) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>लाइव निवारण आंकड़े (Live Redressal Analytics)</span>
              </h2>
              <p className="text-xs text-slate-500">
                पारदर्शिता एवं सुशासन: राज्यभर में शिकायतों का 24x7 वास्तविक डेटा
              </p>
            </div>
            <Link
              href="/stats"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
            >
              पूर्ण सांख्यिकी एवं जिला डैशबोर्ड देखें <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">कुल दर्ज शिकायतें</div>
              <div className="text-3xl font-extrabold text-slate-900" aria-live="polite">{formatPublicCount(stats?.totalGrievances)}</div>
              <div className="text-[11px] text-emerald-600 font-medium">राज्यभर से दर्ज (लाइव डेटा)</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">सफलतापूर्वक निस्तारित</div>
              <div className="text-3xl font-extrabold text-emerald-600 flex items-center gap-1">
                {formatPublicCount(stats?.resolvedCount)}
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {stats?.citizenSatisfactionScore != null
                  ? `औसत नागरिक रेटिंग: ${stats.citizenSatisfactionScore}/5`
                  : `निस्तारण दर: ${typeof stats?.resolutionRatePercent === 'number' ? `${stats.resolutionRatePercent}%` : '—'}`}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">औसत समाधान समय</div>
              <div className="text-3xl font-extrabold text-brand-600 flex items-center gap-1">
                {typeof stats?.avgResolutionDays === 'number' ? stats.avgResolutionDays : '—'} <span className="text-base font-normal text-slate-600">दिन</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">SLA मानक: अधिकतम 7 से 15 दिन</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">एस्केलेटेड मामले</div>
              <div className="text-3xl font-extrabold text-amber-600 flex items-center gap-1">
                {formatPublicCount(stats?.escalatedCount)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">समय सीमा पार होने पर उच्च स्तर पर भेजे गए मामले</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            समाधान सेतु के 3 क्रांतिकारी स्तंभ
          </h2>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            पुराने सिस्टम की कमियों को दूर कर नागरिकों एवं अधिकारियों के बीच पारदर्शिता और विश्वास का नया सेतु
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Card 1 */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:border-brand-300 transition space-y-4">
            <div className="w-12 h-12 rounded-lg bg-sky-100 text-brand-700 flex items-center justify-center font-bold">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. आवाज से शिकायत & AI ऑटो-रूटिंग</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              दुर्गम पर्वतीय क्षेत्रों के ग्रामीण नागरिक अपनी भाषा में बोलकर समस्या बता सकते हैं। हमारा AI इंजन समस्या को समझकर सही विभाग (जल, बिजली, सड़क) और गंभीरता का स्वतः निर्धारण करता है।
            </p>
            <Link
              href="/file?mode=voice"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 pt-2"
            >
              अभी बोलकर बताएं <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:border-emerald-300 transition space-y-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. अपनी सरकार सेवा सेतु (Bridge)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              मूल निवास, जाति या आय प्रमाण पत्र में निर्धारित समय से अधिक विलंब होने पर 1-क्लिक में सीएम हेल्पलाइन में उच्च प्राथमिकता शिकायत में बदलें। कोई तहसील जाने की जरूरत नहीं।
            </p>
            <Link
              href="/bridge"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 pt-2"
            >
              विलंबित आवेदन जोड़ें <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:border-amber-300 transition space-y-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. बिना समाधान नहीं बंद होगी शिकायत</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              अधिकारी के समाधान दर्ज करने के बाद नागरिक की पुष्टि आवश्यक है। यदि नागरिक 2 स्टार या उससे कम रेटिंग देता है, तो शिकायत स्वतः री-ओपन होकर अगले स्तर के अधिकारी को चली जाती है।
            </p>
            <Link
              href="/track"
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 pt-2"
            >
              फीडबैक नियम देखें <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works 4-Step Diagram */}
      <section className="bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">आसान और पारदर्शी प्रक्रिया</span>
            <h2 className="text-2xl font-bold text-slate-900">शिकायत समाधान कैसे काम करता है?</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-brand-600">चरण 1</div>
              <h4 className="font-bold text-slate-900 text-sm">शिकायत दर्ज करें</h4>
              <p className="text-xs text-slate-500">
                बोलकर या लिखकर समस्या बताएं, फोटो संलग्न करें और OTP सत्यापित करें।
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-brand-600">चरण 2</div>
              <h4 className="font-bold text-slate-900 text-sm">AI वर्गीकरण & प्रेषण</h4>
              <p className="text-xs text-slate-500">
                सिस्टम तुरंत संबंधित विभाग के Level 1 कनिष्ठ अधिकारी को SLA समय-सीमा के साथ भेजता है।
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-brand-600">चरण 3</div>
              <h4 className="font-bold text-slate-900 text-sm">समयबद्ध कार्यवाही</h4>
              <p className="text-xs text-slate-500">
                अधिकारी मौके पर निरीक्षण कर निवारण रिपोर्ट व फोटो अपलोड करता है।
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-emerald-600">चरण 4</div>
              <h4 className="font-bold text-slate-900 text-sm">नागरिक संतुष्टि & फीडबैक</h4>
              <p className="text-xs text-slate-500">
                आपकी संतुष्टि रेटिंग (3+ स्टार) के बाद ही शिकायत बंद मानी जाती है।
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
