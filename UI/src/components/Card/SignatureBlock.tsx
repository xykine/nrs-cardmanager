import React from "react";

type SignatureBlockProps = {
  signatureSrc: string;
};

const SignatureBlock: React.FC<SignatureBlockProps> = ({ signatureSrc }) => {
  return (
    <div className="w-full max-w-md mx-auto bg-white relative overflow-hidden">
      {/* Signature */}
      <div className="relative z-10 flex justify-center">
        <img
          src={signatureSrc}
          alt="Chairman Signature"
          className="h-32 object-contain translate-y-10"
        />
      </div>

      {/* Red band */}
      <div className="bg-red-600 py-6 px-8 mt-[-24px]">
        <div className="text-center text-white leading-tight">
          <p className="text-sm font-bold">HCM Group</p>
          <p className="text-sm font-semibold mt-1">NRS Headquarters</p>
        </div>
      </div>
    </div>
  );
};

export default SignatureBlock;
