import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TenantSetup from './TenantSetup';
import AzureSetup from './AzureSetup';
import ConsentStep from './ConsentStep';
import FirstSync from './FirstSync';

const STEPS = ['tenant', 'azure', 'consent', 'sync'];
const STEP_TITLES = {
  tenant: 'Tenant Setup',
  azure: 'Azure Configuration',
  consent: 'Admin Consent',
  sync: 'Initial Sync'
};

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [tenant, setTenant] = useState(null);
  const [consentStatus, setConsentStatus] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle consent callback from Azure
  useEffect(() => {
    const consent = searchParams.get('consent');
    if (consent) {
      setConsentStatus(consent);

      // If consent was successful, move to the sync step
      if (consent === 'success') {
        setCurrentStep(3); // Move to sync step
        // Clear the query params
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams]);

  function renderProgressBar() {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  index < currentStep
                    ? 'bg-success text-white'
                    : index === currentStep
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-success' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`text-sm font-medium ${
                index === currentStep ? 'text-primary' : 'text-gray-500'
              }`}
              style={{ flex: 1, textAlign: index === 0 ? 'left' : index === STEPS.length - 1 ? 'right' : 'center' }}
            >
              {STEP_TITLES[step]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStep() {
    switch (STEPS[currentStep]) {
      case 'tenant':
        return (
          <TenantSetup
            onComplete={(newTenant) => {
              setTenant(newTenant);
              setCurrentStep(1);
            }}
          />
        );
      case 'azure':
        return (
          <AzureSetup
            tenant={tenant}
            onComplete={() => setCurrentStep(2)}
          />
        );
      case 'consent':
        return (
          <ConsentStep
            tenant={tenant}
            consentStatus={consentStatus}
            onComplete={() => setCurrentStep(3)}
          />
        );
      case 'sync':
        return (
          <FirstSync
            tenant={tenant}
            onComplete={() => navigate('/dashboard')}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to M365 Tenant Manager</h1>
          <p className="text-gray-600 mt-2">Let's get your tenant connected</p>
        </div>

        {renderProgressBar()}
        {renderStep()}
      </div>
    </div>
  );
}
