import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getUsersPage, getUserStats, addUser, updateUser, deleteUser, getUserByEmail, bulkDeleteUsers, type UserStats } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, SkeletonPage, ErrorAlert, ActionButton, SearchInput } from '../../components/UI';
import Icon from '../../components/Icons';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import BulkActionBar from '../../components/BulkActionBar';
import { useSelection } from '../../hooks/useSelection';
import { CSVUploader } from '../../components/CSVUploader';
import { getPasswordRequirementChecks, isPasswordCompliant } from '../../utils/passwordStrength';
import { USER_ROLE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import { exportToCSV, formatPersonName } from '../../utils/helpers';
import type { User } from '../../types';

const USERS_PER_PAGE = 10;
const ROLES = USER_ROLE_OPTIONS;

function friendlyActionError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message?.trim() : '';
  if (message) return message;
  return `${fallback} If this keeps happening, please contact the developers or support team.`;
}

interface UserForm {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  password: string;
}

const emptyForm: UserForm = { firstName: '', middleName: '', lastName: '', email: '', role: 'applicant', status: 'Active', password: '' };

export default function EmployeeUsers() {
  const { user: authUser } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'gradeLevelAsc' | 'gradeLevelDesc'>('newest');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const confirm = useConfirm();
  const { selected, toggle, togglePage, clear: clearSelection, isAllSelected, count: selectedCount } = useSelection();
  const passwordChecks = getPasswordRequirementChecks(form.password);

  const firstPasswordRequirementMessage = (password: string): string => {
    const unmet = getPasswordRequirementChecks(password).find(rule => !rule.met);
    if (!unmet) return '';
    const messages: Record<string, string> = {
      minLength: 'Min 8 characters',
      uppercase: 'Must contain uppercase letter',
      lowercase: 'Must contain lowercase letter',
      digit: 'Must contain number',
      special: 'Must contain special character',
    };
    return messages[unmet.key] || 'Password does not meet requirements';
  };

  const { data: usersPage, loading, error, refetch } = useAsync(async () => {
    return getUsersPage({
      search: search.trim() || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      gradeLevel: gradeFilter !== 'all' ? gradeFilter : undefined,
      sortBy,
      page,
      limit: USERS_PER_PAGE,
    });
  }, [search, roleFilter, statusFilter, gradeFilter, sortBy, page], 0, { setLoadingOnReload: true });

  const { data: stats, refetch: refetchStats } = useAsync<UserStats>(() => getUserStats());

  const users: User[] = usersPage?.data || [];
  const pagination = usersPage?.pagination || { page: 1, limit: USERS_PER_PAGE, total: 0, totalPages: 1 };
  const resetPage = () => setPage(1);

  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setErrors({}); setShowModal(true); };
  const openEdit = (u: User) => { setForm({ firstName: u.firstName, middleName: u.middleName || '', lastName: u.lastName, email: u.email, role: u.role, status: u.status, password: '' }); setEditId(u.id); setErrors({}); setShowModal(true); };

  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.middleName.trim()) e.middleName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    else {
      try {
        const dup = await getUserByEmail(form.email);
        if (dup && dup.id !== editId) e.email = 'Email already in use';
      } catch {
        // 404 = email not found = no duplicate
      }
    }
    if (!editId && !form.password.trim()) e.password = 'Required for new users';
    else if (form.password) {
      if (!isPasswordCompliant(form.password)) e.password = firstPasswordRequirementMessage(form.password);
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBulkImportUsers = async (data: any[]) => {
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    setSaving(true);
    try {
      for (const row of data) {
        const password = typeof row.password === 'string' ? row.password.trim() : '';
        if (!password) {
          skippedCount++;
          continue;
        }
        try {
          await addUser({
            firstName: row.firstName || '',
            middleName: row.middleName || '',
            lastName: row.lastName || '',
            email: row.email,
            role: row.role || 'applicant',
            status: row.status || 'Active',
            password,
          });
          successCount++;
        } catch (e) {
          failedCount++;
        }
      }
      if (successCount > 0) {
        showToast(`Imported ${successCount} user(s). Skipped ${skippedCount}, failed ${failedCount}.`, 'success');
      } else {
        showToast('No users were imported. Ensure each row includes a valid password and email.', 'warning');
      }
      refetch();
      refetchStats();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!(await validate()) || saving) return;
    setSaving(true);
    try {
      if (editId) {
        const upd: Record<string, string> = { firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, email: form.email, role: form.role, status: form.status };
        if (form.password) upd.password = form.password;
        const result = await updateUser(editId, upd);
        showToast(result.verificationEmailSent
          ? (result.message || 'User updated and verification email sent.')
          : 'User updated!',
          'success');
      } else {
        const result = await addUser({ ...form });
        showToast(result.verificationEmailSent
          ? (result.message || 'User added and verification email sent.')
          : 'User added!',
          'success');
      }
      refetch();
      refetchStats();
      setShowModal(false);
    } catch (err) {
      showToast(friendlyActionError(err, 'We could not save this user right now.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (userId: number) => {
    if (userId === authUser?.id) {
      showToast('You cannot delete your own account.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (ok) {
      try {
        await deleteUser(userId);
        refetch();
        refetchStats();
        showToast('User deleted.', 'info');
      } catch (err) {
        showToast(friendlyActionError(err, 'We could not delete this user right now.'), 'error');
      }
    }
  };

  const set = (key: keyof UserForm, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || bulkDeleting) return;
    const ids = [...selected].filter(id => id !== authUser?.id);
    if (ids.length === 0) {
      showToast('You cannot delete your own account.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete Selected Users',
      message: `Are you sure you want to delete ${ids.length} user(s)? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: `Delete ${ids.length} User(s)`,
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteUsers(ids);
      showToast(`${ids.length} user(s) deleted.`, 'info');
      clearSelection();
      refetch();
      refetchStats();
    } catch (err) {
      showToast(friendlyActionError(err, 'We could not delete the selected users right now.'), 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const roleLabel = (r: string) => ROLES.find(ro => ro.value === r)?.label || r;

  if (loading && !usersPage) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  if (authUser?.role !== 'administrator') {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="lock" className="w-7 h-7 text-forest-500" /></div>
        <h3 className="font-bold text-forest-500 mb-1">Access Restricted</h3>
        <p className="text-gray-500 text-sm">Only administrators can manage user accounts.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage system user accounts.">
        <div className="flex gap-2">
            <ActionButton
              variant="secondary"
              onClick={() => exportToCSV(users.map(u => ({
                'First Name': u.firstName,
                'Middle Name': u.middleName || '',
                'Last Name': u.lastName,
                'Email': u.email,
                'Role': u.role,
                'Status': u.status,
                'Grade Level': u.applicantProfile?.gradeLevel || '',
              })), 'Users_Export.csv')}
              icon={<Icon name="download" className="w-4 h-4" />}
              title="Download current page as CSV"
            >
              Export
            </ActionButton>
            <CSVUploader
              title="Bulk Import Users"
              isOpen={showBulkImport}
              onClose={() => setShowBulkImport(false)}
              onImport={handleBulkImportUsers}
              templateHeaders={['firstName', 'middleName', 'lastName', 'email', 'role', 'status', 'password']}
              templateRows={[
                { firstName: 'Ana', middleName: 'Maria', lastName: 'Santos', email: 'ana.santos@goldenkey.edu', role: 'teacher', status: 'Active', password: 'Teacher123!' },
                { firstName: 'Juan', middleName: 'Carlos', lastName: 'Reyes', email: 'juan.reyes@goldenkey.edu', role: 'registrar', status: 'Active', password: 'Registrar123!' },
                { firstName: 'Maria', middleName: 'Luz', lastName: 'Cruz', email: 'maria.cruz@goldenkey.edu', role: 'administrator', status: 'Active', password: 'Admin123!' },
              ]}
            />
            <ActionButton variant="secondary" onClick={() => setShowBulkImport(true)}>
              <span>&#8690;</span> Import Users
            </ActionButton>
            <ActionButton onClick={openAdd}>
              <span>&#65291;</span> Add User
            </ActionButton>
          </div>
        </PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Users" value={stats?.total || 0} icon="users" />
          <StatCard label="Administrators" value={stats?.admins || 0} icon="shieldCheck" />
          <StatCard label="Registrars" value={stats?.registrars || 0} icon="clipboard" />
          <StatCard label="Teachers" value={stats?.teachers || 0} icon="graduationCap" />
          <StatCard label="Applicants" value={stats?.applicants || 0} icon="userCircle" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={(value) => { setSearch(value); resetPage(); }}
          placeholder="Search users..."
          ariaLabel="Search users"
          className="flex-1"
        />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); resetPage(); }} aria-label="Filter by role" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none">
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); resetPage(); }} aria-label="Filter by status" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          value={gradeFilter}
          onChange={e => {
            const nextGrade = e.target.value;
            setGradeFilter(nextGrade);
            if (nextGrade !== 'all') {
              setRoleFilter('applicant');
            }
            resetPage();
          }}
          aria-label="Filter applicants by grade level"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none"
        >
          <option value="all">All Applicant Grades</option>
          {ALL_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value as typeof sortBy); resetPage(); }}
          aria-label="Sort users"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name (A-Z)</option>
          <option value="gradeLevelAsc">Grade Level (A-Z)</option>
          <option value="gradeLevelDesc">Grade Level (Z-A)</option>
        </select>
      </div>

      {users.length > 0 || loading ? (
        <>
        <BulkActionBar count={selectedCount} onDelete={handleBulkDelete} onClear={clearSelection} deleting={bulkDeleting} />
        <div className="gk-section-card">
          <div className="relative table-scroll">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm">
              <th scope="col" className="py-3 px-2 w-8"><input type="checkbox" checked={isAllSelected(users)} onChange={() => togglePage(users)} className="accent-forest-500 rounded" aria-label="Select all users" /></th>
              <th scope="col" className="py-3 px-4">Name</th><th scope="col" className="py-3 px-4">Email</th><th scope="col" className="py-3 px-4">Role</th><th scope="col" className="py-3 px-4">Grade Level</th><th scope="col" className="py-3 px-4">Status</th><th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4" />
                </tr>
              ) : users.map(u => (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${selected.has(u.id) ? 'bg-gold-50/50' : ''}`}>
                  <td className="py-3 px-2"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="accent-forest-500 rounded" aria-label={`Select ${formatPersonName(u)}`} /></td>
                  <td className="py-3 px-4 font-medium text-forest-500">{formatPersonName(u)}</td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4"><Badge variant="info">{roleLabel(u.role)}</Badge></td>
                  <td className="py-3 px-4 text-gray-500">{u.applicantProfile?.gradeLevel || 'N/A'}</td>
                  <td className="py-3 px-4"><Badge variant={u.status === 'Active' ? 'success' : 'danger'}>{u.status}</Badge></td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <ActionButton size="sm" variant="ghost" onClick={() => openEdit(u)} icon={<Icon name="edit" className="w-3.5 h-3.5" />} className="text-forest-600 hover:bg-forest-50">Edit</ActionButton>
                      <ActionButton size="sm" variant="ghost" onClick={() => confirmDelete(u.id)} icon={<Icon name="trash" className="w-3.5 h-3.5" />} className="text-red-600 hover:bg-red-50">Delete</ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] pointer-events-none">
              <div className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 shadow-sm">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-forest-200 border-t-forest-500 animate-spin" />
                Loading users...
              </div>
            </div>
          )}
          </div>
          <div className="px-4">
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} totalItems={pagination.total} itemsPerPage={USERS_PER_PAGE} />
          </div>
        </div>
        </>
      ) : (
        <EmptyState icon="users" title="No users found" text="Try adjusting your search or filter." />
      )}

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit User' : 'Add New User'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} aria-describedby={errors.firstName ? 'firstName-error' : undefined} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.firstName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.firstName && <p id="firstName-error" className="text-red-500 text-xs mt-1" role="alert">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input value={form.middleName} onChange={e => set('middleName', e.target.value)} aria-describedby={errors.middleName ? 'middleName-error' : undefined} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.middleName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.middleName && <p id="middleName-error" className="text-red-500 text-xs mt-1" role="alert">{errors.middleName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} aria-describedby={errors.lastName ? 'lastName-error' : undefined} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.lastName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.lastName && <p id="lastName-error" className="text-red-500 text-xs mt-1" role="alert">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} aria-describedby={errors.email ? 'email-error' : undefined} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.email ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.email && <p id="email-error" className="text-red-500 text-xs mt-1" role="alert">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editId ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} aria-describedby={errors.password ? 'password-error' : undefined} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.password ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.password && <p id="password-error" className="text-red-500 text-xs mt-1" role="alert">{errors.password}</p>}
            {form.password && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                {passwordChecks.map(rule => (
                  <p key={rule.key} className={`text-xs flex items-center gap-1.5 ${rule.met ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <Icon name={rule.met ? 'checkCircle' : 'xCircle'} className="w-3.5 h-3.5" />
                    {rule.label}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="secondary" onClick={() => setShowModal(false)}>Cancel</ActionButton>
            <ActionButton onClick={handleSave} loading={saving}>{editId ? 'Save Changes' : 'Add User'}</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

