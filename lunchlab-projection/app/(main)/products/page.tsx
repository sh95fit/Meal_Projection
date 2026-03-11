"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ProductWithMappings } from "@/types";

interface MappingInput {
  channel: "web" | "app";
  external_id: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithMappings[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithMappings | null>(null);

  // 폼 상태
  const [productName, setProductName] = useState("");
  const [offsetDays, setOffsetDays] = useState(3);
  const [notificationGroup, setNotificationGroup] = useState("");
  const [mappings, setMappings] = useState<MappingInput[]>([]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      toast.error("상품 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setProductName("");
    setOffsetDays(3);
    setNotificationGroup("");
    setMappings([]);
    setEditingProduct(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (product: ProductWithMappings) => {
    setEditingProduct(product);
    setProductName(product.product_name);
    setOffsetDays(product.offset_days);
    setNotificationGroup(product.notification_group || "");
    setMappings(
      product.mappings.map((m) => ({
        channel: m.channel,
        external_id: m.external_id,
      }))
    );
    setDialogOpen(true);
  };

  const addMapping = () => {
    setMappings([...mappings, { channel: "web", external_id: "" }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (
    index: number,
    field: keyof MappingInput,
    value: string
  ) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const handleSubmit = async () => {
    if (!productName.trim()) {
      toast.error("상품명을 입력해주세요.");
      return;
    }

    const payload = {
      product_name: productName,
      offset_days: offsetDays,
      notification_group: notificationGroup || null,
      mappings: mappings.filter((m) => m.external_id.trim()),
    };

    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("상품이 수정되었습니다.");
      } else {
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("상품이 등록되었습니다.");
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch {
      toast.error("저장에 실패했습니다.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      toast.success("상품이 삭제되었습니다.");
      fetchProducts();
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              상품 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "상품 수정" : "상품 등록"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>상품명</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: 가정식 도시락"
                />
              </div>
              <div className="space-y-2">
                <Label>산출기준일 (D+N)</Label>
                <Input
                  type="number"
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(parseInt(e.target.value) || 0)}
                  min={1}
                />
                <p className="text-xs text-muted-foreground">
                  산출일 기준 N일 후가 출고일이 됩니다
                </p>
              </div>
              <div className="space-y-2">
                <Label>알림 그룹 (선택)</Label>
                <Input
                  value={notificationGroup}
                  onChange={(e) => setNotificationGroup(e.target.value)}
                  placeholder="예: 가정식"
                />
                <p className="text-xs text-muted-foreground">
                  같은 그룹의 상품은 하나의 알림으로 합산 발송됩니다
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>상품 ID 매핑</Label>
                  <p className="text-xs text-muted-foreground">
                    비즈옵스팀에 문의해주세요 (수정 금지)
                  </p>
                  <Button variant="outline" size="sm" onClick={addMapping}>
                    <Plus className="mr-1 h-3 w-3" />
                    추가
                  </Button>
                </div>
                {mappings.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={m.channel}
                      onValueChange={(v) =>
                        updateMapping(idx, "channel", v)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web">웹</SelectItem>
                        <SelectItem value="app">앱</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={m.external_id}
                      onChange={(e) =>
                        updateMapping(idx, "external_id", e.target.value)
                      }
                      placeholder="상품 ID"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMapping(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {mappings.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    매핑을 추가하세요
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleSubmit}>
                {editingProduct ? "수정" : "등록"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>등록된 상품</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품명</TableHead>
                <TableHead>산출기준일</TableHead>
                <TableHead>알림 그룹</TableHead>
                <TableHead>ID 매핑</TableHead>
                <TableHead className="w-24">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.product_name}
                  </TableCell>
                  <TableCell>D+{product.offset_days}</TableCell>
                  <TableCell>
                    {product.notification_group || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.mappings.map((m) => (
                        <Badge key={m.id} variant="secondary">
                          {m.channel}: {m.external_id}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-muted-foreground">
                      등록된 상품이 없습니다
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
