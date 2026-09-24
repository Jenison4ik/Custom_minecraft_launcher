import { describe, expect, it } from "vitest";
import { diagnoseMods, versionSatisfies, type DeclaredMod } from "../src/services/modIssues.js";

function mod(partial: Partial<DeclaredMod> & Pick<DeclaredMod, "id" | "name">): DeclaredMod {
  return {
    version: "1.0.0",
    loaders: [],
    provides: [],
    requires: [],
    breaks: [],
    ...partial,
  };
}

describe("versionSatisfies", () => {
  it("matches exact, wildcard, operators, tilde, caret and maven ranges", () => {
    expect(versionSatisfies("1.21.1", ["*"])).toBe(true);
    expect(versionSatisfies("1.21.1", ["1.21.1"])).toBe(true);
    expect(versionSatisfies("1.21.1", [">=1.21"])).toBe(true);
    expect(versionSatisfies("1.20.1", [">=1.21"])).toBe(false);
    expect(versionSatisfies("0.5.13+mc1.20.1", [">=0.5.0"])).toBe(true);
    expect(versionSatisfies("1.20.5", ["~1.20.1"])).toBe(true);
    expect(versionSatisfies("1.21.0", ["~1.20.1"])).toBe(false);
    expect(versionSatisfies("1.9.0", ["^1.2.3"])).toBe(true);
    expect(versionSatisfies("2.0.0", ["^1.2.3"])).toBe(false);
    expect(versionSatisfies("1.21.1", ["[1.21.1,1.21.2)"])).toBe(true);
    expect(versionSatisfies("1.21.2", ["[1.21.1,1.21.2)"])).toBe(false);
    expect(versionSatisfies("47.4.0", ["[47,)"])).toBe(true);
    expect(versionSatisfies("1.20.1", [">=1.20 <1.21"])).toBe(true);
    expect(versionSatisfies("1.21.0", [">=1.20 <1.21"])).toBe(false);
  });
});

describe("diagnoseMods", () => {
  it("reports a missing dependency, a version mismatch and a conflict", () => {
    const issues = diagnoseMods(
      [
        mod({
          id: "appleskin",
          name: "AppleSkin",
          requires: [{ id: "cloth-config", ranges: ["*"] }],
        }),
        mod({
          id: "sodium",
          name: "Sodium",
          version: "0.5.0",
          requires: [{ id: "fabric-api", ranges: [">=0.90.0"] }],
        }),
        mod({
          id: "fabric-api",
          name: "Fabric API",
          version: "0.80.0",
          breaks: [{ id: "sodium", ranges: ["*"] }],
        }),
      ],
      "1.21.1"
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      "AppleSkin требует cloth-config, его нет в сборке.",
      "Fabric API конфликтует с Sodium 0.5.0.",
      "Sodium требует fabric-api >=0.90.0, установлена версия Fabric API 0.80.0.",
    ]);
  });

  it("accepts a provided id and skips loader runtimes", () => {
    const issues = diagnoseMods(
      [
        mod({
          id: "sodium",
          name: "Sodium",
          provides: ["fabric-api"],
          requires: [
            { id: "fabricloader", ranges: [">=0.14.0"] },
            { id: "java", ranges: [">=17"] },
            { id: "forge", ranges: ["*"] },
          ],
        }),
        mod({
          id: "iris",
          name: "Iris",
          requires: [{ id: "fabric-api", ranges: ["*"] }],
        }),
      ],
      null
    );
    expect(issues).toEqual([]);
  });

  it("checks Minecraft only when the profile version is known", () => {
    const pack = [
      mod({
        id: "sodium",
        name: "Sodium",
        minecraft: ["~1.20.1"],
      }),
    ];
    expect(diagnoseMods(pack, null)).toEqual([]);
    expect(diagnoseMods(pack, "1.21.1").map((issue) => issue.message)).toEqual([
      "Sodium требует Minecraft ~1.20.1, в сборке 1.21.1.",
    ]);
    expect(diagnoseMods(pack, "1.20.4")).toEqual([]);
  });

  it("accepts a 1.21 range on Minecraft 1.21.1 the way Forge does", () => {
    const jei = [
      mod({
        id: "jei",
        name: "Just Enough Items",
        minecraft: ["[1.21, 1.21.1)"],
      }),
    ];
    expect(diagnoseMods(jei, "1.21")).toEqual([]);
    expect(diagnoseMods(jei, "1.21.1")).toEqual([]);
    expect(diagnoseMods(jei, "1.21.2").map((issue) => issue.message)).toEqual([
      "Just Enough Items требует Minecraft [1.21, 1.21.1), в сборке 1.21.2.",
    ]);

    const older = [mod({ id: "old", name: "Old", minecraft: ["[1.20.1,1.21)"] })];
    expect(diagnoseMods(older, "1.21.1").map((issue) => issue.message)).toEqual([
      "Old требует Minecraft [1.20.1,1.21), в сборке 1.21.1.",
    ]);
  });

  it("reports a mod loader that the pack does not use", () => {
    const forgeMod = mod({ id: "jei", name: "Just Enough Items", loaders: ["forge"] });
    expect(diagnoseMods([forgeMod], "1.21.1", "forge")).toEqual([]);
    expect(diagnoseMods([forgeMod], "1.21.1", "fabric").map((issue) => issue.message)).toEqual([
      "Just Enough Items требует Forge, а сборка на Fabric.",
    ]);
    expect(diagnoseMods([forgeMod], "1.21.1", "vanilla").map((issue) => issue.message)).toEqual([
      "Just Enough Items требует Forge, а сборка без модлоадера.",
    ]);
    const hybrid = mod({ id: "jei", name: "Just Enough Items", loaders: ["fabric", "forge"] });
    expect(diagnoseMods([hybrid], "1.21.1", "forge")).toEqual([]);
    const fabricOnly = mod({
      id: "maputils",
      name: "Xaero's Map Server Utils",
      loaders: ["fabric"],
      requires: [{ id: "fabric-resource-loader-v0", ranges: ["*"] }],
    });
    expect(diagnoseMods([fabricOnly], "1.21.1", "forge").map((issue) => issue.message)).toEqual([
      "Xaero's Map Server Utils требует Fabric, а сборка на Forge.",
    ]);
  });
});
