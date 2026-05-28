import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

interface GenericTableProps<T> {
  data: T[];
  columns: {
    header: string;
    render: (item: T) => React.ReactNode;
    className?: string;
    width?: string;
  }[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function GenericTable<T>({
  data,
  columns,
  isLoading,
  emptyMessage = 'No records found.',
}: GenericTableProps<T>) {
  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="py-10 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={idx} style={{ width: col.width }} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow key={idx}>
              {columns.map((col, cIdx) => (
                <TableCell key={cIdx} className={col.className}>
                  {col.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
