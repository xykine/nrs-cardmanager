import React from "react";

interface AlertProps {
  errors: string[];
  onClose: () => void;
}

const ErrorAlert: React.FC<AlertProps> = ({ errors, onClose }) => {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="relative rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 shadow-sm"
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close alert"
        className="absolute right-3 top-3 text-red-500 hover:text-red-700 focus:outline-none"
      >
        ✕
      </button>

      {/* Header */}
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className="text-lg">⚠️</span>
        <span>Photo Validation Failed</span>
      </div>

      {/* Error List */}
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

export default ErrorAlert;