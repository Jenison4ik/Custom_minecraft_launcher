import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import AnimatedFileUpload from "@/components/smoothui/animated-file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type LauncherInfo = { version: string | null; yml: string | null };

export function LauncherPage() {
  const info = useQuery({
    queryKey: ["launcher"],
    queryFn: () => api<LauncherInfo>("/admin/launcher"),
  });
  const [version, setVersion] = useState("");
  const [yml, setYml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  useEffect(() => {
    if (!info.data) return;
    setVersion(info.data.version ?? "");
    setYml(info.data.yml ?? "");
  }, [info.data]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите ZIP установщика");
      const body = new FormData();
      body.set("file", file);
      body.set("yml", yml);
      return api("/admin/launcher", {
        method: "POST",
        headers: { version },
        body,
      });
    },
    onSuccess: async () => {
      toast.success("Лаунчер обновлён");
      setFile(null);
      setUploadKey((value) => value + 1);
      await info.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    upload.mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Лаунчер</h1>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          ZIP с установщиком, версия и содержимое latest.yml.
        </p>
      </header>
      {info.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{info.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <form className="grid gap-6" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="launcher-version">Версия</Label>
          <Input id="launcher-version" value={version} onChange={(event) => setVersion(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <AnimatedFileUpload
            key={uploadKey}
            accept=".zip,application/zip"
            dropLabel="Отпустите архив"
            hint="ZIP установщика"
            idleLabel="Перетащите ZIP или нажмите, чтобы выбрать"
            inputId="launcher-zip"
            inputLabel="ZIP"
            multiple={false}
            onFilesSelected={(files) => setFile(files[0] ?? null)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="launcher-yml">latest.yml</Label>
          <Textarea id="launcher-yml" rows={12} value={yml} onChange={(event) => setYml(event.target.value)} />
        </div>
        <div>
          <Button type="submit" size="lg" disabled={upload.isPending}>
            Опубликовать
          </Button>
        </div>
      </form>
    </div>
  );
}
