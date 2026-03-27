// app/(main)/forecasts/new/_components/StepIndicator.tsx
import { ArrowRight, Check } from "lucide-react";

const STEP_LABELS = ["대상 지정", "수량 산출", "알림 발송", "완료"];

interface Props {
  currentStep: number;
}

export function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-0.5 lg:gap-2">
      {STEP_LABELS.map((label, i) => {
        const s = i + 1;
        const isActive = currentStep >= s;
        return (
          <div key={s} className="flex items-center gap-0.5 lg:gap-2">
            <div
              className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[10px] lg:text-sm font-medium shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > s ? <Check className="h-3 w-3 lg:h-4 lg:w-4" /> : s}
            </div>
            <span
              className={`text-[10px] lg:text-sm whitespace-nowrap ${
                isActive ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {s < 4 && (
              <ArrowRight className="h-2.5 w-2.5 lg:h-4 lg:w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
