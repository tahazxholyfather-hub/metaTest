import React from 'react';

const Spinner: React.FC = () => {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute h-full w-full animate-spin rounded-full border-2 border-transparent border-t-[#1c1c1e] border-l-[#1c1c1e] opacity-80"></div>
                <div className="absolute h-8 w-8 animate-spin rounded-full border-2 border-transparent border-b-[#86868b] border-r-[#86868b] opacity-60" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
            </div>
        </div>
    );
};

export default Spinner;
