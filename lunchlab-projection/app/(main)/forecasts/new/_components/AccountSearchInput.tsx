import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { useAccountSearch } from "../_hooks/useAccountSearch";

interface SearchableAccount {
  account_id: number;
  고객사명: string;
}

interface Props {
  accounts: SearchableAccount[];
  onQueryChange: (query: string) => void;
}

export function AccountSearchInput({ accounts, onQueryChange }: Props) {
  const {
    query,
    suggestions,
    isOpen,
    highlightIndex,
    wrapperRef,
    handleChange,
    handleSelect,
    handleClear,
    handleKeyDown,
  } = useAccountSearch(accounts);

  // 부모(UnorderedTable)의 필터에도 반영
  const onChange = (value: string) => {
    handleChange(value);
    onQueryChange(value);
  };

  const onSelect = (name: string) => {
    handleSelect(name);
    onQueryChange(name);
  };

  const onClear = () => {
    handleClear();
    onQueryChange("");
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[200px] max-w-[300px]">
      {/* 검색 아이콘 */}
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

      {/* 입력 필드 */}
      <Input
        placeholder="고객사명 검색..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (query.length > 0) handleChange(query);
        }}
        className="pl-8 pr-8 h-9"
      />

      {/* 초기화 버튼 */}
      {query && (
        <button
          onClick={onClear}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* 자동완성 드롭다운 */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-auto">
          {suggestions.map((account, idx) => (
            <button
              key={account.account_id}
              onClick={() => onSelect(account.고객사명)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted ${
                idx === highlightIndex ? "bg-muted" : ""
              }`}
            >
              <span>
                {/* 검색어 부분 하이라이트 */}
                {highlightMatch(account.고객사명, query)}
              </span>
              {/* <Badge variant="secondary" className="text-xs ml-2">
                {account.account_id}
              </Badge> */}
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {isOpen && query.length > 0 && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50">
          <p className="px-3 py-2 text-sm text-muted-foreground">
            일치하는 고객사가 없습니다
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 검색어와 일치하는 부분을 굵게 표시
 * "ABC물류" 에서 "BC" 검색 시 → A<b>BC</b>물류
 */
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <span className="font-semibold text-primary">{match}</span>
      {after}
    </>
  );
}
