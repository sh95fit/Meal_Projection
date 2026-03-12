"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialog } from "./_components/ProductDialog";
import { useProducts } from "./_hooks/useProducts";

export default function ProductsPage() {
  const h = useProducts();

  if (h.loading) {
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
        <Button onClick={h.openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />상품 등록
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>등록된 상품</CardTitle></CardHeader>
        <CardContent>
          <ProductTable products={h.products} onEdit={h.openEditDialog} onDelete={h.handleDelete} />
        </CardContent>
      </Card>

      <ProductDialog
        open={h.dialogOpen} onOpenChange={h.setDialogOpen}
        editingProduct={h.editingProduct}
        productName={h.productName} onProductNameChange={h.setProductName}
        offsetDays={h.offsetDays} onOffsetDaysChange={h.setOffsetDays}
        notificationGroup={h.notificationGroup} onNotificationGroupChange={h.setNotificationGroup}
        mappings={h.mappings}
        onAddMapping={h.addMapping} onRemoveMapping={h.removeMapping} onUpdateMapping={h.updateMapping}
        onSubmit={h.handleSubmit}
      />
    </div>
  );
}
