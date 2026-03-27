// app/(main)/forecasts/new/page.tsx
"use client";

import { StepIndicator } from "./_components/StepIndicator";
import { StepTargets } from "./_components/StepTargets";
import { StepCalculation } from "./_components/StepCalculation";
import { StepNotification } from "./_components/StepNotification";
import { StepComplete } from "./_components/StepComplete";
import { useForecastNew } from "./_hooks/useForecastNew";

export default function ForecastNewPage() {
  const hook = useForecastNew();
  const {
    step, products, targets,
    completedForecasts,
    addTarget, updateTarget, removeTarget, startStep2,
    sendNotifications, resetAll,
  } = hook;

  return (
    <div className="space-y-4 lg:space-y-6 max-w-7xl">
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <StepTargets
          targets={targets}
          products={products}
          onAddTarget={addTarget}
          onUpdateTarget={updateTarget}
          onRemoveTarget={removeTarget}
          onNext={startStep2}
        />
      )}

      {step === 2 && <StepCalculation hook={hook} />}

      {step === 3 && (
        <StepNotification
          completedForecasts={completedForecasts}
          onSend={sendNotifications}
        />
      )}

      {step === 4 && <StepComplete onReset={resetAll} />}
    </div>
  );
}
