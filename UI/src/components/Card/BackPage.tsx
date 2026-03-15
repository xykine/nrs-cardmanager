import BackPageImage from "../../assets/BackPageImage.png";
import ContractorBackPageImage from "../../assets/ContractorBackPageImage.jpg";
import { FrontPageEmployee } from "./FrontPage";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type BackPageProps = {
  /** Optional: show/hide the "Back Side" label (hidden in print by default) */
  showTitle?: boolean;

  /** Optional: wrapper className */
  className?: string;

  /** Optional: employee data */
  employee: FrontPageEmployee;
};

const BackPage: React.FC<BackPageProps> = ({
  showTitle = true,
  className = "",
  employee,
}) => {
  return (
    <div className={className}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
          Back Side
        </h2>
      )}

      {employee.employeeId.length <= 5 &&
        <div className="bg-white shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200 relative">
          <img
            src={BackPageImage}
            alt="ID Card Back"
            className="w-full h-full object-cover"
          />
          {/* QR Code Overlay */}
          <div className="absolute top-[23.5%] left-1/2 -translate-x-1/2">
            <img
              src={`${API_BASE_URL}/cards/employee/${employee.employeeId}/qr`}
              alt="Employee QR Code"
              style={{ width: '120px', height: '120px' }}
            />
          </div>
        </div>
      }


      {employee.employeeId.length > 5 &&
        <div className="bg-white shadow-xl max-w-[560px] overflow-hidden border border-gray-200 relative">
          <img
            src={ContractorBackPageImage}
            alt="ID Card Back"
            className="w-full h-full object-cover"
          />
          {/* QR Code Overlay */}
          <div className="absolute top-[38.5%] left-[16%] -translate-x-1/2">
            <img
              src={`${API_BASE_URL}/cards/employee/${employee.employeeId}/qr`}
              alt="Employee QR Code"
              style={{ width: '120px', height: '120px' }}
            />
          </div>
        </div>
      }
    </div>
  );
};

export default BackPage;
