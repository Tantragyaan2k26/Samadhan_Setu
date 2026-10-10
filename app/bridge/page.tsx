'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  FileText,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { ApuniSarkarApplication } from '@/lib/types';

export default function BridgePage() {
  const [applications, setApplications] = useState<ApuniSarkarApplication[]>([]);
  const [searchRef, setSearchRef] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ ticketNo: string; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(true);
  const [authPhone, setAuthPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/session').then(response => setAuthRequired(!response.ok)).catch(() => setAuthRequired(true));
  }, []);

  const fetchApplications = async (refFilter = '') => {
    setIsLoading(true);
    try {
      const url = refFilter ? `/api/v1/bridge/applications?ref=${encodeURIComponent(refFilter)}` : '/api/v1/bridge/applications';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.applications) {
        setApplications(data.applications);
        setAuthRequired(false);
      } else if (res.status === 401) {
        setAuthRequired(true);
        setApplications([]);
        setErrorMsg(data.title || 'Verify the mobile number used on your application.');
      } else {
        setErrorMsg(data.title || 'No matching application was found.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestCode = async () => {
    const response = await fetch('/api/v1/auth/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone }) });
    const data = await response.json();
    if (!response.ok) { setErrorMsg(data.title || 'Could not send a code'); return; }
    setCodeSent(true);
    if (data.developmentCode) setAuthCode(data.developmentCode);
    setErrorMsg(null);
  };

  const verifyCode = async () => {
    const response = await fetch('/api/v1/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone, code: authCode }) });
    const data = await response.json();
    if (!response.ok) { setErrorMsg(data.title || 'Verification failed'); return; }
    setAuthRequired(false);
    if (searchRef.trim()) await fetchApplications(searchRef);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications(searchRef);
  };

  const handleEscalate = async (appId: string) => {
    setEscalatingId(appId);
    setErrorMsg(null);
    setSuccessInfo(null);

    try {
      const res = await fetch(`/api/v1/bridge/applications/${appId}/escalate`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessInfo({
          ticketNo: data.ticketNo,
          message: data.message
        });
      } else {
        setErrorMsg(data.title || 'एस्केलेशन में विफल');
      }
    } catch {
      setErrorMsg('सर्वर से संपर्क करने में असमर्थ।');
    } finally {
      setEscalatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Building2 className="w-3.5 h-3.5 text-emerald-300" />
          <span>अपणि सरकार एवं ई-डिस्ट्रिक्ट एकीकरण सेतु (e-Services Bridge)</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          प्रमाण पत्र या सरकारी सेवा में देरी? सीधे सीएम हेल्पलाइन से समाधान पाएं
        </h1>

        <p className="text-sm text-emerald-100 max-w-2xl leading-relaxed">
          यदि आपने अपणि सरकार (eservices.uk.gov.in) पर मूल निवास, जाति प्रमाण पत्र, आय प्रमाण पत्र या खतौनी हेतु आवेदन किया है और निर्धारित समय सीमा (SLA) बीत चुकी है, तो अब तहसील के चक्कर लगाने की आवश्यकता नहीं है। यहाँ से सीधे उच्चाधिकारी को अग्रसारित करें।
        </p>

        <div className="bg-emerald-950/40 border border-emerald-400/20 p-3 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>PRAYAS 2026 प्रोटोटाइप:</strong> यह मॉड्यूल अपणि सरकार एवं सीएम हेल्पलाइन 1905 के बीच ऑटोमेटेड सिंक का लाइव सिमुलेशन है।
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        {authRequired && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div><h2 className="font-semibold">Verify the mobile number on your Apuni Sarkar application</h2><p className="text-sm text-slate-600">Application details are shown only to the verified applicant.</p></div>
          <div className="flex flex-col sm:flex-row gap-2"><input type="tel" autoComplete="tel" aria-label="Mobile number" value={authPhone} onChange={event => setAuthPhone(event.target.value)} placeholder="10-digit mobile number" className="flex-1 rounded-lg border border-slate-300 p-3" /><button type="button" onClick={requestCode} className="rounded-lg bg-slate-800 text-white px-4 py-2">{codeSent ? 'Resend code' : 'Send code'}</button></div>
          {codeSent && <div className="flex gap-2"><input aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={authCode} onChange={event => setAuthCode(event.target.value)} placeholder="6-digit code" className="flex-1 rounded-lg border border-slate-300 p-3" /><button type="button" onClick={verifyCode} className="rounded-lg bg-emerald-700 text-white px-4 py-2">Verify</button></div>}
        </div>}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              placeholder="अपणि सरकार आवेदन संख्या दर्ज करें (उदा. UK-EDIST-2026-8812)..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition shadow"
          >
            {isLoading ? 'खोज रहे हैं...' : 'आवेदन खोजें'}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successInfo && (
        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-md space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-emerald-800">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <span>{successInfo.message}</span>
          </div>
          <div className="text-xs text-slate-700">
            शिकायत क्रमांक: <strong className="font-mono text-brand-700 font-bold">{successInfo.ticketNo}</strong>
          </div>
          <Link
            href={`/track?ticket=${successInfo.ticketNo}`}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow"
          >
            <span>शिकायत की लाइव स्थिति देखें</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <span>हालिया अपणि सरकार आवेदन (Simulated E-District Feed)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 hover:border-emerald-300 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {app.applicationNo}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 pt-1">{app.serviceName}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    app.currentStatus === 'DELAYED'
                      ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {app.currentStatus === 'DELAYED' ? `⚠️ ${app.delayDays} दिन विलंबित` : 'प्रक्रियाधीन'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>आवेदक: <strong>{app.applicantName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>जिला: <strong>{app.district}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>आवेदन तिथि: {new Date(app.submittedAt).toLocaleDateString('hi-IN')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>देय तिथि: {new Date(app.expectedBy).toLocaleDateString('hi-IN')}</span>
                </div>
              </div>

              {app.currentStatus === 'DELAYED' ? (
                <button
                  type="button"
                  disabled={escalatingId === app.id}
                  onClick={() => handleEscalate(app.id)}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow"
                >
                  {escalatingId === app.id ? (
                    <span>सीएम हेल्पलाइन में दर्ज हो रहा है...</span>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                      <span>सीएम हेल्पलाइन 1905 में शिकायत दर्ज करें (1-Click Escalate)</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center py-2 text-xs text-slate-500 bg-slate-100 rounded-xl font-medium">
                  ✓ वर्तमान में निर्धारित समय सीमा के भीतर है
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
