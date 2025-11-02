import net from "net";

function writeVarInt(value: number): Buffer {
  const out: number[] = [];
  while (true) {
    if ((value & 0xffffff80) === 0) {
      out.push(value);
      return Buffer.from(out);
    }
    out.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
}

export async function getServerStatus(
  host: string,
  port = 25565
): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(port, host, () => {
      const handshake = Buffer.concat([
        writeVarInt(0), // packet id
        writeVarInt(760), // protocol version (760 = MC 1.19.3, можно ставить любое)
        Buffer.from([host.length, ...Buffer.from(host)]), // host
        Buffer.from([port >> 8, port & 0xff]), // port
        writeVarInt(1), // next state = status
      ]);

      const handshakePacket = Buffer.concat([
        writeVarInt(handshake.length),
        handshake,
      ]);

      // Send Handshake
      client.write(handshakePacket);

      // Send Status Request (packet id = 0)
      client.write(Buffer.from([1, 0]));
    });

    let data = Buffer.alloc(0);

    client.on("data", (chunk) => {
      data = Buffer.concat([data, chunk]);
    });

    client.on("end", () => {
      try {
        // Срезаем первые байты (VarInt длина пакета и packet id)
        const str = data.toString("utf8", 5);
        resolve(JSON.parse(str));
      } catch (e) {
        reject(e);
      }
    });

    client.on("error", reject);
  });
}
