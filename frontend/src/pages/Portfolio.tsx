import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as portfolioRepository from '../repositories/portfolioRepository';
import { useAuth } from '../contexts/AuthContext';
import ProjectFormModal from '../components/ProjectFormModal';
import type { PortfolioItem } from '../types/index';

const Portfolio = () => {
  const { isAuthenticated } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProject, setEditingProject] = useState<PortfolioItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchPortfolio = async () => {
    try {
      const response = await portfolioRepository.getPortfolio(isAuthenticated);
      setPortfolio(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load portfolio items. Please make sure the backend is running.');
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [isAuthenticated]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setPortfolio((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);

      const orderUpdates = newOrder.map((item, index) => ({
        id: item.id,
        displayOrder: index,
      }));

      portfolioRepository.reorderProjects(orderUpdates).catch((err) => {
        showError('Failed to update order');
        console.error('Error reordering projects:', err);
      });

      return newOrder;
    });
  };

  const handleAddClick = () => {
    setModalMode('add');
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (project: PortfolioItem) => {
    setModalMode('edit');
    setEditingProject(project);
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleToggleVisibility = async (projectId: number) => {
    setActionLoading(projectId);
    setOpenMenuId(null);
    try {
      await portfolioRepository.toggleProjectVisibility(projectId);
      showSuccess('Visibility updated');
      await fetchPortfolio();
    } catch (err) {
      showError('Failed to toggle visibility');
      console.error('Error toggling visibility:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = async (projectId: number, title: string) => {
    setOpenMenuId(null);
    if (!confirm(`Delete "${title}"? This action cannot be undone.`)) return;

    setActionLoading(projectId);
    try {
      await portfolioRepository.deleteProject(projectId);
      showSuccess('Project deleted');
      await fetchPortfolio();
    } catch (err) {
      showError('Failed to delete project');
      console.error('Error deleting project:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-xl text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Admin: Add Project Button */}
        {isAuthenticated && (
          <div className="flex justify-end mb-6">
            <button
              onClick={handleAddClick}
              className="text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm"
              style={{ background: 'hsl(210, 65%, 60%)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(210, 55%, 52%)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'hsl(210, 65%, 60%)')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Project
            </button>
          </div>
        )}

        {/* Success/Error Messages */}
        {successMsg && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600 font-medium">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Project Grid with Drag-and-Drop */}
        {isAuthenticated ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={portfolio.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolio.map((item) => (
                  <ProjectCard
                    key={item.id}
                    project={item}
                    isAdmin={true}
                    onEdit={() => handleEditClick(item)}
                    onDelete={() => handleDeleteClick(item.id, item.title)}
                    onToggleVisibility={() => handleToggleVisibility(item.id)}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolio.map((item) => (
              <ProjectCard key={item.id} project={item} isAdmin={false} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {portfolio.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No projects available yet.</p>
          </div>
        )}
      </div>

      <ProjectFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        project={editingProject || undefined}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchPortfolio();
          showSuccess(modalMode === 'add' ? 'Project added' : 'Project updated');
        }}
      />
    </div>
  );
};

// ProjectCard Component
interface ProjectCardProps {
  project: PortfolioItem;
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  openMenuId?: number | null;
  setOpenMenuId?: (id: number | null) => void;
  actionLoading?: number | null;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isAdmin,
  onEdit,
  onDelete,
  onToggleVisibility,
  openMenuId,
  setOpenMenuId,
  actionLoading,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: !isAdmin,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-[#1e1e1e] rounded-lg shadow-md hover:shadow-xl border-2 ${
        project.isVisible ? 'border-transparent' : 'border-blue-200 dark:border-blue-800'
      } transition-all duration-300 overflow-hidden group relative`}
    >
      {/* Drag Handle (admin only) */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-700 rounded-full p-1.5 shadow-md cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
      )}

      {/* Three-dots Menu (admin only) */}
      {isAdmin && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => setOpenMenuId?.(openMenuId === project.id ? null : project.id)}
            disabled={actionLoading === project.id}
            className="bg-white dark:bg-gray-700 rounded-full p-1.5 shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {openMenuId === project.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId?.(null)} />
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                <button
                  onClick={onEdit}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={onToggleVisibility}
                  className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {project.isVisible ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                  {project.isVisible ? 'Hide' : 'Display'}
                </button>
                <button
                  onClick={onDelete}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-b-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden Badge (admin only) */}
      {isAdmin && !project.isVisible && (
        <div className="absolute top-2 left-12 z-10 text-white text-xs px-2 py-1 rounded-full shadow-md" style={{ background: 'hsl(210, 65%, 60%)' }}>
          Hidden
        </div>
      )}

      {/* Project Image — links to detail page */}
      {project.image_url && (
        <Link to={`/portfolio/${project.id}`} className="block relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={project.image_url}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
      )}

      {/* Card Content */}
      <div className="p-6">
        <Link to={`/portfolio/${project.id}`}>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-[hsl(210,65%,60%)] transition-colors">
            {project.title}
          </h3>
        </Link>
        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{project.description}</p>

        {/* Tech Stack */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.technologies.map((tech, index) => (
            <span
              key={index}
              className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Links */}
        <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 dark:text-gray-300 hover:text-[hsl(210,65%,60%)] font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          )}
          {project.live_url && (
            <a
              href={project.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 dark:text-gray-300 hover:text-[hsl(210,65%,60%)] font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Live Demo
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
