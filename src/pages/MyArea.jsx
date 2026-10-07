import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Umbrella, RepeatIcon, QrCode, Bell, Clock, Scale, Settings } from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';

// Import existing page components
import MyProfilePage from '@/components/profile/MyProfile';
import VacationPage from '@/components/profile/Vacation';
import ShiftSwapSection from '@/components/shifts/ShiftSwapSection';
import DigitalBusinessCard from '@/components/company/DigitalBusinessCard';
import UnavailabilityList from '@/components/availability/UnavailabilityList';
import NotificationSettingsPage from '@/components/profile/NotificationSettings';
import LegalTabContent from '@/components/legal/LegalTabContent';
import SettingsTabContent from '@/components/settings/SettingsTabContent';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function MyAreaPage() {
    const permissions = usePermissions();
    const [activeTab, setActiveTab] = useState('profile');
    const [searchParams, setSearchParams] = useSearchParams();
    const reverseTabMap = { profile: 'profil', vacation: 'urlaub', swaps: 'tauschen', card: 'visitenkarte', termine: 'verfuegbarkeiten', notifications: 'benachrichtigungen', legal: 'rechtliches', settings: 'einstellungen' };

    // URL-Tab-Parameter auslesen (?tab=profil|urlaub|tauschen|visitenkarte|verfuegbarkeiten|benachrichtigungen|rechtliches)
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            const tabMap = {
                profil: 'profile',
                urlaub: 'vacation',
                tauschen: 'swaps',
                visitenkarte: 'card',
                verfuegbarkeiten: 'termine',
                benachrichtigungen: 'notifications',
                rechtliches: 'legal',
                einstellungen: 'settings',
            };
            if (tabMap[tab]) setActiveTab(tabMap[tab]);
        }
    }, [searchParams]);

    const { data: companyInfo } = useQuery({
        queryKey: ['company-info'],
        queryFn: async () => {
            const infos = await base44.entities.CompanyInfo.list();
            return infos[0] || null;
        }
    });

    // Tab-Sichtbarkeit nach Permission
    const showVacationTab = permissions.canViewVacation;
    const showSwapsTab = permissions.canViewShifts;
    const showLegalTab = permissions.canViewSettings;
    const showSettingsTab = permissions.canViewSettings;
    const visibleTabCount = 4 + (showVacationTab ? 1 : 0) + (showSwapsTab ? 1 : 0) + (showLegalTab ? 1 : 0) + (showSettingsTab ? 1 : 0);
    const gridColsClass = { 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8' }[visibleTabCount] || 'grid-cols-8';

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mein Bereich</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1">Profil, Urlaub und Schichttausch</p>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams({ tab: reverseTabMap[v] || v }); }} className="space-y-4 sm:space-y-6">
                    <TabsList className={`grid w-full ${gridColsClass} bg-card border border-border h-auto p-1`}>
                        <TabsTrigger value="profile" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                            <User className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Profil</span>
                        </TabsTrigger>
                        {showVacationTab && (
                            <TabsTrigger value="vacation" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                                <Umbrella className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Urlaub</span>
                            </TabsTrigger>
                        )}
                        {showSwapsTab && (
                            <TabsTrigger value="swaps" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                                <RepeatIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Tausch</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="notifications" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                            <Bell className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Info</span>
                        </TabsTrigger>
                        <TabsTrigger value="termine" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                            <Clock className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Termine</span>
                        </TabsTrigger>
                        <TabsTrigger value="card" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                            <QrCode className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Karte</span>
                        </TabsTrigger>
                        {showLegalTab && (
                            <TabsTrigger value="legal" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                                <Scale className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Recht</span>
                            </TabsTrigger>
                        )}
                        {showSettingsTab && (
                            <TabsTrigger value="settings" className="py-3 sm:py-2.5 text-xs sm:text-sm flex-col sm:flex-row gap-1">
                                <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Einstell.</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="profile" className="space-y-0">
                        <MyProfilePage />
                    </TabsContent>

                    <TabsContent value="vacation" className="space-y-0">
                        <VacationPage />
                    </TabsContent>

                    <TabsContent value="swaps" className="space-y-0">
                        <div className="p-4 sm:p-6 rounded-lg bg-card border border-border">
                            <ShiftSwapSection />
                        </div>
                    </TabsContent>

                    <TabsContent value="notifications" className="space-y-0">
                        <NotificationSettingsPage />
                    </TabsContent>

                    <TabsContent value="termine" className="space-y-0">
                        <div className="p-4 sm:p-6 rounded-lg bg-card border border-border">
                            <UnavailabilityList />
                        </div>
                    </TabsContent>

                    <TabsContent value="card" className="space-y-0">
                        <div className="p-4 sm:p-6 rounded-lg bg-card border border-border">
                            <DigitalBusinessCard companyInfo={companyInfo} />
                        </div>
                    </TabsContent>

                    <TabsContent value="legal" className="space-y-0">
                        <LegalTabContent />
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-0">
                        <SettingsTabContent />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}