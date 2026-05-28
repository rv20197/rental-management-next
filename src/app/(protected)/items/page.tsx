'use client';

import React, { useState, useMemo } from 'react';
import {
  useGetItemsQuery,
  useCreateItemMutation,
  useDeleteItemMutation,
  useUpdateItemMutation,
} from '@/api/itemApi';
import type { Item } from '@/api/itemApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { compareValues, getNextSortDirection, type SortDirection } from '@/lib/tableUtils';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ItemRow = React.memo(function ItemRow({
  item,
  onDelete,
  onEdit,
}: {
  item: Item;
  onDelete: (id: number) => void;
  onEdit: (item: Item) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{item.id}</TableCell>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>₹{Number(item.monthlyRate).toFixed(2)}</TableCell>
      <TableCell>{item.quantity}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            item.status === 'available'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : item.status === 'rented'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
        >
          {item.status}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="icon-xs" variant="ghost" onClick={() => onEdit(item)}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={() => onDelete(item.id)}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function ItemsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Item['status']>('all');
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'monthlyRate' | 'quantity' | 'status'>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const pageSize = 10;
  const [page, setPage] = useState(0);

  const { data: allItems = [], isLoading } = useGetItemsQuery();

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allItems, searchTerm, statusFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((left, right) => {
      switch (sortKey) {
        case 'id':
          return compareValues(left.id, right.id, sortDirection);
        case 'name':
          return compareValues(left.name, right.name, sortDirection);
        case 'monthlyRate':
          return compareValues(Number(left.monthlyRate), Number(right.monthlyRate), sortDirection);
        case 'quantity':
          return compareValues(left.quantity, right.quantity, sortDirection);
        case 'status':
          return compareValues(left.status, right.status, sortDirection);
        default:
          return 0;
      }
    });
  }, [filteredItems, sortDirection, sortKey]);

  const paginatedItems = useMemo(() => sortedItems.slice(page * pageSize, (page + 1) * pageSize), [
    sortedItems,
    page,
    pageSize,
  ]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  const [createItem] = useCreateItemMutation();
  const [deleteItem] = useDeleteItemMutation();
  const [updateItem] = useUpdateItemMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthlyRate, setEditMonthlyRate] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editStatus, setEditStatus] = useState<Item['status']>('available');

  const [name, setName] = useState('');
  const [monthlyRate, setMonthlyRate] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  const extractErrorMessage = (err: unknown, fallback: string): string => {
    const e = err as { data?: { message?: string }; error?: string; status?: number | string };
    if (e?.data?.message) return e.data.message;
    if (typeof e?.error === 'string') return e.error;
    if (e?.status === 403) return "You don't have permission to perform this action.";
    return fallback;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem({ name, monthlyRate, quantity }).unwrap();
      setName('');
      setMonthlyRate(0);
      setQuantity(1);
      setAddOpen(false);
      toast.success('Item added successfully');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to add item'));
    }
  };

  const handleEdit = async () => {
    if (!editingItem) return;
    try {
      await updateItem({
        id: editingItem.id,
        data: {
          name: editName,
          monthlyRate: editMonthlyRate,
          quantity: editQuantity,
          status: editStatus,
        },
      }).unwrap();
      setEditOpen(false);
      setEditingItem(null);
      toast.success('Item updated successfully');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update item'));
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inventory Items</h1>
          <p className="text-muted-foreground">Manage your rental items, rates, and availability.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="size-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | Item['status']);
                setPage(0);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="rented">Rented</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading items...</div>
          ) : sortedItems.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No items found.</div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      className="w-[100px]"
                      label="ID"
                      isActive={sortKey === 'id'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'id'));
                        setSortKey('id');
                      }}
                    />
                    <SortableTableHead
                      label="Name"
                      isActive={sortKey === 'name'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'name'));
                        setSortKey('name');
                      }}
                    />
                    <SortableTableHead
                      label="Monthly Rate"
                      isActive={sortKey === 'monthlyRate'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'monthlyRate'));
                        setSortKey('monthlyRate');
                      }}
                    />
                    <SortableTableHead
                      label="Quantity"
                      isActive={sortKey === 'quantity'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'quantity'));
                        setSortKey('quantity');
                      }}
                    />
                    <SortableTableHead
                      label="Status"
                      isActive={sortKey === 'status'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'status'));
                        setSortKey('status');
                      }}
                    />
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      onDelete={deleteItem}
                      onEdit={(it) => {
                        setEditingItem(it);
                        setEditName(it.name || '');
                        setEditMonthlyRate(it.monthlyRate || 0);
                        setEditQuantity(it.quantity || 1);
                        setEditStatus(it.status || 'available');
                        setEditOpen(true);
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-end">
              <div className="mr-auto text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="flex-1 sm:flex-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page + 1 >= totalPages}
                  className="flex-1 sm:flex-none"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rate">Monthly Rate (₹)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(parseFloat(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Initial Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Item Name</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editMonthly">Monthly Rate (₹)</Label>
                <Input
                  id="editMonthly"
                  type="number"
                  step="0.01"
                  value={editMonthlyRate}
                  onChange={(e) => setEditMonthlyRate(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editQty">Quantity</Label>
                <Input
                  id="editQty"
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <select
                id="editStatus"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as Item['status'])}
                className="w-full p-2 border rounded-md bg-background text-sm"
              >
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
