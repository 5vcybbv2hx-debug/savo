import React from 'react';
import { base44 } from '@/api/base44Client';
import AtlasExportComponent from '@/components/accounting/AtlasExport';

export default function AtlasExport() {
  return <AtlasExportComponent base44={base44} />;
}