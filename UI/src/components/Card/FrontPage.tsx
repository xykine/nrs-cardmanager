import React, { RefObject } from "react";
import { RefreshCw, Upload } from "lucide-react";

export type FrontPageEmployee = {
  name: string;
  employeeId: string;
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

  /** Optional */
  showTitle?: boolean;
  className?: string;
};

const FrontPage: React.FC<FrontPageProps> = ({
  employee,
  nrsLogoSrc,
  nrsLogoBottomBarSrc,
  photoData,
  validating = false,
  fileInputRef,
  showTitle = true,
  className = "",
}) => {
  return (
    <div className={className}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
          Front Side
        </h2>
      )}

      <div className="bg-white rounded-2xl shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="flex flex-col h-full items-center">
          {/* Logo */}
          <div className="p-14">
            <div className="flex justify-center">
              <img src={nrsLogoSrc} alt="NRS" className="h-15 object-contain" />
            </div>
          </div>

          {/* Photo */}
          <div className="w-52 h-52 border-[8px] border-red-600 rounded-md overflow-hidden bg-gray-100 mb-6">
            {photoData && !validating ? (
              <img
                src={photoData}
                alt={employee.name}
                className="w-full h-full object-cover"
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

          {/* Name */}
          <h3 className="text-3xl font-bold text-gray-600 tracking-wide text-center">
            {employee.name.toUpperCase()}
          </h3>

          {/* Employee ID */}
          <p className="text-l font-semibold text-gray-600 mt-10">
            IR {employee.employeeId}
          </p>

          {/* Bottom accent */}
          <div className="flex items-center gap-2 mx-20 mt-2">
            <img
              src={nrsLogoBottomBarSrc}
              alt="NRS Logo Bottom Bar"
              className="h-25"
            />
          </div>

          {/* Spacer */}
          <div className="w-full flex items-center gap-2 mt-10" />
        </div>
      </div>
    </div>
  );
};

export default FrontPage;
