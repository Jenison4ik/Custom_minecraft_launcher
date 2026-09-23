import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AnimatedTabs from "@/components/smoothui/animated-tabs";
import Dialog from "@/components/smoothui/dialog";
import Select from "@/components/smoothui/select";
import Skeleton from "@/components/smoothui/skeleton-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Dialog
      className="sm:max-w-3xl"
      description="Последний релиз попадёт в mods."
      open={open}
      title="Загрузить моды"
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        <AnimatedTabs
          activeTab={source}
          variant="segment"
          tabs={[
            { id: "modrinth", label: "Modrinth" },
            { id: "curseforge", label: "CurseForge" },
          ]}
          onChange={(tabId) => {
            setSource(tabId as Source);
            setSubmitted(false);
          }}
        />
        <form className="grid grid-cols-1 items-end gap-4 md:grid-cols-12" onSubmit={onSearch}>
          <div className="grid gap-2 md:col-span-3">
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
          <div className="grid gap-2 md:col-span-3">
            <Label id="mod-loader-label">Загрузчик</Label>
            <Select
              aria-labelledby="mod-loader-label"
              options={loaders}
              placeholder="Выберите"
              value={loader}
              onValueChange={(value) => {
                setLoader(value as Loader);
                setSubmitted(false);
              }}
            />
          </div>
          <div className="grid gap-2 md:col-span-4">
            <Label htmlFor="mod-query">Поиск</Label>
            <Input id="mod-query" value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
          <Button className="md:col-span-2" type="submit" variant="outline">
            Найти
          </Button>
        </form>
        <div ref={setScrollRoot} className="max-h-[min(24rem,50dvh)] overflow-y-auto">
          {catalog.isPending && submitted ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : null}
          {catalog.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{catalog.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {catalog.isSuccess && hits.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Ничего не найдено</EmptyTitle>
                <EmptyDescription>Смените версию, загрузчик или запрос.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {hits.length > 0 ? (
            <ul className="grid gap-2">
              {hits.map((hit) => {
                const pending = install.isPending && install.variables === hit.id;
                return (
                  <li key={`${source}-${hit.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    {hit.iconUrl ? (
                      <img src={hit.iconUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="size-10 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{hit.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{hit.description}</p>
                    </div>
                    <Button type="button" size="sm" disabled={pending} onClick={() => install.mutate(hit.id)}>
                      {pending ? "Добавление" : "Добавить"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div ref={sentinel} className="h-6">
            {catalog.isFetchingNextPage ? <Skeleton className="h-14 w-full" /> : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
