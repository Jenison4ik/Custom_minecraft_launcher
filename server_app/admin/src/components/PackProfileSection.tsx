import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";

type Loader = "vanilla" | "fabric" | "forge" | "quilt" | "neoforge";
type ProfileServer = { ip: string; lable: string };
type GameProfile = {
  mcVersion: string;
  loader: Loader;
  loaderVersion: string;
  servers: ProfileServer[];
};

const recommended = "__recommended__";

const loaders: { value: Loader; label: string }[] = [
  { value: "vanilla", label: "Vanilla" },
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "quilt", label: "Quilt" },
  { value: "neoforge", label: "NeoForge" },
];

export function PackProfileSection() {
  const queryClient = useQueryClient();
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState<Loader | "">("");
  const [loaderVersion, setLoaderVersion] = useState(recommended);
  const [servers, setServers] = useState<ProfileServer[]>([]);

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

  const versions = useQuery({
    queryKey: ["game-versions"],
    queryFn: () => api<{ versions: string[] }>("/admin/game/versions"),
  });

  const loaderVersions = useQuery({
    queryKey: ["game-loaders", mcVersion, loader],
    enabled: mcVersion !== "" && loader !== "" && loader !== "vanilla",
    queryFn: () =>
      api<{ versions: string[]; recommended: string }>(
        `/admin/game/loaders?mcVersion=${encodeURIComponent(mcVersion)}&loader=${loader}`,
      ),
  });

  useEffect(() => {
    if (!profile.data) return;
    setMcVersion(profile.data.mcVersion);
    setLoader(profile.data.loader);
    setLoaderVersion(profile.data.loaderVersion || recommended);
    setServers(profile.data.servers);
  }, [profile.data]);

  useEffect(() => {
    if (loader === "vanilla") {
      setLoaderVersion(recommended);
      return;
    }
    if (loaderVersion === recommended || !loaderVersions.data) return;
    if (!loaderVersions.data.versions.includes(loaderVersion)) {
      setLoaderVersion(recommended);
    }
  }, [loader, loaderVersion, loaderVersions.data]);

  const save = useMutation({
    mutationFn: () =>
      api<GameProfile>("/admin/profile", {
        method: "PUT",
        body: JSON.stringify({
          mcVersion,
          loader,
          loaderVersion: loader === "vanilla" || loaderVersion === recommended ? "" : loaderVersion,
          servers,
        }),
      }),
    onSuccess: async (saved) => {
      toast.success("Сборка сохранена");
      setLoaderVersion(saved.loaderVersion || recommended);
      setServers(saved.servers);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!mcVersion || !loader) {
      toast.error("Укажите версию и загрузчик");
      return;
    }
    save.mutate();
  }

  const versionChoices = versions.data?.versions ?? [];
  const loaderChoices = loaderVersions.data?.versions ?? [];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Версия сборки</h2>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          При следующем запуске с сетью в папке mods останутся только файлы из манифеста.
        </p>
      </div>
      {profile.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{profile.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {versions.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{versions.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="pack-version">Версия Minecraft</Label>
            <Select
              value={mcVersion || undefined}
              onValueChange={(value) => {
                setMcVersion(value);
                setLoaderVersion(recommended);
              }}
            >
              <SelectTrigger id="pack-version" className="w-full">
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {versionChoices.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="pack-loader">Загрузчик</Label>
            <Select
              value={loader || undefined}
              onValueChange={(value) => {
                setLoader(value as Loader);
                setLoaderVersion(recommended);
              }}
            >
              <SelectTrigger id="pack-loader" className="w-full">
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
            <Label htmlFor="pack-loader-version">Версия загрузчика</Label>
            <Select
              value={loaderVersion}
              disabled={loader === "" || loader === "vanilla"}
              onValueChange={setLoaderVersion}
            >
              <SelectTrigger id="pack-loader-version" className="w-full">
                <SelectValue placeholder="Рекомендуемая" />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value={recommended}>Рекомендуемая</SelectItem>
                {loaderChoices.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {loaderVersions.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{loaderVersions.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Серверы</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setServers((current) => [...current, { ip: "", lable: "" }])}
            >
              Добавить
            </Button>
          </div>
          {servers.map((server, index) => (
            <div key={index} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor={`server-ip-${index}`}>Адрес</Label>
                <Input
                  id={`server-ip-${index}`}
                  value={server.ip}
                  onChange={(event) =>
                    setServers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, ip: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`server-name-${index}`}>Название</Label>
                <Input
                  id={`server-name-${index}`}
                  value={server.lable}
                  onChange={(event) =>
                    setServers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, lable: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setServers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>
        <div>
          <Button type="submit" disabled={save.isPending || profile.isPending}>
            Сохранить
          </Button>
        </div>
      </form>
    </section>
  );
}
