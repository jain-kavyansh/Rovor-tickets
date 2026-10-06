"use client";
import { useState } from "react";
import { ProjectCard } from "@/components/project-card";
import { ProjectForm, TicketForm } from "@/components/forms";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, Skeleton, btnPrimary } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCreateProject, useCreateTicket, useProjects } from "@/lib/hooks";

function AddTicketModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const create = useCreateTicket(projectId);
  const toast = useToast();
  return (
    <Modal title={`New ticket · ${projectName}`} onClose={onClose}>
      <TicketForm
        submitLabel="Create ticket"
        onCancel={onClose}
        onSubmit={async (v) => {
          await create.mutateAsync(v);
          toast("success", "Ticket created");
          onClose();
        }}
      />
    </Modal>
  );
}

export default function DashboardPage() {
  const { data: projects, isPending, isError, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [ticketFor, setTicketFor] = useState<{ id: string; name: string } | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button className={btnPrimary} onClick={() => setShowNew(true)}>Create project</button>
      </div>

      {isPending ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : isError && !projects ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" hint="Create your first project to start tracking tickets." action={<button className={btnPrimary} onClick={() => setShowNew(true)}>Create project</button>} />
      ) : (
        <>
          {isError && <div className="mb-4"><ErrorState error={error} onRetry={() => refetch()} /></div>}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onAddTicket={() => setTicketFor({ id: p.id, name: p.name })} />
            ))}
          </div>
        </>
      )}

      {showNew && (
        <Modal title="New project" onClose={() => setShowNew(false)}>
          <ProjectForm
            onCancel={() => setShowNew(false)}
            onSubmit={async (v) => {
              await createProject.mutateAsync(v);
              toast("success", "Project created");
              setShowNew(false);
            }}
          />
        </Modal>
      )}
      {ticketFor && <AddTicketModal projectId={ticketFor.id} projectName={ticketFor.name} onClose={() => setTicketFor(null)} />}
    </div>
  );
}
