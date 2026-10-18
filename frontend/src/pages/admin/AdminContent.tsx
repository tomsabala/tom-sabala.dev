/**
 * Content: the homepage work order on the left, the About paragraph and the CV PDF versions
 * on the right.
 *
 * Reordering is a pointer drag with a 200 ms / 8 px activation constraint — without it a
 * touch drag on a phone would be swallowed by the list instead of scrolling the page.
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as portfolioRepository from '../../repositories/portfolioRepository.ts';
import * as aboutRepository from '../../repositories/aboutRepository.ts';
import { apiErrorMessage } from '../../repositories/apiError.ts';
import ProjectFormModal from '../../components/ProjectFormModal.tsx';
import AboutFormModal from '../../components/AboutFormModal.tsx';
import PdfUploadForm from '../../components/PdfUploadForm.tsx';
import PdfHistoryList from '../../components/PdfHistoryList.tsx';
import {
  ConsolePanel,
  EmptyState,
  MonoButton,
  MutedLine,
  PanelHead,
} from '../../components/console.tsx';
import type { AboutData, PortfolioItem } from '../../types/index.ts';
import { useAdminAction, useAdminChrome, usePrimaryAction } from './chrome.tsx';

function ProjectRow({
  project,
  index,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  project: PortfolioItem;
  index: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-ln bg-bg"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 basis-[200px]">
        <button
          type="button"
          aria-label={`Reorder ${project.title}`}
          className="text-mut font-mono text-[14px] leading-none cursor-grab bg-transparent border-0 p-1 touch-none"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <span className="font-mono text-[12px] leading-none text-mut w-7 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold text-[17px] leading-tight truncate">{project.title}</span>
          <span className="font-mono text-[11px] leading-none text-mut truncate">
            {project.field || 'no field'} · specimen: {project.specimen || '—'}
            {project.slug ? ` · /work/${project.slug}` : ''}
          </span>
        </div>
      </div>
      <div className="flex gap-2 justify-end items-center">
        <MonoButton
          tone={project.isVisible ? 'accent' : 'muted'}
          onClick={onToggle}
          disabled={busy}
          className="uppercase tracking-[0.1em]"
        >
          {project.isVisible ? 'PUBLIC' : 'HIDDEN'}
        </MonoButton>
        <MonoButton onClick={onEdit}>Edit</MonoButton>
        <MonoButton tone="muted" onClick={onDelete} disabled={busy}>
          Delete
        </MonoButton>
      </div>
    </div>
  );
}

export default function AdminContent(): JSX.Element {
  const { notify, refreshStats } = useAdminChrome();
  const act = useAdminAction();
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [about, setAbout] = useState<AboutData | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [projectModal, setProjectModal] = useState<{ mode: 'add' | 'edit'; project?: PortfolioItem } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pdfTick, setPdfTick] = useState(0);

  usePrimaryAction({ label: '+ Project', onClick: () => setProjectModal({ mode: 'add' }) }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadProjects = async () => {
    try {
      const res = await portfolioRepository.getPortfolio(true);
      if (res.success) setProjects(res.data as PortfolioItem[]);
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not load projects'));
    }
  };

  const loadAbout = async () => {
    try {
      const res = await aboutRepository.getAbout();
      if (res.success) setAbout(res.data as AboutData);
    } catch {
      setAbout(null);
    }
  };

  useEffect(() => {
    loadProjects();
    loadAbout();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex(p => p.id === active.id);
    const newIndex = projects.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = projects;
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);
    const result = await act(
      () => portfolioRepository.reorderProjects(next.map((p, i) => ({ id: p.id, displayOrder: i + 1 }))),
      { failure: 'Could not save the new order', success: 'Order saved' }
    );
    if (!result) setProjects(previous);
  };

  const toggleVisibility = async (project: PortfolioItem) => {
    setBusyId(project.id);
    const nextVisible = !project.isVisible;
    const result = await act(
      () => portfolioRepository.setProjectVisibility(project.id, nextVisible),
      { failure: 'Could not change visibility' }
    );
    setBusyId(null);
    if (!result) return;
    setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, isVisible: nextVisible } : p)));
    refreshStats();
  };

  const deleteProject = async (project: PortfolioItem) => {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setBusyId(project.id);
    const result = await act(() => portfolioRepository.deleteProject(project.id), {
      failure: 'Could not delete the project',
      success: 'Project deleted',
    });
    setBusyId(null);
    if (!result) return;
    await loadProjects();
    refreshStats();
  };

  return (
    <>
      <div
        className="grid gap-5 items-start"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}
      >
        <ConsolePanel>
          <PanelHead
            label="SELECTED WORK · ORDER = HOMEPAGE ORDER"
            right={
              <span className="font-mono text-[11px] leading-none text-mut whitespace-nowrap">
                drag ⋮⋮ to reorder
              </span>
            }
          />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {projects.map((project, index) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  index={index}
                  busy={busyId === project.id}
                  onEdit={() => setProjectModal({ mode: 'edit', project })}
                  onToggle={() => toggleVisibility(project)}
                  onDelete={() => deleteProject(project)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {projects.length === 0 && <EmptyState>No projects yet.</EmptyState>}
        </ConsolePanel>

        <div className="flex flex-col gap-5 min-w-0">
          <ConsolePanel className="p-5 flex flex-col gap-3">
            <PanelHead
              label="ABOUT · SHOWN IN SECTION 03"
              padded={false}
              right={<MonoButton onClick={() => setAboutOpen(true)}>Edit</MonoButton>}
            />
            <div className="border border-ln bg-s1 p-3.5 text-[15px] leading-[1.55] text-ink whitespace-pre-line">
              {about?.content || 'Nothing written yet.'}
            </div>
            <MutedLine>
              {about?.updatedAt
                ? `Last saved ${new Date(about.updatedAt).toLocaleString()} · synced to terminal \`about\``
                : 'Synced to the terminal `about` command'}
            </MutedLine>
          </ConsolePanel>

          <ConsolePanel>
            <PanelHead label="CV · PDF VERSIONS" />
            <div className="p-5 flex flex-col gap-5">
              <PdfUploadForm
                onUploadSuccess={() => {
                  notify('ok', 'PDF uploaded and activated');
                  setPdfTick(t => t + 1);
                  refreshStats();
                }}
                onUploadError={message => notify('err', message)}
              />
              <PdfHistoryList
                key={pdfTick}
                onVersionChange={refreshStats}
                onError={message => notify('err', message)}
              />
            </div>
          </ConsolePanel>
        </div>
      </div>

      <ProjectFormModal
        isOpen={projectModal !== null}
        mode={projectModal?.mode ?? 'add'}
        project={projectModal?.project}
        onClose={() => setProjectModal(null)}
        onSuccess={async () => {
          notify('ok', projectModal?.mode === 'edit' ? 'Project updated' : 'Project added');
          setProjectModal(null);
          await loadProjects();
          refreshStats();
        }}
      />

      <AboutFormModal
        isOpen={aboutOpen}
        currentData={about}
        onClose={() => setAboutOpen(false)}
        onSuccess={async () => {
          notify('ok', 'About updated');
          setAboutOpen(false);
          await loadAbout();
        }}
      />
    </>
  );
}
