import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { api } from "@/lib/api";

type Source = "modrinth" | "curseforge";
type Loader = "fabric" | "forge" | "neoforge" | "quilt";

type CatalogHit = { id: string; title: string; description: string; iconUrl: string | null };
type CatalogPage = { total: number; hits: CatalogHit[] };

const loaders: { value: Loader; label: string }[] = [
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "neoforge", label: "NeoForge" },
  { value: "quilt", label: "Quilt" },
];

export function ModsCatalogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<Source>("modrinth");
  const [gameVersion, setGameVersion] = useState("");
  const [loader, setLoader] = useState<Loader | "">("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const ready = gameVersion.trim() !== "" && loader !== "";

  const catalog = useInfiniteQuery({
    queryKey: ["catalog", source, gameVersion.trim(), loader, search],
    enabled: open && submitted && ready,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<CatalogPage>(
        `/admin/mods/search?source=${source}&q=${encodeURIComponent(search)}&gameVersion=${encodeURIComponent(gameVersion.trim())}&loader=${loader}&offset=${pageParam}`,
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.hits.length, 0);
      if (lastPage.hits.length === 0 || loaded >= lastPage.total) return undefined;
      return loaded;
    },
  });

  const hits = catalog.data?.pages.flatMap((page) => page.hits) ?? [];
  const sentinel = useInfiniteScroll(
    Boolean(catalog.hasNextPage && !catalog.isFetchingNextPage),
    () => {
      void catalog.fetchNextPage();
    },
    scrollRoot,
  );

  const install = useMutation({
    mutationFn: (projectId: string) =>
      api(`/admin/mods/install`, {
        method: "POST",
        body: JSON.stringify({
          source,
          projectId,
          gameVersion: gameVersion.trim(),
          loader,
        }),
      }),
    onSuccess: async () => {
      toast.success("Мод добавлен");
      await queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSearch(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      toast.error("Укажите версию и загрузчик");
      setSubmitted(false);
      return;
    }
    setSearch(q.trim());
    setSubmitted(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(42rem,calc(100dvh-2rem))] w-full flex-col gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Загрузить моды</DialogTitle>
          <DialogDescription>Последний релиз попадёт в mods.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={source}
          onValueChange={(value) => {
            setSource(value as Source);
            setSubmitted(false);
          }}
        >
          <TabsList className="grid h-9 w-full grid-cols-2">
            <TabsTrigger className="w-full" value="modrinth">
              Modrinth
            </TabsTrigger>
            <TabsTrigger className="w-full" value="curseforge">
              CurseForge
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,10rem)_minmax(0,1fr)_auto]"
          onSubmit={onSearch}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="mod-version">Версия</Label>
            <Input
              id="mod-version"
              value={gameVersion}
              placeholder="1.20.1"
              onChange={(event) => {
                setGameVersion(event.target.value);
                setSubmitted(false);
              }}
            />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="mod-loader">Загрузчик</Label>
            <Select
              value={loader || undefined}
              onValueChange={(value) => {
                setLoader(value as Loader);
                setSubmitted(false);
              }}
            >
              <SelectTrigger id="mod-loader" className="w-full">
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {loaders.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="mod-query">Поиск</Label>
            <Input id="mod-query" value={q} placeholder="sodium" onChange={(event) => setQ(event.target.value)} />
          </div>
          <Button type="submit">Найти</Button>
        </form>

        <div
          ref={setScrollRoot}
          className="h-[min(22rem,calc(100dvh-16rem))] overflow-y-auto rounded-lg border border-border"
        >
            {!submitted ? (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyTitle>Найдите мод</EmptyTitle>
                  <EmptyDescription>Укажите версию, загрузчик и запрос.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {catalog.isPending && submitted ? (
              <div className="grid gap-px p-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : null}
            {catalog.isError ? (
              <div className="p-3">
                <Alert variant="destructive">
                  <AlertDescription>{catalog.error.message}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            {catalog.isSuccess && hits.length === 0 ? (
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyTitle>Ничего не найдено</EmptyTitle>
                  <EmptyDescription>Смените версию, загрузчик или запрос.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {hits.length > 0 ? (
              <ul>
                {hits.map((hit) => {
                  const pending = install.isPending && install.variables === hit.id;
                  return (
                    <li
                      key={`${source}-${hit.id}`}
                      className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
                    >
                      {hit.iconUrl ? (
                        <img src={hit.iconUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="size-10 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{hit.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{hit.description}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        disabled={pending}
                        onClick={() => install.mutate(hit.id)}
                      >
                        {pending ? "Добавление" : "Добавить"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div ref={sentinel} className="h-6">
              {catalog.isFetchingNextPage ? <Skeleton className="mx-3 h-14" /> : null}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
