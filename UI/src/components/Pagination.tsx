interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    itemName?: string;
    className?: string;
}

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [20, 50, 100, 200],
    itemName = "item",
    className = "",
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    if (totalItems === 0) {
        return null;
    }

    return (
        <div
            className={`px-6 py-4 border-t border-slate-200 flex items-center justify-between ${className}`}
        >
            <div className="flex items-center gap-4 text-sm text-slate-600">
                <span>
                    Showing {startItem} to {endItem} of {totalItems.toLocaleString()}{" "}
                    {itemName}
                    {totalItems !== 1 ? "s" : ""}
                </span>

                {onPageSizeChange && (
                    <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
                        <span>Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === 1
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                >
                    Previous
                </button>
                <span className="px-4 py-2 text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage >= totalPages
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}