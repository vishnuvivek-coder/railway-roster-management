/**
 * TypeScript definitions for Railway Roster Manager
 */

export interface Staff {
  id: number;
  name: string;
  pf_number?: string | null;
  hrms_id?: string | null;
  designation?: string | null;
  category_id: number;
  row_position: number;
  rest_day?: string | null;
  phone?: string | null;
  email?: string | null;
  station?: string | null;
  is_active?: number;
  cr_count?: number;
  cr_due_dates?: string[];
}

export interface Category {
  id: number;
  name: string;
  code?: string;
  anchor_date: string;
  cycle_length: number;
  description?: string;
}

export interface LinkDef {
  id?: number;
  category_id: number;
  link_number: number;
  train_numbers?: string | null;
  from_station?: string | null;
  to_station?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  is_rest?: number;
  set_type?: string | null;
  link_set_id?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export type LeaveTypeCode = 
  | 'CL' 
  | 'LAP' 
  | 'LHAP' 
  | 'SCL' 
  | 'OD' 
  | 'CCL' 
  | 'CR' 
  | 'NH' 
  | 'REST' 
  | 'SICK' 
  | 'ABSENT';

export type DutyStatus = 
  | 'DUTY'
  | 'REST'
  | 'LEAVE'
  | 'SICK'
  | 'CR'
  | 'ABSENT'
  | 'CHANGED_LINK'
  | 'SUBSTITUTE'
  | 'EXTRA_CREW'
  | 'AVAILABLE_FOR_BOOKING'
  | 'UTILISED_ADVANCE'
  | 'MARK_LATER'
  | 'SHIFTED';

export interface OverrideRecord {
  id?: number;
  staff_id: number;
  date: string;
  original_link_number?: number | null;
  overridden_link_number?: number | null;
  status: DutyStatus;
  substitute_staff_id?: number | null;
  substitute_name?: string | null;
  reason?: string | null;
  target_category_id?: number | null;
  leave_type?: string | null;
  is_extra?: number;
  extra_train_no?: string | null;
  is_advance_duty?: number;
  advance_train_no?: string | null;
  shifted_from_link?: number | null;
  shifted_from_train?: string | null;
  shifted_place?: string | null;
}

export interface MusterRecord {
  id?: number;
  staff_id: number;
  date: string;
  code: string;
  remarks?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface TaApprovalRecord {
  id?: number;
  staff_id: number;
  staff_name?: string;
  duty_date: string;
  date_str?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rate?: number;
  percentage?: number;
  amount?: number;
  train_number?: string;
  departure_time?: string;
  arrival_time?: string;
  from_station?: string;
  to_station?: string;
  remarks?: string | null;
}

export interface DutyItem {
  dutyKey?: string;
  slotId?: string | number;
  staffId: number | string | null;
  id?: number | string;
  name: string;
  staffName?: string;
  designation?: string;
  categoryId: number;
  target_category_id?: number | null;
  link_number?: number | null;
  actualLinkNumber?: number | null;
  original_link_number?: number | null;
  calculatedLinkNumber?: number | null;
  train_numbers?: string;
  firstTrain?: string;
  firstCoaches?: string;
  lastTrain?: string;
  lastCoaches?: string;
  status?: DutyStatus | string;
  isVacant?: boolean;
  isVacantUpgrade?: boolean;
  isVacantShifted?: boolean;
  isVacantAdvance?: boolean;
  isVacantAvailableReturn?: boolean;
  isVacantMarkLater?: boolean;
  isRest?: boolean;
  isRestLink?: boolean;
  isLeave?: boolean;
  isSick?: boolean;
  isCr?: boolean;
  isOverridden?: boolean;
  isUpgraded?: boolean;
  substituteStaffId?: number | null;
  substituteName?: string | null;
  originalStaffId?: number | null;
  originalStaffName?: string | null;
  originalStaffStatus?: string | null;
  overrideReason?: string | null;
  advance_train_no?: string | null;
  advanceTrainNo?: string | null;
  cr_available?: number;
  lr_rest_info?: string | null;
}

export interface DutyEditModalProps {
  dutyModal: {
    staffId: number | string | null;
    originalStaffId?: number | string | null;
    shiftedStaffId?: number | string | null;
    advanceStaffId?: number | string | null;
    originalStaffName?: string | null;
    name?: string;
    designation?: string;
    categoryId?: number;
    categoryName?: string;
    target_category_id?: number | null;
    targetCategoryId?: number | null;
    link_number?: number | string | null;
    currentLink?: number | string | null;
    originalLink?: number | string | null;
    date?: string;
    train_numbers?: string;
    firstTrain?: string;
    lastTrain?: string;
    firstCoaches?: string;
    lastCoaches?: string;
    status?: DutyStatus | string;
    leave_type?: string | null;
    overrideReason?: string | null;
    isVacant?: boolean;
    isVacantAdvance?: boolean;
    isVacantUpgrade?: boolean;
    isVacantShifted?: boolean;
    isMarkLater?: boolean;
    initialMode?: 'DELETE' | 'ASSIGN_DUTY' | 'ASSIGN_DAILY' | 'REPLACE_STAFF';
  };
  categories: Category[];
  allStaffList: Staff[];
  allLinksList: LinkDef[];
  nonDailyList?: any[];
  dailyDuties?: any[];
  authToken?: string | null;
  isAdmin?: boolean;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
}

export interface AvailabilitySheetProps {
  isAdmin?: boolean;
  openDutyEditModal: (staffDuty: Partial<DutyItem>, dateStr?: string) => void;
}
