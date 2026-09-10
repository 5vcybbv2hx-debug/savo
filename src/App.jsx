import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { useEffect } from 'react';
import { applyBranding } from '@/lib/branding';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/auth/RoleGuard';
import { PAGE_PERMISSIONS } from '@/lib/pagePermissions';
import ConsentDialog from '@/components/legal/ConsentDialog';
import { useConsent } from '@/components/legal/useConsent';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PublicDrinkMenu from './pages/PublicDrinkMenu';
import EventLanding from './pages/EventLanding';
import AccountingDashboard from './pages/AccountingDashboard';
import AccountingCashbook from './pages/AccountingCashbook';
import AccountingReceipts from './pages/AccountingReceipts';
import AccountingCreditors from './pages/AccountingCreditors';
import AccountingExport from './pages/AccountingExport';
import ExternalBusiness from './pages/ExternalBusiness';
import AccountingFixedCosts from './pages/AccountingFixedCosts';
import AccountingLiabilities from './pages/AccountingLiabilities';
import TeamHub from './pages/TeamHub';
import AccountingHub from './pages/AccountingHub';
import BetriebHub from './pages/BetriebHub';
import GuestHub from './pages/GuestHub';
import KarteHub from './pages/KarteHub';
import AccountingBank from './pages/AccountingBank';
import AtlasExport from './pages/AtlasExport';
import BusinessCard from './pages/BusinessCard';
import AdminTimeEditor from './pages/AdminTimeEditor';
import ModuleCenter from './pages/ModuleCenter';
import DisplayManager from './pages/DisplayManager';
import Display from './pages/Display';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';

import BusinessCalendar from './pages/BusinessCalendar';
import DataQuality from './pages/DataQuality';
import MenuReview from './pages/MenuReview';

const { Pages, CorePages, SpecialPagesWithLayout, PublicPages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function BrandingLoader() {
  useEffect(() => {
    const cached = queryClientInstance.getQueryData(['company-info']);
    if (cached?.[0]?.branding_color) {
      applyBranding({ primaryHex: cached[0].branding_color, logoUrl: cached[0].logo_url, barName: cached[0].company_name });
      return;
    }
    base44.entities.CompanyInfo.list().then(records => {
      queryClientInstance.setQueryData(['company-info'], records);
      const company = records?.[0];
      if (company?.branding_color) {
        applyBranding({
          primaryHex: company.branding_color,
          logoUrl: company.logo_url,
          barName: company.company_name,
        });
      }
    }).catch(() => {});
  }, []);
  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const { needsNewConsent, saveConsent, isLoading: isConsentLoading } = useConsent();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // App is public (App Visibility = Public): public pages are rendered outside
  // AuthenticatedApp in the top-level Routes. Everything inside AuthenticatedApp
  // requires a logged-in user — redirect unauthenticated visitors to login so
  // they never land on a blank RoleGuard screen.
  if (!isLoadingPublicSettings && !isLoadingAuth && !isAuthenticated) {
    navigateToLogin();
    return null;
  }

  // Render the main app
  return (
    <>
    <BrandingLoader />
    <Routes>
      {/* Main landing page — guarded: non-dashboard roles redirect to MeinTag */}
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <RoleGuard permission="canViewDashboard">
            <MainPage />
          </RoleGuard>
        </LayoutWrapper>
      } />

      {/* Core pages: all with layout + role guard */}
      {Object.entries(CorePages).map(([path, Page]) => {
        const requiredPerm = PAGE_PERMISSIONS[path];
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                {requiredPerm ? (
                  <RoleGuard permission={requiredPerm}>
                    <Page />
                  </RoleGuard>
                ) : (
                  <Page />
                )}
              </LayoutWrapper>
            }
          />
        );
      })}

      {/* Special pages: all with layout + role guard */}
      {Object.entries(SpecialPagesWithLayout).map(([path, Page]) => {
        const requiredPerm = PAGE_PERMISSIONS[path];
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                {requiredPerm ? (
                  <RoleGuard permission={requiredPerm}>
                    <Page />
                  </RoleGuard>
                ) : (
                  <Page />
                )}
              </LayoutWrapper>
            }
          />
        );
      })}

      {/* Dynamic employee profile route */}
      <Route path="/EmployeeProfile/:id" element={
        <LayoutWrapper currentPageName="EmployeeProfile">
          <RoleGuard permission="canViewEmployees">
            <SpecialPagesWithLayout.EmployeeProfile />
          </RoleGuard>
        </LayoutWrapper>
      } />



      {/* Digitale Visitenkarte — für alle Mitarbeiter */}
      <Route path="/BusinessCard" element={
        <LayoutWrapper currentPageName="BusinessCard">
          <BusinessCard />
        </LayoutWrapper>
      } />

      {/* Redirect old EmployeeHome links to Dashboard */}
      <Route path="/EmployeeHome" element={<Navigate to="/" replace />} />

      {/* Redirect /Shifts → /Calendar (Calendar ist jetzt der vollständige Schichtplan) */}
      <Route path="/Shifts" element={<Navigate to="/Calendar" replace />} />


      {/* Redirect old SeatingChart route to GuestHub */}
      <Route path="/SeatingChart" element={<Navigate to="/GuestHub" replace />} />

      {/* Admin Zeit-Editor */}
      <Route path="/AdminTimeEditor" element={
        <LayoutWrapper currentPageName="AdminTimeEditor">
          <RoleGuard permission="canViewSettings">
            <AdminTimeEditor />
          </RoleGuard>
        </LayoutWrapper>
      } />

      {/* Mein Tag — jetzt auf Dashboard umgeleitet */}

      {/* Modulcenter — Admin Modulverwaltung */}
      <Route path="/ModuleCenter" element={
        <LayoutWrapper currentPageName="ModuleCenter">
          <RoleGuard permission="canViewSettings">
            <ModuleCenter />
          </RoleGuard>
        </LayoutWrapper>
      } />

      {/* Datenqualität */}
      <Route path="/DataQuality" element={
        <LayoutWrapper currentPageName="DataQuality">
          <RoleGuard permission="isManager">
            <DataQuality />
          </RoleGuard>
        </LayoutWrapper>
      } />

      {/* Betriebskalender & Sondertage */}
      <Route path="/BusinessCalendar" element={
        <LayoutWrapper currentPageName="BusinessCalendar">
          <RoleGuard permission="canViewSettings">
            <BusinessCalendar />
          </RoleGuard>
        </LayoutWrapper>
      } />

      {/* Buchhaltungsmodul — nur für Manager */}
      <Route path="/AccountingDashboard" element={<LayoutWrapper currentPageName="AccountingDashboard"><RoleGuard permission="canViewAccounting"><AccountingDashboard /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingCashbook" element={<LayoutWrapper currentPageName="AccountingCashbook"><RoleGuard permission="canViewAccountingCashbook"><AccountingCashbook /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingReceipts" element={<LayoutWrapper currentPageName="AccountingReceipts"><RoleGuard permission="canViewAccountingReceipts"><AccountingReceipts /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingCreditors" element={<LayoutWrapper currentPageName="AccountingCreditors"><RoleGuard permission="canViewAccountingCreditors"><AccountingCreditors /></RoleGuard></LayoutWrapper>} />
      <Route path="/ExternalBusiness" element={<LayoutWrapper currentPageName="ExternalBusiness"><RoleGuard permission="canViewAccounting"><ExternalBusiness /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingExport" element={<LayoutWrapper currentPageName="AccountingExport"><RoleGuard permission="canExportAccounting"><AccountingExport /></RoleGuard></LayoutWrapper>} />
      <Route path="/ExternalBusiness" element={<LayoutWrapper currentPageName="ExternalBusiness"><RoleGuard permission="canViewAccounting"><ExternalBusiness /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingFixedCosts" element={<LayoutWrapper currentPageName="AccountingFixedCosts"><RoleGuard permission="canViewAccounting"><AccountingFixedCosts /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingLiabilities" element={<LayoutWrapper currentPageName="AccountingLiabilities"><RoleGuard permission="canViewLiabilities"><AccountingLiabilities /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingBank" element={<LayoutWrapper currentPageName="AccountingBank"><RoleGuard permission="canViewAccounting"><AccountingBank /></RoleGuard></LayoutWrapper>} />
      <Route path="/AtlasExport" element={<LayoutWrapper currentPageName="AtlasExport"><RoleGuard permission="canViewAnalytics"><AtlasExport /></RoleGuard></LayoutWrapper>} />

      {/* Catch-all */}
      <Route path="/TeamHub" element={<LayoutWrapper currentPageName="TeamHub"><RoleGuard permission="canViewShifts"><TeamHub /></RoleGuard></LayoutWrapper>} />
      <Route path="/AccountingHub" element={<LayoutWrapper currentPageName="AccountingHub"><RoleGuard permission="canViewAccounting"><AccountingHub /></RoleGuard></LayoutWrapper>} />
      <Route path="/KarteHub" element={<LayoutWrapper currentPageName="KarteHub"><RoleGuard permission="canViewDrinkMenu"><KarteHub /></RoleGuard></LayoutWrapper>} />
      <Route path="/MenuReview" element={<LayoutWrapper currentPageName="MenuReview"><RoleGuard permission="canViewDrinkMenu"><MenuReview /></RoleGuard></LayoutWrapper>} />
      <Route path="/BetriebHub" element={<LayoutWrapper currentPageName="BetriebHub"><RoleGuard permission="canViewReservations"><BetriebHub /></RoleGuard></LayoutWrapper>} />
      <Route path="/GuestHub" element={<LayoutWrapper currentPageName="GuestHub"><RoleGuard permission="canViewReservations"><GuestHub /></RoleGuard></LayoutWrapper>} />
      <Route path="/Display" element={<Display />} />
      <Route path="/DisplayManager" element={<LayoutWrapper currentPageName="DisplayManager"><RoleGuard permission="isManager"><DisplayManager /></RoleGuard></LayoutWrapper>} />
      <Route path="/incidents" element={<LayoutWrapper currentPageName="Incidents"><RoleGuard permission="isManager"><Incidents /></RoleGuard></LayoutWrapper>} />
      <Route path="/incidents/:id" element={<LayoutWrapper currentPageName="IncidentDetail"><RoleGuard permission="isManager"><IncidentDetail /></RoleGuard></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>

    {/* Consent Dialog */}
    <ConsentDialog
      open={needsNewConsent}
      onConsent={saveConsent}
      isLoading={isConsentLoading}
    />
    </>
  );
}


// Vollbild-Display — Auth ohne Layout-Wrapper
const DisplayFullscreen = () => {
  const { currentUser, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoadingAuth && !currentUser) navigate('/login');
  }, [isLoadingAuth, currentUser]);
  if (isLoadingAuth) return null;
  return <Display />;
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            {/* Public pages (NO auth check, rendered outside AuthenticatedApp) */}
            <Route path="/PublicDrinkMenu" element={<PublicDrinkMenu />} />
            <Route path="/Event/:id" element={<EventLanding />} />
            <Route path="/StorageLocationScan/:id" element={<PublicPages.StorageLocationScan />} />

            {/* All authenticated pages */}
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App