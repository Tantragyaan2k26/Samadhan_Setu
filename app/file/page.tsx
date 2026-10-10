'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mic,
  MicOff,
  Sparkles,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Phone,
  ShieldCheck,
  Copy,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { DISTRICTS, DEPARTMENTS, CATEGORIES } from '@/lib/taxonomy';
import { getComplaintSourceChannel, getStableRequestKey } from '@/lib/complaint-form';

interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface AiClassificationResult {
  isEmergency?: boolean;
  emergencyNotice?: string;
  confidence: number;
  summaryHi: string;
}

interface DuplicateMatch {
  ticketNo: string;
  supportersCount: number;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function FileComplaintPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode');

  // Step 1: Input text & Voice
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [description, setDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const simulationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: AI Suggestion
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiResult, setAiResult] = useState<AiClassificationResult | null>(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('NORMAL');
  const [submissionType, setSubmissionType] = useState<'GRIEVANCE' | 'DEMAND' | 'SUGGESTION'>('GRIEVANCE');
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);

  // Step 3: Location
  const [districtId, setDistrictId] = useState('dist-ddn');
  const [villageOrTehsil, setVillageOrTehsil] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Step 4: Photos & Contact / OTP
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [authForAi, setAuthForAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<string | null>(null);
  const [mockPhotoName, setMockPhotoName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSubmissionRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // Voice Speech Recognition or Simulation
  const stopVoiceRecording = () => {
    if (simulationTimerRef.current) {
      clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsRecording(false);
    setVoiceNotice('वॉयस रिकॉर्डिंग रोक दी गई।');
  };

  const simulateVoiceInput = () => {
    setIsRecording(true);
    setVoiceNotice('वॉयस इनपुट सिमुलेशन चल रहा है (इस ब्राउज़र में speech recognition उपलब्ध नहीं है)।');
    simulationTimerRef.current = setTimeout(() => {
      simulationTimerRef.current = null;
      setDescription(prev => prev ? `${prev} हमारे गांव में पिछले 4 दिनों से पानी की सप्लाई पूरी तरह बंद है।` : 'हमारे गांव में पिछले 4 दिनों से पानी की सप्लाई पूरी तरह बंद है। मुख्य पाइपलाइन में लीकेज है और पानी सड़क पर बह रहा है।');
      setUsedVoice(true);
      setIsRecording(false);
      setVoiceNotice('डेमो वॉयस टेक्स्ट जोड़ा गया। आगे बढ़ने से पहले इसे जाँच लें।');
    }, 1800);
  };

  const startVoiceRecording = () => {
    if (isRecording) {
      stopVoiceRecording();
      return;
    }
    setVoiceNotice(null);
    if (typeof window !== 'undefined') {
      const voiceWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechRecognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        simulateVoiceInput();
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        recognitionRef.current = recognition;
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setDescription(prev => (prev ? `${prev} ${transcript}` : transcript));
          setUsedVoice(true);
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setIsRecording(false);
        setVoiceNotice('आवाज पहचान उपलब्ध नहीं हो सकी। कृपया अनुमति जाँचें या विवरण लिखें।');
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setIsRecording(false);
      };

      try {
        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setIsRecording(false);
        setVoiceNotice('माइक शुरू नहीं हो सका। कृपया अनुमति जाँचें या विवरण लिखें।');
      }
    }
  };

  useEffect(() => {
    if (initialMode !== 'voice') return;
    const timer = setTimeout(() => startVoiceRecording(), 0);
    return () => clearTimeout(timer);
    // The callback only uses stable state setters and the current browser API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  useEffect(() => () => {
      if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
  }, []);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsNotice('इस ब्राउज़र में GPS उपलब्ध नहीं है। जिला और तहसील/गांव का विवरण भरें।');
      return;
    }
    setGpsNotice('लोकेशन प्राप्त की जा रही है…');
    navigator.geolocation.getCurrentPosition(
      position => {
        setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsNotice('GPS लोकेशन जोड़ दी गई।');
      },
      error => {
        setGpsNotice(error.code === error.PERMISSION_DENIED
          ? 'लोकेशन अनुमति नहीं मिली। जिला और तहसील/गांव चुनकर जारी रखें।'
          : 'लोकेशन प्राप्त नहीं हो सकी। जिला और तहसील/गांव चुनकर जारी रखें।');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Step 1 -> Step 2: Trigger AI Classification
  const handleProceedToAI = async () => {
    if (!description.trim() || description.length < 8) {
      setErrorMessage('कृपया समस्या का विवरण कम से कम 8 अक्षरों में लिखें या बोलें।');
      return;
    }
    setErrorMessage(null);
    setIsClassifying(true);

    try {
      const res = await fetch('/api/v1/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, districtId })
      });
      const data = await res.json();

      if (res.status === 401) {
        setAuthForAi(true);
        setErrorMessage('AI सुझाव पाने के लिए पहले अपने मोबाइल नंबर को OTP से सत्यापित करें।');
        setStep(4);
        return;
      }

      if (data.success && data.suggestion) {
        setAiResult(data.suggestion);
        setSelectedDept(data.suggestion.departmentId || '');
        setSelectedCat(data.suggestion.categoryId || '');
        setSelectedUrgency(data.suggestion.urgency || 'NORMAL');
        setDuplicateMatch(data.duplicateMatch);
      }
      setStep(2);
    } catch (err) {
      setAiResult(null);
      setSelectedDept('');
      setSelectedCat('');
      setStep(2);
    } finally {
      setIsClassifying(false);
    }
  };

  // Step 4: Request OTP
  const handleSendOtp = async () => {
    if (!citizenPhone || citizenPhone.replace(/\D/g, '').length !== 10) {
      setErrorMessage('कृपया मान्य 10 अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: citizenPhone })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpVerified(false);
        // Pre-fill only a code returned by explicitly enabled local OTP delivery.
        setOtpCode(data.developmentCode || '');
      } else {
        setErrorMessage(data.title || 'OTP भेजने में विफल');
      }
    } catch {
      setErrorMessage('नेटवर्क त्रुटि, पुनः प्रयास करें।');
    }
  };

  // Submit Final Grievance
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified && !otpCode) {
      setErrorMessage('कृपया अपने मोबाइल पर प्राप्त OTP दर्ज करें।');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (!otpVerified) {
        const verification = await fetch('/api/v1/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: citizenPhone, code: otpCode })
        });
        const verificationData = await verification.json();
        if (!verification.ok) {
          setErrorMessage(verificationData.title || 'Verification code is invalid or expired.');
          return;
        }
        setOtpVerified(true);
      }
      if (authForAi) {
        setAuthForAi(false);
        setStep(1);
        setErrorMessage('मोबाइल सत्यापित है। AI सुझाव प्राप्त करने के लिए आगे बढ़ें।');
        return;
      }
      const complaintPayload = {
        title: description.slice(0, 70),
        description,
        citizenPhone,
        citizenName,
        submissionType,
        ...(selectedDept ? { departmentId: selectedDept } : {}),
        ...(selectedCat ? { categoryId: selectedCat } : {}),
        districtId,
        villageOrTehsil,
        urgency: selectedUrgency,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        sourceChannel: getComplaintSourceChannel(usedVoice),
        attachments: mockPhotoName ? [{ fileName: mockPhotoName, url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600' }] : []
      };
      const fingerprint = JSON.stringify(complaintPayload);
      const requestKey = getStableRequestKey(
        lastSubmissionRef.current,
        fingerprint,
        `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      lastSubmissionRef.current = requestKey;
      const res = await fetch('/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': requestKey.key
        },
        body: JSON.stringify(complaintPayload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCreatedTicket(data.ticketNo);
        setStep(5); // Success step
      } else {
        setErrorMessage(data.title || 'शिकायत दर्ज करने में विफल');
      }
    } catch {
      setErrorMessage('सर्वर से संपर्क करने में असमर्थ। कृपया पुनः प्रयास करें।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Stepper Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span className={step >= 1 ? 'text-brand-700 font-bold' : ''}>1. समस्या विवरण</span>
          <span className={step >= 2 ? 'text-brand-700 font-bold' : ''}>2. AI सुझाव</span>
          <span className={step >= 3 ? 'text-brand-700 font-bold' : ''}>3. स्थान</span>
          <span className={step >= 4 ? 'text-brand-700 font-bold' : ''}>4. प्रमाण & OTP</span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-brand-600 h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Describe */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mic className="w-5 h-5 text-brand-600" />
              <span>अपनी समस्या बोलकर या लिखकर बताएं</span>
            </h2>
            <p className="text-xs text-slate-500">
              अपनी भाषा (हिंदी / अंग्रेजी) में समस्या का वर्णन करें। AI स्वतः सही विभाग चुन लेगा।
            </p>
          </div>

          {/* Voice Mic Trigger */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
            <button
              type="button"
              onClick={startVoiceRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse scale-105 shadow-red-500/50'
                  : 'bg-brand-600 hover:bg-brand-700 text-white hover:scale-105 shadow-brand-500/40'
              }`}
              aria-label={isRecording ? 'रिकॉर्डिंग रोकें (Stop recording)' : 'बोलना शुरू करें (Start recording)'}
              aria-pressed={isRecording}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-800">
                {isRecording ? 'सुन रहे हैं... कृपया बोलें' : 'बोलने के लिए माइक दबाएं (Tap to Speak)'}
              </div>
              <div className="text-xs text-slate-500">
                पहाड़ी व ग्रामीण क्षेत्रों हेतु विशेष वॉयस इनपुट सपोर्ट
              </div>
            </div>
            {voiceNotice && (
              <div role="status" className="text-xs text-brand-700 font-medium bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                {voiceNotice}
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              समस्या का लिखित विवरण (Grievance Description)
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="उदा. हमारे गांव में पिछले 4 दिनों से पानी की सप्लाई पूरी तरह बंद है..."
              className="w-full p-4 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Example Chips */}
          <div className="space-y-2">
            <span className="text-xs text-slate-500 font-medium">त्वरित उदाहरण चुनें:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDescription('गांव में 4 दिन से पीने का पानी नहीं आ रहा, पाइपलाइन लीकेज है।')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                💧 पेयजल किल्लत / लीकेज
              </button>
              <button
                type="button"
                onClick={() => setDescription('पहाड़ी मार्ग पर भूस्खलन का मलबा पड़ा है और गहरे गड्ढे हैं।')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                🛣️ सड़क पर मलबा / गड्ढे
              </button>
              <button
                type="button"
                onClick={() => setDescription('ट्रांसफार्मर फुंकने से 3 दिन से बिजली नहीं आ रही है।')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                ⚡ बिजली ट्रांसफार्मर खराब
              </button>
              <button
                type="button"
                onClick={() => setDescription('दाखिल खारिज आवेदन 25 दिन से पटवारी स्तर पर लंबित पड़ा है।')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                📄 दाखिला खारिज / पटवारी देरी
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={isClassifying}
              onClick={handleProceedToAI}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition shadow"
            >
              {isClassifying ? (
                <span>AI द्वारा विश्लेषण किया जा रहा है...</span>
              ) : (
                <>
                  <span>आगे बढ़ें (AI वर्गीकरण)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AI Suggestion & Duplicate Check */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>AI स्मार्ट सुझाव एवं विभाग निर्धारण</span>
            </h2>
            <p className="text-xs text-slate-500">
              सिस्टम ने आपके विवरण के आधार पर सही विभाग व श्रेणी का चयन किया है। आवश्यकतानुसार बदलाव कर सकते हैं।
            </p>
          </div>

          {/* Emergency Alert if triggered */}
          {aiResult?.isEmergency && (
            <div className="p-4 rounded-xl bg-red-100 border border-red-300 text-red-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 animate-bounce" />
              <span>{aiResult.emergencyNotice}</span>
            </div>
          )}

          {/* Duplicate Detection Alert if match found */}
          {duplicateMatch && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>समान समस्या पहले से दर्ज है (Similar Existing Issue)</span>
              </div>
              <p className="text-xs">
                आपके क्षेत्र में इस विषय पर पहले ही टिकट <strong className="underline">{duplicateMatch.ticketNo}</strong> दर्ज है ({duplicateMatch.supportersCount} समर्थक नागरिक)।
              </p>
            </div>
          )}

          {/* AI Summary card */}
          {aiResult && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 font-medium">
                <span>AI सारांश (विश्वास स्कोर: {Math.round(aiResult.confidence * 100)}%)</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                  सत्यापित
                </span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{aiResult.summaryHi}</div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="submission-type" className="text-xs font-semibold text-slate-700">Submission type</label>
            <select id="submission-type" value={submissionType} onChange={e => setSubmissionType(e.target.value as typeof submissionType)} className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white">
              <option value="GRIEVANCE">Grievance / शिकायत</option>
              <option value="DEMAND">Demand / मांग</option>
              <option value="SUGGESTION">Suggestion / सुझाव</option>
            </select>
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <label htmlFor="department" className="text-xs font-semibold text-slate-700">विभाग (Department)</label>
            <select
              id="department"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white"
            >
              <option value="">विभाग चुनें</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameHi} ({d.nameEn})
                </option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label htmlFor="category" className="text-xs font-semibold text-slate-700">समस्या श्रेणी (Category)</label>
            <select
              id="category"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white"
            >
              <option value="">श्रेणी चुनें</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameHi} - SLA: {c.slaResolutionHours / 24} दिन
                </option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">प्राथमिकता / गंभीरता (Urgency)</label>
            <div role="group" aria-label="प्राथमिकता / Urgency" className="grid grid-cols-3 gap-3">
              {(['LOW', 'NORMAL', 'HIGH'] as const).map((u) => (
                <button
                  type="button"
                  key={u}
                  onClick={() => setSelectedUrgency(u)}
                  aria-pressed={selectedUrgency === u}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    selectedUrgency === u
                      ? 'bg-brand-600 text-white border-brand-600 shadow'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {u === 'HIGH' ? '🔴 उच्च (High)' : u === 'NORMAL' ? '🟡 सामान्य (Normal)' : '🟢 सामान्य सूचना (Low)'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" /> वापस
            </button>
            <button
              type="button"
              onClick={() => setStep(authForAi ? 1 : 3)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition shadow"
            >
              <span>स्थान चुनें</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Location */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>समस्या स्थल का स्थान (Location Details)</span>
            </h2>
            <p className="text-xs text-slate-500">
              जिला एवं तहसील/गांव चुनें ताकि सही क्षेत्रीय अधिकारी को स्वतः भेजा जा सके।
            </p>
          </div>

          {/* District Dropdown */}
          <div className="space-y-2">
            <label htmlFor="district" className="text-xs font-semibold text-slate-700">उत्तराखंड का जिला (District)</label>
            <select
              id="district"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white"
            >
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameHi} ({d.nameEn})
                </option>
              ))}
            </select>
          </div>

          {/* Tehsil / Village */}
          <div className="space-y-2">
            <label htmlFor="village-or-tehsil" className="text-xs font-semibold text-slate-700">तहसील / ब्लॉक / गांव / निकटतम लैंडमार्क</label>
            <input
              id="village-or-tehsil"
              type="text"
              value={villageOrTehsil}
              onChange={(e) => setVillageOrTehsil(e.target.value)}
              placeholder="उदा. रानीखेत बाजार, वार्ड नं 4, मुख्य डाकघर के पास..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
            />
          </div>

          {/* GPS Pin */}
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
            <div className="text-xs text-emerald-900">
              <div className="font-bold">जीपीएस लोकेशन (वैकल्पिक)</div>
              <div>{gpsLocation ? `Latitude: ${gpsLocation.lat.toFixed(4)}, Longitude: ${gpsLocation.lng.toFixed(4)}` : 'मौके पर मौजूद हैं तो सटीक पिन जोड़ें'}</div>
            </div>
            <button
              type="button"
              onClick={captureGps}
              aria-label={gpsLocation ? 'लोकेशन फिर से प्राप्त करें' : 'GPS लोकेशन प्राप्त करें'}
              disabled={gpsNotice === 'लोकेशन प्राप्त की जा रही है…'}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg transition"
            >
              {gpsLocation ? 'लोकेशन सेव है' : 'GPS लोकेशन जोड़ें'}
            </button>
          </div>
          {gpsNotice && <p role="status" className="text-xs text-emerald-800">{gpsNotice}</p>}

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" /> वापस
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition shadow"
            >
              <span>प्रमाण & सत्यापन</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Proof & OTP Verification */}
      {step === 4 && (
        <form onSubmit={handleFinalSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <span>प्रमाण फोटो एवं मोबाइल सत्यापन (OTP)</span>
            </h2>
            <p className="text-xs text-slate-500">
              शिकायत दर्ज करने हेतु अपना मोबाइल नंबर सत्यापित करें ताकि एसएमएस पर अपडेट प्राप्त हो सकें।
            </p>
          </div>

          {/* Photo upload simulator */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-500" />
              <span>फोटो या दस्तावेज संलग्न करें (वैकल्पिक)</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMockPhotoName('site_photo_potholes_or_pipeline.jpg')}
                className="text-xs bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-medium"
              >
                📸 फोटो अपलोड करें (कैमरा / गैलरी)
              </button>
              {mockPhotoName && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {mockPhotoName}
                </span>
              )}
            </div>
          </div>

          {/* Citizen Name */}
          <div className="space-y-2">
            <label htmlFor="citizen-name" className="text-xs font-semibold text-slate-700">नागरिक का नाम (Citizen Name)</label>
            <input
              id="citizen-name"
              type="text"
              value={citizenName}
              onChange={(e) => setCitizenName(e.target.value)}
              placeholder="आपका पूरा नाम"
              className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
            />
          </div>

          {/* Citizen Phone & OTP */}
          <div className="space-y-2">
            <label htmlFor="citizen-phone" className="text-xs font-semibold text-slate-700">मोबाइल नंबर (10 अंक)</label>
            <div className="flex gap-2">
              <input
                id="citizen-phone"
                type="tel"
                maxLength={10}
                value={citizenPhone}
                onChange={(e) => {
                  const nextPhone = e.target.value;
                  setCitizenPhone(nextPhone);
                  setOtpVerified(false);
                  setOtpSent(false);
                  setOtpCode('');
                }}
                placeholder="उदा. 9897001122"
                className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSubmitting}
                className="whitespace-nowrap px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
              >
                {otpSent ? 'OTP पुनः भेजें' : 'OTP भेजें'}
              </button>
            </div>
          </div>

          {otpSent && (
            <div className="space-y-2 bg-brand-50 p-4 rounded-xl border border-brand-200">
              <label htmlFor="otp-code" className="text-xs font-semibold text-brand-900">
                प्राप्त 6 अंकों का OTP दर्ज करें
              </label>
              <input
                id="otp-code"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="______"
                className="w-full p-3 rounded-xl border border-brand-300 text-slate-900 text-base font-mono tracking-widest text-center bg-white"
              />
            </div>
          )}

          {/* DPDP Consent */}
          <div className="flex items-start gap-2 text-xs text-slate-500 pt-2">
            <input type="checkbox" defaultChecked required className="mt-0.5" id="consent" />
            <label htmlFor="consent">
              मैं प्रमाणित करता/करती हूँ कि दी गई जानकारी सत्य है एवं DPDP अधिनियम 2023 के तहत केवल शिकायत निवारण के उद्देश्य से मेरे मोबाइल पर संपर्क की सहमति देता/देती हूँ।
            </label>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" /> वापस
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg text-sm"
            >
              {isSubmitting ? (
                <span>शिकायत दर्ज की जा रही है...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{authForAi ? 'मोबाइल सत्यापित करके आगे बढ़ें' : 'शिकायत अंतिम रूप से सबमिट करें'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 5: Success Screen with Ticket & Tracking CTA */}
      {step === 5 && createdTicket && (
        <div className="bg-white rounded-2xl p-8 border border-emerald-200 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">शिकायत सफलतापूर्वक दर्ज!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              आपकी समस्या का पंजीकरण हो चुका है एवं नोडल अधिकारी को समय-सीमा के साथ सौंप दिया गया है। एसएमएस द्वारा सूचना भेज दी गई है।
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-w-md mx-auto space-y-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">आपकी शिकायत क्रमांक (Ticket No)</span>
            <div className="text-3xl font-mono font-extrabold text-brand-700 tracking-wider flex items-center justify-center gap-2">
              <span>{createdTicket}</span>
              <button
                onClick={() => navigator.clipboard.writeText(createdTicket)}
                className="text-slate-400 hover:text-slate-700"
                title="Copy Ticket"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-emerald-600 font-semibold pt-1">
              ✓ लेवल 1 अधिकारी को आवंटित (SLA प्रारंभ)
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <button
              onClick={() => router.push(`/track?ticket=${createdTicket}`)}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition shadow flex items-center justify-center gap-2 text-sm"
            >
              <span>लाइव स्थिति ट्रैक करें (Track Progress)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setStep(1);
                setDescription('');
                setCreatedTicket(null);
              }}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition text-sm"
            >
              अन्य शिकायत दर्ज करें
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function FileComplaintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <FileComplaintPageInner />
    </Suspense>
  );
}
