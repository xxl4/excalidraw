import deflate from "pako/lib/zlib/deflate";

type EncodedData = {
  encoded: string;
  encoding: "bstring";
  /** whether text is compressed (zlib) */
  compressed: boolean;
  /** version for potential migration purposes */
  version?: string;
};

export const toByteString = (
  data: string | Uint8Array | ArrayBuffer,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob =
      typeof data === "string"
        ? new Blob([new TextEncoder().encode(data)])
        : new Blob([data instanceof Uint8Array ? data : new Uint8Array(data)]);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target || typeof event.target.result !== "string") {
        return reject(new Error("couldn't convert to byte string"));
      }
      resolve(event.target.result);
    };
    reader.readAsBinaryString(blob);
  });
};

export const encode = async ({
  text,
  compress,
}: {
  text: string;
  /** defaults to `true`. If compression fails, falls back to bstring alone. */
  compress?: boolean;
}): Promise<EncodedData> => {
  let deflated!: string;
  if (compress !== false) {
    try {
      deflated = await toByteString(deflate(text));
    } catch (error: any) {
      console.error("encode: cannot deflate", error);
    }
  }
  return {
    version: "1",
    encoding: "bstring",
    compressed: !!deflated,
    encoded: deflated || (await toByteString(text)),
  };
};
