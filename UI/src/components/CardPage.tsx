import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Employee } from "../types";
import { employeeService, cardService } from "../services/api";
import {
  Upload,
  Printer,
  Mail,
  Save,
  ArrowLeft,
  Phone,
  LogOut,
} from "lucide-react";
import { useNotification } from "../contexts/NotificationContext";
import EmailDialog from "./EmailDialog";
import nrsLogo from "../assets/logoNRS.png";
import nrsLogoBottomBar from "../assets/logoBottomBar.png";
import nrsLogo2 from "../assets/nrs-logo.png";
import ErrorAlert from "./ErrorAlert";

export default function CardPage({ onLogout }: { onLogout: () => void }) {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserRole = sessionStorage.getItem("nrs_user_role") || "staff";

  useEffect(() => {
    if (employeeId) {
      loadEmployeeData();
    }
  }, [employeeId]);

  const validatePhoto = async (photoData: string) => {
    const response = await fetch(photoData);
    const blob = await response.blob();
    const extension = blob.type.split("/")[1] || "png";
    const formData = new FormData();
    formData.append("file", blob, `photo.${extension}`);

    const photoValidity = await cardService.validatePhoto(formData);
    if (!photoValidity.valid) {
      setPhotoErrors(photoValidity?.issues || []);
      setPhotoData(null);
    } else {
      setPhotoErrors([]);
    }
  };

  useEffect(() => {
    if (photoData) {
      validatePhoto(photoData);
    }
  }, [photoData]);

  const loadEmployeeData = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const employeeData = await employeeService.getById(employeeId);
      setEmployee(employeeData);

      if (employeeData.card?.photoData) {
        setPhotoData(employeeData.card.photoData);
      }
    } catch (err) {
      console.error("Failed to load employee data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoData(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!employeeId) return;
    if (!photoData) {
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Please upload a photo first",
        autoClose: true,
      });
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Saving Card",
      message: "Saving card data...",
      progress: 50,
      autoClose: false,
    });

    try {
      setSaving(true);
      await cardService.saveCard(employeeId, photoData);

      updateNotification(notificationId, {
        type: "success",
        title: "Card Saved",
        message: "Card saved successfully!",
        autoClose: true,
      });

      await loadEmployeeData();
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Save Failed",
        message: "Failed to save card. Please try again.",
        autoClose: true,
      });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!employeeId) return;
    if (!photoData) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "Please upload and save a photo first",
        autoClose: true,
      });
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Printing Card",
      message: `Preparing card for ${employee?.name}...`,
      progress: 50,
      autoClose: false,
    });

    try {
      await employeeService.printCard(employeeId);

      updateNotification(notificationId, {
        type: "success",
        title: "Print Job Sent",
        message: `Card sent to printer successfully`,
        autoClose: true,
      });

      window.print();
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: "Failed to send card to printer. Please try again.",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handleResendLink = () => {
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async (message: string) => {
    if (!employeeId) return;

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Email",
      message: `Sending email to ${employee?.name}...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialogOpen(false);

    try {
      await employeeService.sendEmail(employeeId, message);

      updateNotification(notificationId, {
        type: "success",
        title: "Email Sent",
        message: `Email successfully sent to ${employee?.name}`,
        autoClose: true,
      });
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: `Failed to send email. Please try again.`,
        autoClose: true,
      });
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Employee not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-0 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="print-area grid md:grid-cols-3 gap-8 mb-8">
            <div className="">
              <div>
                {currentUserRole && currentUserRole === "manager" ? (
                  <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors print:hidden"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                ) : (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium shadow-md"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                )}

                <h1 className="text-3xl font-bold text-slate-800 mb-2">
                  Employee Card
                </h1>
                <div className="text-slate-600">
                  <p className="text-lg font-medium">{employee.name}</p>
                  <p className="text-sm">ID: {employee.employeeId}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                {(photoData || !saving) && (
                  <button
                    onClick={handleSave}
                    disabled={!photoData || saving}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-semibold text-l shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Submit"}
                  </button>
                )}

                {currentUserRole &&
                  currentUserRole === "manager" &&
                  photoData && (
                    <button
                      onClick={handlePrint}
                      disabled={!photoData}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-semibold text-l shadow-md"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  )}

                {currentUserRole && currentUserRole === "manager" && (
                  <button
                    onClick={handleResendLink}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold text-l shadow-md"
                  >
                    <Mail className="w-4 h-4" />
                    Resend Link
                  </button>
                )}

                <div className="print:hidden w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center w-full gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                  >
                    <Upload className="w-4 h-4" />
                    {photoData ? "Change Photo" : "Upload Photo"}
                  </button>
                </div>
              </div>
              <div className="mt-6">
             <ErrorAlert errors={photoErrors} onClose={() => setPhotoErrors([])} />
            </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
                Front Side
              </h2>
              <div className="bg-white rounded-2xl shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200">
                <div className="flex flex-col h-full items-center">
                  {/* Logo */}
                  <div className="p-14">
                    <div className="flex justify-center">
                      <img
                        src={nrsLogo2}
                        alt="NRS"
                        className="h-15 object-contain"
                      />
                    </div>
                  </div>

                  {/* Photo */}
                  <div className="w-52 h-52 border-[8px] border-red-600 rounded-md overflow-hidden bg-gray-100 mb-6">
                    {photoData ? (
                      <img
                        src={photoData}
                        alt={employee.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Upload
                          onClick={() => fileInputRef.current?.click()}
                          className="w-14 h-14 text-gray-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-3xl font-bold text-gray-600 tracking-wide text-center">
                    {employee.name.toUpperCase()}
                  </h3>

                  {/* ID */}
                  <p className="text-l font-semibold text-gray-600 mt-10">
                    IR {employee.employeeId}
                  </p>

                  {/* Spacer */}
                  {/* <div className="flex-1" /> */}

                  {/* Bottom accent */}
                  <div className="flex items-center gap-2 mx-20 mt-2">
                    <img
                      src={nrsLogoBottomBar}
                      alt="NRS Logo Bottom Bar"
                      className="h-25"
                    />
                  </div>
                  <div className="w-full flex items-center gap-2 mt-10"></div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 print:hidden">
                Back Side
              </h2>
              <div className="bg-white rounded-2xl shadow-xl aspect-[3/5] w-full max-w-sm overflow-hidden border border-gray-200">
                <div className="flex flex-col h-full">
                  {/* Top: Logo */}
                  <div className="p-14">
                    <div className="flex justify-center">
                      <img
                        src={nrsLogo2}
                        alt="NRS"
                        className="h-15 object-contain"
                      />
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
                          0907 211 1111; 0907 444 4441
                        </span>
                      </div>

                      <div className="ml-6 flex items-start justify-start gap-2">
                        {/* red dot bullet like the image */}
                        <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                        <span className="text-[12px] font-medium text-gray-800">
                          lostcard@nrs.gov.ng
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Red band */}
                  <div className="bg-red-600 py-6 px-8">
                    <div className="text-center text-white leading-tight">
                      <p className="text-sm font-bold">HCMD Department</p>
                      <p className="text-sm font-semibold mt-1">
                        NRS Headquarters
                      </p>
                    </div>
                  </div>
                  <div className="w-full flex items-center gap-2 mt-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onSend={handleSendEmail}
        employeeName={employee?.name}
        isBulk={false}
      />
    </div>
  );
}
