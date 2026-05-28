'use client';

import React, { useState, useMemo } from 'react';
import {
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/api/customerApi';
import type { Customer } from '@/api/customerApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { compareValues, getNextSortDirection, type SortDirection } from '@/lib/tableUtils';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomerRowProps {
  customer: Customer;
  onDelete: (id: number) => void;
  onEdit: (customer: Customer) => void;
}
const CustomerRow = React.memo(function CustomerRow({ customer, onDelete, onEdit }: CustomerRowProps) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{customer.id}</TableCell>
      <TableCell className="font-medium">
        {customer.firstName} {customer.lastName}
      </TableCell>
      <TableCell>{customer.email || <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell>{customer.phone || 'N/A'}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="icon-xs" variant="ghost" onClick={() => onEdit(customer)}>
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-destructive"
            onClick={() => onDelete(customer.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'email' | 'phone'>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const pageSize = 10;
  const [page, setPage] = useState(0);

  const { data: allCustomers = [], isLoading } = useGetCustomersQuery();

  const filteredCustomers = useMemo(() => {
    return allCustomers.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [allCustomers, searchTerm]);

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((left, right) => {
      switch (sortKey) {
        case 'id':
          return compareValues(left.id, right.id, sortDirection);
        case 'name':
          return compareValues(
            `${left.firstName} ${left.lastName}`,
            `${right.firstName} ${right.lastName}`,
            sortDirection,
          );
        case 'email':
          return compareValues(left.email ?? '', right.email ?? '', sortDirection);
        case 'phone':
          return compareValues(left.phone || '', right.phone || '', sortDirection);
        default:
          return 0;
      }
    });
  }, [filteredCustomers, sortDirection, sortKey]);

  const paginatedCustomers = useMemo(
    () => sortedCustomers.slice(page * pageSize, (page + 1) * pageSize),
    [sortedCustomers, page, pageSize],
  );

  const totalPages = Math.ceil(sortedCustomers.length / pageSize);

  const [createCustomer] = useCreateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const [updateCustomer] = useUpdateCustomerMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail !== '' && !EMAIL_RE.test(trimmedEmail)) {
      toast.error('Please enter a valid email address or leave the field blank');
      return;
    }
    try {
      await createCustomer({
        firstName,
        lastName,
        email: trimmedEmail === '' ? undefined : trimmedEmail,
        phone,
      }).unwrap();
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setAddOpen(false);
      toast.success('Customer added successfully');
    } catch {
      toast.error('Failed to add customer');
    }
  };

  const handleEdit = async () => {
    if (!editingCustomer) return;
    try {
      await updateCustomer({
        id: editingCustomer.id,
        data: { phone: editPhone, address: editAddress },
      }).unwrap();
      setEditOpen(false);
      setEditingCustomer(null);
      toast.success('Customer updated successfully');
    } catch {
      toast.error('Failed to update customer');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database and contact information.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="size-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading customers...</div>
          ) : sortedCustomers.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No customers found.</div>
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
                      label="Email"
                      isActive={sortKey === 'email'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'email'));
                        setSortKey('email');
                      }}
                    />
                    <SortableTableHead
                      label="Phone"
                      isActive={sortKey === 'phone'}
                      direction={sortDirection}
                      onClick={() => {
                        setSortDirection(getNextSortDirection(sortKey, sortDirection, 'phone'));
                        setSortKey('phone');
                      }}
                    />
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((c) => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onDelete={deleteCustomer}
                      onEdit={(cust) => {
                        setEditingCustomer(cust);
                        setEditPhone(cust.phone || '');
                        setEditAddress(cust.address || '');
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
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Input id="editAddress" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
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
