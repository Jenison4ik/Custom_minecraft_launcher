import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AnimatedFileUpload from "@/components/smoothui/animated-file-upload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel } from "@/components/smoothui/dialog";
import Skeleton from "@/components/smoothui/skeleton-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModsCatalogDialog } from "@/components/ModsCatalogDialog";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { api } from "@/lib/api";

type FileRow = { path: string; size: number };
type FilePage = { total: number; limit: number; offset: number; files: FileRow[] };
type PendingFile = { key: string; file: File; path: string };

const pageSize = 40;

function pendingPath(file: File): string {
  return (file.webkitRelativePath || file.name).replaceAll("\\", "/");
}

function isJar(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(".jar");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const files = useInfiniteQuery({
    queryKey: ["files", search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<FilePage>(
        `/admin/files?q=${encodeURIComponent(search)}&limit=${pageSize}&offset=${pageParam}`,
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.files.length, 0);
      if (lastPage.files.length === 0 || loaded >= lastPage.total) return undefined;
      return loaded;
    },
  });

  const rows = files.data?.pages.flatMap((page) => page.files) ?? [];
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
      if (items.some((item) => !item.path.trim())) throw new Error("Укажите путь для каждого файла");
      if (items.some((item) => !isJar(item.path))) throw new Error("Можно загружать только .jar");
      for (const item of items) {
        const body = new FormData();
        body.set("path", item.path.trim());
        body.set("file", item.file);
        await api("/admin/files", { method: "PUT", body });
      }
      return items.length;
    },
    onSuccess: async (count) => {
      toast.success(count === 1 ? "Файл сохранён" : `Сохранено файлов: ${count}`);
      setPending([]);
      setUploadKey((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (filePath: string) =>
      api("/admin/files", { method: "DELETE", body: JSON.stringify({ path: filePath }) }),
    onSuccess: async () => {
      toast.success("Файл удалён");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
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
            Файлы сборки и моды. Новые .jar попадают в список сразу после загрузки.
          </p>
        </div>
        <Button type="button" size="lg" onClick={() => setCatalogOpen(true)}>
          Загрузить моды
        </Button>
      </header>

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
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-base font-medium">Файлы</h2>
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
            placeholder="mods/sodium"
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
              <EmptyTitle>Файлов нет</EmptyTitle>
              <EmptyDescription>Загрузите .jar или добавьте мод из каталога.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {rows.length > 0 ? (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li
                key={row.path}
                className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 [content-visibility:auto] [contain-intrinsic-size:auto_3.5rem]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{row.path}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(row.size)}</p>
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
