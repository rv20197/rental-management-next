'use client';

import React, { useState, useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetBillingsQuery,
  usePayBillingMutation,
  useCreateBillingMutation,
  useUpdateBillingMutation,
} from '@/api/billingApi';
import { useGetItemsQuery } from '@/api/itemApi';
import { useGetCustomersQuery } from '@/api/customerApi';
import { useGetRentalsQuery } from '@/api/rentalApi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Download,
  Eye,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import CostBreakdown from '@/components/CostBreakdown';
import { compareValues, getNextSortDirection, type SortDirection } from '@/lib/tableUtils';
import { downloadAttachment } from '@/lib/blobDownload';
import {
  BILL_PERIOD_OPTIONS,
  DEFAULT_BILL_PERIOD_VALUE,
  applyBillPeriodOptionChange,
  applyBillingEndDateChange,
  applyBillingStartDateChange,
  calculateBillPeriodDays,
  calculateBillPeriodEndDate,
  isCustomBillPeriodValue,
  resolveBillPeriodMonths,
  validateBillingDateRange,
} from '@/lib/billing/period';

const BillingRow = React.memo(function BillingRow({
  billing,
  onPay,
  onView,
  onEdit,
}: {
  billing: any;
  onPay: (id: number) => void;
  onView: (billing: any) => void;
  onEdit: (billing: any) => void;
}) {
  const handleDownloadInvoice = async () => {
    try {
      await downloadAttachment(`/api/billings/${billing.id}/download`, `invoice-${billing.id}.pdf`);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  const customerName = billing.Customer
    ? `${billing.Customer.firstName} ${billing.Customer.lastName}`
    : billing.Rental?.Customer
      ? `${billing.Rental.Customer.firstName} ${billing.Rental.Customer.lastName}`
      : 'N/A';

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{billing.id}</TableCell>
      <TableCell className="font-mono text-xs">{billing.rentalId || 'N/A'}</TableCell>
      <TableCell>{customerName}</TableCell>
      <TableCell className="whitespace-nowrap">{new Date(billing.dueDate).toLocaleDateString()}</TableCell>
      <TableCell className="font-semibold">₹{Number(billing.amount).toFixed(2)}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            billing.status === 'paid'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : billing.status === 'overdue'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
        >
          {billing.status}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-blue-600"
            title="View Details"
            onClick={() => onView(billing)}
          >
            <Eye className="size-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-blue-600"
            title="Download Invoice"
            onClick={handleDownloadInvoice}
          >
            <Download className="size-3" />
          </Button>
          {billing.status !== 'paid' && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-amber-600"
              title="Edit Billing"
              onClick={() => onEdit(billing)}
            >
              <Pencil className="size-3" />
            </Button>
          )}
          {billing.status !== 'paid' && (
            <Button size="icon-xs" variant="ghost" className="text-green-600" onClick={() => onPay(billing.id)}>
              <CheckCircle2 className="size-3" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function BillingsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [billingIdFilter, setBillingIdFilter] = useState('');
  const [rentalIdFilter, setRentalIdFilter] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [sortKey, setSortKey] = useState<
    'id' | 'rentalId' | 'customer' | 'dueDate' | 'amount' | 'status'
  >('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const pageSize = 10;
  const [page, setPage] = useState(0);

  const { data: allBillings = [], isLoading } = useGetBillingsQuery();

  const filteredBillings = useMemo(() => {
    return allBillings.filter((b: any) => {
      const customer = b.Customer || b.Rental?.Customer;
      const customerName = customer ? `${customer.firstName} ${customer.lastName}`.toLowerCase() : '';
      const matchesSearch =
        b.id.toString().includes(searchTerm) ||
        (b.rentalId && b.rentalId.toString().includes(searchTerm)) ||
        customerName.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesBillingId = billingIdFilter === '' || String(b.id).includes(billingIdFilter.trim());
      const matchesRentalId = rentalIdFilter === '' || String(b.rentalId ?? '').includes(rentalIdFilter.trim());
      const matchesCustomerName =
        customerNameFilter === '' ||
        customerName.includes(customerNameFilter.toLowerCase()) ||
        (customer?.email ?? '').toLowerCase().includes(customerNameFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesBillingId && matchesRentalId && matchesCustomerName;
    });
  }, [allBillings, searchTerm, statusFilter, billingIdFilter, rentalIdFilter, customerNameFilter]);

  const sortedBillings = useMemo(() => {
    return [...filteredBillings].sort((left: any, right: any) => {
      const leftCustomer = left.Customer
        ? `${left.Customer.firstName} ${left.Customer.lastName}`
        : left.Rental?.Customer
          ? `${left.Rental.Customer.firstName} ${left.Rental.Customer.lastName}`
          : '';
      const rightCustomer = right.Customer
        ? `${right.Customer.firstName} ${right.Customer.lastName}`
        : right.Rental?.Customer
          ? `${right.Rental.Customer.firstName} ${right.Rental.Customer.lastName}`
          : '';

      switch (sortKey) {
        case 'id':
          return compareValues(left.id, right.id, sortDirection);
        case 'rentalId':
          return compareValues(left.rentalId ?? 0, right.rentalId ?? 0, sortDirection);
        case 'customer':
          return compareValues(leftCustomer, rightCustomer, sortDirection);
        case 'dueDate':
          return compareValues(new Date(left.dueDate).getTime(), new Date(right.dueDate).getTime(), sortDirection);
        case 'amount':
          return compareValues(Number(left.amount), Number(right.amount), sortDirection);
        case 'status':
          return compareValues(left.status, right.status, sortDirection);
        default:
          return 0;
      }
    });
  }, [filteredBillings, sortDirection, sortKey]);

  const paginatedBillings = useMemo(
    () => sortedBillings.slice(page * pageSize, (page + 1) * pageSize),
    [sortedBillings, page, pageSize],
  );

  const totalPages = Math.ceil(sortedBillings.length / pageSize);

  const [payBilling] = usePayBillingMutation();
  const [createBilling, { isLoading: isCreating }] = useCreateBillingMutation();
  const [updateBilling, { isLoading: isUpdating }] = useUpdateBillingMutation();

  const { data: allItems = [] } = useGetItemsQuery();
  const { data: allCustomers = [] } = useGetCustomersQuery();

  const [newOpen, setNewOpen] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const handleView = (billing: any) => {
    setSelectedBilling(billing);
    setViewOpen(true);
  };

  const [newCustomerId, setNewCustomerId] = useState<number | ''>('');
  const [newRentalId, setNewRentalId] = useState<number | ''>('');
  const [newDueDate, setNewDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newBillPeriodValue, setNewBillPeriodValue] = useState<string>(DEFAULT_BILL_PERIOD_VALUE);
  const [newBillingEndDate, setNewBillingEndDate] = useState<string>(() =>
    calculateBillPeriodEndDate(new Date().toISOString().slice(0, 10), 1),
  );
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [editingBillingId, setEditingBillingId] = useState<number | null>(null);
  const [newItems, setNewItems] = useState<
    { itemId: number | ''; quantity: number; rate: number; total: number }[]
  >([{ itemId: '', quantity: 1, rate: 0, total: 0 }]);
  const [newDamages, setNewDamages] = useState<{ description: string; amount: number }[]>([]);
  const [availableDeposit, setAvailableDeposit] = useState<number>(0);
  const [newLabourCost, setNewLabourCost] = useState<string>('');
  const [newTransportCost, setNewTransportCost] = useState<string>('');

  const { data: activeRentals = [] } = useGetRentalsQuery(
    newCustomerId !== '' ? { customerId: Number(newCustomerId), status: 'active' } : skipToken,
  );

  const handleRentalChange = (rentalId: string) => {
    const rId = rentalId === '' ? '' : Number(rentalId);
    setNewRentalId(rId);

    if (rId !== '') {
      const selectedRental = activeRentals.find((r) => r.id === rId);
      if (selectedRental) {
        setAvailableDeposit(Number(selectedRental.depositAmount) || 0);
        if (selectedRental.RentalItems && selectedRental.RentalItems.length > 0) {
          const populatedItems = selectedRental.RentalItems.map((ri) => {
            const monthlyRate =
              ri.unitPrice != null ? Number(ri.unitPrice) : ri.Item?.monthlyRate ? Number(ri.Item.monthlyRate) : 0;
            return {
              itemId: ri.itemId,
              quantity: ri.quantity,
              rate: monthlyRate,
              total: ri.quantity * monthlyRate,
            };
          });
          setNewItems(populatedItems);
        } else if (selectedRental.itemId) {
          const monthlyRate = selectedRental.Item?.monthlyRate ? Number(selectedRental.Item.monthlyRate) : 0;
          setNewItems([
            {
              itemId: selectedRental.itemId,
              quantity: selectedRental.quantity || 1,
              rate: monthlyRate,
              total: (selectedRental.quantity || 1) * monthlyRate,
            },
          ]);
        }
      }
    } else {
      setAvailableDeposit(0);
    }
  };

  const monthlyRentTotal = useMemo(() => newItems.reduce((sum, item) => sum + item.total, 0), [newItems]);

  const isCustomPeriod = isCustomBillPeriodValue(newBillPeriodValue);

  // The final Billing Start/End Date are the single source of truth for all
  // billing calculations: predefined periods use their fixed month count,
  // Custom Dates use the calendar-prorated equivalent of the actual range.
  const effectiveBillPeriodMonths = useMemo(
    () =>
      newDueDate && newBillingEndDate ? resolveBillPeriodMonths(newBillPeriodValue, newDueDate, newBillingEndDate) : 0,
    [newBillPeriodValue, newDueDate, newBillingEndDate],
  );

  const billingDurationDays = useMemo(
    () => (newDueDate && newBillingEndDate ? calculateBillPeriodDays(newDueDate, newBillingEndDate) : 0),
    [newDueDate, newBillingEndDate],
  );

  const grandTotal = useMemo(
    () => monthlyRentTotal * effectiveBillPeriodMonths,
    [monthlyRentTotal, effectiveBillPeriodMonths],
  );

  const billingEndDate = newBillingEndDate;

  const handleBillPeriodValueChange = (value: string) => {
    const { billPeriodValue, billingEndDate: nextEnd } = applyBillPeriodOptionChange(
      value,
      newDueDate,
      newBillingEndDate,
    );
    setNewBillPeriodValue(billPeriodValue);
    setNewBillingEndDate(nextEnd);
    setDateRangeError(validateBillingDateRange(newDueDate, nextEnd));
  };

  const handleBillingStartDateChange = (value: string) => {
    const { billingEndDate: nextEnd } = applyBillingStartDateChange(value, newBillPeriodValue, newBillingEndDate);
    setNewDueDate(value);
    setNewBillingEndDate(nextEnd);
    setDateRangeError(validateBillingDateRange(value, nextEnd));
  };

  const handleBillingEndDateChange = (value: string) => {
    const { billPeriodValue } = applyBillingEndDateChange(value, newDueDate);
    setNewBillingEndDate(value);
    setNewBillPeriodValue(billPeriodValue);
    setDateRangeError(validateBillingDateRange(newDueDate, value));
  };

  const totalDamages = useMemo(
    () => newDamages.reduce((sum, d) => sum + d.amount, 0),
    [newDamages],
  );

  const depositUsed = Math.min(availableDeposit, totalDamages);
  const remainingDepositAfterDamages = availableDeposit - depositUsed;
  const excessDamages = Math.max(0, totalDamages - availableDeposit);
  const labourCostAmount = Number(newLabourCost) || 0;
  const transportCostAmount = Number(newTransportCost) || 0;
  const finalPayable = grandTotal + excessDamages + labourCostAmount + transportCostAmount;

  const handleAddItem = () => {
    setNewItems([...newItems, { itemId: '', quantity: 1, rate: 0, total: 0 }]);
  };

  const handleAddDamage = () => {
    setNewDamages([...newDamages, { description: '', amount: 0 }]);
  };

  const handleRemoveDamage = (index: number) => {
    setNewDamages(newDamages.filter((_, i) => i !== index));
  };

  const handleDamageChange = (index: number, field: string, value: string) => {
    const updated = [...newDamages];
    const damage = { ...updated[index] };
    if (field === 'description') damage.description = value;
    else if (field === 'amount') damage.amount = Number(value);
    updated[index] = damage;
    setNewDamages(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (newItems.length > 1) setNewItems(newItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...newItems];
    const item = { ...updated[index] };
    if (field === 'itemId') {
      const selectedItem = allItems.find((it) => it.id === Number(value));
      item.itemId = Number(value);
      item.rate = selectedItem ? Number(selectedItem.monthlyRate) : 0;
    } else if (field === 'quantity') {
      item.quantity = Number(value);
    } else if (field === 'rate') {
      item.rate = Number(value);
    }
    item.total = item.quantity * item.rate;
    updated[index] = item;
    setNewItems(updated);
  };

  const resetBillingForm = () => {
    setNewCustomerId('');
    setNewRentalId('');
    const today = new Date().toISOString().slice(0, 10);
    setNewDueDate(today);
    setNewBillPeriodValue(DEFAULT_BILL_PERIOD_VALUE);
    setNewBillingEndDate(calculateBillPeriodEndDate(today, 1));
    setDateRangeError(null);
    setEditingBillingId(null);
    setNewItems([{ itemId: '', quantity: 1, rate: 0, total: 0 }]);
    setNewDamages([]);
    setAvailableDeposit(0);
    setNewLabourCost('');
    setNewTransportCost('');
  };

  const handleEdit = (billing: any) => {
    setEditingBillingId(billing.id);
    setNewCustomerId(billing.customerId ?? billing.Customer?.id ?? '');
    setNewRentalId(billing.rentalId ?? '');
    const startDate = billing.dueDate
      ? new Date(billing.dueDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setNewDueDate(startDate);
    // Load the previously persisted Bill Period and dates rather than
    // resetting to the default or recalculating.
    const persistedValue =
      billing.billPeriodValue ??
      (billing.billPeriodType === 'custom' ? 'custom' : String(Number(billing.billPeriodMonths) || 1));
    setNewBillPeriodValue(persistedValue);
    setNewBillingEndDate(
      billing.billingEndDate
        ? new Date(billing.billingEndDate).toISOString().slice(0, 10)
        : calculateBillPeriodEndDate(startDate, Number(billing.billPeriodMonths) || 1),
    );
    setDateRangeError(null);
    setAvailableDeposit(Number(billing.availableDeposit) || 0);
    setNewLabourCost(billing.labourCost ? String(billing.labourCost) : '');
    setNewTransportCost(billing.transportCost ? String(billing.transportCost) : '');
    const items = (billing.BillingItems || []).map((bi: any) => ({
      itemId: bi.itemId ?? '',
      quantity: Number(bi.quantity) || 1,
      rate: Number(bi.rate) || 0,
      total: (Number(bi.quantity) || 1) * (Number(bi.rate) || 0),
    }));
    setNewItems(items.length > 0 ? items : [{ itemId: '', quantity: 1, rate: 0, total: 0 }]);
    setNewDamages(
      (billing.BillingDamages || []).map((bd: any) => ({
        description: bd.description,
        amount: Number(bd.amount) || 0,
      })),
    );
    setNewOpen(true);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validItems = newItems.filter((it) => it.itemId !== '' && it.quantity > 0 && it.rate >= 0);
    if (validItems.length === 0) return toast.warning('Please add at least one valid item');
    if (!newCustomerId) return toast.warning('Please select a customer');
    const rangeError = validateBillingDateRange(newDueDate, newBillingEndDate);
    if (rangeError) {
      setDateRangeError(rangeError);
      return toast.warning(rangeError);
    }

    const payload = {
      customerId: typeof newCustomerId === 'string' ? undefined : newCustomerId,
      rentalId: newRentalId === '' ? undefined : Number(newRentalId),
      amount: finalPayable,
      dueDate: newDueDate,
      billPeriodValue: newBillPeriodValue,
      billingEndDate: newBillingEndDate,
      status: 'pending' as const,
      items: validItems as any,
      damages: newDamages.filter((d) => d.description !== '' && d.amount > 0),
      availableDeposit,
      labourCost: newLabourCost === '' ? undefined : Number(newLabourCost),
      transportCost: newTransportCost === '' ? undefined : Number(newTransportCost),
    };

    try {
      if (editingBillingId != null) {
        await updateBilling({ id: editingBillingId, body: payload }).unwrap();
        toast.success('Billing updated successfully');
      } else {
        await createBilling(payload).unwrap();
        toast.success('Billing created successfully');
      }

      setNewOpen(false);
      resetBillingForm();
    } catch {
      toast.error(editingBillingId != null ? 'Failed to update billing' : 'Failed to create billing');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Billings</h1>
          <p className="text-muted-foreground">Manage invoices, payments, and billing history.</p>
        </div>
        <Button
          onClick={() => {
            resetBillingForm();
            setNewOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="size-4 mr-2" />
          New Billing
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Filter by billing ID..."
                value={billingIdFilter}
                onChange={(e) => {
                  setBillingIdFilter(e.target.value);
                  setPage(0);
                }}
              />
              <Input
                placeholder="Filter by rental ID..."
                value={rentalIdFilter}
                onChange={(e) => {
                  setRentalIdFilter(e.target.value);
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
                  setStatusFilter(e.target.value as 'all' | 'pending' | 'paid' | 'overdue');
                  setPage(0);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by billing ID or customer name..."
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
            <div className="py-10 text-center text-muted-foreground">Loading billings...</div>
          ) : sortedBillings.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No billing records found.</div>
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
                      label="Rental ID"
                      isActive={sortKey === 'rentalId'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'rentalId'));
                        setSortKey('rentalId');
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
                      label="Due Date"
                      isActive={sortKey === 'dueDate'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'dueDate'));
                        setSortKey('dueDate');
                      }}
                    />
                    <SortableTableHead
                      label="Amount"
                      isActive={sortKey === 'amount'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'amount'));
                        setSortKey('amount');
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
                  {paginatedBillings.map((b: any) => (
                    <BillingRow key={b.id} billing={b} onPay={payBilling} onView={handleView} onEdit={handleEdit} />
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
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) resetBillingForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingBillingId != null ? 'Edit Billing' : 'Create New Billing'}</DialogTitle>
            <DialogDescription>
              {editingBillingId != null
                ? 'Update the bill period, items, and charges. All amounts recalculate automatically.'
                : 'Select customer and amount to create a billing record.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <select
                  id="customer"
                  className="w-full p-2 border rounded-md bg-background text-sm"
                  value={newCustomerId}
                  onChange={(e) => {
                    const cid = e.target.value === '' ? '' : Number(e.target.value);
                    setNewCustomerId(cid);
                    setNewRentalId('');
                  }}
                  required
                >
                  <option value="">Select a customer</option>
                  {allCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billPeriod">Bill Period</Label>
                <select
                  id="billPeriod"
                  className="w-full p-2 border rounded-md bg-background text-sm"
                  value={newBillPeriodValue}
                  onChange={(e) => handleBillPeriodValueChange(e.target.value)}
                  required
                >
                  {BILL_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingStart">Billing Start Date</Label>
                <Input
                  id="billingStart"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => handleBillingStartDateChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEnd">Billing End Date</Label>
                <Input
                  id="billingEnd"
                  type="date"
                  value={newBillingEndDate}
                  onChange={(e) => handleBillingEndDateChange(e.target.value)}
                  min={newDueDate || undefined}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-9 flex items-center justify-between px-3 border rounded-md bg-muted/50 text-sm">
                <span>
                  {newDueDate
                    ? `${new Date(newDueDate).toLocaleDateString('en-IN')} to ${billingEndDate ? new Date(billingEndDate).toLocaleDateString('en-IN') : '—'}`
                    : '—'}
                </span>
                {billingDurationDays > 0 && (
                  <span className="text-muted-foreground text-xs">Billing Duration: {billingDurationDays} days</span>
                )}
              </div>
              {dateRangeError && <p className="text-xs text-destructive">{dateRangeError}</p>}
            </div>


            {newCustomerId !== '' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rental">Active Rental (Optional)</Label>
                  <select
                    id="rental"
                    className="w-full p-2 border rounded-md bg-background text-sm"
                    value={newRentalId}
                    onChange={(e) => handleRentalChange(e.target.value)}
                  >
                    <option value="">Select a rental</option>
                    {activeRentals.map((r) => (
                      <option key={r.id} value={r.id}>
                        Rental #{r.id} - {new Date(r.startDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                {newRentalId !== '' && (
                  <div className="space-y-2">
                    <Label>Available Deposit</Label>
                    <div className="h-9 flex items-center px-3 border rounded-md bg-muted/50 font-semibold text-blue-600">
                      ₹{availableDeposit.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="size-3 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                {newItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="col-span-5 space-y-1">
                      <Label className="text-[10px]">Item</Label>
                      <select
                        className="w-full p-1.5 border rounded-md bg-background text-xs"
                        value={item.itemId}
                        onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                        required
                      >
                        <option value="">Select Item</option>
                        {allItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Qty</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        min={1}
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Rate</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        min={0}
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Total ({effectiveBillPeriodMonths.toFixed(2)}mo)</Label>
                      <div className="h-8 flex items-center text-xs font-semibold px-2 bg-muted rounded-md">
                        ₹{(item.total * effectiveBillPeriodMonths).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-1">
                      {newItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Damages & Deductions</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddDamage}>
                  <Plus className="size-3 mr-1" /> Add Damage
                </Button>
              </div>

              <div className="space-y-3 border rounded-md p-3 bg-red-50/30 dark:bg-red-900/10">
                {newDamages.map((damage, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end border-b border-red-100 dark:border-red-900/30 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="col-span-7 space-y-1">
                      <Label className="text-[10px]">Description</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="e.g. Broken chair leg"
                        value={damage.description}
                        onChange={(e) => handleDamageChange(index, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px]">Amount</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={damage.amount}
                        onChange={(e) => handleDamageChange(index, 'amount', e.target.value)}
                        min={0}
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveDamage(index)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {newDamages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2 italic">No damage records added.</p>
                )}
              </div>
              {totalDamages > availableDeposit && newRentalId !== '' && (
                <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md text-[11px] border border-yellow-100 dark:border-yellow-900/30">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                  <p>Damage amount exceeds available deposit. Remaining ₹{excessDamages.toFixed(2)} will be added to the bill.</p>
                </div>
              )}
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

            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-semibold">Bill Summary</h4>
              <div className="space-y-1 text-sm bg-muted/30 p-3 rounded-md border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Rent Amount ({effectiveBillPeriodMonths.toFixed(2)} {effectiveBillPeriodMonths === 1 ? 'month' : 'months'}
                    {isCustomPeriod ? `, ${billingDurationDays} days` : ''}):
                  </span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
                {totalDamages > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Damages:</span>
                      <span className="text-red-600">₹{totalDamages.toFixed(2)}</span>
                    </div>
                    {newRentalId !== '' && (
                      <>
                        <div className="flex justify-between border-t border-dashed pt-1 mt-1 italic text-xs">
                          <span className="text-muted-foreground">Deposit Available:</span>
                          <span>₹{availableDeposit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Deposit Used for Damages:</span>
                          <span className="text-green-600">-₹{depositUsed.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-muted-foreground">Deposit After Damages:</span>
                          <span>₹{remainingDepositAfterDamages.toFixed(2)}</span>
                        </div>
                        {excessDamages > 0 && (
                          <div className="flex justify-between text-xs text-red-600 font-medium">
                            <span>Excess Damage on Bill:</span>
                            <span>+₹{excessDamages.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {newRentalId === '' && (
                      <div className="flex justify-between text-red-600 font-medium border-t border-dashed pt-1 mt-1">
                        <span>Damage Charges Added:</span>
                        <span>+₹{totalDamages.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {labourCostAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Labour Cost:</span>
                    <span>+₹{labourCostAmount.toFixed(2)}</span>
                  </div>
                )}
                {transportCostAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Transport Cost:</span>
                    <span>+₹{transportCostAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 mt-2 border-t font-bold text-base">
                  <span>Final Payable Amount:</span>
                  <span className="text-primary font-mono">₹{finalPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {editingBillingId != null
                  ? isUpdating
                    ? 'Updating...'
                    : 'Update Billing'
                  : isCreating
                    ? 'Creating...'
                    : 'Create Billing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rental Invoice - Invoice #{selectedBilling?.id}</DialogTitle>
            <DialogDescription>Detailed view of the invoice and its line items.</DialogDescription>
          </DialogHeader>
          {selectedBilling && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-semibold">
                    {selectedBilling.Customer
                      ? `${selectedBilling.Customer.firstName} ${selectedBilling.Customer.lastName}`
                      : selectedBilling.Rental?.Customer
                        ? `${selectedBilling.Rental.Customer.firstName} ${selectedBilling.Rental.Customer.lastName}`
                        : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rental ID</p>
                  <p className="font-semibold">{selectedBilling.rentalId || 'Standalone'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Billing Start Date</p>
                  <p className="font-semibold">{new Date(selectedBilling.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Billing End Date</p>
                  <p className="font-semibold">
                    {selectedBilling.billingEndDate ? new Date(selectedBilling.billingEndDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bill Period</p>
                  <p className="font-semibold">
                    {selectedBilling.billPeriodType === 'custom'
                      ? 'Custom Dates'
                      : `${selectedBilling.billPeriodMonths ?? 1} ${(selectedBilling.billPeriodMonths ?? 1) === 1 ? 'Month' : 'Months'}`}
                    {' '}
                    ({new Date(selectedBilling.dueDate).toLocaleDateString('en-IN')} to{' '}
                    {selectedBilling.billingEndDate
                      ? new Date(selectedBilling.billingEndDate).toLocaleDateString('en-IN')
                      : '—'}
                    )
                  </p>
                </div>
                {selectedBilling.billingDurationDays != null && (
                  <div>
                    <p className="text-muted-foreground">Billing Duration</p>
                    <p className="font-semibold">{selectedBilling.billingDurationDays} days</p>
                  </div>
                )}
                {selectedBilling.Rental?.startDate && selectedBilling.Rental?.endDate && (
                  <div>
                    <p className="text-muted-foreground">Rental Duration</p>
                    <p className="font-semibold">
                      {new Date(selectedBilling.Rental.startDate).toLocaleDateString('en-IN')} to{' '}
                      {new Date(selectedBilling.Rental.endDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                )}
                {(selectedBilling.returnedQuantity != null || selectedBilling.Rental?.status === 'returned') && (
                  <>
                    {selectedBilling.Rental?.endDate && (
                      <div>
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-semibold">
                          {new Date(selectedBilling.Rental.endDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Return Date</p>
                      <p className="font-semibold">
                        {new Date(selectedBilling.returnDate || selectedBilling.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedBilling.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedBilling.status}
                  </span>
                </div>
                {(selectedBilling.Rental?.address ||
                  selectedBilling.Customer?.address ||
                  selectedBilling.Rental?.Customer?.address) && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-semibold whitespace-pre-line">
                      {selectedBilling.Rental?.address ||
                        selectedBilling.Customer?.address ||
                        selectedBilling.Rental?.Customer?.address}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Line Items</h4>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBilling.BillingItems?.map((bi: any) => (
                        <TableRow key={bi.id}>
                          <TableCell>{bi.Item?.name || 'Unknown Item'}</TableCell>
                          <TableCell>{bi.quantity}</TableCell>
                          <TableCell>₹{Number(bi.rate).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">₹{Number(bi.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {(!selectedBilling.BillingItems || selectedBilling.BillingItems.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No items found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedBilling.BillingDamages && selectedBilling.BillingDamages.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">Damages & Deductions</h4>
                  <div className="border rounded-md border-red-100 dark:border-red-900/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBilling.BillingDamages.map((bd: any) => (
                          <TableRow key={bd.id}>
                            <TableCell>{bd.description}</TableCell>
                            <TableCell className="text-right text-red-600">₹{Number(bd.amount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <div className="w-full sm:w-64">
                  <CostBreakdown
                    baseAmount={
                      Number(selectedBilling.amount) -
                      (Number(selectedBilling.labourCost) || 0) -
                      (Number(selectedBilling.transportCost) || 0)
                    }
                    transportCost={Number(selectedBilling.transportCost) || 0}
                    labourCost={Number(selectedBilling.labourCost) || 0}
                    depositAmount={Number(selectedBilling.Rental?.depositAmount) || 0}
                    showDeposit={false}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
