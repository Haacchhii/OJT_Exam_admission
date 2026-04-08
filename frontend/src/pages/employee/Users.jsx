import { useState, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { getUsers, addUser, updateUser, deleteUser, getUserByEmail } from '../../api/users.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showToast } from '../../components/Toast.jsx';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import Icon from '../../components/Icons.jsx';
import Modal from '../../components/Modal.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { USER_ROLE_OPTIONS, ROLES, DEFAULT_PAGE_SIZE } from '../../utils/constants.js';
import { getPasswordRequirementChecks, isPasswordCompliant } from '../../utils/passwordStrength.js';

const USERS_PER_PAGE = DEFAULT_PAGE_SIZE;
const ROLE_OPTIONS = USER_ROLE_OPTIONS;

const emptyForm = { firstName: '', lastName: '', email: '', role: ROLES.APPLICANT, status: 'Active', password: '' };

export default function EmployeeUsers() {
  const { user: authUser } = useAuth();
  const { data: users, loading, error, refetch } = useAsync(() => getUsers());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const passwordChecks = getPasswordRequirementChecks(form.password);

  const firstPasswordRequirementMessage = (password) => {
    const unmet = getPasswordRequirementChecks(password).find(rule => !rule.met);
    if (!unmet) return '';
    const messages = {
      minLength: 'Min 8 characters',
      uppercase: 'Must contain uppercase letter',
      lowercase: 'Must contain lowercase letter',
      digit: 'Must contain number',
      special: 'Must contain special character',
    };
    return messages[unmet.key] || 'Password does not meet requirements';
  };

  const filtered = useMemo(() => {
    let list = users || [];
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter(u => (u.status || 'Active') === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q));
    }
    return list;
  }, [users, roleFilter, statusFilter, search]);

  const { paginated, totalPages, safePage, totalItems } = usePaginationSlice(filtered, page, USERS_PER_PAGE);
  const resetPage = () => setPage(1);

  const stats = useMemo(() => {
    const list = users || [];
    return {
      total: list.length,
      admins: list.filter(u => u.role === ROLES.ADMIN).length,
      registrars: list.filter(u => u.role === ROLES.REGISTRAR).length,
      teachers: list.filter(u => u.role === ROLES.TEACHER).length,
      applicants: list.filter(u => u.role === ROLES.APPLICANT).length,
    };
  }, [users]);

  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setErrors({}); setShowModal(true); };
  const openEdit = (u) => { setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, status: u.status || 'Active', password: '' }); setEditId(u.id); setErrors({}); setShowModal(true); };

  const validate = async () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    else {
      try {
        const dup = await getUserByEmail(form.email);
        if (dup && dup.id !== editId) e.email = 'Email already in use';
      } catch {
        // 404 = email not found = no duplicate — that's fine
      }
    }
    if (!editId && !form.password.trim()) e.password = 'Required for new users';
    else if (form.password && !isPasswordCompliant(form.password)) e.password = firstPasswordRequirementMessage(form.password);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!(await validate()) || saving) return;
    setSaving(true);
    try {
      if (editId) {
        const upd = { firstName: form.firstName, lastName: form.lastName, email: form.email, role: form.role, status: form.status };
        if (form.password) upd.password = form.password;
        await updateUser(editId, upd);
        showToast('User updated!', 'success');
      } else {
        await addUser({ ...form });
        showToast('User added!', 'success');
      }
      refetch();
      setShowModal(false);
    } catch (err) {
      showToast('Failed to save user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (userId) => {
    if (userId === authUser.id) {
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
        showToast('User deleted.', 'info');
      } catch (err) {
        showToast('Failed to delete user.', 'error');
      }
    }
  };

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const roleLabel = (r) => ROLE_OPTIONS.find(ro => ro.value === r)?.label || r;

  if (loading && !users) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  // Only administrators can manage users
  if (authUser?.role !== ROLES.ADMIN) {
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
        <button onClick={openAdd} className="bg-forest-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-forest-600 flex items-center gap-2">
          <span>＋</span> Add User
        </button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Users" value={stats.total} icon="users" />
        <StatCard label="Administrators" value={stats.admins} icon="shieldCheck" />
        <StatCard label="Registrars" value={stats.registrars} icon="clipboard" />
        <StatCard label="Teachers" value={stats.teachers} icon="graduationCap" />
        <StatCard label="Applicants" value={stats.applicants} icon="userCircle" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search users…" aria-label="Search users" className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); resetPage(); }} aria-label="Filter by role" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none">
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); resetPage(); }} aria-label="Filter by status" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-forest-500/20 outline-none">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {paginated.length > 0 ? (
        <div className="gk-card table-scroll">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
              <th scope="col" className="py-3 px-4">Name</th><th scope="col" className="py-3 px-4">Email</th><th scope="col" className="py-3 px-4">Role</th><th scope="col" className="py-3 px-4">Status</th><th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {paginated.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-medium text-forest-500">{u.firstName} {u.lastName}</td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4"><Badge variant="info">{roleLabel(u.role)}</Badge></td>
                  <td className="py-3 px-4"><Badge variant={(u.status || 'Active') === 'Active' ? 'success' : 'danger'}>{u.status || 'Active'}</Badge></td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button onClick={() => openEdit(u)} className="text-forest-500 hover:bg-forest-50 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-0.5"><Icon name="edit" className="w-3.5 h-3.5" /> Edit</button>
                    <button onClick={() => confirmDelete(u.id)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-0.5"><Icon name="trash" className="w-3.5 h-3.5" /> Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4">
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={USERS_PER_PAGE} />
          </div>
        </div>
      ) : (
        <EmptyState icon="users" title="No users found" text="Try adjusting your search or filter." />
      )}

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit User' : 'Add New User'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.firstName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.lastName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.email ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
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
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-forest-500/20 ${errors.password ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
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
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-forest-500 text-white rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">{saving ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Saving…</> : (editId ? 'Save Changes' : 'Add User')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
