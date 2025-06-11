
import React from 'react';

interface LeonMascotProps {
  message: string;
  isAnalyzing: boolean;
}

const LeonMascot: React.FC<LeonMascotProps> = ({ message, isAnalyzing }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        {/* Speech Bubble */}
        <div className="absolute bottom-16 right-0 bg-white border-2 border-pastel-blue rounded-2xl p-4 shadow-lg max-w-xs">
          <p className="text-sm text-gray-700 font-medium">{message}</p>
          <div className="absolute bottom-[-8px] right-6 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
          <div className="absolute bottom-[-6px] right-6 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-pastel-blue"></div>
        </div>

        {/* Léon the Duck */}
        <div className={`
          w-16 h-16 bg-gradient-to-br from-yellow-300 to-yellow-400 
          rounded-full border-4 border-white shadow-lg
          flex items-center justify-center text-2xl
          ${isAnalyzing ? 'animate-bounce-gentle' : 'hover:animate-bounce-gentle'}
          transition-transform cursor-pointer
        `}>
          🦆
        </div>

        {/* Floating sparkles when analyzing */}
        {isAnalyzing && (
          <>
            <div className="absolute -top-2 -left-2 text-yellow-400 animate-sparkle">✨</div>
            <div className="absolute -top-1 -right-3 text-blue-400 animate-sparkle" style={{ animationDelay: '0.2s' }}>✨</div>
            <div className="absolute -bottom-2 -left-3 text-pink-400 animate-sparkle" style={{ animationDelay: '0.4s' }}>✨</div>
          </>
        )}
      </div>
    </div>
  );
};

export default LeonMascot;
