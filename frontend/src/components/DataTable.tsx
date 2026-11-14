import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText: string;
  getRowId: (row: T, index: number) => string;
  /** Mobile: stack cells with their column label instead of scrolling sideways. */
  stackOnMobile?: boolean;
  caption?: string;
}

export function DataTable<T>({
  columns,
  rows,
  emptyText,
  getRowId,
  stackOnMobile = true,
  caption,
}: DataTableProps<T>): JSX.Element {
  return (
    <div className="desk-table-wrap" data-stack={stackOnMobile ? "true" : "false"}>
      <table className="desk-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.className}
                data-align={column.align}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="desk-table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowId(row, index)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.className}
                    data-label={column.header}
                    data-align={column.align}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
