import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Employee } from '../types';
import { employeeService } from '../services/api';
import { ArrowLeft, User, Mail, Hash, Calendar, Image } from 'lucide-react';

interface EmployeeDetailProps {
  employeeId?: string;
  onBack?: () => void;
}

export default function EmployeeDetail({
  employeeId: employeeIdProp,
  onBack,
}: EmployeeDetailProps = {}) {
  const { employeeId: routeEmployeeId } = useParams<{ employeeId: string }>();
  const employeeId = employeeIdProp || routeEmployeeId;
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId]);

  const loadEmployee = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const data = await employeeService.getById(employeeId);
      setEmployee(data);
    } catch (err) {
      console.error('Failed to load employee:', err);
    } finally {
      setLoading(false);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={onBack || (() => navigate(-1))}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Employee Details</h1>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <User className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Full Name</p>
                <p className="text-lg font-semibold text-slate-800">{employee.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <Hash className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Employee ID</p>
                <p className="text-lg font-mono font-semibold text-slate-800">{employee.employeeId}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <Mail className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Email Address</p>
                <p className="text-lg font-semibold text-slate-800">{employee.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <User className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Position</p>
                <p className="text-lg font-semibold text-slate-800">
                  {employee.position === 'Consultant' && employee.consultantPrefix
                    ? `${employee.consultantPrefix} ${employee.position}`
                    : employee.position || "N/A"}
                </p>
              </div>
            </div>

            {employee.employmentStartDate && (
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <Calendar className="w-6 h-6 text-slate-600 mt-1" />
                <div>
                  <p className="text-sm text-slate-600 mb-1">Employment Start Date</p>
                  <p className="text-lg font-semibold text-slate-800">{new Date(employee.employmentStartDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            {employee.employmentEndDate && (
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <Calendar className="w-6 h-6 text-slate-600 mt-1" />
                <div>
                  <p className="text-sm text-slate-600 mb-1">Employment End Date</p>
                  <p className="text-lg font-semibold text-slate-800">{new Date(employee.employmentEndDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <Image className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Photo Status</p>
                <p className="text-lg font-semibold">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${employee.photoPresent
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                      }`}
                  >
                    {employee.photoPresent ? 'Photo Uploaded' : 'No Photo'}
                  </span>
                </p>
              </div>
            </div>

            {employee.card?.photoData && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-3">Employee Photo</p>
                <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-slate-200">
                  <img
                    src={employee.card.photoData}
                    alt={employee.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <Calendar className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <p className="text-sm text-slate-600 mb-1">Request date</p>
                <p className="text-lg font-semibold text-slate-800">
                  {employee?.invitationSentAt ? new Date(employee?.invitationSentAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }) : 'N/A'}
                </p>
              </div>
            </div>

            {employee.invitationSentAt && (
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Mail className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-blue-600 mb-1">Last Invitation Sent</p>
                  <p className="text-lg font-semibold text-blue-800">
                    {new Date(employee.invitationSentAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
