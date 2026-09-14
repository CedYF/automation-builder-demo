"use client";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalComments: number;
  totalPages: number;
}

interface PaginationControlsProps {
  paginationInfo: PaginationInfo;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  paginationInfo,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}) => {
  const { totalComments, totalPages } = paginationInfo;
  const startRow = totalComments > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRow = Math.min(currentPage * pageSize, totalComments);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (totalComments === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-2 py-4 flex-wrap gap-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              onPageSizeChange(Number(value));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={`${pageSize}`} />
            </SelectTrigger>
            <SelectContent side="top">
              {[9, 10, 25, 50, 100, 250, 500].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startRow}</span> to{" "}
          <span className="font-medium text-foreground">{endRow}</span> of{" "}
          <span className="font-medium text-foreground">{totalComments}</span> comments
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
          Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={!canGoPrevious || disabled}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious || disabled}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext || disabled}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext || disabled}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
