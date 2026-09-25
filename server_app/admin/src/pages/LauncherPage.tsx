import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import AnimatedFileUpload from "@/components/smoothui/animated-file-upload";
import AnimatedStepper, { type StepItem } from "@/components/smoothui/animated-stepper";
import Skeleton from "@/components/smoothui/skeleton-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type LauncherInfo = { version: string | null; yml: string | null };

const lastStep = 3;

export function LauncherPage() {
  const info = useQuery({
    queryKey: ["launcher"],
    queryFn: () => api<LauncherInfo>("/admin/launcher"),
  });
  const [version, setVersion] = useState("");
  const [yml, setYml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState<LauncherInfo | null>(null);

  if (info.data && info.data !== loaded) {
    setLoaded(info.data);
    setVersion(info.data.version ?? "");
    setYml(info.data.yml ?? "");
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите ZIP установщика");
      const body = new FormData();
      body.set("file", file);
      body.set("yml", yml.trim());
      return api("/admin/launcher", {
        method: "POST",
        headers: { version: version.trim() },
        body,
      });
    },
    onSuccess: async () => {
      toast.success("Лаунчер обновлён");
      setFile(null);
      setUploadKey((value) => value + 1);
      setStep(0);
      await info.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const versionReady = version.trim().length > 0;
  const fileReady = file !== null;
  const ymlReady = yml.trim().length > 0;
  const canGoNext =
    (step === 0 && versionReady) || (step === 1 && fileReady) || (step === 2 && ymlReady);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step < lastStep) {
      if (canGoNext) setStep((current) => current + 1);
      return;
    }
    upload.mutate();
  }

  const steps: StepItem[] = [
    {
      label: "Версия",
      content: (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="launcher-version">Версия</FieldLabel>
            <Input
              id="launcher-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
            <FieldDescription>Номер версии, который уйдёт в version.json.</FieldDescription>
          </Field>
          <StepActions
            nextDisabled={!versionReady}
            onNext={() => setStep(1)}
          />
        </FieldGroup>
      ),
    },
    {
      label: "Архив",
      content: (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="launcher-zip">ZIP</FieldLabel>
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
            <FieldDescription>Архив установщика. На сервер уходит только .zip.</FieldDescription>
          </Field>
          <StepActions
            nextDisabled={!fileReady}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        </FieldGroup>
      ),
    },
    {
      label: "latest.yml",
      content: (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="launcher-yml">latest.yml</FieldLabel>
            <Textarea
              id="launcher-yml"
              rows={12}
              value={yml}
              onChange={(event) => setYml(event.target.value)}
            />
            <FieldDescription>Содержимое файла обновления electron-updater.</FieldDescription>
          </Field>
          <StepActions
            nextDisabled={!ymlReady}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        </FieldGroup>
      ),
    },
    {
      label: "Публикация",
      content: (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Проверка</CardTitle>
              <CardDescription>Эти данные уйдут на сервер.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Версия</dt>
                  <dd>{version.trim()}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Архив</dt>
                  <dd className="truncate">{file?.name}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">latest.yml</dt>
                  <dd>Задан</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={upload.isPending}>
              Назад
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={upload.isPending || !versionReady || !fileReady || !ymlReady}
            >
              {upload.isPending ? <Spinner data-icon="inline-start" aria-label="Публикация" /> : null}
              Опубликовать
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
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
      {info.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <AnimatedStepper
            allowClickNavigation={false}
            currentStep={step}
            onStepChange={setStep}
            steps={steps}
            variant="horizontal"
          />
        </form>
      )}
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          Назад
        </Button>
      ) : null}
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        Далее
      </Button>
    </div>
  );
}
