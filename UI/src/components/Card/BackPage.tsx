import BackPageImage from "../../assets/BackPageImage.png";
import ContractorBackPageImage from "../../assets/ContractorBackPageImage.jpg";
import ConsultantBackPageImage from "../../assets/ConsultantBackPage.jpg";
import GDBackPageImage from "../../assets/GDBackPage.jpg";
import TransportAssistantBackPageImage from "../../assets/TransportAssistantBackPage.jpg";
import moment from "moment";
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

const getBackPageImageByPosition = (position: string) => {
  switch (position.toLowerCase()) {
    case "contractor":
      return ContractorBackPageImage;
    case "consultant":
      return ConsultantBackPageImage;
    case "group director":
      return GDBackPageImage;
    case "transport assistant":
      return TransportAssistantBackPageImage;
    default:
      return BackPageImage;
  }
}

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

      {!employee.position &&
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


      {employee.position &&
        <div className="bg-white shadow-xl max-w-[560px] overflow-hidden border border-gray-200 relative">
          <img
            src={getBackPageImageByPosition(employee.position)}
            alt="ID Card Back"
            className="w-full h-full object-cover"
          />
          {/* QR Code Overlay */}
          <div className="absolute top-[38.5%] left-[15.5%] -translate-x-1/2">
            <img
              src={`${API_BASE_URL}/cards/employee/${employee.employeeId}/qr`}
              alt="Employee QR Code"
              style={{ width: '85.5px', height: '85.5px' }}
            />
          </div>

          <div className="absolute left-[51%] top-[59%] text-left flex flex-col gap-0">
            <p className="m-0 text-[0.85rem] leading-[1.2] text-gray-800">
              {moment(employee.employmentStartDate).format("DD/MM/YYYY")}
            </p>

            <p className="m-0 text-[0.85rem] leading-[1.2] text-gray-800">
              {moment(employee.employmentEndDate).format("DD/MM/YYYY")}
            </p>
          </div>

        </div>
      }
    </div>
  );
};

export default BackPage;
