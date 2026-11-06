import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function useAlertDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({
    title: '',
    description: '',
    action: '',
    onConfirm: () => {},
    onCancel: () => {},
    variant: 'default' // 'default' or 'destructive'
  });

  const confirm = (title, description, onConfirm, onCancel, variant = 'default') => {
    setConfig({
      title,
      description,
      action: variant === 'destructive' ? 'Löschen' : 'Bestätigen',
      onConfirm: () => {
        onConfirm();
        setOpen(false);
      },
      onCancel: () => {
        onCancel?.();
        setOpen(false);
      },
      variant
    });
    setOpen(true);
  };

  const DialogComponent = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          {config.description && (
            <AlertDialogDescription>{config.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel onClick={config.onCancel}>
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={config.onConfirm}
            className={config.variant === 'destructive' ? 'bg-status-danger/70 hover:bg-status-danger/70' : ''}
          >
            {config.action}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, Dialog: DialogComponent };
}