'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  FolderPlus,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Search,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { CustomerDto, CustomerGroupDto, WhatsAppStatusDto } from '@mehwar/shared';
import { WhatsAppModal } from '@/components/modals/WhatsAppModal';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { Avatar, Button, Card, Input, Modal, Switch } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'groups'>('customers');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // WhatsApp status
  const { data: waStatus } = useApi<WhatsAppStatusDto>('/whatsapp/status', ['whatsapp']);

  return (
    <div className="w-full space-y-6 pt-2">
      {/* Page Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-black tracking-tight text-fg">
              <Users className="size-8 text-primary" /> User Management
            </h1>
            <p className="text-xs text-muted mt-1">
              Organize your customer directory and contact groups for multi-channel video sharing.
            </p>
          </div>

          {/* WhatsApp Status Link to Settings */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/settings?tab=whatsapp"
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition shadow-sm',
                waStatus?.status === 'CONNECTED'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-line bg-card-strong text-muted hover:text-fg hover:border-line/80',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  waStatus?.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-muted/50',
                )}
              />
              <MessageSquare className="size-3.5" />
              <span>
                {waStatus?.status === 'CONNECTED'
                  ? `WhatsApp: +${waStatus.phone ?? 'Linked'}`
                  : 'Connect WhatsApp in Settings'}
              </span>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.05}>
        <div className="flex gap-2 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition shrink-0',
              activeTab === 'customers'
                ? 'bg-primary text-primary-foreground shadow-md border border-primary'
                : 'bg-card-strong text-muted hover:bg-elevated hover:text-fg border border-line',
            )}
          >
            <User className="size-4" />
            <span>Customers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition shrink-0',
              activeTab === 'groups'
                ? 'bg-primary text-primary-foreground shadow-md border border-primary'
                : 'bg-card-strong text-muted hover:bg-elevated hover:text-fg border border-line',
            )}
          >
            <Users className="size-4" />
            <span>Groups</span>
          </button>
        </div>
      </FadeIn>

      {/* Active Tab View */}
      <FadeIn delay={0.1}>
        {activeTab === 'customers' ? <CustomersTab /> : <GroupsTab />}
      </FadeIn>

      <WhatsAppModal open={qrModalOpen} onClose={() => setQrModalOpen(false)} />
    </div>
  );
}

// ==========================================
// CUSTOMERS TAB
// ==========================================

function CustomersTab() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerDto | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const { data: customers, error } = useApi<CustomerDto[]>(
    `/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
    ['customers'],
  );

  const { data: groups } = useApi<CustomerGroupDto[]>('/customers/groups', ['customer-groups']);

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    setBusyDelete(true);
    try {
      await api(`/customers/${deletingCustomer.id}`, { method: 'DELETE' });
      toast.success('Customer deleted');
      invalidate('customers');
      invalidate('customer-groups');
      setDeletingCustomer(null);
    } catch (err) {
      toast.error('Could not delete customer', {
        description: (err as ApiError).message,
      });
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex h-11 w-full sm:max-w-md items-center gap-2.5 rounded-2xl border border-line bg-card-strong px-3.5 focus-within:ring-4 focus-within:ring-[var(--ring)]">
          <Search className="size-4 text-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, phone, or email…"
            className="w-full bg-transparent text-xs text-fg placeholder:text-muted outline-none"
          />
        </div>

        <Button
          onClick={() => {
            setEditingCustomer(null);
            setModalOpen(true);
          }}
          className="gap-2 shrink-0"
        >
          <UserPlus className="size-4" /> Add Customer
        </Button>
      </div>

      {/* Customer List */}
      {!customers ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-line/20 p-5 rounded-3xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-card-strong">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <User className="size-7" />
          </div>
          <h3 className="font-bold text-base text-fg">No customers found</h3>
          <p className="text-xs text-muted max-w-sm mt-1 mb-4">
            {search
              ? 'No customers match your search criteria. Try a different query.'
              : 'Start adding your customers to easily share social posts and videos via Email and WhatsApp.'}
          </p>
          <Button
            onClick={() => {
              setEditingCustomer(null);
              setModalOpen(true);
            }}
            size="sm"
            className="gap-1.5"
          >
            <UserPlus className="size-4" /> Add Your First Customer
          </Button>
        </Card>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <StaggerItem key={c.id}>
              <Card className="group relative flex flex-col justify-between rounded-3xl border border-line bg-card-strong p-5 transition hover:border-line/90 shadow-sm">
                <div className="space-y-3">
                  {/* Top: Avatar & Name */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={c.name} size={42} />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-fg truncate">{c.name}</h4>
                        <p className="text-[11px] text-muted truncate">{c.email || 'No email'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(c);
                          setModalOpen(true);
                        }}
                        className="rounded-xl p-1.5 text-muted hover:bg-line hover:text-fg transition"
                        title="Edit customer"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCustomer(c)}
                        className="rounded-xl p-1.5 text-red-500 hover:bg-red-500/10 transition"
                        title="Delete customer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Phone Details */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center gap-2 text-muted">
                      <Phone className="size-3.5 shrink-0" />
                      <span className="truncate">{c.mobileNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <MessageSquare className="size-3.5 shrink-0" />
                      <span className="truncate">WA: {c.whatsappNumber}</span>
                    </div>
                  </div>

                  {/* Group Badges */}
                  {c.groups && c.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.groups.map((g) => (
                        <span
                          key={g.id}
                          className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {c.notes && (
                    <p className="text-[11px] text-muted/80 line-clamp-2 italic pt-1">
                      &ldquo;{c.notes}&rdquo;
                    </p>
                  )}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Customer Create/Edit Modal */}
      {modalOpen && (
        <CustomerFormModal
          open={modalOpen}
          customer={editingCustomer}
          availableGroups={groups || []}
          onClose={() => {
            setModalOpen(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deletingCustomer !== null}
        onClose={() => setDeletingCustomer(null)}
        title="Delete Customer?"
        maxWidth="max-w-sm"
      >
        <p className="text-xs text-muted">
          Are you sure you want to remove <strong className="text-fg">{deletingCustomer?.name}</strong>?
          This will also remove them from any contact groups.
        </p>
        <div className="flex justify-end gap-2 pt-4 border-t border-line/60 mt-4">
          <Button variant="ghost" onClick={() => setDeletingCustomer(null)} disabled={busyDelete}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={busyDelete}>
            Delete Customer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Customer Form Modal (Add / Edit)
function CustomerFormModal({
  open,
  customer,
  availableGroups,
  onClose,
}: {
  open: boolean;
  customer: CustomerDto | null;
  availableGroups: CustomerGroupDto[];
  onClose: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? '');
  const [mobileNumber, setMobileNumber] = useState(customer?.mobileNumber ?? '');
  const [sameAsMobile, setSameAsMobile] = useState(
    !customer || customer.whatsappNumber === customer.mobileNumber,
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    customer?.whatsappNumber ?? customer?.mobileNumber ?? '',
  );
  const [email, setEmail] = useState(customer?.email ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleMobileChange = (val: string) => {
    setMobileNumber(val);
    if (sameAsMobile) {
      setWhatsappNumber(val);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobileNumber.trim()) {
      toast.error('Name and mobile number are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        whatsappNumber: (sameAsMobile ? mobileNumber : whatsappNumber).trim() || mobileNumber.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
      };

      if (customer) {
        await api(`/customers/${customer.id}`, { method: 'PATCH', json: payload });
        toast.success('Customer updated');
      } else {
        await api('/customers', { method: 'POST', json: payload });
        toast.success('Customer added');
      }

      invalidate('customers');
      invalidate('customer-groups');
      onClose();
    } catch (err) {
      toast.error('Could not save customer', {
        description: (err as ApiError).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add New Customer'}
      maxWidth="max-w-md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Jenkins"
          icon={<User className="size-4" />}
          required
          autoFocus
        />

        <Input
          label="Mobile Number"
          value={mobileNumber}
          onChange={(e) => handleMobileChange(e.target.value)}
          placeholder="e.g. +971501234567"
          icon={<Phone className="size-4" />}
          required
        />

        <div className="rounded-2xl border border-line bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-emerald-500" /> WhatsApp Number
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-muted">
              <input
                type="checkbox"
                checked={sameAsMobile}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameAsMobile(checked);
                  if (checked) setWhatsappNumber(mobileNumber);
                }}
                className="size-3.5 accent-primary rounded"
              />
              <span>Same as mobile</span>
            </label>
          </div>

          {!sameAsMobile && (
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +971501234567"
              className="w-full rounded-xl border border-line bg-elevated/70 px-3 py-2 text-xs text-fg outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
        </div>

        <Input
          label="Email Address (optional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. sarah@company.com"
          icon={<Mail className="size-4" />}
        />

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Notes / Company
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add relevant customer context or company name..."
            className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-xs text-fg outline-none focus:ring-4 focus:ring-[var(--ring)] resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-3 border-t border-line/60">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {customer ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// GROUPS TAB
// ==========================================

function GroupsTab() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroupDto | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<CustomerGroupDto | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const { data: groups } = useApi<CustomerGroupDto[]>('/customers/groups', ['customer-groups']);
  const { data: allCustomers } = useApi<CustomerDto[]>('/customers', ['customers']);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
  }, [groups, search]);

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setBusyDelete(true);
    try {
      await api(`/customers/groups/${deletingGroup.id}`, { method: 'DELETE' });
      toast.success('Group deleted');
      invalidate('customer-groups');
      invalidate('customers');
      setDeletingGroup(null);
    } catch (err) {
      toast.error('Could not delete group', {
        description: (err as ApiError).message,
      });
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex h-11 w-full sm:max-w-md items-center gap-2.5 rounded-2xl border border-line bg-card-strong px-3.5 focus-within:ring-4 focus-within:ring-[var(--ring)]">
          <Search className="size-4 text-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact groups by name…"
            className="w-full bg-transparent text-xs text-fg placeholder:text-muted outline-none"
          />
        </div>

        <Button
          onClick={() => {
            setEditingGroup(null);
            setModalOpen(true);
          }}
          className="gap-2 shrink-0"
        >
          <FolderPlus className="size-4" /> Create Group
        </Button>
      </div>

      {/* Group List */}
      {!groups ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-36 animate-pulse bg-line/20 p-5 rounded-3xl" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-card-strong">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <Users className="size-7" />
          </div>
          <h3 className="font-bold text-base text-fg">No groups created yet</h3>
          <p className="text-xs text-muted max-w-sm mt-1 mb-4">
            Group customers together (e.g. VIP Clients, Tech Founders, Retail Buyers) to broadcast video links in one click.
          </p>
          <Button
            onClick={() => {
              setEditingGroup(null);
              setModalOpen(true);
            }}
            size="sm"
            className="gap-1.5"
          >
            <FolderPlus className="size-4" /> Create Your First Group
          </Button>
        </Card>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => (
            <StaggerItem key={g.id}>
              <Card className="flex flex-col justify-between rounded-3xl border border-line bg-card-strong p-5 shadow-sm transition hover:border-line/90">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <Users className="size-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-fg">{g.name}</h4>
                        <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-muted">
                          {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup(g);
                          setModalOpen(true);
                        }}
                        className="rounded-xl p-1.5 text-muted hover:bg-line hover:text-fg transition"
                        title="Edit group"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingGroup(g)}
                        className="rounded-xl p-1.5 text-red-500 hover:bg-red-500/10 transition"
                        title="Delete group"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {g.description && (
                    <p className="text-xs text-muted line-clamp-2">{g.description}</p>
                  )}

                  {/* Members Preview */}
                  {g.members && g.members.length > 0 && (
                    <div className="pt-2 border-t border-line/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Group Members
                      </p>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <div className="flex -space-x-2">
                          {g.members.slice(0, 4).map((m) => (
                            <Avatar
                              key={m.id}
                              name={m.customer.name}
                              size={26}
                              className="ring-2 ring-[var(--bg)]"
                            />
                          ))}
                        </div>
                        {g.members.length > 4 && (
                          <span className="text-[10px] text-muted font-medium pl-1">
                            +{g.members.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Group Create/Edit Modal */}
      {modalOpen && (
        <GroupFormModal
          open={modalOpen}
          group={editingGroup}
          allCustomers={allCustomers || []}
          onClose={() => {
            setModalOpen(false);
            setEditingGroup(null);
          }}
        />
      )}

      {/* Delete Group Modal */}
      <Modal
        open={deletingGroup !== null}
        onClose={() => setDeletingGroup(null)}
        title="Delete Group?"
        maxWidth="max-w-sm"
      >
        <p className="text-xs text-muted">
          Are you sure you want to delete <strong className="text-fg">{deletingGroup?.name}</strong>?
          Individual customer records will not be deleted.
        </p>
        <div className="flex justify-end gap-2 pt-4 border-t border-line/60 mt-4">
          <Button variant="ghost" onClick={() => setDeletingGroup(null)} disabled={busyDelete}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={busyDelete}>
            Delete Group
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Group Form Modal with Customer Multi-Select Picker
function GroupFormModal({
  open,
  group,
  allCustomers,
  onClose,
}: {
  open: boolean;
  group: CustomerGroupDto | null;
  allCustomers: CustomerDto[];
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    new Set(group?.members?.map((m) => m.customerId) ?? []),
  );
  const [pickerSearch, setPickerSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.mobileNumber.includes(q),
    );
  }, [allCustomers, pickerSearch]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCustomerIds(new Set(allCustomers.map((c) => c.id)));
  };

  const clearAll = () => {
    setSelectedCustomerIds(new Set());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        customerIds: Array.from(selectedCustomerIds),
      };

      if (group) {
        await api(`/customers/groups/${group.id}`, { method: 'PATCH', json: payload });
        toast.success('Group updated');
      } else {
        await api('/customers/groups', { method: 'POST', json: payload });
        toast.success('Group created');
      }

      invalidate('customer-groups');
      invalidate('customers');
      onClose();
    } catch (err) {
      toast.error('Could not save group', {
        description: (err as ApiError).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Edit Customer Group' : 'Create Customer Group'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. VIP Clients, Early Adopters, Tech Founders"
          icon={<Users className="size-4" />}
          required
          autoFocus
        />

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description of who belongs in this group..."
            className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-xs text-fg outline-none focus:ring-4 focus:ring-[var(--ring)] resize-none"
          />
        </label>

        {/* Member Picker */}
        <div className="space-y-2 pt-2 border-t border-line/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Add Customers ({selectedCustomerIds.size} selected)
            </span>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-muted">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted hover:text-fg font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex h-9 items-center gap-2 rounded-xl border border-line bg-elevated/60 px-3">
            <Search className="size-3.5 text-muted shrink-0" />
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search customers to add..."
              className="w-full bg-transparent text-xs text-fg placeholder:text-muted outline-none"
            />
          </div>

          <div className="no-scrollbar max-h-48 overflow-y-auto rounded-2xl border border-line p-1.5 space-y-1 bg-card/30">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted">No customers found</p>
            ) : (
              filtered.map((c) => {
                const selected = selectedCustomerIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCustomer(c.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition',
                      selected
                        ? 'bg-primary/10 border border-primary/30 text-fg'
                        : 'hover:bg-line text-muted hover:text-fg',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={c.name} size={28} />
                      <div className="min-w-0">
                        <p className="font-semibold text-fg truncate">{c.name}</p>
                        <p className="text-[10px] text-muted truncate">
                          {c.email || c.mobileNumber}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-lg border transition',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-line bg-card',
                      )}
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line/60">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {group ? 'Save Changes' : 'Create Group'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
