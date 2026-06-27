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
import Home from './pages/Home';
import Maintenance from './pages/Maintenance';
import More from './pages/More';
import MyArea from './pages/MyArea';
import MyProfile from './pages/MyProfile';
import MyShifts from './pages/MyShifts';
import NotificationSettings from './pages/NotificationSettings';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import PermissionsNew from './pages/PermissionsNew';
import PriceCalculator from './pages/PriceCalculator';
import PublicDrinkMenu from './pages/PublicDrinkMenu';
import QuickList from './pages/QuickList';
import Recipes from './pages/Recipes';
import Restock from './pages/Restock';
import GuestHub from './pages/GuestHub';
import Settings from './pages/Settings';
import ShiftSwaps from './pages/ShiftSwaps';
import Shopping from './pages/Shopping';
import Suppliers from './pages/Suppliers';
import TeamCalendar from './pages/TeamCalendar';
import TeamMeeting from './pages/TeamMeeting';
import TimeManagement from './pages/TimeManagement';
import TimeTracking from './pages/TimeTracking';
import Todos from './pages/Todos';
import Vacation from './pages/Vacation';
import Storage from './pages/Storage';
import StorageLocationScan from './pages/StorageLocationScan';
import TeamHub from './pages/TeamHub';
import AccountingHub from './pages/AccountingHub';
import BetriebHub from './pages/BetriebHub';
import KarteHub from './pages/KarteHub';
import Warehouse from './pages/Warehouse';
import Wastage from './pages/Wastage';
import Inventory from './pages/Inventory';
import BusinessCard from './pages/BusinessCard';
import WeeklyTasks from './pages/WeeklyTasks';

import Display from './pages/Display';
import DisplayManager from './pages/DisplayManager';

// Special pages (manual imports — non-standard routing)
import CleaningChecklist from './pages/CleaningChecklist';
import EmployeeProfile from './pages/EmployeeProfile';
import Stationsplan from './pages/Stationsplan';
import DataProtection from './pages/DataProtection';
import Impressum from './pages/Impressum';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AGB from './pages/AGB';

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
    "Home": Home,
    "Maintenance": Maintenance,
    "More": More,
    "MyArea": MyArea,
    "MyProfile": MyProfile,
    "MyShifts": MyShifts,
    "NotificationSettings": NotificationSettings,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "Permissions": PermissionsNew,
    "PriceCalculator": PriceCalculator,
    "QuickList": QuickList,
    "Recipes": Recipes,
    "Restock": Restock,
    "GuestHub": GuestHub,
    "Settings": Settings,
    "ShiftSwaps": ShiftSwaps,
    "Shopping": Shopping,
    "Suppliers": Suppliers,
    "TeamCalendar": TeamCalendar,
    "TeamMeeting": TeamMeeting,
    "TimeManagement": TimeManagement,
    "TimeTracking": TimeTracking,
    "Todos": Todos,
    "Vacation": Vacation,
    "Storage": Storage,
    "Warehouse": Warehouse,
    "Wastage": Wastage,
    "Inventory": Inventory,
    "BusinessCard": BusinessCard,
    "WeeklyTasks": WeeklyTasks,
    // Hub-Seiten — mit Layout (Sidebar + Navigation)
    "TeamHub": TeamHub,
    "AccountingHub": AccountingHub,
    "BetriebHub": BetriebHub,
    "KarteHub": KarteHub,
    "DisplayManager": DisplayManager,
};

// Special pages: with Layout wrapper
const SPECIAL_PAGES_WITH_LAYOUT = {
    "CleaningChecklist": CleaningChecklist,
    "EmployeeProfile": EmployeeProfile,
    "Stationsplan": Stationsplan,
    "DataProtection": DataProtection,
    "Impressum": Impressum,
    "PrivacyPolicy": PrivacyPolicy,
    "AGB": AGB,
};

// Public pages: NO layout wrapper (echte öffentliche Seiten ohne Auth/Sidebar)
const PUBLIC_PAGES = {
    "PublicDrinkMenu": PublicDrinkMenu,
    "StorageLocationScan": StorageLocationScan,
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
