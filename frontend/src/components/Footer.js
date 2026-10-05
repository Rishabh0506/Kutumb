import React from 'react';
import { useLocation } from 'react-router-dom';

// Footer is hidden on the full-screen StoryTransition page
const HIDDEN_ROUTES = ['/story-transition'];

const Footer = () => {
  const location = useLocation();
  const year = new Date().getFullYear();

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  return (
    <footer className="w-full mt-auto py-5 px-6 border-t border-white/5 bg-transparent">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-[11px] text-gray-600 tracking-widest font-medium">
          &copy; {year} <span className="text-gray-500 font-bold">Kutumb</span>. All rights reserved.
        </p>
        <p className="text-[11px] text-gray-700 tracking-wider italic">
          Preserving your legacy.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
