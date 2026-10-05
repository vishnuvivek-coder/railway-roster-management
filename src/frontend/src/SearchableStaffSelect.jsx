import React from 'react';
import Select from 'react-select';

export const darkSelectStyles = {
  control: (base, state) => ({
    ...base,
    background: 'rgba(255, 255, 255, 0.05)',
    borderColor: state.isFocused ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    minHeight: '34px',
    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
    '&:hover': {
      borderColor: '#3b82f6'
    }
  }),
  menu: (base) => ({
    ...base,
    background: '#1e293b',
    border: '1px solid #334155',
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#3b82f6' : state.isFocused ? '#334155' : '#1e293b',
    color: '#f8fafc',
    cursor: 'pointer',
    '&:active': {
      background: '#2563eb'
    }
  }),
  singleValue: (base) => ({
    ...base,
    color: '#e2e8f0'
  }),
  input: (base) => ({
    ...base,
    color: '#e2e8f0'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8'
  }),
  menuPortal: base => ({ ...base, zIndex: 9999 })
};

export default function SearchableStaffSelect({ 
  staffList, 
  value, 
  onChange, 
  placeholder = "Select Employee...", 
  customStyles = {}, 
  menuPortalTarget, 
  formatLabel, 
  openMenuOnFocus = true,
  ...restProps 
}) {
  const options = React.useMemo(() => {
    return (staffList || []).map(s => {
      let label = '';
      if (formatLabel) {
        label = formatLabel(s);
      } else {
        label = s.name;
        if (s.designation) {
          label += ` (${s.designation})`;
        }
        if (s.row_position || s.link_number) {
          label += ` [Link #${s.row_position || s.link_number}]`;
        }
      }
      return {
        value: s.id.toString(),
        label,
        staff: s
      };
    });
  }, [staffList, formatLabel]);

  const selectedOption = options.find(o => o.value === String(value));

  // Custom filter to search across name, designation, PF number, and label
  const customFilter = (candidate, input) => {
    if (!input) return true;
    const cleanInput = input.trim().toLowerCase();
    const s = candidate.data?.staff;
    if (s) {
      if (s.name && s.name.toLowerCase().includes(cleanInput)) return true;
      if (s.pf_no && String(s.pf_no).toLowerCase().includes(cleanInput)) return true;
      if (s.hrms_id && String(s.hrms_id).toLowerCase().includes(cleanInput)) return true;
      if (s.designation && s.designation.toLowerCase().includes(cleanInput)) return true;
    }
    return (candidate.label || '').toLowerCase().includes(cleanInput);
  };

  const handleInputChange = (val, actionMeta) => {
    if (actionMeta.action === 'input-change' && val && val.trim().length >= 3) {
      const trimmed = val.trim().toLowerCase();
      const exactMatch = options.find(o => o.staff?.name?.trim().toLowerCase() === trimmed);
      if (exactMatch && exactMatch.value !== String(value)) {
        onChange(exactMatch.value);
      }
    }
  };

  return (
    <Select
      options={options}
      value={selectedOption || null}
      onChange={opt => onChange(opt ? opt.value : '')}
      onInputChange={handleInputChange}
      placeholder={placeholder}
      isClearable
      filterOption={customFilter}
      openMenuOnFocus={openMenuOnFocus}
      menuPlacement="auto"
      styles={{
        ...darkSelectStyles,
        ...customStyles
      }}
      menuPortalTarget={menuPortalTarget || document.body}
      {...restProps}
    />
  );
}

