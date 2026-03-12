import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UnorderedRow, IncludeFilter, RecentOrderFilter } from "../_hooks/useForecastNew";
import { AccountSearchInput } from "./AccountSearchInput";

interface Props {
  allRows: UnorderedRow[];
  filteredRows: UnorderedRow[];
  searchQuery: string;
  includeFilter: IncludeFilter;
  recentOrderFilter: RecentOrderFilter;
  onSearchChange: (v: string) => void;
  onIncludeFilterChange: (v: IncludeFilter) => void;
  onRecentOrderFilterChange: (v: RecentOrderFilter) => void;
  onToggleIncluded: (accountId: number) => void;
  onUpdateQty: (accountId: number, qty: number) => void;
}

export function UnorderedTable({
  allRows, filteredRows,
  searchQuery, includeFilter, recentOrderFilter,
  onSearchChange, onIncludeFilterChange, onRecentOrderFilterChange,
  onToggleIncluded, onUpdateQty,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            미주문 고객사 ({allRows.length}개사) — 수량 반영
          </CardTitle>
          <span className="text-sm text-muted-foreground">표시: {filteredRows.length}개사</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <AccountSearchInput
            accounts={allRows}
            onQueryChange={onSearchChange}
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">포함:</span>
            {([["all", "전체"], ["included", "포함"], ["excluded", "미포함"]] as const).map(([val, label]) => (
              <Badge
                key={val}
                variant={includeFilter === val ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => onIncludeFilterChange(val)}
              >{label}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">최근주문:</span>
            {([["all", "전체"], ["has", "있음"], ["none", "없음"]] as const).map(([val, label]) => (
              <Badge
                key={val}
                variant={recentOrderFilter === val ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => onRecentOrderFilterChange(val)}
              >{label}</Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] overflow-auto">
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 sticky left-0 bg-background z-30">포함</TableHead>
                <TableHead className="sticky left-12 bg-background z-30 min-w-[120px]">고객사명</TableHead>
                <TableHead className="text-center min-w-[52px]">해당</TableHead>
                <TableHead className="text-right min-w-[64px]">전체<br />평균</TableHead>
                <TableHead className="text-right min-w-[64px]">전체<br />중간값</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />전체평균</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />전체중간</TableHead>
                <TableHead className="text-right min-w-[64px]">요일<br />평균</TableHead>
                <TableHead className="text-right min-w-[64px]">요일<br />중간값</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />요일평균</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />요일중간</TableHead>
                <TableHead className="text-right min-w-[80px]">최근 주문</TableHead>
                <TableHead className="text-right min-w-[48px]">주문<br />횟수</TableHead>
                <TableHead className="text-right min-w-[88px] sticky right-0 bg-background z-30">반영 수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.account_id} className={row.is_included ? "" : "opacity-40"}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <Checkbox checked={row.is_included} onCheckedChange={() => onToggleIncluded(row.account_id)} />
                  </TableCell>
                  <TableCell className="font-medium sticky left-12 bg-background z-10">{row.고객사명}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={row.주문요일_해당여부 === "포함" ? "default" : "secondary"} className="text-xs">
                      {row.주문요일_해당여부}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.전체_평균}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.전체_중간값}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.상품_전체_평균}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.상품_전체_중간값}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.요일별_평균}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.요일별_중간값}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-semibold">{row.상품_요일별_평균}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-semibold">{row.상품_요일별_중간값}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.해당요일_최근주문일자 || "-"}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{row.해당요일_주문횟수}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-background z-10">
                    <Input
                      type="number"
                      className="w-20 text-right h-8 text-sm"
                      value={row.adjusted_qty}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        onUpdateQty(row.account_id, isNaN(parsed) ? 0 : parsed);
                      }}
                      disabled={!row.is_included}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-6">
                    <p className="text-muted-foreground text-sm">
                      {searchQuery || includeFilter !== "all" || recentOrderFilter !== "all"
                        ? "필터 조건에 맞는 고객사가 없습니다."
                        : "미주문 고객사가 없습니다."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
