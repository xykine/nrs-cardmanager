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

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${currentPage === 1
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                >
                    Previous
                </button>

                <div className="flex items-center gap-1 mx-2">
                    {(() => {
                        const pages = [];
                        const maxVisible = 5;

                        if (totalPages <= maxVisible + 2) {
                            for (let i = 1; i <= totalPages; i++) {
                                pages.push(i);
                            }
                        } else {
                            pages.push(1);
                            if (currentPage > 3) {
                                pages.push("ellipsis-start");
                            }

                            const start = Math.max(2, currentPage - 1);
                            const end = Math.min(totalPages - 1, currentPage + 1);

                            if (currentPage <= 3) {
                                for (let i = 2; i <= 4; i++) {
                                    pages.push(i);
                                }
                            } else if (currentPage >= totalPages - 2) {
                                for (let i = totalPages - 3; i <= totalPages - 1; i++) {
                                    pages.push(i);
                                }
                            } else {
                                for (let i = start; i <= end; i++) {
                                    pages.push(i);
                                }
                            }

                            if (currentPage < totalPages - 2) {
                                pages.push("ellipsis-end");
                            }
                            pages.push(totalPages);
                        }

                        return pages.map((page, index) => {
                            if (typeof page === "string") {
                                return (
                                    <span key={index} className="px-2 text-slate-400">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={index}
                                    onClick={() => onPageChange(page)}
                                    className={`w-9 h-9 rounded-lg font-medium transition-all ${currentPage === page
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                        : "bg-white text-slate-600 border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                        }`}
                                >
                                    {page}
                                </button>
                            );
                        });
                    })()}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${currentPage >= totalPages
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