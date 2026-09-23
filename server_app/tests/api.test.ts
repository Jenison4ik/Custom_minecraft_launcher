import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
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
});

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
