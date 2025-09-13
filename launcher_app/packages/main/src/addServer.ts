import { parseUncompressed, writeUncompressed, NBT } from "prismarine-nbt";
import path from "path";
import { app } from "electron";
import { mcPath } from "./createLauncherDir";
import fs from "fs";
import sendError from "./sendError";

interface NBTTag<TType extends string, TValue> {
  type: TType;
  value: TValue;
}

export interface NBTServerEntry {
  ip: NBTTag<"string", string>;
  name: NBTTag<"string", string>;
  acceptTextures: NBTTag<"byte", number>;
  icon?: NBTTag<"string", string>;
  hidden?: NBTTag<"byte", number>;
}

export default async function addServer() {
  try {
    const servers_path = path.join(
      app.getPath("userData"),
      mcPath,
      "servers.dat"
    );

    // Если файла нет, создаём пустой NBT-файл с корневым compound
    if (!fs.existsSync(servers_path)) {
      const emptyNBT: NBT = {
        type: "compound",
        name: "",
        value: {
          servers: {
            type: "list",
            value: {
              type: "compound",
              value: [],
            },
          },
        },
      };
      fs.writeFileSync(servers_path, writeUncompressed(emptyNBT));
    }

    // Читаем файл
    const serversBuffer = fs.readFileSync(servers_path);
    const raw = await parseUncompressed(serversBuffer);
    const data = raw.value as unknown as {
      servers: {
        type: "list";
        value: { type: "compound"; value: NBTServerEntry[] };
      };
    };

    const serversList = data.servers.value.value;
    const exists = serversList.some((s) => s.ip.value === "jenison.ru");
    if (!exists) {
      serversList.push({
        ip: { type: "string", value: "jenison.ru" },
        name: { type: "string", value: "Chikadrilo Online" },
        acceptTextures: { type: "byte", value: 1 },
      });
    }

    // Сохраняем весь корневой compound
    const newNbt: Buffer = writeUncompressed({
      type: "compound",
      name: "",
      value: {
        servers: {
          type: "list",
          value: {
            type: "compound",
            value: serversList,
          },
        },
      },
    } as unknown as NBT);

    fs.writeFileSync(servers_path, newNbt);
  } catch (e) {
    sendError(`Error while checking servers list: ${e}`);
  }
}
