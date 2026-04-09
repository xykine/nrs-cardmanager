import { useState } from 'react';
import { X, CheckSquare, Square } from 'lucide-react';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string, requests: string[]) => void;
  employeeName?: string;
  isBulk?: boolean;
  recipientCount?: number;
}

export default function EmailDialog({
  isOpen,
  onClose,
  onSend,
  employeeName,
  isBulk = false,
  recipientCount = 1
}: EmailDialogProps) {
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState({
    photo: false,
    data: false
  });

  if (!isOpen) return null;

  const toggleRequest = (type: 'photo' | 'data') => {
    setRequests(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedRequestLabels: string[] = [];
    if (requests.photo) selectedRequestLabels.push("Request: Change of photo");
    if (requests.data) selectedRequestLabels.push("Request: Update of employee data");

    let finalMessage = message.trim();
    if (selectedRequestLabels.length > 0) {
      finalMessage = `${selectedRequestLabels.join('\n')}\n\n${finalMessage}`;
    }

    if (finalMessage) {
      onSend(finalMessage, selectedRequestLabels);
      setMessage('');
      setRequests({ photo: false, data: false });
    }
  };

  const handleClose = () => {
    setMessage('');
    setRequests({ photo: false, data: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full animate-slide-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">
            {isBulk ? `Send Email to ${recipientCount} Employee(s)` : `Send Email to ${employeeName}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Quick Requests */}
            {!isBulk && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Quick Requests
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRequest('photo')}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${
                      requests.photo 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {requests.photo ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    <span className="font-medium">Request: Change of photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRequest('data')}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${
                      requests.data 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {requests.data ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    <span className="font-medium">Request: Update of employee data</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email-message" className="block text-sm font-semibold text-slate-700">
                Message Body
              </label>
              <textarea
                id="email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message here..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
                required={!requests.photo && !requests.data}
              />
              <p className="text-xs text-slate-500 mt-2">
                {isBulk
                  ? `This message will be sent to ${recipientCount} employee(s).`
                  : 'This message will be sent along with the invitation link.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md shadow-blue-100"
            >
              Send Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
