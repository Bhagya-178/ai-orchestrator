"use client";

import React, { useState, useEffect } from "react";
import { X, Users, Plus, Shield, ShieldAlert, History, Mail, UserPlus, Check, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";
import { Workspace, AuditLog } from "@/app/lib/types";
import { listWorkspaces, createWorkspace, getWorkspace, addWorkspaceMember, getWorkspaceAuditLogs } from "@/app/lib/api/workspaces";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspaceId?: string;
  onSelectWorkspace?: (workspace: Workspace) => void;
}

export default function WorkspaceModal({ isOpen, onClose, currentWorkspaceId, onSelectWorkspace }: WorkspaceModalProps) {
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "audit" | "create">("members");

  // Create Workspace Form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadWorkspaces = async () => {
    try {
      const data = await listWorkspaces();
      setWorkspaces(data);
      if (data.length > 0) {
        const initial = data.find((w) => w.id === currentWorkspaceId) || data[0];
        const full = await getWorkspace(initial.id);
        setActiveWorkspace(full);
      }
    } catch (err) {
      console.error("Failed loading workspaces:", err);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadWorkspaces();
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    if (activeWorkspace && activeTab === "audit") {
      getWorkspaceAuditLogs(activeWorkspace.id).then(setAuditLogs).catch(console.error);
    }
  }, [activeWorkspace, activeTab]);

  if (!isOpen) return null;

  const handleSelectWorkspace = async (w: Workspace) => {
    const full = await getWorkspace(w.id);
    setActiveWorkspace(full);
    if (onSelectWorkspace) onSelectWorkspace(full);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await createWorkspace({ name: newName.trim(), description: newDesc.trim() });
      setNewName("");
      setNewDesc("");
      await loadWorkspaces();
      const full = await getWorkspace(created.id);
      setActiveWorkspace(full);
      setActiveTab("members");
    } catch (err: any) {
      alert(`Error creating workspace: ${err.message}`);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    try {
      await addWorkspaceMember(activeWorkspace.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      const full = await getWorkspace(activeWorkspace.id);
      setActiveWorkspace(full);
    } catch (err: any) {
      alert(`Error inviting member: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Multi-Tenant Workspaces & RBAC</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Team collaboration, role-based permissions, and immutable audit logs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-black/5 dark:to-white/5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              Team Workspaces & RBAC
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Sign In to Collaborate
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mb-6 leading-relaxed">
              Multi-tenant team workspaces, role-based access control (Admin, Member, Viewer), and immutable security audit logs require an authenticated user account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full mb-8 text-left text-xs">
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] flex items-start gap-2.5">
                <Users className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Team Member Invites</div>
                  <div className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">Invite team members by email and assign granular permissions across workspaces.</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] flex items-start gap-2.5">
                <History className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Audit Trail Logging</div>
                  <div className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">Track administrative changes, document uploads, and security events.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all"
              >
                Sign In to Workspaces
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setAuthModalMode("register");
                  setShowAuthModal(true);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Workspace List */}
            <div className="w-64 border-r border-[var(--border)] p-4 space-y-3 flex flex-col bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Your Workspaces</span>
                <button
                  onClick={() => setActiveTab("create")}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md"
                  title="Create Workspace"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

            <div className="space-y-1 flex-1 overflow-y-auto">
              {workspaces.map((w) => {
                const isSelected = activeWorkspace?.id === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelectWorkspace(w)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Main Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "create" ? (
              <div className="p-6 max-w-lg space-y-4 text-xs">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Create New Workspace</h3>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Workspace Name</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Acme AI Research Team"
                      className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Purpose or team scope..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)]"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("members")}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm"
                    >
                      Create Workspace
                    </button>
                  </div>
                </form>
              </div>
            ) : activeWorkspace ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Workspace Header */}
                <div className="px-6 py-3 border-b border-[var(--border)] flex items-center justify-between bg-black/[0.01]">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{activeWorkspace.name}</h3>
                    <span className="text-[11px] text-gray-500 font-mono">{activeWorkspace.slug}</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setActiveTab("members")}
                      className={`px-3 py-1 rounded-lg ${
                        activeTab === "members" ? "bg-white dark:bg-black/40 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"
                      }`}
                    >
                      Members ({activeWorkspace.members?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab("audit")}
                      className={`px-3 py-1 rounded-lg ${
                        activeTab === "audit" ? "bg-white dark:bg-black/40 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"
                      }`}
                    >
                      Audit Trail
                    </button>
                  </div>
                </div>

                {activeTab === "members" ? (
                  <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs">
                    {/* Invite form */}
                    <form onSubmit={handleInvite} className="p-3.5 rounded-xl border border-[var(--border)] bg-black/[0.02] flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Teammate's email address..."
                          className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                        />
                      </div>
                      <select
                        value={inviteRole}
                        onChange={(e: any) => setInviteRole(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </button>
                    </form>

                    {/* Member list */}
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border)] text-gray-500 text-[11px]">
                          <tr>
                            <th className="px-4 py-2 font-medium">User</th>
                            <th className="px-4 py-2 font-medium">Role</th>
                            <th className="px-4 py-2 font-medium">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {activeWorkspace.members?.map((m) => (
                            <tr key={m.user_id}>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-gray-900 dark:text-white">{m.full_name || "User"}</div>
                                <div className="text-[11px] text-gray-400">{m.email}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                                  m.role === "owner" ? "bg-purple-500/10 text-purple-600" :
                                  m.role === "admin" ? "bg-blue-500/10 text-blue-600" : "bg-black/5 text-gray-600"
                                }`}>
                                  {m.role}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-[11px]">
                                {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "Active"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Audit Logs */
                  <div className="flex-1 p-6 overflow-y-auto text-xs">
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border)] text-gray-500 text-[11px]">
                          <tr>
                            <th className="px-4 py-2 font-medium">Action</th>
                            <th className="px-4 py-2 font-medium">User / Resource</th>
                            <th className="px-4 py-2 font-medium">Details</th>
                            <th className="px-4 py-2 font-medium">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                No audit events logged for this workspace.
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map((l) => (
                              <tr key={l.id}>
                                <td className="px-4 py-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                                  {l.action}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 text-[11px]">
                                  {l.resource_type ? `${l.resource_type}:${l.resource_id?.slice(0, 8)}` : "system"}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                                  {JSON.stringify(l.details)}
                                </td>
                                <td className="px-4 py-2.5 text-gray-400 text-[11px]">
                                  {new Date(l.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                Select or create a workspace
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
