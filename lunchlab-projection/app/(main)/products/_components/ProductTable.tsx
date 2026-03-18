import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import type { ProductWithMappings } from "@/types";

interface Props {
  products: ProductWithMappings[];
  onEdit: (p: ProductWithMappings) => void;
  onDelete: (id: number) => void;
}

export function ProductTable({ products, onEdit, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">색상</TableHead>
          <TableHead>상품명</TableHead>
          <TableHead>산출기준일</TableHead>
          <TableHead>알림 그룹</TableHead>
          <TableHead>ID 매핑</TableHead>
          <TableHead className="w-24">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <span
                className="inline-block w-5 h-5 rounded-full border shadow-sm"
                style={{ backgroundColor: p.color || "#818cf8" }}
                title={p.color}
              />
            </TableCell>
            <TableCell className="font-medium">{p.product_name}</TableCell>
            <TableCell>D+{p.offset_days}</TableCell>
            <TableCell>{p.notification_group || <span className="text-muted-foreground">-</span>}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {(p.mappings ?? []).map((m) => (
                  <Badge key={m.id} variant="secondary">{m.channel}: {m.external_id}</Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {products.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8">
              <p className="text-muted-foreground">등록된 상품이 없습니다</p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
