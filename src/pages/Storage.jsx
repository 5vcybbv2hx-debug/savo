import { useState } from 'react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Search, Layers, Grid3x3, Printer } from 'lucide-react';
import StorageSearchTab from '@/components/storage/SearchTab';
import StorageStructureTab from '@/components/storage/StructureTab';
import LayoutTab from '@/components/storage/LayoutTab';
import SlotLabelPrintDialog from '@/components/storage/SlotLabelPrintDialog';

const TABS = [
  { id: 'structure', label: 'Bereiche', icon: Layers },
  { id: 'search', label: 'Suche', icon: Search },
  { id: 'layout', label: 'Layout', icon: Grid3x3 },
];

export default function Storage() {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState('structure');
  const [labelOpen, setLabelOpen] = useState(false);

  if (permissions.isLoading) return (
    <div className="max-w-3xl mx-auto px-3 py-8 flex flex-col items-center justify-center gap-4 min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">Lade Lagerverwaltung…</p>
    </div>
  );

  if (!permissions.canViewWarehouse && !permissions.isManager) return <PermissionDenied />;

  return (
    <div className="max-w-3xl mx-auto px-5 py-4 pb-32 md:pb-8">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="page-title">Lagerplätze</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Bereich → Möbel → Fach → Artikel</p>
        </div>
        <button
          onClick={() => setLabelOpen(true)}
          className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-xs font-semibold bg-primary text-primary-foreground active:scale-95 transition-transform"
        >
          <Printer className="w-3.5 h-3.5" />
          Etiketten
        </button>
      </div>

      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-0.5 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all',
              activeTab === tab.id
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground bg-card',
            ].join(' ')}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'structure' && <StorageStructureTab permissions={permissions} />}
      {activeTab === 'search' && <StorageSearchTab permissions={permissions} />}
      {activeTab === 'layout' && <LayoutTab permissions={permissions} />}

      <SlotLabelPrintDialog open={labelOpen} onClose={() => setLabelOpen(false)} />
    </div>
  );
}