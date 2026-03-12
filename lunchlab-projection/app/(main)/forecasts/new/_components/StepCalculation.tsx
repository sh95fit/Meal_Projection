import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateWithDay } from "@/lib/utils";
import { SummaryCards } from "./SummaryCards";
import { ConditionMetTable } from "./ConditionMetTable";
import { ConditionNotMetTable } from "./ConditionNotMetTable";
import { UnorderedTable } from "./UnorderedTable";
import { ForecastTotalBar } from "./ForecastTotalBar";
import type { useForecastNew } from "../_hooks/useForecastNew";

type HookReturn = ReturnType<typeof useForecastNew>;

interface Props {
  hook: HookReturn;
}

export function StepCalculation({ hook }: Props) {
  const {
    currentTarget, currentTargetIndex, targets, step2Loading, summary,
    conditionMetRows, conditionNotMetRows, conditionNotMetDelta,
    filteredUnorderedRows, unorderedRows,
    searchQuery, includeFilter, recentOrderFilter,
    confirmedQty, additionalQty, unorderedAdditionalQty,
    bufferInput, bufferQty, totalForecastQty, isSubmitting,
    setSearchQuery, setIncludeFilter, setRecentOrderFilter,
    toggleIncluded, updateAdjustedQty, updateOrderAdjustedQty,
    handleBufferInputChange, handleBufferInputBlur, confirmForecast,
  } = hook;

  if (!currentTarget) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          STEP 2. 수량 산출 — {currentTarget.product.product_name}
          <span className="ml-3 text-base font-normal text-muted-foreground">
            출고일: <span className="font-semibold text-foreground">
              {formatDateWithDay(currentTarget.deliveryDate)}
            </span>
          </span>
        </h2>
        <Badge>{currentTargetIndex + 1} / {targets.length}</Badge>
      </div>

      {step2Loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">데이터를 불러오는 중...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {summary && <SummaryCards summary={summary} confirmedQty={confirmedQty} />}

          <ConditionMetTable rows={conditionMetRows} />

          <ConditionNotMetTable
            rows={conditionNotMetRows}
            conditionNotMetDelta={conditionNotMetDelta}
            onUpdateQty={updateOrderAdjustedQty}
          />

          <UnorderedTable
            allRows={unorderedRows}
            filteredRows={filteredUnorderedRows}
            searchQuery={searchQuery}
            includeFilter={includeFilter}
            recentOrderFilter={recentOrderFilter}
            onSearchChange={setSearchQuery}
            onIncludeFilterChange={setIncludeFilter}
            onRecentOrderFilterChange={setRecentOrderFilter}
            onToggleIncluded={toggleIncluded}
            onUpdateQty={updateAdjustedQty}
          />

          <ForecastTotalBar
            confirmedQty={confirmedQty}
            additionalQty={additionalQty}
            unorderedAdditionalQty={unorderedAdditionalQty}
            conditionNotMetDelta={conditionNotMetDelta}
            bufferInput={bufferInput}
            bufferQty={bufferQty}
            totalForecastQty={totalForecastQty}
            isSubmitting={isSubmitting}
            onBufferInputChange={handleBufferInputChange}
            onBufferInputBlur={handleBufferInputBlur}
            onConfirm={confirmForecast}
          />
        </>
      )}
    </div>
  );
}
