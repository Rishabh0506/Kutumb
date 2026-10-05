import React from 'react';
import { useNavigate } from 'react-router-dom';

const BreadcrumbNav = ({ personName, isDemo }) => {
  const navigate = useNavigate();
  const crumbs = [
    { label: '🏠 Home', action: () => navigate('/dashboard') },
    { label: 'Family Tree', action: () => navigate(isDemo ? '/family-tree?demo=true' : '/family-tree') },
    { label: personName || 'Profile' },
  ];
  return (
    <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-700">›</span>}
          {c.action ? (
            <button onClick={c.action} className="hover:text-white transition-colors">{c.label}</button>
          ) : (
            <span className="text-gray-300">{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbNav;
