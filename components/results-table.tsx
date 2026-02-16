"use client";

import { Fragment, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Star,
  ThumbsUp,
  ThumbsDown,
  StickyNote,
  CloudRain,
  Microscope,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { parseProperties, defaultBoatProperties, type BoatProperties } from "@/lib/types";
import { formatPrice, formatLength, cn } from "@/lib/utils";
import { ListingDetail } from "./listing-detail";

interface ResultsTableProps {
  data: Listing[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onUpdateListing: (
    id: number,
    data: Partial<Pick<Listing, "notes" | "thumbs" | "favorite" | "properties">>
  ) => void;
  onResearch: (listing: Listing) => void;
}

const columns: ColumnDef<Listing>[] = [
  {
    id: "expand",
    header: "",
    cell: ({ row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          row.toggleExpanded();
        }}
        className="p-0.5 hover:text-foreground text-muted-foreground transition-colors"
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
    ),
    enableSorting: false,
    enableResizing: false,
    size: 28,
  },
  {
    id: "indicators",
    header: "",
    cell: ({ row }) => {
      const { favorite, thumbs, notes, properties, hasResearch } = row.original;
      const hasNotes = !!notes;
      const props = parseProperties(properties);
      const hasBadProps = (Object.keys(defaultBoatProperties) as (keyof BoatProperties)[]).some(
        (k) => props[k]
      );
      if (!favorite && !thumbs && !hasNotes && !hasBadProps && !hasResearch) return null;
      return (
        <div className="flex items-center gap-1">
          {favorite && (
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-current" />
          )}
          {thumbs === "up" && (
            <ThumbsUp className="h-3 w-3 text-green-400" />
          )}
          {thumbs === "down" && (
            <ThumbsDown className="h-3 w-3 text-red-400" />
          )}
          {hasNotes && (
            <StickyNote className="h-3 w-3 text-blue-400" />
          )}
          {hasBadProps && (
            <CloudRain className="h-3 w-3 text-muted-foreground" />
          )}
          {hasResearch && (
            <Microscope className="h-3 w-3 text-purple-400" />
          )}
        </div>
      );
    },
    enableSorting: false,
    enableResizing: false,
    size: 80,
  },
  {
    id: "image",
    header: "",
    cell: ({ row }) => {
      const url = row.original.imgUrl;
      if (!url)
        return <div className="h-12 w-16 min-w-16 rounded bg-muted" />;
      return (
        <a
          href={row.original.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={url}
            alt={row.original.listingName ?? "Boat"}
            className="h-12 w-16 min-w-16 rounded object-cover hover:opacity-80 transition-opacity"
          />
        </a>
      );
    },
    enableSorting: false,
    enableResizing: false,
    size: 80,
    minSize: 80,
  },
  {
    accessorKey: "listingName",
    header: "Listing",
    cell: ({ row }) => {
      const name = row.original.listingName;
      return <span className="font-medium">{name ?? "Unknown"}</span>;
    },
    size: 220,
  },
  {
    accessorKey: "manufacturer",
    header: "Manufacturer",
    size: 120,
  },
  {
    accessorKey: "buildYear",
    header: "Year",
    sortingFn: "basic",
    size: 60,
  },
  {
    accessorKey: "boatClass",
    header: "Class",
    size: 110,
  },
  {
    accessorKey: "lengthInMeters",
    header: "Length",
    cell: ({ row }) => formatLength(row.original.lengthInMeters),
    sortingFn: "basic",
    size: 80,
  },
  {
    accessorKey: "priceUSD",
    header: "Price",
    cell: ({ row }) => formatPrice(row.original.priceUSD),
    sortingFn: "basic",
    size: 90,
  },
  {
    accessorKey: "state",
    header: "State",
    size: 55,
  },
];

export function ResultsTable({
  data,
  sorting,
  onSortingChange,
  onUpdateListing,
  onResearch,
}: ResultsTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, expanded },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onExpandedChange: setExpanded,
    getRowId: (row) => String(row.id),
    getRowCanExpand: () => true,
    initialState: {
      pagination: { pageSize: 50 },
    },
    autoResetPageIndex: true,
  });

  return (
    <>
      <div className="overflow-auto rounded-lg border border-border max-h-[calc(100vh-270)]">
        <table className="text-sm" style={{ minWidth: "100%", width: table.getCenterTotalSize() }}>
          <thead className="bg-card sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap relative group"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                          "opacity-0 group-hover:opacity-100 bg-border hover:bg-primary transition-colors",
                          header.column.getIsResizing() && "opacity-100 bg-primary"
                        )}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No listings match your filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-t border-border hover:bg-muted transition-colors cursor-pointer",
                      row.getIsExpanded() && "bg-muted"
                    )}
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr className="border-t border-border bg-card">
                      <td colSpan={columns.length}>
                        <ListingDetail
                          listing={row.original}
                          onUpdate={onUpdateListing}
                          onResearch={onResearch}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
