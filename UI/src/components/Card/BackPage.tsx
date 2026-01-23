import React from "react";
import { Phone } from "lucide-react";
import SignatureBlock from "./SignatureBlock";

export type BackPageProps = {
  nrsLogoSrc: string;
  chairmanSignatureSrc: string;

  /** Optional: show/hide the "Back Side" label (hidden in print by default) */
  showTitle?: boolean;

  /** Optional: override contact details */
  phoneText?: string;
  emailText?: string;

  /** Optional: wrapper className */
  className?: string;
};

const BackPage: React.FC<BackPageProps> = ({
  nrsLogoSrc,
  chairmanSignatureSrc,
  showTitle = true,
  phoneText = "0907 211 1111; 0907 444 4441",
  emailText = "lostcard@nrs.gov.ng",
  className = "",
}) => {
  return (
    <div className={className}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
          Back Side
        </h2>
      )}

      <div className="bg-white rounded-2xl shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="flex flex-col h-full">
          {/* Top: Logo */}
          <div className="p-14">
            <div className="flex justify-center">
              <img src={nrsLogoSrc} alt="NRS" className="h-15 object-contain" />
            </div>
          </div>

          {/* Middle: Content */}
          <div className="flex-1 px-10 flex flex-col items-center justify-center text-center">
            <p className="text-[12px] font-semibold text-gray-600">
              This is a property of
            </p>
            <p className="text-[12px] font-semibold text-gray-600 mt-0">
              Nigeria Revenue Service
            </p>

            <div className="mt-6 space-y-0">
              <p className="text-[12px] text-gray-600">
                If found, please return to any
              </p>
              <p className="text-[12px] text-gray-600">
                NRS office or contact below:
              </p>
            </div>

            {/* Contacts */}
            <div className="ml-20 mt-6 w-full space-y-0 mb-4">
              <div className="ml-6 flex items-start justify-start gap-2">
                <Phone className="w-3 h-3 text-red-600" />
                <span className="text-[12px] font-medium text-gray-800">
                  {phoneText}
                </span>
              </div>

              <div className="ml-6 flex items-start justify-start gap-2">
                {/* red dot bullet like the image */}
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                <span className="text-[12px] font-medium text-gray-800">
                  {emailText}
                </span>
              </div>
            </div>
          </div>

          {/* Signature + Red band */}
          <SignatureBlock signatureSrc={chairmanSignatureSrc} />

          {/* Spacer (kept from your layout) */}
          <div className="w-full flex items-center gap-2 mt-20" />
        </div>
      </div>
    </div>
  );
};

export default BackPage;
