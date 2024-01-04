type ResolutionType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export const isPromiseLike = (
  value: any,
): value is Promise<ResolutionType<typeof value>> => {
  return (
    !!value &&
    typeof value === "object" &&
    "then" in value &&
    "catch" in value &&
    "finally" in value
  );
};
