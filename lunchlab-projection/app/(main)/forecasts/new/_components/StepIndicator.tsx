import { ArrowRight, Check } from "lucide-react";

const STEP_LABELS = ["대상 지정", "수량 산출", "알림 발송", "완료"];

interface Props {
  currentStep: number;
}

export function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const s = i + 1;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${currentStep >= s ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {s < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        );
      })}
    </div>
  );
}
