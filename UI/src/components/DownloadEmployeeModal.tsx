import { useState } from "react";
import { Download, X } from "lucide-react";

interface DownloadEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (option: "all" | "filtered" | "selected") => void;
    hasSelection: boolean;
    hasFilters: boolean;
}

export default function DownloadEmployeeModal({
    isOpen,
    onClose,
    onSubmit,
    hasSelection,
    hasFilters,
}: DownloadEmployeeModalProps) {
    const [selectedOption, setSelectedOption] = useState<"all" | "filtered" | "selected">("all");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4 relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Download className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Download Employees</h2>
                    <p className="text-slate-600 mt-1">Select which employees you want to download.</p>
                </div>

                <div className="space-y-3 mb-8">
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                            type="radio"
                            name="downloadOption"
                            value="all"
                            checked={selectedOption === "all"}
                            onChange={() => setSelectedOption("all")}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-700">Download All Employees</span>
                    </label>

                    {hasFilters && (
                        <label className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${!hasFilters ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer hover:bg-slate-50 border-slate-200'}`}>
                            <input
                                type="radio"
                                name="downloadOption"
                                value="filtered"
                                checked={selectedOption === "filtered"}
                                onChange={() => setSelectedOption("filtered")}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-slate-700">Download Filtered Employees</span>
                        </label>
                    )}

                    {hasSelection && (
                        <label className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${!hasSelection ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer hover:bg-slate-50 border-slate-200'}`}>
                            <input
                                type="radio"
                                name="downloadOption"
                                value="selected"
                                checked={selectedOption === "selected"}
                                onChange={() => setSelectedOption("selected")}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-slate-700">Download Selected Employees</span>
                        </label>
                    )}


                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(selectedOption)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                </div>
            </div>
        </div>
    );
}
