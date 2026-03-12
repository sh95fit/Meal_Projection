"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface SearchableAccount {
  account_id: number;
  고객사명: string;
}

export function useAccountSearch(accounts: SearchableAccount[]) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 입력값에 맞는 후보 목록 (최대 8개)
  const suggestions = useMemo(() => {
    if (query.length === 0) return [];
    const lower = query.toLowerCase();
    return accounts
      .filter((a) => a.고객사명.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [query, accounts]);

  // 입력 변경
  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setIsOpen(value.length > 0);
    setHighlightIndex(-1);
  }, []);

  // 후보 선택
  const handleSelect = useCallback((accountName: string) => {
    setQuery(accountName);
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  // 검색 초기화
  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0) {
            handleSelect(suggestions[highlightIndex].고객사명);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, highlightIndex, handleSelect]
  );

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    query,
    suggestions,
    isOpen,
    highlightIndex,
    wrapperRef,
    handleChange,
    handleSelect,
    handleClear,
    handleKeyDown,
  };
}
