import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import Skeleton from "@/components/smoothui/skeleton-loader";
import { api } from "@/lib/api";

type LauncherFile = { name: string; size: number };
type LauncherInfo = { version: string | null; yml: string | null; files: LauncherFile[] };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BuildsPage() {
  const info = useQuery({
    queryKey: ["launcher"],
    queryFn: () => api<LauncherInfo>("/admin/launcher"),
  });

  const published = Boolean(info.data?.version || info.data?.yml || (info.data?.files.length ?? 0) > 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Сборки</h1>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Уже опубликованный установщик лаунчера: версия, файлы и latest.yml.
        </p>
      </header>
      {info.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{info.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {info.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {info.isSuccess && !published ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Опубликованных сборок нет</EmptyTitle>
            <EmptyDescription>Загрузите ZIP установщика на странице лаунчера.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/launcher">Опубликовать</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}
      {info.isSuccess && published && info.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Текущая сборка</CardTitle>
            <CardDescription>
              {info.data.version ? (
                <span className="inline-flex items-center gap-2">
                  Версия
                  <Badge variant="secondary">{info.data.version}</Badge>
                </span>
              ) : (
                "Версия не задана"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {info.data.files.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {info.data.files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                  >
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="shrink-0 text-sm text-muted-foreground">{formatSize(file.size)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Файлов в каталоге лаунчера нет.</p>
            )}
            {info.data.yml ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">latest.yml</h2>
                <ScrollArea className="h-48 rounded-lg border">
                  <pre className="p-4 font-mono text-xs whitespace-pre-wrap">{info.data.yml}</pre>
                </ScrollArea>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
