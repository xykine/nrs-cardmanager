import React, { RefObject, useState, useRef, useEffect } from "react";
import { RefreshCw, Upload, ZoomIn, ZoomOut } from "lucide-react";

export type FrontPageEmployee = {
  name: string;
  employeeId: string;
};

export type FrontPageProps = {
  employee: FrontPageEmployee;

  /** Base logos */
  nrsLogoSrc: string;
  nrsLogoBottomBarSrc: string;
  middleAccentSrc: string;

  /** Photo state */
  photoData?: string | null;
  validating?: boolean;
  fileInputRef?: RefObject<HTMLInputElement>;

  /** Positioning */
  photoX?: number;
  photoY?: number;
  photoScale?: number;
  onPositionChange?: (x: number, y: number, scale: number) => void;
  isEditable?: boolean;

  /** Optional */
  showTitle?: boolean;
  className?: string;
  currentUserRole?: string;
};

const FrontPage: React.FC<FrontPageProps> = ({
  employee,
  nrsLogoSrc,
  nrsLogoBottomBarSrc,
  middleAccentSrc,
  photoData,
  validating = false,
  fileInputRef,
  photoX = 0,
  photoY = 0,
  photoScale = 1.0,
  onPositionChange,
  isEditable = true,
  showTitle = true,
  className = "",
  currentUserRole = "staff",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditable || !photoData) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - photoX, y: e.clientY - photoY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    onPositionChange(newX, newY, photoScale);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, photoScale, onPositionChange]);

  const handleZoom = (newScale: number) => {
    if (onPositionChange) {
      onPositionChange(photoX, photoY, Math.max(0.1, Math.min(5, newScale)));
    }
  };

  const [aspect, setAspect] = useState(1);

  return (
    <div className={className}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
          Front Side
        </h2>
      )}

      <div className="bg-white shadow-xl aspect-[3/5] w-full max-w-sm  border border-gray-200">
        <div className="flex flex-col h-full items-center">
          {/* Logo */}
          <div className="p-14">
            <div className="flex justify-center">
              {currentUserRole === "manager" ? (
                <img src={nrsLogoSrc} alt="NRS" className="h-15 object-contain" />
              ) : (
                <div className="h-15 object-contain" style={{ backgroundColor: "#FF0000" }}></div>
              )}
            </div>
          </div>

          {/* Photo */}
          <div className="relative group">
            <div
              ref={containerRef}
              className={`w-48 h-60 border-[4px] border-gray-400 overflow-hidden  relative ${isEditable && photoData ? 'cursor-move' : ''}`}
              onMouseDown={handleMouseDown}
            >
              {photoData && !validating ? (
                <img
                  src={photoData}
                  alt={employee.name}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setAspect(img.naturalWidth / img.naturalHeight);
                  }}
                  className="absolute pointer-events-none select-none left-1/2 top-1/2"
                  style={{
                    maxWidth: 'none',
                    width: aspect > 1 ? 'auto' : '100%',
                    height: aspect > 1 ? '100%' : 'auto',
                    minWidth: '100%',
                    minHeight: '100%',
                    transform: `translate(calc(-50% + ${photoX}px), calc(-50% + ${photoY}px)) scale(${photoScale})`,
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  {validating ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                      <span className="text-xs text-blue-600 font-medium">
                        Validating...
                      </span>
                    </div>
                  ) : (
                    <Upload
                      onClick={() => fileInputRef?.current?.click()}
                      className="w-14 h-14 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                    />
                  )}
                </div>
              )}
            </div>

            {isEditable && photoData && !validating && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                <button
                  onClick={() => handleZoom(photoScale - 0.1)}
                  className="p-1 hover:bg-gray-100 rounded-full text-slate-600"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.05"
                  value={photoScale}
                  onChange={(e) => handleZoom(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <button
                  onClick={() => handleZoom(photoScale + 0.1)}
                  className="p-1 hover:bg-gray-100 rounded-full text-slate-600"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Middle accent */}
          {currentUserRole === "manager" && (
            <div className="flex items-center mt-[-32px]">
              <img
                src={middleAccentSrc}
                alt="Middle Accent"
                className="h-25"
              />
            </div>
          )}

          {/* Name */}
          <h3 className="text-3xl font-bold text-gray-900 tracking-wide text-center">
            {employee.name.toUpperCase()}
          </h3>

          {/* Employee ID */}
          <p className="text-xl font-semibold text-gray-600 mt-4">
            IR {employee.employeeId}
          </p>
        </div>

        {/* Bottom accent */}
        {currentUserRole === "manager" && (
          <div className="flex items-center gap-2 mr-20">
            <img
              src={nrsLogoBottomBarSrc}
              alt="NRS Logo Bottom Bar"
              className="h-25"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FrontPage;
