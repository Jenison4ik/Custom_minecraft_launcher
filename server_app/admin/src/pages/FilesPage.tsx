import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AnimatedFileUpload from "@/components/smoothui/animated-file-upload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel } from "@/components/smoothui/dialog";
import Skeleton from "@/components/smoothui/skeleton-loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModsCatalogDialog } from "@/components/ModsCatalogDialog";
import { PackProfileSection } from "@/components/PackProfileSection";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { api } from "@/lib/api";

type ModRow = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  path: string;
  iconDataUrl: string | null;
};
type ModPage = { total: number; limit: number; offset: number; mods: ModRow[] };
type ModIssue = { modName: string; message: string };
type PendingFile = { key: string; file: File; path: string };

const pageSize = 40;
const visibleIssues = 3;

function toModPath(filePath: string): string {
  const normalized = filePath.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "mods" || lower.startsWith("mods/")) return normalized;
  return `mods/${normalized}`;
}

function pendingPath(file: File): string {
  return toModPath(file.webkitRelativePath || file.name);
}

function isJar(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(".jar");
}

export function FilesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const issues = useQuery({
    queryKey: ["mod-issues"],
    queryFn: () => api<{ issues: ModIssue[] }>("/admin/mods/issues"),
  });
  const issueList = issues.data?.issues ?? [];
  const shownIssues = issueList.slice(0, visibleIssues);
  const hiddenIssues = issueList.slice(visibleIssues);

  const files = useInfiniteQuery({
    queryKey: ["mods", search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<ModPage>(
        `/admin/mods?q=${encodeURIComponent(search)}&limit=${pageSize}&offset=${pageParam}`,
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.mods.length, 0);
      if (lastPage.mods.length === 0 || loaded >= lastPage.total) return undefined;
      return loaded;
    },
  });

  const rows = files.data?.pages.flatMap((page) => page.mods) ?? [];
  const total = files.data?.pages[0]?.total ?? 0;
  const sentinel = useInfiniteScroll(
    Boolean(files.hasNextPage && !files.isFetchingNextPage),
    () => {
      void files.fetchNextPage();
    },
  );

  const upload = useMutation({
    mutationFn: async (items: PendingFile[]) => {
      if (items.length === 0) throw new Error("Выберите файлы");
      const uploads = items.map((item) => ({ ...item, path: toModPath(item.path) }));
      if (uploads.some((item) => !item.path)) throw new Error("Укажите путь для каждого файла");
      if (uploads.some((item) => !isJar(item.path))) throw new Error("Можно загружать только .jar");
      for (const item of uploads) {
        const body = new FormData();
        body.set("path", item.path);
        body.set("file", item.file);
        await api("/admin/files", { method: "PUT", body });
      }
      return items.length;
    },
    onSuccess: async (count) => {
      toast.success(count === 1 ? "Файл сохранён" : `Сохранено файлов: ${count}`);
      setPending([]);
      setUploadKey((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: ["mods"] });
      await queryClient.invalidateQueries({ queryKey: ["mod-issues"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (filePath: string) =>
      api("/admin/files", { method: "DELETE", body: JSON.stringify({ path: filePath }) }),
    onSuccess: async () => {
      toast.success("Файл удалён");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["mods"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-mods"] });
      await queryClient.invalidateQueries({ queryKey: ["mod-issues"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onUpload(event: FormEvent) {
    event.preventDefault();
    upload.mutate(pending);
  }

  function onFiles(list: File[]) {
    const jars = list.filter((file) => isJar(file.name) || isJar(file.webkitRelativePath));
    if (jars.length !== list.length) toast.error("Можно загружать только .jar");
    setPending((current) =>
      jars.map((file, index) => {
        const previous = current.find((item) => item.file === file);
        return {
          key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          file,
          path: previous?.path ?? pendingPath(file),
        };
      }),
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Сборка</h1>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Моды сборки. Новые .jar из папки mods попадают в список сразу после загрузки.
          </p>
        </div>
        <Button type="button" size="lg" onClick={() => setCatalogOpen(true)}>
          Загрузить моды
        </Button>
      </header>

      <PackProfileSection />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-medium">Добавить .jar</h2>
        <form className="flex flex-col gap-4" onSubmit={onUpload}>
          <AnimatedFileUpload
            key={uploadKey}
            accept=".jar,application/java-archive"
            dropLabel="Отпустите файлы"
            hint="Только .jar"
            idleLabel="Перетащите файлы или нажмите, чтобы выбрать"
            inputId="file-blob"
            inputLabel="Файлы .jar"
            multiple
            onFilesSelected={onFiles}
          />
          {pending.length > 0 ? (
            <div className="grid gap-4">
              {pending.map((item) => (
                <div key={item.key} className="grid gap-2">
                  <Label htmlFor={`path-${item.key}`}>Путь</Label>
                  <Input
                    id={`path-${item.key}`}
                    value={item.path}
                    onChange={(event) =>
                      setPending((current) =>
                        current.map((entry) =>
                          entry.key === item.key ? { ...entry, path: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <Button type="submit" size="lg" disabled={upload.isPending || pending.length === 0}>
              {pending.length > 1 ? `Загрузить ${pending.length}` : "Загрузить"}
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        {issues.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{issues.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {issueList.length > 0 ? (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <AlertTitle>Проблемы модов</AlertTitle>
            <AlertDescription>
              <ul className="grid gap-1">
                {shownIssues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
              {hiddenIssues.length > 0 ? (
                <Collapsible className="mt-2">
                  <CollapsibleContent>
                    <ul className="grid gap-1 pb-2">
                      {hiddenIssues.map((issue) => (
                        <li key={issue.message}>{issue.message}</li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive">
                      <span className="in-data-[state=open]:hidden">Показать ещё {hiddenIssues.length}</span>
                      <span className="hidden in-data-[state=open]:inline">Скрыть</span>
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-base font-medium">Моды</h2>
          <p className="text-sm text-muted-foreground">{total}</p>
        </div>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Label htmlFor="file-search">Поиск</Label>
          <Input
            id="file-search"
            value={q}
            placeholder="sodium"
            onChange={(event) => setQ(event.target.value)}
          />
        </form>

        {files.isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : null}
        {files.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{files.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {files.isSuccess && rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Модов нет</EmptyTitle>
              <EmptyDescription>Загрузите .jar в mods или добавьте мод из каталога.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {rows.length > 0 ? (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
              >
                {row.iconDataUrl ? (
                  <img src={row.iconDataUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="size-10 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  {row.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
                  ) : null}
                  <p className="truncate text-xs text-muted-foreground">{row.fileName}</p>
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDelete(row.path)}>
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div ref={sentinel} className="h-8">
          {files.isFetchingNextPage ? <Skeleton className="h-14 w-full" /> : null}
        </div>
      </section>

      <ModsCatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
      <AlertDialog
        open={pendingDelete !== null}
        title="Удалить файл?"
        description={pendingDelete ?? ""}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        footer={
          <>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
              }}
            >
              Удалить
            </AlertDialogAction>
          </>
        }
      />
    </div>
  );
}
