import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ApiError, api } from "@/lib/api";

type Source = "modrinth" | "curseforge";
type PackLoader = "vanilla" | "fabric" | "forge" | "quilt" | "neoforge";
type ModLoader = Exclude<PackLoader, "vanilla">;
type GameProfile = { mcVersion: string; loader: PackLoader };
type CatalogHit = { id: string; slug: string; title: string; description: string; iconUrl: string | null };
type CatalogPage = { total: number; hits: CatalogHit[] };
type InstalledMod = { modId: string; name: string };
type InstalledPage = { mods: InstalledMod[] };
type CatalogRef = { source: Source; projectId: string };

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

const packRequired = "Сначала сохраните сборку с Fabric, Forge, Quilt или NeoForge.";

export function ModsCatalogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<Source>("modrinth");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      try {
        return await api<GameProfile>("/admin/profile");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

  const installed = useQuery({
    queryKey: ["mods", "all"],
    enabled: open,
    queryFn: () => api<InstalledPage>("/admin/mods?limit=1000&offset=0"),
  });
  const catalogMods = useQuery({
    queryKey: ["catalog-mods"],
    enabled: open,
    queryFn: () => api<{ mods: CatalogRef[] }>("/admin/mods/catalog"),
  });

  const gameVersion = profile.data?.mcVersion.trim() ?? "";
  const loader: ModLoader | "" =
    profile.data && profile.data.loader !== "vanilla" ? profile.data.loader : "";
  const ready = gameVersion !== "" && loader !== "";

  const catalog = useInfiniteQuery({
    queryKey: ["catalog", source, gameVersion, loader, search],
    enabled: open && submitted && ready,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<CatalogPage>(
        `/admin/mods/search?source=${source}&q=${encodeURIComponent(search)}&gameVersion=${encodeURIComponent(gameVersion)}&loader=${loader}&offset=${pageParam}`,
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
    mutationFn: (project: { source: Source; projectId: string }) =>
      api(`/admin/mods/install`, {
        method: "POST",
        body: JSON.stringify({
          source: project.source,
          projectId: project.projectId,
          gameVersion,
          loader,
        }),
      }),
    onSuccess: async (_data, project) => {
      queryClient.setQueryData<{ mods: CatalogRef[] }>(["catalog-mods"], (current) => ({
        mods: [...(current?.mods ?? []), { source: project.source, projectId: project.projectId }],
      }));
      toast.success("Мод добавлен");
      await queryClient.invalidateQueries({ queryKey: ["mods"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-mods"] });
      await queryClient.invalidateQueries({ queryKey: ["mod-issues"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSearch(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      toast.error(packRequired);
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
          <DialogDescription>
            {ready ? `Сборка ${gameVersion}, ${loader}. Последний релиз попадёт в mods.` : "Последний релиз попадёт в mods."}
          </DialogDescription>
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

        <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="mod-query">Поиск</Label>
            <Input id="mod-query" value={q} placeholder="sodium" onChange={(event) => setQ(event.target.value)} />
          </div>
          <Button type="submit" disabled={profile.isPending || !ready}>
            Найти
          </Button>
        </form>

        <div
          ref={setScrollRoot}
          className="h-[min(22rem,calc(100dvh-16rem))] overflow-y-auto rounded-lg border border-border"
        >
          {profile.isPending ? (
            <div className="grid gap-px p-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {profile.isError ? (
            <div className="p-3">
              <Alert variant="destructive">
                <AlertDescription>{profile.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          {!profile.isPending && !profile.isError && !ready ? (
            <Empty className="h-full border-0">
              <EmptyHeader>
                <EmptyTitle>Сборка не задана</EmptyTitle>
                <EmptyDescription>{packRequired}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {ready && !submitted ? (
            <Empty className="h-full border-0">
              <EmptyHeader>
                <EmptyTitle>Найдите мод</EmptyTitle>
                <EmptyDescription>Введите запрос.</EmptyDescription>
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
                <EmptyDescription>Смените запрос.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {hits.length > 0 ? (
            <ul>
              {hits.map((hit) => {
                const pending = install.isPending && install.variables?.projectId === hit.id && install.variables.source === source;
                const already =
                  (catalogMods.data?.mods ?? []).some((ref) => ref.source === source && ref.projectId === hit.id) ||
                  (installed.data?.mods ?? []).some(
                    (mod) =>
                      sameText(mod.name, hit.title) ||
                      (Boolean(hit.slug) && Boolean(mod.modId) && mod.modId.toLowerCase() === hit.slug.toLowerCase()),
                  );
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
                      disabled={pending || already}
                      onClick={() => install.mutate({ source, projectId: hit.id })}
                    >
                      {pending ? "Добавление" : already ? "Добавлено" : "Добавить"}
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
