'use client';

import { useMemo, useState } from 'react';
import { useGetBillingsQuery } from '@/api/billingApi';
import { useGetRentalsQuery } from '@/api/rentalApi';
import { useGetCustomersQuery } from '@/api/customerApi';
import { useGetItemsQuery } from '@/api/itemApi';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Key, Users, Package, ReceiptText, TrendingUp } from 'lucide-react';
import { compareValues, getNextSortDirection, type SortDirection } from '@/lib/tableUtils';

export default function Dashboard() {
  const [billingStatusFilter, setBillingStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [billingSortKey, setBillingSortKey] = useState<'rentalId' | 'amount' | 'status'>('rentalId');
  const [billingSortDirection, setBillingSortDirection] = useState<SortDirection>('asc');
  const { data: billings = [], isLoading: isBillingsLoading } = useGetBillingsQuery();
  const { data: rentals = [] } = useGetRentalsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: items = [] } = useGetItemsQuery();

  const stats = useMemo(
    () => [
      {
        label: 'Active Rentals',
        value: rentals.filter((r) => r.status === 'active').length,
        icon: Key,
        color: 'text-blue-600',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
      },
      {
        label: 'Total Customers',
        value: customers.length,
        icon: Users,
        color: 'text-purple-600',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
      },
      {
        label: 'Items in Stock',
        value: items.reduce((acc, item) => acc + item.quantity, 0),
        icon: Package,
        color: 'text-orange-600',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
      },
      {
        label: 'Pending Bills',
        value: billings.filter((b) => b.status === 'pending').length,
        icon: ReceiptText,
        color: 'text-yellow-600',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      },
    ],
    [rentals, customers, items, billings],
  );

  const totalRevenue = useMemo(
    () => billings.filter((b) => b.status === 'paid').reduce((acc, b) => acc + Number(b.amount), 0),
    [billings],
  );

  const filteredRecentBillings = useMemo(() => {
    return billings.filter((bill) => billingStatusFilter === 'all' || bill.status === billingStatusFilter);
  }, [billings, billingStatusFilter]);

  const sortedRecentBillings = useMemo(() => {
    return [...filteredRecentBillings]
      .sort((left, right) => {
        switch (billingSortKey) {
          case 'rentalId':
            return compareValues(left.rentalId ?? 0, right.rentalId ?? 0, billingSortDirection);
          case 'amount':
            return compareValues(Number(left.amount), Number(right.amount), billingSortDirection);
          case 'status':
            return compareValues(left.status, right.status, billingSortDirection);
          default:
            return 0;
        }
      })
      .slice(0, 5);
  }, [billingSortDirection, billingSortKey, filteredRecentBillings]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to your rental management overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <div className={`${stat.bg} p-2 rounded-md`}>
                  <Icon className={`size-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Recent Billings</CardTitle>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={billingStatusFilter}
                onChange={(e) =>
                  setBillingStatusFilter(e.target.value as 'all' | 'pending' | 'paid' | 'overdue')
                }
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {isBillingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading bills...</p>
            ) : sortedRecentBillings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bills yet.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        label="Rental ID"
                        isActive={billingSortKey === 'rentalId'}
                        direction={billingSortDirection}
                        onClick={() => {
                          setBillingSortDirection(
                            getNextSortDirection(billingSortKey, billingSortDirection, 'rentalId'),
                          );
                          setBillingSortKey('rentalId');
                        }}
                      />
                      <SortableTableHead
                        label="Amount"
                        isActive={billingSortKey === 'amount'}
                        direction={billingSortDirection}
                        onClick={() => {
                          setBillingSortDirection(getNextSortDirection(billingSortKey, billingSortDirection, 'amount'));
                          setBillingSortKey('amount');
                        }}
                      />
                      <SortableTableHead
                        label="Status"
                        isActive={billingSortKey === 'status'}
                        direction={billingSortDirection}
                        onClick={() => {
                          setBillingSortDirection(getNextSortDirection(billingSortKey, billingSortDirection, 'status'));
                          setBillingSortKey('status');
                        }}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecentBillings.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono text-xs">{bill.rentalId}</TableCell>
                        <TableCell className="font-semibold">₹{Number(bill.amount)?.toFixed(2)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              bill.status === 'paid'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : bill.status === 'overdue'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}
                          >
                            {bill.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-green-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-2">Combined revenue from all paid bills.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
