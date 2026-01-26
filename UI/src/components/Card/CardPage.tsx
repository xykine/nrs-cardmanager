import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Employee } from "../../types";
import { employeeService, cardService } from "../../services/api";
import { Upload, Printer, Mail, Save, ArrowLeft, LogOut } from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";
import EmailDialog from "../EmailDialog";
import chairmanSignature2 from "../../assets/chairman_signature2.png";
import nrsLogoBottomBar from "../../assets/logoBottomBar.png";
import nrsLogo2 from "../../assets/nrs-logo.png";
import ErrorAlert from "../ErrorAlert";
import BackPage from "./BackPage";
import FrontPage from "./FrontPage";

export default function CardPage({ onLogout }: { onLogout: () => void }) {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [photoX, setPhotoX] = useState(0);
  const [photoY, setPhotoY] = useState(0);
  const [photoScale, setPhotoScale] = useState(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserRole = sessionStorage.getItem("nrs_user_role") || "staff";

  useEffect(() => {
    if (employeeId) {
      loadEmployeeData();
    }
  }, [employeeId]);

  const validatePhoto = async (photoData: string) => {
    setValidating(true);
    try {
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
    } catch {
      setPhotoErrors(["Failed to validate photo"]);
    } finally {
      setValidating(false);
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
        setPhotoX(employeeData.card.photoX || 0);
        setPhotoY(employeeData.card.photoY || 0);
        setPhotoScale(employeeData.card.photoScale || 1.0);
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
      setPhotoX(0);
      setPhotoY(0);
      setPhotoScale(1.0);
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
      await cardService.saveCard(employeeId, photoData, photoX, photoY, photoScale);

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
        <div className="text-xl text-gray-600">Page loading wait...</div>
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
                <ErrorAlert
                  errors={photoErrors}
                  onClose={() => setPhotoErrors([])}
                />
              </div>
            </div>

            <FrontPage
              showTitle={true}
              employee={employee}
              nrsLogoSrc={nrsLogo2}
              nrsLogoBottomBarSrc={nrsLogoBottomBar}
              photoData={photoData}
              validating={validating}
              fileInputRef={fileInputRef}
              photoX={photoX}
              photoY={photoY}
              photoScale={photoScale}
              onPositionChange={(x, y, s) => {
                setPhotoX(x);
                setPhotoY(y);
                setPhotoScale(s);
              }}
              isEditable={true}
            />

            <BackPage
              showTitle={true}
              chairmanSignatureSrc={chairmanSignature2}
              nrsLogoSrc={nrsLogo2}
              phoneText="+234 700 2255 677"
              emailText="lostcard@nrs.gov.ng"
            />
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
