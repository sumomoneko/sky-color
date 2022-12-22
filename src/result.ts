export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  constructor(readonly value: T) {}
  type = "Ok" as const;
  isOk(): this is Ok<T, E> {
    return true;
  }
  isErr(): this is Err<T, E> {
    return false;
  }
}

export class Err<T, E> {
  constructor(readonly value: E) {}
  type = "Err" as const;
  isOk(): this is Ok<T, E> {
    return false;
  }
  isErr(): this is Err<T, E> {
    return true;
  }
}
