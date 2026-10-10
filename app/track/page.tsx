'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  ArrowUpRight,
  Star,
  ShieldCheck,
  User,
  Building,
  MapPin,
  Calendar,
  Layers,
  FileCheck,
  RotateCcw
} from 'lucide-react';
import { Complaint, ComplaintEvent } from '@/lib/types';

function TrackPageInner() {
  const searchParams = useSearchParams();
  const initialTicket = searchParams.get('ticket') || '';

  const [query, setQuery] = useState(initialTicket);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authPhone, setAuthPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authCodeSent, setAuthCodeSent] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/session').then(response => setAuthRequired(!response.ok)).catch(() => setAuthRequired(true));
  }, []);

  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackResolved, setFeedbackResolved] = useState(true);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const fetchComplaint = useCallback(async (ticket: string) => {
    if (!ticket.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/complaints/${encodeURIComponent(ticket.trim())}`);
      const data = await res.json();

      if (res.ok && data.complaint) {
        setAuthRequired(false);
        setComplaint(data.complaint);
      } else {
        if (res.status === 401) setAuthRequired(true);
        setErrorMsg(data.title || 'शिकायत नहीं मिली। कृपया क्रमांक जांचें।');
        setComplaint(null);
      }
    } catch {
      setErrorMsg('सर्वर से संपर्क करने में असमर्थ।');
      setComplaint(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialTicket) return;
    const timer = window.setTimeout(() => { void fetchComplaint(initialTicket); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialTicket, fetchComplaint]);

  const requestTrackCode = async () => {
    const response = await fetch('/api/v1/auth/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone }) });
    const data = await response.json();
    if (!response.ok) { setErrorMsg(data.title || 'Unable to send a verification code'); return; }
    setAuthCodeSent(true);
    if (data.developmentCode) setAuthCode(data.developmentCode);
    setErrorMsg(null);
  };

  const verifyTrackCode = async () => {
    const response = await fetch('/api/v1/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone, code: authCode }) });
    const data = await response.json();
    if (!response.ok) { setErrorMsg(data.title || 'Verification failed'); return; }
    setAuthRequired(false);
    if (query.trim()) await fetchComplaint(query);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchComplaint(query);
  };

  // Remind Officer Action
  const handleRemind = async () => {
    if (!complaint) return;
    setActionSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.ticketNo}/remind`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionSuccessMsg(
          data.autoEscalated
            ? 'रिमाइंडर भेजा गया! 3 रिमाइंडर पूरे होने पर शिकायत उच्च अधिकारी (Level ' + data.newLevel + ') को स्वतः प्रेषित कर दी गई है।'
            : 'अधिकारी को रिमाइंडर सफलतापूर्वक भेज दिया गया है।'
        );
        fetchComplaint(complaint.ticketNo);
      } else {
        setErrorMsg(data.title || 'रिमाइंडर भेजने में विफल');
      }
    } catch (err) {
      setErrorMsg('त्रुटि हुई, पुनः प्रयास करें।');
    }
  };

  // Escalate Action
  const handleEscalate = async () => {
    if (!complaint) return;
    setActionSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.ticketNo}/escalate`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionSuccessMsg(`शिकायत को उच्च स्तर (Level ${data.newLevel}) पर सफलतापूर्वक प्रेषित कर दिया गया है।`);
        fetchComplaint(complaint.ticketNo);
      } else {
        setErrorMsg(data.title || 'एस्केलेशन में विफल');
      }
    } catch (err) {
      setErrorMsg('त्रुटि हुई, पुनः प्रयास करें।');
    }
  };

  // Submit Feedback / Reopen
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    setIsSubmittingFeedback(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.ticketNo}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          resolved: feedbackResolved,
          comment: feedbackComment
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionSuccessMsg(data.message);
        fetchComplaint(complaint.ticketNo);
      } else {
        setErrorMsg(data.title || 'फीडबैक सबमिट करने में विफल');
      }
    } catch (err) {
      setErrorMsg('फीडबैक दर्ज करने में असमर्थ।');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Search Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        {authRequired && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div><h2 className="font-semibold text-slate-900">Verify your mobile to view your submissions</h2><p className="text-sm text-slate-600">Only submissions filed from your verified account will be shown.</p></div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input aria-label="Mobile number" type="tel" autoComplete="tel" value={authPhone} onChange={event => setAuthPhone(event.target.value)} placeholder="10-digit mobile number" className="flex-1 rounded-lg border border-slate-300 p-3" />
            <button type="button" onClick={requestTrackCode} className="rounded-lg bg-slate-800 text-white px-4 py-2">{authCodeSent ? 'Resend code' : 'Send code'}</button>
          </div>
          {authCodeSent && <div className="flex gap-2"><input aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={authCode} onChange={event => setAuthCode(event.target.value)} placeholder="6-digit code" className="flex-1 rounded-lg border border-slate-300 p-3" /><button type="button" onClick={verifyTrackCode} className="rounded-lg bg-brand-700 text-white px-4 py-2">Verify</button></div>}
        </div>}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">शिकायत की स्थिति ट्रैक करें (Grievance Tracking)</h1>
          <p className="text-xs text-slate-500">
            शिकायत क्रमांक (उदा. UK-2026-000101) अथवा पंजीकृत मोबाइल नंबर दर्ज करें।
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="UK-2026-000101 दर्ज करें..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition shadow"
          >
            {isLoading ? 'खोज रहे हैं...' : 'ट्रैक करें'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
          <span>डेमो शिकायतें क्लिक करें:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('UK-2026-000101');
              fetchComplaint('UK-2026-000101');
            }}
            className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-brand-700 font-medium"
          >
            UK-2026-000101 (जल संस्थान - प्रगति पर)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('UK-2026-000102');
              fetchComplaint('UK-2026-000102');
            }}
            className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-emerald-700 font-medium"
          >
            UK-2026-000102 (लो०नि०वि० - निस्तारित)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('UK-2026-000103');
              fetchComplaint('UK-2026-000103');
            }}
            className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-amber-700 font-medium"
          >
            UK-2026-000103 (अपनी सरकार सेतु - एस्केलेटेड L2)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Complaint Detail Card */}
      {complaint && (
        <div className="space-y-6">
          {/* Status Header Strip */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-800 font-mono font-bold px-2.5 py-1 rounded-md">
                    {complaint.ticketNo}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                      complaint.status === 'CLOSED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : complaint.status === 'RESOLVED_PENDING'
                        ? 'bg-sky-100 text-sky-800'
                        : complaint.status === 'ESCALATED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-brand-50 text-brand-800'
                    }`}
                  >
                    स्थिति: {complaint.status}
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-1 rounded-md">
                    Level {complaint.escalationLevel}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 pt-1">{complaint.title}</h2>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRemind}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl transition"
                >
                  <BellRing className="w-4 h-4 text-amber-600" />
                  <span>रिमाइंडर भेजें ({complaint.remindersCount})</span>
                </button>

                {complaint.escalationLevel < 4 && (
                  <button
                    type="button"
                    onClick={handleEscalate}
                    className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 text-xs font-bold px-3.5 py-2 rounded-xl transition"
                  >
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                    <span>उच्चाधिकारी को एस्केलेट करें</span>
                  </button>
                )}
              </div>
            </div>

            {/* SLA Progress Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-slate-600 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-brand-600" /> SLA समाधान लक्ष्य:
                </span>
                <span className="font-bold text-slate-900">
                  {complaint.slaDueAt
                    ? new Date(complaint.slaDueAt).toLocaleString('hi-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '48 घंटे'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    complaint.status === 'CLOSED'
                      ? 'bg-emerald-600 w-full'
                      : complaint.status === 'ESCALATED'
                      ? 'bg-amber-500 w-3/4'
                      : 'bg-brand-600 w-1/2'
                  }`}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>पंजीकरण: {new Date(complaint.createdAt).toLocaleDateString('hi-IN')}</span>
                <span>
                  वर्तमान नोडल अधिकारी: <strong>{complaint.assignedOfficerName || 'आवंटित किया जा रहा है'}</strong>
                </span>
              </div>
            </div>

            {/* Description & Metadata grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="space-y-1">
                <span className="font-bold text-slate-700">समस्या का विस्तृत विवरण:</span>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {complaint.description}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>नागरिक: <strong>{complaint.citizenName}</strong> (XXX-XXX-{complaint.citizenPhone.slice(-4)})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>विभाग: <strong>{complaint.departmentId}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>स्थान: <strong>{complaint.villageOrTehsil || 'उत्तराखंड'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>समर्थक नागरिक (Supporters): <strong>{complaint.supportersCount}</strong></span>
                </div>
              </div>
            </div>

            {/* Proof attachments if any */}
            {complaint.attachments && complaint.attachments.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">संलग्न साक्ष्य / फोटो (Proof Attachments):</span>
                <div className="flex flex-wrap gap-3">
                  {complaint.attachments.map((att) => (
                    <div key={att.id} className="p-2 border border-slate-200 rounded-lg text-xs flex items-center gap-2 bg-slate-50">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>{att.fileName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Feedback & Satisfaction Box (Solving PP-7 Force-Closing) */}
          {(complaint.status === 'RESOLVED_PENDING' || complaint.status === 'CLOSED' || complaint.status === 'IN_PROGRESS') && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-emerald-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span>नागरिक संतुष्टि एवं निवारण पुष्टि (Resolution Feedback)</span>
              </div>
              <p className="text-xs text-slate-600">
                अधिकारी द्वारा निवारण के उपरांत आपकी पुष्टि अनिवार्य है। <strong>यदि समस्या का पूर्ण समाधान नहीं हुआ है या आप 2 या उससे कम स्टार देते हैं, तो शिकायत तुरंत उच्च अधिकारी को पुनः सौंप दी जाएगी।</strong>
              </p>

              {complaint.feedback ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="font-bold">दर्ज फीडबैक: {complaint.feedback.rating} / 5 स्टार</div>
                  <div>स्थिति: {complaint.feedback.resolved ? '✓ समस्या का समाधान हो गया' : '✗ समस्या जस की तस है'}</div>
                  {complaint.feedback.comment && <div>टिप्पणी: &quot;{complaint.feedback.comment}&quot;</div>}
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">समाधान गुणवत्ता रेटिंग (1 से 5 स्टार):</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className={`p-2 rounded-lg border text-sm font-bold flex items-center gap-1 ${
                            feedbackRating >= star
                              ? 'bg-amber-50 border-amber-400 text-amber-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${feedbackRating >= star ? 'fill-amber-400 text-amber-500' : ''}`} />
                          <span>{star}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">क्या मौके पर कार्य पूरा हुआ?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="isResolved"
                          checked={feedbackResolved}
                          onChange={() => setFeedbackResolved(true)}
                        />
                        <span>हाँ, पूर्णतः संतुष्ट</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="isResolved"
                          checked={!feedbackResolved}
                          onChange={() => setFeedbackResolved(false)}
                        />
                        <span className="text-red-700 font-semibold">नहीं, असंतुष्ट (री-ओपन करें)</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">अतिरिक्त टिप्पणी (वैकल्पिक):</label>
                    <input
                      type="text"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="उदा. पाइपलाइन जोड़ दी गई है, पानी आ गया..."
                      className="w-full p-2.5 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingFeedback}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow"
                  >
                    {isSubmittingFeedback ? 'सबमिट हो रहा है...' : 'फीडबैक सबमिट करें'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Vertical Visual Timeline (Hero Feature) */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" />
              <span>कार्यवाही का पारदर्शी घटनाक्रम (Action Timeline)</span>
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {complaint.events.map((evt: ComplaintEvent, idx: number) => (
                <div key={evt.id || idx} className="relative flex items-start gap-4">
                  <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-white border-2 border-brand-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-brand-600"></div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex-1 space-y-1">
                    <div className="flex flex-wrap justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">
                        {evt.actorName || evt.actorType}: <span className="text-brand-700">{evt.toStatus}</span>
                      </span>
                      <span className="text-slate-400 font-mono">
                        {new Date(evt.createdAt).toLocaleString('hi-IN')}
                      </span>
                    </div>
                    {evt.reason && <p className="text-xs text-slate-600">{evt.reason}</p>}
                    {evt.notes && (
                      <p className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 font-medium">
                        &quot;{evt.notes}&quot;
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function TrackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <TrackPageInner />
    </Suspense>
  );
}
