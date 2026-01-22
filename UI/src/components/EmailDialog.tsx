import { useState } from 'react';
import { X } from 'lucide-react';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleClose = () => {
    setMessage('');
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
          <div className="p-6">
            <label htmlFor="email-message" className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              id="email-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here..."
              rows={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-sm text-slate-500 mt-2">
              {isBulk
                ? `This message will be sent to ${recipientCount} employee(s).`
                : 'This message will be sent along with the invitation link.'}
            </p>
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
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Send Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
