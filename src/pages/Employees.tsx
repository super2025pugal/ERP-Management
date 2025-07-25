import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, User, Building2, Clock, Download } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } from '../services/firestore';
import { formatDate } from '../utils/calculations';
import type { Employee, Company, Unit, Group, Shift } from '../types';
import * as XLSX from 'xlsx';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'labour'>('all');
  const [companyFilter, setCompanyFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    employeeId: '',
    dob: '',
    address: '',
    phone: '',
    companyId: '',
    unitId: '',
    groupId: '',
    designation: '',
    dateOfJoining: '',
    monthlySalary: 0,  // For staff
    dailySalary: 0,    // For labour
    esaPf: false,
    education: '',
    emergencyContact: '',
    aadharNo: '',
    panNo: '',
    maritalStatus: 'single' as 'single' | 'married',
    salaryMode: 'cash' as 'cash' | 'account',
    bankName: '',
    accountNo: '',
    ifsc: '',
    employeeType: 'staff' as 'staff' | 'labour',
    shiftId: '',
    isActive: true
  });

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubscribeEmployees = subscribeToCollection('employees', setEmployees);
    const unsubscribeCompanies = subscribeToCollection('companies', setCompanies);
    const unsubscribeUnits = subscribeToCollection('units', setUnits);
    const unsubscribeGroups = subscribeToCollection('groups', setGroups);
    const unsubscribeShifts = subscribeToCollection('shifts', setShifts);

    return () => {
      unsubscribeEmployees();
      unsubscribeCompanies();
      unsubscribeUnits();
      unsubscribeGroups();
      unsubscribeShifts();
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [employeesData, companiesData, unitsData, groupsData, shiftsData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('companies'),
        getDocuments('units'),
        getDocuments('groups'),
        getDocuments('shifts')
      ]);

      setEmployees(employeesData);
      setCompanies(companiesData);
      setUnits(unitsData);
      setGroups(groupsData);
      setShifts(shiftsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const employeeData = {
        ...employeeForm,
        dob: new Date(employeeForm.dob),
        dateOfJoining: new Date(employeeForm.dateOfJoining),
        monthlySalary: Number(employeeForm.monthlySalary),
        dailySalary: Number(employeeForm.dailySalary)
      };

      if (editingEmployee) {
        await updateDocument('employees', editingEmployee.id, employeeData);
      } else {
        await createDocument('employees', employeeData);
      }

      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error saving employee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEmployeeForm({
      name: employee.name,
      employeeId: employee.employeeId,
      dob: new Date(employee.dob).toISOString().split('T')[0],
      address: employee.address,
      phone: employee.phone,
      companyId: employee.companyId,
      unitId: employee.unitId,
      groupId: employee.groupId,
      designation: employee.designation,
      dateOfJoining: new Date(employee.dateOfJoining).toISOString().split('T')[0],
      monthlySalary: employee.monthlySalary || 0,
      dailySalary: employee.dailySalary || 0,
      esaPf: employee.esaPf,
      education: employee.education,
      emergencyContact: employee.emergencyContact,
      aadharNo: employee.aadharNo,
      panNo: employee.panNo,
      maritalStatus: employee.maritalStatus,
      salaryMode: employee.salaryMode,
      bankName: employee.bankName || '',
      accountNo: employee.accountNo || '',
      ifsc: employee.ifsc || '',
      employeeType: employee.employeeType,
      shiftId: employee.shiftId,
      isActive: employee.isActive
    });
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await deleteDocument('employees', id);
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Error deleting employee');
      }
    }
  };

  const resetForm = () => {
    setEmployeeForm({
      name: '',
      employeeId: '',
      dob: '',
      address: '',
      phone: '',
      companyId: '',
      unitId: '',
      groupId: '',
      designation: '',
      dateOfJoining: '',
      monthlySalary: 0,
      dailySalary: 0,
      esaPf: false,
      education: '',
      emergencyContact: '',
      aadharNo: '',
      panNo: '',
      maritalStatus: 'single',
      salaryMode: 'cash',
      bankName: '',
      accountNo: '',
      ifsc: '',
      employeeType: 'staff',
      shiftId: '',
      isActive: true
    });
    setEditingEmployee(null);
  };

  const getAvailableShifts = () => {
    return shifts.filter(shift => 
      shift.isActive && 
      (shift.applicableTo === 'both' || shift.applicableTo === employeeForm.employeeType)
    );
  };

  // Auto-assign shift when employee type changes
  useEffect(() => {
    if (employeeForm.employeeType === 'staff') {
      // Auto-assign General Shift for staff
      const generalShift = shifts.find(shift => 
        shift.name.toLowerCase().includes('general') && shift.isActive
      );
      if (generalShift) {
        setEmployeeForm(prev => ({ ...prev, shiftId: generalShift.id }));
      }
    } else {
      // Clear shift for labour (they need manual assignment)
      if (employeeForm.shiftId) {
        const currentShift = shifts.find(s => s.id === employeeForm.shiftId);
        if (currentShift && currentShift.applicableTo === 'staff') {
          setEmployeeForm(prev => ({ ...prev, shiftId: '' }));
        }
      }
    }
  }, [employeeForm.employeeType, shifts]);

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    if (companyFilter) {
      // Reset unit and group filters when company changes
      setUnitFilter('');
      setGroupFilter('');
    }
  }, [companyFilter]);

  useEffect(() => {
    if (unitFilter) {
      // Reset group filter when unit changes
      setGroupFilter('');
    }
  }, [unitFilter]);

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || '';
  };

  const getUnitName = (unitId: string) => {
    return units.find(u => u.id === unitId)?.name || '';
  };

  const getGroupName = (groupId: string) => {
    return groups.find(g => g.id === groupId)?.name || '';
  };

  const getShiftName = (shiftId: string) => {
    return shifts.find(s => s.id === shiftId)?.name || '';
  };

  // Get available units based on selected company filter
  const getAvailableUnits = () => {
    if (!companyFilter) return units;
    return units.filter(unit => unit.companyId === companyFilter);
  };

  // Get available groups based on selected unit filter
  const getAvailableGroups = () => {
    if (!unitFilter) return groups;
    return groups.filter(group => group.unitId === unitFilter);
  };

  // Clear all filters function
  const clearAllFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCompanyFilter('');
    setUnitFilter('');
    setGroupFilter('');
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.designation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || employee.employeeType === typeFilter;
    const matchesCompany = !companyFilter || employee.companyId === companyFilter;
    const matchesUnit = !unitFilter || employee.unitId === unitFilter;
    const matchesGroup = !groupFilter || employee.groupId === groupFilter;

    return matchesSearch && matchesType && matchesCompany && matchesUnit && matchesGroup;
  });

  // Excel Download Function
  const downloadExcel = () => {
    try {
      // Prepare data for Excel export
      const excelData = filteredEmployees.map(employee => ({
        'Name': employee.name,
        'ID': employee.employeeId,
        'Type': employee.employeeType,
        'Company': getCompanyName(employee.companyId),
        'Unit': getUnitName(employee.unitId),
        'Group': getGroupName(employee.groupId),
        'Designation': employee.designation,
        'Shift': getShiftName(employee.shiftId),
        'Salary/Day': employee.salaryPerDay,
        'Salary/Month': employee.salaryPerMonth,
        'Status': employee.isActive ? 'Active' : 'Inactive'
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      
      // Set column widths for better formatting
      const colWidths = [
        { wch: 25 }, // Name
        { wch: 15 }, // ID
        { wch: 10 }, // Type
        { wch: 20 }, // Company
        { wch: 20 }, // Unit
        { wch: 20 }, // Group
        { wch: 25 }, // Designation
        { wch: 20 }, // Shift
        { wch: 12 }, // Salary/Day
        { wch: 12 }, // Salary/Month
        { wch: 10 }  // Status
      ];
      ws['!cols'] = colWidths;
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Employees_${currentDate}.xlsx`;
      
      // Download the file
      XLSX.writeFile(wb, filename);
      
      // Show success message
      alert(`Excel file "${filename}" downloaded successfully!`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading Excel file. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 sticky top-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
            <p className="text-gray-600 mt-1">Manage employee information and records</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download Excel
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear All Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Employee Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="staff">Staff</option>
            <option value="labour">Labour</option>
          </select>
          
          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>

          {/* Unit Filter */}
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!companyFilter}
          >
            <option value="">All Units</option>
            {getAvailableUnits().map(unit => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>

          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!unitFilter}
          >
            <option value="">All Groups</option>
            {getAvailableGroups().map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          {/* Active Filter Count */}
          <div className="flex items-center px-3 py-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-800 font-medium">
              Showing {filteredEmployees.length} of {employees.length}
            </span>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchTerm || typeFilter !== 'all' || companyFilter || unitFilter || groupFilter) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Search: "{searchTerm}"
                </span>
              )}
              {typeFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Type: {typeFilter}
                </span>
              )}
              {companyFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Company: {getCompanyName(companyFilter)}
                </span>
              )}
              {unitFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Unit: {getUnitName(unitFilter)}
                </span>
              )}
              {groupFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                  Group: {getGroupName(groupFilter)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    placeholder="Full Name"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="text"
                    value={employeeForm.employeeId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
                    placeholder="Employee ID"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="date"
                    value={employeeForm.dob}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, dob: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="tel"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    placeholder="Phone Number"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <textarea
                    value={employeeForm.address}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                    placeholder="Address"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
                    rows={3}
                    required
                  />
                </div>
              </div>

              {/* Employee Type & Organization */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Type & Organization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={employeeForm.employeeType}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeType: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="staff">Staff</option>
                    <option value="labour">Labour</option>
                  </select>
                  
                  <select
                    value={employeeForm.companyId}
                    onChange={(e) => {
                      setEmployeeForm({ ...employeeForm, companyId: e.target.value, unitId: '', groupId: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  
                  <select
                    value={employeeForm.unitId}
                    onChange={(e) => {
                      setEmployeeForm({ ...employeeForm, unitId: e.target.value, groupId: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!employeeForm.companyId}
                    required
                  >
                    <option value="">Select Unit</option>
                    {units
                      .filter(unit => unit.companyId === employeeForm.companyId)
                      .map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                  </select>
                  
                  <select
                    value={employeeForm.groupId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, groupId: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!employeeForm.unitId}
                    required
                  >
                    <option value="">Select Group</option>
                    {groups
                      .filter(group => group.unitId === employeeForm.unitId)
                      .map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Job Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                    placeholder="Designation"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="date"
                    value={employeeForm.dateOfJoining}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, dateOfJoining: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  <select
                    value={employeeForm.shiftId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, shiftId: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Shift</option>
                    {getAvailableShifts().map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.startTime} - {shift.endTime})
                      </option>
                    ))}
                  </select>
                  
                  {employeeForm.employeeType === 'staff' && (
                    <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      Staff members are automatically assigned to General Shift and get 2 hours free permission per month.
                    </div>
                  )}
                  
                  {employeeForm.employeeType === 'labour' && (
                    <div className="text-sm text-purple-600 bg-purple-50 p-3 rounded-lg">
                      Labour employees can be assigned to rotational shifts. No free permission hours allowed.
                    </div>
                  )}
                </div>
              </div>

              {/* Salary Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employeeForm.employeeType === 'staff' ? (
                    <input
                      type="number"
                      value={employeeForm.monthlySalary}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, monthlySalary: Number(e.target.value) })}
                      placeholder="Monthly Salary"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  ) : (
                    <input
                      type="number"
                      value={employeeForm.dailySalary}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, dailySalary: Number(e.target.value) })}
                      placeholder="Daily Salary"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  )}
                  
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {employeeForm.employeeType === 'staff' ? (
                      <div>
                        <strong>Staff Salary:</strong>
                        <br />• Monthly salary input
                        <br />• Per day = Monthly ÷ Working days
                        <br />• Per hour = Per day ÷ 8
                      </div>
                    ) : (
                      <div>
                        <strong>Labour Salary:</strong>
                        <br />• Daily wage input
                        <br />• Fixed daily rate
                        <br />• Per hour = Daily ÷ 8
                      </div>
                    )}
                  </div>
                  
                  <select
                    value={employeeForm.salaryMode}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, salaryMode: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="account">Bank Account</option>
                  </select>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="esaPf"
                      checked={employeeForm.esaPf}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, esaPf: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="esaPf" className="ml-2 text-sm text-gray-700">
                      ESA/PF Applicable
                    </label>
                  </div>
                </div>
                
                {employeeForm.salaryMode === 'account' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <input
                      type="text"
                      value={employeeForm.bankName}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, bankName: e.target.value })}
                      placeholder="Bank Name"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={employeeForm.accountNo}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, accountNo: e.target.value })}
                      placeholder="Account Number"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={employeeForm.ifsc}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, ifsc: e.target.value })}
                      placeholder="IFSC Code"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={employeeForm.education}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, education: e.target.value })}
                    placeholder="Education"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={employeeForm.emergencyContact}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyContact: e.target.value })}
                    placeholder="Emergency Contact"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={employeeForm.aadharNo}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, aadharNo: e.target.value })}
                    placeholder="Aadhar Number"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={employeeForm.panNo}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, panNo: e.target.value })}
                    placeholder="PAN Number"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={employeeForm.maritalStatus}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, maritalStatus: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={employeeForm.isActive}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                      Active Employee
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Employees ({filteredEmployees.length})
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading employees...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No employees found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type & Shift
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                          <div className="text-sm text-gray-500">ID: {employee.employeeId}</div>
                          <div className="text-sm text-gray-500">{employee.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.employeeType === 'staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {employee.employeeType}
                        </span>
                        <div className="text-sm text-gray-600 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {getShiftName(employee.shiftId)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{getCompanyName(employee.companyId)}</div>
                      <div className="text-sm text-gray-500">{getUnitName(employee.unitId)}</div>
                      <div className="text-sm text-gray-500">{getGroupName(employee.groupId)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {employee.employeeType === 'staff' 
                          ? `₹${employee.monthlySalary || 0}/month`
                          : `₹${employee.dailySalary || 0}/day`
                        }
                      </div>
                      <div className="text-xs text-gray-400">
                        {employee.salaryMode} {employee.esaPf && '• ESA/PF'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Employees;