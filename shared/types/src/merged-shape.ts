type KeysOfUnion<U> = U extends unknown ? keyof U : never;

type ValueOfUnion<U, K extends PropertyKey> = U extends unknown
  ? K extends keyof U
    ? U[K]
    : never
  : never;

/**
 * Every key any member of the union `U` carries, all optional, each with the
 * union of the member types. The merged, all-optional view of a per-type
 * union: callers read a field without first narrowing on the type.
 */
export type MergedOptional<U> = {
  [K in KeysOfUnion<U>]?: ValueOfUnion<U, K>;
};
