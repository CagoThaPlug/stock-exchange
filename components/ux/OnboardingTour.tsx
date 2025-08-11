'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export function OnboardingTour() {
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const tourSteps: TourStep[] = [
    {
      target: '.market-overview',
      title: 'Market Overview',
      content: 'Get real-time updates on major market indices and overall market sentiment.',
      position: 'bottom'
    },
    {
      target: '.stock-search',
      title: 'Stock Search',
      content: 'Search for any stock and get detailed analysis with interactive charts.',
      position: 'bottom'
    },
    {
      target: '.ai-chat-container',
      title: 'AI Assistant',
      content: 'Ask our AI anything about stocks, market trends, or trading strategies!',
      position: 'left'
    },
    {
      target: '[title="Toggle Theme"]',
      title: 'Customization',
      content: 'Switch between light and dark modes, and customize your experience.',
      position: 'bottom'
    }
  ];

  useEffect(() => {
    const tourCompleted = localStorage.getItem('zalc-tour-completed');
    if (!tourCompleted) {
      // Show tour after a short delay
      setTimeout(() => setShowTour(true), 2000);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem('zalc-tour-completed', 'true');
    setShowTour(false);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    completeTour();
  };

  if (!showTour) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-none" />
      
      {/* Tour Card */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 gradient-market rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{currentStep + 1}</span>
                </div>
                <h3 className="font-semibold">{currentTourStep.title}</h3>
              </div>
              <button
                onClick={skipTour}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {currentTourStep.content}
            </p>

            {/* Progress */}
            <div className="flex space-x-1 mb-6">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full flex-1 ${
                    index <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={skipTour}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip tour
              </button>
              
              <div className="flex space-x-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="flex items-center space-x-1 px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                )}
                
                <button
                  onClick={nextStep}
                  className="flex items-center space-x-1 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                >
                  <span>{currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}</span>
                  {currentStep !== tourSteps.length - 1 && <ArrowRight className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}