import React from "react";

interface MessageAlertProps {
    message: string;
}

const MessageAlert: React.FC<MessageAlertProps> = ({ message }) => {
    if (!message) return null;

    return (
        <div
            role="alert"
            className="relative rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-800 shadow-sm"
        >
            <div className="flex items-center gap-2 font-semibold">
                <span className="text-lg">⚠️</span>
                <span>Information</span>
            </div>
            <div className="mt-1 text-sm">{message}</div>
        </div>
    );
};

export default MessageAlert;
