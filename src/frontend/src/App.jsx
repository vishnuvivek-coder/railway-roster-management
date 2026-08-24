import React, { useState, useEffect } from 'react';
import AuthScreen from './AuthScreen';
import DemoBar from './DemoBar';
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
  const [isMobileSimulated, setIsMobileSimulated] = useState(false);

  // User Verification & Role Administration State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [userCounts, setUserCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [userFilter, setUserFilter] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [userSearch, setUserSearch] = useState('');
  const [adminActionMsg, setAdminActionMsg] = useState('');

  const [activeTab, setActiveTab] = useState('daily'); // default is daily duties view
  const [userRole, setUserRole] = useState(() => currentUser?.role || 'Admin');
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  
  // Date states - default to today's date dynamically
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [year, setYear] = useState(getLocalYearString());
  const [month, setMonth] = useState(getLocalMonthString());

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
  const [linkSubTab, setLinkSubTab] = useState('list'); // 'list' or 'train-centric'
  const [customSets, setCustomSets] = useState([]);
  const [newSetName, setNewSetName] = useState('');
  const [newSetType, setNewSetType] = useState('2-Day Set');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState('');

  // State for Staff CRUD
  const [staffList, setStaffList] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '', designation: '', row_position: ''
  });

  // State for Leave Requests
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    staff_id: '', date: getLocalDateString(), type: 'LEAVE', swap_staff_id: '', reason: ''
  });

  // State for Lookups & Reports
  const [lookupType, setLookupType] = useState('who'); // who, what
  const [lookupLink, setLookupLink] = useState('1');
  const [lookupDate, setLookupDate] = useState(getLocalDateString());
  const [lookupStaffId, setLookupStaffId] = useState('');
  const [lookupResults, setLookupResults] = useState(null);

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

  // Fast Persona Switching for Prototype Showcases
  const handleSwitchPersona = async (personaKey) => {
    try {
      const res = await fetch(`${API_BASE}/auth/demo-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaKey })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to switch persona');
        return;
      }
      setCurrentUser(data.user);
      setAuthToken(data.token);
      setUserRole(data.user.role);
      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      if (data.user.staff_id) {
        setSelectedStaffId(data.user.staff_id.toString());
      }
    } catch (err) {
      alert('Error switching demo persona: ' + err.message);
    }
  };

  // 1-Click Guided Operational Scenarios
  const handleRunScenario = async (scenarioType) => {
    if (scenarioType === 'rotation') {
      setSelectedDate(getLocalDateString());
      setActiveTab('daily');
      setDailyViewMode('table');
    } else if (scenarioType === 'swap') {
      await handleSwitchPersona('admin');
      setActiveTab('leaves');
    } else if (scenarioType === 'reconciliation') {
      await handleSwitchPersona('admin');
      setActiveTab('register');
      setSubTab('reco');
      fetchReconciliation();
    }
  };

  // Load Categories on startup
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
  }, []);

  // Fetch all staff, links, and entries for Daily Duty Register when tab active
  useEffect(() => {
    if (activeTab === 'register') {
      fetch(`${API_BASE}/staff`)
        .then(res => res.json())
        .then(setAllStaffList);

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
  }, [selectedCatId, year, month, activeTab]);

  // Fetch daily duties on date or tab change
  useEffect(() => {
    if (activeTab === 'daily-summary' && selectedDate) {
      fetchDailyDuties();
    }
  }, [activeTab, selectedDate]);

  // Load other data based on active tab
  useEffect(() => {
    if (activeTab === 'links' && selectedCatId) fetchLinks();
    if (activeTab === 'staff' && selectedCatId) fetchStaff();
    if (activeTab === 'leaves' || activeTab === 'daily-summary') fetchLeaveRequests();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, selectedCatId]);

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
  };

  const fetchRoster = () => {
    setLoadingRoster(true);
    fetch(`${API_BASE}/roster?category_id=${selectedCatId}&year=${year}&month=${month}`)
      .then(res => res.json())
      .then(data => {
        setRosterData(data);
        setLoadingRoster(false);
      })
      .catch(() => setLoadingRoster(false));
  };

  const fetchLinks = () => {
    fetch(`${API_BASE}/links?category_id=${selectedCatId}`)
      .then(res => res.json())
      .then(data => {
        setLinksList(data);
        const uniqueSets = [];
        const seen = new Set();
        data.forEach(l => {
          if (l.set_name && !seen.has(l.set_name)) {
            seen.add(l.set_name);
            uniqueSets.push({ name: l.set_name, type: l.set_type || '2-Day Set', category_id: parseInt(selectedCatId, 10) });
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
      });
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
      .then(setLeaveRequests);
  };

  const fetchAuditLogs = () => {
    fetch(`${API_BASE}/audit-logs`)
      .then(res => res.json())
      .then(setAuditLogs);
  };

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
  // OVERRIDES HANDLERS
  // ----------------------------------------------------
  const handleCellClick = (cell, staffId, staffName) => {
    if (!isAdmin) return; // Only Admin can open override modal
    setSelectedCell({
      staffId,
      date: cell.date,
      currentLink: cell.actualLinkNumber,
      staffName
    });
    setOverrideLinkNum(cell.actualLinkNumber === null ? '' : cell.actualLinkNumber.toString());
    setOverrideReason(cell.isOverridden ? cell.overrideReason : '');
  };

  const submitOverride = (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const linkVal = overrideLinkNum === '' ? null : parseInt(overrideLinkNum, 10);
    fetch(`${API_BASE}/overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        staff_id: selectedCell.staffId,
        date: selectedCell.date,
        overridden_link_number: linkVal,
        reason: overrideReason || 'Manual adjustment'
      })
    })
      .then(res => res.json())
      .then(() => {
        setSelectedCell(null);
        if (activeTab === 'daily' || activeTab === 'roster') fetchRoster();
        if (activeTab === 'daily-summary') fetchDailyDuties();
      });
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
      setStaffForm({ name: '', designation: '', row_position: '' });
      fetchStaff();
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
    fetch(`${API_BASE}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        staff_id: parseInt(leaveForm.staff_id, 10),
        date: leaveForm.date,
        type: leaveForm.type,
        swap_staff_id: leaveForm.swap_staff_id ? parseInt(leaveForm.swap_staff_id, 10) : null,
        reason: leaveForm.reason
      })
    }).then(() => {
      setLeaveForm({ staff_id: '', date: getLocalDateString(), type: 'LEAVE', swap_staff_id: '', reason: '' });
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
    });

    sortedRows.forEach((row, idx) => {
      const isVacantRow = row.staffName === '(VACANT)';
      const cellValues = row.cells.map(c => {
        if (isVacantRow) return "";
        return c.isRest ? "REST" : c.actualLinkNumber;
      });
      csvContent += `${idx + 1},"${row.staffName || '(VACANT)'}","${row.designation || ''}",${cellValues.join(",")}\n`;
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
    if (cell.isRest) return 'REST';
    return getLinkDisplayLabel(selectedCatId, cell.actualLinkNumber);
  };

  const getCellClass = (cell) => {
    if (cell.isOverridden) return 'roster-cell cell-override';
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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        <DemoBar 
          currentUser={currentUser}
          device={device}
          deviceMode={deviceMode}
          setDeviceMode={setDeviceMode}
          detectedPlatform={detectedPlatform}
          onSwitchPersona={handleSwitchPersona}
          onRunScenario={handleRunScenario}
          isMobileSimulated={isMobileSimulated}
          onToggleMobileSimulated={() => setIsMobileSimulated(!isMobileSimulated)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          categories={categories}
          selectedCatId={selectedCatId}
          setSelectedCatId={setSelectedCatId}
        />
        <div style={{ flex: 1 }}>
          <AuthScreen 
            onLoginSuccess={(user, token) => {
              setCurrentUser(user);
              setAuthToken(token);
              setUserRole(user.role);
            }} 
          />
        </div>
      </div>
    );
  }

  const renderAppContent = () => (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">🚆</div>
          <div className="logo-text">Roster Manager</div>
        </div>

        <ul className="nav-links">
          <li 
            className={`nav-item ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            <span>👤</span> Employee Monthly View
          </li>
          <li 
            className={`nav-item ${activeTab === 'daily-summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily-summary')}
          >
            <span>📋</span> Daily Summary Table
          </li>
          <li 
            className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            <span>📅</span> Roster Grid
          </li>
          <li 
            className={`nav-item ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
          >
            <span>🚆</span> Train Roster
          </li>
          <li 
            className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <span>👥</span> Staff Roster
          </li>
          <li 
            className={`nav-item ${activeTab === 'leaves' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaves')}
          >
            <span>✉️</span> Leave / Swap
          </li>
          <li 
            className={`nav-item ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <span>📝</span> Duty Register
          </li>
          <li 
            className={`nav-item ${activeTab === 'lookups' ? 'active' : ''}`}
            onClick={() => setActiveTab('lookups')}
          >
            <span>🔍</span> Lookups & Reports
          </li>
          <li 
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <span>📜</span> Audit Logs
          </li>

          {/* Master Admin User Approvals & Verification */}
          {currentUser?.role === 'Admin' && (
            <li 
              className={`nav-item ${activeTab === 'user-management' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-management')}
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
      <div className="main-content">
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
                <label className="form-label" style={{ marginBottom: 0 }}>Select Employee:</label>
                <select 
                  className="select-input"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{ minWidth: '180px' }}
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.designation || '-'})</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Year:</label>
                <select className="select-input" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Month:</label>
                <select className="select-input" value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'daily-summary' && (
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
          )}

          {activeTab === 'roster' && (
            <div className="filter-group">
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
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                              {staffRow.staffName}
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                              Designation: <strong>{staffRow.designation || '-'}</strong> | Category: <strong>{rosterData.category.name}</strong>
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
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Selected Month</span>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                          {new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </strong>
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
                          </tr>
                        </thead>
                        <tbody>
                          {staffRow.cells.map((cell, idx) => {
                            const isRest = cell.isRest || cell.actualLinkNumber === null;
                            const isLeave = cell.isLeave;
                            const isOverridden = cell.isOverridden;
                            
                            let linkLabel = isLeave ? '🏥 LEAVE' : isRest ? '😴 REST' : getLinkDisplayLabel(selectedCatId, cell.actualLinkNumber);
                            let cellBg = 'transparent';
                            let badgeStyle = { fontWeight: 700, borderRadius: '6px', padding: '4px 10px', fontSize: '0.85rem' };
                            
                            if (isLeave) {
                              badgeStyle.background = 'rgba(239, 68, 68, 0.15)';
                              badgeStyle.color = '#ef4444';
                            } else if (isRest) {
                              badgeStyle.background = 'rgba(107, 114, 128, 0.15)';
                              badgeStyle.color = '#9ca3af';
                            } else if (isOverridden) {
                              badgeStyle.background = 'rgba(245, 158, 11, 0.15)';
                              badgeStyle.color = '#f59e0b';
                              cellBg = 'rgba(245, 158, 11, 0.02)';
                            } else {
                              badgeStyle.background = 'rgba(16, 185, 129, 0.15)';
                              badgeStyle.color = '#10b981';
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
                                  <strong>{isRest || isLeave ? '-' : cell.train_numbers || '-'}</strong>
                                </td>
                                <td>
                                  {isRest || isLeave ? '-' : (
                                    <span>
                                      {cell.from_station || '-'} ➔ {cell.to_station || '-'}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ color: 'var(--color-text-secondary)' }}>
                                    {isRest || isLeave ? '-' : cell.coaches || '-'}
                                  </span>
                                </td>
                                <td>
                                  {isLeave ? (
                                    <span style={{ color: '#ef4444', fontStyle: 'italic' }}>On Leave</span>
                                  ) : isRest ? (
                                    <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Weekly Rest Day</span>
                                  ) : isOverridden ? (
                                    <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                                      ⚠️ Mapped override: <em>{cell.overrideReason || 'Manual adjustment'}</em>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Regular Duty Shift</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
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
                    page: 126,
                    firstTrain: '17253',
                    lastTrain: '17252',
                    links: [
                      { categoryId: 2, linkNum: 1, firstCoach: 'AC+SL', lastCoach: 'AC+SL' }
                    ]
                  },
                  {
                    slotId: 2,
                    page: 126,
                    firstTrain: '17239',
                    lastTrain: '17240',
                    links: [
                      { categoryId: 2, linkNum: 29, firstCoach: 'AC+2S', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 3,
                    page: 126,
                    firstTrain: '17646',
                    lastTrain: '12796',
                    links: [
                      { categoryId: 2, linkNum: 33, firstCoach: 'AC+SL', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 4,
                    page: 126,
                    firstTrain: '12805',
                    lastTrain: '12806',
                    links: [
                      { categoryId: 2, linkNum: 19, firstCoach: 'AC+2S', lastCoach: 'AC+2S' }
                    ]
                  },
                  {
                    slotId: 5,
                    page: 126,
                    firstTrain: '12795',
                    lastTrain: '17645',
                    links: [
                      { categoryId: 2, linkNum: 17, firstCoach: 'AC+2S', lastCoach: 'AC+SL' }
                    ]
                  },
                  {
                    slotId: 6,
                    page: 126,
                    firstTrain: '17251',
                    lastTrain: '17254',
                    links: [
                      { categoryId: 2, linkNum: 5, firstCoach: 'AC+SL', lastCoach: 'AC+SL' }
                    ]
                  },
                  {
                    slotId: 7,
                    page: 126,
                    firstTrain: '17281',
                    lastTrain: '17282',
                    links: [
                      { categoryId: 2, linkNum: 31, firstCoach: '2S', lastCoach: '2S' }
                    ]
                  },
                  {
                    slotId: 8,
                    page: 126,
                    firstTrain: '17261',
                    lastTrain: '12733',
                    links: [
                      { categoryId: 1, linkNum: 4, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-2' },
                      { categoryId: 3, linkNum: 1, firstCoach: 'SL', lastTrain: '12733', lastCoach: 'SL' },
                      { categoryId: 3, linkNum: 5, firstCoach: '/', lastTrain: '17262', lastCoach: '/' }
                    ]
                  },
                  {
                    slotId: 9,
                    page: 126,
                    firstTrain: '20629',
                    lastTrain: '12733',
                    links: [
                      { categoryId: 1, linkNum: 8, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-1' },
                      { categoryId: 2, linkNum: 8, firstCoach: '/', lastTrain: '20630', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 10,
                    page: 126,
                    firstTrain: '17225',
                    lastTrain: '17226',
                    links: [
                      { categoryId: 1, linkNum: 1, firstCoach: 'AC', lastCoach: 'AC' },
                      { categoryId: 2, linkNum: 11, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 11,
                    page: 126,
                    firstTrain: '17225',
                    lastTrain: '18048',
                    links: [
                      { categoryId: 2, linkNum: 25, firstCoach: 'SL', lastCoach: 'AC' },
                      { categoryId: 1, linkNum: 15, firstCoach: '/', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 12,
                    page: 126,
                    firstTrain: '17626',
                    lastTrain: '17625',
                    links: [
                      { categoryId: 2, linkNum: 36, firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 50, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 13,
                    page: 127,
                    firstTrain: '12604',
                    lastTrain: '12603',
                    links: [
                      { categoryId: 1, linkNum: 13, firstCoach: 'AC', lastCoach: 'AC' },
                      { categoryId: 2, linkNum: 3, firstCoach: 'SL', lastCoach: 'SL' },
                      { categoryId: 2, linkNum: 45, firstCoach: '/', lastCoach: '/' }
                    ]
                  },
                  {
                    slotId: 14,
                    page: 127,
                    firstTrain: '12734',
                    lastTrain: '20630',
                    links: [
                      { categoryId: 1, linkNum: 11, firstCoach: 'COR-2', lastTrain: '20630', lastCoach: 'AC' },
                      { categoryId: 1, linkNum: 19, firstCoach: 'COR-1', lastTrain: '17262', lastCoach: '/' }
                    ]
                  },
                  {
                    slotId: 15,
                    page: 127,
                    firstTrain: '12734',
                    lastTrain: '17262',
                    links: [
                      { categoryId: 2, linkNum: 39, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 16,
                    page: 127,
                    firstTrain: '17243',
                    lastTrain: '17244',
                    links: [
                      { categoryId: 2, linkNum: 43, firstCoach: 'AC+SL', lastCoach: 'AC+SL' },
                      { categoryId: 2, linkNum: 57, firstCoach: 'SL', lastCoach: 'SL' }
                    ]
                  },
                  {
                    slotId: 17,
                    page: 127,
                    firstTrain: '17637',
                    lastTrain: '17638',
                    links: [
                      { categoryId: 2, linkNum: 60, firstCoach: 'AC+SL', lastCoach: 'AC+SL' }
                    ]
                  }
                ];

                // Map active worked duties for each slot in MASTER_DAILY_SLOTS
                const activeSlotRows = [];
                const assignedStaffIds = new Set();

                MASTER_DAILY_SLOTS.forEach(slot => {
                  const dutiesInSlot = [];
                  slot.links.forEach(lDef => {
                    // Find staff assigned to this link on selectedDate
                    const staffDuty = staffDuties.find(d => 
                      parseInt(d.categoryId, 10) === parseInt(lDef.categoryId, 10) && 
                      parseInt(d.link_number, 10) === parseInt(lDef.linkNum, 10)
                    );

                    if (staffDuty) {
                      assignedStaffIds.add(staffDuty.staffId);
                      const isApprovedLeave = leaveRequests.some(l => 
                        String(l.staff_id) === String(staffDuty.staffId) && 
                        l.date === selectedDate && 
                        l.status === 'APPROVED' &&
                        l.type === 'LEAVE'
                      );

                      dutiesInSlot.push({
                        ...staffDuty,
                        firstTrain: slot.firstTrain,
                        firstCoaches: lDef.firstCoach,
                        lastTrain: lDef.lastTrain || slot.lastTrain,
                        lastCoaches: lDef.lastCoach || slot.lastCoach || '-',
                        isLeave: isApprovedLeave
                      });
                    }
                  });

                  if (dutiesInSlot.length > 0) {
                    activeSlotRows.push({
                      slotId: slot.slotId,
                      page: slot.page,
                      firstTrain: slot.firstTrain,
                      duties: dutiesInSlot
                    });
                  }
                });

                // Off duties: staff on REST or approved LEAVE or not assigned to an active slot
                const offDuties = staffDuties.filter(d => {
                  const isApprovedLeave = leaveRequests.some(l => 
                    String(l.staff_id) === String(d.staffId) && 
                    l.date === selectedDate && 
                    l.status === 'APPROVED' &&
                    l.type === 'LEAVE'
                  );
                  return d.isRest || isApprovedLeave || !assignedStaffIds.has(d.staffId);
                }).map(d => ({
                  ...d,
                  isLeave: leaveRequests.some(l => 
                    String(l.staff_id) === String(d.staffId) && 
                    l.date === selectedDate && 
                    l.status === 'APPROVED' &&
                    l.type === 'LEAVE'
                  )
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
                          Selected Date: <strong>{new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })}</strong>
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={() => {
                          if (activeSlotRows.length === 0 && offDuties.length === 0) return;
                          let csv = 'Employee Name,Designation,Link No,Status,Train Number (Day 1),Coaches (Day 1),Train Number (Last Day),Coaches (Last Day)\n';
                          
                          // Write active duties
                          activeSlotRows.forEach(g => {
                            g.duties.forEach(d => {
                              csv += `"${d.name}","${d.designation || '-'}","${getLinkDisplayLabel(d.categoryId, d.link_number)}","ACTIVE","${g.firstTrain}","${d.firstCoaches}","${d.lastTrain}","${d.lastCoaches}"\n`;
                            });
                          });

                          // Write off duties
                          offDuties.forEach(d => {
                            csv += `"${d.name}","${d.designation || '-'}","${d.isLeave ? 'LEAVE' : 'REST'}","${d.isLeave ? 'LEAVE' : 'REST'}","-","-","-","-"\n`;
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

                    {/* Table View */}
                    <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
                      <table className="roster-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>S.No</th>
                            <th style={{ width: '220px' }}>Employee Name</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Link No</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Train Number (Day 1)</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Coaches (Day 1)</th>
                            <th style={{ width: '160px', textAlign: 'center' }}>Train Number (Last Day)</th>
                            <th style={{ textAlign: 'center' }}>Coaches (Last Day)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSlotRows.map((group, groupIndex) => {
                            return (
                              <tr key={groupIndex} style={{ borderBottom: '2px solid var(--border-glass)' }}>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--color-text-secondary)' }}>
                                    {groupIndex + 1}
                                  </td>
                                  <td style={{ padding: '0px' }}>
                                    {group.duties.map((d, dIdx) => (
                                      <div key={d.staffId} style={{ 
                                        padding: '12px 16px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '44px',
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}>
                                        <strong>{d.name}</strong>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginLeft: '8px' }}>
                                          ({d.designation || '-'})
                                        </span>
                                        {d.isOverridden && (
                                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', marginLeft: '8px', fontSize: '0.7rem', padding: '2px 6px' }}>
                                            OVR
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </td>
                                  <td style={{ padding: '0px', textAlign: 'center' }}>
                                    {group.duties.map((d, dIdx) => {
                                      return (
                                        <div key={d.staffId} style={{ 
                                          padding: '12px 8px', 
                                          borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                          minHeight: '44px',
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
                                      <div key={d.staffId} style={{ 
                                        padding: '12px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '44px',
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
                                      <div key={d.staffId} style={{ 
                                        padding: '12px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '44px',
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
                                      <div key={d.staffId} style={{ 
                                        padding: '12px 8px', 
                                        borderBottom: dIdx < group.duties.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                        minHeight: '44px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {d.lastCoaches}
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                            );
                          })}
                          {activeSlotRows.length === 0 && (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                No active worked duties found for this date.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Off Duties Section (Rest & Leaves) */}
                    <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
                      <div className="card-title" style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 'bold' }}>😴 Weekly Rest & Leave Staff</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {offDuties.map(d => {
                          const badgeBg = d.isLeave ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.15)';
                          const badgeColor = d.isLeave ? '#ef4444' : '#9ca3af';
                          return (
                            <div key={d.staffId} style={{ 
                              padding: '10px 14px', 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--border-glass)', 
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <strong style={{ fontSize: '0.9rem' }}>{d.name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.designation || '-'}</div>
                              </div>
                              <span style={{ 
                                fontWeight: 700, 
                                borderRadius: '4px', 
                                padding: '2px 8px', 
                                fontSize: '0.75rem',
                                background: badgeBg,
                                color: badgeColor
                              }}>
                                {d.isLeave ? 'LEAVE' : 'REST'}
                              </span>
                            </div>
                          );
                        })}
                        {offDuties.length === 0 && (
                          <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>No rest or leave staff for today.</div>
                        )}
                      </div>
                    </div>
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
                <div className="alert-banner">
                  <span>📅</span> 
                  Anchor date: <strong>{rosterData.category.anchor_date}</strong> | 
                  Cycle Length: <strong>{rosterData.category.cycle_length} links</strong>.
                  {isAdmin ? ' Click any cell to manually override it.' : ' 🔒 View-Only Mode: Logged in as Staff/Viewer (Editing is restricted to Master Admin).'}
                </div>

                <div className="roster-grid-container">
                  <table className="roster-table">
                    <thead>
                      <tr className="header-days">
                        <th className="freeze-col" style={{ left: '0px', width: '60px', minWidth: '60px', maxWidth: '60px', top: 0 }}>SL NO</th>
                        <th className="freeze-col" style={{ left: '60px', width: '160px', minWidth: '160px', maxWidth: '160px', top: 0 }}>NAME</th>
                        <th className="freeze-col" style={{ left: '220px', width: '80px', minWidth: '80px', maxWidth: '80px', top: 0 }}>DESG</th>
                        {rosterData.dates.map((d, i) => (
                          <th key={i}>{d.dayOfWeek}</th>
                        ))}
                      </tr>
                      <tr className="header-dates">
                        <th className="freeze-col" style={{ left: '0px', width: '60px', minWidth: '60px', maxWidth: '60px' }}></th>
                        <th className="freeze-col" style={{ left: '60px', width: '160px', minWidth: '160px', maxWidth: '160px' }}></th>
                        <th className="freeze-col" style={{ left: '220px', width: '80px', minWidth: '80px', maxWidth: '80px' }}></th>
                        {rosterData.dates.map((d, i) => (
                          <th key={i}>{d.dayOfMonth}</th>
                        ))}
                      </tr>
                      <tr className="header-offsets">
                        <th className="freeze-col" style={{ left: '0px', width: '60px', minWidth: '60px', maxWidth: '60px' }}>Day Offset</th>
                        <th className="freeze-col" style={{ left: '60px', width: '160px', minWidth: '160px', maxWidth: '160px' }}></th>
                        <th className="freeze-col" style={{ left: '220px', width: '80px', minWidth: '80px', maxWidth: '80px' }}></th>
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
                        });

                        return sortedRows.map((row, rIdx) => {
                          const isVacantRow = row.staffName === '(VACANT)';
                          return (
                            <tr key={row.staffId}>
                              <td className="freeze-col" style={{ left: '0px', width: '60px', minWidth: '60px', maxWidth: '60px' }}>{rIdx + 1}</td>
                              <td className="freeze-col" style={{ left: '60px', width: '160px', minWidth: '160px', maxWidth: '160px' }}><strong>{row.staffName || '(VACANT)'}</strong></td>
                              <td className="freeze-col" style={{ left: '220px', width: '80px', minWidth: '80px', maxWidth: '80px', color: 'var(--color-text-secondary)' }}>{row.designation || '-'}</td>
                              {row.cells.map((cell, cIdx) => {
                                const key = `${row.staffId}_${cIdx}`;
                                return (
                                  <td 
                                    key={cIdx} 
                                    className={isVacantRow ? 'roster-cell' : getCellClass(cell)}
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
                                    {isVacantRow ? '' : getCellLabel(cell)}
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
                    {hoveredCell.data.isRest ? (
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
              const nums = parseTrainNumbers(link.train_numbers);
              nums.forEach(num => {
                trainRosterItems.push({
                  trainNumber: num,
                  linkNumber: link.link_number,
                  linkId: link.id,
                  coaches: link.coaches,
                  linkObj: link
                });
              });
            });

            trainRosterItems.sort((a, b) => a.linkNumber - b.linkNumber);

            return (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🚆 Train-Centric Roster</h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                      List of all train numbers and their mapped link numbers in the roster database.
                    </p>
                  </div>
                  {isAdmin && (
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
                      ➕ Add New Link
                    </button>
                  )}
                </div>

                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Train Number</th>
                        <th>Link Number</th>
                        <th>Coaches</th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {trainRosterItems.map((item, idx) => (
                          <tr key={`${item.trainNumber}_${idx}`}>
                            <td><strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{item.trainNumber}</strong></td>
                            <td>
                              <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 700 }}>
                                Link #{item.linkNumber}
                              </span>
                            </td>
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
                                      effective_from: item.linkObj.effective_from
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
                      ))}
                    </tbody>
                  </table>
                </div>
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

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {isAdmin && (
                <form className="card" style={{ flex: '1', maxWidth: '380px' }} onSubmit={saveStaff}>
                  <div className="card-title">
                    {editingStaff ? `Edit Seniority SL NO ${editingStaff.row_position}` : 'Add Staff Member'}
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
                      placeholder="e.g. CTI, TTI"
                      value={staffForm.designation}
                      onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                    />
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
                          setStaffForm({ name: '', designation: '', row_position: '' });
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
                      <th>Active Status</th>
                      {isAdmin && <th>Reorder Seniority</th>}
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((person, idx) => (
                      <tr key={person.id}>
                        <td><strong>{person.row_position}</strong></td>
                        <td>
                          {person.name === '(VACANT)' ? (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>(VACANT Slot)</span>
                          ) : person.name}
                        </td>
                        <td>{person.designation || '-'}</td>
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
                              disabled={idx === staffList.length - 1}
                              onClick={() => moveStaffRow(person.id, 'down')}
                            >
                              ▼ Down
                            </button>
                          </td>
                        )}
                        {isAdmin && (
                          <td>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                              onClick={() => {
                                setEditingStaff(person);
                                setStaffForm({
                                  name: person.name,
                                  designation: person.designation || '',
                                  row_position: person.row_position.toString()
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
                    ))}
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

                <div className="form-group">
                  <label className="form-label">Date:</label>
                  <input 
                    type="date" required className="form-input"
                    value={leaveForm.date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
                  />
                </div>

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
                      <th>Date</th>
                      <th>Details / Swapper</th>
                      <th>Status</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((req) => (
                      <tr key={req.id}>
                        <td><strong>{req.staff_name}</strong></td>
                        <td>
                          <span className={`badge ${req.type === 'LEAVE' ? 'badge-rejected' : 'badge-approved'}`}>
                            {req.type}
                          </span>
                        </td>
                        <td>{req.date}</td>
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
                    ))}
                    {leaveRequests.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
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
            TAB 6: LOOKUPS & REPORTS
            ---------------------------------------------------- */}
        {activeTab === 'lookups' && (
          <div>
            <form className="filters-panel" onSubmit={runLookup} style={{ justifyContent: 'flex-start', gap: '24px' }}>
              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Query Type:</label>
                <select 
                  className="select-input"
                  value={lookupType}
                  onChange={(e) => {
                    setLookupType(e.target.value);
                    setLookupResults(null);
                  }}
                >
                  <option value="who">Who is working Link X on Date Y?</option>
                  <option value="what">What is Person Z working on Date Y?</option>
                </select>
              </div>

              {lookupType === 'who' && (
                <div className="filter-group">
                  <label className="form-label" style={{ marginBottom: 0 }}>Link Number:</label>
                  <input 
                    type="number" required className="select-input" style={{ width: '80px', minWidth: 'auto' }}
                    value={lookupLink}
                    onChange={(e) => setLookupLink(e.target.value)}
                  />
                </div>
              )}

              {lookupType === 'what' && (
                <div className="filter-group">
                  <label className="form-label" style={{ marginBottom: 0 }}>Person:</label>
                  <select 
                    className="select-input" required
                    value={lookupStaffId}
                    onChange={(e) => setLookupStaffId(e.target.value)}
                  >
                    <option value="">-- Select Person --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="filter-group">
                <label className="form-label" style={{ marginBottom: 0 }}>Date:</label>
                <input 
                  type="date" required className="select-input"
                  value={lookupDate}
                  onChange={(e) => setLookupDate(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Run Query
              </button>
            </form>

            {lookupResults && (
              <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-title">Query Output Details</div>
                
                {lookupType === 'who' && (
                  <div>
                    <p style={{ marginBottom: '16px' }}>
                      On <strong>{lookupResults.date}</strong>, the following staff members are assigned to <strong>Link #{lookupResults.link_number}</strong>:
                    </p>
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Seniority SL NO</th>
                            <th>Name</th>
                            <th>Designation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lookupResults.matches.map(person => (
                            <tr key={person.id}>
                              <td>{person.row_position}</td>
                              <td><strong>{person.name}</strong></td>
                              <td>{person.designation || '-'}</td>
                            </tr>
                          ))}
                          {lookupResults.matches.length === 0 && (
                            <tr>
                              <td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                No staff member is assigned to this link on this date.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {lookupType === 'what' && (
                  <div style={{ fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p>
                      Staff Member: <strong>{lookupResults.staff.name} ({lookupResults.staff.designation || 'VACANT'})</strong>
                    </p>
                    <p>
                      Date: <strong>{lookupResults.date}</strong>
                    </p>
                    <div 
                      style={{ 
                        padding: '16px', 
                        borderRadius: '12px', 
                        background: lookupResults.isRest ? 'var(--rest-bg)' : 'var(--primary-glow)',
                        border: `1px solid ${lookupResults.isRest ? 'var(--border-glass)' : 'var(--primary)'}`,
                        maxWidth: '400px'
                      }}
                    >
                      {lookupResults.isRest ? (
                        <strong style={{ color: 'var(--rest-color)', fontSize: '1.2rem' }}>REST turn (Off Duty)</strong>
                      ) : (
                        <>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                            Link #{lookupResults.link_number}
                          </div>
                          <div>Train(s): <strong>{lookupResults.duty.train_numbers}</strong></div>
                          <div>Route: <strong>{lookupResults.duty.from_station || '-'} ➔ {lookupResults.duty.to_station || '-'}</strong></div>
                          <div>Coaches: <strong>{lookupResults.duty.coaches || '-'}</strong></div>
                        </>
                      )}
                    </div>
                    {lookupResults.isOverridden && (
                      <div style={{ color: 'var(--override-color)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        ⚠️ This assignment has been manually overridden: "{lookupResults.overrideReason}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 6.5: DAILY DUTY REGISTER (GROUND-TRUTH LOG)
            ---------------------------------------------------- */}
        {activeTab === 'register' && (
          <div>
            <div className="alert-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📝 <strong>Daily Duty Register</strong> — Manage physical log inputs, reconcile predictions against actual logs, and export/print compliance reports.</span>
            </div>

            {/* Sub-tab Navigation */}
            <div className="subtabs-nav" style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <button 
                type="button"
                className={`btn ${subTab === 'entry' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSubTab('entry')}
              >
                ✏️ Register Entry
              </button>
              <button 
                type="button"
                className={`btn ${subTab === 'reco' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setSubTab('reco'); fetchReconciliation(); }}
              >
                🔄 Reconciliation
              </button>
              <button 
                type="button"
                className={`btn ${subTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setSubTab('history'); fetchHistory(); }}
              >
                📜 History & Reports
              </button>
            </div>

            {/* Sub-Tab 1: Register Entry Form */}
            {subTab === 'entry' && (
              <form onSubmit={saveRegister} className="card" style={{ marginTop: '16px' }}>
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
                    <span><strong>Official Duty Register is Read-Only:</strong> Logged in as Staff/Viewer. Only Master Administrators can enter, edit, or commit daily duty registers.</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ minWidth: '200px' }}>
                    <label className="form-label">Ledger Date:</label>
                    <input 
                      type="date"
                      className="form-input"
                      value={registerDate}
                      onChange={(e) => setRegisterDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ minWidth: '150px' }}>
                    <label className="form-label">Page Number:</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={registerPageNumber}
                      disabled={!isAdmin}
                      onChange={(e) => setRegisterPageNumber(e.target.value)}
                      placeholder="e.g. 42"
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => fetchRegisterForDate(registerDate)}
                    style={{ height: '40px' }}
                  >
                    🔄 Reload Date
                  </button>
                  {isAdmin && (
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (confirm(`Are you sure you want to pre-populate the register for ${registerDate}? This will overwrite any existing entries for this date.`)) {
                          fetch(`${API_BASE}/duty-register/populate-from-roster`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({ date: registerDate })
                          }).then(() => fetchRegisterForDate(registerDate));
                        }
                      }}
                      style={{ height: '40px' }}
                    >
                      📋 Pre-populate from Roster
                    </button>
                  )}
                </div>

                <div className="data-table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Name(s)</th>
                        <th style={{ width: '12%' }}>Train No. (Out)</th>
                        <th style={{ width: '12%' }}>Coach (Out)</th>
                        <th style={{ width: '12%' }}>Train No. (Return)</th>
                        <th style={{ width: '12%' }}>Coach (Return)</th>
                        <th style={{ width: '12%' }}>Duty Label</th>
                        <th style={{ width: '15%' }}>Notes</th>
                        {isAdmin && <th style={{ width: '10%' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {registerEntries.map((row, index) => {
                        const warnings = getRowWarnings(row);
                        return (
                          <React.Fragment key={index}>
                            <tr>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {row.staff_ids.map(id => {
                                      const staff = allStaffList.find(s => s.id === id);
                                      if (!staff) return null;
                                      const cat = categories.find(c => c.id === staff.category_id);
                                      return (
                                        <span 
                                          key={id} 
                                          className="badge"
                                          style={{ 
                                            background: 'var(--primary-glow)', 
                                            color: 'var(--primary)',
                                            border: '1px solid var(--primary)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem'
                                          }}
                                        >
                                          {staff.name} ({cat ? cat.code : ''})
                                          {isAdmin && (
                                            <span 
                                              style={{ cursor: 'pointer', fontWeight: 'bold' }}
                                              onClick={() => {
                                                const updated = [...registerEntries];
                                                updated[index].staff_ids = updated[index].staff_ids.filter(sid => sid !== id);
                                                setRegisterEntries(updated);
                                              }}
                                            >
                                              ×
                                            </span>
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>
                                  {isAdmin && (
                                    <input 
                                      type="text"
                                      className="form-input"
                                      placeholder="Type name to add..."
                                      style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                      onChange={(e) => {
                                        const val = e.target.value.toLowerCase();
                                        const updated = [...registerEntries];
                                        if (!val) {
                                          delete updated[index]._search;
                                        } else {
                                          updated[index]._search = val;
                                        }
                                        setRegisterEntries(updated);
                                      }}
                                      value={row._search || ''}
                                    />
                                  )}
                                  {isAdmin && row._search && (
                                    <div 
                                      style={{ 
                                        position: 'absolute', 
                                        zIndex: 10, 
                                        background: 'var(--card-bg)', 
                                        border: '1px solid var(--border-glass)',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        marginTop: '35px',
                                        width: '250px'
                                      }}
                                    >
                                      {allStaffList
                                        .filter(s => s.name.toLowerCase().includes(row._search) && !row.staff_ids.includes(s.id))
                                        .map(s => {
                                          const cat = categories.find(c => c.id === s.category_id);
                                          return (
                                            <div 
                                              key={s.id}
                                              style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                              onClick={() => {
                                                const updated = [...registerEntries];
                                                updated[index].staff_ids.push(s.id);
                                                updated[index]._search = '';
                                                setRegisterEntries(updated);
                                              }}
                                              className="hover-highlight"
                                            >
                                              {s.name} ({cat ? cat.code : ''})
                                            </div>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.train_out}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].train_out = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Out Train"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.coach_out}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].coach_out = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Out Coach"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.train_return}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].train_return = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Return Train"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.coach_return}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].coach_return = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Return Coach"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.duty_label}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].duty_label = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Label"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" className="form-input" style={{ padding: '6px' }}
                                  value={row.notes}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    const updated = [...registerEntries];
                                    updated[index].notes = e.target.value;
                                    setRegisterEntries(updated);
                                  }}
                                  placeholder="Notes"
                                />
                              </td>
                              {isAdmin && (
                                <td>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {index > 0 && (
                                      <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          const prev = registerEntries[index - 1];
                                          const updated = [...registerEntries];
                                          updated[index].train_out = prev.train_out;
                                          updated[index].coach_out = prev.coach_out;
                                          updated[index].train_return = prev.train_return;
                                          updated[index].coach_return = prev.coach_return;
                                          updated[index].duty_label = prev.duty_label;
                                          setRegisterEntries(updated);
                                        }}
                                      >
                                        Ditto
                                      </button>
                                    )}
                                    <button 
                                      type="button" 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.2)' }}
                                      onClick={() => {
                                        const updated = registerEntries.filter((_, i) => i !== index);
                                        setRegisterEntries(updated.length === 0 ? [{ staff_ids: [], train_out: '', coach_out: '', train_return: '', coach_return: '', duty_label: '', notes: '' }] : updated);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                            {warnings.length > 0 && (
                              <tr style={{ background: 'rgba(255, 165, 0, 0.05)' }}>
                                <td colSpan={isAdmin ? "8" : "7"} style={{ color: 'orange', padding: '6px 12px', fontSize: '0.85rem' }}>
                                  ⚠️ {warnings.join(' | ')}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => setRegisterEntries([...registerEntries, { staff_ids: [], train_out: '', coach_out: '', train_return: '', coach_return: '', duty_label: '', notes: '' }])}
                    >
                      ➕ Add Entry Row
                    </button>
                    <button type="submit" className="btn btn-primary">
                      💾 Save Register Page
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Sub-Tab 2: Reconciliation */}
            {subTab === 'reco' && renderReconciliationTab()}

            {/* Sub-Tab 3: History & Reports */}
            {subTab === 'history' && renderHistoryTab()}
          </div>
        )}

        {/* Printable Ledger Layout (Hidden during screen display) */}
        {printDate && (
          <div className="print-ledger-container print-only" style={{ color: '#000', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#000' }}>DAILY DUTY REGISTER</h2>
              <div style={{ textAlign: 'right', color: '#000' }}>
                <div>Date: <strong>{printDate}</strong></div>
                {printPageNum && <div>Page Number: <strong>{printPageNum}</strong></div>}
              </div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000' }} className="print-table">
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Name(s)</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Train No. (Out)</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Coach (Out)</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Train No. (Return)</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Coach (Return)</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Duty Label</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {printEntries.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      {row.staff.map(s => <div key={s.id} style={{ fontWeight: 'bold' }}>{s.name}</div>)}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.train_out || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.coach_out || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.train_return || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.coach_return || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.duty_label || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>{row.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 7: AUDIT LOGS
            ---------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div>
            <div className="card-title" style={{ marginBottom: '16px' }}>System Audit Trail & History</div>
            
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>User Role</th>
                    <th>Action Type</th>
                    <th>Description / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{log.timestamp}</td>
                      <td>
                        <span className="badge badge-approved" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-primary)' }}>
                          {log.user_role}
                        </span>
                      </td>
                      <td><strong>{log.action_type}</strong></td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
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
      </div>

      {/* Shared Edit Overrides Modal */}
        {selectedCell && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={submitOverride}>
              <div className="modal-header">
                <h2 className="modal-title">Manual Duty Override</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Applying override for <strong>{selectedCell.staffName}</strong> on {selectedCell.date}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Link Number (leave blank for REST):</label>
                <input 
                  type="number"
                  className="form-input"
                  value={overrideLinkNum}
                  onChange={(e) => setOverrideLinkNum(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Notes:</label>
                <input 
                  type="text"
                  required
                  className="form-input"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Sick leave replacement"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedCell(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Override
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <DemoBar 
        currentUser={currentUser}
        device={device}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
        detectedPlatform={detectedPlatform}
        onSwitchPersona={handleSwitchPersona}
        onRunScenario={handleRunScenario}
        isMobileSimulated={isMobileSimulated}
        onToggleMobileSimulated={() => setIsMobileSimulated(!isMobileSimulated)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        categories={categories}
        selectedCatId={selectedCatId}
        setSelectedCatId={setSelectedCatId}
      />
      {isMobileSimulated ? (
        <div className="mobile-simulator-wrapper">
          <div className="mobile-phone-frame">
            <div className="mobile-phone-speaker"></div>
            <div className="mobile-phone-screen">
              {renderAppContent()}
            </div>
          </div>
        </div>
      ) : (
        renderAppContent()
      )}
    </div>
  );
}
