import { X, CheckCircle, AlertCircle, Info, Loader } from 'lucide-react';
import { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'progress';

export interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  progress?: number;
  onClose: (id: string) => void;
  autoClose?: boolean;
  duration?: number;
}

export function Notification({
  id,
  type,
  title,
  message,
  progress,
  onClose,
  autoClose = true,
  duration = 5000,
}: NotificationProps) {
  useEffect(() => {
    if (autoClose && type !== 'progress') {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, id, onClose, type]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'progress':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'progress':
        return 'bg-blue-50 border-blue-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div
      className={`${getBgColor()} border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md animate-slide-in`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm mb-1">{title}</h4>
          <p className="text-slate-700 text-sm">{message}</p>
          {type === 'progress' && progress !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
