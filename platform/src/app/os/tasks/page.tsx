import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader, Pill, INPUT, SELECT } from "../_components/ui";
import { createTask, toggleTaskDone, setTaskPriority, deleteTask } from "./actions";
import { AutoSubmitSelect } from "../_components/auto-submit-select";

export const dynamic = "force-dynamic";

// A horizontal board, one column per list. Categories are free text (not an
// enum) so a new list is just a task using a new category — nothing to
// migrate. DEFAULT_CATEGORIES sets the columns that always show, even
// empty, so there's always somewhere to drop a task; any other category
// already in use gets its own column too, appended after.

const DEFAULT_CATEGORIES = ["Operations", "Member Comms", "Purchase", "Sponsorships", "Website", "Subscriptions"];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { high: "danger", medium: "warning", low: "neutral" };

function formatDue(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export default async function TasksPage() {
  const actor = await requireCapability("tasks.view");
  const canManage = can(actor, "tasks.manage");

  const tasks = await prisma.task.findMany({ where: { status: { not: "cancelled" } }, orderBy: { createdAt: "asc" } });

  const categories = [
    ...DEFAULT_CATEGORIES,
    ...[...new Set(tasks.map((t) => t.category))].filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Courts OS"
        title="Tasks"
        subtitle="Whatever needs doing, dropped into the list it belongs to."
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {categories.map((category) => {
          const inList = tasks.filter((t) => t.category === category);
          const open = inList
            .filter((t) => t.status === "open")
            .sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || a.createdAt.getTime() - b.createdAt.getTime());
          const done = inList.filter((t) => t.status === "done");

          return (
            <div key={category} className="flex w-[300px] shrink-0 flex-col rounded-xl border border-gray-mid bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-gray-mid px-3.5 py-3">
                <h2 className="os-eyebrow text-gray-dark">{category}</h2>
                <span className="text-neutral">{open.length}</span>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {open.length === 0 && done.length === 0 && (
                  <p className="px-1 py-2 text-xs text-gray-dark">Nothing here yet.</p>
                )}

                {open.map((t) => (
                  <div key={t.id} className="rounded-lg border border-gray-mid p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <form action={toggleTaskDone} className="flex flex-1 items-start gap-2">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          disabled={!canManage}
                          aria-label="Mark done"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-gray-mid hover:border-orange disabled:cursor-not-allowed"
                        />
                        <span className="text-sm font-medium text-near-black">{t.title}</span>
                      </form>
                      {canManage && (
                        <form action={deleteTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="shrink-0 text-xs text-gray-dark hover:text-danger" aria-label="Delete task">
                            ✕
                          </button>
                        </form>
                      )}
                    </div>
                    {t.detail && <p className="mt-1 whitespace-pre-line pl-6 text-xs text-gray-dark">{t.detail}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                      {canManage ? (
                        <form action={setTaskPriority} className="flex items-center">
                          <input type="hidden" name="id" value={t.id} />
                          <AutoSubmitSelect
                            name="priority"
                            defaultValue={t.priority}
                            className={`min-h-6 rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              t.priority === "high" ? "bg-danger-bg text-danger" : t.priority === "medium" ? "bg-orange/10 text-orange" : "bg-warm-stone text-gray-dark"
                            }`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </AutoSubmitSelect>
                        </form>
                      ) : (
                        <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                      )}
                      {t.dueDate && <span className="text-[11px] text-gray-dark">Due {formatDue(t.dueDate)}</span>}
                    </div>
                  </div>
                ))}

                {done.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer px-1 text-xs text-gray-dark">{done.length} done</summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {done.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-mid px-2.5 py-1.5">
                          <form action={toggleTaskDone} className="flex flex-1 items-center gap-2">
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              disabled={!canManage}
                              aria-label="Mark not done"
                              className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-green-600 bg-green-600 disabled:cursor-not-allowed"
                            />
                            <span className="text-xs text-gray-dark line-through">{t.title}</span>
                          </form>
                          {canManage && (
                            <form action={deleteTask}>
                              <input type="hidden" name="id" value={t.id} />
                              <button className="shrink-0 text-xs text-gray-dark hover:text-danger" aria-label="Delete task">
                                ✕
                              </button>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {canManage && (
                <form action={createTask} className="flex flex-col gap-1.5 border-t border-gray-mid p-3">
                  <input type="hidden" name="category" value={category} />
                  <input name="title" placeholder="Add a task…" required className={`${INPUT} min-h-8 text-xs`} />
                  <div className="flex gap-1.5">
                    <select name="priority" defaultValue="medium" className={`${SELECT} min-h-8 flex-1 text-xs`}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <input type="date" name="dueDate" className={`${INPUT} min-h-8 flex-1 text-xs`} />
                  </div>
                  <button className="os-heading min-h-8 rounded-lg border border-gray-mid bg-white text-xs uppercase tracking-wide hover:border-near-black">
                    Add
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
