'use client';

import { useState } from 'react';
import { Shield, Eye, Lock, AlertTriangle, X } from 'lucide-react';

export function ComplianceNotice() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zalc-compliance-dismissed') === 'true';
    }
    return false;
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('zalc-compliance-dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🔒 Privacy-First Stock Analysis Platform
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3 leading-relaxed">
              This application operates entirely in your browser. We don't collect, store, or transmit any personal data. 
              All preferences and watchlists are stored locally on your device.
            </p>

            {!isExpanded ? (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View detailed privacy & legal information →
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/50 dark:bg-blue-900/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Eye className="w-4 h-4 text-green-600" />
                      <strong className="text-blue-900 dark:text-blue-100">What we do:</strong>
                    </div>
                    <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                      <li>• Store preferences locally</li>
                      <li>• Cache market data in browser</li>
                      <li>• Provide AI insights</li>
                      <li>• Enable voice commands</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/50 dark:bg-blue-900/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Lock className="w-4 h-4 text-red-600" />
                      <strong className="text-blue-900 dark:text-blue-100">What we don't do:</strong>
                    </div>
                    <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                      <li>• Track your activity</li>
                      <li>• Store personal data</li>
                      <li>• Use tracking cookies</li>
                      <li>• Share data with third parties</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/50 dark:bg-blue-900/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <strong className="text-blue-900 dark:text-blue-100">Legal Notice:</strong>
                    </div>
                    <p className="text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
                      For informational purposes only. Not financial advice. 
                      Trade responsibly and verify all data independently.
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    ⚠️ IMPORTANT FINANCIAL DISCLAIMER
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    This application provides general market information and AI-generated insights for educational purposes only. 
                    Nothing here constitutes financial, investment, trading, or other advice. All trading and investment decisions 
                    are made at your own risk. Market data may be delayed or inaccurate. AI responses are generated and may contain 
                    errors. Past performance does not guarantee future results.
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ← Show less
                </button>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 p-1"
          title="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}