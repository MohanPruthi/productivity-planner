import React, { useState, useEffect, useRef } from 'react';
import Illustration from '../components/Illustration';
import { useAuth } from '../context/AuthContext';
import { Trash2, Plus, Phone, Calendar, CheckCircle, Circle, ExternalLink, Edit3, Save, X, FileText, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

const LinkedinIconCustom = ({ size = 14, color = "currentColor", style }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={style}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const HrDirectory = () => {
  const { getAuthHeaders } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modifiedContactIds, setModifiedContactIds] = useState(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Single Contact Form states
  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [hrLinkedin, setHrLinkedin] = useState('');
  const [companyLinkedin, setCompanyLinkedin] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk Import states
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Editing states (for inline edit)
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHrLinkedin, setEditHrLinkedin] = useState('');
  const [editCompanyLinkedin, setEditCompanyLinkedin] = useState('');

  const addToModified = (id) => {
    setModifiedContactIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Capitalize first letter of each word
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load contacts');
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Reset pagination page and clear modified ids list on search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
    setModifiedContactIds(new Set());
  }, [searchQuery, statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactName.trim()) {
      setFormError('Contact name is required');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          contactName: toTitleCase(contactName.trim()),
          phoneNumber: phoneNumber.trim() || null,
          email: email.trim() || null,
          status: 'Not Contacted',
          isContacted: false,
          hrLinkedin: hrLinkedin.trim() || null,
          companyLinkedin: companyLinkedin.trim() || null,
          notes: ''
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save contact');

      // Refresh data
      await fetchContacts();

      // Reset form
      setContactName('');
      setPhoneNumber('');
      setEmail('');
      setHrLinkedin('');
      setCompanyLinkedin('');
      setFormError('');
      // Close drawer after successful add
      setIsDrawerOpen(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      setBulkError('Data dump text is required');
      return;
    }
    setBulkError('');
    setBulkSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rawText: bulkText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import contacts');

      await fetchContacts();
      setBulkText('');
      setShowBulkModal(false);
      alert(data.message || 'Contacts imported successfully!');
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete contact');
      await fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete contact');
    }
  };

   const handleToggleContacted = async (contact) => {
    const nextContacted = !contact.isContacted;
    try {
      addToModified(contact.id);
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/${contact.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          isContacted: nextContacted,
          status: nextContacted ? 'Retry Call' : 'Not Contacted',
          interviewDate: null
        })
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      await fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      addToModified(id);
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus !== 'Interested' && { interviewDate: null })
        })
      });
      if (!res.ok) throw new Error('Failed to update status');
      await fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateInterviewDate = async (id, dateStr) => {
    try {
      addToModified(id);
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          interviewDate: dateStr || null
        })
      });
      if (!res.ok) throw new Error('Failed to update interview date');
      await fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (contact) => {
    setEditingId(contact.id);
    setEditName(contact.contactName);
    setEditPhone(contact.phoneNumber || '');
    setEditEmail(contact.email || '');
    setEditHrLinkedin(contact.hrLinkedin || '');
    setEditCompanyLinkedin(contact.companyLinkedin || '');
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) {
      alert('Contact name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr-contacts/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          contactName: toTitleCase(editName.trim()),
          phoneNumber: editPhone.trim() || null,
          email: editEmail.trim() || null,
          hrLinkedin: editHrLinkedin.trim() || null,
          companyLinkedin: editCompanyLinkedin.trim() || null
        })
      });

      if (!res.ok) throw new Error('Failed to update contact');
      setEditingId(null);
      await fetchContacts();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const getStatusColor = (status, isContacted) => {
    if (!isContacted) return 'var(--text-muted)';
    switch (status) {
      case 'Retry Call': return '#ff9500'; // Yellow/Orange
      case 'Resume Shared': return '#af52de'; // Purple
      case 'Wrong Number': return '#ff2d55'; // Pink/Rose
      case 'Rejected': return '#ff453a'; // Red
      case 'Interested': return '#30d158'; // Green
      default: return 'var(--text-muted)';
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Strip HR/hr text for company linkedin search
  const getCompanySearchName = (name) => {
    let clean = name.split('(')[0];
    clean = clean.replace(/\bhr\b/gi, '');
    clean = clean.replace(/[-:\s,]+$/g, '');
    clean = clean.replace(/^[-:\s,]+/g, '');
    return clean.trim();
  };

  // 1. Sort alphabetically and filter by default
  const sortedAndFilteredContacts = [...contacts]
    .filter(contact => {
      const matchesSearch = contact.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.phoneNumber && contact.phoneNumber.includes(searchQuery));
      
      // If it matches the search query and was modified in the current view session,
      // temporarily preserve it on the screen so its status can be edited without vanishing
      if (matchesSearch && modifiedContactIds.has(contact.id)) {
        return true;
      }

      if (statusFilter === 'All') return matchesSearch;
      if (statusFilter === 'Contacted') return matchesSearch && contact.isContacted;
      if (statusFilter === 'Pending') return matchesSearch && !contact.isContacted;
      return matchesSearch && contact.status === statusFilter;
    })
    .sort((a, b) => a.contactName.localeCompare(b.contactName));

  // 2. Pagination Calculations
  const totalContacts = sortedAndFilteredContacts.length;
  const totalPages = Math.ceil(totalContacts / itemsPerPage) || 1;

  // Self healing page bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedAndFilteredContacts.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="hr-directory-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner */}
      <header className="page-header tone-contacts">
        <div className="page-header-main">
          <div className="page-header-icon">
            <Phone size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Contacts</h1>
            <p className="page-header-subtitle">Job outreach, interviews and contacts</p>
          </div>
        </div>

        <button 
          onClick={() => setShowBulkModal(true)}
          className="ui-btn ui-btn-secondary"
        >
          <FileText size={15} />
          <span>Bulk import</span>
        </button>
      </header>

      {/* Flex container for listing and drawer */}
      <div style={{ display: 'flex', gap: isDrawerOpen ? '1.5rem' : '0', width: '100%', alignItems: 'start', transition: 'all 0.3s ease' }}>
        
        {/* Directory Listing Area (takes full width when drawer is closed) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, transition: 'all 0.3s ease' }}>
          
          {/* Filters Bar */}
          <div className="glass-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            
            {/* Search Input with plain cross icon wrapper */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                className="input-control"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingRight: '2rem' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0, maxWidth: '100%' }}>
              <div style={{
                display: 'flex',
                gap: '3px',
                background: 'transparent',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                flexShrink: 0,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                maxWidth: '100%',
                scrollbarWidth: 'none'
              }}>
                {['All', 'Pending', 'Contacted', 'Retry Call', 'Resume Shared', 'Wrong Number', 'Rejected', 'Interested'].map(f => {
                  const isActive = statusFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      style={{
                        padding: '0.22rem 0.55rem',
                        fontSize: '0.62rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isActive ? 'rgba(0, 122, 255, 0.18)' : 'transparent',
                        background: isActive ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
                        color: isActive ? '#007aff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.18s ease',
                        flexShrink: 0
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>

              {!isDrawerOpen && (
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="mirror-btn-pill directory-add-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  title="Open Add Drawer"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>

          {/* Block Rows Contact List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading && contacts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading contacts...</p>
            ) : currentItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Illustration name="contacts-empty" />
                <p style={{ margin: 0 }}>No contacts match this filter.</p>
              </div>
            ) : (
              currentItems.map(contact => {
                const isEditing = editingId === contact.id;
                const activeColor = getStatusColor(contact.status, contact.isContacted);
                return (
                  <div 
                    key={contact.id} 
                    className="glass-card" 
                    style={{ 
                      padding: '1.25rem 1.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.75rem',
                      borderLeft: `4px solid ${activeColor}`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    
                    {/* Top Row: Info/Edit Toggles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: '75%' }}>
                        <button
                          onClick={() => handleToggleContacted(contact)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                          title={contact.isContacted ? "Mark as Not Contacted" : "Mark as Contacted"}
                        >
                          {contact.isContacted ? (
                            <CheckCircle size={22} color="#30d158" fill="rgba(48,209,88,0.08)" />
                          ) : (
                            <Circle size={22} color="var(--text-muted)" />
                          )}
                        </button>

                        {isEditing ? (
                          <input
                            type="text"
                            className="input-control"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem', fontWeight: 600, width: '100%' }}
                          />
                        ) : (
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{contact.contactName}</span>
                              <span 
                                className="badge" 
                                style={{ 
                                  fontSize: '0.58rem',
                                  fontWeight: 600,
                                  color: activeColor,
                                  background: `${activeColor}12`,
                                  borderColor: `${activeColor}24`
                                }}
                              >
                                {contact.isContacted ? contact.status : 'Not Contacted'}
                              </span>
                            </h4>
                          </div>
                        )}
                      </div>

                      {/* Edit/Trash Actions */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(contact.id)}
                              style={{ background: 'transparent', border: 'none', color: '#30d158', cursor: 'pointer' }}
                              title="Save Changes"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              title="Cancel Edit"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(contact)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              className="btn-trash-hover"
                              title="Edit Contact"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(contact.id)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              className="btn-trash-hover"
                              title="Delete Contact"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Phone & Email Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Phone size={14} color="var(--text-muted)" />
                          {isEditing ? (
                            <input
                              type="text"
                              className="input-control"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="Phone number..."
                              style={{ padding: '0.15rem 0.4rem', width: '130px', fontSize: '0.75rem' }}
                            />
                          ) : (
                            <span>{contact.phoneNumber || 'No phone number'}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Mail size={14} color="var(--text-muted)" />
                          {isEditing ? (
                            <input
                              type="email"
                              className="input-control"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email address..."
                              style={{ padding: '0.15rem 0.4rem', width: '170px', fontSize: '0.75rem' }}
                            />
                          ) : (
                            <span>{contact.email || 'No email'}</span>
                          )}
                        </div>
                      </div>

                      {/* Contacted Sub-Status Options */}
                      {contact.isContacted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', animation: 'modalSlideUp 0.18s ease-out' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Outreach Status:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                              { label: 'Retry Call', value: 'Retry Call', activeColor: '#ff9500', bg: 'rgba(255,149,0,0.1)' },
                              { label: 'Resume Shared', value: 'Resume Shared', activeColor: '#af52de', bg: 'rgba(175,82,222,0.1)' },
                              { label: 'Wrong Number', value: 'Wrong Number', activeColor: '#ff2d55', bg: 'rgba(255,45,85,0.1)' },
                              { label: 'Rejected', value: 'Rejected', activeColor: '#ff453a', bg: 'rgba(255,69,58,0.1)' },
                              { label: 'Interested', value: 'Interested', activeColor: '#30d158', bg: 'rgba(48,209,88,0.1)' }
                            ].map(opt => {
                              const isSel = contact.status === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => handleUpdateStatus(contact.id, opt.value)}
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.65rem',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    borderColor: isSel ? opt.activeColor : 'var(--border-light)',
                                    background: isSel ? opt.bg : 'transparent',
                                    color: isSel ? opt.activeColor : 'var(--text-muted)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Inline calendar icon date picker if Interested */}
                          {contact.status === 'Interested' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem', padding: '1px 5px', border: '1px dashed rgba(48,209,88,0.25)', borderRadius: '4px', background: 'rgba(48,209,88,0.02)' }} title="Pick Interview Date">
                              <label htmlFor={`date-input-${contact.id}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Calendar size={13} color="#30d158" />
                              </label>
                              <input
                                id={`date-input-${contact.id}`}
                                type="date"
                                value={contact.interviewDate ? contact.interviewDate.split('T')[0] : ''}
                                onChange={(e) => handleUpdateInterviewDate(contact.id, e.target.value)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  width: '108px',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* LinkedIn & Link Integration */}
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '0.65rem' }}>
                      
                      {/* HR LinkedIn link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <LinkedinIconCustom size={14} color="#0a66c2" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>HR Profile:</span>
                        {isEditing ? (
                          <input
                            type="url"
                            className="input-control"
                            value={editHrLinkedin}
                            onChange={(e) => setEditHrLinkedin(e.target.value)}
                            placeholder="HR LinkedIn URL..."
                            style={{ padding: '0.15rem 0.4rem', width: '160px', fontSize: '0.75rem' }}
                          />
                        ) : contact.hrLinkedin ? (
                          <a 
                            href={contact.hrLinkedin} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '0.75rem', color: '#0a66c2', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          >
                            <span>Profile</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <a 
                            href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.contactName + ' HR')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px', border: '1px dashed var(--border-light)', padding: '1px 5px', borderRadius: '4px' }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#0a66c2'; e.currentTarget.style.color = '#0a66c2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>Search LinkedIn</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      {/* Company LinkedIn link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <LinkedinIconCustom size={14} color="#0077b5" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Company Page:</span>
                        {isEditing ? (
                          <input
                            type="url"
                            className="input-control"
                            value={editCompanyLinkedin}
                            onChange={(e) => setEditCompanyLinkedin(e.target.value)}
                            placeholder="Company LinkedIn URL..."
                            style={{ padding: '0.15rem 0.4rem', width: '160px', fontSize: '0.75rem' }}
                          />
                        ) : contact.companyLinkedin ? (
                          <a 
                            href={contact.companyLinkedin} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '0.75rem', color: '#0077b5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          >
                            <span>Company</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <a 
                            href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(getCompanySearchName(contact.contactName))}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px', border: '1px dashed var(--border-light)', padding: '1px 5px', borderRadius: '4px' }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#0077b5'; e.currentTarget.style.color = '#0077b5'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>Search Company</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}

            {/* Pagination Controls Bar */}
            {totalPages > 1 && (
              <div 
                className="glass-card" 
                style={{ 
                  padding: '0.75rem 1.25rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  marginTop: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.01)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>
                  Showing <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.min(indexOfFirstItem + 1, totalContacts)}</span> to <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.min(indexOfLastItem, totalContacts)}</span> of <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalContacts}</span> contacts
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="mirror-btn-pill"
                    style={{ 
                      padding: '0.35rem 0.65rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '2px', 
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer', 
                      opacity: currentPage === 1 ? 0.4 : 1, 
                      border: '1px solid var(--border-light)',
                      fontSize: '0.7rem'
                    }}
                  >
                    <ChevronLeft size={12} />
                    <span>Prev</span>
                  </button>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '70px', textAlign: 'center', fontSize: '0.75rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="mirror-btn-pill"
                    style={{ 
                      padding: '0.35rem 0.65rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '2px', 
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', 
                      opacity: currentPage === totalPages ? 0.4 : 1, 
                      border: '1px solid var(--border-light)',
                      fontSize: '0.7rem'
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Sliding Drawer Card */}
        <div style={{
          width: isDrawerOpen ? '350px' : '0px',
          opacity: isDrawerOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          pointerEvents: isDrawerOpen ? 'auto' : 'none'
        }}>
          <div className="glass-card" style={{ width: '350px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                <Plus size={16} color="#007aff" />
                <span>Add Contact</span>
              </h3>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formError && <div className="text-error" style={{ fontSize: '0.8rem' }}>{formError}</div>}

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact / Company Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. John Doe (Stigasoft) or Google HR..."
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number (Optional)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. +91 98765 43210..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email (Optional)</label>
                <input
                  type="email"
                  className="input-control"
                  placeholder="e.g. hr@company.com..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>HR LinkedIn Link (Optional)</label>
                <input
                  type="url"
                  className="input-control"
                  placeholder="https://www.linkedin.com/in/username..."
                  value={hrLinkedin}
                  onChange={(e) => setHrLinkedin(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Company LinkedIn Link (Optional)</label>
                <input
                  type="url"
                  className="input-control"
                  placeholder="https://www.linkedin.com/company/name..."
                  value={companyLinkedin}
                  onChange={(e) => setCompanyLinkedin(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="mirror-btn-pill directory-submit"
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  opacity: submitting ? 0.7 : 1
                }}
                disabled={submitting}
              >
                <span>{submitting ? 'Adding...' : 'Add Contact'}</span>
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="glass-card" style={{ maxWidth: '550px', width: '90%', animation: 'modalSlideUp 0.25s ease-out', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                <FileText size={18} color="#007aff" />
                <span>Bulk Import Contacts</span>
              </h3>
              <button 
                onClick={() => setShowBulkModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkImport} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {bulkError && <div className="text-error" style={{ fontSize: '0.8rem' }}>{bulkError}</div>}
              
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Paste your contact list below. Each contact should be on a new line.<br />
                The importer will automatically extract names and phone numbers.
              </p>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <textarea
                  rows="10"
                  className="input-control"
                  placeholder={`John Doe - +91 98765 43210&#10;Jane Smith: 123-456-7890&#10;Acme Corp HR&#10;...`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="mirror-btn-pill"
                  style={{ padding: '0.45rem 1rem', background: 'transparent', border: '1px solid var(--border-light)' }}
                >
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="mirror-btn-pill directory-submit"
                  style={{ padding: '0.45rem 1.25rem', opacity: bulkSubmitting ? 0.7 : 1 }}
                  disabled={bulkSubmitting}
                >
                  <span>{bulkSubmitting ? 'Importing...' : 'Import Data'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default HrDirectory;
