-- ============================================================================
-- RAILWAY STAFF ROSTER & CREW LOGISTICS MANAGEMENT SYSTEM
-- COMPLETE MYSQL 8.0 DEDICATED DATABASE DDL SCHEMA
-- ============================================================================

-- Disable foreign key checks during batch table creation
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE (Authentication & Role Verification)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(191) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) DEFAULT NULL,
  role ENUM('Admin', 'Staff', 'Viewer', 'Employee') NOT NULL DEFAULT 'Employee',
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  staff_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME DEFAULT NULL,
  approved_by VARCHAR(255) DEFAULT NULL,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  cycle_length INT NOT NULL,
  anchor_date DATE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. LINK SETS TABLE (Draft vs Published Schedules)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS link_sets (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'published',
  effective_from DATE DEFAULT NULL,
  effective_to DATE DEFAULT '9999-12-31',
  cloned_from_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_link_sets_category (category_id),
  INDEX idx_link_sets_status (status),
  CONSTRAINT fk_link_sets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. LINKS TABLE (Base Link Rotations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  link_set_id INT DEFAULT NULL,
  link_number INT NOT NULL,
  train_numbers VARCHAR(255) DEFAULT NULL,
  from_station VARCHAR(255) DEFAULT NULL,
  to_station VARCHAR(255) DEFAULT NULL,
  coaches VARCHAR(255) DEFAULT NULL,
  is_rest TINYINT(1) DEFAULT 0,
  effective_from DATE DEFAULT '2026-08-01',
  effective_to DATE DEFAULT '9999-12-31',
  set_type VARCHAR(100) DEFAULT '2-Day Set',
  set_name VARCHAR(255) DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'published',
  INDEX idx_links_cat_num (category_id, link_number),
  INDEX idx_links_set (link_set_id),
  CONSTRAINT fk_links_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_links_set FOREIGN KEY (link_set_id) REFERENCES link_sets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. SLOT CUSTOMIZATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slot_customizations (
  custom_key VARCHAR(191) NOT NULL PRIMARY KEY,
  first_train VARCHAR(100) DEFAULT NULL,
  last_train VARCHAR(100) DEFAULT NULL,
  first_coach VARCHAR(100) DEFAULT NULL,
  last_coach VARCHAR(100) DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. STAFF TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(100) DEFAULT NULL,
  category_id INT DEFAULT NULL,
  row_position INT NOT NULL,
  active TINYINT(1) DEFAULT 1,
  rest_day VARCHAR(20) DEFAULT NULL,
  pf_no VARCHAR(50) DEFAULT NULL,
  seniority_no INT DEFAULT NULL,
  join_date VARCHAR(50) DEFAULT '2026-07-01',
  leave_date VARCHAR(50) DEFAULT NULL,
  bill_unit VARCHAR(50) DEFAULT NULL,
  pay_amount INT DEFAULT 68000,
  doa VARCHAR(50) DEFAULT NULL,
  hq_station VARCHAR(50) DEFAULT 'GNT',
  t_code_no VARCHAR(50) DEFAULT '7133',
  hrms_id VARCHAR(50) DEFAULT '',
  INDEX idx_staff_category (category_id),
  INDEX idx_staff_row_pos (row_position),
  CONSTRAINT fk_staff_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. OVERRIDES TABLE (Daily Movement & Duty Swaps)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS overrides (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  date DATE NOT NULL,
  original_link_number INT DEFAULT NULL,
  overridden_link_number INT DEFAULT NULL,
  reason VARCHAR(255) NOT NULL,
  created_by VARCHAR(100) DEFAULT 'Admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'DUTY',
  substitute_staff_id INT DEFAULT NULL,
  substitute_name VARCHAR(255) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT NULL,
  to_station VARCHAR(100) DEFAULT NULL,
  train_out VARCHAR(100) DEFAULT NULL,
  coach_out VARCHAR(100) DEFAULT NULL,
  train_return VARCHAR(100) DEFAULT NULL,
  coach_return VARCHAR(100) DEFAULT NULL,
  duty_label VARCHAR(255) DEFAULT NULL,
  duty_type VARCHAR(100) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  leave_type VARCHAR(50) DEFAULT NULL,
  advance_train_no VARCHAR(100) DEFAULT NULL,
  is_advance_duty TINYINT(1) DEFAULT 0,
  target_category_id INT DEFAULT NULL,
  shifted_place VARCHAR(100) DEFAULT NULL,
  extra_train_no VARCHAR(100) DEFAULT NULL,
  is_extra TINYINT(1) DEFAULT 0,
  shifted_from_link INT DEFAULT NULL,
  shifted_from_train VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY uq_overrides_staff_date (staff_id, date),
  INDEX idx_overrides_date (date),
  CONSTRAINT fk_overrides_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. LEAVE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  date DATE NOT NULL,
  from_date DATE DEFAULT NULL,
  to_date DATE DEFAULT NULL,
  type VARCHAR(50) NOT NULL,
  swap_staff_id INT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  reason TEXT DEFAULT NULL,
  approved_by VARCHAR(100) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  INDEX idx_leave_staff (staff_id),
  INDEX idx_leave_date (date),
  CONSTRAINT fk_leave_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_swap_staff FOREIGN KEY (swap_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_role VARCHAR(100) DEFAULT 'Admin',
  action_type VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  undo_data LONGTEXT DEFAULT NULL,
  is_undone INT DEFAULT 0,
  INDEX idx_audit_timestamp (timestamp),
  INDEX idx_audit_action (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. DUTY REGISTER ENTRY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duty_register_entry (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  page_number INT DEFAULT NULL,
  train_out VARCHAR(100) DEFAULT NULL,
  coach_out VARCHAR(100) DEFAULT NULL,
  train_return VARCHAR(100) DEFAULT NULL,
  coach_return VARCHAR(100) DEFAULT NULL,
  duty_label VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  INDEX idx_duty_reg_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. DUTY REGISTER STAFF TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duty_register_staff (
  entry_id INT NOT NULL,
  staff_id INT NOT NULL,
  PRIMARY KEY (entry_id, staff_id),
  CONSTRAINT fk_drs_entry FOREIGN KEY (entry_id) REFERENCES duty_register_entry(id) ON DELETE CASCADE,
  CONSTRAINT fk_drs_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. TA ENTRIES TABLE (Monthly TA Journal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ta_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  month_year VARCHAR(20) NOT NULL,
  duty_date DATE DEFAULT NULL,
  date_str VARCHAR(50) NOT NULL,
  train_no VARCHAR(100) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT NULL,
  to_station VARCHAR(100) DEFAULT NULL,
  dep_time VARCHAR(20) DEFAULT NULL,
  arr_time VARCHAR(20) DEFAULT NULL,
  ta_a1 VARCHAR(50) DEFAULT NULL,
  ta_a VARCHAR(50) DEFAULT NULL,
  ta_b1 VARCHAR(50) DEFAULT NULL,
  days_claiming_ta DOUBLE DEFAULT NULL,
  object_of_journey VARCHAR(255) DEFAULT 'MANNING AC COACHES',
  remarks VARCHAR(255) DEFAULT NULL,
  row_order INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ta_staff_month (staff_id, month_year),
  INDEX idx_ta_duty_date (duty_date),
  CONSTRAINT fk_ta_entries_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. NDA ENTRIES TABLE (Night Duty Allowance Journal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nda_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  month_year VARCHAR(20) NOT NULL,
  date_str VARCHAR(50) NOT NULL,
  train_no VARCHAR(100) DEFAULT NULL,
  sched_dep VARCHAR(20) DEFAULT NULL,
  sched_arr VARCHAR(20) DEFAULT NULL,
  act_dep VARCHAR(20) DEFAULT NULL,
  act_arr VARCHAR(20) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT NULL,
  to_station VARCHAR(100) DEFAULT NULL,
  night_hours DOUBLE DEFAULT NULL,
  row_order INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nda_staff_month (staff_id, month_year),
  CONSTRAINT fk_nda_entries_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. DIARY ENTRIES TABLE (EFT & Performance Journal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  month_year VARCHAR(20) NOT NULL,
  date_str VARCHAR(50) NOT NULL,
  train_no VARCHAR(100) DEFAULT NULL,
  dep_time VARCHAR(20) DEFAULT NULL,
  arr_time VARCHAR(20) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT NULL,
  to_station VARCHAR(100) DEFAULT NULL,
  eft_from VARCHAR(50) DEFAULT NULL,
  eft_to VARCHAR(50) DEFAULT NULL,
  total_issued INT DEFAULT NULL,
  no_of_cases INT DEFAULT NULL,
  collected_rs DOUBLE DEFAULT NULL,
  gst_cases INT DEFAULT NULL,
  gst_amount DOUBLE DEFAULT NULL,
  total_amount DOUBLE DEFAULT NULL,
  remit_station VARCHAR(50) DEFAULT NULL,
  remit_mr_no VARCHAR(50) DEFAULT NULL,
  remit_date VARCHAR(50) DEFAULT NULL,
  remit_amount DOUBLE DEFAULT NULL,
  row_order INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_diary_staff_month (staff_id, month_year),
  CONSTRAINT fk_diary_entries_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. ACTUAL TRAIN RUNS TABLE (NTES Train Punctuality Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actual_train_runs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  train_no VARCHAR(50) NOT NULL,
  run_date DATE NOT NULL,
  station_code VARCHAR(50) NOT NULL,
  sched_arr VARCHAR(20) DEFAULT NULL,
  sched_dep VARCHAR(20) DEFAULT NULL,
  act_arr VARCHAR(20) DEFAULT NULL,
  act_dep VARCHAR(20) DEFAULT NULL,
  delay_arr_mins INT DEFAULT 0,
  delay_dep_mins INT DEFAULT 0,
  source VARCHAR(50) DEFAULT 'NTES',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_train_run_station (train_no, run_date, station_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 16. MUSTER RECORDS TABLE (Monthly Attendance Register)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS muster_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  date DATE NOT NULL,
  code VARCHAR(50) NOT NULL,
  remarks VARCHAR(255) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT 'Admin',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_muster_staff_date (staff_id, date),
  INDEX idx_muster_date (date),
  CONSTRAINT fk_muster_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. DAILY EARNINGS ENTRIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_earnings_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  category_id INT DEFAULT NULL,
  staff_id INT NOT NULL,
  staff_name VARCHAR(255) NOT NULL,
  designation VARCHAR(100) DEFAULT 'TTI',
  depot_title VARCHAR(100) DEFAULT 'GNT ATY-1D2',
  twt_nc INT DEFAULT 0,
  twt_fare DOUBLE DEFAULT 0,
  twt_penalty DOUBLE DEFAULT 0,
  ir_nc INT DEFAULT 0,
  ir_fare DOUBLE DEFAULT 0,
  ir_penalty DOUBLE DEFAULT 0,
  ubl_nc INT DEFAULT 0,
  ubl_amt DOUBLE DEFAULT 0,
  gst DOUBLE DEFAULT 0,
  z652_nc INT DEFAULT 0,
  z652_amt DOUBLE DEFAULT 0,
  oc_nc INT DEFAULT 0,
  oc_amt DOUBLE DEFAULT 0,
  duty VARCHAR(100) DEFAULT NULL,
  remarks VARCHAR(255) DEFAULT NULL,
  row_order INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_earnings_date_staff (date, staff_id),
  INDEX idx_earnings_date (date),
  CONSTRAINT fk_earnings_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  CONSTRAINT fk_earnings_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 18. LR DUTY COMPLETIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lr_duty_completions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  last_train_no VARCHAR(100) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT '---',
  to_station VARCHAR(100) DEFAULT 'GNT',
  arrival_date DATE NOT NULL,
  arrival_time VARCHAR(20) NOT NULL,
  rest_hours_required INT DEFAULT 12,
  notes TEXT DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT 'Admin',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lr_completion (staff_id, arrival_date),
  CONSTRAINT fk_lr_completion_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 19. TRAIN TA NDA RULES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS train_ta_nda_rules (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  link_number INT NOT NULL,
  train_number VARCHAR(100) NOT NULL,
  ta_percentage DOUBLE DEFAULT 0.7,
  ta_amount INT DEFAULT 560,
  nda_hours DOUBLE DEFAULT 0,
  nda_amount INT DEFAULT 0,
  absence_hours DOUBLE DEFAULT 0,
  remarks VARCHAR(255) DEFAULT NULL,
  actual_arr_time VARCHAR(20) DEFAULT NULL,
  sched_arr_time VARCHAR(20) DEFAULT NULL,
  extra_next_day_ta DOUBLE DEFAULT 0,
  ntes_status VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT 'Admin',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ta_nda_rule (category_id, link_number, train_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 20. LR SHEET RECORDS TABLE (Leave Reserve Monthly Sheet)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lr_sheet_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  date DATE NOT NULL,
  duty_code VARCHAR(100) NOT NULL,
  remarks VARCHAR(255) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT 'Admin',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lr_sheet (staff_id, date),
  INDEX idx_lr_sheet_date (date),
  CONSTRAINT fk_lr_sheet_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 21. FEEDBACKS TABLE (Feedback & Grievance Reporting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedbacks (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'Staff',
  category VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  rating INT DEFAULT 5,
  contact_info VARCHAR(255) DEFAULT NULL,
  status ENUM('OPEN', 'RESOLVED') DEFAULT 'OPEN',
  admin_response TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feedbacks_status (status),
  INDEX idx_feedbacks_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 22. TA APPROVALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ta_approvals (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  month_year VARCHAR(20) NOT NULL,
  duty_date DATE NOT NULL,
  date_str VARCHAR(50) NOT NULL,
  link_number INT DEFAULT NULL,
  train_no VARCHAR(100) DEFAULT NULL,
  from_station VARCHAR(100) DEFAULT NULL,
  to_station VARCHAR(100) DEFAULT NULL,
  dep_time VARCHAR(20) DEFAULT NULL,
  arr_time VARCHAR(20) DEFAULT NULL,
  absence_hours DOUBLE DEFAULT NULL,
  ta_percentage DOUBLE DEFAULT NULL,
  da_rate DOUBLE DEFAULT 800,
  claim_amount DOUBLE DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  approved_by VARCHAR(100) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  rejection_reason VARCHAR(255) DEFAULT NULL,
  object_of_journey VARCHAR(255) DEFAULT 'MANNING AC COACHES',
  remarks VARCHAR(255) DEFAULT NULL,
  row_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ta_app_staff_month (staff_id, month_year),
  INDEX idx_ta_app_status (status),
  CONSTRAINT fk_ta_approvals_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 23. NON DAILY TRAINS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS non_daily_trains (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  day_of_week VARCHAR(50) NOT NULL,
  train_number VARCHAR(100) NOT NULL,
  last_day_train_number VARCHAR(100) DEFAULT NULL,
  departure_station VARCHAR(100) DEFAULT NULL,
  departure_time VARCHAR(20) DEFAULT NULL,
  arrival_station VARCHAR(100) DEFAULT NULL,
  arrival_time VARCHAR(20) DEFAULT NULL,
  coaches VARCHAR(100) DEFAULT 'SL / AC',
  last_day_coaches VARCHAR(100) DEFAULT 'SL / AC',
  remarks VARCHAR(255) DEFAULT NULL,
  assigned_staff_id INT DEFAULT NULL,
  assigned_staff_name VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_non_daily_day (day_of_week),
  CONSTRAINT fk_non_daily_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 24. SENIORITY LIST TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seniority_list (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sl_no INT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  cug_number VARCHAR(50) DEFAULT NULL,
  contact_number VARCHAR(50) DEFAULT NULL,
  pf_number VARCHAR(50) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  desg_rank INT DEFAULT NULL,
  hierarchy_tier INT DEFAULT NULL,
  working_designation VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seniority_sl (sl_no),
  INDEX idx_seniority_desg (designation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;
