import React from 'react';

export type MikrotikSubPage = 'add_router' | 'pppoe_secrets' | 'pppoe_profiles' | 'pppoe_active' | 'billing_plans' | 'sales_report';

type Item = { id: MikrotikSubPage; label: string };

const items: Item[] = [
  { id: 'add_router', label: 'Add Router' },
  { id: 'pppoe_secrets', label: 'PPPoE Secrets/Users' },
  { id: 'pppoe_profiles', label: 'PPPoE Profiles' },
  { id: 'pppoe_active', label: 'PPPoE Active' },
  { id: 'billing_plans', label: 'Billing Plans' },
  { id: 'sales_report', label: 'Sales Report' }
];

type Props = {
  value: MikrotikSubPage;
  onChange: (next: MikrotikSubPage) => void;
  disabled?: boolean;
};

const SubPageSelector: React.FC<Props> = ({ value, onChange, disabled }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          disabled={!!disabled}
          className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
            value === it.id
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
};

export default SubPageSelector;

