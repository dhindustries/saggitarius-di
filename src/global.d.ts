
declare type Provider<T> = () => T;
declare type AsyncProvider<T> = () => Promise<T>;
declare type Factory<T, TArgs extends unknown[] = unknown[]> = (...args: TArgs) => T;
declare type AsyncFactory<T, TArgs extends unknown[] = unknown[]> = (...args: TArgs) => Promise<T>;
