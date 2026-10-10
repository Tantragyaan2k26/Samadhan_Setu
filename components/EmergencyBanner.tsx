'use client';

import React, { useState } from 'react';
import { AlertTriangle, PhoneCall, X } from 'lucide-react';

export default function EmergencyBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs sm:text-sm text-red-900">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>
            <strong className="font-bold">आपातकालीन सूचना:</strong> यदि प्राकृतिक आपदा, भूस्खलन में फंसे होने, गंभीर आग या जीवन-रक्षक चिकित्सा की तात्कालिक आवश्यकता है, तो शिकायत दर्ज करने की प्रतीक्षा न करें—तत्काल{' '}
            <a href="tel:112" className="underline font-bold text-red-700 inline-flex items-center gap-0.5">
              <PhoneCall className="w-3 h-3 inline" /> 112 डायल करें
            </a>
            ।
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-500 hover:text-red-800 p-1"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
