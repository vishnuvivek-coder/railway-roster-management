import React, { useState, useEffect } from 'react';
import AuthScreen from './AuthScreen';
import TaDocument from './TaDocument';
import NdaDocument from './NdaDocument';
import DiaryDocument from './DiaryDocument';
import DailyEarningsDocument from './DailyEarningsDocument';
import DutyEditModal from './DutyEditModal';
import NonDailyTrainModal from './NonDailyTrainModal';
import MusterRoll from './MusterRoll';
import LRList from './LRList';
import AvailabilitySheet from './AvailabilitySheet';
import UpgradeToCorModal from './UpgradeToCorModal';
import TaApprovals from './TaApprovals';
import SeniorityList from './SeniorityList';
import { applySeniorityCoachAllocation, getSeniorityRank } from './seniorityData';
import { useDevice } from './useDevice';

const API_BASE = '/api';

const TRAIN_DETAILS = {
  '17261': { name: 'Guntur – Tirupati Express', route: 'Guntur ↔ Tirupati', section: 'GNT ↔ TPTY', set: '2-Day Set' },
  '17262': { name: 'Guntur – Tirupati Express', route: 'Guntur ↔ Tirupati', section: 'GNT ↔ TPTY', set: '2-Day Set' },
  '12733': { name: 'Narayanadri Express', route: 'Tirupati ↔ Secunderabad', section: 'TPTY ↔ GNT/SC', set: '2-Day Set' },
  '12734': { name: 'Narayanadri Express', route: 'Tirupati ↔ Secunderabad', section: 'TPTY ↔ GNT/SC', set: '2-Day Set' },
  '20630': { name: 'Vande Bharat Express', route: 'Tirupati ↔ M.G. Ramachandran Central (Chennai)', section: 'TPTY ↔ GNT (crew)', set: '2-Day Set' },
  '20629': { name: 'Vande Bharat Express', route: 'Tirupati ↔ M.G. Ramachandran Central (Chennai)', section: 'TPTY ↔ GNT (crew)', set: '2-Day Set' },
  '17225': { name: 'Amaravati Express', route: 'Vijayawada ↔ Hubballi', section: 'BZA ↔ GTL', set: '2-Day Set' },
  '17226': { name: 'Amaravati Express', route: 'Vijayawada ↔ Hubballi', section: 'BZA ↔ GTL', set: '2-Day Set' },
  '12604': { name: 'Hyderabad – Chennai Express', route: 'Hyderabad ↔ Chennai Central', section: 'MAS ↔ GNT', set: '2-Day Set' },
  '12603': { name: 'Hyderabad – Chennai Express', route: 'Hyderabad ↔ Chennai Central', section: 'MAS ↔ GNT', set: '2-Day Set' },
  '17645': { name: 'Hyderabad – Repalle Express', route: 'Kacheguda ↔ Repalle', section: 'GNT ↔ RAL', set: '2-Day Set' },
  '17646': { name: 'Hyderabad – Repalle Express', route: 'Kacheguda ↔ Repalle', section: 'GNT ↔ RAL', set: '2-Day Set' },
  '17625': { name: 'Kacheguda – Repalle Express', route: 'Kacheguda ↔ Repalle', section: 'KCG ↔ RAL', set: '2-Day Set' },
  '17626': { name: 'Kacheguda – Repalle Express', route: 'Kacheguda ↔ Repalle', section: 'KCG ↔ RAL', set: '2-Day Set' },
  '17664': { name: 'Yesvantpur – Kacheguda Express', route: 'Yesvantpur ↔ Kacheguda', section: 'RAL ↔ GNT (crew continuation)', set: '2-Day Set' },
  '17243': { name: 'Guntur – Rayagada Express', route: 'Guntur ↔ Rayagada', section: 'GNT ↔ VSKP', set: '2-Day Set' },
  '17244': { name: 'Guntur – Rayagada Express', route: 'Guntur ↔ Rayagada', section: 'GNT ↔ VSKP', set: '2-Day Set' },
  '17251': { name: 'Guntur – Dhone Express', route: 'Guntur ↔ Dhone', section: 'GNT ↔ DHNE', set: '2-Day Set' },
  '17252': { name: 'Guntur – Dhone Express', route: 'Guntur ↔ Dhone', section: 'GNT ↔ DHNE', set: '2-Day Set' },
  '17253': { name: 'Guntur – Dhone Express (pair)', route: 'Guntur ↔ Dhone', section: 'GNT ↔ DHNE', set: '2-Day Set' },
  '17254': { name: 'Guntur – Dhone Express (pair)', route: 'Guntur ↔ Dhone', section: 'GNT ↔ DHNE', set: '2-Day Set' },
  '18047': { name: 'Amaravati Express', route: 'Howrah ↔ Vasco-da-Gama', section: 'BZA ↔ GTL', set: '3-Day Set' },
  '18048': { name: 'Amaravati Express', route: 'Howrah ↔ Vasco-da-Gama', section: 'BZA ↔ GTL', set: '3-Day Set' },
  '12795': { name: 'Lingampalli – Nanded Express', route: 'Lingampalli ↔ Hazur Sahib Nanded', section: 'BZA ↔ SC', set: '3-Day Set' },
  '12796': { name: 'Lingampalli – Nanded Express', route: 'Lingampalli ↔ Hazur Sahib Nanded', section: 'BZA ↔ SC', set: '3-Day Set' },
  '12805': { name: 'Janmabhoomi Express', route: 'Visakhapatnam ↔ Secunderabad', section: 'BZA ↔ GNT', set: '3-Day Set' },
  '12806': { name: 'Janmabhoomi Express', route: 'Visakhapatnam ↔ Secunderabad', section: 'BZA ↔ GNT', set: '3-Day Set' },
  '17239': { name: 'Simhadri Express', route: 'Guntur ↔ Visakhapatnam', section: 'GNT ↔ VSKP', set: '3-Day Set' },
  '17240': { name: 'Simhadri Express', route: 'Guntur ↔ Visakhapatnam', section: 'GNT ↔ VSKP', set: '3-Day Set' },
  '17281': { name: 'Guntur – Narasapur Express', route: 'Guntur ↔ Narasapur', section: 'GNT ↔ NS', set: '3-Day Set' },
  '17282': { name: 'Guntur – Narasapur Express', route: 'Guntur ↔ Narasapur', section: 'GNT ↔ NS', set: '3-Day Set' }
};

// Helper to parse numeric train numbers from a string (e.g. "PILOT(67230),17225" => ["67230", "17225"])
const parseTrainNumbers = (trainNumbersStr) => {
  if (!trainNumbersStr || trainNumbersStr.toUpperCase() === 'REST') return [];
  const parts = trainNumbersStr.split(/[,/]/);
  const numbers = [];
  parts.forEach(part => {
    const match = part.match(/\d+/);
    if (match) {
      const num = match[0];
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
  });
  return numbers;
};

const getLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalYearString = () => {
  return String(new Date().getFullYear());
};

const getLocalMonthString = () => {
  return String(new Date().getMonth() + 1);
};

const getLinkDisplayLabel = (catId, linkNum) => {
  if (!linkNum) return '';
  const num = parseInt(linkNum, 10);
  if (parseInt(catId, 10) === 1) {
    if (num === 7) return 'R/7';
    if (num === 14) return 'R/14';
    if (num === 21) return 'R/21';
    return String(num);
  }
  return `#${linkNum}`;
};

export default function App() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('railway_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('railway_auth_token') || null);

  // Derived Admin Role status
  const isAdmin = currentUser?.role === 'Admin';
  const { device, isIOS, isAndroid, isMobile, isDesktop, deviceMode, setDeviceMode, detectedPlatform } = useDevice();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // User Verification & Role Administration State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [userCounts, setUserCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [userFilter, setUserFilter] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [userSearch, setUserSearch] = useState('');
  const [adminActionMsg, setAdminActionMsg] = useState('');

  const [activeTab, setActiveTab] = useState('daily'); // default is daily duties view
  useEffect(() => {
    window.__setActiveTab = (tab) => {
      setActiveTab(tab);
      setIsMobileMenuOpen(false);
    };
  }, []);
  const [docSubTab, setDocSubTab] = useState('ta'); // 'ta' | 'nda' | 'diary'
  const [userRole, setUserRole] = useState(() => currentUser?.role || 'Admin');
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  
  // Shared Document Selection State (Synchronized across TA, NDA, and DIARY)
  const [docStaffId, setDocStaffId] = useState(() => {
    try {
      return localStorage.getItem('railway_doc_staff_id') || '';
    } catch (e) {
      return '';
    }
  });
  const [docYear, setDocYear] = useState(() => {
    try {
      return localStorage.getItem('railway_doc_year') || '2026';
    } catch (e) {
      return '2026';
    }
  });
  const [docMonth, setDocMonth] = useState(() => {
    try {
      return localStorage.getItem('railway_doc_month') || '8';
    } catch (e) {
      return '8';
    }
  });

  // Date states - default to today's date dynamically
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [year, setYear] = useState(getLocalYearString());
  const [month, setMonth] = useState(getLocalMonthString());

  // Staff Movement / Daily view date range states
  const [movementDateMode, setMovementDateMode] = useState('month'); // 'month' | 'range'
  const [movementStartDate, setMovementStartDate] = useState(() => {
    const y = getLocalYearString();
    const m = getLocalMonthString().padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [movementEndDate, setMovementEndDate] = useState(() => {
    const y = parseInt(getLocalYearString(), 10);
    const m = parseInt(getLocalMonthString(), 10);
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [movementSearchQuery, setMovementSearchQuery] = useState('');

  const handleDailyYearChange = (newYear) => {
    setYear(newYear);
    const m = parseInt(month, 10);
    const lastDay = new Date(parseInt(newYear, 10), m, 0).getDate();
    setMovementStartDate(`${newYear}-${String(m).padStart(2, '0')}-01`);
    setMovementEndDate(`${newYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDailyMonthChange = (newMonth) => {
    setMonth(newMonth);
    const y = parseInt(year, 10);
    const m = parseInt(newMonth, 10);
    const lastDay = new Date(y, m, 0).getDate();
    setMovementStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setMovementEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleMovementStartDateChange = (newStart) => {
    setMovementStartDate(newStart);
    if (movementEndDate && newStart > movementEndDate) {
      setMovementEndDate(newStart);
    }
  };

  const handleMovementEndDateChange = (newEnd) => {
    setMovementEndDate(newEnd);
    if (movementStartDate && newEnd < movementStartDate) {
      setMovementStartDate(newEnd);
    }
  };

  const applyMovementPreset = (preset) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    
    const pad = (n) => String(n).padStart(2, '0');
    const toIso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

    if (preset === 'this_month') {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      setMovementStartDate(toIso(s));
      setMovementEndDate(toIso(e));
    } else if (preset === 'last_month') {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      setMovementStartDate(toIso(s));
      setMovementEndDate(toIso(e));
    } else if (preset === 'next_7') {
      const s = new Date(y, m, d);
      const e = new Date(y, m, d + 6);
      setMovementStartDate(toIso(s));
      setMovementEndDate(toIso(e));
    } else if (preset === 'next_14') {
      const s = new Date(y, m, d);
      const e = new Date(y, m, d + 13);
      setMovementStartDate(toIso(s));
      setMovementEndDate(toIso(e));
    } else if (preset === 'next_30') {
      const s = new Date(y, m, d);
      const e = new Date(y, m, d + 29);
      setMovementStartDate(toIso(s));
      setMovementEndDate(toIso(e));
    } else if (preset === 'aug_sep_2026') {
      setMovementStartDate('2026-08-25');
      setMovementEndDate('2026-09-15');
    }
  };

  // State for Daily Duties View
  const [dailyDuties, setDailyDuties] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyViewMode, setDailyViewMode] = useState('table'); // 'table' or 'cards'

  // State for Roster Grid
  const [rosterData, setRosterData] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null); // { staffId, date, currentLink, staffName }
  const [overrideLinkNum, setOverrideLinkNum] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [hoveredCell, setHoveredCell] = useState(null); // tooltip card

  // State for Links CRUD
  const [linksList, setLinksList] = useState([]);
  const [editingLink, setEditingLink] = useState(null);
  const [linkForm, setLinkForm] = useState({
    link_number: '', train_numbers: '', from_station: '', to_station: '', coaches: '', is_rest: false, effective_from: '2026-07-01', set_type: '2-Day Set'
  });
  const [linkSubTab, setLinkSubTab] = useState('train-centric'); // 'train-centric' or 'list'
  const [trainCategoryFilter, setTrainCategoryFilter] = useState('ALL'); // 'ALL' or cat.id
  const [customSets, setCustomSets] = useState([]);
  const [newSetName, setNewSetName] = useState('');
  const [newSetType, setNewSetType] = useState('2-Day Set');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  // State for Non-Daily Trains
  const [trainRosterCategory, setTrainRosterCategory] = useState('daily'); // 'daily' or 'non-daily'
  const [nonDailySelectedDay, setNonDailySelectedDay] = useState('ALL'); // 'ALL' or 'SUNDAY'..'SATURDAY'
  const [nonDailyList, setNonDailyList] = useState([]);
  const [nonDailyModalOpen, setNonDailyModalOpen] = useState(false);
  const [editingNonDailyTrain, setEditingNonDailyTrain] = useState(null);
  const [nonDailyInitialDay, setNonDailyInitialDay] = useState('SUNDAY');
  const [nonDailySubTab, setNonDailySubTab] = useState('today'); // 'today' | 'all'
  const [dragOverNonDailyId, setDragOverNonDailyId] = useState(null);
  // Global Shift Confirmation Modal state for Drag & Drop and Non-Daily shifts
  const [appShiftConfirm, setAppShiftConfirm] = useState(null);
  const [quickAssignNonDailyTrain, setQuickAssignNonDailyTrain] = useState(null);
  const [quickAssignSearch, setQuickAssignSearch] = useState('');
  const [quickAssignShowBusy, setQuickAssignShowBusy] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState('');

  // State for Staff CRUD
  const [staffList, setStaffList] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [upgradeCorModalOpen, setUpgradeCorModalOpen] = useState(false);
  const [upgradeCorCandidate, setUpgradeCorCandidate] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '', designation: '', row_position: '', rest_day: ''
  });

  // State for Leave Requests
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    staff_id: '', from_date: getLocalDateString(), to_date: getLocalDateString(), date: getLocalDateString(), type: 'LEAVE', swap_staff_id: '', reason: ''
  });

  // State for Lookups & Reports
  const [lookupType, setLookupType] = useState('who'); // who, what
  const [lookupLink, setLookupLink] = useState('1');
  const [lookupDate, setLookupDate] = useState(getLocalDateString());
  const [lookupStaffId, setLookupStaffId] = useState('');
  const [lookupResults, setLookupResults] = useState(null);

  // Search states for Daily Summary, Trains, & Staff / LR Sheet
  const [offDutySearch, setOffDutySearch] = useState('');
  const [offDutyCategoryFilter, setOffDutyCategoryFilter] = useState('ALL');
  const [dailyStaffSearch, setDailyStaffSearch] = useState('');
  const [dailyTrainSearch, setDailyTrainSearch] = useState('');
  const [nonDailyTrainSearch, setNonDailyTrainSearch] = useState('');
  const [dailyNonDailySearch, setDailyNonDailySearch] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  // Drag & drop state for Daily Summary Table
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [dragNotice, setDragNotice] = useState(null);

  // State for Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);

  // States for Daily Duty Register
  const [subTab, setSubTab] = useState('entry'); // entry, reco, history
  const [registerDate, setRegisterDate] = useState(getLocalDateString());
  const [registerPageNumber, setRegisterPageNumber] = useState('');
  const [registerEntries, setRegisterEntries] = useState([
    { staff_ids: [], train_out: '', coach_out: '', train_return: '', coach_return: '', duty_label: '', notes: '' }
  ]);
  const [allStaffList, setAllStaffList] = useState([]);
  const [allLinksList, setAllLinksList] = useState([]);
  const [recoData, setRecoData] = useState(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('2026-07-01');
  const [historyEndDate, setHistoryEndDate] = useState('2026-07-31');
  const [historyResults, setHistoryResults] = useState([]);
  const [printDate, setPrintDate] = useState(null);
  const [printPageNum, setPrintPageNum] = useState(null);
  const [printEntries, setPrintEntries] = useState([]);

  // Session verification on mount
  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setCurrentUser(data.user);
            setUserRole(data.user.role);
          } else {
            handleLogout();
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  // Fetch registered users for Master Admin
  const fetchAdminUsers = async () => {
    if (!authToken || currentUser?.role !== 'Admin') return;
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.users) {
        setRegisteredUsers(data.users);
        setUserCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchAdminUsers();
    }
  }, [activeTab, currentUser]);

  const handleApproveUser = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminActionMsg(data.message);
        fetchAdminUsers();
        setTimeout(() => setAdminActionMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to approve user.');
      }
    } catch (err) {
      alert('Error approving user: ' + err.message);
    }
  };

  const handleRejectUser = async (userId) => {
    if (!window.confirm('Are you sure you want to reject or suspend this user account?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminActionMsg(data.message);
        fetchAdminUsers();
        setTimeout(() => setAdminActionMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to reject user.');
      }
    } catch (err) {
      alert('Error rejecting user: ' + err.message);
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminActionMsg(data.message);
        fetchAdminUsers();
        setTimeout(() => setAdminActionMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to update user role.');
      }
    } catch (err) {
      alert('Error updating user role: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account '${username}'?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminActionMsg(data.message);
        fetchAdminUsers();
        setTimeout(() => setAdminActionMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Error deleting user: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('railway_auth_token');
    localStorage.removeItem('railway_user');
    setCurrentUser(null);
    setAuthToken(null);
    setActiveTab('daily');
  };

  // Load Categories, Links, and All Staff on startup
  const fetchAllStaff = () => {
    fetch(`${API_BASE}/staff`)
      .then(res => res.json())
      .then(setAllStaffList);
  };

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        if (data.length > 0) {
          setSelectedCatId(data[0].id.toString());
        }
      });

    fetch(`${API_BASE}/links`)
      .then(res => res.json())
      .then(setAllLinksList);

    fetchAllStaff();
  }, []);

  // Fetch all staff, links, and entries for Daily Duty Register when tab active
  useEffect(() => {
    if (activeTab === 'register') {
      fetchAllStaff();
      fetch(`${API_BASE}/links`)
        .then(res => res.json())
        .then(setAllLinksList);
        
      fetchRegisterForDate(registerDate);
    }
  }, [activeTab, registerDate]);

  // Fetch data based on selected parameters
  useEffect(() => {
    if (selectedCatId) {
      if (activeTab === 'daily' || activeTab === 'roster') {
        fetchRoster();
      }
    }
  }, [selectedCatId, year, month, activeTab, movementDateMode, movementStartDate, movementEndDate]);

  // Fetch daily duties on date or tab change
  useEffect(() => {
    if (activeTab === 'daily-summary' && selectedDate) {
      fetchDailyDuties();
      fetchNonDailyTrains();
    }
  }, [activeTab, selectedDate]);

  // Load other data based on active tab
  useEffect(() => {
    if (activeTab === 'links') {
      fetchLinks(trainCategoryFilter);
      fetchNonDailyTrains();
    }
    if (activeTab === 'staff' && selectedCatId) fetchStaff();
    if (activeTab === 'leaves' || activeTab === 'daily-summary') fetchLeaveRequests();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, selectedCatId, trainCategoryFilter]);

  // Automatically sync staff list for dropdowns
  useEffect(() => {
    if (selectedCatId) fetchStaff();
  }, [selectedCatId]);

  const fetchDailyDuties = () => {
    setLoadingDaily(true);
    fetch(`${API_BASE}/reports/daily-view?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        setDailyDuties(data);
        setLoadingDaily(false);
      })
      .catch(() => setLoadingDaily(false));
    fetchNonDailyTrains('ALL');
  };

  const fetchRoster = (overrideStart, overrideEnd) => {
    if (!selectedCatId) return;
    setLoadingRoster(true);
    let url = `${API_BASE}/roster?category_id=${selectedCatId}`;
    
    if (activeTab === 'daily' && movementDateMode === 'range') {
      const s = overrideStart || movementStartDate;
      const e = overrideEnd || movementEndDate;
      if (s && e) {
        url += `&start_date=${s}&end_date=${e}`;
      } else {
        url += `&year=${year}&month=${month}`;
      }
    } else {
      url += `&year=${year}&month=${month}`;
      const numDays = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const s = `${year}-${String(month).padStart(2, '0')}-01`;
      const e = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;
      url += `&start_date=${s}&end_date=${e}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setRosterData(data);
        setLoadingRoster(false);
      })
      .catch(() => setLoadingRoster(false));
  };

  const fetchLinks = (catFilter = trainCategoryFilter) => {
    const targetCat = (catFilter && catFilter !== 'ALL' && catFilter !== '4') ? catFilter : '';
    const url = targetCat ? `${API_BASE}/links?category_id=${targetCat}` : `${API_BASE}/links`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLinksList(data);
          const uniqueSets = [];
          const seen = new Set();
          data.forEach(l => {
            if (l.set_name && !seen.has(l.set_name)) {
              seen.add(l.set_name);
              uniqueSets.push({ name: l.set_name, type: l.set_type || '2-Day Set', category_id: l.category_id });
            }
          });
          setCustomSets(prev => {
            const merged = [...prev];
            uniqueSets.forEach(us => {
              if (!merged.some(x => x.name === us.name && x.category_id === us.category_id)) {
                merged.push(us);
              }
            });
            return merged;
          });
        }
      })
      .catch(err => console.error('fetchLinks error:', err));
  };

  const fetchStaff = () => {
    fetch(`${API_BASE}/staff?category_id=${selectedCatId}`)
      .then(res => res.json())
      .then(data => {
        setStaffList(data);
        if (data && data.length > 0) {
          setSelectedStaffId(prev => {
            const exists = data.some(s => String(s.id) === String(prev));
            return exists ? prev : String(data[0].id);
          });
        }
      });
  };

  const fetchLeaveRequests = () => {
    fetch(`${API_BASE}/leave-requests`)
      .then(res => res.json())
      .then(data => setLeaveRequests(Array.isArray(data) ? data : []))
      .catch(() => setLeaveRequests([]));
  };

  const fetchAuditLogs = () => {
    fetch(`${API_BASE}/audit-logs`)
      .then(res => res.json())
      .then(data => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(() => setAuditLogs([]));
  };

  const fetchNonDailyTrains = () => {
    fetch(`${API_BASE}/non-daily-trains`)
      .then(res => res.json())
      .then(data => {
        setNonDailyList(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Error fetching non-daily trains:', err));
  };

  useEffect(() => {
    fetchNonDailyTrains();
  }, []);

  // ----------------------------------------------------
  // DAILY DUTY REGISTER HANDLERS
  // ----------------------------------------------------
  const fetchRegisterForDate = (date) => {
    fetch(`${API_BASE}/duty-register?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setRegisterPageNumber(data[0].page_number === null ? '' : data[0].page_number.toString());
          const entriesMapped = data.map(item => ({
            id: item.id,
            staff_ids: item.staff.map(s => s.id),
            train_out: item.train_out || '',
            coach_out: item.coach_out || '',
            train_return: item.train_return || '',
            coach_return: item.coach_return || '',
            duty_label: item.duty_label || '',
            notes: item.notes || ''
          }));
          setRegisterEntries(entriesMapped);
        } else {
          setRegisterPageNumber('');
          setRegisterEntries([
            { staff_ids: [], train_out: '', coach_out: '', train_return: '', coach_return: '', duty_label: '', notes: '' }
          ]);
        }
      });
  };

  const fetchReconciliation = () => {
    setRecoLoading(true);
    fetch(`${API_BASE}/duty-register/reconciliation?date=${registerDate}`)
      .then(res => res.json())
      .then(data => {
        setRecoData(data);
        setRecoLoading(false);
      })
      .catch(() => setRecoLoading(false));
  };

  const fetchHistory = () => {
    let url = `${API_BASE}/duty-register/history?startDate=${historyStartDate}&endDate=${historyEndDate}`;
    if (historySearch) {
      url += `&q=${encodeURIComponent(historySearch)}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(setHistoryResults);
  };

  const saveRegister = (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators can save register records.');
      return;
    }
    fetch(`${API_BASE}/duty-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        date: registerDate,
        page_number: registerPageNumber || null,
        entries: registerEntries
      })
    })
      .then(res => res.json())
      .then(data => {
        alert('Duty register saved successfully!');
        fetchRegisterForDate(registerDate);
      });
  };

  const getRowWarnings = (row) => {
    const warnings = [];
    if (row.staff_ids.length === 0) return warnings;

    const selectedStaffObj = row.staff_ids.map(id => allStaffList.find(s => s.id === id)).filter(Boolean);
    const categoryIds = [...new Set(selectedStaffObj.map(s => s.category_id))];
    if (categoryIds.length > 1) {
      warnings.push('Staff belong to different categories!');
    }

    const catId = categoryIds[0];
    if (catId) {
      if (row.train_out) {
        const outMatch = allLinksList.some(link => 
          link.category_id === catId && 
          link.train_numbers && 
          link.train_numbers.includes(row.train_out) &&
          (!row.coach_out || (link.coaches && link.coaches.includes(row.coach_out)))
        );
        if (!outMatch) {
          warnings.push(`Train No. (Out) "${row.train_out}" or Coach "${row.coach_out}" not found in Link Master.`);
        }
        
        const nums = parseTrainNumbers(row.train_out);
        nums.forEach(num => {
          if (!TRAIN_DETAILS[num]) {
            warnings.push(`Train No. (Out) "${num}" is not in the Official Train Master Chart.`);
          }
        });
      }

      if (row.train_return) {
        const returnMatch = allLinksList.some(link => 
          link.category_id === catId && 
          link.train_numbers && 
          link.train_numbers.includes(row.train_return) &&
          (!row.coach_return || (link.coaches && link.coaches.includes(row.coach_return)))
        );
        if (!returnMatch) {
          warnings.push(`Train No. (Return) "${row.train_return}" or Coach "${row.coach_return}" not found in Link Master.`);
        }
        
        const nums = parseTrainNumbers(row.train_return);
        nums.forEach(num => {
          if (!TRAIN_DETAILS[num]) {
            warnings.push(`Train No. (Return) "${num}" is not in the Official Train Master Chart.`);
          }
        });
      }
    }

    return warnings;
  };

  // ----------------------------------------------------
  // OVERRIDES & DUTY STATUS HANDLERS
  // ----------------------------------------------------
  const [dutyEditModal, setDutyEditModal] = useState(null);

  const openDutyEditModal = (staffDuty, dateStr) => {
    if (!isAdmin) {
      alert('Only administrators can modify employee duty statuses and assignments.');
      return;
    }
    const rawStaffId = staffDuty.staffId || staffDuty.id;
    const isVacant = Boolean(
      staffDuty.isVacant || 
      staffDuty.isVacantUpgrade || 
      staffDuty.isVacantShifted || 
      staffDuty.isVacantAdvance || 
      staffDuty.isVacantAvailableReturn || 
      (staffDuty.name && staffDuty.name.toUpperCase().includes('VACANT'))
    );
    const staffId = typeof rawStaffId === 'string' && (rawStaffId.startsWith('vacant-') || rawStaffId.startsWith('vacant-upgrade-') || rawStaffId.startsWith('vacant-shifted-') || rawStaffId.startsWith('vacant-advance-') || rawStaffId.startsWith('vacant-avl-'))
      ? parseInt(rawStaffId.replace('vacant-upgrade-', '').replace('vacant-shifted-', '').replace('vacant-advance-', '').replace('vacant-avl-', '').replace(/^vacant-.*?-(\d+)$/, '$1').replace(/^vacant-\d+$/, ''), 10) || null
      : rawStaffId;
    const staffObj = typeof staffId === 'number' ? allStaffList.find(s => s.id === staffId) : null;
    const staffName = isVacant ? (staffDuty.name || (staffObj ? staffObj.name : 'Vacant Slot')) : (staffDuty.name || staffDuty.staffName);
    const designation = staffDuty.designation || '';
    const currentLink = staffDuty.link_number !== undefined && staffDuty.link_number !== null
      ? staffDuty.link_number
      : (staffDuty.actualLinkNumber !== undefined ? staffDuty.actualLinkNumber : null);
    const originalLink = staffDuty.original_link_number !== undefined && staffDuty.original_link_number !== null
      ? staffDuty.original_link_number
      : (staffDuty.calculatedLinkNumber !== undefined ? staffDuty.calculatedLinkNumber : null);
    const categoryId = staffDuty.target_category_id || staffDuty.categoryId || (staffObj ? staffObj.category_id : parseInt(selectedCatId, 10));
    const targetCategoryId = staffDuty.target_category_id || staffDuty.categoryId || (staffObj ? staffObj.category_id : parseInt(selectedCatId, 10));
    const categoryName = categories.find(c => c.id === categoryId)?.name || '';
    const status = staffDuty.status || (staffDuty.isRest ? 'REST' : staffDuty.isOverridden ? 'CHANGED_LINK' : 'DUTY');

    setDutyEditModal({
      staffId: isVacant ? (staffDuty.isVacantShifted || staffDuty.isVacantAdvance || staffDuty.isVacantUpgrade ? staffId : null) : staffId,
      originalStaffId: staffDuty.originalStaffId || staffId,
      shiftedStaffId: (staffDuty.isVacantShifted || (typeof rawStaffId === 'string' && rawStaffId.startsWith('vacant-shifted-'))) ? staffId : null,
      advanceStaffId: (staffDuty.isVacantAdvance || (typeof rawStaffId === 'string' && rawStaffId.startsWith('vacant-advance-'))) ? staffId : null,
      originalStaffName: staffDuty.originalStaffName || null,
      name: staffName,
      designation,
      categoryId,
      categoryName,
      target_category_id: targetCategoryId,
      targetCategoryId: targetCategoryId,
      link_number: currentLink || staffDuty.link_number || originalLink,
      date: dateStr || selectedDate,
      currentLink,
      originalLink,
      train_numbers: staffDuty.train_numbers || '',
      firstTrain: staffDuty.firstTrain || '',
      lastTrain: staffDuty.lastTrain || '',
      firstCoaches: staffDuty.firstCoaches || '',
      lastCoaches: staffDuty.lastCoaches || '',
      status,
      substituteStaffId: staffDuty.substituteStaffId || null,
      substituteName: staffDuty.substituteName || '',
      overrideReason: staffDuty.overrideReason || '',
      isOverridden: staffDuty.isOverridden || false,
      cr_available: staffDuty.cr_available || null,
      lr_rest_info: staffDuty.lr_rest_info || null,
      leave_type: staffDuty.leave_type || null,
      isVacant,
      isVacantShifted: staffDuty.isVacantShifted || false,
      isVacantUpgrade: staffDuty.isVacantUpgrade || false,
      isVacantAdvance: staffDuty.isVacantAdvance || false,
      advanceTrainNo: staffDuty.advanceTrainNo || null,
      isUpgraded: staffDuty.isUpgraded || false,
      initialMode: staffDuty.initialMode || (isVacant ? 'ASSIGN_DUTY' : undefined)
    });
  };

  const handleCellClick = (cell, staffId, staffName) => {
    if (!isAdmin) return; // Only Admin can open override modal
    openDutyEditModal({
      staffId,
      name: staffName,
      actualLinkNumber: cell.actualLinkNumber,
      calculatedLinkNumber: cell.calculatedLinkNumber,
      train_numbers: cell.train_numbers,
      status: cell.status,
      substituteStaffId: cell.substituteStaffId,
      substituteName: cell.substituteName,
      overrideReason: cell.overrideReason,
      isOverridden: cell.isOverridden,
      isRest: cell.isRest,
      lr_rest_info: cell.lr_rest_info || null,
      leave_type: cell.leave_type || null
    }, cell.date);
  };

  const onDutyEditSuccess = (msg) => {
    alert(msg);
    fetchAllStaff();
    fetchDailyDuties();
    fetchNonDailyTrains(nonDailySelectedDay);
    fetchRoster();
    if (activeTab === 'staff') fetchStaff();
    if (activeTab === 'audit') fetchAuditLogs();
    try {
      window.dispatchEvent(new CustomEvent('railway_duty_allotment_updated'));
    } catch (e) {}
  };

  const handleUndoDailyDuty = async (d) => {
    if (!isAdmin) return;
    const staffId = d.staffId;
    if (!staffId) return;
    const staffName = d.name || 'Employee';
    if (!window.confirm(`Undo duty modification for ${staffName} on ${selectedDate} and restore cyclic roster?`)) return;
    try {
      const res = await fetch(`${API_BASE}/duty/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo duty change');
      alert(data.message || `Restored ${staffName} to cyclic duty`);
      fetchDailyDuties();
      if (activeTab === 'audit') fetchAuditLogs();
      try {
        window.dispatchEvent(new CustomEvent('railway_duty_allotment_updated'));
      } catch (e) {}
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUndoDailyShift = async (d) => {
    if (!isAdmin) return;
    const rawStaffId = d.staffId || d.id;
    let shiftStaffId = null;
    if (typeof rawStaffId === 'string' && rawStaffId.startsWith('vacant-shifted-')) {
      shiftStaffId = parseInt(rawStaffId.replace('vacant-shifted-', ''), 10);
    } else if (d.originalSickOrLeaveDuty) {
      shiftStaffId = d.originalSickOrLeaveDuty.staffId;
    } else if (typeof rawStaffId === 'number') {
      shiftStaffId = rawStaffId;
    }
    if (!shiftStaffId) {
      alert('Could not determine shifted employee ID.');
      return;
    }
    const staffName = d.originalStaffName || 'Shifted Staff';
    if (!window.confirm(`Undo shift for ${staffName} and restore them to Link #${d.link_number} on ${selectedDate}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/duty/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: shiftStaffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo shift');
      alert(data.message || `Restored ${staffName} to Link #${d.link_number}`);
      fetchDailyDuties();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Helper to determine if a staff member is already assigned to a train or link on selectedDate
  const getStaffCurrentWorkingTrain = (staffId) => {
    if (!staffId || !dailyDuties || !dailyDuties.categories) return null;
    const flatDuties = dailyDuties.categories.reduce((acc, cat) => {
      return acc.concat((cat.staff || []).map(s => ({ ...s, categoryId: cat.categoryId })));
    }, []);
    const d = flatDuties.find(s => s.staffId === staffId);
    if (!d) return null;
    if (d) {
      if (d.extra_train_no) {
        return `Train ${d.extra_train_no} (Non-Daily / Extra)`;
      }
      if (d.link_number !== null && d.link_number !== undefined && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(d.status) && !d.isRest) {
        const tr = d.train_numbers && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(d.train_numbers)
          ? ` (Tr ${d.train_numbers})`
          : '';
        return `Link #${d.link_number}${tr}`;
      }
    }
    const subDuty = flatDuties.find(s => s.substituteStaffId === staffId);
    if (subDuty) {
      const tr = subDuty.train_numbers ? ` (Tr ${subDuty.train_numbers})` : '';
      return `Substitute on Link #${subDuty.link_number}${tr} for ${subDuty.name}`;
    }
    return null;
  };

  const doActualDropStaff = async (staffId, staffName, targetGroup, forceExtra, targetSpecificDuty, dragData) => {
    const targetTrain = targetGroup.firstTrain;
    let vacantDuty = null;
    if (!forceExtra) {
      if (targetSpecificDuty && (targetSpecificDuty.isVacantUpgrade || targetSpecificDuty.isVacantShifted || targetSpecificDuty.isVacantAdvance || targetSpecificDuty.isVacantAvailableReturn || targetSpecificDuty.isVacant || (targetSpecificDuty.name && targetSpecificDuty.name.includes('VACANT')))) {
        vacantDuty = targetSpecificDuty;
      } else {
        vacantDuty = (targetGroup.duties || []).find(d => 
          d.isVacantUpgrade || d.isVacantShifted || d.isVacantAdvance || d.isVacantAvailableReturn || d.isVacant || (d.name && d.name.includes('VACANT'))
        );
      }
    }

    const isExtra = forceExtra || !vacantDuty;
    const targetLink = vacantDuty ? (vacantDuty.link_number || null) : null;
    const targetCatId = vacantDuty 
      ? (vacantDuty.categoryId || 1) 
      : (targetGroup.links?.[0]?.categoryId || dragData.sourceCategoryId || 2);

    try {
      const res = await fetch(`${API_BASE}/duty/drag-assign-train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          source_link: dragData.sourceLink,
          source_category_id: dragData.sourceCategoryId,
          source_train: dragData.sourceTrain,
          target_train: targetTrain,
          target_slot_id: targetGroup.slotId,
          target_link: targetLink,
          target_category_id: targetCatId,
          is_extra: isExtra ? 1 : 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign employee to train');

      const noticeMsg = isExtra
        ? `Assigned ${staffName} to Train ${targetTrain} as Extra Crew (down below)!`
        : `Assigned ${staffName} to Train ${targetTrain} (Link #${targetLink})!`;
      setDragNotice(noticeMsg);
      setTimeout(() => setDragNotice(null), 8000);

      fetchDailyDuties();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDragDropOnTrain = async (dragData, targetGroup, targetSpecificDuty = null, forceExtra = false) => {
    if (!isAdmin) return;
    if (!dragData || !targetGroup) return;

    const staffId = typeof dragData.staffId === 'number' ? dragData.staffId : parseInt(dragData.staffId, 10);
    if (!staffId || isNaN(staffId)) {
      alert('Could not determine employee to move.');
      return;
    }

    const staffName = dragData.staffName || 'Employee';
    const targetTrain = targetGroup.firstTrain;

    // Check if target group already contains this staff member
    if (targetGroup.duties && targetGroup.duties.some(d => d.staffId === staffId)) {
      alert(`${staffName} is already assigned to Train ${targetTrain}.`);
      return;
    }

    const currentWorkingTrain = getStaffCurrentWorkingTrain(staffId);
    if (currentWorkingTrain) {
      setAppShiftConfirm({
        staffName,
        currentTrainDesc: currentWorkingTrain,
        targetTrainDesc: `Train ${targetTrain}`,
        onConfirm: () => doActualDropStaff(staffId, staffName, targetGroup, forceExtra, targetSpecificDuty, dragData)
      });
      return;
    }

    await doActualDropStaff(staffId, staffName, targetGroup, forceExtra, targetSpecificDuty, dragData);
  };

  const doActualAssignNonDaily = async (staffId, staffName, trainItem, dragData) => {
    const trainNo = trainItem.train_number;
    try {
      const res = await fetch(`${API_BASE}/duty/assign-non-daily-train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          non_daily_train_id: trainItem.id,
          train_number: trainNo,
          source_link: dragData?.sourceLink
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign employee to non-daily train');

      setDragNotice(`Assigned ${staffName} to Non-Daily Train ${trainNo}!`);
      setTimeout(() => setDragNotice(null), 8000);

      fetchDailyDuties();
      fetchNonDailyTrains('ALL');
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignStaffToNonDailyTrain = async (dragData, trainItem) => {
    if (!isAdmin) return;
    if (!dragData || !trainItem) return;

    const staffId = typeof dragData.staffId === 'number' ? dragData.staffId : parseInt(dragData.staffId, 10);
    if (!staffId || isNaN(staffId)) {
      alert('Could not determine employee to assign.');
      return;
    }
    const staffName = dragData.staffName || 'Employee';
    const trainNo = trainItem.train_number;

    const currentWorkingTrain = getStaffCurrentWorkingTrain(staffId);
    if (currentWorkingTrain) {
      if (currentWorkingTrain.includes(trainNo)) {
        alert(`${staffName} is already assigned to Train ${trainNo}.`);
        return;
      }
      setAppShiftConfirm({
        staffName,
        currentTrainDesc: currentWorkingTrain,
        targetTrainDesc: `Non-Daily Train ${trainNo}`,
        onConfirm: () => doActualAssignNonDaily(staffId, staffName, trainItem, dragData)
      });
      return;
    }

    await doActualAssignNonDaily(staffId, staffName, trainItem, dragData);
  };

  const handleUnassignStaffFromNonDailyTrain = async (staffId, trainId) => {
    if (!isAdmin) return;
    if (!window.confirm('Remove staff assignment from this non-daily service and restore cyclic status?')) return;
    try {
      const res = await fetch(`${API_BASE}/duty/unassign-non-daily-train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          non_daily_train_id: trainId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unassign employee');

      setDragNotice('Unassigned employee and restored cyclic roster status.');
      setTimeout(() => setDragNotice(null), 8000);

      fetchDailyDuties();
      fetchNonDailyTrains('ALL');
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUndoAdvanceDaily = async (d) => {
    if (!isAdmin) return;
    const rawStaffId = d.staffId || d.id;
    let advStaffId = null;
    if (typeof rawStaffId === 'string' && rawStaffId.startsWith('vacant-advance-')) {
      advStaffId = parseInt(rawStaffId.replace('vacant-advance-', ''), 10);
    } else if (d.originalSickOrLeaveDuty) {
      advStaffId = d.originalSickOrLeaveDuty.staffId;
    } else if (typeof rawStaffId === 'number') {
      advStaffId = rawStaffId;
    }
    if (!advStaffId) {
      alert('Could not determine employee ID for advance duty.');
      return;
    }
    const staffName = d.originalStaffName || 'Staff';
    if (!window.confirm(`Undo advance duty for ${staffName} and restore them to Link #${d.link_number} on ${selectedDate}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/duty/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: advStaffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo advance duty');
      alert(data.message || `Restored ${staffName} to Link #${d.link_number}`);
      fetchDailyDuties();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUndoUpgradeDaily = async (d) => {
    if (!isAdmin) return;
    const rawStaffId = d.staffId || d.id;
    let upStaffId = null;
    if (typeof rawStaffId === 'string' && rawStaffId.startsWith('vacant-upgrade-')) {
      upStaffId = parseInt(rawStaffId.replace('vacant-upgrade-', ''), 10);
    } else if (d.originalSickOrLeaveDuty) {
      upStaffId = d.originalSickOrLeaveDuty.staffId;
    } else if (typeof rawStaffId === 'number') {
      upStaffId = rawStaffId;
    }
    if (!upStaffId) {
      alert('Could not determine upgraded employee ID.');
      return;
    }
    const staffName = d.originalStaffName || 'Staff';
    if (!window.confirm(`Revert COR upgrade for ${staffName} and restore them to Link #${d.link_number} on ${selectedDate}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/duty/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          staff_id: upStaffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revert upgrade');
      alert(data.message || `Restored ${staffName} to Link #${d.link_number}`);
      fetchDailyDuties();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUndoLastDailyChange = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      const logs = await res.json();
      const eligibleLog = logs.find(l => 
        l.is_undone === 0 && 
        l.action_type !== 'UNDO' && 
        (l.description.includes(selectedDate) || ['CHANGED_LINK', 'EXCHANGE_STAFF', 'STAFF_LEAVE', 'STAFF_SICK', 'STAFF_CR', 'CANCEL_LEAVE'].includes(l.action_type))
      );
      if (!eligibleLog) {
        alert('No recent duty changes found to undo on this date.');
        return;
      }
      if (!window.confirm(`Undo last action:\n\n"${eligibleLog.action_type}: ${eligibleLog.description}"?`)) return;
      const undoRes = await fetch(`${API_BASE}/audit-logs/${eligibleLog.id}/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const undoData = await undoRes.json();
      if (!undoRes.ok) throw new Error(undoData.error || 'Failed to undo last action');
      alert(undoData.message || 'Action undone successfully');
      fetchDailyDuties();
      fetchAuditLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUndoAuditLog = async (log) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to undo this action?\n\n"${log.action_type}: ${log.description}"`)) return;
    try {
      const res = await fetch(`${API_BASE}/audit-logs/${log.id}/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo action');
      alert(data.message || 'Action undone successfully!');
      fetchAuditLogs();
      if (activeTab === 'daily-summary' || activeTab === 'daily') fetchDailyDuties();
    } catch (err) {
      alert(err.message);
    }
  };

  // ----------------------------------------------------
  // LINKS CRUD HANDLERS
  // ----------------------------------------------------
  const saveLink = (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const url = editingLink ? `${API_BASE}/links/${editingLink.id}` : `${API_BASE}/links`;
    const method = editingLink ? 'PUT' : 'POST';
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        category_id: parseInt(selectedCatId, 10),
        ...linkForm,
        link_number: parseInt(linkForm.link_number, 10)
      })
    }).then(() => {
      setEditingLink(null);
      setLinkForm({
        link_number: '', train_numbers: '', from_station: '', to_station: '', coaches: '', is_rest: false, effective_from: '2026-07-01', set_type: '2-Day Set'
      });
      fetchLinks();
    });
  };

  const deleteLink = (id) => {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to delete this link definition?')) {
      fetch(`${API_BASE}/links/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(fetchLinks);
    }
  };

  const clearAllLinks = () => {
    if (!isAdmin) return;
    if (confirm('WARNING: This will permanently delete all links/trains from the database. Are you sure?')) {
      fetch(`${API_BASE}/links/clear-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(() => {
        fetchLinks();
        if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
      });
    }
  };

  const handleAddLinkToSet = (linkId, setName, setType) => {
    if (!isAdmin || !linkId) return;
    const link = linksList.find(l => l.id === linkId);
    if (!link) return;

    fetch(`${API_BASE}/links/${linkId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        ...link,
        set_name: setName,
        set_type: setType || link.set_type
      })
    }).then(() => {
      fetchLinks();
      if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
    });
  };

  const deleteCustomSet = (setName) => {
    if (!isAdmin) return;
    if (confirm(`Are you sure you want to delete set "${setName}"? All assigned trains will become unassigned.`)) {
      const linksInSet = linksList.filter(l => l.set_name === setName && l.category_id === parseInt(selectedCatId, 10));
      const promises = linksInSet.map(link => {
        return fetch(`${API_BASE}/links/${link.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            ...link,
            set_name: null
          })
        });
      });

      Promise.all(promises).then(() => {
        setCustomSets(prev => prev.filter(s => !(s.name === setName && s.category_id === parseInt(selectedCatId, 10))));
        fetchLinks();
        if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
      });
    }
  };

  const moveLinkRow = (id, direction) => {
    if (!isAdmin) return;
    const idx = linksList.findIndex(l => l.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= linksList.length) return;

    const currentLink = linksList[idx];
    const targetLink = linksList[targetIdx];

    const reorders = [
      { id: currentLink.id, link_number: targetLink.link_number },
      { id: targetLink.id, link_number: currentLink.link_number }
    ];

    fetch(`${API_BASE}/links/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ reorders })
    }).then(() => {
      fetchLinks();
      if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
    });
  };

  // ----------------------------------------------------
  // STAFF CRUD HANDLERS
  // ----------------------------------------------------
  const saveStaff = (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const url = editingStaff ? `${API_BASE}/staff/${editingStaff.id}` : `${API_BASE}/staff`;
    const method = editingStaff ? 'PUT' : 'POST';
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        category_id: parseInt(selectedCatId, 10),
        ...staffForm,
        row_position: staffForm.row_position ? parseInt(staffForm.row_position, 10) : undefined
      })
    }).then(() => {
      setEditingStaff(null);
      setStaffForm({ name: '', designation: '', row_position: '', rest_day: '' });
      fetchStaff();
      fetchAllStaff();
    });
  };

  const deleteStaff = (id) => {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to delete this staff member?')) {
      fetch(`${API_BASE}/staff/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(fetchStaff);
    }
  };

  const moveStaffRow = (id, direction) => {
    if (!isAdmin) return;
    const idx = staffList.findIndex(s => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= staffList.length) return;

    const currentStaff = staffList[idx];
    const targetStaff = staffList[targetIdx];

    const reorders = [
      { id: currentStaff.id, row_position: targetStaff.row_position },
      { id: targetStaff.id, row_position: currentStaff.row_position }
    ];

    fetch(`${API_BASE}/staff/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ reorders })
    }).then(() => {
      fetchStaff();
      if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
    });
  };

  // ----------------------------------------------------
  // LEAVE REQUESTS HANDLERS
  // ----------------------------------------------------
  const submitLeaveRequest = (e) => {
    e.preventDefault();
    const fromDate = leaveForm.from_date || leaveForm.date;
    const toDate = leaveForm.to_date || fromDate;
    fetch(`${API_BASE}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        staff_id: parseInt(leaveForm.staff_id, 10),
        date: fromDate,
        from_date: fromDate,
        to_date: toDate,
        type: leaveForm.type,
        swap_staff_id: leaveForm.swap_staff_id ? parseInt(leaveForm.swap_staff_id, 10) : null,
        reason: leaveForm.reason
      })
    }).then(() => {
      const today = getLocalDateString();
      setLeaveForm({ staff_id: '', from_date: today, to_date: today, date: today, type: 'LEAVE', swap_staff_id: '', reason: '' });
      fetchLeaveRequests();
    });
  };

  const approveRequest = (id) => {
    if (!isAdmin) return;
    fetch(`${API_BASE}/leave-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(() => {
        fetchLeaveRequests();
        if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
      });
  };

  const rejectRequest = (id) => {
    if (!isAdmin) return;
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    fetch(`${API_BASE}/leave-requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ reason })
    }).then(fetchLeaveRequests);
  };

  // ----------------------------------------------------
  // LOOKUP & REPORTS HANDLERS
  // ----------------------------------------------------
  const runLookup = (e) => {
    e.preventDefault();
    let url = '';
    if (lookupType === 'who') {
      url = `${API_BASE}/reports/who-is-working?category_id=${selectedCatId}&link_number=${lookupLink}&date=${lookupDate}`;
    } else {
      url = `${API_BASE}/reports/what-is-person-working?staff_id=${lookupStaffId}&date=${lookupDate}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(setLookupResults);
  };

  // ----------------------------------------------------
  // EXPORT TO CSV
  // ----------------------------------------------------
  const exportToCSV = () => {
    if (!rosterData) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `ROSTER GRID - ${rosterData.category.name} - ${month}/${year}\n`;
    const dayNames = rosterData.dates.map(d => d.dayOfWeek);
    csvContent += `SL NO,NAME,DESG,${dayNames.join(",")}\n`;
    const dateNums = rosterData.dates.map(d => d.dayOfMonth);
    csvContent += `,,,${dateNums.join(",")}\n`;
    const offsets = rosterData.dates.map(d => d.dayOffset);
    csvContent += `Day-offset since anchor,,,${offsets.join(",")}\n`;
    
    const sortedRows = [...rosterData.rows].sort((a, b) => {
      const linkA = a.cells[0]?.calculatedLinkNumber || 0;
      const linkB = b.cells[0]?.calculatedLinkNumber || 0;
      return linkA - linkB;
    }).map((row, idx) => ({ ...row, slNo: idx + 1 }));

    const q = rosterSearchQuery.trim().toLowerCase();
    const rowsToExport = q
      ? sortedRows.filter(row => {
          if (row.staffName && row.staffName.toLowerCase().includes(q)) return true;
          if (row.designation && row.designation.toLowerCase().includes(q)) return true;
          if (row.rest_day && row.rest_day.toLowerCase().includes(q)) return true;
          if (String(row.slNo) === q || `sl ${row.slNo}` === q || `#${row.slNo}` === q) return true;
          if (row.cr_available && row.cr_available.toLowerCase().includes(q)) return true;
          return row.cells.some(c => {
            if (String(c.calculatedLinkNumber) === q) return true;
            if (String(c.actualLinkNumber) === q) return true;
            if (c.status && String(c.status).toLowerCase().includes(q)) return true;
            if (c.train_numbers && String(c.train_numbers).toLowerCase().includes(q)) return true;
            return false;
          });
        })
      : sortedRows;

    rowsToExport.forEach((row) => {
      const isVacantRow = row.staffName === '(VACANT)';
      const cellValues = row.cells.map(c => {
        if (isVacantRow) return "";
        if (c.status === 'AVAILABLE_FOR_BOOKING') return "AVL(HQ)";
        return c.isRest ? "REST" : c.actualLinkNumber;
      });
      csvContent += `${row.slNo},"${row.staffName || '(VACANT)'}","${row.designation || ''}",${cellValues.join(",")}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${rosterData.category.code}_Roster_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCellLabel = (cell) => {
    if (cell.muster_code) {
      if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(cell.muster_code)) return cell.muster_code;
      if (cell.muster_code === 'OD') return 'OD';
      if (cell.muster_code === 'SICK') return 'SICK';
      if (cell.muster_code === 'CR') return 'CR';
      if (cell.muster_code === 'R') return 'REST';
      if (cell.muster_code === 'O') return 'ABS (O)';
      if (cell.muster_code === 'E') return 'EMG (E)';
    }
    if (cell.status === 'LEAVE') return cell.leave_type || 'LEAVE';
    if (cell.status === 'SICK') return 'SICK';
    if (cell.status === 'CR') return 'CR';
    if (cell.status === 'ABSENT') return 'ABSENT';
    if (cell.status === 'AVAILABLE_FOR_BOOKING') return '⚡ AVL';
    if (cell.isRest) return 'REST';
    return getLinkDisplayLabel(selectedCatId, cell.actualLinkNumber);
  };

  const getCellClass = (cell) => {
    if (cell.muster_code) {
      if (cell.muster_code === 'OD') return 'roster-cell cell-duty cell-override';
      if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(cell.muster_code)) return 'roster-cell cell-leave cell-override';
      if (cell.muster_code === 'SICK') return 'roster-cell cell-sick cell-override';
      if (cell.muster_code === 'CR') return 'roster-cell cell-cr cell-override';
      if (cell.muster_code === 'O') return 'roster-cell cell-sick cell-override';
      if (cell.muster_code === 'R') return 'roster-cell cell-rest cell-override';
    }
    if (cell.status === 'LEAVE') return 'roster-cell cell-leave cell-override';
    if (cell.status === 'SICK' || cell.status === 'ABSENT') return 'roster-cell cell-sick cell-override';
    if (cell.status === 'CR') return 'roster-cell cell-cr cell-override';
    if (cell.status === 'AVAILABLE_FOR_BOOKING') return 'roster-cell cell-available';
    if (cell.isOverridden) {
      return cell.isRest ? 'roster-cell cell-rest cell-override' : 'roster-cell cell-override';
    }
    if (cell.isRest) return 'roster-cell cell-rest';
    return 'roster-cell cell-body cell-duty';
  };

  const renderReconciliationTab = () => {
    if (recoLoading) {
      return (
        <div className="spinner-container">
          <div className="spinner"></div> Running Reconciliation...
        </div>
      );
    }

    if (!recoData) return null;

    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {isAdmin && (
          <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <div>
              <h4 style={{ margin: 0, fontWeight: 600 }}>Need to quickly reconcile?</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                You can pre-populate the actual duty register with the planned duties for this date in one click.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (confirm(`Pre-populate the actual register from the planned roster for ${registerDate}? This will reset entries for this date.`)) {
                  fetch(`${API_BASE}/duty-register/populate-from-roster`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ date: registerDate })
                  }).then(() => fetchReconciliation());
                }
              }}
            >
              📋 Pre-populate Register from Roster
            </button>
          </div>
        )}

        {recoData.categories.map(cat => (
          <div className="card" key={cat.categoryId}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{cat.categoryName} Reconciliation</span>
              <span className="badge badge-approved" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-primary)' }}>
                {cat.categoryCode}
              </span>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Designation</th>
                    <th>Planned Duty (Roster)</th>
                    <th>Actual Duty (Register)</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.reconciliation.map(row => (
                    <tr 
                      key={row.staffId} 
                      style={{ background: row.isMismatch ? 'rgba(255, 77, 77, 0.03)' : 'transparent' }}
                    >
                      <td><strong>{row.name}</strong></td>
                      <td>{row.designation || 'VACANT'}</td>
                      <td>
                        {row.planned.isRest ? (
                          <span className="badge badge-rest" style={{ background: 'var(--rest-bg)', color: 'var(--rest-color)' }}>REST</span>
                        ) : (
                          <div>
                            <strong>Link #{row.planned.link_number}</strong> ({row.planned.train_numbers})
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              Coaches: {row.planned.coaches || '-'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {row.actual ? (
                          <div>
                            {row.actual.duty_label && <div><strong>{row.actual.duty_label}</strong></div>}
                            <div>Out: {row.actual.train_out || '-'} ({row.actual.coach_out || '-'})</div>
                            <div>Ret: {row.actual.train_return || '-'} ({row.actual.coach_return || '-'})</div>
                            {row.actual.crew.length > 1 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                Group: {row.actual.crew.filter(n => n !== row.name).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No entry</span>
                        )}
                      </td>
                      <td>
                        {row.isMismatch ? (
                          <span 
                            className="badge" 
                            style={{ background: 'rgba(255, 77, 77, 0.1)', color: 'var(--override-color)' }}
                            title={row.mismatchReason}
                          >
                            ⚠️ Mismatch
                          </span>
                        ) : (
                          <span className="badge badge-approved">✓ Match</span>
                        )}
                        {row.isMismatch && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--override-color)', marginTop: '4px', maxWidth: '200px' }}>
                            {row.mismatchReason}
                          </div>
                        )}
                      </td>
                      <td>
                        {row.isMismatch && isAdmin && (
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid var(--primary)' }}
                            onClick={() => {
                              setSelectedCell({
                                staffId: row.staffId,
                                date: registerDate,
                                currentLink: row.planned.link_number,
                                staffName: row.name
                              });
                              setOverrideLinkNum(row.actual && row.actual.duty_label === 'REST' ? '' : (row.planned.link_number || '').toString());
                              setOverrideReason(`Reconciled from Daily Register: ${row.mismatchReason}`);
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card">
          <div className="card-title">Search Register History</div>
          <form 
            onSubmit={(e) => { e.preventDefault(); fetchHistory(); }}
            style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <div className="form-group" style={{ minWidth: '200px' }}>
              <label className="form-label">Search Query (Staff, Train, or Label):</label>
              <input 
                type="text" className="form-input"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="e.g. 17253 or MN RAO"
              />
            </div>
            <div className="form-group" style={{ minWidth: '150px' }}>
              <label className="form-label">Start Date:</label>
              <input 
                type="date" className="form-input"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ minWidth: '150px' }}>
              <label className="form-label">End Date:</label>
              <input 
                type="date" className="form-input"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
              Search History
            </button>
          </form>
        </div>

        {historyResults.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="card-title">History Logs ({historyResults.length} records)</div>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const printDataGrouped = historyResults.reduce((acc, curr) => {
                    const key = `${curr.date}_${curr.page_number || 'N/A'}`;
                    if (!acc[key]) {
                      acc[key] = { date: curr.date, page: curr.page_number, entries: [] };
                    }
                    acc[key].entries.push(curr);
                    return acc;
                  }, {});
                  
                  const firstGroup = Object.values(printDataGrouped)[0];
                  if (firstGroup) {
                    document.body.classList.add('printing-ledger');
                    setPrintDate(firstGroup.date);
                    setPrintPageNum(firstGroup.page);
                    setPrintEntries(firstGroup.entries);
                    setTimeout(() => {
                      window.print();
                      document.body.classList.remove('printing-ledger');
                      setPrintDate(null);
                      setPrintPageNum(null);
                      setPrintEntries([]);
                    }, 500);
                  }
                }}
              >
                🖨️ Print Ledger Format
              </button>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Page</th>
                    <th>Name(s)</th>
                    <th>Train No. (Out)</th>
                    <th>Coach (Out)</th>
                    <th>Train No. (Return)</th>
                    <th>Coach (Return)</th>
                    <th>Duty Label</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historyResults.map(row => (
                    <tr key={row.id}>
                      <td><strong>{row.date}</strong></td>
                      <td>{row.page_number || '-'}</td>
                      <td>
                        {row.staff.map(s => (
                          <div key={s.id} style={{ fontWeight: 'bold' }}>{s.name}</div>
                        ))}
                      </td>
                      <td>{row.train_out || '-'}</td>
                      <td>{row.coach_out || '-'}</td>
                      <td>{row.train_return || '-'}</td>
                      <td>{row.coach_return || '-'}</td>
                      <td>{row.duty_label || '-'}</td>
                      <td><span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{row.notes}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!currentUser) {
    return (
      <AuthScreen 
        onLoginSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          setUserRole(user.role);
        }} 
      />
    );
  }

  const renderAppContent = () => (
    <div className={`app-container device-${device}`}>
      {/* Mobile Top Navigation Header with Hamburger Button */}
      <div className="mobile-top-bar">
        <button 
          type="button" 
          className="mobile-hamburger-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Open Navigation Menu"
        >
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>☰</span>
        </button>

        <div className="mobile-header-brand">
          <span style={{ fontSize: '1.2rem' }}>🚆</span>
          <span style={{ fontWeight: 800, fontFamily: 'Fraunces, serif', fontSize: '1.05rem', color: 'var(--primary)' }}>
            Roster Manager
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '0.75rem', flexShrink: 0 }}>
            {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            style={{
              background: 'rgba(189, 90, 90, 0.15)',
              border: '1px solid rgba(189, 90, 90, 0.3)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
          >
            Exit
          </button>
        </div>
      </div>

      {/* Backdrop overlay when mobile drawer is open */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Collapsible Slide-Over Sidebar Navigation */}
      <div className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-icon">🚆</div>
            <div className="logo-text" style={{ fontSize: '1.1rem' }}>Roster Manager</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              type="button" 
              onClick={() => setIsSidebarCollapsed(true)}
              title="Collapse Sidebar"
              className="no-print"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--color-text-secondary)',
                padding: '5px 9px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>◀</span>
            </button>
            <button 
              type="button" 
              className="mobile-sidebar-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
        </div>

        <ul className="nav-links">
          <li 
            className={`nav-item ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => { setActiveTab('daily'); setIsMobileMenuOpen(false); }}
          >
            <span>👤</span> Staff Movement / Schedule
          </li>
          <li 
            className={`nav-item ${activeTab === 'daily-summary' ? 'active' : ''}`}
            onClick={() => { setActiveTab('daily-summary'); setIsMobileMenuOpen(false); }}
          >
            <span>📋</span> Daily Summary Table
          </li>
          <li 
            className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => { setActiveTab('roster'); setIsMobileMenuOpen(false); }}
          >
            <span>📅</span> Roster Grid
          </li>
          <li 
            className={`nav-item ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => { setActiveTab('links'); setIsMobileMenuOpen(false); }}
          >
            <span>🚆</span> Train Roster
          </li>
          <li 
            className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => { setActiveTab('staff'); setIsMobileMenuOpen(false); }}
          >
            <span>👥</span> Staff Roster
          </li>
          <li 
            className={`nav-item ${activeTab === 'leaves' ? 'active' : ''}`}
            onClick={() => { setActiveTab('leaves'); setIsMobileMenuOpen(false); }}
          >
            <span>✉️</span> Leave / Swap
          </li>
          <li 
            className={`nav-item ${activeTab === 'ta-approvals' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ta-approvals'); setIsMobileMenuOpen(false); }}
          >
            <span>✅</span> TA Approvals
          </li>
          <li 
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => { setActiveTab('documents'); setIsMobileMenuOpen(false); }}
          >
            <span>📑</span> DOCUMENTS
          </li>
          <li 
            className={`nav-item ${activeTab === 'muster' ? 'active' : ''}`}
            onClick={() => { setActiveTab('muster'); setIsMobileMenuOpen(false); }}
          >
            <span>📅</span> Muster Details
          </li>
          <li 
            className={`nav-item ${activeTab === 'lr-list' ? 'active' : ''}`}
            onClick={() => { setActiveTab('lr-list'); setIsMobileMenuOpen(false); }}
            style={{ paddingLeft: '28px', fontSize: '0.86rem' }}
          >
            <span>📋</span> LR List (Leave Reserve)
          </li>
          <li 
            className={`nav-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => { setActiveTab('availability'); setIsMobileMenuOpen(false); }}
          >
            <span>🟢</span> Staff Availability
          </li>
          <li 
            className={`nav-item ${activeTab === 'seniority' ? 'active' : ''}`}
            onClick={() => { setActiveTab('seniority'); setIsMobileMenuOpen(false); }}
          >
            <span>🏅</span> Seniority List
          </li>
          <li 
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => { setActiveTab('audit'); setIsMobileMenuOpen(false); }}
          >
            <span>📜</span> Audit Logs
          </li>

          {/* Master Admin User Approvals & Verification */}
          {currentUser?.role === 'Admin' && (
            <li 
              className={`nav-item ${activeTab === 'user-management' ? 'active' : ''}`}
              onClick={() => { setActiveTab('user-management'); setIsMobileMenuOpen(false); }}
              style={{
                marginTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🛡️</span> <strong>User Approvals</strong>
              </div>
              {userCounts?.pending > 0 && (
                <span style={{
                  background: 'linear-gradient(135deg, #BD5A5A, #A44848)',
                  color: '#fff',
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  boxShadow: '0 0 10px rgba(189, 90, 90, 0.4)'
                }}>
                  {userCounts.pending}
                </span>
              )}
            </li>
          )}
        </ul>

        {/* Sidebar Footer with Logged In User Profile & Logout */}
        <div className="sidebar-footer">
          <div className="user-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div className="user-avatar" style={{ flexShrink: 0 }}>
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="user-info" style={{ overflow: 'hidden' }}>
                <span className="user-name" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentUser?.name || currentUser?.username}
                </span>
                <span className="user-role" style={{ color: currentUser?.role === 'Admin' ? 'var(--primary)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {currentUser?.role || 'Staff'} Account
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log Out of System"
              style={{
                background: 'rgba(189, 90, 90, 0.12)',
                border: '1px solid rgba(189, 90, 90, 0.3)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              Exit 🚪
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="header-container">
          <div className="header-title-section">
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '4px 14px', 
              background: 'rgba(212, 161, 92, 0.1)', 
              border: '1px solid rgba(212, 161, 92, 0.25)', 
              borderRadius: '20px', 
              fontSize: '0.74rem', 
              fontWeight: 700, 
              color: 'var(--primary)', 
              letterSpacing: '0.08em', 
              textTransform: 'uppercase', 
              marginBottom: '10px' 
            }}>
              ✦ Railway Operations & Crew Logistics
            </div>
            <h1>Roster Management Dashboard</h1>
            <p>Deterministic, fair rotation roster engine for railway conducting staff</p>
          </div>
        </div>

        {/* Conductor Personal Duty Spotlight Banner */}
        {!isAdmin && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.12) 0%, rgba(108, 100, 153, 0.12) 100%)',
            border: '1px solid rgba(212, 161, 92, 0.35)',
            borderRadius: '16px',
            padding: '18px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.1rem' }}>👤</span>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', fontWeight: 700 }}>
                  Conductor Duty Portal
                </span>
                <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '0.7rem' }}>
                  Read-Only Mode
                </span>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '2px 0 6px 0', fontFamily: 'Fraunces, serif' }}>
                Welcome, {currentUser.name}
              </h2>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Your real-time assigned schedule is loaded below. You can track upcoming link rotations, verify train timings, and submit duty swap requests.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setActiveTab('leaves')}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                📝 Submit Leave / Swap
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setActiveTab('daily');
                  if (currentUser.staff_id) setSelectedStaffId(currentUser.staff_id.toString());
                }}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                📅 My Monthly Schedule
              </button>
            </div>
          </div>
        )}

        {/* Global Controls Filter Panel */}
        {!['documents', 'audit', 'user-management', 'muster', 'lr-list', 'ta-approvals'].includes(activeTab) && (
        <div className="filters-panel">
          {activeTab !== 'daily' && (
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: 0 }}>Category:</label>
              <select 
                className="select-input"
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'daily' && (
            <>
              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Category Filter:</label>
                <select 
                  className="select-input"
                  value={selectedCatId}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setSelectedCatId(newCat);
                    const catEmployees = (allStaffList || []).filter(s => String(s.category_id) === String(newCat) && (!s.name || !s.name.toUpperCase().includes('VACANT')));
                    if (catEmployees.length > 0) {
                      setSelectedStaffId(catEmployees[0].id);
                    }
                  }}
                  style={{ minWidth: '150px' }}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Select Employee:</label>
                <select 
                  className="select-input"
                  value={selectedStaffId}
                  onChange={(e) => {
                    const chosenId = parseInt(e.target.value, 10);
                    setSelectedStaffId(chosenId);
                    const chosenStaff = (allStaffList || []).find(s => s.id === chosenId);
                    if (chosenStaff && String(chosenStaff.category_id) !== String(selectedCatId)) {
                      setSelectedCatId(String(chosenStaff.category_id));
                    }
                  }}
                  style={{ minWidth: '220px' }}
                >
                  {selectedCatId === 'ALL' ? (
                    categories.map(cat => {
                      const catStaff = (allStaffList || []).filter(s => s.category_id === cat.id && (!s.name || !s.name.toUpperCase().includes('VACANT')));
                      if (catStaff.length === 0) return null;
                      return (
                        <optgroup key={cat.id} label={cat.name}>
                          {catStaff.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.designation || '-'})</option>
                          ))}
                        </optgroup>
                      );
                    })
                  ) : (
                    (allStaffList || []).filter(s => String(s.category_id) === String(selectedCatId) && (!s.name || !s.name.toUpperCase().includes('VACANT'))).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.designation || '-'})</option>
                    ))
                  )}
                </select>
              </div>

              {/* View Mode Toggle: Month vs Custom Range */}
              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Date Mode:</label>
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    onClick={() => setMovementDateMode('month')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: movementDateMode === 'month' ? 'var(--primary)' : 'transparent',
                      color: movementDateMode === 'month' ? '#1a1829' : 'var(--color-text-secondary)',
                      fontWeight: movementDateMode === 'month' ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📅 By Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementDateMode('range')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: movementDateMode === 'range' ? 'var(--primary)' : 'transparent',
                      color: movementDateMode === 'range' ? '#1a1829' : 'var(--color-text-secondary)',
                      fontWeight: movementDateMode === 'range' ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📆 Date Range
                  </button>
                </div>
              </div>

              {movementDateMode === 'month' ? (
                <>
                  <div className="filter-group">
                    <label className="form-label" style={{ marginBottom: 0 }}>Year:</label>
                    <select className="select-input" value={year} onChange={(e) => handleDailyYearChange(e.target.value)}>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                  
                  <div className="filter-group">
                    <label className="form-label" style={{ marginBottom: 0 }}>Month:</label>
                    <select className="select-input" value={month} onChange={(e) => handleDailyMonthChange(e.target.value)}>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="filter-group">
                    <label className="form-label" style={{ marginBottom: 0, color: 'var(--primary)' }}>📅 From Date:</label>
                    <input 
                      type="date" 
                      className="select-input" 
                      value={movementStartDate} 
                      onChange={(e) => handleMovementStartDateChange(e.target.value)} 
                      style={{ width: '150px', fontWeight: 600 }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="form-label" style={{ marginBottom: 0, color: 'var(--primary)' }}>📅 To Date:</label>
                    <input 
                      type="date" 
                      className="select-input" 
                      value={movementEndDate} 
                      onChange={(e) => handleMovementEndDateChange(e.target.value)} 
                      style={{ width: '150px', fontWeight: 600 }}
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginRight: '2px' }}>Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyMovementPreset('this_month')}
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: 'var(--color-text)', cursor: 'pointer' }}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMovementPreset('next_7')}
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: 'var(--color-text)', cursor: 'pointer' }}
                    >
                      Next 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMovementPreset('next_14')}
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: 'var(--color-text)', cursor: 'pointer' }}
                    >
                      Next 14 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMovementPreset('aug_sep_2026')}
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '6px', background: 'rgba(212, 161, 92, 0.15)', border: '1px solid var(--border-gold)', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Aug 25 - Sep 15
                    </button>
                  </div>
                </>
              )}

              {/* Quick Search */}
              <div className="filter-group" style={{ marginLeft: 'auto' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Filter Movement:</label>
                <input
                  type="text"
                  placeholder="🔍 Train / Station / Status..."
                  className="select-input"
                  value={movementSearchQuery}
                  onChange={(e) => setMovementSearchQuery(e.target.value)}
                  style={{ minWidth: '180px', padding: '6px 12px' }}
                />
              </div>
            </>
          )}

          {activeTab === 'daily-summary' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Select Date:</label>
                <input 
                  type="date" 
                  className="select-input" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  style={{ width: '160px' }}
                />
              </div>
              {isAdmin && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleUndoLastDailyChange}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      fontSize: '0.84rem',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    title="Undo the most recent duty change on this date"
                  >
                    <span>↩️</span> Undo Last Change
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Year:</label>
              <select className="select-input" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
              
              <label className="form-label" style={{ marginBottom: 0 }}>Month:</label>
              <select className="select-input" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
              </select>

              {/* Roster Search Input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '6px' }}>
                <span style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', fontSize: '0.88rem', pointerEvents: 'none' }}>
                  🔍
                </span>
                <input
                  type="text"
                  className="select-input"
                  placeholder="Search staff, desg, link #..."
                  value={rosterSearchQuery}
                  onChange={(e) => setRosterSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: '32px',
                    paddingRight: rosterSearchQuery ? '28px' : '12px',
                    width: '240px',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    background: 'var(--bg-secondary)',
                    border: rosterSearchQuery ? '1.5px solid var(--border-gold)' : '1px solid var(--border-glass)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                {rosterSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRosterSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
              <button className="btn btn-secondary" onClick={exportToCSV}>
                📥 Export CSV
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => window.print()}
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', border: 'none' }}
              >
                📄 Download PDF
              </button>
            </div>
          )}
        </div>
        )}

        <div className="tab-content-container">
          {/* ----------------------------------------------------
            TAB 1: DAILY DUTIES (FRONT PAGE VIEW)
            ---------------------------------------------------- */}
          {activeTab === 'daily' && (
            <div>
              {loadingRoster ? (
                <div className="spinner-container">
                  <div className="spinner"></div> Loading Employee Schedule...
                </div>
              ) : rosterData ? (() => {
                // Find selected staff member row
                const staffRow = rosterData.rows.find(r => String(r.staffId) === String(selectedStaffId)) || rosterData.rows[0];
                
                if (!staffRow) {
                  return (
                    <div className="alert-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      <span>⚠️</span> No staff members found in this category.
                    </div>
                  );
                }

                return (
                  <div>
                    {/* Header Card with employee details */}
                    <div className="card" style={{ 
                      padding: '20px', 
                      marginBottom: '20px', 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '2rem' }}>👤</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                                {staffRow.staffName}
                              </h2>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => openDutyEditModal({
                                    staffId: staffRow.staffId,
                                    name: staffRow.staffName,
                                    designation: staffRow.designation,
                                    categoryId: parseInt(selectedCatId, 10),
                                    status: 'DUTY'
                                  }, (movementStartDate || `${year}-${String(month).padStart(2, '0')}-01`))}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(212, 161, 92, 0.12)',
                                    color: 'var(--primary)',
                                    border: '1px solid var(--border-gold)',
                                    cursor: 'pointer'
                                  }}
                                  title="Edit Employee Master Details"
                                >
                                  ✏️ Edit Info
                                </button>
                              )}
                            </div>
                            <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span>Designation: <strong>{staffRow.designation || '-'}</strong> | Category: <strong>{rosterData.category.name}</strong></span>
                              {(staffRow.cr_available || (allStaffList.find(s => s.id === staffRow.staffId)?.cr_available)) && (
                                <span className="badge" style={{ 
                                  background: 'rgba(139, 92, 246, 0.2)', 
                                  color: '#c4b5fd', 
                                  border: '1px solid #8b5cf6', 
                                  fontWeight: 700, 
                                  fontSize: '0.8rem', 
                                  padding: '2px 8px' 
                                }}>
                                  💤 CR Available: {staffRow.cr_available || (allStaffList.find(s => s.id === staffRow.staffId)?.cr_available)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-glass)',
                        textAlign: 'right'
                      }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          {movementDateMode === 'range' ? 'Selected Movement Period' : 'Selected Month'}
                        </span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                          {movementDateMode === 'range' ? (
                            `${movementStartDate.split('-').reverse().join('/')} ➔ ${movementEndDate.split('-').reverse().join('/')}`
                          ) : (
                            new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
                          )}
                        </strong>
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {rosterData?.dates?.length ? `${rosterData.dates.length} Days Duty Movement` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-glass)' }}>
                      <table className="roster-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>Date</th>
                            <th style={{ width: '120px' }}>Link No</th>
                            <th>Train Numbers</th>
                            <th>Route</th>
                            <th style={{ width: '100px' }}>Coaches</th>
                            <th>Status / Remarks</th>
                            {isAdmin && <th style={{ width: '80px', textAlign: 'center' }}>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filteredCells = (staffRow.cells || []).filter(cell => {
                              if (!movementSearchQuery) return true;
                              const q = movementSearchQuery.toLowerCase();
                              const dateObj = new Date(cell.date);
                              const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase();
                              const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase();
                              return (
                                (cell.train_numbers && cell.train_numbers.toLowerCase().includes(q)) ||
                                (cell.from_station && cell.from_station.toLowerCase().includes(q)) ||
                                (cell.to_station && cell.to_station.toLowerCase().includes(q)) ||
                                (cell.status && cell.status.toLowerCase().includes(q)) ||
                                (cell.overrideReason && cell.overrideReason.toLowerCase().includes(q)) ||
                                (cell.date && cell.date.includes(q)) ||
                                formattedDate.includes(q) ||
                                dayName.includes(q)
                              );
                            });

                            if (filteredCells.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)' }}>
                                    No duty movements match "<strong>{movementSearchQuery}</strong>" in the selected period.
                                  </td>
                                </tr>
                              );
                            }

                            return filteredCells.map((cell, idx) => {
                            const isMusterLeave = cell.muster_code && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(cell.muster_code);
                            const isMusterOd = cell.muster_code === 'OD' || cell.leave_type === 'OD';
                            const isMusterSick = cell.muster_code === 'SICK';
                            const isMusterCr = cell.muster_code === 'CR';
                            const isMusterRest = cell.muster_code === 'R';
                            const isMusterAbsent = cell.muster_code === 'O';

                            const isSick = cell.status === 'SICK' || isMusterSick;
                            const isLeave = (cell.status === 'LEAVE' || cell.isLeave || isMusterLeave) && !isMusterOd;
                            const isCr = cell.status === 'CR' || isMusterCr;
                            const isAbsent = cell.status === 'ABSENT' || isMusterAbsent;
                            const isAvailableForBooking = cell.status === 'AVAILABLE_FOR_BOOKING';
                            const isCat4 = parseInt(selectedCatId, 10) === 4;
                            const lrInfo = cell.lr_rest_info;
                            const isRest = isMusterRest || (!isAvailableForBooking && !isMusterOd && (cell.isRest || cell.actualLinkNumber === null || cell.status === 'REST'));
                            const isOverridden = cell.isOverridden;
                            
                            let linkLabel = getLinkDisplayLabel(selectedCatId, cell.actualLinkNumber);
                            let cellBg = 'transparent';
                            let badgeStyle = { fontWeight: 700, borderRadius: '6px', padding: '4px 10px', fontSize: '0.85rem' };
                            let trainNoDisplay = cell.train_numbers || '-';
                            let routeDisplay = (cell.from_station || '-') + ' ➔ ' + (cell.to_station || '-');
                            let coachDisplay = cell.coaches || '-';
                            let remarksElement = null;

                            if (isSick) {
                              linkLabel = `🤒 SICK${cell.muster_code ? ' (Muster)' : ''}`;
                              badgeStyle.background = 'rgba(239, 68, 68, 0.15)';
                              badgeStyle.color = '#ef4444';
                              trainNoDisplay = '-';
                              routeDisplay = '-';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: {cell.muster_code}
                                    </span>
                                  )}
                                  <span style={{ color: '#ef4444', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                    Reported Sick {cell.muster_remarks ? `(${cell.muster_remarks})` : ''} {cell.substituteName ? `(Sub: ${cell.substituteName})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isMusterOd) {
                              linkLabel = '📋 OD (On Duty)';
                              badgeStyle.background = 'rgba(16, 185, 129, 0.15)';
                              badgeStyle.color = '#10b981';
                              badgeStyle.border = '1px solid rgba(16, 185, 129, 0.35)';
                              trainNoDisplay = '-';
                              routeDisplay = 'OFFICIAL / OTHER DUTY';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                    📋 Muster: OD
                                  </span>
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                    On Duty (Official / Special Duty) {cell.muster_remarks ? `(${cell.muster_remarks})` : ''} {cell.substituteName ? `(Sub: ${cell.substituteName})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isLeave) {
                              linkLabel = `🏖️ ${cell.muster_code || cell.leave_type || 'LEAVE'}`;
                              badgeStyle.background = 'rgba(245, 158, 11, 0.15)';
                              badgeStyle.color = '#f59e0b';
                              trainNoDisplay = '-';
                              routeDisplay = '-';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: {cell.muster_code}
                                    </span>
                                  )}
                                  <span style={{ color: '#f59e0b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                    Sanctioned Leave {cell.muster_remarks ? `(${cell.muster_remarks})` : ''} {cell.substituteName ? `(Sub: ${cell.substituteName})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isCr) {
                              linkLabel = '💤 CR';
                              badgeStyle.background = 'rgba(139, 92, 246, 0.15)';
                              badgeStyle.color = '#a78bfa';
                              trainNoDisplay = '-';
                              routeDisplay = '-';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid #8b5cf6', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: CR
                                    </span>
                                  )}
                                  <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Compensatory Rest (CR) {cell.muster_remarks ? `(${cell.muster_remarks})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isAbsent) {
                              linkLabel = '❌ ABSENT (O)';
                              badgeStyle.background = 'rgba(239, 68, 68, 0.15)';
                              badgeStyle.color = '#ef4444';
                              trainNoDisplay = '-';
                              routeDisplay = '-';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                    📋 Muster: O
                                  </span>
                                  <span style={{ color: '#ef4444', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                    Unauthorized Absence (Muster Code O) {cell.muster_remarks ? `(${cell.muster_remarks})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isAvailableForBooking) {
                              linkLabel = cell.reason && cell.reason.includes('Removed from Link') ? '⚡ Available (Removed from Link)' : '⚡ Available for Booking';
                              badgeStyle.background = 'rgba(16, 185, 129, 0.18)';
                              badgeStyle.color = '#10b981';
                              badgeStyle.border = '1px solid #10b981';
                              cellBg = 'rgba(16, 185, 129, 0.03)';
                              trainNoDisplay = 'SPARE (HQ)';
                              routeDisplay = 'GNT ➔ GNT';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                    {cell.reason ? `⚡ ${cell.reason}` : '⚡ Available for Booking Duty at HQ'}
                                  </span>
                                  {lrInfo && lrInfo.hasLastDuty && (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                                      Last: Tr. {lrInfo.lastTrainNo} arr GNT {lrInfo.arrivalTime} ({lrInfo.restElapsedHours}h rest given)
                                    </span>
                                  )}
                                </div>
                              );
                            } else if (isRest) {
                              linkLabel = '😴 REST';
                              badgeStyle.background = 'rgba(107, 114, 128, 0.15)';
                              badgeStyle.color = '#9ca3af';
                              trainNoDisplay = '-';
                              routeDisplay = '-';
                              coachDisplay = '-';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.4)', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: {cell.muster_code}
                                    </span>
                                  )}
                                  <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                    Weekly Rest Day {cell.muster_remarks ? `(${cell.muster_remarks})` : ''}
                                  </span>
                                </div>
                              );
                            } else if (isCat4 && lrInfo && !isOverridden) {
                              if (lrInfo.restStatus === 'IN_HQ_REST') {
                                linkLabel = '⏳ In HQ Rest';
                                badgeStyle.background = 'rgba(245, 158, 11, 0.18)';
                                badgeStyle.color = '#f59e0b';
                                badgeStyle.border = '1px solid #f59e0b';
                                cellBg = 'rgba(245, 158, 11, 0.03)';
                                trainNoDisplay = lrInfo.lastTrainNo ? `Last: ${lrInfo.lastTrainNo}` : 'SPARE (HQ)';
                                routeDisplay = 'GNT ➔ GNT';
                                coachDisplay = '-';
                                remarksElement = (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
                                      ⏳ {lrInfo.remarksText}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                      <span>Min 8h Rest: <strong>{lrInfo.rest8hTime}</strong></span>
                                      <span>•</span>
                                      <span>Full 12h: <strong>{lrInfo.rest12hTime}</strong></span>
                                    </div>
                                  </div>
                                );
                              } else if (lrInfo.restStatus === 'REST_COMPLETED_8H') {
                                linkLabel = '⚡ Available (Min 8h Rest)';
                                badgeStyle.background = 'rgba(5, 150, 105, 0.18)';
                                badgeStyle.color = '#059669';
                                badgeStyle.border = '1px solid #059669';
                                cellBg = 'rgba(5, 150, 105, 0.03)';
                                trainNoDisplay = lrInfo.lastTrainNo ? `Last: ${lrInfo.lastTrainNo}` : 'SPARE (HQ)';
                                routeDisplay = 'GNT ➔ GNT';
                                coachDisplay = '-';
                                remarksElement = (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.85rem' }}>
                                      ⚡ {lrInfo.remarksText}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                      <span>8h Rest: <strong>{lrInfo.rest8hTime}</strong></span>
                                      <span>•</span>
                                      <span>Full 12h: <strong>{lrInfo.rest12hTime}</strong></span>
                                    </div>
                                  </div>
                                );
                              } else if (lrInfo.restStatus === 'REST_COMPLETED_12H') {
                                linkLabel = '⚡ Available (12h Rest Complete)';
                                badgeStyle.background = 'rgba(16, 185, 129, 0.18)';
                                badgeStyle.color = '#10b981';
                                badgeStyle.border = '1px solid #10b981';
                                cellBg = 'rgba(16, 185, 129, 0.03)';
                                trainNoDisplay = lrInfo.lastTrainNo ? `Last: ${lrInfo.lastTrainNo}` : 'SPARE (HQ)';
                                routeDisplay = 'GNT ➔ GNT';
                                coachDisplay = '-';
                                remarksElement = (
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                    ⚡ {lrInfo.remarksText}
                                  </span>
                                );
                              } else {
                                linkLabel = '⚡ Available for Booking';
                                badgeStyle.background = 'rgba(16, 185, 129, 0.15)';
                                badgeStyle.color = '#10b981';
                                badgeStyle.border = '1px solid #10b981';
                                trainNoDisplay = 'SPARE (HQ)';
                                routeDisplay = 'GNT ➔ GNT';
                                coachDisplay = '-';
                                remarksElement = (
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                    ⚡ {lrInfo.remarksText || 'Available for Booking Duty at HQ (Standby)'}
                                  </span>
                                );
                              }
                            } else if (isOverridden) {
                              badgeStyle.background = 'rgba(59, 130, 246, 0.15)';
                              badgeStyle.color = '#60a5fa';
                              cellBg = 'rgba(59, 130, 246, 0.02)';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.2)', color: 'var(--primary)', border: '1px solid var(--border-gold)', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: {cell.muster_code}
                                    </span>
                                  )}
                                  <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                                    🔄 Override: <em>{cell.overrideReason || 'Changed duty'}</em>
                                  </span>
                                </div>
                              );
                            } else {
                              badgeStyle.background = 'rgba(16, 185, 129, 0.15)';
                              badgeStyle.color = '#10b981';
                              remarksElement = (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cell.muster_code && (
                                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.72rem', padding: '1px 6px', fontWeight: 700 }}>
                                      📋 Muster: {cell.muster_code}
                                    </span>
                                  )}
                                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Regular Cyclic Duty</span>
                                </div>
                              );
                            }

                            // Format Date beautifully: "01-Aug (Sat)"
                            const dateObj = new Date(cell.date);
                            const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                            const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });

                            return (
                              <tr key={cell.date} style={{ background: cellBg }}>
                                <td>
                                  <strong>{formattedDate}</strong> <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginLeft: '4px' }}>({dayName})</span>
                                </td>
                                <td>
                                  <span style={badgeStyle}>
                                    {linkLabel}
                                  </span>
                                </td>
                                <td>
                                  <strong>{trainNoDisplay}</strong>
                                </td>
                                <td>
                                  {routeDisplay === 'GNT ➔ GNT' ? (
                                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>GNT ➔ GNT</span>
                                  ) : (
                                    <span>{routeDisplay}</span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ color: 'var(--color-text-secondary)' }}>
                                    {coachDisplay}
                                  </span>
                                </td>
                                <td>
                                  {remarksElement}
                                </td>
                                {isAdmin && (
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => openDutyEditModal({
                                        staffId: staffRow.staffId,
                                        name: staffRow.staffName,
                                        designation: staffRow.designation,
                                        categoryId: parseInt(selectedCatId, 10),
                                        actualLinkNumber: cell.actualLinkNumber,
                                        calculatedLinkNumber: cell.calculatedLinkNumber,
                                        train_numbers: cell.train_numbers,
                                        status: cell.status,
                                        substituteStaffId: cell.substituteStaffId,
                                        substituteName: cell.substituteName,
                                        overrideReason: cell.overrideReason,
                                        isOverridden: cell.isOverridden,
                                        isRest: cell.isRest,
                                        lr_rest_info: cell.lr_rest_info,
                                        cr_available: staffRow.cr_available || cell.cr_available
                                      }, cell.date)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        background: 'rgba(212, 161, 92, 0.12)',
                                        color: 'var(--primary)',
                                        border: '1px solid var(--border-gold)',
                                        cursor: 'pointer'
                                      }}
                                      title="Edit Duty Status / Sick / Leave / Changed Link"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : (
                <div className="spinner-container">
                  <div className="spinner"></div> Loading Roster Data...
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
             TAB 1.5: DAILY SUMMARY TABLE (VIEW ALL EMPLOYEES PER DAY)
             ---------------------------------------------------- */}
          {activeTab === 'daily-summary' && (
            <div>
              {loadingDaily ? (
                <div className="spinner-container">
                  <div className="spinner"></div> Loading Daily Duties...
                </div>
              ) : dailyDuties ? (() => {
                if (dailyDuties.error) {
                  return (
                    <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
                      <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>⚠️ {dailyDuties.error}</p>
                      <button type="button" className="btn btn-primary" onClick={() => fetchDailyDuties()} style={{ marginTop: '12px' }}>🔄 Retry</button>
                    </div>
                  );
                }
                const safeLeaveRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
                const staffDuties = dailyDuties.categories?.reduce((acc, curr) => {
                  const staffWithCat = (curr.staff || []).map(s => ({
                    ...s,
                    categoryId: curr.categoryId,
                    categoryCode: curr.categoryCode
                  }));
                  return acc.concat(staffWithCat);
                }, []) || [];

                const MASTER_DAILY_SLOTS = [
                  {
                    slotId: 1,
                    page: 172,
                    firstTrain: '17253',
                    lastTrain: '17252',
                    links: [
                      { categoryId: 2, linkNum: 1, firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 15, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 2,
                    page: 172,
                    firstTrain: '17239',
                    lastTrain: '17240',
                    links: [
                      { categoryId: 2, linkNum: 29, firstCoach: 'AC+2S', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 3,
                    page: 172,
                    firstTrain: '17646',
                    lastTrain: '12796',
                    links: [
                      { categoryId: 2, linkNum: 17, firstCoach: 'AC+SL', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 4,
                    page: 172,
                    firstTrain: '12805',
                    lastTrain: '12806',
                    links: [
                      { categoryId: 2, linkNum: 19, firstCoach: 'AC+2S', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 5,
                    page: 172,
                    firstTrain: '12795',
                    lastTrain: '17645',
                    links: [
                      { categoryId: 2, linkNum: 47, firstCoach: 'AC+2S', lastCoach: 'AC+SL' }
                    ]
                  },
                  {
                    slotId: 6,
                    page: 172,
                    firstTrain: '17251',
                    lastTrain: '17254',
                    links: [
                      { categoryId: 2, linkNum: 5, altLinkNums: [6], firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 33, altLinkNums: [34], firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 7,
                    page: 172,
                    firstTrain: '17281',
                    lastTrain: '17282',
                    links: [
                      { categoryId: 2, linkNum: 45, firstCoach: '2S', lastTrain: '17282', lastCoach: '2S' }
                    ]
                  },
                  {
                    slotId: 8,
                    page: 172,
                    firstTrain: '17261',
                    lastTrain: '12733',
                    links: [
                      { categoryId: 1, linkNum: 4, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-1' },
                      { categoryId: 3, linkNum: 1, firstCoach: 'SL', lastTrain: '17262', lastCoach: 'SL' },
                      { categoryId: 3, linkNum: 4, firstCoach: 'SL', lastTrain: '17262', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 9,
                    page: 172,
                    firstTrain: '20629',
                    lastTrain: '12733',
                    links: [
                      { categoryId: 1, linkNum: 8, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-2' },
                      { categoryId: 2, linkNum: 22, firstCoach: 'SL', lastTrain: '20630', lastCoach: 'SL' },
                      { categoryId: 2, linkNum: 43, firstCoach: 'SL', lastTrain: '20630', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 10,
                    page: 172,
                    firstTrain: '17225',
                    lastTrain: '17226',
                    links: [
                      { categoryId: 1, linkNum: 1, firstCoach: 'AC', lastCoach: 'AC' },
                      { categoryId: 2, linkNum: 11, firstCoach: 'SL', lastCoach: 'SL' },
                      { categoryId: 2, linkNum: 25, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 11,
                    page: 172,
                    firstTrain: '18047',
                    lastTrain: '18048',
                    links: [
                      { categoryId: 1, linkNum: 15, firstCoach: 'AC', lastCoach: 'AC' },
                      { categoryId: 2, linkNum: 57, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 12,
                    page: 172,
                    firstTrain: '17626',
                    lastTrain: '17625',
                    links: [
                      { categoryId: 2, linkNum: 36, altLinkNums: [37], firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 50, altLinkNums: [51], firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 13,
                    page: 173,
                    firstTrain: '12604',
                    lastTrain: '12603',
                    links: [
                      { categoryId: 1, linkNum: 12, firstCoach: 'AC', lastCoach: 'AC' },
                      { categoryId: 2, linkNum: 3, firstCoach: 'SL', lastCoach: 'SL' },
                      { categoryId: 2, linkNum: 31, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 14,
                    page: 173,
                    firstTrain: '12734',
                    lastTrain: '20630',
                    links: [
                      { categoryId: 1, linkNum: 10, firstCoach: 'H1,H2,A1,A2,A3', lastTrain: '20630', lastCoach: 'AC' },
                      { categoryId: 1, linkNum: 18, firstCoach: 'B1,B2,B3,B4', lastTrain: '17262', lastCoach: 'AC' }
                    ]
                  },
                  {
                    slotId: 15,
                    page: 173,
                    firstTrain: '12734',
                    lastTrain: '20630',
                    links: [
                      { categoryId: 2, linkNum: 8, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 16,
                    page: 173,
                    firstTrain: '17243',
                    lastTrain: '17244',
                    links: [
                      { categoryId: 2, linkNum: 39, firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 53, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  }
                ];

                // Non-daily cyclic staff (Links 60, 61, 62) are resolved directly from cyclic roster grid
                const NON_DAILY_LINK_SLOTS = [];

                // Helper to resolve duty assignments for a given slot list
                const activeWorkedStaffIds = new Set();

                const resolveSlotDuties = (slotsList) => {
                  const resolvedRows = [];
                  slotsList.forEach(slot => {
                    const dutiesInSlot = [];
                    slot.links.forEach(lDef => {
                      // Helper to match overridden duty to this slot link (direct linkNum or altLinkNums)
                      const matchesOverrideLink = (duty) => {
                        if (!duty || !duty.isOverridden) return false;
                        const dLink = parseInt(duty.link_number, 10);
                        const targetCat = duty.target_category_id != null 
                          ? parseInt(duty.target_category_id, 10) 
                          : (duty.status === 'SUBSTITUTE' ? 1 : parseInt(duty.categoryId, 10));
                        
                        if (targetCat !== parseInt(lDef.categoryId, 10)) return false;

                        if (dLink === parseInt(lDef.linkNum, 10)) return true;
                        if (lDef.altLinkNums && lDef.altLinkNums.some(alt => parseInt(alt, 10) === dLink)) return true;
                        return false;
                      };

                      // 1. Check if ANY staff with explicit override is assigned to this link (LR, or regular staff shifted to this link)
                      let overriddenStaffDuty = staffDuties.find(d => 
                        !activeWorkedStaffIds.has(d.staffId) &&
                        matchesOverrideLink(d) &&
                        d.name !== 'VACANT (V)'
                      );

                      // 2. Direct active link assignment (prioritizing named staff over VACANT)
                      let regularStaffDuty = staffDuties.find(d => 
                        !activeWorkedStaffIds.has(d.staffId) &&
                        parseInt(d.categoryId, 10) === parseInt(lDef.categoryId, 10) && 
                        parseInt(d.link_number, 10) === parseInt(lDef.linkNum, 10) &&
                        d.name !== 'VACANT (V)'
                      ) || staffDuties.find(d => 
                        !activeWorkedStaffIds.has(d.staffId) &&
                        parseInt(d.categoryId, 10) === parseInt(lDef.categoryId, 10) && 
                        parseInt(d.link_number, 10) === parseInt(lDef.linkNum, 10)
                      );

                      // 3. Or original staff who is SICK/LEAVE/CR or AVAILABLE_FOR_BOOKING or SUBSTITUTE or UTILISED_ADVANCE or CHANGED_LINK or EXTRA_CREW on this link
                      let originalSickOrLeaveDuty = staffDuties.find(d =>
                        parseInt(d.categoryId, 10) === parseInt(lDef.categoryId, 10) &&
                        parseInt(d.original_link_number, 10) === parseInt(lDef.linkNum, 10) &&
                        (d.status === 'SICK' || d.status === 'LEAVE' || d.status === 'CR' || d.status === 'ABSENT' || d.status === 'AVAILABLE_FOR_BOOKING' || d.status === 'SUBSTITUTE' || d.status === 'UTILISED_ADVANCE' || d.status === 'SHIFTED' || d.status === 'EXTRA_CREW' || d.is_extra === 1 || (d.status === 'CHANGED_LINK' && parseInt(d.link_number, 10) !== parseInt(lDef.linkNum, 10)) || (d.overrideReason && /utili[sz]ed\s+advance/i.test(d.overrideReason)))
                      );

                      const isUtilisedAdvance = originalSickOrLeaveDuty &&
                        originalSickOrLeaveDuty.status !== 'EXTRA_CREW' &&
                        originalSickOrLeaveDuty.status !== 'SHIFTED' &&
                        originalSickOrLeaveDuty.status !== 'CHANGED_LINK' &&
                        (
                          originalSickOrLeaveDuty.status === 'UTILISED_ADVANCE' ||
                          originalSickOrLeaveDuty.is_advance_duty === 1 ||
                          /utili[sz]ed\s+advance/i.test(originalSickOrLeaveDuty.overrideReason || '')
                        );
                      let advanceTrainNo = null;
                      if (isUtilisedAdvance) {
                        advanceTrainNo = originalSickOrLeaveDuty.advance_train_no;
                        if (!advanceTrainNo && originalSickOrLeaveDuty.overrideReason) {
                          const m = originalSickOrLeaveDuty.overrideReason.match(/(?:train\s*(?:no\.?|#)?\s*|tr\.?\s*)(\d{4,5})/i);
                          if (m) advanceTrainNo = m[1];
                          else {
                            const m2 = originalSickOrLeaveDuty.overrideReason.match(/(\d{4,5})/);
                            if (m2) advanceTrainNo = m2[1];
                          }
                        }
                      }

                      const isSleeperUpgradedAway = originalSickOrLeaveDuty && 
                        !isUtilisedAdvance && 
                        originalSickOrLeaveDuty.status !== 'EXTRA_CREW' &&
                        originalSickOrLeaveDuty.status !== 'SHIFTED' &&
                        (
                          originalSickOrLeaveDuty.status === 'SUBSTITUTE' || 
                          (parseInt(originalSickOrLeaveDuty.target_category_id, 10) === 1 && parseInt(originalSickOrLeaveDuty.categoryId, 10) !== 1)
                        );
                      const isStaffShiftedAway = originalSickOrLeaveDuty && !isUtilisedAdvance && !isSleeperUpgradedAway && (
                        originalSickOrLeaveDuty.status === 'SHIFTED' ||
                        originalSickOrLeaveDuty.status === 'EXTRA_CREW' ||
                        originalSickOrLeaveDuty.is_extra === 1 ||
                        (originalSickOrLeaveDuty.status === 'CHANGED_LINK' && parseInt(originalSickOrLeaveDuty.link_number, 10) !== parseInt(lDef.linkNum, 10))
                      );

                      let subId = (originalSickOrLeaveDuty && !isSleeperUpgradedAway && !isStaffShiftedAway && !isUtilisedAdvance) 
                        ? (originalSickOrLeaveDuty.substituteStaffId || originalSickOrLeaveDuty.substitute_staff_id) 
                        : null;

                      let staffDuty = overriddenStaffDuty || (subId 
                        ? staffDuties.find(s => !activeWorkedStaffIds.has(s.staffId) && s.staffId === subId) 
                        : (regularStaffDuty && (regularStaffDuty.status === 'AVAILABLE_FOR_BOOKING' || regularStaffDuty.status === 'SUBSTITUTE' || regularStaffDuty.status === 'UTILISED_ADVANCE') ? null : regularStaffDuty));

                      if (staffDuty) {
                        activeWorkedStaffIds.add(staffDuty.staffId);
                        const isApprovedLeave = safeLeaveRequests.some(l => 
                          String(l.staff_id) === String(staffDuty.staffId) && 
                          l.status === 'APPROVED' &&
                          l.type === 'LEAVE' &&
                          ((l.from_date && l.to_date) 
                            ? (selectedDate >= l.from_date && selectedDate <= l.to_date) 
                            : (l.date === selectedDate))
                        );

                        const isUpgradedStaff = (parseInt(lDef.categoryId, 10) === 1 && parseInt(staffDuty.categoryId, 10) !== 1) || (staffDuty.status === 'SUBSTITUTE' && parseInt(lDef.categoryId, 10) === 1);

                        dutiesInSlot.push({
                          ...staffDuty,
                          categoryId: lDef.categoryId,
                          target_category_id: lDef.categoryId,
                          link_number: lDef.linkNum,
                          firstTrain: slot.firstTrain,
                          firstCoaches: lDef.firstCoach,
                          lastTrain: lDef.lastTrain || slot.lastTrain,
                          lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                          isLeave: isApprovedLeave,
                          isUpgraded: isUpgradedStaff,
                          originalStaffName: originalSickOrLeaveDuty ? originalSickOrLeaveDuty.name : null,
                          originalStaffStatus: originalSickOrLeaveDuty ? originalSickOrLeaveDuty.status : null,
                          advanceTrainNo: advanceTrainNo || staffDuty.advance_train_no,
                          isVacantAdvance: false,
                          isRestLink: slot.isRestLink || lDef.isRest || staffDuty.isRest
                        });
                      } else if (originalSickOrLeaveDuty) {
                        if (isUtilisedAdvance) {
                          dutiesInSlot.push({
                            ...originalSickOrLeaveDuty,
                            staffId: `vacant-advance-${originalSickOrLeaveDuty.staffId}`,
                            name: `[UNMANNED / VACANT]`,
                            designation: 'VACANT',
                            link_number: lDef.linkNum,
                            categoryId: lDef.categoryId,
                            target_category_id: lDef.categoryId,
                            firstTrain: slot.firstTrain,
                            firstCoaches: lDef.firstCoach,
                            lastTrain: lDef.lastTrain || slot.lastTrain,
                            lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                            isVacantAdvance: true,
                            isVacant: true,
                            advanceTrainNo: advanceTrainNo || '---',
                            isLeave: false,
                            isSick: false,
                            isCr: false,
                            originalStaffName: originalSickOrLeaveDuty.name,
                            originalStaffStatus: 'UTILISED_ADVANCE',
                            isRestLink: slot.isRestLink || lDef.isRest
                          });
                        } else if (isSleeperUpgradedAway) {
                          dutiesInSlot.push({
                            ...originalSickOrLeaveDuty,
                            staffId: `vacant-upgrade-${originalSickOrLeaveDuty.staffId}`,
                            name: `[VACANT - ${originalSickOrLeaveDuty.name} UPGRADED TO COR]`,
                            designation: 'VACANT',
                            link_number: lDef.linkNum,
                            categoryId: lDef.categoryId,
                            target_category_id: lDef.categoryId,
                            firstTrain: slot.firstTrain,
                            firstCoaches: lDef.firstCoach,
                            lastTrain: lDef.lastTrain || slot.lastTrain,
                            lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                            isVacantUpgrade: true,
                            isVacant: true,
                            isLeave: false,
                            isSick: false,
                            isCr: false,
                            originalStaffName: originalSickOrLeaveDuty.name,
                            originalStaffStatus: 'UPGRADED',
                            isRestLink: slot.isRestLink || lDef.isRest
                          });
                        } else if (isStaffShiftedAway) {
                          const shiftTargetDesc = (originalSickOrLeaveDuty.status === 'EXTRA_CREW' || originalSickOrLeaveDuty.is_extra === 1 || originalSickOrLeaveDuty.extra_train_no)
                            ? `TRAIN ${originalSickOrLeaveDuty.extra_train_no || 'EXTRA'}`
                            : ((originalSickOrLeaveDuty.status === 'CHANGED_LINK' && originalSickOrLeaveDuty.link_number)
                              ? `LINK ${originalSickOrLeaveDuty.link_number}`
                              : (originalSickOrLeaveDuty.overrideReason ? originalSickOrLeaveDuty.overrideReason.replace(/^Shifted to\s*/i, '').toUpperCase() : 'ANOTHER TRAIN'));
                          dutiesInSlot.push({
                            ...originalSickOrLeaveDuty,
                            staffId: `vacant-shifted-${originalSickOrLeaveDuty.staffId}`,
                            name: `[VACANT - ${originalSickOrLeaveDuty.name} SHIFTED TO ${shiftTargetDesc}]`,
                            designation: 'VACANT',
                            link_number: lDef.linkNum,
                            categoryId: lDef.categoryId,
                            target_category_id: lDef.categoryId,
                            firstTrain: slot.firstTrain,
                            firstCoaches: lDef.firstCoach,
                            lastTrain: lDef.lastTrain || slot.lastTrain,
                            lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                            isVacantShifted: true,
                            isVacant: true,
                            isLeave: false,
                            isSick: false,
                            isCr: false,
                            originalStaffName: originalSickOrLeaveDuty.name,
                            originalStaffStatus: 'SHIFTED',
                            isRestLink: slot.isRestLink || lDef.isRest
                          });
                        } else if (originalSickOrLeaveDuty.status === 'AVAILABLE_FOR_BOOKING') {
                          dutiesInSlot.push({
                            ...originalSickOrLeaveDuty,
                            staffId: `vacant-avl-${originalSickOrLeaveDuty.staffId}`,
                            name: `[UNMANNED / VACANT]`,
                            designation: 'VACANT',
                            link_number: lDef.linkNum,
                            categoryId: lDef.categoryId,
                            target_category_id: lDef.categoryId,
                            firstTrain: slot.firstTrain,
                            firstCoaches: lDef.firstCoach,
                            lastTrain: lDef.lastTrain || slot.lastTrain,
                            lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                            isVacantAvailableReturn: true,
                            isVacant: true,
                            isLeave: false,
                            isSick: false,
                            isCr: false,
                            originalStaffName: originalSickOrLeaveDuty.name,
                            originalStaffStatus: 'AVAILABLE_FOR_BOOKING',
                            isRestLink: slot.isRestLink || lDef.isRest
                          });
                        } else {
                          // Duty has no internal substitute staff (e.g. Custom name or Unmanned)
                          dutiesInSlot.push({
                            ...originalSickOrLeaveDuty,
                            staffId: originalSickOrLeaveDuty.staffId,
                            name: originalSickOrLeaveDuty.substituteName || `[UNMANNED / VACANT]`,
                            designation: originalSickOrLeaveDuty.substituteName ? 'Relief TTE' : '-',
                            link_number: lDef.linkNum,
                            categoryId: lDef.categoryId,
                            target_category_id: lDef.categoryId,
                            firstTrain: slot.firstTrain,
                            firstCoaches: lDef.firstCoach,
                            lastTrain: lDef.lastTrain || slot.lastTrain,
                            lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                            isVacant: !originalSickOrLeaveDuty.substituteName,
                            isLeave: originalSickOrLeaveDuty.status === 'LEAVE',
                            isSick: originalSickOrLeaveDuty.status === 'SICK',
                            isCr: originalSickOrLeaveDuty.status === 'CR',
                            originalStaffName: originalSickOrLeaveDuty.name,
                            originalStaffStatus: originalSickOrLeaveDuty.status,
                            isRestLink: slot.isRestLink || lDef.isRest
                          });
                        }
                      } else {
                        // Completely unmanned link slot definition
                        dutiesInSlot.push({
                          staffId: `vacant-slot-${slot.slotId}-link-${lDef.linkNum}`,
                          name: '[UNMANNED / VACANT]',
                          designation: 'VACANT',
                          link_number: lDef.linkNum,
                          categoryId: lDef.categoryId,
                          target_category_id: lDef.categoryId,
                          firstTrain: slot.firstTrain,
                          firstCoaches: lDef.firstCoach,
                          lastTrain: lDef.lastTrain || slot.lastTrain,
                          lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                          isVacant: true,
                          isRestLink: slot.isRestLink || lDef.isRest
                        });
                      }
                    });

                    // Check for Extra Staff assigned to this train slot (dragged or added down below)
                    const extraStaffDuties = staffDuties.filter(d => 
                      !activeWorkedStaffIds.has(d.staffId) &&
                      (
                        (d.extra_train_no && (String(d.extra_train_no) === String(slot.firstTrain) || String(d.extra_train_no) === String(slot.lastTrain))) ||
                        (!d.extra_train_no && d.overrideReason && (
                          new RegExp(`(?:to\\s+train|extra\\s*(?:crew|staff)\\s*(?:on|for)?)\\s*#?\\s*${slot.firstTrain}\\b`, 'i').test(d.overrideReason) ||
                          new RegExp(`(?:to\\s+train|extra\\s*(?:crew|staff)\\s*(?:on|for)?)\\s*#?\\s*${slot.lastTrain}\\b`, 'i').test(d.overrideReason)
                        ))
                      )
                    );

                    extraStaffDuties.forEach(extraStaff => {
                      activeWorkedStaffIds.add(extraStaff.staffId);
                      dutiesInSlot.push({
                        ...extraStaff,
                        firstTrain: slot.firstTrain,
                        firstCoaches: 'Extra Crew',
                        lastTrain: slot.lastTrain,
                        lastCoaches: '-',
                        isExtraCrew: true,
                        isExtraStaff: true,
                        isRestLink: false
                      });
                    });

                    // Apply Seniority Coach Allocation for trains with multiple COR or TTE working
                    applySeniorityCoachAllocation(dutiesInSlot);

                    if (dutiesInSlot.length > 0) {
                      resolvedRows.push({
                        slotId: slot.slotId,
                        page: slot.page,
                        firstTrain: slot.firstTrain,
                        lastTrain: slot.lastTrain,
                        isRestLink: slot.isRestLink,
                        title: slot.title,
                        duties: dutiesInSlot
                      });
                    }
                  });
                  return resolvedRows;
                };

                const activeSlotRows = resolveSlotDuties(MASTER_DAILY_SLOTS);
                const nonDailySlotRows = resolveSlotDuties(NON_DAILY_LINK_SLOTS);

                // Off duties: staff on REST or SICK / LEAVE / CR or not actively working a train slot
                const offDuties = staffDuties.filter(d => {
                  const isApprovedLeave = safeLeaveRequests.some(l => 
                    String(l.staff_id) === String(d.staffId) && 
                    l.status === 'APPROVED' &&
                    l.type === 'LEAVE' &&
                    ((l.from_date && l.to_date) 
                      ? (selectedDate >= l.from_date && selectedDate <= l.to_date) 
                      : (l.date === selectedDate))
                  );
                  const isSickOrLeave = d.status === 'SICK' || d.status === 'LEAVE' || d.status === 'CR' || d.status === 'ABSENT' || isApprovedLeave;
                  const isRest = d.isRest || d.link_number === null;
                  return isSickOrLeave || isRest || !activeWorkedStaffIds.has(d.staffId);
                }).map(d => ({
                  ...d,
                  isLeave: d.status === 'LEAVE' || safeLeaveRequests.some(l => 
                    String(l.staff_id) === String(d.staffId) && 
                    l.date === selectedDate && 
                    l.status === 'APPROVED' &&
                    l.type === 'LEAVE'
                  ),
                  isSick: d.status === 'SICK',
                  isCr: d.status === 'CR'
                }));

                return (
                  <div>
                    {/* Summary Header Card */}
                    <div className="card" style={{ 
                      padding: '20px', 
                      marginBottom: '20px', 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}>
                      <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
                          📋 Daily Summary Sheet
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                          Selected Date: <strong>{(() => {
                            const p = String(selectedDate || getLocalDateString()).split('-');
                            const dt = p.length === 3 ? new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0) : new Date();
                            return !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' }) : selectedDate;
                          })()}</strong>
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={() => {
                          if (activeSlotRows.length === 0 && nonDailySlotRows.length === 0 && offDuties.length === 0) return;
                          let csv = 'Employee Name,Designation,Link No,Status,Train Number (Day 1),Coaches (Day 1),Train Number (Last Day),Coaches (Last Day)\n';
                          
                          // Write active daily duties
                          activeSlotRows.forEach(g => {
                            g.duties.forEach(d => {
                              csv += `"${d.name}","${d.designation || '-'}","${getLinkDisplayLabel(d.categoryId, d.link_number)}","ACTIVE_DAILY","${g.firstTrain}","${d.firstCoaches}","${d.lastTrain}","${d.lastCoaches}"\n`;
                            });
                          });

                          // Write non-daily link duties
                          nonDailySlotRows.forEach(g => {
                            g.duties.forEach(d => {
                              csv += `"${d.name}","${d.designation || '-'}","${getLinkDisplayLabel(d.categoryId, d.link_number)}","NON_DAILY_LINK","${g.firstTrain}","${d.firstCoaches}","${g.lastTrain}","${d.lastCoaches}"\n`;
                            });
                          });

                          // Write off duties (excluding any already recorded in slots)
                          const exportedStaffIds = new Set();
                          activeSlotRows.forEach(g => g.duties.forEach(d => { if (d.staffId) exportedStaffIds.add(d.staffId); }));
                          nonDailySlotRows.forEach(g => g.duties.forEach(d => { if (d.staffId) exportedStaffIds.add(d.staffId); }));

                          offDuties.filter(d => !exportedStaffIds.has(d.staffId)).forEach(d => {
                            csv += `"${d.name}","${d.designation || '-'}","${d.isSick ? 'SICK' : d.isLeave ? 'LEAVE' : 'REST'}","${d.isSick ? 'SICK' : d.isLeave ? 'LEAVE' : 'REST'}","-","-","-","-"\n`;
                          });

                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.setAttribute('download', `Daily_Roster_${selectedDate}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}>
                          📥 Export CSV
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => window.print()}
                          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', border: 'none' }}
                        >
                          📄 Download PDF
                        </button>
                      </div>
                    </div>

                    {/* Search Bar for Daily Summary Duties */}
                    <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: '1', maxWidth: '420px' }}>
                        <input 
                          type="text"
                          className="form-input"
                          placeholder="🔍 Search employee name, train number (e.g. 20629), or link..."
                          value={dailyStaffSearch}
                          onChange={(e) => setDailyStaffSearch(e.target.value)}
                          style={{ paddingRight: dailyStaffSearch ? '36px' : '14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.88rem' }}
                        />
                        {dailyStaffSearch && (
                          <button
                            type="button"
                            onClick={() => setDailyStaffSearch('')}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {dailyStaffSearch && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          Filtering by: <strong>"{dailyStaffSearch}"</strong>
                        </span>
                      )}
                    </div>

                    {/* Drag Notice Banner */}
                    {dragNotice && (
                      <div className="alert-banner no-print" style={{ marginBottom: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                          <span>✅</span> {dragNotice}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDragNotice(null)}
                          style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Daily Train Slots (16 Slots) Table */}
                    <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-glass)', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🚆 Daily Train Slots (16 Slots)
                          </h3>
                          <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem' }}>
                            16 Daily Services
                          </span>
                        </div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                          Official Daily Roster (Pages 172 & 173)
                        </span>
                      </div>
                      <table className="roster-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                            <th style={{ width: '280px' }}>Name of Employee</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Link No</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Train No (1st day)</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Coach (1st day)</th>
                            <th style={{ width: '160px', textAlign: 'center' }}>Train No (last day)</th>
                            <th style={{ textAlign: 'center' }}>Coach (last day)</th>
                            {isAdmin && <th style={{ width: '90px', textAlign: 'center' }}>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filteredActiveSlotRows = !dailyStaffSearch.trim()
                              ? activeSlotRows
                              : activeSlotRows.filter(slot => {
                                  const q = dailyStaffSearch.toLowerCase().trim();
                                  const trainMatch = (slot.firstTrain && slot.firstTrain.includes(q)) || (slot.lastTrain && slot.lastTrain.includes(q));
                                  const staffMatch = slot.duties.some(d => 
                                    (d.name && d.name.toLowerCase().includes(q)) ||
                                    (d.designation && d.designation.toLowerCase().includes(q)) ||
                                    (d.substituteName && d.substituteName.toLowerCase().includes(q)) ||
                                    (String(d.link_number).includes(q))
                                  );
                                  return trainMatch || staffMatch;
                                });

                            return filteredActiveSlotRows.map((group, groupIndex) => {
                              return (
                              <tr 
                                key={groupIndex} 
                                onDragEnter={(e) => {
                                  e.preventDefault();
                                  setDragOverSlotId(group.slotId);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (dragOverSlotId !== group.slotId && !String(dragOverSlotId).startsWith(`${group.slotId}-`)) {
                                    setDragOverSlotId(group.slotId);
                                  }
                                }}
                                onDragLeave={(e) => {
                                  if (e.currentTarget.contains(e.relatedTarget)) return;
                                  if (dragOverSlotId === group.slotId || (dragOverSlotId && String(dragOverSlotId).startsWith(`${group.slotId}-`))) {
                                    setDragOverSlotId(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragOverSlotId(null);
                                  let dragData = null;
                                  try {
                                    const raw = e.dataTransfer.getData('text/plain');
                                    if (raw) dragData = JSON.parse(raw);
                                  } catch (err) {}
                                  if (!dragData && draggedStaff) {
                                    dragData = draggedStaff;
                                  }
                                  if (!dragData) return;
                                  handleDragDropOnTrain(dragData, group);
                                }}
                                style={{ 
                                  borderBottom: '2px solid var(--border-glass)',
                                  backgroundColor: (dragOverSlotId === group.slotId || (dragOverSlotId && String(dragOverSlotId).startsWith(`${group.slotId}-`))) ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                  outline: dragOverSlotId === group.slotId ? '2px dashed #10b981' : (draggedStaff ? '1px dashed rgba(16, 185, 129, 0.35)' : 'none'),
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--color-text-secondary)' }}>
                                    {groupIndex + 1}
                                  </td>
                                  <td style={{ padding: '0px' }}>
                                    {group.duties.map((d, dIdx) => {
                                      const isSick = d.status === 'SICK' || d.isSick;
                                      const isLeave = d.status === 'LEAVE' || d.isLeave;
                                      const isCr = d.status === 'CR' || d.isCr;
                                      const hasSub = d.originalStaffName || d.substituteName;
                                      const isStaffDraggable = isAdmin && !d.isVacant && !d.isVacantShifted && !d.isVacantUpgrade && !d.isVacantAdvance && !d.isVacantAvailableReturn && typeof d.staffId === 'number';
                                      const isSlotVacant = d.isVacantUpgrade || d.isVacantShifted || d.isVacantAdvance || d.isVacantAvailableReturn || d.isVacant || (d.name && (d.name.includes('VACANT') || d.name.includes('SHIFTED') || d.name.includes('UPGRADED')));
                                      const isVacantOver = dragOverSlotId === `${group.slotId}-vacant-${dIdx}`;
                                      
                                      return (
                                        <div key={`${d.staffId || 'd'}-${dIdx}`} style={{ 
                                          padding: '10px 14px', 
                                          borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                          minHeight: '46px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '8px'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            {isStaffDraggable ? (
                                              <div
                                                draggable
                                                onDragStart={(e) => {
                                                  const payload = {
                                                    staffId: d.staffId,
                                                    staffName: d.name,
                                                    sourceLink: d.link_number || d.original_link_number,
                                                    sourceCategoryId: d.categoryId,
                                                    sourceTrain: group.firstTrain
                                                  };
                                                  e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                                                  e.dataTransfer.effectAllowed = 'move';
                                                  setDraggedStaff(payload);
                                                }}
                                                onDragEnd={() => setDraggedStaff(null)}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  cursor: 'grab',
                                                  userSelect: 'none',
                                                  padding: '3px 8px 3px 6px',
                                                  borderRadius: '6px',
                                                  background: 'rgba(255,255,255,0.06)',
                                                  border: '1px solid rgba(255,255,255,0.12)',
                                                  opacity: (draggedStaff && draggedStaff.staffId === d.staffId) ? 0.4 : 1,
                                                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                  transition: 'all 0.15s ease'
                                                }}
                                                title={`Drag ${d.name} to reassign to another train`}
                                              >
                                                <span
                                                  style={{
                                                    fontSize: '1.15rem',
                                                    color: 'var(--primary)',
                                                    lineHeight: 1,
                                                    display: 'inline-flex',
                                                    alignItems: 'center'
                                                  }}
                                                  className="no-print"
                                                >
                                                  ⠿
                                                </span>
                                                <strong style={{ 
                                                  color: hasSub ? 'var(--primary)' : 'inherit',
                                                  fontStyle: 'normal'
                                                }}>
                                                  {d.name}
                                                </strong>
                                              </div>
                                            ) : isSlotVacant ? (
                                              <div
                                                onDragOver={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  e.dataTransfer.dropEffect = 'move';
                                                  if (dragOverSlotId !== `${group.slotId}-vacant-${dIdx}`) setDragOverSlotId(`${group.slotId}-vacant-${dIdx}`);
                                                }}
                                                onDragLeave={(e) => {
                                                  if (e.currentTarget.contains(e.relatedTarget)) return;
                                                  if (dragOverSlotId === `${group.slotId}-vacant-${dIdx}`) setDragOverSlotId(null);
                                                }}
                                                onDrop={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setDragOverSlotId(null);
                                                  let dragData = null;
                                                  try {
                                                    const raw = e.dataTransfer.getData('text/plain');
                                                    if (raw) dragData = JSON.parse(raw);
                                                  } catch (err) {}
                                                  if (!dragData && draggedStaff) dragData = draggedStaff;
                                                  if (!dragData) return;
                                                  handleDragDropOnTrain(dragData, group, d, false);
                                                }}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  padding: '3px 8px',
                                                  borderRadius: '6px',
                                                  background: isVacantOver ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                                                  border: isVacantOver ? '2px dashed #10b981' : (draggedStaff ? '1.5px dashed rgba(239, 68, 68, 0.5)' : '1px dashed rgba(239, 68, 68, 0.2)'),
                                                  transition: 'all 0.15s ease',
                                                  cursor: draggedStaff ? 'copy' : 'default'
                                                }}
                                                title={draggedStaff ? `Drop here to assign ${draggedStaff.staffName} to fill Link #${d.link_number}` : ''}
                                              >
                                                <strong style={{ color: '#ef4444', fontStyle: 'italic' }}>
                                                  {d.name}
                                                </strong>
                                                {draggedStaff && (
                                                  <span className="badge no-print" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.68rem', fontWeight: 700 }}>
                                                    📥 Drop to fill Link #{d.link_number}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <strong style={{ 
                                                color: hasSub ? 'var(--primary)' : 'inherit',
                                                fontStyle: 'normal'
                                              }}>
                                                {d.name}
                                              </strong>
                                            )}
                                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                                              ({d.designation || '-'})
                                            </span>
                                            {(d.seniorityBadge || (d.seniorityRank && d.seniorityRank !== 999)) && (
                                              <span 
                                                className="badge no-print" 
                                                title={d.seniorityShiftReason || `Seniority: ${d.seniorityBadge || ('#' + d.seniorityRank)} (List SL #${d.seniorityRank || '-'}) | Priority: 1.CTI > 2.TTI > 3.SRTE > 4.Sr.CCTC > 5.CCTC`}
                                                style={{ 
                                                  background: d.shiftedBySeniority ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)', 
                                                  color: d.shiftedBySeniority ? '#f59e0b' : 'var(--color-text-secondary)', 
                                                  border: d.shiftedBySeniority ? '1px solid #f59e0b' : '1px solid var(--border-glass)', 
                                                  fontSize: '0.68rem', 
                                                  padding: '1px 6px', 
                                                  fontWeight: 700 
                                                }}
                                              >
                                                🏅 {d.seniorityBadge || (`#${d.seniorityRank}`)}{d.shiftedBySeniority ? ' ⚡' : ''}
                                              </span>
                                            )}
                                            {d.isExtraStaff && (
                                              <span className="badge no-print" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #60a5fa', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                ➕ Extra Crew (Down Below)
                                              </span>
                                            )}
                                            {d.isVacantAdvance && (
                                              <span 
                                                className="blink-advance no-print" 
                                                title={`Staff ${d.originalStaffName || ''} utilised in advance by Train No ${d.advanceTrainNo || ''}. Link slot vacant until original rotation.`}
                                              >
                                                ⚡ UTILISED ADVANCE BY TRAIN NO {d.advanceTrainNo || '---'}
                                              </span>
                                            )}
                                            {d.isVacantAvailableReturn && (
                                              <span className="badge no-print" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                ⚡ VACANT ({d.originalStaffName || 'STAFF'} AVL AT HQ)
                                              </span>
                                            )}
                                            {d.isVacantUpgrade && (
                                              <span className="badge no-print" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                ⚠️ VACANT (UPGRADED)
                                              </span>
                                            )}
                                            {d.isVacantShifted && (
                                              <span className="badge no-print" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                ⚠️ VACANT (SHIFTED)
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && d.isUpgraded && (
                                              <span className="badge no-print" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: '1px solid #eab308', fontSize: '0.7rem', padding: '2px 8px', fontWeight: 700 }}>
                                                ⭐ Upgraded (COR{d.originalStaffName ? ` - Sub for ${d.originalStaffName}` : ''})
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.isUpgraded && d.originalStaffName && (
                                              <span className="badge no-print" style={{ background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                Sub for {d.originalStaffName} ({d.originalStaffStatus || 'LEAVE'})
                                              </span>
                                            )}
                                            {d.muster_code && (
                                              <span className="badge no-print" style={{ background: 'rgba(212, 161, 92, 0.2)', color: 'var(--primary)', border: '1px solid var(--border-gold)', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700 }}>
                                                📋 Muster: {d.muster_code}
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isSick && (
                                              <span className="badge no-print" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                🤒 SICK
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isLeave && (
                                              <span className="badge no-print" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                🏖️ LEAVE
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isCr && (
                                              <span className="badge no-print" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                💤 CR
                                              </span>
                                            )}
                                            {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && !isSick && !isLeave && !isCr && d.isOverridden && (
                                              <span className="badge no-print" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                🔄 OVR
                                              </span>
                                            )}
                                          </div>
                                          {isAdmin && (
                                            <button
                                              type="button"
                                              className="btn btn-secondary no-print"
                                              onClick={() => openDutyEditModal(d, selectedDate)}
                                              style={{
                                                padding: '3px 8px',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid var(--border-glass)',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                              }}
                                              title="Edit Employee Duty / Sick / Leave / Changed Link"
                                            >
                                              ✏️ Edit
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {isAdmin && (
                                      <div
                                        className="no-print"
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          e.dataTransfer.dropEffect = 'move';
                                          if (dragOverSlotId !== `${group.slotId}-extra`) setDragOverSlotId(`${group.slotId}-extra`);
                                        }}
                                        onDragLeave={(e) => {
                                          if (e.currentTarget.contains(e.relatedTarget)) return;
                                          if (dragOverSlotId === `${group.slotId}-extra`) setDragOverSlotId(null);
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setDragOverSlotId(null);
                                          let dragData = null;
                                          try {
                                            const raw = e.dataTransfer.getData('text/plain');
                                            if (raw) dragData = JSON.parse(raw);
                                          } catch (err) {}
                                          if (!dragData && draggedStaff) dragData = draggedStaff;
                                          if (!dragData) return;
                                          handleDragDropOnTrain(dragData, group, null, true);
                                        }}
                                        style={{
                                          padding: '5px 10px',
                                          margin: '6px 10px 6px 10px',
                                          border: dragOverSlotId === `${group.slotId}-extra` ? '2px dashed #10b981' : (draggedStaff ? '1.5px dashed rgba(59, 130, 246, 0.6)' : '1px dashed rgba(255,255,255,0.12)'),
                                          borderRadius: '6px',
                                          textAlign: 'center',
                                          fontSize: '0.73rem',
                                          fontWeight: 600,
                                          color: dragOverSlotId === `${group.slotId}-extra` ? '#10b981' : (draggedStaff ? '#60a5fa' : 'var(--color-text-secondary)'),
                                          background: dragOverSlotId === `${group.slotId}-extra` ? 'rgba(16, 185, 129, 0.18)' : (draggedStaff ? 'rgba(59, 130, 246, 0.08)' : 'transparent'),
                                          cursor: draggedStaff ? 'copy' : 'default',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        {dragOverSlotId === `${group.slotId}-extra`
                                          ? '🟢 Release to add down below as Extra Crew!'
                                          : (draggedStaff
                                            ? `➕ Drop here to add ${draggedStaff.staffName} down below as Extra Crew for Train ${group.firstTrain}`
                                            : '➕ Drag & drop employee here (adds down below as extra crew)')}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0px', textAlign: 'center' }}>
                                    {group.duties.map((d, dIdx) => {
                                      return (
                                        <div key={`${d.staffId || 'd'}-${dIdx}`} style={{ 
                                          padding: '10px 8px', 
                                          borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                          minHeight: '46px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}>
                                          <span style={{ 
                                            fontWeight: 700, 
                                            borderRadius: '6px', 
                                            padding: '4px 10px', 
                                            fontSize: '0.85rem',
                                            background: d.isOverridden ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            color: d.isOverridden ? '#f59e0b' : '#10b981'
                                          }}>
                                            {getLinkDisplayLabel(d.categoryId, d.link_number)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>
                                    {group.firstTrain}
                                  </td>
                                  <td style={{ padding: '0px', textAlign: 'center' }}>
                                    {group.duties.map((d, dIdx) => (
                                      <div key={`${d.staffId || 'd'}-${dIdx}`} style={{ 
                                        padding: '10px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '46px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {d.firstCoaches}
                                      </div>
                                    ))}
                                  </td>
                                  <td style={{ padding: '0px', textAlign: 'center' }}>
                                    {group.duties.map((d, dIdx) => (
                                      <div key={`${d.staffId || 'd'}-${dIdx}`} style={{ 
                                        padding: '10px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '46px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold'
                                      }}>
                                        {d.lastTrain}
                                      </div>
                                    ))}
                                  </td>
                                  <td style={{ padding: '0px', textAlign: 'center' }}>
                                    {group.duties.map((d, dIdx) => (
                                      <div key={`${d.staffId || 'd'}-${dIdx}`} style={{ 
                                        padding: '10px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '46px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {d.lastCoaches}
                                      </div>
                                    ))}
                                  </td>
                                  {isAdmin && (
                                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                      {group.duties.map((d, dIdx) => {
                                        const isSlotVacant = d.isVacantUpgrade || d.isVacantShifted || d.isVacantAdvance || d.isVacantAvailableReturn || d.isVacant || (d.name && (d.name.includes('VACANT') || d.name.includes('SHIFTED') || d.name.includes('UPGRADED')));

                                        return (
                                          <div key={d.staffId || dIdx} style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            {isSlotVacant ? (
                                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                  type="button"
                                                  className="btn btn-primary"
                                                  onClick={() => openDutyEditModal({
                                                    ...d,
                                                    isVacant: true,
                                                    initialMode: 'REPLACE_STAFF'
                                                  }, selectedDate)}
                                                  style={{
                                                    padding: '4px 9px',
                                                    fontSize: '0.74rem',
                                                    fontWeight: 700,
                                                    borderRadius: '6px',
                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  title="Assign relief or replacement staff to fill this vacant link slot"
                                                >
                                                  🔀 Assign Staff
                                                </button>
                                                {(d.isVacantShifted || (d.name && d.name.includes('SHIFTED'))) && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => handleUndoDailyShift(d)}
                                                    style={{
                                                      padding: '4px 8px',
                                                      fontSize: '0.74rem',
                                                      fontWeight: 700,
                                                      borderRadius: '6px',
                                                      background: 'rgba(245, 158, 11, 0.15)',
                                                      color: '#f59e0b',
                                                      border: '1px solid #f59e0b',
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                    title={`Undo shift and restore ${d.originalStaffName || 'staff'} to Link #${d.link_number}`}
                                                  >
                                                    ↩️ Undo Shift
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                  type="button"
                                                  className="btn btn-secondary no-print"
                                                  onClick={() => openDutyEditModal(d, selectedDate)}
                                                  style={{
                                                    padding: '4px 7px',
                                                    fontSize: '0.74rem',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    background: 'rgba(212, 161, 92, 0.12)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid var(--border-gold)',
                                                    cursor: 'pointer'
                                                  }}
                                                  title="Edit Slot Duty"
                                                >
                                                  ✏️ Edit
                                                </button>
                                                {d.isExtraStaff && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary no-print"
                                                    onClick={() => handleUndoDailyShift(d)}
                                                    style={{
                                                      padding: '4px 8px',
                                                      fontSize: '0.72rem',
                                                      fontWeight: 700,
                                                      borderRadius: '6px',
                                                      background: 'rgba(239, 68, 68, 0.15)',
                                                      color: '#ef4444',
                                                      border: '1px solid #ef4444',
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                    title="Remove extra crew assignment & restore original roster"
                                                  >
                                                    ↩️ Remove Extra
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  className="btn btn-secondary no-print"
                                                  onClick={() => openDutyEditModal({
                                                    ...d,
                                                    initialMode: 'REPLACE_STAFF'
                                                  }, selectedDate)}
                                                  style={{
                                                    padding: '4px 6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                                    cursor: 'pointer'
                                                  }}
                                                  title="Replace with another employee"
                                                >
                                                  🔀
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn btn-secondary"
                                                  onClick={() => openDutyEditModal({
                                                    ...d,
                                                    initialMode: 'EXCHANGE_STAFF'
                                                  }, selectedDate)}
                                                  style={{
                                                    padding: '4px 6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    background: 'rgba(6, 182, 212, 0.15)',
                                                    color: '#06b6d4',
                                                    border: '1px solid rgba(6, 182, 212, 0.4)',
                                                    cursor: 'pointer'
                                                  }}
                                                  title="Exchange duties with another employee"
                                                >
                                                  🔁
                                                </button>
                                                {(d.isOverridden || d.status === 'CHANGED_LINK' || d.isLeave || d.isSick || d.isCr || d.originalStaffName) && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => handleUndoDailyDuty(d)}
                                                    style={{
                                                      padding: '4px 6px',
                                                      fontSize: '0.72rem',
                                                      fontWeight: 600,
                                                      borderRadius: '6px',
                                                      background: 'rgba(239, 68, 68, 0.12)',
                                                      color: '#f87171',
                                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                                      cursor: 'pointer'
                                                    }}
                                                    title="Undo duty modification & restore cyclic roster"
                                                  >
                                                    ↩️
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </td>
                                  )}
                                </tr>
                            );
                          });
                        })()}
                        {activeSlotRows.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? "8" : "7"} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                              No active worked duties found for this date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      </table>
                    </div>

                    {/* Non-Daily Links Roster Section (Links #60, #61, #62) */}
                    {(() => {
                      const filteredNonDailySlotRows = !dailyStaffSearch.trim()
                        ? nonDailySlotRows
                        : nonDailySlotRows.filter(slot => {
                            const q = dailyStaffSearch.toLowerCase().trim();
                            const trainMatch = (slot.firstTrain && slot.firstTrain.toLowerCase().includes(q)) || 
                                               (slot.lastTrain && slot.lastTrain.toLowerCase().includes(q)) ||
                                               (slot.title && slot.title.toLowerCase().includes(q));
                            const staffMatch = (slot.duties || []).some(d => 
                              (d.name && d.name.toLowerCase().includes(q)) ||
                              (d.designation && d.designation.toLowerCase().includes(q)) ||
                              (d.substituteName && d.substituteName.toLowerCase().includes(q)) ||
                              (String(d.link_number).includes(q))
                            );
                            return trainMatch || staffMatch;
                          });

                      return null;
                      return (
                        <div className="card" style={{ 
                          marginBottom: '24px', 
                          padding: '20px', 
                          background: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-glass)', 
                          borderRadius: '12px' 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  🚆 Non-Daily Links Roster (Links #60, #61, #62)
                                </h3>
                                <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', fontWeight: 700, fontSize: '0.78rem', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                                  3 Cyclic Links
                                </span>
                              </div>
                              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                                Dedicated 4-day non-daily sleeper links (Trains 22882/22881, 17221/17222, 17069/17262) and Weekly Rest cycle.
                              </p>
                            </div>
                          </div>

                          <div className="table-responsive" style={{ background: 'rgba(0, 0, 0, 0.12)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border-glass)' }}>
                            <table className="roster-table" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                                  <th style={{ width: '280px' }}>Name of Employee</th>
                                  <th style={{ width: '100px', textAlign: 'center' }}>Link No</th>
                                  <th style={{ width: '140px', textAlign: 'center' }}>Train No (1st day)</th>
                                  <th style={{ width: '140px', textAlign: 'center' }}>Coach (1st day)</th>
                                  <th style={{ width: '160px', textAlign: 'center' }}>Train No (last day)</th>
                                  <th style={{ textAlign: 'center' }}>Coach (last day)</th>
                                  {isAdmin && <th style={{ width: '90px', textAlign: 'center' }}>Action</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredNonDailySlotRows.map((group, groupIndex) => {
                                  return (
                                    <tr 
                                      key={group.slotId || groupIndex} 
                                      onDragEnter={(e) => {
                                        e.preventDefault();
                                        setDragOverSlotId(group.slotId || `nd-${groupIndex}`);
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverSlotId !== (group.slotId || `nd-${groupIndex}`) && !String(dragOverSlotId).startsWith(`${group.slotId || `nd-${groupIndex}`}-`)) {
                                          setDragOverSlotId(group.slotId || `nd-${groupIndex}`);
                                        }
                                      }}
                                      onDragLeave={(e) => {
                                        if (e.currentTarget.contains(e.relatedTarget)) return;
                                        if (dragOverSlotId === (group.slotId || `nd-${groupIndex}`) || (dragOverSlotId && String(dragOverSlotId).startsWith(`${group.slotId || `nd-${groupIndex}`}-`))) {
                                          setDragOverSlotId(null);
                                        }
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverSlotId(null);
                                        let dragData = null;
                                        try {
                                          const raw = e.dataTransfer.getData('text/plain');
                                          if (raw) dragData = JSON.parse(raw);
                                        } catch (err) {}
                                        if (!dragData && draggedStaff) dragData = draggedStaff;
                                        if (!dragData) return;
                                        handleDragDropOnTrain(dragData, group);
                                      }}
                                      style={{ 
                                        borderBottom: '2px solid var(--border-glass)',
                                        backgroundColor: (dragOverSlotId === (group.slotId || `nd-${groupIndex}`) || (dragOverSlotId && String(dragOverSlotId).startsWith(`${group.slotId || `nd-${groupIndex}`}-`))) ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                        outline: dragOverSlotId === (group.slotId || `nd-${groupIndex}`) ? '2px dashed #10b981' : (draggedStaff ? '1px dashed rgba(16, 185, 129, 0.35)' : 'none'),
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <td style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                        {groupIndex + 1}
                                      </td>
                                      <td style={{ padding: '0px' }}>
                                        {group.duties.map((d, dIdx) => {
                                          const isSick = d.status === 'SICK' || d.isSick;
                                          const isLeave = d.status === 'LEAVE' || d.isLeave;
                                          const isCr = d.status === 'CR' || d.isCr;
                                          const isRest = d.isRest || d.isRestLink;
                                          const hasSub = d.originalStaffName || d.substituteName;
                                          const isStaffDraggable = isAdmin && !d.isVacant && !d.isVacantShifted && !d.isVacantUpgrade && !d.isVacantAdvance && !d.isVacantAvailableReturn && typeof d.staffId === 'number';
                                          const isSlotVacant = d.isVacantUpgrade || d.isVacantShifted || d.isVacantAdvance || d.isVacantAvailableReturn || d.isVacant || (d.name && (d.name.includes('VACANT') || d.name.includes('SHIFTED') || d.name.includes('UPGRADED')));
                                          const isVacantOver = dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-vacant-${dIdx}`;
                                          
                                          return (
                                            <div key={`${d.staffId || 'nd'}-${dIdx}`} style={{ 
                                              padding: '10px 14px', 
                                              borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                              minHeight: '46px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '8px'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                {isStaffDraggable ? (
                                                  <div
                                                    draggable
                                                    onDragStart={(e) => {
                                                      const payload = {
                                                        staffId: d.staffId,
                                                        staffName: d.name,
                                                        sourceLink: d.link_number || d.original_link_number,
                                                        sourceCategoryId: d.categoryId,
                                                        sourceTrain: group.firstTrain
                                                      };
                                                      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                                                      e.dataTransfer.effectAllowed = 'move';
                                                      setDraggedStaff(payload);
                                                    }}
                                                    onDragEnd={() => setDraggedStaff(null)}
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      cursor: 'grab',
                                                      userSelect: 'none',
                                                      padding: '3px 8px 3px 6px',
                                                      borderRadius: '6px',
                                                      background: 'rgba(255,255,255,0.06)',
                                                      border: '1px solid rgba(255,255,255,0.12)',
                                                      opacity: (draggedStaff && draggedStaff.staffId === d.staffId) ? 0.4 : 1,
                                                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                      transition: 'all 0.15s ease'
                                                    }}
                                                    title={`Drag ${d.name} to reassign to another train`}
                                                  >
                                                    <span
                                                      style={{
                                                        fontSize: '1.15rem',
                                                        color: 'var(--primary)',
                                                        lineHeight: 1,
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                      }}
                                                      className="no-print"
                                                    >
                                                      ⠿
                                                    </span>
                                                    <strong style={{ 
                                                      color: hasSub ? 'var(--primary)' : 'inherit',
                                                      fontStyle: 'normal'
                                                    }}>
                                                      {d.name}
                                                    </strong>
                                                  </div>
                                                ) : isSlotVacant ? (
                                                  <div
                                                    onDragOver={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      e.dataTransfer.dropEffect = 'move';
                                                      if (dragOverSlotId !== `${group.slotId || `nd-${groupIndex}`}-vacant-${dIdx}`) setDragOverSlotId(`${group.slotId || `nd-${groupIndex}`}-vacant-${dIdx}`);
                                                    }}
                                                    onDragLeave={(e) => {
                                                      if (e.currentTarget.contains(e.relatedTarget)) return;
                                                      if (dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-vacant-${dIdx}`) setDragOverSlotId(null);
                                                    }}
                                                    onDrop={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setDragOverSlotId(null);
                                                      let dragData = null;
                                                      try {
                                                        const raw = e.dataTransfer.getData('text/plain');
                                                        if (raw) dragData = JSON.parse(raw);
                                                      } catch (err) {}
                                                      if (!dragData && draggedStaff) dragData = draggedStaff;
                                                      if (!dragData) return;
                                                      handleDragDropOnTrain(dragData, group, d, false);
                                                    }}
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      padding: '3px 8px',
                                                      borderRadius: '6px',
                                                      background: isVacantOver ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                                                      border: isVacantOver ? '2px dashed #10b981' : (draggedStaff ? '1.5px dashed rgba(239, 68, 68, 0.5)' : '1px dashed rgba(239, 68, 68, 0.2)'),
                                                      transition: 'all 0.15s ease',
                                                      cursor: draggedStaff ? 'copy' : 'default'
                                                    }}
                                                    title={draggedStaff ? `Drop here to assign ${draggedStaff.staffName} to fill Link #${d.link_number}` : ''}
                                                  >
                                                    <strong style={{ color: '#ef4444', fontStyle: 'italic' }}>
                                                      {d.name}
                                                    </strong>
                                                    {draggedStaff && (
                                                      <span className="badge no-print" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.68rem', fontWeight: 700 }}>
                                                        📥 Drop to fill Link #{d.link_number}
                                                      </span>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <strong style={{ 
                                                    color: hasSub ? 'var(--primary)' : 'inherit',
                                                    fontStyle: 'normal'
                                                  }}>
                                                    {d.name}
                                                  </strong>
                                                )}
                                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                                                  ({d.designation || '-'})
                                                </span>
                                                {d.isVacantAdvance && (
                                                  <span 
                                                    className="blink-advance no-print" 
                                                    title={`Staff ${d.originalStaffName || ''} utilised in advance by Train No ${d.advanceTrainNo || ''}. Link slot vacant until original rotation.`}
                                                  >
                                                    ⚡ UTILISED ADVANCE BY TRAIN NO {d.advanceTrainNo || '---'}
                                                  </span>
                                                )}
                                                {d.isVacantAvailableReturn && (
                                                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                    ⚡ VACANT ({d.originalStaffName || 'STAFF'} AVL AT HQ)
                                                  </span>
                                                )}
                                                {d.isVacantUpgrade && (
                                                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                    ⚠️ VACANT (UPGRADED)
                                                  </span>
                                                )}
                                                {d.isVacantShifted && (
                                                  <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b', fontSize: '0.68rem', padding: '1px 6px', fontWeight: 700 }}>
                                                    ⚠️ VACANT (SHIFTED)
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && d.isUpgraded && (
                                                  <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: '1px solid #eab308', fontSize: '0.7rem', padding: '2px 8px', fontWeight: 700 }}>
                                                    ⭐ Upgraded (COR{d.originalStaffName ? ` - Sub for ${d.originalStaffName}` : ''})
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.isUpgraded && d.originalStaffName && (
                                                  <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    Sub for {d.originalStaffName} ({d.originalStaffStatus || 'LEAVE'})
                                                  </span>
                                                )}
                                                {d.muster_code && (
                                                  <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.2)', color: 'var(--primary)', border: '1px solid var(--border-gold)', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700 }}>
                                                    📋 Muster: {d.muster_code}
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isSick && (
                                                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    🤒 SICK
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isLeave && (
                                                  <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    🏖️ LEAVE
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isCr && (
                                                  <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    💤 CR
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && isRest && (
                                                  <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    💤 WEEKLY REST
                                                  </span>
                                                )}
                                                {!d.isVacantUpgrade && !d.isVacantShifted && !d.isVacantAdvance && !d.originalStaffName && !isSick && !isLeave && !isCr && !isRest && d.isOverridden && (
                                                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.68rem', padding: '1px 6px' }}>
                                                    🔄 OVR
                                                  </span>
                                                )}
                                              </div>
                                              {isAdmin && (
                                                <button
                                                  type="button"
                                                  className="btn btn-secondary"
                                                  onClick={() => openDutyEditModal(d, selectedDate)}
                                                  style={{
                                                    padding: '3px 8px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid var(--border-glass)',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                  }}
                                                  title="Edit Employee Duty / Sick / Leave / Changed Link"
                                                >
                                                  ✏️ Edit
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {isAdmin && (
                                          <div
                                            className="no-print"
                                            onDragOver={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.dataTransfer.dropEffect = 'move';
                                              if (dragOverSlotId !== `${group.slotId || `nd-${groupIndex}`}-extra`) setDragOverSlotId(`${group.slotId || `nd-${groupIndex}`}-extra`);
                                            }}
                                            onDragLeave={(e) => {
                                              if (e.currentTarget.contains(e.relatedTarget)) return;
                                              if (dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-extra`) setDragOverSlotId(null);
                                            }}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setDragOverSlotId(null);
                                              let dragData = null;
                                              try {
                                                const raw = e.dataTransfer.getData('text/plain');
                                                if (raw) dragData = JSON.parse(raw);
                                              } catch (err) {}
                                              if (!dragData && draggedStaff) dragData = draggedStaff;
                                              if (!dragData) return;
                                              handleDragDropOnTrain(dragData, group, null, true);
                                            }}
                                            style={{
                                              padding: '5px 10px',
                                              margin: '6px 10px 6px 10px',
                                              border: dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-extra` ? '2px dashed #10b981' : (draggedStaff ? '1.5px dashed rgba(59, 130, 246, 0.6)' : '1px dashed rgba(255,255,255,0.12)'),
                                              borderRadius: '6px',
                                              textAlign: 'center',
                                              fontSize: '0.73rem',
                                              fontWeight: 600,
                                              color: dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-extra` ? '#10b981' : (draggedStaff ? '#60a5fa' : 'var(--color-text-secondary)'),
                                              background: dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-extra` ? 'rgba(16, 185, 129, 0.18)' : (draggedStaff ? 'rgba(59, 130, 246, 0.08)' : 'transparent'),
                                              cursor: draggedStaff ? 'copy' : 'default',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            {dragOverSlotId === `${group.slotId || `nd-${groupIndex}`}-extra`
                                              ? '🟢 Release to add down below as Extra Crew!'
                                              : (draggedStaff
                                                ? `➕ Drop here to add ${draggedStaff.staffName} down below as Extra Crew for Train ${group.firstTrain}`
                                                : '➕ Drag & drop employee here (adds down below as extra crew)')}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '0px', textAlign: 'center' }}>
                                        {group.duties.map((d, dIdx) => {
                                          return (
                                            <div key={`${d.staffId || 'nd'}-${dIdx}`} style={{ 
                                              padding: '10px 8px', 
                                              borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                              minHeight: '46px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              <span style={{ 
                                                fontWeight: 700, 
                                                borderRadius: '6px', 
                                                padding: '4px 10px', 
                                                fontSize: '0.85rem',
                                                background: d.isOverridden ? 'rgba(245, 158, 11, 0.15)' : (d.isRest || d.isRestLink) ? 'rgba(107, 114, 128, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: d.isOverridden ? '#f59e0b' : (d.isRest || d.isRestLink) ? '#9ca3af' : '#10b981'
                                              }}>
                                                {getLinkDisplayLabel(d.categoryId, d.link_number)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </td>
                                      <td style={{ textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, fontSize: '1.05rem', color: group.isRestLink ? '#9ca3af' : 'var(--primary)' }}>
                                        {group.firstTrain}
                                      </td>
                                      <td style={{ padding: '0px', textAlign: 'center' }}>
                                        {group.duties.map((d, dIdx) => (
                                          <div key={`${d.staffId || 'nd'}-${dIdx}`} style={{ 
                                            padding: '10px 8px', 
                                            borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                            minHeight: '46px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}>
                                            {d.firstCoaches}
                                          </div>
                                        ))}
                                      </td>
                                      <td style={{ padding: '0px', textAlign: 'center' }}>
                                        {group.duties.map((d, dIdx) => (
                                          <div key={`${d.staffId || 'nd'}-${dIdx}`} style={{ 
                                            padding: '10px 8px', 
                                            borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                            minHeight: '46px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            color: group.isRestLink ? '#9ca3af' : 'inherit'
                                          }}>
                                            {d.lastTrain}
                                          </div>
                                        ))}
                                      </td>
                                      <td style={{ padding: '0px', textAlign: 'center' }}>
                                        {group.duties.map((d, dIdx) => (
                                          <div key={`${d.staffId || 'nd'}-${dIdx}`} style={{ 
                                            padding: '10px 8px', 
                                            borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                            minHeight: '46px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}>
                                            {d.lastCoaches}
                                          </div>
                                        ))}
                                      </td>
                                      {isAdmin && (
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          {group.duties.map((d, dIdx) => {
                                            const isSlotVacant = d.isVacantUpgrade || d.isVacantShifted || d.isVacantAdvance || d.isVacantAvailableReturn || d.isVacant || (d.name && (d.name.includes('VACANT') || d.name.includes('SHIFTED') || d.name.includes('UPGRADED')));

                                            return (
                                              <div key={d.staffId || dIdx} style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                {isSlotVacant ? (
                                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <button
                                                      type="button"
                                                      className="btn btn-primary"
                                                      onClick={() => openDutyEditModal({
                                                        ...d,
                                                        isVacant: true,
                                                        initialMode: 'REPLACE_STAFF'
                                                      }, selectedDate)}
                                                      style={{
                                                        padding: '4px 9px',
                                                        fontSize: '0.74rem',
                                                        fontWeight: 700,
                                                        borderRadius: '6px',
                                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                      }}
                                                      title="Assign relief or replacement staff to fill this vacant link slot"
                                                    >
                                                      🔀 Assign Staff
                                                    </button>
                                                    {(d.isVacantShifted || (d.name && d.name.includes('SHIFTED'))) && (
                                                      <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => handleUndoDailyShift(d)}
                                                        style={{
                                                          padding: '4px 8px',
                                                          fontSize: '0.74rem',
                                                          fontWeight: 700,
                                                          borderRadius: '6px',
                                                          background: 'rgba(245, 158, 11, 0.15)',
                                                          color: '#f59e0b',
                                                          border: '1px solid #f59e0b',
                                                          cursor: 'pointer',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                        title={`Undo shift and restore ${d.originalStaffName || 'staff'} to Link #${d.link_number}`}
                                                      >
                                                        ↩️ Undo Shift
                                                      </button>
                                                    )}
                                                    {d.isVacantAdvance && (
                                                      <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => handleUndoAdvanceDaily(d)}
                                                        style={{
                                                          padding: '4px 8px',
                                                          fontSize: '0.74rem',
                                                          fontWeight: 700,
                                                          borderRadius: '6px',
                                                          background: 'rgba(239, 68, 68, 0.15)',
                                                          color: '#ef4444',
                                                          border: '1px solid #ef4444',
                                                          cursor: 'pointer',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                        title={`Undo advance utilisation and restore ${d.originalStaffName || 'staff'} to Link #${d.link_number}`}
                                                      >
                                                        ↩️ Undo Advance
                                                      </button>
                                                    )}
                                                    {d.isVacantUpgrade && (
                                                      <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => handleUndoUpgradeDaily(d)}
                                                        style={{
                                                          padding: '4px 8px',
                                                          fontSize: '0.74rem',
                                                          fontWeight: 700,
                                                          borderRadius: '6px',
                                                          background: 'rgba(234, 179, 8, 0.15)',
                                                          color: '#eab308',
                                                          border: '1px solid #eab308',
                                                          cursor: 'pointer',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                        title={`Revert upgrade and restore ${d.originalStaffName || 'staff'} to this link`}
                                                      >
                                                        ↩️ Revert Upgrade
                                                      </button>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <button
                                                      type="button"
                                                      className="btn btn-secondary"
                                                      onClick={() => openDutyEditModal(d, selectedDate)}
                                                      style={{
                                                        padding: '4px 7px',
                                                        fontSize: '0.74rem',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        background: 'rgba(212, 161, 92, 0.12)',
                                                        color: 'var(--primary)',
                                                        border: '1px solid var(--border-gold)',
                                                        cursor: 'pointer'
                                                      }}
                                                      title="Edit Slot Duty"
                                                    >
                                                      ✏️ Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn btn-secondary"
                                                      onClick={() => openDutyEditModal({
                                                        ...d,
                                                        initialMode: 'REPLACE_STAFF'
                                                      }, selectedDate)}
                                                      style={{
                                                        padding: '4px 6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        color: '#10b981',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        cursor: 'pointer'
                                                      }}
                                                      title="Replace with another employee"
                                                    >
                                                      🔀
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn btn-secondary"
                                                      onClick={() => openDutyEditModal({
                                                        ...d,
                                                        initialMode: 'EXCHANGE_STAFF'
                                                      }, selectedDate)}
                                                      style={{
                                                        padding: '4px 6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        background: 'rgba(6, 182, 212, 0.15)',
                                                        color: '#06b6d4',
                                                        border: '1px solid rgba(6, 182, 212, 0.4)',
                                                        cursor: 'pointer'
                                                      }}
                                                      title="Exchange duties with another employee"
                                                    >
                                                      🔁
                                                    </button>
                                                    {(d.isOverridden || d.status === 'CHANGED_LINK' || d.isLeave || d.isSick || d.isCr || d.originalStaffName) && (
                                                      <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => handleUndoDailyDuty(d)}
                                                        style={{
                                                          padding: '4px 6px',
                                                          fontSize: '0.72rem',
                                                          fontWeight: 600,
                                                          borderRadius: '6px',
                                                          background: 'rgba(239, 68, 68, 0.12)',
                                                          color: '#f87171',
                                                          border: '1px solid rgba(239, 68, 68, 0.35)',
                                                          cursor: 'pointer'
                                                        }}
                                                        title="Undo duty modification & restore cyclic roster"
                                                      >
                                                        ↩️
                                                      </button>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                                {filteredNonDailySlotRows.length === 0 && (
                                  <tr>
                                    <td colSpan={isAdmin ? "8" : "7"} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '16px' }}>
                                      No non-daily links matching current filter.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ================================================================
                        NON-DAILY SECTION:
                        1. Non-Daily Cyclic Staff Pool (Links #60, #61, #62)
                        2. Interactive Tabbed Non-Daily Services Table (With Drag & Drop)
                        ================================================================ */}
                    {(() => {
                      const dateParts = String(selectedDate || getLocalDateString()).split('-');
                      const dObj = dateParts.length === 3
                        ? new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10), 12, 0, 0)
                        : new Date();
                      const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                      const currentSelectedDay = weekdayNames[isNaN(dObj.getDay()) ? 0 : dObj.getDay()] || 'SUNDAY';
                      const shortDay = currentSelectedDay.slice(0, 3);
                      const dayNonDailyTrains = nonDailyList.filter(t => {
                        if (!t.day_of_week) return false;
                        const tDay = t.day_of_week.toUpperCase().trim();
                        return tDay === currentSelectedDay || tDay === shortDay || tDay.includes(currentSelectedDay) || tDay.includes(shortDay);
                      });
                      const displayTrains = nonDailySubTab === 'today' ? dayNonDailyTrains : nonDailyList;

                      // Exact staff for Category 2 (TTI Sleeper) from cyclic roster
                      const cat2 = (dailyDuties.categories || []).find(c => c.categoryId === 2);
                      const cat2Staff = cat2 ? (cat2.staff || []) : [];

                      // 3 cyclic links: 60, 61, 62
                      const cyclicPoolLinks = [60, 61, 62];
                      const poolStaffDuties = cyclicPoolLinks.map(linkNum => {
                        const duty = cat2Staff.find(s => 
                          parseInt(s.original_link_number, 10) === linkNum || 
                          (s.link_number && parseInt(s.link_number, 10) === linkNum)
                        );
                        return { linkNum, duty };
                      });

                      const searchedTrains = displayTrains.filter(item => {
                        if (!dailyNonDailySearch.trim()) return true;
                        const q = dailyNonDailySearch.toLowerCase().trim();
                        const staffOnTrain = staffDuties.find(s => 
                          s.extra_train_no && String(s.extra_train_no).trim() === String(item.train_number).trim()
                        );
                        const staffName = staffOnTrain ? staffOnTrain.name : '';
                        const trainMatch = item.train_number && item.train_number.toLowerCase().includes(q);
                        const stnMatch = (item.departure_station && item.departure_station.toLowerCase().includes(q)) || 
                                         (item.arrival_station && item.arrival_station.toLowerCase().includes(q));
                        const staffMatch = staffName.toLowerCase().includes(q);
                        const remMatch = item.remarks && item.remarks.toLowerCase().includes(q);
                        const dayMatch = item.day_of_week && item.day_of_week.toLowerCase().includes(q);
                        return trainMatch || stnMatch || staffMatch || remMatch || dayMatch;
                      });

                      return (
                        <div style={{ marginBottom: '28px' }}>
                          {/* 1. NON-DAILY CYCLIC STAFF POOL (LINKS #60 - #62) */}
                          <div className="card" style={{ 
                            marginBottom: '20px', 
                            padding: '20px', 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-glass)', 
                            borderRadius: '12px' 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🚆 Non-Daily Cyclic Staff Pool (Links #60, #61, #62)
                                  </h3>
                                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', fontWeight: 700, fontSize: '0.78rem', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                                    3 Cyclic Staff (Roster Grid)
                                  </span>
                                </div>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '5px 0 0 0' }}>
                                  These 3 employees rotate through Non-Daily Duty Links (#60, #61, #62) on <strong>{currentSelectedDay} ({selectedDate})</strong>. Drag any employee below to assign them to a scheduled service.
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '0.78rem', fontWeight: 600 }}>
                                  💡 Drag & Drop onto any train below
                                </span>
                              </div>
                            </div>

                            {/* 4 CARDS FOR THE 4 LINKS */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
                              gap: '14px',
                              marginTop: '8px'
                            }}>
                              {poolStaffDuties.map(({ linkNum, duty }) => {
                                if (!duty) {
                                  return (
                                    <div key={linkNum} style={{
                                      padding: '14px',
                                      background: 'rgba(0,0,0,0.18)',
                                      borderRadius: '10px',
                                      border: '1px dashed var(--border-glass)'
                                    }}>
                                      <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>Link #{linkNum}</div>
                                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>No staff data found in cycle.</div>
                                    </div>
                                  );
                                }

                                const isVacant = duty.name && (duty.name.includes('VACANT') || duty.name.trim() === 'V' || duty.name.trim() === '(V)');
                                const isAssignedExtra = Boolean(duty.extra_train_no);
                                const isLeave = duty.status === 'LEAVE' || duty.isLeave;
                                const isSick = duty.status === 'SICK';
                                const isCr = duty.status === 'CR';
                                const isRestCycle = duty.status === 'REST' || duty.isRest || duty.link_number === null;
                                const canDrag = isAdmin && !isVacant && typeof duty.staffId === 'number';

                                return (
                                  <div 
                                    key={linkNum}
                                    style={{
                                      padding: '14px',
                                      background: isAssignedExtra ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                      borderRadius: '10px',
                                      border: isAssignedExtra ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-glass)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '10px',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <div>
                                      {/* Header with Link Badge & Status */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span className="badge" style={{ 
                                          background: 'rgba(212, 161, 92, 0.2)', 
                                          color: 'var(--primary)', 
                                          border: '1px solid var(--border-gold)',
                                          fontWeight: 800,
                                          fontSize: '0.8rem'
                                        }}>
                                          Link #{linkNum}
                                        </span>
                                        {duty.rowPosition && (
                                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                            Row #{duty.rowPosition}
                                          </span>
                                        )}
                                      </div>

                                      {/* Staff Name / Draggable Pill */}
                                      {isVacant ? (
                                        <div style={{
                                          padding: '8px 10px',
                                          borderRadius: '8px',
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          border: '1px dashed rgba(239, 68, 68, 0.3)',
                                          color: '#ef4444',
                                          fontWeight: 700,
                                          fontSize: '0.9rem'
                                        }}>
                                          ⚠️ {duty.name}
                                        </div>
                                      ) : (
                                        <div
                                          draggable={canDrag}
                                          onDragStart={(e) => {
                                            if (!canDrag) return;
                                            const payload = {
                                              staffId: duty.staffId,
                                              staffName: duty.name,
                                              sourceLink: linkNum,
                                              sourceCategoryId: 2,
                                              sourceTrain: duty.extra_train_no || 'CYCLIC_POOL'
                                            };
                                            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                                            e.dataTransfer.effectAllowed = 'move';
                                            setDraggedStaff(payload);
                                          }}
                                          onDragEnd={() => setDraggedStaff(null)}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.14)',
                                            cursor: canDrag ? 'grab' : 'default',
                                            userSelect: 'none',
                                            opacity: (draggedStaff && draggedStaff.staffId === duty.staffId) ? 0.4 : 1,
                                            transition: 'all 0.15s ease'
                                          }}
                                          title={canDrag ? `Drag ${duty.name} to assign to any non-daily train below` : ''}
                                        >
                                          {canDrag && (
                                            <span style={{ fontSize: '1.15rem', color: 'var(--primary)', lineHeight: 1 }} className="no-print">
                                              ⠿
                                            </span>
                                          )}
                                          <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {duty.name}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                              {duty.designation || 'TTI'}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Assignment Status Tag */}
                                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {isAssignedExtra ? (
                                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', fontWeight: 700, fontSize: '0.75rem', padding: '3px 8px' }}>
                                            🚆 Assigned to Train {duty.extra_train_no}
                                          </span>
                                        ) : isLeave ? (
                                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid #f59e0b', fontSize: '0.75rem', padding: '3px 8px' }}>
                                            🏖️ LEAVE
                                          </span>
                                        ) : isSick ? (
                                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', fontSize: '0.75rem', padding: '3px 8px' }}>
                                            🤒 SICK
                                          </span>
                                        ) : isCr ? (
                                          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: '1px solid #8b5cf6', fontSize: '0.75rem', padding: '3px 8px' }}>
                                            💤 CR
                                          </span>
                                        ) : isRestCycle ? (
                                          <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', border: '1px solid #6b7280', fontSize: '0.75rem', padding: '3px 8px' }}>
                                            💤 Weekly Rest (Cyclic)
                                          </span>
                                        ) : (
                                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', padding: '3px 8px' }}>
                                            🟢 Available for Non-Daily Duty
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Bar: Unassign or Drag Hint */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '6px' }}>
                                      {isAssignedExtra ? (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          onClick={() => handleUnassignStaffFromNonDailyTrain(duty.staffId, null)}
                                          style={{
                                            padding: '4px 10px',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            borderRadius: '6px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                            cursor: 'pointer'
                                          }}
                                          title="Unassign from non-daily train and restore cyclic pool status"
                                        >
                                          ↩️ Unassign
                                        </button>
                                      ) : canDrag ? (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                          👇 Drag to train below
                                        </span>
                                      ) : null}

                                      {isAdmin && !isVacant && (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          onClick={() => openDutyEditModal(duty, selectedDate)}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid var(--border-glass)',
                                            cursor: 'pointer',
                                            marginLeft: 'auto'
                                          }}
                                          title="Edit duty status"
                                        >
                                          ✏️ Edit
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 2. SUB-TABBED NON-DAILY SERVICES TABLE WITH INTERACTIVE DRAG & DROP */}
                          <div className="card" style={{ 
                            padding: '20px', 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-glass)', 
                            borderRadius: '12px' 
                          }}>
                            {/* Header with Sub-tabs and Search */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  {/* Sub-tab 1: Today's trains */}
                                  <button
                                    type="button"
                                    onClick={() => setNonDailySubTab('today')}
                                    style={{
                                      padding: '7px 14px',
                                      fontSize: '0.84rem',
                                      fontWeight: nonDailySubTab === 'today' ? 800 : 600,
                                      borderRadius: '8px',
                                      background: nonDailySubTab === 'today' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                      color: nonDailySubTab === 'today' ? '#000' : 'var(--color-text-primary)',
                                      border: nonDailySubTab === 'today' ? 'none' : '1px solid var(--border-glass)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    🗓️ Trains Running on {currentSelectedDay} ({dayNonDailyTrains.length})
                                  </button>

                                  {/* Sub-tab 2: All non-daily trains */}
                                  <button
                                    type="button"
                                    onClick={() => setNonDailySubTab('all')}
                                    style={{
                                      padding: '7px 14px',
                                      fontSize: '0.84rem',
                                      fontWeight: nonDailySubTab === 'all' ? 800 : 600,
                                      borderRadius: '8px',
                                      background: nonDailySubTab === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                      color: nonDailySubTab === 'all' ? '#000' : 'var(--color-text-primary)',
                                      border: nonDailySubTab === 'all' ? 'none' : '1px solid var(--border-glass)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    📋 All Non-Daily Services ({nonDailyList.length})
                                  </button>
                                </div>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                                  {nonDailySubTab === 'today'
                                    ? `Services operating on ${currentSelectedDay} (${selectedDate}). Drag staff directly onto a row to assign.`
                                    : 'Complete weekly non-daily directory across all weekdays. You can assign staff to any service.'}
                                </p>
                              </div>

                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Search Filter */}
                                <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                                  <input 
                                    type="text"
                                    className="form-input"
                                    placeholder="🔍 Search train, route, or crew..."
                                    value={dailyNonDailySearch}
                                    onChange={(e) => setDailyNonDailySearch(e.target.value)}
                                    style={{
                                      paddingRight: dailyNonDailySearch ? '34px' : '12px',
                                      paddingTop: '6px',
                                      paddingBottom: '6px',
                                      background: 'rgba(255,255,255,0.03)',
                                      borderRadius: '8px',
                                      fontSize: '0.82rem',
                                      border: '1px solid var(--border-glass)'
                                    }}
                                  />
                                  {dailyNonDailySearch && (
                                    <button
                                      type="button"
                                      onClick={() => setDailyNonDailySearch('')}
                                      style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--color-text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                      }}
                                      title="Clear search"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                                    onClick={() => {
                                      setEditingNonDailyTrain(null);
                                      setNonDailyInitialDay(currentSelectedDay);
                                      setNonDailyModalOpen(true);
                                    }}
                                  >
                                    ➕ Add Non-Daily Service
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* TABLE */}
                            <div className="data-table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxWidth: '100%' }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: '50px' }}>S.No</th>
                                    <th style={{ width: '110px' }}>Train No</th>
                                    {nonDailySubTab === 'all' && <th style={{ width: '110px' }}>Day</th>}
                                    <th>Section / Route</th>
                                    <th style={{ width: '100px' }}>Departure</th>
                                    <th style={{ width: '100px' }}>Arrival</th>
                                    <th style={{ width: '90px' }}>Coaches</th>
                                    <th style={{ minWidth: '320px' }}>Assigned Crew (Drag & Drop Zone)</th>
                                    <th>Remarks</th>
                                    {isAdmin && <th style={{ width: '100px' }}>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchedTrains.map((item, idx) => {
                                    // Live assigned staff check on selectedDate
                                    const staffOnTrain = staffDuties.find(s => 
                                      s.extra_train_no && String(s.extra_train_no).trim() === String(item.train_number).trim()
                                    );
                                    const assignedStaff = staffOnTrain || null;
                                    const assignedStaffName = staffOnTrain ? staffOnTrain.name : null;
                                    const assignedStaffDesg = staffOnTrain ? (staffOnTrain.designation || 'TTI') : '';
                                    const assignedStaffId = staffOnTrain ? staffOnTrain.staffId : null;

                                    const isRowOver = dragOverNonDailyId === item.id;

                                    return (
                                      <tr 
                                        key={item.id}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.dataTransfer.dropEffect = 'move';
                                          if (dragOverNonDailyId !== item.id) setDragOverNonDailyId(item.id);
                                        }}
                                        onDragLeave={(e) => {
                                          if (e.currentTarget.contains(e.relatedTarget)) return;
                                          if (dragOverNonDailyId === item.id) setDragOverNonDailyId(null);
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setDragOverNonDailyId(null);
                                          let dragData = null;
                                          try {
                                            const raw = e.dataTransfer.getData('text/plain');
                                            if (raw) dragData = JSON.parse(raw);
                                          } catch (err) {}
                                          if (!dragData && draggedStaff) dragData = draggedStaff;
                                          if (!dragData) return;
                                          handleAssignStaffToNonDailyTrain(dragData, item);
                                        }}
                                        style={{
                                          backgroundColor: isRowOver ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                          outline: isRowOver ? '2px dashed #10b981' : (draggedStaff ? '1px dashed rgba(16, 185, 129, 0.35)' : 'none'),
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <td><strong>#{idx + 1}</strong></td>
                                        <td>
                                          <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                                            {item.train_number}
                                          </strong>
                                        </td>
                                        {nonDailySubTab === 'all' && (
                                          <td>
                                            <span className="badge" style={{ 
                                              background: item.day_of_week === currentSelectedDay ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.06)',
                                              color: item.day_of_week === currentSelectedDay ? '#34d399' : 'var(--color-text-secondary)',
                                              border: item.day_of_week === currentSelectedDay ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-glass)',
                                              fontWeight: 700
                                            }}>
                                              {item.day_of_week}
                                            </span>
                                          </td>
                                        )}
                                        <td>
                                          <strong>{item.departure_station || '-'} ➔ {item.arrival_station || '-'}</strong>
                                        </td>
                                        <td>
                                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', fontWeight: 600 }}>
                                            {item.departure_time || '-'}
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: 600 }}>
                                            {item.arrival_time || '-'}
                                          </span>
                                        </td>
                                        <td>{item.coaches || 'SL / AC'}</td>

                                        {/* ASSIGNED CREW / INTERACTIVE DRAG & DROP ZONE */}
                                        <td style={{ padding: '8px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {assignedStaffName ? (
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                <span className="badge badge-approved" style={{ fontSize: '0.84rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                  👤 <strong>{assignedStaffName}</strong> ({assignedStaffDesg})
                                                </span>
                                                {isAdmin && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => handleUnassignStaffFromNonDailyTrain(assignedStaffId, item.id)}
                                                    style={{
                                                      padding: '3px 8px',
                                                      fontSize: '0.72rem',
                                                      fontWeight: 700,
                                                      borderRadius: '6px',
                                                      background: 'rgba(239, 68, 68, 0.15)',
                                                      color: '#ef4444',
                                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                                      cursor: 'pointer'
                                                    }}
                                                    title="Remove employee from this service"
                                                  >
                                                    ↩️ Unassign
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                <span className="badge" style={{ 
                                                  fontSize: '0.78rem', 
                                                  padding: '4px 8px', 
                                                  background: 'rgba(239, 68, 68, 0.1)', 
                                                  color: '#f87171', 
                                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                                  fontWeight: 600
                                                }}>
                                                  ⚠️ Vacant / Unassigned
                                                </span>
                                                {isAdmin && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={() => {
                                                      setQuickAssignNonDailyTrain(item);
                                                      setQuickAssignSearch('');
                                                      setQuickAssignShowBusy(false);
                                                    }}
                                                    style={{
                                                      padding: '4px 10px',
                                                      fontSize: '0.74rem',
                                                      fontWeight: 700,
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                    title={`Assign staff to Train ${item.train_number}`}
                                                  >
                                                    ➕ Assign Staff
                                                  </button>
                                                )}
                                              </div>
                                            )}

                                            {/* Drop Target Box */}
                                            {isAdmin && (
                                              <div 
                                                className="no-print"
                                                style={{
                                                  padding: assignedStaffName ? '3px 8px' : '6px 12px',
                                                  border: isRowOver ? '2px dashed #10b981' : (draggedStaff ? '1.5px dashed rgba(59, 130, 246, 0.6)' : (assignedStaffName ? '1px dashed rgba(255,255,255,0.1)' : '1.5px dashed rgba(212, 161, 92, 0.4)')),
                                                  borderRadius: '6px',
                                                  textAlign: 'center',
                                                  fontSize: '0.74rem',
                                                  fontWeight: 600,
                                                  color: isRowOver ? '#10b981' : (draggedStaff ? '#60a5fa' : (assignedStaffName ? 'var(--color-text-muted)' : 'var(--primary)')),
                                                  background: isRowOver ? 'rgba(16, 185, 129, 0.2)' : (draggedStaff ? 'rgba(59, 130, 246, 0.08)' : (assignedStaffName ? 'transparent' : 'rgba(212, 161, 92, 0.06)')),
                                                  cursor: draggedStaff ? 'copy' : 'default',
                                                  transition: 'all 0.15s ease'
                                                }}
                                              >
                                                {isRowOver
                                                  ? `🟢 Release to assign ${draggedStaff?.staffName || 'employee'} to Train ${item.train_number}!`
                                                  : (draggedStaff
                                                    ? `📥 Drop here to assign ${draggedStaff.staffName}`
                                                    : (assignedStaffName ? '⇄ Drag new employee here to reassign' : `📥 Drop employee here to assign Train ${item.train_number}`))}
                                              </div>
                                            )}
                                          </div>
                                        </td>

                                        <td>
                                          {item.remarks ? (
                                            <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                                              {item.remarks}
                                            </span>
                                          ) : (
                                            <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                                          )}
                                        </td>

                                        {isAdmin && (
                                          <td>
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              style={{
                                                padding: '4px 10px',
                                                fontSize: '0.76rem',
                                                borderRadius: '6px',
                                                background: 'rgba(212, 161, 92, 0.12)',
                                                color: 'var(--primary)',
                                                border: '1px solid var(--border-gold)',
                                                cursor: 'pointer'
                                              }}
                                              onClick={() => {
                                                setEditingNonDailyTrain(item);
                                                setNonDailyInitialDay(item.day_of_week);
                                                setNonDailyModalOpen(true);
                                              }}
                                            >
                                              ✏️ Assign
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}

                                  {searchedTrains.length === 0 && (
                                    <tr>
                                      <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '20px' }}>
                                        No non-daily trains found matching filter {dailyNonDailySearch ? `"${dailyNonDailySearch}"` : `for ${nonDailySubTab === 'today' ? currentSelectedDay : 'all services'}`}.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. Official Staff Strength & Deployment Tally Summary */}
                    {(() => {
                      const isVacant = (name) => {
                        if (!name) return true;
                        const n = String(name).trim().toUpperCase();
                        return n.includes('VACANT') || n === 'V' || n === '(V)';
                      };

                      // Compute live tally across all categories (counting only named staff)
                      let grandBooked = 0;
                      let grandOutstation = 0;
                      let grandLeave = 0;
                      let grandSick = 0;
                      let grandHq = 0;
                      let grandTotal = 0;

                      const categoryTallies = (dailyDuties.categories || []).map(cat => {
                        let booked = 0;
                        let outstation = 0;
                        let leave = 0;
                        let sick = 0;
                        let hq = 0;
                        let namedCount = 0;

                        (cat.staff || []).forEach(s => {
                          // Exclude vacant posts from headcount tally
                          if (isVacant(s.name)) {
                            return;
                          }

                          namedCount++;

                          const isApprovedLeave = leaveRequests.some(l => 
                            String(l.staff_id) === String(s.staffId) && 
                            l.date === selectedDate && 
                            l.status === 'APPROVED' &&
                            l.type === 'LEAVE'
                          );
                          const isSick = s.status === 'SICK' || s.isSick;
                          const isLeave = s.status === 'LEAVE' || s.isLeave || isApprovedLeave;

                          if (isSick) {
                            sick++;
                          } else if (isLeave) {
                            leave++;
                          } else if (s.isRest || s.link_number === null || s.status === 'REST') {
                            hq++; // Weekly Rest / Standby at Headquarters
                          } else if (s.from_station && s.from_station !== 'GNT' && s.from_station !== '---') {
                            outstation++; // Working outstation train or halt
                          } else {
                            booked++; // Booked to duty / working train from HQ
                          }
                        });

                        const total = namedCount;
                        const sum = booked + outstation + leave + sick + hq;

                        grandBooked += booked;
                        grandOutstation += outstation;
                        grandLeave += leave;
                        grandSick += sick;
                        grandHq += hq;
                        grandTotal += total;

                        return {
                          categoryId: cat.categoryId,
                          categoryName: cat.categoryName,
                          categoryCode: cat.categoryCode,
                          booked,
                          outstation,
                          leave,
                          sick,
                          hq,
                          total,
                          sum,
                          isTallied: sum === total
                        };
                      });

                      const grandSum = grandBooked + grandOutstation + grandLeave + grandSick + grandHq;
                      const isGrandTallied = grandSum === grandTotal;

                      return (
                        <div className="card" style={{
                          marginTop: '24px',
                          padding: '24px',
                          background: 'var(--bg-secondary)',
                          border: '1.5px solid var(--border-gold)',
                          borderRadius: '16px',
                          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
                        }}>
                          {/* Section Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>📊</span> Daily Staff Strength &amp; Deployment Tally
                                </h3>
                                <span style={{
                                  background: isGrandTallied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  border: isGrandTallied ? '1px solid #22c55e' : '1px solid #ef4444',
                                  color: isGrandTallied ? '#22c55e' : '#ef4444',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700
                                }}>
                                  {isGrandTallied ? `✅ 100% TALLIED (${grandSum} / ${grandTotal} Named Staff)` : `⚠️ MISMATCH (${grandSum} / ${grandTotal})`}
                                </span>
                              </div>
                              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                                Headcount verification for named working employees (vacant posts excluded) for <strong>{(() => {
                                  const p = String(selectedDate || getLocalDateString()).split('-');
                                  const dt = p.length === 3 ? new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0) : new Date();
                                  return !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : selectedDate;
                                })()}</strong>.
                              </p>
                            </div>

                            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                              Formula: <strong>Booked ({grandBooked}) + Outstation ({grandOutstation}) + Leave ({grandLeave}) + Sick ({grandSick}) + HQ ({grandHq}) = {grandSum}</strong>
                            </div>
                          </div>

                          {/* 5 Key Metric Cards (User Requested Items) */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '14px',
                            marginBottom: '22px'
                          }}>
                            {/* 1. Booked to Duty */}
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%)',
                              border: '1px solid rgba(59, 130, 246, 0.35)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#93c5fd' }}>
                                  Booked to Duty
                                </span>
                                <span style={{ fontSize: '1.2rem' }}>🚆</span>
                              </div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60a5fa' }}>
                                {grandBooked}
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                Working trains departing HQ
                              </span>
                            </div>

                            {/* 2. In Out Station */}
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.04) 100%)',
                              border: '1px solid rgba(168, 85, 247, 0.35)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d8b4fe' }}>
                                  In Out Station
                                </span>
                                <span style={{ fontSize: '1.2rem' }}>🏢</span>
                              </div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc' }}>
                                {grandOutstation}
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                Outstation rest, halt &amp; return
                              </span>
                            </div>

                            {/* 3. In Leave */}
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fcd34d' }}>
                                  In Leave
                                </span>
                                <span style={{ fontSize: '1.2rem' }}>🏖️</span>
                              </div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
                                {grandLeave}
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                Approved leave / absent
                              </span>
                            </div>

                            {/* 4. In Sick */}
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fca5a5' }}>
                                  In Sick
                                </span>
                                <span style={{ fontSize: '1.2rem' }}>🤒</span>
                              </div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>
                                {grandSick}
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                Medical / Sick certificate
                              </span>
                            </div>

                            {/* 5. In Headquarters (Spare also) */}
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#86efac' }}>
                                  In Headquarters (Spare also)
                                </span>
                                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                              </div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>
                                {grandHq}
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                Weekly Rest &amp; Available Spare
                              </span>
                            </div>
                          </div>

                          {/* Category-Wise Official Tally Breakdown Table */}
                          <div className="table-responsive" style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
                            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  <th style={{ textAlign: 'left', padding: '12px 16px', width: '25%' }}>Staff Category</th>
                                  <th style={{ padding: '12px 8px', color: '#60a5fa' }}>Booked to Duty</th>
                                  <th style={{ padding: '12px 8px', color: '#c084fc' }}>In Out Station</th>
                                  <th style={{ padding: '12px 8px', color: '#fbbf24' }}>In Leave</th>
                                  <th style={{ padding: '12px 8px', color: '#f87171' }}>In Sick</th>
                                  <th style={{ padding: '12px 8px', color: '#34d399' }}>In Headquarters (Spare/Rest)</th>
                                  <th style={{ padding: '12px 8px', color: 'var(--primary)', fontWeight: 700 }}>Total Staff</th>
                                  <th style={{ padding: '12px 8px', width: '120px' }}>Tally Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoryTallies.map((cat, cIdx) => (
                                  <tr key={cat.categoryId || cIdx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                                    <td style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>
                                      {cat.categoryName} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>({cat.categoryCode})</span>
                                    </td>
                                    <td style={{ fontWeight: 600, color: '#93c5fd' }}>{cat.booked}</td>
                                    <td style={{ fontWeight: 600, color: '#d8b4fe' }}>{cat.outstation}</td>
                                    <td style={{ fontWeight: 600, color: '#fcd34d' }}>{cat.leave}</td>
                                    <td style={{ fontWeight: 600, color: '#fca5a5' }}>{cat.sick}</td>
                                    <td style={{ fontWeight: 600, color: '#86efac' }}>{cat.hq}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--color-text)' }}>{cat.total}</td>
                                    <td>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: cat.isTallied ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                        color: cat.isTallied ? '#22c55e' : '#ef4444',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700
                                      }}>
                                        {cat.isTallied ? '✓ Tallied' : '✕ Mismatch'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{
                                  background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.18) 0%, rgba(212, 161, 92, 0.08) 100%)',
                                  borderTop: '2px solid var(--border-gold)',
                                  fontWeight: 800,
                                  fontSize: '0.94rem'
                                }}>
                                  <td style={{ textAlign: 'left', padding: '14px 16px', color: 'var(--primary)' }}>
                                    GRAND TOTAL (ALL CATEGORIES)
                                  </td>
                                  <td style={{ color: '#60a5fa' }}>{grandBooked}</td>
                                  <td style={{ color: '#c084fc' }}>{grandOutstation}</td>
                                  <td style={{ color: '#fbbf24' }}>{grandLeave}</td>
                                  <td style={{ color: '#f87171' }}>{grandSick}</td>
                                  <td style={{ color: '#34d399' }}>{grandHq}</td>
                                  <td style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>{grandTotal}</td>
                                  <td>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: isGrandTallied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                      color: isGrandTallied ? '#22c55e' : '#ef4444',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.8rem',
                                      fontWeight: 800
                                    }}>
                                      {isGrandTallied ? '✅ TALLIED' : '⚠️ MISMATCH'}
                                    </span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })() : (
                <div className="spinner-container">
                  <div className="spinner"></div> Loading Daily Duties...
                </div>
              )}
            </div>
          )}

        {/* ----------------------------------------------------
            TAB 2: ROSTER GRID
            ---------------------------------------------------- */}
        {activeTab === 'roster' && (
          <div>
            {loadingRoster ? (
              <div className="spinner-container">
                <div className="spinner"></div> Loading Roster...
              </div>
            ) : rosterData ? (
              <div>
                <div className="alert-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span>📅</span> 
                    Anchor date: <strong>{rosterData.category.anchor_date}</strong> | 
                    Cycle Length: <strong>{rosterData.category.cycle_length} links</strong>.
                    {isAdmin ? ' Click any cell to manually override it.' : ' 🔒 View-Only Mode: Logged in as Staff/Viewer (Editing is restricted to Master Admin).'}
                  </div>
                  {rosterSearchQuery.trim() && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.2)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                        🔍 Filtered by: "{rosterSearchQuery.trim()}"
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setRosterSearchQuery('')}
                        style={{ padding: '3px 10px', fontSize: '0.78rem', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ✕ Clear Filter
                      </button>
                    </div>
                  )}
                </div>

                <div className="roster-grid-container">
                  <table className="roster-table">
                    <thead>
                      <tr className="header-days">
                        <th className="freeze-col freeze-col-slno" style={{ top: 0 }}>SL NO</th>
                        <th className="freeze-col freeze-col-name" style={{ top: 0 }}>NAME</th>
                        <th className="freeze-col freeze-col-desg" style={{ top: 0 }}>DESG</th>
                        <th className="freeze-col freeze-col-cr" style={{ top: 0, textAlign: 'center' }}>CR Available</th>
                        {rosterData.dates.map((d, i) => (
                          <th key={i}>{d.dayOfWeek}</th>
                        ))}
                      </tr>
                      <tr className="header-dates">
                        <th className="freeze-col freeze-col-slno"></th>
                        <th className="freeze-col freeze-col-name"></th>
                        <th className="freeze-col freeze-col-desg"></th>
                        <th className="freeze-col freeze-col-cr"></th>
                        {rosterData.dates.map((d, i) => (
                          <th key={i}>{d.dayOfMonth}</th>
                        ))}
                      </tr>
                      <tr className="header-offsets">
                        <th className="freeze-col freeze-col-slno" style={{ fontSize: '0.74rem' }}>Day Offset</th>
                        <th className="freeze-col freeze-col-name"></th>
                        <th className="freeze-col freeze-col-desg"></th>
                        <th className="freeze-col freeze-col-cr"></th>
                        {rosterData.dates.map((d, i) => (
                          <th key={i}>{d.dayOffset}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sortedRows = [...rosterData.rows].sort((a, b) => {
                          const linkA = a.cells[0]?.calculatedLinkNumber || 0;
                          const linkB = b.cells[0]?.calculatedLinkNumber || 0;
                          return linkA - linkB;
                        }).map((row, index) => ({
                          ...row,
                          slNo: index + 1
                        }));

                        const query = rosterSearchQuery.trim().toLowerCase();
                        const filteredRows = sortedRows.filter(row => {
                          if (!query) return true;

                          // 1. Staff Name match
                          if (row.staffName && row.staffName.toLowerCase().includes(query)) return true;

                          // 2. Designation match
                          if (row.designation && row.designation.toLowerCase().includes(query)) return true;

                          // 3. Weekly rest day match
                          if (row.rest_day && row.rest_day.toLowerCase().includes(query)) return true;

                          // 4. SL NO match (e.g., "1", "sl 1", "#1")
                          if (String(row.slNo) === query || `sl ${row.slNo}` === query || `#${row.slNo}` === query) return true;

                          // 5. CR available balance match
                          if (row.cr_available && row.cr_available.toLowerCase().includes(query)) return true;

                          // 6. Cell link number, label, train, or status match
                          return row.cells.some(cell => {
                            if (String(cell.calculatedLinkNumber) === query) return true;
                            if (String(cell.actualLinkNumber) === query) return true;
                            const label = getCellLabel(cell);
                            if (label && String(label).toLowerCase().includes(query)) return true;
                            if (cell.status && String(cell.status).toLowerCase().includes(query)) return true;
                            if (cell.train_numbers && String(cell.train_numbers).toLowerCase().includes(query)) return true;
                            return false;
                          });
                        });

                        if (filteredRows.length === 0) {
                          return (
                            <tr>
                              <td 
                                colSpan={4 + rosterData.dates.length}
                                style={{
                                  textAlign: 'center',
                                  padding: '40px 16px',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '0.95rem'
                                }}
                              >
                                <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔍</div>
                                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                  No staff, link, or duty matching "<strong>{rosterSearchQuery}</strong>"
                                </div>
                                <p style={{ margin: '6px 0 16px 0', fontSize: '0.84rem', opacity: 0.8 }}>
                                  Try searching by employee name, designation (e.g. CTI), link number (e.g. 1, 34), or status (e.g. REST, LEAVE).
                                </p>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => setRosterSearchQuery('')}
                                  style={{ fontSize: '0.84rem', padding: '6px 18px', borderRadius: '8px' }}
                                >
                                  ✕ Clear Search
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return filteredRows.map((row) => {
                          const isVacantRow = row.staffName === '(VACANT)';
                          const isNameMatched = query && row.staffName && row.staffName.toLowerCase().includes(query);
                          const isDesgMatched = query && row.designation && row.designation.toLowerCase().includes(query);

                          return (
                            <tr key={row.staffId}>
                              <td className="freeze-col freeze-col-slno">{row.slNo}</td>
                              <td className="freeze-col freeze-col-name">
                                <strong style={{ color: isNameMatched ? 'var(--primary)' : 'inherit' }}>
                                  {row.staffName || '(VACANT)'}
                                </strong>
                              </td>
                              <td className="freeze-col freeze-col-desg" style={{ color: isDesgMatched ? 'var(--primary)' : 'var(--color-text-secondary)', fontWeight: isDesgMatched ? 700 : 400 }}>
                                {row.designation || '-'}
                              </td>
                              <td className="freeze-col freeze-col-cr" style={{ textAlign: 'center' }}>
                                {row.cr_available ? (
                                  <span className="badge" style={{ 
                                    background: 'rgba(139, 92, 246, 0.18)', 
                                    color: '#c4b5fd', 
                                    border: '1px solid rgba(139, 92, 246, 0.4)', 
                                    fontWeight: 800, 
                                    fontSize: '0.74rem', 
                                    padding: '2px 8px',
                                    whiteSpace: 'nowrap'
                                  }} title={row.cr_available}>
                                    💤 {row.cr_available}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-secondary)', opacity: 0.35 }}>-</span>
                                )}
                              </td>
                              {row.cells.map((cell, cIdx) => {
                                const key = `${row.staffId}_${cIdx}`;
                                const label = getCellLabel(cell);
                                const isCellMatched = query && (
                                  String(cell.calculatedLinkNumber) === query ||
                                  String(cell.actualLinkNumber) === query ||
                                  (label && String(label).toLowerCase().includes(query)) ||
                                  (cell.status && String(cell.status).toLowerCase().includes(query)) ||
                                  (cell.train_numbers && String(cell.train_numbers).toLowerCase().includes(query))
                                );

                                return (
                                  <td 
                                    key={cIdx} 
                                    className={isVacantRow ? 'roster-cell' : getCellClass(cell)}
                                    style={isCellMatched ? {
                                      outline: '2px solid var(--primary)',
                                      outlineOffset: '-2px',
                                      boxShadow: '0 0 10px rgba(212, 161, 92, 0.5)',
                                      fontWeight: 800
                                    } : undefined}
                                    onClick={() => !isVacantRow && handleCellClick(cell, row.staffId, row.staffName)}
                                    onMouseEnter={(e) => {
                                      if (!isVacantRow) {
                                        setHoveredCell({
                                          key,
                                          x: e.clientX,
                                          y: e.clientY,
                                          data: cell
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredCell(null)}
                                  >
                                    {isVacantRow ? '' : label}
                                    {!isVacantRow && cell.isOverridden && <div className="cell-info-indicator" />}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>

                  </table>
                </div>

                {/* Hover Tooltip Card */}
                {hoveredCell && (
                  <div 
                    className="tooltip-card"
                    style={{
                      position: 'fixed',
                      top: `${hoveredCell.y - 120}px`,
                      left: `${hoveredCell.x}px`,
                      pointerEvents: 'none'
                    }}
                  >
                    <div className="tooltip-title">
                      Date: {hoveredCell.data.date} (Day {hoveredCell.data.dayOffset})
                    </div>
                    {hoveredCell.data.status === 'AVAILABLE_FOR_BOOKING' ? (
                      <>
                        <div className="tooltip-row" style={{ color: '#10b981' }}>
                          <strong>Status: ⚡ Available (1-Day Leave Return)</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Location:</span> <strong>🏠 GNT (Headquarters)</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Remarks:</span> <em style={{ fontSize: '0.8rem' }}>{hoveredCell.data.overrideReason || 'Present at HQ, available for booking'}</em>
                        </div>
                      </>
                    ) : hoveredCell.data.isRest ? (
                      <div className="tooltip-row" style={{ color: 'var(--color-text-secondary)' }}>
                        <strong>Status: REST Day</strong>
                      </div>
                    ) : (
                      <>
                        <div className="tooltip-row">
                          <span>Link:</span> <strong>#{hoveredCell.data.actualLinkNumber}</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Train(s):</span> <strong>{hoveredCell.data.train_numbers}</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Route:</span> <span>{hoveredCell.data.from_station} ➔ {hoveredCell.data.to_station}</span>
                        </div>
                        <div className="tooltip-row">
                          <span>Coaches:</span> <span>{hoveredCell.data.coaches}</span>
                        </div>
                      </>
                    )}
                    {hoveredCell.data.muster_code && (
                      <div className="tooltip-row" style={{ color: 'var(--primary)', marginTop: '6px', borderTop: '1px solid rgba(212,161,92,0.3)', paddingTop: '4px', fontWeight: 700 }}>
                        <span>📋 Muster:</span> <span>{hoveredCell.data.muster_code} {hoveredCell.data.muster_remarks ? `(${hoveredCell.data.muster_remarks})` : ''}</span>
                      </div>
                    )}
                    {hoveredCell.data.isOverridden && (
                      <div className="tooltip-row" style={{ color: 'var(--override-color)', marginTop: '8px', borderTop: '1px solid rgba(245,158,11,0.2)', paddingTop: '4px' }}>
                        <span>Override:</span> <span>{hoveredCell.data.overrideReason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>No roster data available.</div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: LINK MASTER CRUD
            ---------------------------------------------------- */}
        {activeTab === 'links' && (
          <div>
            {!isAdmin && (
              <div style={{
                background: 'rgba(212, 161, 92, 0.08)',
                border: '1px solid rgba(212, 161, 92, 0.25)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.88rem',
                color: 'var(--color-text-primary)'
              }}>
                <span>🔒</span>
                <span><strong>Read-Only Mode:</strong> Logged in as Staff/Viewer. Only Master Administrators can configure or modify train links and sets.</span>
              </div>
            )}

            {/* Sub-tabs navigation */}
            <div className="subtabs-nav" style={{ marginBottom: '20px', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
              <button 
                className={`btn ${linkSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setLinkSubTab('list')}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}
              >
                🔗 Link Definitions
              </button>
              <button 
                className={`btn ${linkSubTab === 'train-centric' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setLinkSubTab('train-centric')}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}
              >
                🚆 Train-Centric Roster
              </button>
            </div>

            {linkSubTab === 'list' && (
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', width: '100%' }}>
                {isAdmin && (
                  isLeftPanelCollapsed ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsLeftPanelCollapsed(false)}
                      style={{
                        padding: '12px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '42px',
                        minHeight: '260px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-glass)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        alignSelf: 'stretch'
                      }}
                      title="Expand Add/Edit Link Panel"
                    >
                      <span style={{ fontSize: '0.85rem' }}>▶️</span>
                      <span style={{ writingMode: 'vertical-rl', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)' }}>Add / Edit Link</span>
                    </button>
                  ) : (
                    <form className="card" style={{ flex: '1', maxWidth: '320px', minWidth: '280px', transition: 'all 0.3s ease' }} onSubmit={saveLink}>
                      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{editingLink ? `Edit Link #${editingLink.link_number}` : 'Add New Link'}</span>
                        <button
                          type="button"
                          onClick={() => setIsLeftPanelCollapsed(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.05)'
                          }}
                          title="Collapse Panel"
                        >
                          ◀️ Hide
                        </button>
                      </div>

                    <div className="form-group">
                      <label className="form-label">Link Number:</label>
                      <input 
                        type="number" required className="form-input"
                        value={linkForm.link_number}
                        onChange={(e) => setLinkForm({ ...linkForm, link_number: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="checkbox"
                          checked={linkForm.is_rest}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setLinkForm({ 
                              ...linkForm, 
                              is_rest: val,
                              set_type: val ? 'Other / REST' : linkForm.set_type === 'Other / REST' ? '2-Day Set' : linkForm.set_type
                            });
                          }}
                        />
                        Is REST Link (no duty)
                      </label>
                    </div>

                    {!linkForm.is_rest && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Train Number(s):</label>
                          <input 
                            type="text" required className="form-input"
                            placeholder="e.g. 17225, 17226"
                            value={linkForm.train_numbers}
                            onChange={(e) => setLinkForm({ ...linkForm, train_numbers: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">From Station:</label>
                          <input 
                            type="text" required className="form-input"
                            value={linkForm.from_station}
                            onChange={(e) => setLinkForm({ ...linkForm, from_station: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">To Station:</label>
                          <input 
                            type="text" required className="form-input"
                            value={linkForm.to_station}
                            onChange={(e) => setLinkForm({ ...linkForm, to_station: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Coach Type(s):</label>
                          <input 
                            type="text" required className="form-input"
                            placeholder="e.g. AC, S1-S6"
                            value={linkForm.coaches}
                            onChange={(e) => setLinkForm({ ...linkForm, coaches: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Set Type:</label>
                          <select 
                            className="form-input"
                            value={linkForm.set_type || '2-Day Set'}
                            onChange={(e) => setLinkForm({ ...linkForm, set_type: e.target.value })}
                          >
                            <option value="2-Day Set">2-Day Set</option>
                            <option value="3-Day Set">3-Day Set</option>
                            <option value="Other / REST">Other / REST</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label className="form-label">Effective From:</label>
                      <input 
                        type="date" required className="form-input"
                        value={linkForm.effective_from}
                        onChange={(e) => setLinkForm({ ...linkForm, effective_from: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        {editingLink ? 'Update Link' : 'Create Link'}
                      </button>
                      {editingLink && (
                        <button 
                          type="button" className="btn btn-secondary" 
                          onClick={() => {
                            setEditingLink(null);
                            setLinkForm({
                              link_number: '', train_numbers: '', from_station: '', to_station: '', coaches: '', is_rest: false, effective_from: '2026-07-01', set_type: '2-Day Set'
                            });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )
              )}

              {/* Link Definitions Table */}
              <div className="data-table-container" style={{ flex: '2', width: '100%' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Link #</th>
                      <th>Train(s)</th>
                      <th>Route</th>
                      <th>Coaches</th>
                      <th>Set Type</th>
                      <th>Status</th>
                      {isAdmin && <th>Reorder</th>}
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {linksList.map((link, idx) => (
                      <tr key={link.id}>
                        <td>
                          <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 700 }}>
                            #{link.link_number}
                          </span>
                        </td>
                        <td><strong>{link.is_rest ? '-' : link.train_numbers || '-'}</strong></td>
                        <td>{link.is_rest ? '-' : `${link.from_station || '-'} ➔ ${link.to_station || '-'}`}</td>
                        <td>{link.is_rest ? '-' : link.coaches || '-'}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)' }}>
                            {link.set_type || (link.is_rest ? 'REST' : '2-Day Set')}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${link.is_rest ? 'badge-rejected' : 'badge-approved'}`}>
                            {link.is_rest ? 'REST Day' : 'Duty'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '2px 8px', fontSize: '0.7rem', marginRight: '4px' }}
                              disabled={idx === 0}
                              onClick={() => moveLinkRow(link.id, 'up')}
                            >
                              ▲
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              disabled={idx === linksList.length - 1}
                              onClick={() => moveLinkRow(link.id, 'down')}
                            >
                              ▼
                            </button>
                          </td>
                        )}
                        {isAdmin && (
                          <td>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                              onClick={() => {
                                setEditingLink(link);
                                setLinkForm({
                                  link_number: link.link_number.toString(),
                                  train_numbers: link.train_numbers || '',
                                  from_station: link.from_station || '',
                                  to_station: link.to_station || '',
                                  coaches: link.coaches || '',
                                  is_rest: !!link.is_rest,
                                  effective_from: link.effective_from || '2026-07-01',
                                  set_type: link.set_type || '2-Day Set'
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => deleteLink(link.id)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {linksList.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? "8" : "6"} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                          No link definitions found for this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {linkSubTab === 'train-centric' && (() => {
            const trainRosterItems = [];
            linksList.forEach(link => {
              if (link.is_rest || !link.train_numbers) return;
              if (trainCategoryFilter !== 'ALL' && String(link.category_id) !== String(trainCategoryFilter)) return;
              const nums = parseTrainNumbers(link.train_numbers);
              const catObj = categories.find(c => String(c.id) === String(link.category_id));
              const categoryLabel = catObj ? catObj.name : (link.category_id === 1 ? 'Conductors (COR)' : link.category_id === 2 ? 'TTI / Sleeper' : link.category_id === 3 ? 'Ladies Staff' : 'Duty Link');
              nums.forEach(num => {
                trainRosterItems.push({
                  trainNumber: num,
                  linkNumber: link.link_number,
                  linkId: link.id,
                  coaches: link.coaches || '-',
                  categoryName: categoryLabel,
                  categoryId: link.category_id,
                  from_station: link.from_station || '',
                  to_station: link.to_station || '',
                  linkObj: link
                });
              });
            });

            trainRosterItems.sort((a, b) => {
              if (a.categoryId !== b.categoryId) return a.categoryId - b.categoryId;
              return a.linkNumber - b.linkNumber;
            });

            const filteredNonDaily = nonDailySelectedDay === 'ALL'
              ? nonDailyList
              : nonDailyList.filter(t => {
                  if (!t.day_of_week) return false;
                  const tDay = t.day_of_week.toUpperCase().trim();
                  const sDay = nonDailySelectedDay.toUpperCase().trim();
                  return tDay === sDay || tDay === sDay.slice(0, 3) || tDay.includes(sDay) || tDay.includes(sDay.slice(0, 3));
                });

            return (
              <div className="card">
                {/* 2 Main Categories in Train Roster */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                    <button
                      type="button"
                      onClick={() => setTrainRosterCategory('daily')}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background: trainRosterCategory === 'daily' ? 'var(--primary)' : 'transparent',
                        color: trainRosterCategory === 'daily' ? '#000' : 'var(--color-text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>🚆 Daily Trains</span>
                      <span className="badge" style={{
                        background: trainRosterCategory === 'daily' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                        color: trainRosterCategory === 'daily' ? '#000' : '#fff',
                        fontSize: '0.72rem',
                        padding: '2px 6px'
                      }}>
                        {trainRosterItems.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTrainRosterCategory('non-daily')}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background: trainRosterCategory === 'non-daily' ? 'var(--primary)' : 'transparent',
                        color: trainRosterCategory === 'non-daily' ? '#000' : 'var(--color-text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>🗓️ Non-Daily Trains</span>
                      <span className="badge" style={{
                        background: trainRosterCategory === 'non-daily' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                        color: trainRosterCategory === 'non-daily' ? '#000' : '#fff',
                        fontSize: '0.72rem',
                        padding: '2px 6px'
                      }}>
                        {nonDailyList.length}
                      </span>
                    </button>
                  </div>

                  {/* Add New Train Button */}
                  {isAdmin && (
                    <div>
                      {trainRosterCategory === 'daily' ? (
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            setEditingLink(null);
                            setLinkForm({
                              link_number: (linksList.length + 1).toString(),
                              train_numbers: '',
                              from_station: '',
                              to_station: '',
                              coaches: '',
                              is_rest: false,
                              effective_from: '2026-07-01'
                            });
                            setLinkSubTab('list');
                          }}
                        >
                          ➕ Add Daily Link
                        </button>
                      ) : (
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            setEditingNonDailyTrain(null);
                            setNonDailyInitialDay(nonDailySelectedDay === 'ALL' ? 'SUNDAY' : nonDailySelectedDay);
                            setNonDailyModalOpen(true);
                          }}
                        >
                          ➕ Add Non-Daily Train
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* CATEGORY 1: DAILY TRAINS */}
                {trainRosterCategory === 'daily' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>🚆 Daily Trains Master Chart</h3>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                        List of all daily running train services mapped to seniority links across all running categories.
                      </p>
                    </div>

                    {/* Category Filter Pills & Search Bar for Daily Trains */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Category:</span>
                        {[
                          { id: 'ALL', label: 'All Daily Trains' },
                          { id: '1', label: 'Conductors (COR)' },
                          { id: '2', label: 'TTI / Sleeper Staff' },
                          { id: '3', label: 'Ladies Staff / TTE' }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setTrainCategoryFilter(cat.id);
                              fetchLinks(cat.id);
                            }}
                            style={{
                              padding: '4px 14px',
                              borderRadius: '20px',
                              fontSize: '0.8rem',
                              fontWeight: trainCategoryFilter === cat.id ? 700 : 500,
                              background: trainCategoryFilter === cat.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                              color: trainCategoryFilter === cat.id ? '#000' : 'var(--color-text-secondary)',
                              border: trainCategoryFilter === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Daily Train Search Input */}
                      <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                        <input 
                          type="text"
                          className="form-input"
                          placeholder="🔍 Search train (e.g. 20629), link (#8), route..."
                          value={dailyTrainSearch}
                          onChange={(e) => setDailyTrainSearch(e.target.value)}
                          style={{
                            paddingRight: dailyTrainSearch ? '36px' : '14px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            border: '1px solid var(--border-glass)'
                          }}
                        />
                        {dailyTrainSearch && (
                          <button
                            type="button"
                            onClick={() => setDailyTrainSearch('')}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Train Number</th>
                            <th>Category</th>
                            <th>Seniority Link</th>
                            <th>Route</th>
                            <th>Coaches</th>
                            {isAdmin && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const searchedDailyTrains = trainRosterItems.filter(item => {
                              if (!dailyTrainSearch.trim()) return true;
                              const q = dailyTrainSearch.toLowerCase().trim();
                              const trainMatch = item.trainNumber && item.trainNumber.toLowerCase().includes(q);
                              const linkMatch = String(item.linkNumber).includes(q) || getLinkDisplayLabel(item.categoryId, item.linkNumber).toLowerCase().includes(q);
                              const catMatch = item.categoryName && item.categoryName.toLowerCase().includes(q);
                              const routeMatch = (item.from_station && item.from_station.toLowerCase().includes(q)) || (item.to_station && item.to_station.toLowerCase().includes(q));
                              const coachMatch = item.coaches && item.coaches.toLowerCase().includes(q);
                              return trainMatch || linkMatch || catMatch || routeMatch || coachMatch;
                            });

                            return searchedDailyTrains.map((item, idx) => (
                              <tr key={`${item.trainNumber}_${item.categoryId}_${item.linkNumber}_${idx}`}>
                                <td><strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{item.trainNumber}</strong></td>
                                <td>
                                  <span className="badge" style={{ 
                                    background: item.categoryId === 1 ? 'rgba(59, 130, 246, 0.15)' : item.categoryId === 2 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                                    color: item.categoryId === 1 ? '#60a5fa' : item.categoryId === 2 ? '#34d399' : '#f472b6',
                                    fontSize: '0.78rem'
                                  }}>
                                    {item.categoryName}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 700 }}>
                                    {getLinkDisplayLabel(item.categoryId, item.linkNumber)}
                                  </span>
                                </td>
                                <td>{item.from_station && item.to_station ? `${item.from_station} ➔ ${item.to_station}` : '-'}</td>
                                <td>{item.coaches}</td>
                                {isAdmin && (
                                  <td>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px' }}
                                      onClick={() => {
                                        setEditingLink(item.linkObj);
                                        setLinkForm({
                                          link_number: item.linkObj.link_number,
                                          train_numbers: item.linkObj.train_numbers || '',
                                          from_station: item.linkObj.from_station || '',
                                          to_station: item.linkObj.to_station || '',
                                          coaches: item.linkObj.coaches || '',
                                          is_rest: !!item.linkObj.is_rest,
                                          effective_from: item.linkObj.effective_from || '2026-07-01'
                                        });
                                        setLinkSubTab('list');
                                      }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button 
                                      className="btn btn-danger" 
                                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                      onClick={() => deleteLink(item.linkId)}
                                    >
                                      🗑️ Delete
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ));
                          })()}
                          {trainRosterItems.length === 0 && (
                            <tr>
                              <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px' }}>
                                No daily train links found for this filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* CATEGORY 2: NON-DAILY TRAINS */}
                {trainRosterCategory === 'non-daily' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>🗓️ Non-Daily & Weekly Special Trains</h3>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                        Weekly and non-daily train services assigned across each day of the week.
                      </p>
                    </div>

                    {/* Day of Week Filter Pills & Search Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { id: 'ALL', label: 'All Days' },
                          { id: 'SUNDAY', label: 'SUN (Sunday)' },
                          { id: 'MONDAY', label: 'MON (Monday)' },
                          { id: 'TUESDAY', label: 'TUE (Tuesday)' },
                          { id: 'WEDNESDAY', label: 'WED (Wednesday)' },
                          { id: 'THURSDAY', label: 'THU (Thursday)' },
                          { id: 'FRIDAY', label: 'FRI (Friday)' },
                          { id: 'SATURDAY', label: 'SAT (Saturday)' }
                        ].map(tab => {
                          const count = tab.id === 'ALL' 
                            ? nonDailyList.length 
                            : nonDailyList.filter(t => {
                                if (!t.day_of_week) return false;
                                const tDay = t.day_of_week.toUpperCase().trim();
                                return tDay === tab.id || tDay === tab.id.slice(0, 3) || tDay.includes(tab.id) || tDay.includes(tab.id.slice(0, 3));
                              }).length;
                          const isSelected = nonDailySelectedDay === tab.id;

                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setNonDailySelectedDay(tab.id)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                                background: isSelected ? 'rgba(212, 161, 92, 0.2)' : 'rgba(255,255,255,0.03)',
                                color: isSelected ? 'var(--primary)' : 'var(--color-text-secondary)',
                                fontWeight: isSelected ? 700 : 500,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>{tab.label}</span>
                              <span style={{
                                fontSize: '0.72rem',
                                background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                color: isSelected ? '#000' : 'var(--color-text-muted)',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                fontWeight: 700
                              }}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Non-Daily Search Input */}
                      <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                        <input 
                          type="text"
                          className="form-input"
                          placeholder="🔍 Search train (e.g. 02811), staff, route..."
                          value={nonDailyTrainSearch}
                          onChange={(e) => setNonDailyTrainSearch(e.target.value)}
                          style={{
                            paddingRight: nonDailyTrainSearch ? '36px' : '14px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            border: '1px solid var(--border-glass)'
                          }}
                        />
                        {nonDailyTrainSearch && (
                          <button
                            type="button"
                            onClick={() => setNonDailyTrainSearch('')}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Day of Week</th>
                            <th>Train Number</th>
                            <th>Departure</th>
                            <th>Arrival</th>
                            <th>Coaches</th>
                            <th>Assigned Staff / Relief Crew</th>
                            <th>Remarks</th>
                            {isAdmin && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const searchedNonDaily = filteredNonDaily.filter(item => {
                              if (!nonDailyTrainSearch.trim()) return true;
                              const q = nonDailyTrainSearch.toLowerCase().trim();
                              const staffObj = (allStaffList || []).find(s => s.id === item.assigned_staff_id);
                              const staffName = staffObj ? staffObj.name : (item.assigned_staff_name || '');
                              const trainMatch = item.train_number && item.train_number.toLowerCase().includes(q);
                              const dayMatch = item.day_of_week && item.day_of_week.toLowerCase().includes(q);
                              const stnMatch = (item.departure_station && item.departure_station.toLowerCase().includes(q)) || (item.arrival_station && item.arrival_station.toLowerCase().includes(q));
                              const staffMatch = staffName.toLowerCase().includes(q);
                              const remMatch = item.remarks && item.remarks.toLowerCase().includes(q);
                              return trainMatch || dayMatch || stnMatch || staffMatch || remMatch;
                            });

                            return searchedNonDaily.map((item) => {
                            const staffObj = (allStaffList || []).find(s => s.id === item.assigned_staff_id);
                            const staffDisplay = staffObj 
                              ? `${staffObj.name} (${staffObj.designation || 'Relief'})`
                              : item.assigned_staff_name || null;

                            return (
                              <tr key={item.id}>
                                <td>
                                  <span className="badge" style={{
                                    background: item.day_of_week === 'SUNDAY' ? 'rgba(239, 68, 68, 0.15)' :
                                                item.day_of_week === 'MONDAY' ? 'rgba(59, 130, 246, 0.15)' :
                                                item.day_of_week === 'TUESDAY' ? 'rgba(168, 85, 247, 0.15)' :
                                                item.day_of_week === 'WEDNESDAY' ? 'rgba(16, 185, 129, 0.15)' :
                                                item.day_of_week === 'THURSDAY' ? 'rgba(245, 158, 11, 0.15)' :
                                                item.day_of_week === 'FRIDAY' ? 'rgba(6, 182, 212, 0.15)' :
                                                'rgba(236, 72, 153, 0.15)',
                                    color: item.day_of_week === 'SUNDAY' ? '#ef4444' :
                                           item.day_of_week === 'MONDAY' ? '#60a5fa' :
                                           item.day_of_week === 'TUESDAY' ? '#c084fc' :
                                           item.day_of_week === 'WEDNESDAY' ? '#34d399' :
                                           item.day_of_week === 'THURSDAY' ? '#fbbf24' :
                                           item.day_of_week === 'FRIDAY' ? '#22d3ee' :
                                           '#f472b6',
                                    fontWeight: 700
                                  }}>
                                    {item.day_of_week}
                                  </span>
                                </td>
                                <td>
                                  <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                                    {item.train_number}
                                  </strong>
                                </td>
                                <td>
                                  <strong>{item.departure_station || '-'}</strong>
                                  {item.departure_time && <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>({item.departure_time})</span>}
                                </td>
                                <td>
                                  <strong>{item.arrival_station || '-'}</strong>
                                  {item.arrival_time && <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>({item.arrival_time})</span>}
                                </td>
                                <td>{item.coaches || 'SL / AC'}</td>
                                <td>
                                  {staffDisplay ? (
                                    <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                                      👤 {staffDisplay}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                      — Unassigned (Ad-hoc) —
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {item.remarks ? (
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                                      {item.remarks}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                                  )}
                                </td>
                                {isAdmin && (
                                  <td>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 10px', fontSize: '0.78rem', marginRight: '8px' }}
                                      onClick={() => {
                                        setEditingNonDailyTrain(item);
                                        setNonDailyInitialDay(item.day_of_week);
                                        setNonDailyModalOpen(true);
                                      }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button 
                                      className="btn btn-danger" 
                                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                      onClick={async () => {
                                        if (window.confirm(`Delete train ${item.train_number} for ${item.day_of_week}?`)) {
                                          await fetch(`${API_BASE}/non-daily-trains/${item.id}`, {
                                            method: 'DELETE',
                                            headers: { 'Authorization': `Bearer ${authToken}` }
                                          });
                                          fetchNonDailyTrains(nonDailySelectedDay);
                                        }
                                      }}
                                    >
                                      🗑️ Delete
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })()}
                        {filteredNonDaily.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px' }}>
                              No non-daily trains found for {nonDailySelectedDay === 'ALL' ? 'the entire week' : nonDailySelectedDay}.
                            </td>
                          </tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

        {/* ----------------------------------------------------
            TAB 4: STAFF ROSTER CRUD
            ---------------------------------------------------- */}
        {activeTab === 'staff' && (
          <div>
            {!isAdmin && (
              <div style={{
                background: 'rgba(212, 161, 92, 0.08)',
                border: '1px solid rgba(212, 161, 92, 0.25)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.88rem',
                color: 'var(--color-text-primary)'
              }}>
                <span>🔒</span>
                <span><strong>Read-Only Mode:</strong> Logged in as Staff/Viewer. Only Master Administrators can add, edit, reorder, or delete staff records.</span>
              </div>
            )}

            {/* Category Selector Pills & Search Bar for Staff Roster / LR Sheet */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Staff Category:</span>
                {[
                  { id: '1', label: 'Conductors (COR)' },
                  { id: '2', label: 'TTI / Sleeper Staff' },
                  { id: '3', label: 'Ladies Staff / TTE' },
                  { id: '4', label: '📋 Leave Reserve (LR) Staff' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: String(selectedCatId) === String(cat.id) ? 700 : 500,
                      background: String(selectedCatId) === String(cat.id) ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: String(selectedCatId) === String(cat.id) ? '#000' : 'var(--color-text-secondary)',
                      border: String(selectedCatId) === String(cat.id) ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeCorCandidate(null);
                      setUpgradeCorModalOpen(true);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.25), rgba(184, 134, 11, 0.15))',
                      color: 'var(--primary, #d4a15c)',
                      border: '1px solid var(--primary, #d4a15c)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(212, 161, 92, 0.2)'
                    }}
                    title="Promote / Upgrade an employee to Conductors (COR) category"
                  >
                    <span>⭐</span> Upgrade to COR
                  </button>
                )}
              </div>

              {/* Staff Search Input */}
              <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search employee by name, designation, rest day..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  style={{
                    paddingRight: staffSearchQuery ? '36px' : '14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border-glass)'
                  }}
                />
                {staffSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStaffSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {isAdmin && (
                <form className="card" style={{ flex: '1', maxWidth: '380px' }} onSubmit={saveStaff}>
                  <div className="card-title">
                    {editingStaff ? `Edit Seniority SL NO ${editingStaff.row_position}` : `Add ${selectedCatId === '4' ? 'LR Staff Member' : 'Staff Member'}`}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Name:</label>
                    <input 
                      type="text" required className="form-input"
                      placeholder="Enter name, or (VACANT)"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Designation:</label>
                    <input 
                      type="text" className="form-input"
                      placeholder="e.g. CTI, Sr.CCTC, CCTC"
                      value={staffForm.designation}
                      onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Weekly Rest Day:</label>
                    <select
                      className="form-input"
                      value={staffForm.rest_day || ''}
                      onChange={(e) => setStaffForm({ ...staffForm, rest_day: e.target.value })}
                    >
                      <option value="">-- No Fixed Rest Day / Cyclic --</option>
                      <option value="SUN">SUN (Sunday)</option>
                      <option value="MON">MON (Monday)</option>
                      <option value="TUE">TUE (Tuesday)</option>
                      <option value="WED">WED (Wednesday)</option>
                      <option value="THU">THU (Thursday)</option>
                      <option value="FRI">FRI (Friday)</option>
                      <option value="SAT">SAT (Saturday)</option>
                    </select>
                  </div>

                  {!editingStaff && (
                    <div className="form-group">
                      <label className="form-label">Seniority Position (Row Position) - optional:</label>
                      <input 
                        type="number" className="form-input"
                        placeholder="Leave blank to add at the end"
                        value={staffForm.row_position}
                        onChange={(e) => setStaffForm({ ...staffForm, row_position: e.target.value })}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {editingStaff ? 'Update Staff' : 'Create Staff'}
                    </button>
                    {editingStaff && (
                      <button 
                        type="button" className="btn btn-secondary" 
                        onClick={() => {
                          setEditingStaff(null);
                          setStaffForm({ name: '', designation: '', row_position: '', rest_day: '' });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}

              <div className="data-table-container" style={{ flex: '2' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SL NO (Row)</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Weekly Rest Day</th>
                      <th>CR Available</th>
                      <th>Active Status</th>
                      {isAdmin && <th>Reorder Seniority</th>}
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredStaffList = staffList.filter(person => {
                        if (!staffSearchQuery.trim()) return true;
                        const q = staffSearchQuery.toLowerCase().trim();
                        const nameMatch = person.name && person.name.toLowerCase().includes(q);
                        const desigMatch = person.designation && person.designation.toLowerCase().includes(q);
                        const restMatch = person.rest_day && person.rest_day.toLowerCase().includes(q);
                        const rowMatch = String(person.row_position).includes(q);
                        return nameMatch || desigMatch || restMatch || rowMatch;
                      });

                      return filteredStaffList.map((person, idx) => (
                        <tr key={person.id}>
                          <td><strong>{person.row_position}</strong></td>
                          <td>
                            {person.name === '(VACANT)' ? (
                              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>(VACANT Slot)</span>
                            ) : (
                              <strong style={{ color: staffSearchQuery && person.name.toLowerCase().includes(staffSearchQuery.toLowerCase().trim()) ? 'var(--primary)' : 'inherit' }}>
                                {person.name}
                              </strong>
                            )}
                          </td>
                          <td>{person.designation || '-'}</td>
                          <td>
                            {person.rest_day && person.rest_day !== '-' ? (
                              <span className="badge" style={{
                                background: person.rest_day === 'SUN' ? 'rgba(239, 68, 68, 0.15)' :
                                            person.rest_day === 'MON' ? 'rgba(59, 130, 246, 0.15)' :
                                            person.rest_day === 'TUE' ? 'rgba(168, 85, 247, 0.15)' :
                                            person.rest_day === 'WED' ? 'rgba(16, 185, 129, 0.15)' :
                                            person.rest_day === 'THU' ? 'rgba(245, 158, 11, 0.15)' :
                                            person.rest_day === 'FRI' ? 'rgba(6, 182, 212, 0.15)' :
                                            'rgba(236, 72, 153, 0.15)',
                                color: person.rest_day === 'SUN' ? '#ef4444' :
                                       person.rest_day === 'MON' ? '#60a5fa' :
                                       person.rest_day === 'TUE' ? '#c084fc' :
                                       person.rest_day === 'WED' ? '#34d399' :
                                       person.rest_day === 'THU' ? '#fbbf24' :
                                       person.rest_day === 'FRI' ? '#22d3ee' :
                                       '#f472b6',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}>
                                {person.rest_day}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>-</span>
                            )}
                          </td>
                          <td>
                            {person.cr_available ? (
                              <span className="badge" style={{ 
                                background: 'rgba(139, 92, 246, 0.15)', 
                                color: '#a78bfa', 
                                border: '1px solid rgba(139, 92, 246, 0.35)', 
                                fontWeight: 700, 
                                fontSize: '0.78rem', 
                                padding: '3px 8px',
                                whiteSpace: 'nowrap'
                              }} title={person.cr_available}>
                                💤 {person.cr_available}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${person.active ? 'badge-approved' : 'badge-rejected'}`}>
                              {person.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem', marginRight: '4px' }}
                                disabled={idx === 0}
                                onClick={() => moveStaffRow(person.id, 'up')}
                              >
                                ▲ Up
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                disabled={idx === filteredStaffList.length - 1}
                                onClick={() => moveStaffRow(person.id, 'down')}
                              >
                                ▼ Down
                              </button>
                            </td>
                          )}
                          {isAdmin && (
                            <td>
                              <button 
                                type="button"
                                className="btn btn-primary"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  marginRight: '6px',
                                  background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.25), rgba(212, 161, 92, 0.1))',
                                  color: 'var(--primary)',
                                  border: '1px solid var(--border-gold)',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => openDutyEditModal({
                                  staffId: person.id,
                                  name: person.name,
                                  designation: person.designation,
                                  categoryId: parseInt(selectedCatId, 10),
                                  categoryName: categories.find(c => String(c.id) === String(selectedCatId))?.name || '',
                                  currentLink: null,
                                  isRest: !!person.rest_day,
                                  initialMode: 'ASSIGN_DAILY'
                                }, selectedDate)}
                                title={`Assign duty to ${person.name}`}
                              >
                                📌 Assign
                              </button>
                              {String(selectedCatId) !== '1' && !person.name.toUpperCase().includes('VACANT') && (
                                <button
                                  type="button"
                                  className="btn btn-warning"
                                  style={{
                                    padding: '4px 9px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    marginRight: '6px',
                                    background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.25), rgba(184, 134, 11, 0.12))',
                                    color: 'var(--primary, #d4a15c)',
                                    border: '1px solid var(--primary, #d4a15c)',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    setUpgradeCorCandidate(person);
                                    setUpgradeCorModalOpen(true);
                                  }}
                                  title={`Upgrade ${person.name} to Conductors (COR) category`}
                                >
                                  ⭐ Upgrade to COR
                                </button>
                              )}
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                                onClick={() => {
                                  setEditingStaff(person);
                                  setStaffForm({
                                    name: person.name,
                                    designation: person.designation || '',
                                    row_position: person.row_position.toString(),
                                    rest_day: person.rest_day || ''
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => deleteStaff(person.id)}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ));
                    })()}
                    {staffList.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 5} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px' }}>
                          No staff records found in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 5: LEAVE / SWAP REQUESTS
            ---------------------------------------------------- */}
        {activeTab === 'leaves' && (
          <div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <form className="card" style={{ flex: '1', maxWidth: '380px' }} onSubmit={submitLeaveRequest}>
                <div className="card-title">Submit Leave or Swap Request</div>
                
                <div className="form-group">
                  <label className="form-label">Staff Member:</label>
                  <select 
                    className="select-input" required style={{ width: '100%' }}
                    value={leaveForm.staff_id}
                    onChange={(e) => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.designation || 'VACANT'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Request Type:</label>
                  <select 
                    className="select-input" style={{ width: '100%' }}
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  >
                    <option value="LEAVE">Leave Day (REST Duty)</option>
                    <option value="SWAP">Duty Swap with Colleague</option>
                  </select>
                </div>

                {leaveForm.type === 'SWAP' && (
                  <div className="form-group">
                    <label className="form-label">Swap Colleague:</label>
                    <select 
                      className="select-input" required style={{ width: '100%' }}
                      value={leaveForm.swap_staff_id}
                      onChange={(e) => setLeaveForm({ ...leaveForm, swap_staff_id: e.target.value })}
                    >
                      <option value="">-- Select Colleague --</option>
                      {staffList.filter(s => s.id.toString() !== leaveForm.staff_id).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.designation || 'VACANT'})</option>
                      ))}
                    </select>
                  </div>
                )}

                {leaveForm.type === 'LEAVE' ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>From Date:</label>
                        <input 
                          type="date" required className="form-input"
                          value={leaveForm.from_date}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLeaveForm(prev => ({
                              ...prev,
                              from_date: val,
                              to_date: (!prev.to_date || prev.to_date < val) ? val : prev.to_date,
                              date: val
                            }));
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>To Date:</label>
                        <input 
                          type="date" required className="form-input"
                          min={leaveForm.from_date}
                          value={leaveForm.to_date}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, to_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    {leaveForm.from_date && leaveForm.to_date && (
                      <div style={{ marginBottom: '14px', fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📅 Duration:</span>
                        <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 700, padding: '2px 8px' }}>
                          {Math.max(1, Math.round((new Date(leaveForm.to_date) - new Date(leaveForm.from_date)) / (1000 * 60 * 60 * 24)) + 1)} Day(s)
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Date:</label>
                    <input 
                      type="date" required className="form-input"
                      value={leaveForm.from_date || leaveForm.date}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, from_date: e.target.value, to_date: e.target.value, date: e.target.value }))}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Reason / Notes:</label>
                  <input 
                    type="text" className="form-input"
                    placeholder="e.g. Medical appointment, family visit"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  Submit Request
                </button>
              </form>

              <div className="data-table-container" style={{ flex: '2' }}>
                <div className="card-title" style={{ padding: '20px 20px 0 20px', border: 'none' }}>
                  Request Approvals & Pipeline
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Type</th>
                      <th>From Date</th>
                      <th>To Date</th>
                      <th>Days</th>
                      <th>Details / Swapper</th>
                      <th>Status</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((req) => {
                      const fromD = req.from_date || req.date;
                      const toD = req.to_date || fromD;
                      const dayDiff = req.type === 'LEAVE' && fromD && toD 
                        ? Math.max(1, Math.round((new Date(toD) - new Date(fromD)) / (1000 * 60 * 60 * 24)) + 1)
                        : 1;

                      return (
                        <tr key={req.id}>
                          <td><strong>{req.staff_name}</strong></td>
                          <td>
                            <span className={`badge ${req.type === 'LEAVE' ? 'badge-rejected' : 'badge-approved'}`}>
                              {req.type}
                            </span>
                          </td>
                          <td><strong>{fromD}</strong></td>
                          <td><strong>{toD}</strong></td>
                          <td>
                            {req.type === 'LEAVE' ? (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', fontWeight: 600 }}>
                                {dayDiff} {dayDiff > 1 ? 'Days' : 'Day'}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            {req.type === 'SWAP' ? (
                              <span>Swap with <strong>{req.swap_staff_name}</strong></span>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>{req.reason || '-'}</span>
                            )}
                          </td>
                        <td>
                          <span className={`badge badge-${req.status.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            {req.status === 'PENDING' && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--success)' }}
                                  onClick={() => approveRequest(req.id)}
                                >
                                  Approve
                                </button>
                                <button 
                                  className="btn btn-danger" 
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => rejectRequest(req.id)}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {req.status !== 'PENDING' && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                Handled by {req.approved_by || 'Admin'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {leaveRequests.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        No leave/swap requests found.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 6: TA APPROVALS (CLAIM VERIFICATION & ACCEPTANCE)
            ---------------------------------------------------- */}
        {activeTab === 'ta-approvals' && (
          <TaApprovals
            isAdmin={isAdmin}
            authToken={authToken}
            categories={categories}
          />
        )}


        {/* ----------------------------------------------------
            TAB 7: AUDIT LOGS
            ---------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div className="card-title" style={{ margin: 0 }}>System Audit Trail & History</div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchAuditLogs}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                🔄 Refresh Logs
              </button>
            </div>
            
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Timestamp (UTC)</th>
                    <th style={{ width: '100px' }}>User Role</th>
                    <th style={{ width: '160px' }}>Action Type</th>
                    <th>Description / Details</th>
                    {isAdmin && <th style={{ width: '110px', textAlign: 'center' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => {
                    const isUndone = log.is_undone === 1;
                    const isReversionLog = log.action_type === 'UNDO';
                    const isEligibleForUndo = !isReversionLog && (
                      ['CHANGED_LINK', 'EXCHANGE_STAFF', 'STAFF_LEAVE', 'STAFF_SICK', 'STAFF_CR', 'LEAVE', 'SICK', 'CR', 'CANCEL_LEAVE', 'RESET_DUTY', 'MUSTER_CELL_UPDATE', 'APPROVE_LEAVE', 'APPROVE_SWAP'].includes(log.action_type) ||
                      (log.undo_data !== null && log.undo_data !== undefined)
                    );

                    return (
                      <tr key={log.id} style={{ opacity: isUndone ? 0.6 : 1, background: isUndone ? 'rgba(0,0,0,0.1)' : 'transparent' }}>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{log.timestamp}</td>
                        <td>
                          <span className="badge badge-approved" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-primary)' }}>
                            {log.user_role}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: log.action_type === 'EXCHANGE_STAFF' ? '#06b6d4' : log.action_type === 'UNDO' ? '#94a3b8' : 'inherit' }}>
                            {log.action_type}
                          </strong>
                          {isUndone && (
                            <span className="badge" style={{ marginLeft: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.68rem', padding: '1px 6px' }}>
                              ↩️ UNDONE
                            </span>
                          )}
                        </td>
                        <td style={{ textDecoration: isUndone ? 'line-through' : 'none', color: isUndone ? 'var(--color-text-secondary)' : 'inherit' }}>
                          {log.description}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'center' }}>
                            {isUndone ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                Undone
                              </span>
                            ) : isReversionLog ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                -
                              </span>
                            ) : isEligibleForUndo ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleUndoAuditLog(log)}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Undo this action and restore previous state"
                              >
                                ↩️ Undo
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                -
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        No audit logs available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 8: USER VERIFICATION & ADMIN APPROVAL PORTAL
            ---------------------------------------------------- */}
        {activeTab === 'user-management' && currentUser?.role === 'Admin' && (() => {
          const pendingUsers = registeredUsers.filter(u => u.status === 'PENDING');
          const filteredUsers = registeredUsers.filter(u => {
            if (userFilter === 'PENDING') return u.status === 'PENDING';
            if (userFilter === 'APPROVED') return u.status === 'APPROVED';
            if (userFilter === 'REJECTED') return u.status === 'REJECTED';
            return true;
          }).filter(u => {
            if (!userSearch) return true;
            const q = userSearch.toLowerCase();
            return (
              (u.name && u.name.toLowerCase().includes(q)) ||
              (u.username && u.username.toLowerCase().includes(q)) ||
              (u.email && u.email.toLowerCase().includes(q))
            );
          });

          return (
            <div>
              {/* Top Banner Alert on Action */}
              {adminActionMsg && (
                <div style={{
                  background: 'rgba(104, 166, 125, 0.15)',
                  border: '1px solid rgba(104, 166, 125, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  marginBottom: '20px',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.92rem',
                  fontWeight: 600
                }}>
                  <span>✓</span> {adminActionMsg}
                </div>
              )}

              {/* Statistics Overview Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '18px',
                marginBottom: '28px'
              }}>
                <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Registered</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                    {userCounts.total}
                  </div>
                </div>

                <div className="card" style={{
                  padding: '20px',
                  background: userCounts.pending > 0 ? 'linear-gradient(135deg, rgba(212, 161, 92, 0.12), rgba(189, 90, 90, 0.08))' : 'var(--bg-secondary)',
                  border: `1px solid ${userCounts.pending > 0 ? 'var(--border-gold)' : 'var(--border-subtle)'}`,
                  boxShadow: userCounts.pending > 0 ? '0 0 25px rgba(212, 161, 92, 0.15)' : 'none'
                }}>
                  <span style={{ fontSize: '0.8rem', color: userCounts.pending > 0 ? 'var(--primary)' : 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    ⏳ Pending Review
                  </span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: userCounts.pending > 0 ? 'var(--primary)' : 'var(--color-text-primary)', marginTop: '4px' }}>
                    {userCounts.pending}
                  </div>
                </div>

                <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active & Approved</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                    {userCounts.approved}
                  </div>
                </div>

                <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejected / Suspended</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>
                    {userCounts.rejected}
                  </div>
                </div>
              </div>

              {/* Priority Section: Pending Verification Queue */}
              {pendingUsers.length > 0 ? (
                <div className="card" style={{
                  padding: '24px',
                  marginBottom: '32px',
                  background: 'rgba(26, 26, 29, 0.95)',
                  border: '1px solid var(--border-gold)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(212, 161, 92, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                        ⏳ Pending Approval Requests ({pendingUsers.length})
                      </h2>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
                        The following crew members have signed up and are waiting for your verification before they can sign in.
                      </p>
                    </div>
                  </div>

                  <div className="table-responsive" style={{ background: '#131316', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Applicant Name</th>
                          <th>Username</th>
                          <th>Contact Email</th>
                          <th>Linked Seniority Record</th>
                          <th>Signed Up On</th>
                          <th style={{ textAlign: 'center' }}>Verification Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map(user => (
                          <tr key={user.id} style={{ background: 'rgba(212, 161, 92, 0.03)' }}>
                            <td>
                              <strong style={{ fontSize: '0.95rem' }}>{user.name}</strong>
                            </td>
                            <td>
                              <code style={{ background: '#202025', padding: '3px 8px', borderRadius: '6px', color: 'var(--primary)', fontSize: '0.85rem' }}>
                                @{user.username}
                              </code>
                            </td>
                            <td style={{ color: 'var(--color-text-secondary)' }}>
                              {user.email || '—'}
                            </td>
                            <td>
                              {user.staff_name ? (
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                  👤 {user.staff_name} ({user.staff_designation || 'Staff'})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>General Account</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem' }}>
                              {user.created_at}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                                  onClick={() => handleApproveUser(user.id)}
                                >
                                  ✓ Approve Access
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                                  onClick={() => handleRejectUser(user.id)}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card" style={{
                  padding: '20px 24px',
                  marginBottom: '32px',
                  background: 'rgba(104, 166, 125, 0.05)',
                  border: '1px solid rgba(104, 166, 125, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '1.4rem' }}>✓</span>
                  <div>
                    <strong style={{ color: 'var(--success)' }}>All User Registrations Verified</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      There are currently no pending approval requests in the queue.
                    </p>
                  </div>
                </div>
              )}

              {/* Complete User Directory & Permissions */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <h2 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>
                      👥 Registered Users & Permission Directory
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
                      Manage user roles (Admin, Staff, Viewer), approve/suspend accounts, or remove user records.
                    </p>
                  </div>

                  {/* Search and Filters */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      style={{ width: '200px' }}
                    />
                    
                    <div style={{
                      display: 'flex',
                      background: 'var(--bg-tertiary)',
                      padding: '3px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setUserFilter(f)}
                          style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: userFilter === f ? 'var(--primary)' : 'transparent',
                            color: userFilter === f ? '#0D0D0F' : 'var(--color-text-secondary)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="data-table-container" style={{ margin: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Contact Email</th>
                        <th>Seniority Association</th>
                        <th>Role / Permissions</th>
                        <th>Status</th>
                        <th>Approved Details</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '0.8rem' }}>
                                {user.name ? user.name[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <strong>{user.name}</strong>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                                  @{user.username}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>
                            {user.email || '—'}
                          </td>
                          <td>
                            {user.staff_name ? (
                              <span style={{ fontSize: '0.88rem' }}>
                                👤 {user.staff_name}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            {user.username === 'admin' ? (
                              <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', border: '1px solid var(--border-gold)' }}>
                                👑 Master Admin
                              </span>
                            ) : (
                              <select
                                className="select-input"
                                style={{ padding: '4px 8px', fontSize: '0.82rem', minWidth: '100px' }}
                                value={user.role}
                                onChange={(e) => handleChangeUserRole(user.id, e.target.value)}
                              >
                                <option value="Admin">Admin</option>
                                <option value="Staff">Staff</option>
                                <option value="Viewer">Viewer</option>
                              </select>
                            )}
                          </td>
                          <td>
                            {user.status === 'APPROVED' && (
                              <span className="badge badge-approved">
                                ✓ APPROVED
                              </span>
                            )}
                            {user.status === 'PENDING' && (
                              <span className="badge badge-pending">
                                ⏳ PENDING
                              </span>
                            )}
                            {user.status === 'REJECTED' && (
                              <span className="badge badge-rejected">
                                ✗ REJECTED
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            {user.approved_at ? (
                              <div>
                                <div>By: <strong>{user.approved_by || 'SYSTEM'}</strong></div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{user.approved_at}</div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>Awaiting approval</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {user.status === 'PENDING' && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                  onClick={() => handleApproveUser(user.id)}
                                >
                                  Approve
                                </button>
                              )}
                              {user.status === 'APPROVED' && user.username !== 'admin' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--danger)' }}
                                  onClick={() => handleRejectUser(user.id)}
                                >
                                  Suspend
                                </button>
                              )}
                              {user.status === 'REJECTED' && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                  onClick={() => handleApproveUser(user.id)}
                                >
                                  Re-Approve
                                </button>
                              )}
                              {user.username !== 'admin' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.2)' }}
                                  title="Delete User"
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>
                            No users found matching the filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* DOCUMENTS HUB: TA JOURNAL, NDA PARTICULARS, AND DIARY STATEMENT */}
        {activeTab === 'documents' && (
          <div>
            {/* Unified Document Switcher Header */}
            <div className="no-print" style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              background: 'var(--bg-secondary)',
              padding: '10px 16px',
              borderRadius: '30px',
              border: '1.5px solid var(--border-gold)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              maxWidth: '850px',
              margin: '0 auto 24px auto'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingRight: '6px' }}>
                Select Document:
              </span>
              <button
                type="button"
                onClick={() => setDocSubTab('ta')}
                className="btn"
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: docSubTab === 'ta'
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                    : 'rgba(255,255,255,0.03)',
                  color: docSubTab === 'ta' ? '#0D0D0F' : 'var(--color-text-secondary)',
                  border: docSubTab === 'ta' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  boxShadow: docSubTab === 'ta' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📄 TA Document
              </button>

              <button
                type="button"
                onClick={() => setDocSubTab('nda')}
                className="btn"
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: docSubTab === 'nda'
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                    : 'rgba(255,255,255,0.03)',
                  color: docSubTab === 'nda' ? '#0D0D0F' : 'var(--color-text-secondary)',
                  border: docSubTab === 'nda' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  boxShadow: docSubTab === 'nda' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🌙 NDA Document
              </button>

              <button
                type="button"
                onClick={() => setDocSubTab('diary')}
                className="btn"
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: docSubTab === 'diary'
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                    : 'rgba(255,255,255,0.03)',
                  color: docSubTab === 'diary' ? '#0D0D0F' : 'var(--color-text-secondary)',
                  border: docSubTab === 'diary' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  boxShadow: docSubTab === 'diary' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📔 Diary (E.F.T)
              </button>

              <button
                type="button"
                onClick={() => setDocSubTab('earnings')}
                className="btn"
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: docSubTab === 'earnings'
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                    : 'rgba(255,255,255,0.03)',
                  color: docSubTab === 'earnings' ? '#0D0D0F' : 'var(--color-text-secondary)',
                  border: docSubTab === 'earnings' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  boxShadow: docSubTab === 'earnings' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                💰 Daily Earnings
              </button>
            </div>

            {docSubTab === 'ta' && (
              <TaDocument
                authToken={authToken}
                categories={categories}
                selectedCatId={selectedCatId}
                setSelectedCatId={setSelectedCatId}
                selectedStaffId={docStaffId}
                setSelectedStaffId={(id) => {
                  setDocStaffId(id);
                  try { localStorage.setItem('railway_doc_staff_id', id); } catch (e) {}
                }}
                year={docYear}
                setYear={(y) => {
                  setDocYear(y);
                  try { localStorage.setItem('railway_doc_year', y); } catch (e) {}
                }}
                month={docMonth}
                setMonth={(m) => {
                  setDocMonth(m);
                  try { localStorage.setItem('railway_doc_month', m); } catch (e) {}
                }}
              />
            )}

            {docSubTab === 'nda' && (
              <NdaDocument
                authToken={authToken}
                categories={categories}
                selectedCatId={selectedCatId}
                setSelectedCatId={setSelectedCatId}
                selectedStaffId={docStaffId}
                setSelectedStaffId={(id) => {
                  setDocStaffId(id);
                  try { localStorage.setItem('railway_doc_staff_id', id); } catch (e) {}
                }}
                year={docYear}
                setYear={(y) => {
                  setDocYear(y);
                  try { localStorage.setItem('railway_doc_year', y); } catch (e) {}
                }}
                month={docMonth}
                setMonth={(m) => {
                  setDocMonth(m);
                  try { localStorage.setItem('railway_doc_month', m); } catch (e) {}
                }}
              />
            )}

            {docSubTab === 'diary' && (
              <DiaryDocument
                authToken={authToken}
                categories={categories}
                selectedCatId={selectedCatId}
                setSelectedCatId={setSelectedCatId}
                selectedStaffId={docStaffId}
                setSelectedStaffId={(id) => {
                  setDocStaffId(id);
                  try { localStorage.setItem('railway_doc_staff_id', id); } catch (e) {}
                }}
                year={docYear}
                setYear={(y) => {
                  setDocYear(y);
                  try { localStorage.setItem('railway_doc_year', y); } catch (e) {}
                }}
                month={docMonth}
                setMonth={(m) => {
                  setDocMonth(m);
                  try { localStorage.setItem('railway_doc_month', m); } catch (e) {}
                }}
              />
            )}

            {docSubTab === 'earnings' && (
              <DailyEarningsDocument
                authToken={authToken}
                categories={categories}
                selectedCatId={selectedCatId}
                setSelectedCatId={setSelectedCatId}
                selectedStaffId={docStaffId}
                setSelectedStaffId={(id) => {
                  setDocStaffId(id);
                  try { localStorage.setItem('railway_doc_staff_id', id); } catch (e) {}
                }}
                year={docYear}
                setYear={(y) => {
                  setDocYear(y);
                  try { localStorage.setItem('railway_doc_year', y); } catch (e) {}
                }}
                month={docMonth}
                setMonth={(m) => {
                  setDocMonth(m);
                  try { localStorage.setItem('railway_doc_month', m); } catch (e) {}
                }}
              />
            )}
          </div>
        )}

        {/* MUSTER DETAILS / ATTENDANCE ROLL (11th to 10th Wage Period) */}
        {activeTab === 'muster' && (
          <MusterRoll
            isAdmin={isAdmin}
            categories={categories}
            authToken={authToken}
            API_BASE={API_BASE}
          />
        )}

        {/* LR LIST (MONTHLY LEAVE RESERVE SHEET) */}
        {activeTab === 'lr-list' && (
          <LRList
            isAdmin={isAdmin}
            authToken={authToken}
            API_BASE={API_BASE}
          />
        )}

        {/* STAFF AVAILABILITY SHEET (COR, TTE, LADIES, LR) */}
        {activeTab === 'availability' && (
          <AvailabilitySheet
            isAdmin={isAdmin}
            openDutyEditModal={openDutyEditModal}
          />
        )}

        {/* SENIORITY LIST (139 Ticket Checking Staff of Guntur Division) */}
        {activeTab === 'seniority' && (
          <SeniorityList
            isAdmin={isAdmin}
            authToken={authToken}
            API_BASE={API_BASE}
          />
        )}
      </div>

      {/* Comprehensive Duty Status & Employee Edit Modal */}
      {dutyEditModal && (
        <DutyEditModal
          dutyModal={dutyEditModal}
          categories={categories}
          allStaffList={allStaffList}
          allLinksList={allLinksList}
          nonDailyList={nonDailyList}
          dailyDuties={dailyDuties}
          authToken={authToken}
          isAdmin={isAdmin}
          onClose={() => setDutyEditModal(null)}
          onSuccess={onDutyEditSuccess}
        />
      )}

      {/* Cadre Upgrade to Conductors (COR) Modal */}
      {upgradeCorModalOpen && (
        <UpgradeToCorModal
          isOpen={upgradeCorModalOpen}
          staff={upgradeCorCandidate}
          allStaffList={allStaffList}
          categories={categories}
          authToken={authToken}
          onClose={() => {
            setUpgradeCorModalOpen(false);
            setUpgradeCorCandidate(null);
          }}
          onSuccess={() => {
            fetchStaff();
            fetchAllStaff();
            if (activeTab === 'roster') fetchRoster();
            if (activeTab === 'daily-summary' || activeTab === 'daily') fetchDailyDuties();
          }}
        />
      )}

      {/* Non-Daily Train Add / Edit Modal */}
      {nonDailyModalOpen && (() => {
        const currentRestStaffList = [];
        if (dailyDuties && dailyDuties.categories) {
          dailyDuties.categories.forEach(cat => {
            if (cat.staff) {
              cat.staff.forEach(s => {
                if (s.isRest && s.status !== 'SICK' && s.status !== 'LEAVE' && s.status !== 'CR') {
                  currentRestStaffList.push({
                    id: s.staffId || s.id,
                    staffId: s.staffId || s.id,
                    name: s.name,
                    designation: s.designation,
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    link_number: s.link_number
                  });
                }
              });
            }
          });
        }

        return (
          <NonDailyTrainModal
            isOpen={nonDailyModalOpen}
            onClose={() => {
              setNonDailyModalOpen(false);
              setEditingNonDailyTrain(null);
            }}
            trainData={editingNonDailyTrain}
            initialDay={nonDailyInitialDay}
            allStaffList={allStaffList}
            restStaffList={currentRestStaffList}
            onSaveSuccess={() => {
              fetchNonDailyTrains(nonDailySelectedDay);
              if (activeTab === 'daily-summary') {
                fetchDailyDuties();
              }
            }}
            authToken={authToken}
            API_BASE={API_BASE}
          />
        );
      })()}

      {/* ---------------------------------------------------- */}
      {/* GLOBAL SHIFT CONFIRMATION MODAL                      */}
      {/* ---------------------------------------------------- */}
      {appShiftConfirm && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.78)', 
            backdropFilter: 'blur(6px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setAppShiftConfirm(null)}
        >
          <div 
            className="card" 
            style={{ 
              maxWidth: '520px', 
              width: '100%', 
              background: 'var(--bg-card, #1e293b)', 
              border: '2px solid #eab308', 
              borderRadius: '16px', 
              padding: '26px', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              color: 'var(--color-text-primary, #f8fafc)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <span style={{ fontSize: '2.4rem' }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#facc15' }}>
                  Confirm Employee Duty Shift
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
                  Reassigning an already working employee
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '0.92rem',
              lineHeight: 1.6
            }}>
              <strong>{appShiftConfirm.staffName}</strong> is currently assigned to{' '}
              <strong style={{ color: '#60a5fa' }}>{appShiftConfirm.currentTrainDesc}</strong> on {selectedDate}.
              <br /><br />
              Are you sure you want to shift them to{' '}
              <strong style={{ color: '#34d399' }}>{appShiftConfirm.targetTrainDesc}</strong>?
              <br /><br />
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 12px',
                borderRadius: '6px',
                color: '#f87171',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                ℹ️ The slot on their previous train will immediately be marked as <strong>VACANT</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAppShiftConfirm(null)}
                style={{ padding: '10px 18px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const onConf = appShiftConfirm.onConfirm;
                  setAppShiftConfirm(null);
                  if (onConf) onConf();
                }}
                style={{
                  padding: '10px 22px',
                  fontWeight: 800,
                  backgroundColor: '#eab308',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(234, 179, 8, 0.4)',
                  cursor: 'pointer'
                }}
              >
                ✓ Confirm Shift & Vacate Old Train
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* QUICK ASSIGN STAFF TO NON-DAILY TRAIN MODAL          */}
      {/* ---------------------------------------------------- */}
      {quickAssignNonDailyTrain && (() => {
        const q = quickAssignSearch.toLowerCase().trim();

        // 1. Gather all non-vacant staff
        const validStaff = (allStaffList || []).filter(s => 
          s.name && !s.name.toUpperCase().includes('VACANT')
        );

        // 2. Filter with busy check
        const filteredStaff = validStaff.filter(s => {
          const currentWorking = getStaffCurrentWorkingTrain(s.id);
          const isBusy = Boolean(currentWorking);
          if (isBusy && !quickAssignShowBusy) return false;

          if (q) {
            const nameMatch = s.name && s.name.toLowerCase().includes(q);
            const desgMatch = s.designation && s.designation.toLowerCase().includes(q);
            const pfMatch = s.pf_number && s.pf_number.toLowerCase().includes(q);
            return nameMatch || desgMatch || pfMatch;
          }
          return true;
        });

        const handleSelectStaffForNonDaily = (s) => {
          const currentWorking = s.currentWorking || getStaffCurrentWorkingTrain(s.id);
          const targetTrain = quickAssignNonDailyTrain;
          setQuickAssignNonDailyTrain(null);

          if (currentWorking) {
            setAppShiftConfirm({
              staffName: s.name,
              currentTrainDesc: currentWorking,
              targetTrainDesc: `Non-Daily Train ${targetTrain.train_number}`,
              onConfirm: () => doActualAssignNonDaily(s.id, s.name, targetTrain, null)
            });
          } else {
            doActualAssignNonDaily(s.id, s.name, targetTrain, null);
          }
        };

        return (
          <div 
            className="modal-overlay" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.8)', 
              backdropFilter: 'blur(6px)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 99998,
              padding: '20px'
            }}
            onClick={() => setQuickAssignNonDailyTrain(null)}
          >
            <div 
              className="card" 
              style={{ 
                maxWidth: '680px', 
                width: '100%', 
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card, #1e293b)', 
                border: '1px solid var(--border-glass)', 
                borderRadius: '16px', 
                padding: '24px', 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                color: 'var(--color-text-primary, #f8fafc)'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    ➕ Assign Staff to Train {quickAssignNonDailyTrain.train_number}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                    {quickAssignNonDailyTrain.departure_station} ({quickAssignNonDailyTrain.departure_time || '-'}) ➔ {quickAssignNonDailyTrain.arrival_station} ({quickAssignNonDailyTrain.arrival_time || '-'}) • Date: {selectedDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAssignNonDailyTrain(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Search & Busy Filter Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search employee by name, designation, or PF..."
                  value={quickAssignSearch}
                  onChange={e => setQuickAssignSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem'
                  }}
                  autoFocus
                />

                <label style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: quickAssignShowBusy ? '#facc15' : 'var(--color-text-secondary)',
                  background: quickAssignShowBusy ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255,255,255,0.04)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: quickAssignShowBusy ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid var(--border-glass)',
                  alignSelf: 'flex-start'
                }}>
                  <input
                    type="checkbox"
                    checked={quickAssignShowBusy}
                    onChange={e => setQuickAssignShowBusy(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  ⚠️ Show busy / assigned staff (to shift duty)
                </label>
              </div>

              {/* Staff List */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredStaff.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    No eligible staff members found.
                    {!quickAssignShowBusy && (
                      <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
                        (Busy / currently assigned staff are hidden. Check <em>"Show busy / assigned staff"</em> above to shift an assigned employee).
                      </div>
                    )}
                  </div>
                ) : (
                  filteredStaff.map(s => {
                    const currentWorking = getStaffCurrentWorkingTrain(s.id);
                    const isBusy = Boolean(currentWorking);
                    const isLR = s.category_id === 4;

                    return (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: isBusy ? 'rgba(234, 179, 8, 0.06)' : 'var(--bg-secondary)',
                          border: isBusy ? '1px solid rgba(234, 179, 8, 0.25)' : '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          gap: '12px',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.92rem' }}>{s.name}</strong>
                            <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)' }}>
                              {s.designation || 'TTI'}
                            </span>
                            {isLR && (
                              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                                LR Pool
                              </span>
                            )}
                            {isBusy ? (
                              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', fontWeight: 700 }}>
                                ⚠️ Working: {currentWorking}
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                                🟢 Available
                              </span>
                            )}
                          </div>
                          {s.pf_number && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              PF: {s.pf_number}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className={isBusy ? 'btn btn-secondary' : 'btn btn-primary'}
                          onClick={() => handleSelectStaffForNonDaily({ ...s, currentWorking })}
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            backgroundColor: isBusy ? '#eab308' : undefined,
                            color: isBusy ? '#000' : undefined,
                            border: isBusy ? 'none' : undefined
                          }}
                        >
                          {isBusy ? '⇄ Shift Duty' : '✓ Assign'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQuickAssignNonDailyTrain(null)}
                  style={{ padding: '8px 18px', fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      </div>
      {/* Mobile Bottom Thumb Dock */}
      <div className="mobile-bottom-nav no-print">
        <button 
          type="button" 
          className={`mobile-nav-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <span className="mobile-nav-icon">👤</span>
          <span className="mobile-nav-label">My Duty</span>
        </button>
        <button 
          type="button" 
          className={`mobile-nav-btn ${activeTab === 'daily-summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily-summary')}
        >
          <span className="mobile-nav-icon">📋</span>
          <span className="mobile-nav-label">Summary</span>
        </button>
        <button 
          type="button" 
          className={`mobile-nav-btn ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => setActiveTab('roster')}
        >
          <span className="mobile-nav-icon">📅</span>
          <span className="mobile-nav-label">Roster</span>
        </button>
        <button 
          type="button" 
          className={`mobile-nav-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <span className="mobile-nav-icon">📄</span>
          <span className="mobile-nav-label">TA Journal</span>
        </button>
        <button 
          type="button" 
          className="mobile-nav-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span className="mobile-nav-icon">☰</span>
          <span className="mobile-nav-label">Menu</span>
        </button>
      </div>
    </div>
  );

  return renderAppContent();
}
