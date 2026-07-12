import { useState } from 'react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Package, Search, Layers, Grid3x3 } from 'lucide-react';
import StorageSearchTab    from '@/components/storage/SearchTab';
import StorageStructureTab from '@/components/storage/StructureTab';
import LayoutTab           from '@/components/storage/LayoutTab';

const TABS = [
  { id: 'search',    label: 'Suche',    icon: Search    },
  { id: 'structure', label: 'Bereiche', icon: Layers    },
  { id: 'layout',    label: 'Layout',   icon: Grid3x3   },
];

export default function Storage() {
  const permissions = usePermissions();
  // Suche als Default-Tab
  const [activeTab, setActiveTab] = useState('search');

  if (permissions.isLoading) return (
    <div className="max-w-3xl mx-auto px-3 py-8 flex flex-col items-center justify-center gap-4 min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">Lade Lagerverwaltung…</p>
    </div>
  );

  if (!permissions.canViewInventory && !permissions.isManager) return <PermissionDenied />;

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 pb-32 md:pb-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Lagerplätze</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Bereich → Möbel → Fach → Artikel</p>
      </div>

      {/* Tab Bar — konsistent mit dem Rest der App */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-0.5 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all',
              activeTab === tab.id
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-border text-muted-foreground hover:text-foreground bg-card',
            ].join(' ')}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'search'    && <StorageSearchTab    permissions={permissions} />}
      {activeTab === 'structure' && <StorageStructureTab permissions={permissions} />}
      {activeTab === 'layout'    && <LayoutTab />}
    </div>
  );
}
