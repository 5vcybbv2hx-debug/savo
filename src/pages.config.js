/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * THE ONLY EDITABLE VALUE: mainPage
 */
// Core pages (auto-generated alphabetically)
import ArticleEdit from './pages/ArticleEdit';
import Articles from './pages/Articles';
import Calendar from './pages/Calendar';
import Cleaning from './pages/Cleaning';
import DailyAnalysis from './pages/DailyAnalysis';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DrinkMenu from './pages/DrinkMenu';
import Employees from './pages/Employees';
import Events from './pages/Events';
import Maintenance from './pages/Maintenance';
import More from './pages/More';
import MyArea from './pages/MyArea';
import MyShifts from './pages/MyShifts';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import PermissionsNew from './pages/PermissionsNew';
import PriceCalculator from './pages/PriceCalculator';
import QuickList from './pages/QuickList';
import Recipes from './pages/Recipes';
import Restock from './pages/Restock';
import GuestHub from './pages/GuestHub';

import Shopping from './pages/Shopping';
import Suppliers from './pages/Suppliers';
import TeamCalendar from './pages/TeamCalendar';
import TeamMeeting from './pages/TeamMeeting';
import TimeTracking from './pages/TimeTracking';
import Todos from './pages/Todos';

import StorageLocationScan from './pages/StorageLocationScan';
import TeamHub from './pages/TeamHub';
import BetriebHub from './pages/BetriebHub';
import Warehouse from './pages/Warehouse';
import Wastage from './pages/Wastage';
import Inventory from './pages/Inventory';
import BusinessCard from './pages/BusinessCard';
import WeeklyTasks from './pages/WeeklyTasks';
import Wusa from './pages/Wusa';
import WusaPublic from './pages/WusaPublic';

import Display from './pages/Display';
// DisplayManager wurde in Events (TvPlaylistSection) integriert — Route leitet weiter

// Special pages (manual imports — non-standard routing)
import CleaningChecklist from './pages/CleaningChecklist';
import EmployeeProfile from './pages/EmployeeProfile';
import Stationsplan from './pages/Stationsplan';
import DataProtection from './pages/DataProtection';

import __Layout from './Layout.jsx';

// Page categories for layout and navigation
const CORE_PAGES = {
    "ArticleEdit": ArticleEdit,
    "Articles": Articles,
    "Calendar": Calendar,
    "Cleaning": Cleaning,
    "DailyAnalysis": DailyAnalysis,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "DrinkMenu": DrinkMenu,
    "Employees": Employees,
    "Events": Events,
    "Maintenance": Maintenance,
    "More": More,
    "MyArea": MyArea,
    "MyShifts": MyShifts,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "PermissionsNew": PermissionsNew,
    "PriceCalculator": PriceCalculator,
    "QuickList": QuickList,
    "Recipes": Recipes,
    "Restock": Restock,
    "GuestHub": GuestHub,
    "Shopping": Shopping,
    "Suppliers": Suppliers,
    "TeamCalendar": TeamCalendar,
    "TeamMeeting": TeamMeeting,
    "TimeTracking": TimeTracking,
    "Todos": Todos,
    "Warehouse": Warehouse,
    "Wastage": Wastage,
    "Inventory": Inventory,
    "BusinessCard": BusinessCard,
    "WeeklyTasks": WeeklyTasks,
    "Wusa": Wusa,
    // Hub-Seiten — mit Layout (Sidebar + Navigation)
    "TeamHub": TeamHub,
    "BetriebHub": BetriebHub,
};

// Special pages: with Layout wrapper
const SPECIAL_PAGES_WITH_LAYOUT = {
    "CleaningChecklist": CleaningChecklist,
    "EmployeeProfile": EmployeeProfile,
    "Stationsplan": Stationsplan,
    "DataProtection": DataProtection,
};

// Public pages: NO layout wrapper (echte öffentliche Seiten ohne Auth/Sidebar)
const PUBLIC_PAGES = {
    "StorageLocationScan": StorageLocationScan,
    "WusaPublic": WusaPublic,
    "Display": Display,
};

// Combined pages object (all accessible pages)
export const PAGES = {
    ...CORE_PAGES,
    ...SPECIAL_PAGES_WITH_LAYOUT,
    ...PUBLIC_PAGES,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    CorePages: CORE_PAGES,
    SpecialPagesWithLayout: SPECIAL_PAGES_WITH_LAYOUT,
    PublicPages: PUBLIC_PAGES,
    Layout: __Layout,
};