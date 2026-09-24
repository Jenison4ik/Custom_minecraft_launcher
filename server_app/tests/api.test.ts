import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

const xmcl = vi.hoisted(() => ({
  searchProjects: vi.fn(),
  getProjectVersions: vi.fn(),
  searchMods: vi.fn(),
  getModFiles: vi.fn(),
}));

vi.mock("@xmcl/modrinth", () => ({
  ModrinthV2Client: class {
    searchProjects = xmcl.searchProjects;
    getProjectVersions = xmcl.getProjectVersions;
  },
}));

const installer = vi.hoisted(() => ({
  getVersionList: vi.fn(),
  getLoaderArtifactListFor: vi.fn(),
  getQuiltLoaderVersionsByMinecraft: vi.fn(),
}));

vi.mock("@xmcl/installer", () => installer);

vi.mock("@xmcl/curseforge", () => ({
  FileModLoaderType: { Any: 0, Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 },
  FileReleaseType: { Release: 1, Beta: 2, Alpha: 3 },
  getCurseforgeFileDownloadUrls: (id: number, name: string, downloadUrl?: string) =>
    downloadUrl ? [downloadUrl] : [`https://edge.forgecdn.net/files/${id}/${name}`],
  CurseforgeV1Client: class {
    searchMods = xmcl.searchMods;
    getModFiles = xmcl.getModFiles;
  },
}));

import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { resetVersionCache } from "../src/services/gameCatalog.js";
import { profilePath } from "../src/services/profile.js";

describe("api", () => {
  let app: Express;
  let config: AppConfig;
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "mc-api-"));
    config = {
      port: 0,
      jwtSecret: "test-secret-test-secret-test-secret",
      jwtExpires: "12h",
      adminUsername: "admin",
      adminPassword: "secret",
      corsOrigin: "",
      gameDir: path.join(root, "game"),
      dataDir: path.join(root, "data"),
      launcherDir: path.join(root, "launcher"),
      uploadsDir: path.join(root, "uploads"),
      adminDist: path.join(root, "missing-admin"),
      curseforgeApiKey: "",
    };
    app = createApp(config);
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    xmcl.searchProjects.mockReset();
    xmcl.getProjectVersions.mockReset();
    xmcl.searchMods.mockReset();
    xmcl.getModFiles.mockReset();
    config.curseforgeApiKey = "";
    resetVersionCache();
    installer.getVersionList.mockReset();
    installer.getLoaderArtifactListFor.mockReset();
    installer.getQuiltLoaderVersionsByMinecraft.mockReset();
    installer.getVersionList.mockResolvedValue({
      versions: [
        { id: "1.21.1", type: "release" },
        { id: "24w14a", type: "snapshot" },
      ],
    });
    installer.getLoaderArtifactListFor.mockResolvedValue([
      { loader: { version: "0.16.14", stable: true } },
      { loader: { version: "0.16.0", stable: false } },
    ]);
    installer.getQuiltLoaderVersionsByMinecraft.mockResolvedValue([
      { loader: { version: "0.26.1", stable: true } },
    ]);
  });

  async function token(): Promise<string> {
    const response = await request(app)
      .post("/minecraft/api/v1/auth/login")
      .send({ username: "admin", password: "secret" });
    return response.body.token as string;
  }

  it("rejects a bad login and accepts the admin", async () => {
    const denied = await request(app)
      .post("/minecraft/api/v1/auth/login")
      .send({ username: "admin", password: "nope" });
    expect(denied.status).toBe(401);

    const ok = await request(app)
      .post("/minecraft/api/v1/auth/login")
      .send({ username: "admin", password: "secret" });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe("string");
    expect(ok.body.expiresIn).toBe("12h");
  });

  it("rejects admin routes without a token and with a bad token", async () => {
    const missing = await request(app).get("/minecraft/api/v1/admin/files");
    expect(missing.status).toBe(401);

    const bad = await request(app)
      .get("/minecraft/api/v1/admin/files")
      .set("Authorization", "Bearer not-a-jwt");
    expect(bad.status).toBe(401);
  });

  it("blocks path traversal on v1 files", async () => {
    const response = await request(app).get("/minecraft/api/v1/files/..%2F..%2Fpackage.json");
    expect([400, 404]).toContain(response.status);
  });

  it("stores a single file and keeps legacy manifest in sync", async () => {
    const auth = await token();
    const uploaded = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/example.jar")
      .attach("file", Buffer.from("hello-mod"), "example.jar");
    expect(uploaded.status).toBe(200);

    const bare = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "create-1.20.1-6.0.8.jar")
      .attach("file", Buffer.from("create-mod"), "create-1.20.1-6.0.8.jar");
    expect(bare.status).toBe(200);
    expect(bare.body.path).toBe("mods/create-1.20.1-6.0.8.jar");
    const stored = await request(app).get("/minecraft/api/v1/files/mods/create-1.20.1-6.0.8.jar");
    expect(stored.status).toBe(200);
    expect(stored.text).toBe("create-mod");
    const listed = await request(app)
      .get("/minecraft/api/v1/admin/mods")
      .set("Authorization", `Bearer ${auth}`);
    expect(listed.status).toBe(200);
    expect(listed.body.mods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "create-1.20.1-6.0.8.jar",
          path: "mods/create-1.20.1-6.0.8.jar",
        }),
      ])
    );

    const file = await request(app).get("/minecraft/api/v1/files/mods/example.jar");
    expect(file.status).toBe(200);
    expect(file.text).toBe("hello-mod");

    const expected = crypto.createHash("sha1").update("hello-mod").digest("hex");
    const legacy = await request(app).get("/minecraft/api/manifest");
    const versioned = await request(app).get("/minecraft/api/v1/manifest");
    expect(legacy.body.files["mods/example.jar"]).toEqual({ sha1: expected, size: 9 });
    expect(versioned.body).toEqual(legacy.body);

    const removed = await request(app)
      .delete("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .send({ path: "mods/example.jar" });
    expect(removed.status).toBe(200);

    const after = await request(app).get("/minecraft/api/manifest");
    expect(after.body.files["mods/example.jar"]).toBeUndefined();
    const missing = await request(app).get("/minecraft/api/v1/files/mods/example.jar");
    expect(missing.status).toBe(404);
  });

  it("serves an uploaded file from the legacy zip", async () => {
    const auth = await token();
    const uploaded = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/pack.jar")
      .attach("file", Buffer.from("from-zip"), "pack.jar");
    expect(uploaded.status).toBe(200);

    const rejected = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/notes.txt")
      .attach("file", Buffer.from("nope"), "notes.txt");
    expect(rejected.status).toBe(400);

    const single = await request(app).get("/minecraft/api/v1/files/mods/pack.jar");
    expect(single.text).toBe("from-zip");

    const archive = await request(app).get("/minecraft/api/download").buffer(true).parse(binaryParser);
    expect(archive.status).toBe(200);
    expect(archive.headers["content-type"]).toContain("application/zip");
    const extracted = await unzipEntry(archive.body as Buffer, "mods/pack.jar");
    expect(extracted).toBe("from-zip");

    const manifest = await request(app).get("/minecraft/api/manifest");
    expect(manifest.body.files["mods/example.jar"]).toBeUndefined();
    expect(manifest.body.files["mods/pack.jar"].size).toBe("from-zip".length);
  });

  it("searches Modrinth and installs the release jar", async () => {
    xmcl.searchProjects.mockResolvedValue({
      total_hits: 1,
      hits: [
        {
          project_id: "AA123",
          title: "Sodium",
          description: "Rendering",
          icon_url: "https://cdn.modrinth.com/icon.png",
        },
      ],
    });
    xmcl.getProjectVersions.mockResolvedValue([
      {
        version_type: "release",
        files: [
          {
            url: "https://cdn.modrinth.com/data/AA123/sodium.jar",
            filename: "sodium.jar",
            primary: true,
          },
        ],
      },
    ]);
    const fetchMock = vi.fn(async () => new Response(Buffer.from("mod-bytes")));
    vi.stubGlobal("fetch", fetchMock);

    const auth = await token();
    const found = await request(app)
      .get("/minecraft/api/v1/admin/mods/search")
      .query({ source: "modrinth", q: "sodium", gameVersion: "1.20.1", loader: "fabric" })
      .set("Authorization", `Bearer ${auth}`);
    expect(found.status).toBe(200);
    expect(found.body.hits[0]).toMatchObject({ id: "AA123", title: "Sodium" });
    expect(xmcl.searchProjects).toHaveBeenCalled();

    const installed = await request(app)
      .post("/minecraft/api/v1/admin/mods/install")
      .set("Authorization", `Bearer ${auth}`)
      .send({ source: "modrinth", projectId: "AA123", gameVersion: "1.20.1", loader: "fabric" });
    expect(installed.status).toBe(200);
    expect(installed.body.path).toBe("mods/sodium.jar");

    const file = await request(app).get("/minecraft/api/v1/files/mods/sodium.jar");
    expect(file.text).toBe("mod-bytes");
    vi.unstubAllGlobals();
  });

  it("rejects catalog search without a version and CurseForge without a key", async () => {
    const auth = await token();
    const missing = await request(app)
      .get("/minecraft/api/v1/admin/mods/search")
      .query({ source: "modrinth", q: "sodium", loader: "fabric" })
      .set("Authorization", `Bearer ${auth}`);
    expect(missing.status).toBe(400);
    expect(xmcl.searchProjects).not.toHaveBeenCalled();

    const curse = await request(app)
      .get("/minecraft/api/v1/admin/mods/search")
      .query({ source: "curseforge", q: "sodium", gameVersion: "1.20.1", loader: "forge" })
      .set("Authorization", `Bearer ${auth}`);
    expect(curse.status).toBe(503);
    expect(xmcl.searchMods).not.toHaveBeenCalled();
  });

  it("rejects a catalog file that is not a jar", async () => {
    xmcl.getProjectVersions.mockResolvedValue([
      {
        version_type: "release",
        files: [
          {
            url: "https://cdn.modrinth.com/data/AA123/notes.txt",
            filename: "notes.txt",
            primary: true,
          },
        ],
      },
    ]);
    const auth = await token();
    const installed = await request(app)
      .post("/minecraft/api/v1/admin/mods/install")
      .set("Authorization", `Bearer ${auth}`)
      .send({ source: "modrinth", projectId: "AA123", gameVersion: "1.20.1", loader: "fabric" });
    expect(installed.status).toBe(404);
  });

  it("does not invent a profile when the file is missing", async () => {
    const response = await request(app).get("/minecraft/api/v1/profile");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Profile is not set");
    await expect(fs.access(profilePath(config.dataDir))).rejects.toMatchObject({ code: "ENOENT" });

    const auth = await token();
    const admin = await request(app)
      .get("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`);
    expect(admin.status).toBe(404);
  });

  it("stores the recommended loader version and serves that exact profile", async () => {
    const auth = await token();
    const saved = await request(app)
      .put("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`)
      .send({
        mcVersion: "1.21.1",
        loader: "fabric",
        loaderVersion: "",
        servers: [{ ip: "jenison.ru", lable: "Chikadrilo Online" }],
      });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      mcVersion: "1.21.1",
      loader: "fabric",
      loaderVersion: "0.16.14",
      servers: [{ ip: "jenison.ru", lable: "Chikadrilo Online" }],
    });

    const pub = await request(app).get("/minecraft/api/v1/profile");
    expect(pub.body.loaderVersion).toBe("0.16.14");

    const versions = await request(app)
      .get("/minecraft/api/v1/admin/game/versions")
      .set("Authorization", `Bearer ${auth}`);
    expect(versions.body.versions).toEqual(["1.21.1"]);

    const loaders = await request(app)
      .get("/minecraft/api/v1/admin/game/loaders")
      .query({ mcVersion: "1.21.1", loader: "fabric" })
      .set("Authorization", `Bearer ${auth}`);
    expect(loaders.body.recommended).toBe("0.16.14");
    expect(loaders.body.versions).toEqual(["0.16.14", "0.16.0"]);
  });

  it("lists forge builds for the exact Minecraft version", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("maven-metadata.xml")) {
        return new Response(
          `<metadata><versioning><versions>
            <version>1.21-51.0.33</version>
            <version>1.21.1-52.1.0</version>
            <version>1.21.1-52.1.16</version>
            <version>1.21.10-55.0.1</version>
          </versions></versioning></metadata>`,
        );
      }
      return new Response(
        JSON.stringify({
          promos: {
            "1.21.1-latest": "52.1.16",
            "1.21.1-recommended": "52.1.0",
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const auth = await token();
      const loaders = await request(app)
        .get("/minecraft/api/v1/admin/game/loaders")
        .query({ mcVersion: "1.21.1", loader: "forge" })
        .set("Authorization", `Bearer ${auth}`);
      expect(loaders.status).toBe(200);
      expect(loaders.body.versions).toEqual(["52.1.16", "52.1.0"]);
      expect(loaders.body.recommended).toBe("52.1.0");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an unknown version and does not replace a saved profile when lists fail", async () => {
    const auth = await token();
    const unknown = await request(app)
      .put("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`)
      .send({ mcVersion: "1.16.4", loader: "fabric", loaderVersion: "", servers: [] });
    expect(unknown.status).toBe(400);

    const badLoader = await request(app)
      .put("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`)
      .send({ mcVersion: "1.21.1", loader: "fabric", loaderVersion: "9.9.9", servers: [] });
    expect(badLoader.status).toBe(400);

    const vanilla = await request(app)
      .put("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`)
      .send({ mcVersion: "1.21.1", loader: "vanilla", loaderVersion: "ignored", servers: [] });
    expect(vanilla.status).toBe(200);
    expect(vanilla.body.loaderVersion).toBe("");

    installer.getVersionList.mockRejectedValue(new Error("offline"));
    resetVersionCache();
    const failed = await request(app)
      .put("/minecraft/api/v1/admin/profile")
      .set("Authorization", `Bearer ${auth}`)
      .send({ mcVersion: "1.21.1", loader: "fabric", loaderVersion: "", servers: [] });
    expect(failed.status).toBe(502);

    const still = await request(app).get("/minecraft/api/v1/profile");
    expect(still.body.loader).toBe("vanilla");
  });

  it("lists parsed mods and keeps an unreadable jar as a filename", async () => {
    const auth = await token();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const fabric = await zipOf({
      "fabric.mod.json": JSON.stringify({
        schemaVersion: 1,
        id: "example",
        version: "1.0.0",
        name: "Example Mod",
        description: "A short description",
        icon: "assets/example/icon.png",
      }),
      "assets/example/icon.png": png,
    });
    const forge = await zipOf({
      "META-INF/mods.toml": `
modLoader="javafml"
loaderVersion="[47,)"
license="MIT"

[[mods]]
modId="alpha"
version="1.0"
displayName="Alpha Mod"
description="First forge mod"

[[mods]]
modId="beta"
version="1.0"
displayName="Beta Mod"
description="Second forge mod"
logoFile="logo.png"
`,
      "logo.png": png,
    });

    const uploadedFabric = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/example-mod.jar")
      .attach("file", fabric, "example-mod.jar");
    expect(uploadedFabric.status).toBe(200);

    const uploadedForge = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/nested/forge-pack.jar")
      .attach("file", forge, "forge-pack.jar");
    expect(uploadedForge.status).toBe(200);

    const uploadedBroken = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "mods/broken.jar")
      .attach("file", Buffer.from("not-a-zip"), "broken.jar");
    expect(uploadedBroken.status).toBe(200);

    const uploadedElsewhere = await request(app)
      .put("/minecraft/api/v1/admin/files")
      .set("Authorization", `Bearer ${auth}`)
      .field("path", "config/other.jar")
      .attach("file", fabric, "other.jar");
    expect(uploadedElsewhere.status).toBe(200);

    const manifestPath = path.join(config.dataDir, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) as {
      files: Record<string, { sha1: string; size: number }>;
    };
    manifest.files["mods/hidden.jar.disabled"] = { sha1: "disabled", size: 1 };
    await fs.writeFile(manifestPath, JSON.stringify(manifest));

    const page = await request(app)
      .get("/minecraft/api/v1/admin/mods")
      .set("Authorization", `Bearer ${auth}`);
    expect(page.status).toBe(200);

    const mods = page.body.mods as {
      id: string;
      name: string;
      description: string;
      fileName: string;
      path: string;
      iconDataUrl: string | null;
    }[];
    const example = mods.find((mod) => mod.path === "mods/example-mod.jar");
    expect(example).toMatchObject({
      id: "mods/example-mod.jar#example",
      name: "Example Mod",
      description: "A short description",
      fileName: "example-mod.jar",
    });
    expect(example?.iconDataUrl?.startsWith("data:image/png;base64,")).toBe(true);

    const forgeMods = mods.filter((mod) => mod.path === "mods/nested/forge-pack.jar");
    expect(forgeMods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mods/nested/forge-pack.jar#alpha",
          name: "Alpha Mod",
          description: "First forge mod",
          fileName: "forge-pack.jar",
          iconDataUrl: null,
        }),
        expect.objectContaining({
          id: "mods/nested/forge-pack.jar#beta",
          name: "Beta Mod",
          description: "Second forge mod",
          fileName: "forge-pack.jar",
        }),
      ])
    );
    expect(forgeMods.find((mod) => mod.name === "Beta Mod")?.iconDataUrl?.startsWith("data:image/png;base64,")).toBe(
      true
    );

    expect(mods).toContainEqual(
      expect.objectContaining({
        id: "mods/broken.jar#0",
        name: "broken.jar",
        description: "",
        fileName: "broken.jar",
        path: "mods/broken.jar",
        iconDataUrl: null,
      })
    );
    expect(mods.some((mod) => mod.path === "config/other.jar" || mod.fileName === "hidden.jar.disabled")).toBe(false);

    const found = await request(app)
      .get("/minecraft/api/v1/admin/mods")
      .query({ q: "short description" })
      .set("Authorization", `Bearer ${auth}`);
    expect(found.body.mods.map((mod: { name: string }) => mod.name)).toEqual(["Example Mod"]);

    const again = await request(app)
      .get("/minecraft/api/v1/admin/mods")
      .query({ q: "Example Mod" })
      .set("Authorization", `Bearer ${auth}`);
    expect(again.body.mods[0].iconDataUrl).toBe(example?.iconDataUrl);
  });
});

function zipOf(entries: Record<string, Buffer | string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.pipe(stream);
    for (const [name, data] of Object.entries(entries)) {
      archive.append(data, { name });
    }
    void archive.finalize();
  });
}

function binaryParser(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error) => callback(error, Buffer.alloc(0)));
}

async function unzipEntry(zip: Buffer, name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-zip-"));
  const zipFile = path.join(dir, "in.zip");
  await fs.writeFile(zipFile, zip);
  const extract = (await import("extract-zip")).default;
  await extract(zipFile, { dir });
  const text = await fs.readFile(path.join(dir, name), "utf-8");
  await fs.rm(dir, { recursive: true, force: true });
  return text;
}
