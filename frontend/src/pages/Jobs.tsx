import { useEffect, useState } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import CompanyFormModal from '../components/CompanyFormModal.tsx';
import JobApplicationFormModal from '../components/JobApplicationFormModal.tsx';
import type { Company, JobApplication } from '../types/index.ts';

const VALID_STATUSES = [
  'bookmarked', 'applied', 'in_review', 'interview', 'offer', 'rejected', 'withdrawn', 'closed',
];

const STATUS_LABELS: Record<string, string> = {
  bookmarked: 'Bookmarked',
  applied: 'Applied',
  in_review: 'In Review',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  bookmarked: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  applied: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  interview: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  offer: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  withdrawn: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  closed: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function Jobs() {
  const [activeTab, setActiveTab] = useState<'companies' | 'applications'>('companies');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const fetchData = async () => {
    try {
      const [companiesRes, applicationsRes] = await Promise.all([
        jobsRepository.getCompanies(),
        jobsRepository.getApplications(),
      ]);
      setCompanies(companiesRes.data);
      setApplications(applicationsRes.data);
      setError(null);
    } catch (err) {
      setError('Failed to load data. Please make sure the backend is running.');
      console.error('Error fetching jobs data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close three-dot menu on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuId]);

  const handleDeleteCompany = async (company: Company) => {
    setOpenMenuId(null);
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return;
    try {
      const response = await jobsRepository.deleteCompany(company.id);
      if (response.success) {
        showSuccess('Company deleted');
        await fetchData();
      } else {
        showError(response.error || 'Failed to delete company');
      }
    } catch {
      showError('Failed to delete company');
    }
  };

  const handleDeleteApplication = async (application: JobApplication) => {
    setOpenMenuId(null);
    if (!confirm(`Delete application for "${application.position}" at ${application.company_name}? This cannot be undone.`)) return;
    try {
      const response = await jobsRepository.deleteApplication(application.id);
      if (response.success) {
        showSuccess('Application deleted');
        await fetchData();
      } else {
        showError(response.error || 'Failed to delete application');
      }
    } catch {
      showError('Failed to delete application');
    }
  };

  const filteredApplications =
    statusFilter === 'all'
      ? applications
      : applications.filter(a => a.status === statusFilter);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-xl text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Job Tracking
        </h1>

        {/* Toast messages */}
        {successMsg && (
          <div className="mb-6 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Tab bar + Add button */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('companies')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'companies'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Companies
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                {companies.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'applications'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Applications
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                {applications.length}
              </span>
            </button>
          </div>
          <div className="pb-3">
            {activeTab === 'companies' ? (
              <button
                onClick={() => { setModalMode('add'); setEditingCompany(null); setIsCompanyModalOpen(true); }}
                className="text-white font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm"
                style={{ background: 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Company
              </button>
            ) : (
              <button
                onClick={() => { setModalMode('add'); setEditingApplication(null); setIsApplicationModalOpen(true); }}
                className="text-white font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm"
                style={{ background: 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Application
              </button>
            )}
          </div>
        </div>

        {/* Companies tab */}
        {activeTab === 'companies' && (
          <div>
            {companies.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-sm">No companies yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center gap-4 py-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {company.name}
                        </span>
                        {company.url && (
                          <a
                            href={company.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[var(--accent)] transition-colors"
                            title="Open website"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      {company.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{company.notes}</p>
                      )}
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === company.id ? null : company.id); }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Actions"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      {openMenuId === company.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                            <button
                              onClick={() => { setModalMode('edit'); setEditingCompany(company); setIsCompanyModalOpen(true); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCompany(company)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Applications tab */}
        {activeTab === 'applications' && (
          <div>
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                style={statusFilter === 'all' ? { background: 'var(--accent)' } : undefined}
              >
                All ({applications.length})
              </button>
              {VALID_STATUSES.map(s => {
                const count = applications.filter(a => a.status === s).length;
                if (count === 0) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? 'text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    style={statusFilter === s ? { background: 'var(--accent)' } : undefined}
                  >
                    {STATUS_LABELS[s]} ({count})
                  </button>
                );
              })}
            </div>

            {filteredApplications.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">
                  {statusFilter === 'all' ? 'No applications yet. Add one to get started.' : `No applications with status "${STATUS_LABELS[statusFilter]}".`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredApplications.map(app => (
                  <div key={app.id} className="flex items-center gap-4 py-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {app.position}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">at</span>
                        <span className="text-gray-700 dark:text-gray-300 text-sm">
                          {app.company_name}
                        </span>
                        {app.job_url && (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[var(--accent)] transition-colors"
                            title="Open job posting"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] || STATUS_COLORS.bookmarked}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                        {app.date_applied && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Applied {app.date_applied}
                          </span>
                        )}
                        {app.notes && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs hidden sm:block">
                            {app.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === app.id ? null : app.id); }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Actions"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      {openMenuId === app.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                            <button
                              onClick={() => { setModalMode('edit'); setEditingApplication(app); setIsApplicationModalOpen(true); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteApplication(app)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CompanyFormModal
        isOpen={isCompanyModalOpen}
        mode={modalMode}
        company={editingCompany ?? undefined}
        onClose={() => setIsCompanyModalOpen(false)}
        onSuccess={async () => {
          setIsCompanyModalOpen(false);
          showSuccess(modalMode === 'add' ? 'Company added' : 'Company updated');
          await fetchData();
        }}
      />

      <JobApplicationFormModal
        isOpen={isApplicationModalOpen}
        mode={modalMode}
        application={editingApplication ?? undefined}
        onClose={() => setIsApplicationModalOpen(false)}
        onSuccess={async () => {
          setIsApplicationModalOpen(false);
          showSuccess(modalMode === 'add' ? 'Application added' : 'Application updated');
          await fetchData();
        }}
      />
    </div>
  );
}

export default Jobs;
