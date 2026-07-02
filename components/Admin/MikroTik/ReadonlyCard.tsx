import React from 'react';

const CrudModeCard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mode</div>
      <div className="text-sm font-bold text-slate-900 mt-1">Full CRUD Enabled</div>
      <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
        This page now supports full Create, Read, Update, and Delete operations on MikroTik RouterOS. 
        You can manage PPPoE secrets, profiles, and disconnect active sessions.
      </div>
    </div>
  );
};

export default CrudModeCard;

