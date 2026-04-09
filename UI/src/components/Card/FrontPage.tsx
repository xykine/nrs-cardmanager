import React, { RefObject, useState, useRef, useEffect } from "react";
import { RefreshCw, Upload, ZoomIn, ZoomOut } from "lucide-react";
import ContractorFrontPageImage from "../../assets/ContractorFrontPageImage.jpg";
import ConsultantFrontPageImage from "../../assets/ConsultantFrontPage.jpg";
import GDFrontPageImage from "../../assets/GDFrontPage.jpg";
import TransportAssistantFrontPageImage from "../../assets/TransportAssistantFrontPage.jpg";

export type FrontPageEmployee = {
  name: string;
  employeeId: string;
  position: string;
};

export type FrontPageProps = {
  employee: FrontPageEmployee;

  /** Base logos */
  nrsLogoSrc: string;
  nrsLogoBottomBarSrc: string;

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

  console.log(employee.employeeId.length)

  const getFrontPageImageByPosition = (position: string) => {
    switch (position.toLowerCase()) {
      case "contractor":
        return ContractorFrontPageImage;
      case "consultant":
        return ConsultantFrontPageImage;
      case "gd":
        return GDFrontPageImage;
      case "transport assistant":
        return TransportAssistantFrontPageImage;
      default:
        return ContractorFrontPageImage;
    }
  }

  return (
    <div className={className}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
          Front Side
        </h2>
      )}
      {employee.employeeId.length <= 5 && (
        <div className="bg-white rounded-2xl shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200">
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
                className={`w-52 h-52 border-[8px] border-red-600 rounded-md overflow-hidden bg-gray-100 mb-6 relative ${isEditable && photoData ? 'cursor-move' : ''}`}
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
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
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

            <h3 className="text-3xl font-bold text-gray-600 tracking-wide text-center">
              {employee.name.toUpperCase()}
            </h3>

            {/* Employee ID */}
            <p className="text-l font-semibold text-gray-600 mt-10">
              IR {employee.employeeId}
            </p>

            {/* Bottom accent */}
            {currentUserRole === "manager" && (
              <div className="flex items-center gap-2 mx-20 mt-2">
                <img
                  src={nrsLogoBottomBarSrc}
                  alt="NRS Logo Bottom Bar"
                  className="h-25"
                />
              </div>
            )}

            {/* Spacer */}
            <div className="w-full flex items-center gap-2 mt-10" />
          </div>
        </div>
      )}

      {employee.employeeId.length > 5 && (

        <div
          className="relative max-w-[560px] aspect-[1.5/1] overflow-hidden border border-gray-300 bg-white shadow-xl"
          style={
            currentUserRole.toLowerCase() === "manager"
              ? {
                backgroundImage: `url(${getFrontPageImageByPosition(employee.position)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
              : {
                backgroundColor: "white",
              }
          }
        >

          {/* Content Layer */}
          <div className="absolute inset-0">
            {/* Photo block */}
            <div className="absolute left-[7.5%] top-[22%]">
              <div className="relative group">
                <div
                  ref={containerRef}
                  className={`w-52 h-52 rounded-md overflow-hidden bg-gray-100 mb-6 relative ${isEditable && photoData ? 'cursor-move' : ''}`}
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
                      className="absolute left-1/2 top-1/2 pointer-events-none select-none"
                      style={{
                        maxWidth: "none",
                        width: aspect > 1 ? "auto" : "100%",
                        height: aspect > 1 ? "100%" : "auto",
                        minWidth: "100%",
                        minHeight: "100%",
                        transform: `translate(calc(-50% + ${photoX}px), calc(-50% + ${photoY}px)) scale(${photoScale})`,
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100">
                      {validating ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">
                            Validating...
                          </span>
                        </div>
                      ) : (
                        <Upload
                          onClick={() => fileInputRef?.current?.click()}
                          className="h-14 w-14 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
                        />
                      )}
                    </div>
                  )}
                </div>

                {isEditable && photoData && !validating && (
                  <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
                    <button
                      onClick={() => handleZoom(photoScale - 0.1)}
                      className="rounded-full p-1 text-slate-600 hover:bg-gray-100"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>

                    <input
                      type="range"
                      min="0.1"
                      max="5"
                      step="0.05"
                      value={photoScale}
                      onChange={(e) => handleZoom(parseFloat(e.target.value))}
                      className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                    />

                    <button
                      onClick={() => handleZoom(photoScale + 0.1)}
                      className="rounded-full p-1 text-slate-600 hover:bg-gray-100"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Text block */}
            <div className="absolute left-[42%] top-[27%] text-left">
              <h3 className="text-[2rem] font-extrabold uppercase leading-none tracking-wide text-black">
                {employee.name}
              </h3>

              <p className="mt-3 text-[1.1rem] font-medium uppercase tracking-wide text-gray-800">
                IRCONS {employee.employeeId}
              </p>

              <p className="mt-2 text-[1.8rem] font-medium uppercase tracking-wide text-gray-900">
                {employee.position}
              </p>
            </div>
          </div>
        </div>


      )}

    </div>
  );
};

export default FrontPage;

