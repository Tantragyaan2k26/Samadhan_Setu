'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Building,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ArrowRight,
  ShieldAlert,
  Send,
  LogOut,
  Camera,
  Layers,
  Sparkles
} from 'lucide-react';
import { Complaint } from '@/lib/types';
import { DEPARTMENTS, DISTRICTS } from '@/lib/taxonomy';

export default function OfficerPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [activeOfficerLevel, setActiveOfficerLevel] = useState<number>(1);
  const [activeOfficerName, setActiveOfficerName] = useState<string>('Rajesh Negi (JE - Jal Sansthan)');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Action modal state
  const [actionType, setActionType] = useState<'accept' | 'start' | 'resolve' | 'reject' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionProofUrl, setActionProofUrl] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/session').then(async response => {
      if (!response.ok) { setAuthenticated(false); return; }
      const data = await response.json();
      if (!['OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(data.session?.role)) { setAuthenticated(false); return; }
      setActiveOfficerName(data.session.name || data.session.email || 'Staff');
      setActiveOfficerLevel(data.session.officerLevel || 1);
      setAuthenticated(true);
    }).catch(() => setAuthenticated(false));
  }, []);

  const fetchOfficerComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (levelFilter) params.set('level', levelFilter);
      const res = await fetch(`/api/v1/officer/complaints?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.complaints) {
        setComplaints(data.complaints);
        setSelectedComplaint(current => current ?? data.complaints[0] ?? null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, levelFilter]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => { void fetchOfficerComplaints(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticated, fetchOfficerComplaints]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setLoginBusy(true); setErrorMsg(null);
    try {
      const response = await fetch('/api/v1/auth/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      const result = await response.json();
      if (!response.ok) { setErrorMsg(result.title || 'Sign in failed'); return; }
      setActiveOfficerName(result.session.name || result.session.email || 'Staff');
      setActiveOfficerLevel(result.session.officerLevel || 1);
      setAuthenticated(true);
    } catch { setErrorMsg('Unable to reach the sign-in service. Try again.'); }
    finally { setLoginBusy(false); }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/v1/auth/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Sign out failed');
      setAuthenticated(false);
      setComplaints([]);
      setSelectedComplaint(null);
    } catch {
      setErrorMsg('साइन आउट नहीं हो सका। कृपया फिर से प्रयास करें।');
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !actionType) return;
    setIsSubmittingAction(true);
    setErrorMsg(null);
    setActionMsg(null);

    try {
      const res = await fetch(`/api/v1/officer/complaints/${selectedComplaint.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          officerName: activeOfficerName,
          notes: actionNotes || `अधिकारी द्वारा कार्यवाही: ${actionType.toUpperCase()}`,
          proofUrl: actionProofUrl || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg(`कार्यवाही सफलतापूर्वक दर्ज की गई (${actionType.toUpperCase()})। नागरिक को एसएमएस प्रेषित कर दिया गया है।`);
        setActionType(null);
        setActionNotes('');
        setActionProofUrl('');
        fetchOfficerComplaints();
        // Update selected complaint
        setSelectedComplaint(data.complaint);
      } else {
        setErrorMsg(data.title || 'कार्यवाही विफल');
      }
    } catch {
      setErrorMsg('सर्वर से संपर्क करने में असमर्थ।');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (authenticated !== true) return (
    <main className="max-w-md mx-auto px-4 py-16">
      <form onSubmit={handleLogin} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-7 space-y-5">
        <div><h1 className="text-2xl font-bold">Officer sign in</h1><p className="text-sm text-slate-600 mt-2">Use your department account to open the secure inbox.</p></div>
        {errorMsg && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errorMsg}</p>}
        <label className="block text-sm font-medium">Official email<input autoComplete="username" type="email" required value={loginEmail} onChange={event => setLoginEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
        <label className="block text-sm font-medium">Password<input autoComplete="current-password" type="password" required value={loginPassword} onChange={event => setLoginPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
        <button disabled={loginBusy || authenticated === null} className="w-full rounded-lg bg-brand-700 text-white font-semibold p-3 disabled:opacity-50">{authenticated === null ? 'Checking session…' : loginBusy ? 'Signing in…' : 'Sign in securely'}</button>
      </form>
    </main>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Officer Switcher Strip */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider">
            <UserCheck className="w-4 h-4" /> अधिकारी कमांड कंसोल (Officer Command Console)
          </div>
          <h1 className="text-xl sm:text-2xl font-bold pt-1">
            नोडल अधिकारी कार्यक्षेत्र: {activeOfficerName}
          </h1>
          <p className="text-xs text-slate-400">
            SLA-आधारित प्राथमिकता इनबॉक्स एवं 4-स्तरीय एस्केलेशन ट्रैकर
          </p>
        </div>

        {/* Filters apply to the signed-in account; they do not change the account role. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200">
            अधिकृत स्तर: L{activeOfficerLevel}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>साइन आउट</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Workspace 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Complaint Inbox (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>शिकायत इनबॉक्स ({complaints.length})</span>
              <div className="flex gap-1">
                <select
                  aria-label="Filter complaints by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-1 rounded border border-slate-300 text-[11px]"
                >
                  <option value="">सभी स्थिति</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="RESOLVED_PENDING">RESOLVED_PENDING</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <select
                  aria-label="Filter complaints by escalation level"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="p-1 rounded border border-slate-300 text-[11px]"
                >
                  <option value="">सभी स्तर</option>
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                  <option value="4">Level 4</option>
                </select>
              </div>
            </div>

            {/* List */}
            {isLoading && complaints.length === 0 && (
              <div role="status" className="py-6 text-center text-xs text-slate-400">इनबॉक्स लोड हो रहा है…</div>
            )}
            <div aria-label="Complaint inbox" className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {complaints.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedComplaint(c)}
                  aria-current={selectedComplaint?.id === c.id ? 'true' : undefined}
                  className={`w-full p-3.5 rounded-xl border text-left cursor-pointer transition space-y-1.5 ${
                    selectedComplaint?.id === c.id
                      ? 'bg-brand-50 border-brand-500 shadow-sm ring-1 ring-brand-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-slate-800">{c.ticketNo}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        c.status === 'ESCALATED'
                          ? 'bg-amber-100 text-amber-800'
                          : c.status === 'RESOLVED_PENDING'
                          ? 'bg-sky-100 text-sky-800'
                          : c.status === 'CLOSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-900 line-clamp-1">{c.title}</div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>Level {c.escalationLevel}</span>
                    <span className="flex items-center gap-1 text-red-600 font-medium">
                      <Clock className="w-3 h-3" /> SLA: {new Date(c.createdAt).toLocaleDateString('hi-IN')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Complaint Workspace (7 cols) */}
        <div className="lg:col-span-7">
          {selectedComplaint ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      {selectedComplaint.ticketNo}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                      Level {selectedComplaint.escalationLevel} अधिकारी क्षेत्र
                    </span>
                    {selectedComplaint.urgency === 'HIGH' && (
                      <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                        🔴 उच्च प्राथमिकता
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 pt-2">{selectedComplaint.title}</h2>
                </div>
              </div>

              {/* AI Summary Banner */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI स्वचालित विश्लेषण (AI Triage Summary)</span>
                </div>
                <p className="text-slate-600">
                  <strong>हिंदी सारांश:</strong> {selectedComplaint.aiSummaryHi || selectedComplaint.description.slice(0, 100)}
                </p>
                <p className="text-slate-600">
                  <strong>English Summary:</strong> {selectedComplaint.aiSummaryEn || selectedComplaint.title}
                </p>
              </div>

              {/* Citizen Details & Description */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-700">मूल नागरिक समस्या विवरण:</span>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {selectedComplaint.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>नागरिक: <strong>{selectedComplaint.citizenName}</strong></div>
                <div>फोन: <strong>{selectedComplaint.citizenPhone}</strong></div>
                <div>स्थान: <strong>{selectedComplaint.villageOrTehsil || 'उत्तराखंड'}</strong></div>
                <div>रिमाइंडर गणना: <strong>{selectedComplaint.remindersCount} बार</strong></div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-700">अधिकारी कार्यवाही बार (Officer Actions):</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType('start')}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow"
                  >
                    कार्य प्रारंभ करें (Start / In Progress)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('resolve')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow"
                  >
                    ✓ निस्तारित दर्ज करें (Resolve with Proof)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('reject')}
                    className="bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold px-4 py-2 rounded-xl text-xs border border-slate-300 transition"
                  >
                    अमान्य / निरस्त करें (Reject with Reason)
                  </button>
                </div>
              </div>

              {/* Action Modal Form when action button clicked */}
              {actionType && (
                <form onSubmit={handleExecuteAction} className="p-4 bg-slate-50 border border-brand-300 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-brand-900 uppercase">
                    कार्यवाही विवरण: {actionType.toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="action-notes" className="text-xs font-semibold text-slate-700">
                      आधिकारिक रिपोर्ट / मौके की टिप्पणी (Mandatory Remarks):
                    </label>
                    <textarea
                      id="action-notes"
                      rows={3}
                      required
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="उदा. मौके पर टीम द्वारा नई पाइपलाइन बिछा दी गई है और पानी की आपूर्ति बहाल कर दी गई है..."
                      className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  {actionType === 'resolve' && (
                    <div className="space-y-1">
                      <label htmlFor="action-proof-url" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>समाधान साक्ष्य फोटो (Resolution Proof URL / Upload):</span>
                      </label>
                      <input
                        id="action-proof-url"
                        type="text"
                        value={actionProofUrl}
                        onChange={(e) => setActionProofUrl(e.target.value)}
                        placeholder="उदा. https://.../repaired_pipeline.jpg"
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActionType(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      रद्द करें
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAction}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition shadow"
                    >
                      {isSubmittingAction ? 'सेव हो रहा है...' : 'कार्यवाही सबमिट करें'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-slate-300" />
              <div className="text-sm font-semibold">शिकायत विवरण देखने हेतु बाईं सूची से चुनें</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
