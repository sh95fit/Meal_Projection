// ──────────────────────────────────────────────────────────────────
// app/(main)/products/_components/ProductColorPicker.tsx
// 상품 색상 선택기 — react-colorful 기반 풀 팔레트
// ──────────────────────────────────────────────────────────────────
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { PRESET_COLORS } from "@/lib/utils/color";

interface ProductColorPickerProps {
  /** 현재 선택된 색상 (hex) */
  value: string;
  /** 색상 변경 콜백 */
  onChange: (color: string) => void;
}

export default function ProductColorPicker({
  value,
  onChange,
}: ProductColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── 외부 클릭 시 닫기 ──
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClickOutside]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">상품 색상</label>

      <div className="relative" ref={popoverRef}>
        {/* ── 트리거: 현재 색상 미리보기 ── */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 px-3 py-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors w-full"
        >
          <span
            className="w-8 h-8 rounded-md border shadow-sm shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm font-mono text-muted-foreground">
            {value}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {isOpen ? "▲" : "▼"}
          </span>
        </button>

        {/* ── 팝오버: 컬러 피커 ── */}
        {isOpen && (
          <div className="absolute z-50 mt-2 p-4 bg-popover border rounded-xl shadow-xl space-y-3 w-[260px]">
            {/* 풀 팔레트 피커 */}
            <HexColorPicker
              color={value}
              onChange={onChange}
              style={{ width: "100%", height: "160px" }}
            />

            {/* Hex 직접 입력 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">#</span>
              <HexColorInput
                color={value}
                onChange={onChange}
                className="flex-1 px-2 py-1.5 text-sm font-mono border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="aabbcc"
              />
              <span
                className="w-7 h-7 rounded-md border shadow-sm shrink-0"
                style={{ backgroundColor: value }}
              />
            </div>

            {/* 프리셋 바로가기 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">빠른 선택</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChange(preset)}
                    className={`w-6 h-6 rounded-md border transition-all ${
                      value.toLowerCase() === preset.toLowerCase()
                        ? "ring-2 ring-offset-1 ring-foreground/40 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
