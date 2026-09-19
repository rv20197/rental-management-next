'use client';

import React, { useState, useMemo } from 'react';
import {
  useGetRentalsQuery,
  useCreateRentalMutation,
  useUpdateRentalMutation,
  type CreateRentalPayload,
  type Rental,
  type RentalItem,
} from '@/api/rentalApi';
import { useReturnAndBillMutation } from '@/api/billingApi';
import { useGetItemsQuery } from '@/api/itemApi';
import { toast } from 'sonner';
import { useGetCustomersQuery } from '@/api/customerApi';
import CostBreakdown from '@/components/CostBreakdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Download,
  CalendarPlus,
  Eye,
  Trash2,
  Pencil,
} from 'lucide-react';
import { calculateDefaultDeposit } from '@/lib/rentalUtils';
import { calculateMonthsRented } from '@/lib/billingUtils';
import { compareValues, getNextSortDirection, type SortDirection } from '@/lib/tableUtils';
import { downloadAttachment } from '@/lib/blobDownload';

const downloadFile = async (endpoint: string, fallbackFilename: string) => {
  try {
    await downloadAttachment(`/api${endpoint}`, fallbackFilename);
  } catch {
    toast.error('Failed to download file');
  }
};

type RentalFormItem = { itemId: number | ''; quantity: number; unitPrice: number | '' };

const RentalRow = React.memo(function RentalRow({
  rental,
  onReturn,
  onExtend,
  onView,
  onEdit,
}: {
  rental: Rental;
  onReturn: (id: number) => void;
  onExtend: (id: number, currentEndDate: string) => void;
  onView: (rental: Rental) => void;
  onEdit: (rental: Rental) => void;
}) {
  const handleDownloadEstimation = () => {
    downloadFile(`/rentals/${rental.id}/estimation`, `estimation-${rental.id}.pdf`);
  };

  const totalQty =
    rental.RentalItems && rental.RentalItems.length > 0
      ? rental.RentalItems.reduce((acc, ri) => acc + ri.quantity, 0)
      : rental.quantity;
  const outstandingQty = rental.outstandingQty ?? Math.max((totalQty ?? 0) - (rental.returnedQuantity ?? 0), 0);
  const itemNames =
    rental.RentalItems && rental.RentalItems.length > 0
      ? rental.RentalItems.map((ri) => ri.Item?.name).filter(Boolean).join(', ')
      : rental.Item?.name ?? '-';

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{rental.id}</TableCell>
      <TableCell className="max-w-[220px] truncate" title={itemNames}>
        {itemNames}
      </TableCell>
      <TableCell>
        {rental.Customer
          ? `${rental.Customer.firstName ?? ''} ${rental.Customer.lastName ?? ''}`.trim() ||
            rental.Customer.email
          : rental.customerId}
      </TableCell>
      <TableCell className="whitespace-nowrap">{new Date(rental.startDate).toLocaleDateString()}</TableCell>
      <TableCell>{totalQty}</TableCell>
      <TableCell>{outstandingQty}</TableCell>
      <TableCell>
        {rental.outstandingAmount != null ? `₹${Number(rental.outstandingAmount).toFixed(2)}` : '-'}
      </TableCell>
      <TableCell>{rental.depositAmount != null ? `₹${Number(rental.depositAmount).toFixed(2)}` : '-'}</TableCell>
      <TableCell>{rental.labourCost != null ? `₹${Number(rental.labourCost).toFixed(2)}` : '-'}</TableCell>
      <TableCell>{rental.transportCost != null ? `₹${Number(rental.transportCost).toFixed(2)}` : '-'}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            rental.status === 'active'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : rental.status === 'completed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : rental.status === 'returned'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {rental.status}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-blue-600"
            title="View Details"
            onClick={() => onView(rental)}
          >
            <Eye className="size-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-blue-600"
            title="Edit Rental"
            onClick={() => onEdit(rental)}
            disabled={rental.status === 'returned' || rental.status === 'completed'}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-blue-600"
            title="Download Estimation"
            onClick={handleDownloadEstimation}
          >
            <Download className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={rental.status !== 'active'}
            onClick={() => onExtend(rental.id, rental.endDate ?? '')}
            className="gap-1"
          >
            <CalendarPlus className="size-3" />
            Extend
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={rental.status !== 'active'}
            onClick={() => onReturn(rental.id)}
            className="gap-1"
          >
            <ReceiptText className="size-3" />
            Return
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function RentalsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'active' | 'completed' | 'cancelled' | 'returned'>('all');
  const [rentalIdFilter, setRentalIdFilter] = useState('');
  const [itemNameFilter, setItemNameFilter] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [sortKey, setSortKey] = useState<
    'id' | 'items' | 'customer' | 'startDate' | 'qty' | 'outstandingQty' | 'outstandingAmount' | 'status'
  >('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const pageSize = 10;
  const [page, setPage] = useState(0);

  const { data: allRentals = [], isLoading } = useGetRentalsQuery();

  const filteredRentals = useMemo(() => {
    return allRentals.filter((r) => {
      const itemNames =
        r.RentalItems && r.RentalItems.length > 0
          ? r.RentalItems.map((ri) => ri.Item?.name ?? '').join(' ')
          : r.Item?.name ?? '';
      const customerName = r.Customer
        ? `${r.Customer.firstName ?? ''} ${r.Customer.lastName ?? ''}`.trim()
        : '';
      const matchesSearch =
        itemNames.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.Customer?.firstName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.Customer?.lastName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.Customer?.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesRentalId = rentalIdFilter === '' || String(r.id).includes(rentalIdFilter.trim());
      const matchesItemName =
        itemNameFilter === '' || itemNames.toLowerCase().includes(itemNameFilter.toLowerCase());
      const matchesCustomerName =
        customerNameFilter === '' ||
        customerName.toLowerCase().includes(customerNameFilter.toLowerCase()) ||
        (r.Customer?.email ?? '').toLowerCase().includes(customerNameFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesRentalId && matchesItemName && matchesCustomerName;
    });
  }, [allRentals, searchTerm, statusFilter, rentalIdFilter, itemNameFilter, customerNameFilter]);

  const sortedRentals = useMemo(() => {
    return [...filteredRentals].sort((left, right) => {
      const leftItems =
        left.RentalItems && left.RentalItems.length > 0
          ? left.RentalItems.map((ri) => ri.Item?.name ?? '').join(', ')
          : left.Item?.name ?? '';
      const rightItems =
        right.RentalItems && right.RentalItems.length > 0
          ? right.RentalItems.map((ri) => ri.Item?.name ?? '').join(', ')
          : right.Item?.name ?? '';
      const leftCustomer = left.Customer
        ? `${left.Customer.firstName ?? ''} ${left.Customer.lastName ?? ''}`.trim() ||
          left.Customer.email ||
          ''
        : '';
      const rightCustomer = right.Customer
        ? `${right.Customer.firstName ?? ''} ${right.Customer.lastName ?? ''}`.trim() ||
          right.Customer.email ||
          ''
        : '';
      const leftQty =
        left.RentalItems && left.RentalItems.length > 0
          ? left.RentalItems.reduce((sum, ri) => sum + ri.quantity, 0)
          : left.quantity ?? 0;
      const rightQty =
        right.RentalItems && right.RentalItems.length > 0
          ? right.RentalItems.reduce((sum, ri) => sum + ri.quantity, 0)
          : right.quantity ?? 0;
      const leftOutstandingQty = left.outstandingQty ?? Math.max(leftQty - (left.returnedQuantity ?? 0), 0);
      const rightOutstandingQty = right.outstandingQty ?? Math.max(rightQty - (right.returnedQuantity ?? 0), 0);

      switch (sortKey) {
        case 'id':
          return compareValues(left.id, right.id, sortDirection);
        case 'items':
          return compareValues(leftItems, rightItems, sortDirection);
        case 'customer':
          return compareValues(leftCustomer, rightCustomer, sortDirection);
        case 'startDate':
          return compareValues(
            new Date(left.startDate).getTime(),
            new Date(right.startDate).getTime(),
            sortDirection,
          );
        case 'qty':
          return compareValues(leftQty, rightQty, sortDirection);
        case 'outstandingQty':
          return compareValues(leftOutstandingQty, rightOutstandingQty, sortDirection);
        case 'outstandingAmount':
          return compareValues(
            Number(left.outstandingAmount ?? 0),
            Number(right.outstandingAmount ?? 0),
            sortDirection,
          );
        case 'status':
          return compareValues(left.status, right.status, sortDirection);
        default:
          return 0;
      }
    });
  }, [filteredRentals, sortDirection, sortKey]);

  const paginatedRentals = useMemo(
    () => sortedRentals.slice(page * pageSize, (page + 1) * pageSize),
    [sortedRentals, page, pageSize],
  );

  const totalPages = Math.ceil(sortedRentals.length / pageSize);

  const [returnAndBill, { isLoading: isReturning }] = useReturnAndBillMutation();
  const [createRental, { isLoading: isCreating }] = useCreateRentalMutation();
  const [updateRental, { isLoading: isExtending }] = useUpdateRentalMutation();

  const { data: allItems = [] } = useGetItemsQuery();
  const { data: allCustomers = [] } = useGetCustomersQuery();

  const resolveDepositValue = (manualValue: string, fallbackValue: number) => {
    const trimmed = manualValue.trim();
    if (trimmed === '') return fallbackValue;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
  };

  const [newOpen, setNewOpen] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<number | ''>('');
  const [newItems, setNewItems] = useState<RentalFormItem[]>([{ itemId: '', quantity: 1, unitPrice: '' }]);
  const [newStartDate, setNewStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState<string>(
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })(),
  );
  const [newDepositAmount, setNewDepositAmount] = useState<string>('');
  const [isNewDepositOverridden, setIsNewDepositOverridden] = useState(false);
  const [newLabourCost, setNewLabourCost] = useState<string>('');
  const [newTransportCost, setNewTransportCost] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');

  const [editOpen, setEditOpen] = useState(false);
  const [editRentalId, setEditRentalId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<RentalFormItem[]>([]);
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editDepositAmount, setEditDepositAmount] = useState<string>('');
  const [isEditDepositOverridden, setIsEditDepositOverridden] = useState(false);
  const [editLabourCost, setEditLabourCost] = useState<string>('');
  const [editTransportCost, setEditTransportCost] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');

  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);

  const handleView = (rental: Rental) => {
    setSelectedRental(rental);
    setViewOpen(true);
  };

  const [selectedReturnRentalId, setSelectedReturnRentalId] = useState<number | null>(null);
  const [returnItems, setReturnItems] = useState<{ rentalItemId: number; quantity: number }[]>([]);
  const [returnLabourCost, setReturnLabourCost] = useState<string>('');
  const [returnTransportCost, setReturnTransportCost] = useState<string>('');
  const [returnReturnLabourCost, setReturnReturnLabourCost] = useState<string>('');
  const [returnReturnTransportCost, setReturnReturnTransportCost] = useState<string>('');
  const [returnDamagesCost, setReturnDamagesCost] = useState<string>('');

  const selectedReturnRental = useMemo(
    () => allRentals.find((r) => r.id === selectedReturnRentalId) || null,
    [allRentals, selectedReturnRentalId],
  );

  const [extendOpenRentalId, setExtendOpenRentalId] = useState<number | null>(null);
  const [extendNewEndDate, setExtendNewEndDate] = useState<string>('');

  const selectedExtendRental = useMemo(
    () => allRentals.find((r) => r.id === extendOpenRentalId) || null,
    [allRentals, extendOpenRentalId],
  );

  const handleOpenReturn = (rental: Rental) => {
    setSelectedReturnRentalId(rental.id);
    const firstAvailableItem = rental.RentalItems?.find(
      (ri) => ri.quantity - (ri.returnedQuantity || 0) > 0,
    );
    if (firstAvailableItem) {
      setReturnItems([
        {
          rentalItemId: firstAvailableItem.id,
          quantity: firstAvailableItem.quantity - (firstAvailableItem.returnedQuantity || 0),
        },
      ]);
    } else {
      setReturnItems([]);
    }
  };

  const handleReturn = async () => {
    if (!selectedReturnRentalId || returnItems.length === 0) return;
    try {
      const result = await returnAndBill({
        rentalId: selectedReturnRentalId,
        items: returnItems,
        labourCost: returnLabourCost === '' ? undefined : Number(returnLabourCost),
        transportCost: returnTransportCost === '' ? undefined : Number(returnTransportCost),
        returnLabourCost: returnReturnLabourCost === '' ? undefined : Number(returnReturnLabourCost),
        returnTransportCost: returnReturnTransportCost === '' ? undefined : Number(returnReturnTransportCost),
        damagesCost: returnDamagesCost === '' ? undefined : Number(returnDamagesCost),
      }).unwrap();
      setSelectedReturnRentalId(null);
      setReturnItems([]);
      setReturnLabourCost('');
      setReturnTransportCost('');
      setReturnReturnLabourCost('');
      setReturnReturnTransportCost('');
      setReturnDamagesCost('');
      toast.success('Return processed successfully!');
      const billing = result.billing;
      if (billing.id) {
        downloadFile(`/billings/${billing.id}/download`, `bill-${billing.id}.pdf`);
      }
    } catch {
      toast.error('Failed to process return');
    }
  };

  const handleAddItem = () => {
    setNewItems([...newItems, { itemId: '', quantity: 1, unitPrice: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (newItems.length > 1) {
      const updated = [...newItems];
      updated.splice(index, 1);
      setNewItems(updated);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof RentalFormItem,
    value: RentalFormItem[typeof field],
  ) => {
    const updated = [...newItems];
    const row = { ...updated[index], [field]: value };
    if (field === 'itemId' && value !== '') {
      const product = allItems.find((it) => it.id === Number(value));
      if (product && (row.unitPrice === '' || row.unitPrice == null)) {
        row.unitPrice = Number(product.monthlyRate);
      }
    }
    updated[index] = row;
    setNewItems(updated);
  };

  const handleExtend = async () => {
    if (!extendOpenRentalId) return;
    try {
      const r = allRentals.find((x) => x.id === extendOpenRentalId);
      const currentEnd = r?.endDate ? new Date(r.endDate) : null;
      const newEnd = new Date(extendNewEndDate);
      if (!currentEnd || isNaN(newEnd.getTime())) {
        return toast.warning('Please select a valid date');
      }
      if (newEnd <= currentEnd) {
        return toast.warning('New end date must be after current end date');
      }
      await updateRental({ id: extendOpenRentalId, data: { endDate: extendNewEndDate } }).unwrap();
      const id = extendOpenRentalId;
      setExtendOpenRentalId(null);
      toast.success('Rental extended successfully');
      downloadFile(`/rentals/${id}/estimation`, `estimation-${id}.pdf`);
    } catch {
      toast.error('Failed to extend rental');
    }
  };

  const handleEdit = (rental: Rental) => {
    setEditRentalId(rental.id);
    setEditItems(
      rental.RentalItems?.map((ri) => ({
        itemId: ri.itemId,
        quantity: ri.quantity,
        unitPrice:
          ri.unitPrice != null
            ? Number(ri.unitPrice)
            : ri.Item?.monthlyRate != null
              ? Number(ri.Item.monthlyRate)
              : '',
      })) ?? [],
    );
    setEditEndDate(rental.endDate ? new Date(rental.endDate).toISOString().slice(0, 10) : '');
    setEditDepositAmount(rental.depositAmount?.toString() ?? '');
    setEditLabourCost(rental.labourCost?.toString() || '');
    setEditTransportCost(rental.transportCost?.toString() || '');
    setEditAddress(rental.address ?? '');
    setEditOpen(true);
    setIsEditDepositOverridden(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRentalId) return;
    try {
      await updateRental({
        id: editRentalId,
        data: {
          items: editItems
            .filter((it) => it.itemId !== '')
            .map((it) => ({
              itemId: Number(it.itemId),
              quantity: Number(it.quantity),
              unitPrice: it.unitPrice === '' || it.unitPrice == null ? undefined : Number(it.unitPrice),
            })),
          endDate: editEndDate,
          depositAmount: resolveDepositValue(editDepositAmount, editTotals.deposit),
          labourCost: editLabourCost === '' ? undefined : Number(editLabourCost),
          transportCost: editTransportCost === '' ? undefined : Number(editTransportCost),
          address: editAddress.trim() === '' ? null : editAddress.trim(),
        },
      }).unwrap();
      setEditOpen(false);
      toast.success('Rental updated successfully');
    } catch {
      toast.error('Failed to update rental');
    }
  };

  const itemsById = useMemo(() => {
    const map = new Map<number, (typeof allItems)[number]>();
    allItems.forEach((it) => map.set(it.id, it));
    return map;
  }, [allItems]);

  const calculateTotals = (items: RentalFormItem[], startDate: string, endDate: string) => {
    if (!startDate || !endDate) return { rent: 0, deposit: 0, total: 0 };
    const months = calculateMonthsRented(new Date(startDate), new Date(endDate));
    let rent = 0;
    let deposit = 0;

    items.forEach((item) => {
      const it = itemsById.get(Number(item.itemId));
      const rate =
        item.unitPrice !== '' && item.unitPrice != null
          ? Number(item.unitPrice)
          : it
            ? Number(it.monthlyRate)
            : 0;
      rent += rate * (item.quantity || 0) * months;
      deposit += calculateDefaultDeposit(rate, item.quantity);
    });

    return { rent, deposit, total: rent + deposit };
  };

  const newTotals = useMemo(
    () => calculateTotals(newItems, newStartDate, newEndDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newItems, newStartDate, newEndDate, itemsById],
  );

  const newEffectiveDeposit = useMemo(
    () => resolveDepositValue(newDepositAmount, newTotals.deposit),
    [newDepositAmount, newTotals.deposit],
  );

  const newGrandTotal = useMemo(() => {
    const labour = Number(newLabourCost) || 0;
    const transport = Number(newTransportCost) || 0;
    return newTotals.rent + newEffectiveDeposit + labour + transport;
  }, [newLabourCost, newTransportCost, newEffectiveDeposit, newTotals.rent]);

  const editRentalData = useMemo(
    () => allRentals.find((r) => r.id === editRentalId),
    [allRentals, editRentalId],
  );
  const editTotals = useMemo(() => {
    if (!editRentalData) return { rent: 0, deposit: 0, total: 0 };
    return calculateTotals(editItems, editRentalData.startDate, editEndDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItems, editRentalData, editEndDate, itemsById]);

  const editEffectiveDeposit = useMemo(
    () => resolveDepositValue(editDepositAmount, editTotals.deposit),
    [editDepositAmount, editTotals.deposit],
  );

  const editGrandTotal = useMemo(() => {
    const labour = Number(editLabourCost) || 0;
    const transport = Number(editTransportCost) || 0;
    return editTotals.rent + editEffectiveDeposit + labour + transport;
  }, [editLabourCost, editTransportCost, editEffectiveDeposit, editTotals.rent]);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveDeposit = resolveDepositValue(newDepositAmount, newTotals.deposit);
    const labourCostStr = newLabourCost.trim();
    const parsedLabourCost = labourCostStr === '' ? undefined : Number(labourCostStr);
    const transportCostStr = newTransportCost.trim();
    const parsedTransportCost = transportCostStr === '' ? undefined : Number(transportCostStr);

    const validItems = newItems.filter((item) => item.itemId !== '' && item.quantity > 0);
    if (validItems.some((it) => it.unitPrice !== '' && Number(it.unitPrice) < 0)) {
      return toast.warning('Unit price must be 0 or greater');
    }

    if (!newCustomerId || validItems.length === 0) {
      return toast.warning('Please fill required fields and add at least one item');
    }

    try {
      const payload: CreateRentalPayload = {
        customerId: Number(newCustomerId),
        items: validItems.map((item) => ({
          itemId: Number(item.itemId),
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice === '' || item.unitPrice == null ? undefined : Number(item.unitPrice),
        })),
        startDate: newStartDate,
        endDate: newEndDate,
      };
      payload.depositAmount = effectiveDeposit;
      if (parsedLabourCost != null) payload.labourCost = parsedLabourCost;
      if (parsedTransportCost != null) payload.transportCost = parsedTransportCost;
      if (newAddress.trim() !== '') payload.address = newAddress.trim();

      const rental = await createRental(payload).unwrap();
      setNewOpen(false);
      setNewItems([{ itemId: '', quantity: 1, unitPrice: '' }]);
      setNewCustomerId('');
      setNewDepositAmount('');
      setNewLabourCost('');
      setNewTransportCost('');
      setNewAddress('');
      setIsNewDepositOverridden(false);
      setNewEndDate(
        (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().slice(0, 10);
        })(),
      );
      toast.success('Rental created successfully');
      if (rental.id) {
        setSelectedRental(rental);
        setViewOpen(true);
        setIsNewlyCreated(true);
        downloadFile(`/rentals/${rental.id}/estimation`, `estimation-${rental.id}.pdf`);
      }
    } catch {
      toast.error('Failed to create rental');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Rentals</h1>
          <p className="text-muted-foreground">Manage ongoing and past equipment rentals.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="w-full sm:w-auto">
          <Plus className="size-4 mr-2" />
          New Rental
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Filter by rental ID..."
                value={rentalIdFilter}
                onChange={(e) => {
                  setRentalIdFilter(e.target.value);
                  setPage(0);
                }}
              />
              <Input
                placeholder="Filter by item name..."
                value={itemNameFilter}
                onChange={(e) => {
                  setItemNameFilter(e.target.value);
                  setPage(0);
                }}
              />
              <Input
                placeholder="Filter by customer name..."
                value={customerNameFilter}
                onChange={(e) => {
                  setCustomerNameFilter(e.target.value);
                  setPage(0);
                }}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as 'all' | 'active' | 'completed' | 'cancelled' | 'returned',
                  );
                  setPage(0);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="returned">Returned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rentals by item or customer..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading rentals...</div>
          ) : sortedRentals.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No rentals found.</div>
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
                      label="Items"
                      isActive={sortKey === 'items'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'items'));
                        setSortKey('items');
                      }}
                    />
                    <SortableTableHead
                      label="Customer"
                      isActive={sortKey === 'customer'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'customer'));
                        setSortKey('customer');
                      }}
                    />
                    <SortableTableHead
                      label="Start Date"
                      isActive={sortKey === 'startDate'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'startDate'));
                        setSortKey('startDate');
                      }}
                    />
                    <SortableTableHead
                      label="Qty"
                      isActive={sortKey === 'qty'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'qty'));
                        setSortKey('qty');
                      }}
                    />
                    <SortableTableHead
                      label="Outstanding Qty"
                      isActive={sortKey === 'outstandingQty'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'outstandingQty'));
                        setSortKey('outstandingQty');
                      }}
                    />
                    <SortableTableHead
                      label="Outstanding Amount"
                      isActive={sortKey === 'outstandingAmount'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'outstandingAmount'));
                        setSortKey('outstandingAmount');
                      }}
                    />
                    <TableHead>Deposit</TableHead>
                    <TableHead>Labour Cost</TableHead>
                    <TableHead>Transport Cost</TableHead>
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
                  {paginatedRentals.map((rental) => (
                    <RentalRow
                      key={rental.id}
                      rental={rental}
                      onView={handleView}
                      onEdit={handleEdit}
                      onReturn={(id) => {
                        const r = allRentals.find((x) => x.id === id);
                        if (r) handleOpenReturn(r);
                      }}
                      onExtend={(id, currentEnd) => {
                        setExtendOpenRentalId(id);
                        const base = new Date(currentEnd || new Date().toISOString().slice(0, 10));
                        base.setDate(base.getDate() + 30);
                        setExtendNewEndDate(base.toISOString().slice(0, 10));
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

      <Dialog
        open={!!selectedReturnRentalId}
        onOpenChange={(open) => !open && setSelectedReturnRentalId(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Process the Return</DialogTitle>
            <DialogDescription>Select items and quantities being returned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items to Return</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const firstAvailableItem = selectedReturnRental?.RentalItems?.find((ri) => {
                      const alreadyInList = returnItems.some((it) => it.rentalItemId === ri.id);
                      return !alreadyInList && ri.quantity - (ri.returnedQuantity || 0) > 0;
                    });
                    if (firstAvailableItem) {
                      setReturnItems([
                        ...returnItems,
                        {
                          rentalItemId: firstAvailableItem.id,
                          quantity: firstAvailableItem.quantity - (firstAvailableItem.returnedQuantity || 0),
                        },
                      ]);
                    } else {
                      toast.warning('No more items available to return in this rental.');
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {returnItems.map((item, index) => {
                  const rentalItem = selectedReturnRental?.RentalItems?.find(
                    (ri) => ri.id === item.rentalItemId,
                  );
                  const available = rentalItem ? rentalItem.quantity - (rentalItem.returnedQuantity || 0) : 0;

                  return (
                    <div key={index} className="flex gap-3 items-end border p-3 rounded-md relative group">
                      <div className="flex-1 space-y-2">
                        <Label>Item</Label>
                        <select
                          className="w-full p-2 border rounded-md bg-background text-sm"
                          value={item.rentalItemId}
                          onChange={(e) => {
                            const newId = Number(e.target.value);
                            const ri = selectedReturnRental?.RentalItems?.find(
                              (x) => x.id === newId,
                            );
                            const updated = [...returnItems];
                            updated[index] = {
                              rentalItemId: newId,
                              quantity: ri ? ri.quantity - (ri.returnedQuantity || 0) : 0,
                            };
                            setReturnItems(updated);
                          }}
                        >
                          {selectedReturnRental?.RentalItems?.filter((ri) => {
                            const isCurrentInList = ri.id === item.rentalItemId;
                            const alreadyInList = returnItems.some(
                              (it, i) => it.rentalItemId === ri.id && i !== index,
                            );
                            const hasRemaining = ri.quantity - (ri.returnedQuantity || 0) > 0;
                            return (isCurrentInList || !alreadyInList) && hasRemaining;
                          })
                            .sort((a, b) => a.id - b.id)
                            .map((ri) => (
                              <option key={ri.id} value={ri.id}>
                                {ri.Item?.name} (Rented: {ri.quantity}, Returned: {ri.returnedQuantity || 0})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="w-32 space-y-2">
                        <Label>Qty to Return</Label>
                        <Input
                          type="number"
                          min={1}
                          max={available}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...returnItems];
                            updated[index] = { ...updated[index], quantity: val };
                            setReturnItems(updated);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-9 w-9"
                        onClick={() => {
                          const updated = [...returnItems];
                          updated.splice(index, 1);
                          setReturnItems(updated);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {returnItems.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-4">No items selected for return.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="returnReturnLabourCost">Labour Cost (₹)</Label>
                <Input
                  id="returnReturnLabourCost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={returnReturnLabourCost}
                  onChange={(e) => setReturnReturnLabourCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="returnReturnTransportCost">Transport Cost (₹)</Label>
                <Input
                  id="returnReturnTransportCost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={returnReturnTransportCost}
                  onChange={(e) => setReturnReturnTransportCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="returnDamagesCost">Damages Cost (₹)</Label>
                <Input
                  id="returnDamagesCost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0 — enter if any damage occurred"
                  value={returnDamagesCost}
                  onChange={(e) => setReturnDamagesCost(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave blank if no damage. Defaults to ₹0.</p>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md">
              <div className="text-sm">
                <strong>
                  Additional Return Charges: ₹
                  {(
                    (Number(returnReturnLabourCost) || 0) +
                    (Number(returnReturnTransportCost) || 0) +
                    (Number(returnDamagesCost) || 0)
                  ).toFixed(2)}
                </strong>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReturnRentalId(null)}>
                Cancel
              </Button>
              <Button onClick={handleReturn} disabled={isReturning || returnItems.length === 0}>
                {isReturning ? 'Processing...' : 'Confirm Return'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!extendOpenRentalId} onOpenChange={(open) => !open && setExtendOpenRentalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Rental</DialogTitle>
            <DialogDescription>
              Choose a new end date for <strong>{selectedExtendRental?.Item?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extendEnd">New End Date</Label>
              <Input
                id="extendEnd"
                type="date"
                value={extendNewEndDate}
                min={
                  selectedExtendRental?.endDate
                    ? new Date(new Date(selectedExtendRental.endDate).getTime() + 24 * 3600 * 1000)
                        .toISOString()
                        .slice(0, 10)
                    : undefined
                }
                onChange={(e) => setExtendNewEndDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtendOpenRentalId(null)}>
                Cancel
              </Button>
              <Button onClick={handleExtend} disabled={isExtending}>
                {isExtending ? 'Extending...' : 'Confirm Extension'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Rental</DialogTitle>
            <DialogDescription>Select items and customer to start a rental.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <select
                id="customer"
                className="w-full p-2 border rounded-md bg-background text-sm"
                value={newCustomerId}
                onChange={(e) => {
                  const val = e.target.value;
                  const cId = val === '' ? '' : Number(val);
                  setNewCustomerId(cId);
                  if (cId !== '') {
                    const cust = allCustomers.find((c) => c.id === cId);
                    if (cust?.address && !newAddress) {
                      setNewAddress(cust.address);
                    }
                  }
                }}
                required
              >
                <option value="">Select a customer</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.email ? ` (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Enter site or delivery address (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="xs" onClick={handleAddItem} className="gap-1">
                  <Plus className="size-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {newItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-end border p-3 rounded-md bg-muted/30 relative group"
                  >
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Select Item</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background text-sm"
                        value={item.itemId}
                        onChange={(e) =>
                          handleItemChange(index, 'itemId', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        required
                      >
                        <option value="">Select an item</option>
                        {allItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} (Stock: {it.quantity})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Price (₹/mo)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleItemChange(index, 'unitPrice', v === '' ? '' : Number(v));
                        }}
                        placeholder="Auto"
                      />
                    </div>
                    {newItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-9 w-9"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date</Label>
                <Input
                  id="start"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date</Label>
                <Input id="end" type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="deposit">Deposit (₹)</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setIsNewDepositOverridden(false)}
                >
                  Reset to Auto-Calculate
                </Button>
              </div>
              <Input
                id="deposit"
                type="number"
                min={0}
                step="0.01"
                placeholder={newTotals.deposit.toFixed(2)}
                value={isNewDepositOverridden ? newDepositAmount : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewDepositAmount(v);
                  setIsNewDepositOverridden(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use auto-calculated deposit of ₹{newTotals.deposit.toFixed(2)}, or enter 0 for no deposit.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="labourCost">Labour Cost (₹)</Label>
                <Input
                  id="labourCost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={newLabourCost}
                  onChange={(e) => setNewLabourCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportCost">Transport Cost (₹)</Label>
                <Input
                  id="transportCost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={newTransportCost}
                  onChange={(e) => setNewTransportCost(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  Estimated Rent (
                  {calculateMonthsRented(new Date(newStartDate), new Date(newEndDate)).toFixed(1)} mo)
                </span>
                <span>₹{newTotals.rent.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Total Security Deposit</span>
                <span>₹{newEffectiveDeposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Grand Total (Rent + Deposit)</span>
                <span>₹{newGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Rental'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Rental #{editRentalId}</DialogTitle>
            <DialogDescription>Modify items, quantity, or end date for this rental.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-edit">Customer</Label>
              <Input
                id="customer-edit"
                value={
                  editRentalData?.Customer
                    ? `${editRentalData.Customer.firstName} ${editRentalData.Customer.lastName}`
                    : ''
                }
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address-edit">Address</Label>
              <Textarea
                id="address-edit"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Enter site or delivery address (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setEditItems([...editItems, { itemId: '', quantity: 1, unitPrice: '' }])}
                  className="gap-1"
                >
                  <Plus className="size-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {editItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-end border p-3 rounded-md bg-muted/30 relative group"
                  >
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Select Item</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background text-sm"
                        value={item.itemId}
                        onChange={(e) => {
                          const next: number | '' = e.target.value === '' ? '' : Number(e.target.value);
                          const updated = [...editItems];
                          const row = { ...updated[index], itemId: next };
                          if (next !== '' && (row.unitPrice === '' || row.unitPrice == null)) {
                            const product = allItems.find((p) => p.id === next);
                            if (product) row.unitPrice = Number(product.monthlyRate);
                          }
                          updated[index] = row;
                          setEditItems(updated);
                        }}
                        required
                      >
                        <option value="">Select an item</option>
                        {allItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val === 0) {
                            if (window.confirm('Setting quantity to 0 will remove this item. Continue?')) {
                              const updated = [...editItems];
                              updated.splice(index, 1);
                              setEditItems(updated);
                              return;
                            } else {
                              return;
                            }
                          }
                          const updated = [...editItems];
                          updated[index] = { ...updated[index], quantity: val };
                          setEditItems(updated);
                        }}
                        required
                      />
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Price (₹/mo)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const v = e.target.value;
                          const updated = [...editItems];
                          updated[index] = { ...updated[index], unitPrice: v === '' ? '' : Number(v) };
                          setEditItems(updated);
                        }}
                        placeholder="Auto"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-9 w-9"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to remove this item?')) {
                          const updated = [...editItems];
                          updated.splice(index, 1);
                          setEditItems(updated);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-edit">Start Date (Read-only)</Label>
                <Input
                  id="start-edit"
                  type="date"
                  value={
                    editRentalData?.startDate
                      ? new Date(editRentalData.startDate).toISOString().slice(0, 10)
                      : ''
                  }
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-edit">End Date</Label>
                <Input id="end-edit" type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="deposit-edit">Deposit (₹)</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setIsEditDepositOverridden(false)}
                >
                  Reset to Auto-Calculate
                </Button>
              </div>
              <Input
                id="deposit-edit"
                type="number"
                min={0}
                step="0.01"
                placeholder={editTotals.deposit.toFixed(2)}
                value={isEditDepositOverridden ? editDepositAmount : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditDepositAmount(v);
                  setIsEditDepositOverridden(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use auto-calculated deposit of ₹{editTotals.deposit.toFixed(2)}, or enter 0 for no deposit.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="labourCost-edit">Labour Cost (₹)</Label>
                <Input
                  id="labourCost-edit"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={editLabourCost}
                  onChange={(e) => setEditLabourCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportCost-edit">Transport Cost (₹)</Label>
                <Input
                  id="transportCost-edit"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={editTransportCost}
                  onChange={(e) => setEditTransportCost(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  Estimated Rent (
                  {calculateMonthsRented(
                    new Date(editRentalData?.startDate || new Date()),
                    new Date(editEndDate),
                  ).toFixed(1)}{' '}
                  mo)
                </span>
                <span>₹{editTotals.rent.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Total Security Deposit</span>
                <span>₹{editEffectiveDeposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Grand Total (Rent + Deposit)</span>
                <span>₹{editGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isExtending}>
                {isExtending ? 'Updating...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setIsNewlyCreated(false);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rental Details - Rental #{selectedRental?.id}</DialogTitle>
            <DialogDescription>Detailed view of the rental and its items.</DialogDescription>
          </DialogHeader>

          {selectedRental?.status === 'returned' && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-gray-100 border border-gray-300">
              <div className="text-sm text-gray-700">
                🔒 This rental has been returned and is locked for editing.
              </div>
            </div>
          )}

          {selectedRental && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-semibold">
                    {selectedRental.Customer
                      ? `${selectedRental.Customer.firstName} ${selectedRental.Customer.lastName}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedRental.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : selectedRental.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : selectedRental.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : selectedRental.status === 'pending' || selectedRental.status === 'created'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {selectedRental.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-semibold">{new Date(selectedRental.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-semibold">
                    {selectedRental.endDate ? new Date(selectedRental.endDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                {(selectedRental.address || selectedRental.Customer?.address) ? (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-semibold whitespace-pre-line">
                      {selectedRental.address || selectedRental.Customer?.address}
                    </p>
                  </div>
                ) : null}
                {(selectedRental.status === 'created' ||
                  selectedRental.status === 'pending' ||
                  isNewlyCreated) && (
                  <div>
                    <p className="text-muted-foreground">Payable Deposit</p>
                    <p className="font-semibold">₹{Number(selectedRental.depositAmount).toFixed(2)}</p>
                  </div>
                )}
                {Number(selectedRental.labourCost) > 0 && (
                  <div>
                    <p className="text-muted-foreground">Labour Cost</p>
                    <p className="font-semibold">₹{Number(selectedRental.labourCost).toFixed(2)}</p>
                  </div>
                )}
                {Number(selectedRental.transportCost) > 0 && (
                  <div>
                    <p className="text-muted-foreground">Transport Cost</p>
                    <p className="font-semibold">₹{Number(selectedRental.transportCost).toFixed(2)}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Rented Items</h4>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRental.RentalItems?.map((ri: RentalItem) => (
                        <TableRow key={ri.id}>
                          <TableCell>{ri.Item?.name || `Item ${ri.itemId}`}</TableCell>
                          <TableCell>{ri.quantity}</TableCell>
                        </TableRow>
                      ))}
                      {(!selectedRental.RentalItems || selectedRental.RentalItems.length === 0) && (
                        <TableRow>
                          <TableCell>{selectedRental.Item?.name || 'N/A'}</TableCell>
                          <TableCell>{selectedRental.quantity}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {(selectedRental.status === 'created' ||
                selectedRental.status === 'pending' ||
                isNewlyCreated) && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Cost Summary</h4>
                  <CostBreakdown
                    baseAmount={(() => {
                      const months = calculateMonthsRented(
                        new Date(selectedRental.startDate),
                        new Date(selectedRental.endDate ?? selectedRental.startDate),
                      );
                      let total = 0;
                      if (selectedRental.RentalItems && selectedRental.RentalItems.length > 0) {
                        selectedRental.RentalItems.forEach((ri: RentalItem) => {
                          const rate = ri.Item?.monthlyRate ? Number(ri.Item.monthlyRate) : 0;
                          total += ri.quantity * rate * months;
                        });
                      } else {
                        const rate = selectedRental.Item?.monthlyRate
                          ? Number(selectedRental.Item.monthlyRate)
                          : 0;
                        total = (selectedRental.quantity || 0) * rate * months;
                      }
                      return total;
                    })()}
                    transportCost={Number(selectedRental.transportCost) || 0}
                    labourCost={Number(selectedRental.labourCost) || 0}
                    depositAmount={Number(selectedRental.depositAmount) || 0}
                    showDeposit={true}
                  />
                </div>
              )}

              {selectedRental.status === 'returned' && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Return Costs</h4>
                  <CostBreakdown
                    baseAmount={0}
                    transportCost={Number(selectedRental.returnTransportCost) || 0}
                    labourCost={Number(selectedRental.returnLabourCost) || 0}
                    returnLabourCost={Number(selectedRental.returnLabourCost) || 0}
                    returnTransportCost={Number(selectedRental.returnTransportCost) || 0}
                    damagesCost={Number(selectedRental.damagesCost) || 0}
                    showDeposit={false}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              variant="outline"
              className="text-blue-600 gap-1"
              disabled={selectedRental?.status === 'returned' || selectedRental?.status === 'completed'}
              onClick={() => {
                setViewOpen(false);
                if (selectedRental) handleEdit(selectedRental);
              }}
            >
              <Pencil className="size-4" /> Edit Rental
            </Button>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
