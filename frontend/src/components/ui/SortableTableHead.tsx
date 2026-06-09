import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortDirection = "asc" | "desc" | null;

interface SortableTableHeadProps {
  label: string;
  columnKey: string;
  currentSortColumn: string | null;
  currentSortDirection: SortDirection;
  onSort: (columnKey: string, direction: SortDirection) => void;
  className?: string;
}

export function SortableTableHead({
  label,
  columnKey,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className = "",
}: SortableTableHeadProps) {
  const isActive = currentSortColumn === columnKey;

  const handleClick = () => {
    if (!isActive) {
      onSort(columnKey, "asc");
    } else if (currentSortDirection === "asc") {
      onSort(columnKey, "desc");
    } else {
      onSort(columnKey, null);
    }
  };

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}
