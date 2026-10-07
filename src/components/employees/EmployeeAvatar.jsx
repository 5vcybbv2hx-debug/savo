import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * EmployeeAvatar — zeigt Profilfoto oder Initialen-Fallback.
 * Mit upload=true: Klick öffnet Datei-Dialog zum Hochladen.
 */
export default function EmployeeAvatar({
  employee,
  size = 'md',
  upload = false,
  onUploaded,
  className,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const sizeMap = {
    sm: 'w-9 h-9 text-sm',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-28 h-28 text-3xl',
  };

  const initials = (employee?.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const bgColor = employee?.color || '#64748b';
  const imageUrl = employee?.profile_image_url;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Nur Bilddateien erlaubt');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded?.(file_url);
      toast.success('Foto gespeichert');
    } catch (err) {
      toast.error('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const avatar = (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden',
        sizeMap[size] || sizeMap.md,
        className
      )}
      style={!imageUrl ? { backgroundColor: bgColor, color: '#fff' } : {}}
    >
      {uploading ? (
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      ) : imageUrl ? (
        <img src={imageUrl} alt={employee?.name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );

  if (!upload) return avatar;

  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      {avatar}
      {/* Overlay */}
      <div className={cn(
        'absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity',
        sizeMap[size] || sizeMap.md
      )}>
        <Camera className="w-6 h-6 text-white" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}