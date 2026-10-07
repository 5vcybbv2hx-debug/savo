import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ErrorState, ListSkeleton } from '@/components/ui/StateDisplay';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bell, CheckCircle2, Trash2, Eye, Filter, AlertCircle, Settings, Link as LinkIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import SendNotificationModal from '@/components/notifications/SendNotificationModal';
import { getVisibleNotifications, sortByPriorityAndDate, DEFAULT_SETTINGS, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/notificationUtils';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const PRIORITY_COLORS = {
    'kritisch': 'bg-red-600 dark:bg-red-600',
    'wichtig': 'bg-amber-600 dark:bg-amber-600',
    'info': 'bg-blue-600 dark:bg-blue-600'
};

const PRIORITY_BADGES = {
    'kritisch': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'wichtig': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'info': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
};

export default function Notifications() {
     const queryClient = useQueryClient();
     const navigate = useNavigate();
     const permissions = usePermissions();
     const [filter, setFilter] = useState('all');
     const [selectedIds, setSelectedIds] = useState(new Set());

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW
    });

    const { data: allNotifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => base44.entities.Notification.list('-created_date', 200),
        staleTime: STALE.MEDIUM
    });

    const { data: userSettings } = useQuery({
        queryKey: ['notificationSettings', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return null;
            const found = await base44.entities.NotificationSettings.filter({
                user_email: currentUser.email
            });
            return found.length > 0 ? found[0] : null;
        },
        enabled: !!currentUser?.email
    });

    const settings = userSettings || DEFAULT_SETTINGS;
    const notifications = getVisibleNotifications(
        allNotifications,
        permissions.role || 'mitarbeiter',
        currentUser?.email,
        settings
    );

    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId) => {
            const notification = allNotifications.find(n => n.id === notificationId);
            const readBy = notification.read_by || [];
            if (!readBy.includes(currentUser.email)) {
                await base44.entities.Notification.update(notificationId, {
                    read_by: [...readBy, currentUser.email]
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            const unreadNotifications = notifications.filter(n => 
                !n.read_by?.includes(currentUser.email)
            );
            const promises = unreadNotifications.map(n => {
                const readBy = n.read_by || [];
                return base44.entities.Notification.update(n.id, {
                    read_by: [...readBy, currentUser.email]
                });
            });
            return Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const deleteAllReadMutation = useMutation({
         mutationFn: async () => {
             const readNotifications = notifications.filter(n => 
                 n.read_by?.includes(currentUser.email)
             );
             const promises = readNotifications.map(n => 
                 base44.entities.Notification.delete(n.id)
             );
             return Promise.all(promises);
         },
         onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['notifications'] });
         }
     });

     const bulkDeleteMutation = useMutation({
         mutationFn: async () => {
             const promises = Array.from(selectedIds).map(id => 
                 base44.entities.Notification.delete(id)
             );
             return Promise.all(promises);
         },
         onSuccess: () => {
             setSelectedIds(new Set());
             queryClient.invalidateQueries({ queryKey: ['notifications'] });
         }
         });

     const toggleSelection = (notificationId) => {
         const newSelected = new Set(selectedIds);
         if (newSelected.has(notificationId)) {
             newSelected.delete(notificationId);
         } else {
             newSelected.add(notificationId);
         }
         setSelectedIds(newSelected);
     };

     const toggleSelectAll = () => {
         if (selectedIds.size === filteredNotifications.length) {
             setSelectedIds(new Set());
         } else {
             setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
         }
     };

    if (!currentUser) return null;

    const filteredNotifications = notifications.filter(notification => {
        if (filter === 'unread') {
            return !notification.read_by?.includes(currentUser.email);
        }
        if (filter === 'read') {
            return notification.read_by?.includes(currentUser.email);
        }
        return true;
    });

    const sortedFiltered = sortByPriorityAndDate(filteredNotifications);
    const unreadCount = notifications.filter(n => !n.read_by?.includes(currentUser.email)).length;

    if (false) return (  // notifsError removed — no error state from query
        <div className="min-h-screen bg-background px-4 py-6">
            <ErrorState text="Benachrichtigungen konnten nicht geladen werden." retry={() => window.location.reload()} />
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-0">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                                <Bell className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Benachrichtigungen</h1>
                                <p className="text-sm text-muted-foreground">
                                    {unreadCount > 0 ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="badge-count animate-pop">{unreadCount}</span>
                                            neue Benachrichtigung{unreadCount > 1 ? 'en' : ''}
                                        </span>
                                    ) : 'Alle aktuell'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => navigate(createPageUrl('MyArea') + '?tab=benachrichtigungen')}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Einstellungen</span>
                            </Button>
                            {permissions.isManager && <SendNotificationModal />}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 space-y-4">
                    <Tabs value={filter} onValueChange={setFilter}>
                         <TabsList className="grid grid-cols-3 w-full">
                             <TabsTrigger value="all">
                                 Alle ({notifications.length})
                             </TabsTrigger>
                             <TabsTrigger value="unread">
                                 Neu ({unreadCount})
                             </TabsTrigger>
                             <TabsTrigger value="read">
                                 Gelesen ({notifications.length - unreadCount})
                             </TabsTrigger>
                         </TabsList>
                     </Tabs>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                         {filteredNotifications.length > 0 && (
                             <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-accent cursor-pointer text-sm text-slate-300">
                                 <Checkbox 
                                     checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                                     onCheckedChange={toggleSelectAll}
                                 />
                                 Alle auswählen
                             </label>
                         )}

                         {selectedIds.size > 0 && (
                             <Button
                                 onClick={() => {
                                     if (confirm(`${selectedIds.size} Benachrichtigung(en) löschen?`)) {
                                         bulkDeleteMutation.mutate();
                                     }
                                 }}
                                 variant="outline"
                                 size="sm"
                                 disabled={bulkDeleteMutation.isPending}
                                 className="border-red-600 text-red-400 hover:bg-red-950"
                             >
                                 <Trash2 className="w-4 h-4 mr-2" />
                                 {selectedIds.size} löschen
                             </Button>
                         )}

                         {(unreadCount > 0 || filteredNotifications.some(n => n.read_by?.includes(currentUser.email))) && selectedIds.size === 0 && (
                             <>
                                 {unreadCount > 0 && (
                                     <Button
                                         onClick={() => markAllAsReadMutation.mutate()}
                                         variant="outline"
                                         size="sm"
                                         disabled={markAllAsReadMutation.isPending}
                                         className="border-border text-muted-foreground hover:bg-accent"
                                     >
                                         <CheckCircle2 className="w-4 h-4 mr-2" />
                                         Alle als gelesen markieren
                                     </Button>
                                 )}
                                 {filteredNotifications.some(n => n.read_by?.includes(currentUser.email)) && (
                                     <Button
                                         onClick={() => {
                                             if (confirm('Alle gelesenen Benachrichtigungen löschen?')) {
                                                 deleteAllReadMutation.mutate();
                                             }
                                         }}
                                         variant="outline"
                                         size="sm"
                                         disabled={deleteAllReadMutation.isPending}
                                         className="border-red-600 text-red-400 hover:bg-red-950"
                                     >
                                         <Trash2 className="w-4 h-4 mr-2" />
                                         Gelesene löschen
                                     </Button>
                                 )}
                             </>
                         )}
                     </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {sortedFiltered.length > 0 ? (
                        sortedFiltered.map((notification, idx) => {
                            const isRead = notification.read_by?.includes(currentUser.email);
                            const isUnread = !isRead;
                            
                            return (
                                <Card 
                                    key={notification.id}
                                    style={{ '--delay': `${idx * 40}ms` }}
                                    className={cn(
                                        "p-4 border-l-4 transition-all cursor-pointer animate-stagger",
                                        selectedIds.has(notification.id) && "bg-accent/30 border-accent",
                                        !selectedIds.has(notification.id) && (isRead ? "bg-card/50 border-l-transparent" : `bg-card border-l-${PRIORITY_COLORS[notification.priority]}`)
                                    )}
                                    onClick={() => toggleSelection(notification.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox 
                                            checked={selectedIds.has(notification.id)}
                                            onCheckedChange={() => toggleSelection(notification.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-1"
                                        />
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <h3 className={cn(
                                                    "font-semibold text-sm sm:text-base",
                                                    isRead ? "text-muted-foreground" : "text-foreground"
                                                )}>
                                                    {notification.title}
                                                </h3>
                                                {isUnread && (
                                                    <div className={cn("status-dot animate-pulse-dot shrink-0", PRIORITY_COLORS[notification.priority])} />
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[notification.category])}>
                                                    {CATEGORY_LABELS[notification.category]}
                                                </Badge>
                                                <Badge className={cn("text-xs", PRIORITY_BADGES[notification.priority])}>
                                                    {notification.priority}
                                                </Badge>
                                            </div>
                                            
                                            <p className={cn(
                                                "text-sm mb-2 line-clamp-2",
                                                isRead ? "text-muted-foreground" : "text-foreground"
                                            )}>
                                                {notification.message}
                                            </p>
                                            
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>
                                                    {format(parseISO(notification.created_date), 'dd. MMM HH:mm', { locale: de })}
                                                </span>
                                                {isRead && (
                                                    <span className="flex items-center gap-1">
                                                        ✓ Gelesen
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                            {!isRead && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsReadMutation.mutate(notification.id);
                                                    }}
                                                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                                                    title="Als gelesen markieren"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Benachrichtigung löschen?')) {
                                                        deleteMutation.mutate(notification.id);
                                                    }
                                                }}
                                                className="text-red-400 hover:text-red-300 h-8 w-8"
                                                title="Löschen"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    ) : (
                        <Card className="p-12 bg-card border-border text-center">
                            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-lg font-medium text-foreground mb-1">
                                {filter === 'unread' ? 'Keine neuen Benachrichtigungen' :
                                 filter === 'read' ? 'Keine gelesenen Benachrichtigungen' :
                                 'Keine Benachrichtigungen'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {notifications.length === 0 ? 'Aktiviere Kategorien in den Einstellungen' : 'Schön, dass du auf dem neuesten Stand bist!'}
                            </p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}