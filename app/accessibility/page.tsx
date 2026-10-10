import React from 'react';
import { ShieldCheck, Eye, Sparkles, Volume2, Contrast, Keyboard } from 'lucide-react';

export default function AccessibilityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-semibold border border-brand-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>सुगम्यता एवं समावेशी सेवा विवरण (Accessibility Statement)</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">
          सुगम्यता नीति एवं मानक (WCAG 2.2 AA & GIGW 3.0)
        </h1>
        <p className="text-sm text-slate-500">
          उत्तराखंड के सभी नागरिकों, दिव्यांगजनों एवं दूरस्थ पर्वतीय क्षेत्रों के निवासियों हेतु समावेशी डिजिटल अनुभव।
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-brand-600" />
            <span>1. आवाज-आधारित शिकायत पंजीकरण (Voice-First Access)</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            कम साक्षरता अथवा दृष्टिबाधित नागरिकों के लिए बड़े माइक बटन एवं वॉयस इनपुट की सुविधा दी गई है। नागरिक अपनी बोली/भाषा में बोलकर समस्या दर्ज कर सकते हैं।
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Contrast className="w-5 h-5 text-amber-600" />
            <span>2. उच्च कंट्रास्ट एवं फॉन्ट आकार नियंत्रण (A- / A / A+)</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            शीर्ष नेविगेशन बार में उच्च कंट्रास्ट (High Contrast) तथा फॉन्ट साइज को घटाने/बढ़ाने के नियंत्रण दिए गए हैं ताकि कम दृष्टि वाले नागरिक सहजता से पढ़ सकें। सभी टेक्स्ट 4.5:1 कंट्रास्ट अनुपात का पालन करते हैं।
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-emerald-600" />
            <span>3. कीबोर्ड नेविगेशन एवं स्क्रीन रीडर अनुकूलता</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            पोर्टल पूर्णतः कीबोर्ड टैब (Tab, Shift+Tab, Enter) द्वारा संचालित किया जा सकता है। इसमें कोई कीबोर्ड ट्रैप नहीं है। सभी फॉर्म इनपुट्स में स्पष्ट लेबल्स और ARIA लाइव रीजन जोड़े गए हैं।
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <span>4. डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP Act 2023)</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            नागरिकों का मोबाइल नंबर एवं डेटा केवल समस्या निवारण के उद्देश्य से सुरक्षित रखा जाता है। कोई आधार नंबर या अनावश्यक व्यक्तिगत विवरण नहीं मांगा जाता।
          </p>
        </section>
      </div>
    </div>
  );
}
