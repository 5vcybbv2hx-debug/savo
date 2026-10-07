import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { usePermissions } from '@/components/auth/usePermissions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getVisibleNotifications, sortByPriorityAndDate, DEFAULT_SETTINGS } from '@/lib/notificationUtils';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/notificationUtils';

const PRIORITY_COLORS = {
    'kritisch': 'bg-red-500',
    'wichtig': 'bg-amber-500',
    'info': 'bg-blue-500'
};

const PRIORITY_BADGES = {
    'kritisch': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'wichtig': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'info': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
};

export default function NotificationBell({ userEmail, userRole = 'user', employeeId }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const permissions = usePermissions();

    const { data: allNotifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => base44.entities.Notification.list('-created_date', 100),
        refetchInterval: open ? 30000 : false,
        staleTime: 60000,
    });

    const { data: userSettings } = useQuery({
        queryKey: ['notificationSettings', userEmail],
        queryFn: async () => {
            const found = await base44.entities.NotificationSettings.filter({
                user_email: userEmail
            });
            return found.length > 0 ? found[0] : null;
        },
        enabled: !!userEmail
    });

    const settings = userSettings || DEFAULT_SETTINGS;

    // Nutze zentrale Filter-Logik
    const visibleNotifications = getVisibleNotifications(
        allNotifications,
        permissions.role || 'mitarbeiter',
        userEmail,
        settings,
        employeeId
    );

    const sortedNotifications = sortByPriorityAndDate(visibleNotifications);

    const markAsReadMutation = useMutation({
        mutationFn: (id) => {
            const notification = allNotifications.find(n => n.id === id);
            const readBy = notification.read_by || [];
            if (!readBy.includes(userEmail)) {
                readBy.push(userEmail);
            }
            return base44.entities.Notification.update(id, { read_by: readBy });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const deleteNotificationMutation = useMutation({
        mutationFn: (id) => base44.entities.Notification.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            const unreadNotifs = sortedNotifications.filter(n => !n.read_by?.includes(userEmail));
            for (const notif of unreadNotifs) {
                const readBy = notif.read_by || [];
                if (!readBy.includes(userEmail)) {
                    readBy.push(userEmail);
                    await base44.entities.Notification.update(notif.id, { read_by: readBy });
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const unreadCount = sortedNotifications.filter(n => !n.read_by?.includes(userEmail)).length;

    const handleNotificationClick = (notification) => {
        if (!notification.read_by?.includes(userEmail)) {
            markAsReadMutation.mutate(notification.id);
        }
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 p-0">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Benachrichtigungen</h3>
                    <div className="flex gap-2">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAllAsReadMutation.mutate()}
                                className="text-xs"
                            >
                                <Check className="w-3 h-3 mr-1" />
                                Alle gelesen
                            </Button>
                        )}
                        <Link to={createPageUrl('MyArea') + '?tab=benachrichtigungen'}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                            >
                                <Settings className="w-3 h-3" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {sortedNotifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Keine Benachrichtigungen</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {sortedNotifications.map(notification => {
                                const isUnread = !notification.read_by?.includes(userEmail);
                                return (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "p-3 hover:bg-accent/50 cursor-pointer transition-colors border-l-4",
                                            isUnread ? `border-l-${PRIORITY_COLORS[notification.priority]}` : "border-l-transparent",
                                            isUnread && "bg-accent/30"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isUnread && (
                                                        <div className={cn("w-2 h-2 rounded-full", PRIORITY_COLORS[notification.priority])} />
                                                    )}
                                                    <p className={cn(
                                                        "text-sm",
                                                        isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 items-center mb-1">
                                                    <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[notification.category])}>
                                                        {CATEGORY_LABELS[notification.category]}
                                                    </Badge>
                                                    <Badge className={cn("text-xs", PRIORITY_BADGES[notification.priority])}>
                                                        {notification.priority}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(notification.created_date), { 
                                                        addSuffix: true, 
                                                        locale: de 
                                                    })}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotificationMutation.mutate(notification.id);
                                                }}
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}