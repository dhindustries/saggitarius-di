/// <reference path="global.d.ts" />
import { Typing } from "@saggitarius/typing";

import { Definition } from "./definition";
 
export interface Context {
    stack: Dependency[];
    shared: boolean;
    parameters?: Record<string, unknown>;
}

export type TypeProvider<T> = (type: Type<T>) => Promise<T>;
export type TypeFactory<T, TArgs extends unknown[] = []> = (type: Type<T>, ...args: TArgs) => Promise<T>;

export type Reference<T = unknown, P extends T = T> = Typing.Reference<P>;
export type Dependency<T = unknown, P extends T = T> = Reference<P> | Definition<P>;


export type ArrayDependencies<T extends ArrayLike<unknown>> = {
    readonly [index: number]: Dependency<Required<T[typeof index]>> | undefined;
    readonly length: number;
};

export type RecordDependencies<T> = {
    readonly [P in keyof T]?: Dependency<Required<T[P]>>;
};

export interface IDependencyProvider {
    get<T, P extends T = T>(ctx: Context, dep: Definition.Array<P>): Promise<Array<T>>;
    get<T, P extends T = T>(ctx: Context, dep: Definition.Record<P>): Promise<Record<string, T>>;
    get<T, P extends T = T>(ctx: Context, dep: Definition.Value<P>): Promise<T>;
    get<T, P extends T = T>(ctx: Context, dep: Definition.Type<P>): Promise<T>;
    get<T, P extends T = T>(ctx: Context, dep: Definition.Reference<P>): Promise<T>;
    get<T, P extends T = T>(ctx: Context, dep: Type<P>): Promise<T>;
}
export namespace IDependencyProvider {
    export const Type = Typing.type<IDependencyProvider>("@saggitarius/di::IDependencyProvider");
}

export interface IDefinitionResolver {
    resolve<T>(ctx: Context, def: Type<T> | Definition<T>): Promise<Definition.Provision<T>>;
}
export namespace IDefinitionResolver {
    export const Type = Typing.type<IDefinitionResolver>("@saggitarius/di::IDefinitionResolver");
}

export interface IObjectFactory {
    create<T>(ctx: Context, def: Definition.Type<T>): Promise<T>;
}
export namespace IObjectFactory {
    export const Type = Typing.type<IObjectFactory>("@saggitarius/di::IObjectFactory");
}

export interface IObjectProvider {
    get<T>(ctx: Context, def: Definition.Type<T>): Promise<T>;
}
export namespace IObjectProvider {
    export const Type = Typing.type<IObjectProvider>("@saggitarius/di::IObjectProvider");
}

type ClassExtension<T> = T extends new (...args: unknown[]) => unknown ? Typing.Class<T> : Typing.Constructor;

export interface IBinding<T = unknown> {
    toClass<P extends ClassExtension<T>>(ctor: P): IClassBinding<P>;
    toArray<P extends ArrayLike<Dependency>>(arr?: P): IArrayBinding<P>;
    toRecord<P extends Record<string, Dependency>>(rec?: P): IRecordBinding<P>;
    toType<P extends T>(type: Reference<T, P>): IBinding<T>;
    toValue(val: T): IBinding<T>;
    toFactory(fn: (...args: unknown[]) => unknown): IBinding<T>;
}
export namespace IBinding {
    export const Type = Typing.type<IBinding>("@saggitarius/di::IBinding");
}

export interface IArrayBinding<T extends ArrayLike<unknown> = ArrayLike<unknown>> {
    withElement<K extends keyof T>(index: K, value: Dependency<T[K]>): IArrayBinding<T>;
    withElements(args: ArrayDependencies<T>): IArrayBinding<T>;
}

export interface IRecordBinding<T extends Record<string, unknown> = Record<string, unknown>> {
    withField<K extends keyof T>(key: K, value: Reference<T[K]>): IRecordBinding<T>;
    withFields(props: RecordDependencies<T>): IRecordBinding<T>;
}

export interface IClassBinding<
    T extends Typing.Class = Typing.Class, 
    TArgs extends unknown[] = ConstructorParameters<T>,
    TInst extends unknown = InstanceType<T>,
> {
    shared(shared: boolean): IClassBinding<T, TArgs, TInst>;
    tag<V extends T[]>(tag: Reference<V>): IClassBinding<T, TArgs, TInst>;
    withArgument<K extends keyof TArgs>(index: K, value: Dependency<TArgs[K]>): IClassBinding<T, TArgs, TInst>;
    withProperty<K extends keyof TInst>(key: K, value: Dependency<TInst[K]>): IClassBinding<T, TArgs, TInst>;
    withArguments(args: ArrayDependencies<TArgs>): IClassBinding<T, TArgs, TInst>;
    withProperties(props: RecordDependencies<TInst>): IClassBinding<T, TArgs, TInst>;
}

export interface IDependencyManager {
    get<T>(type: Typing.Class<T>): Promise<T>;
    get<T>(type: Typing.Constructor<T>): Promise<T>;
    get<T>(type: Typing.Typed<T>): Promise<T>;
    get<T>(type: Type<T>): Promise<T>;
    get<T>(type: string): Promise<T>;

    create<T>(type: Typing.Class<T>, params?: Record<string, unknown>): Promise<T>;
    create<T>(type: Typing.Constructor<T>, params?: Record<string, unknown>): Promise<T>;
    create<T>(type: Typing.Typed<T>, params?: Record<string, unknown>): Promise<T>;
    create<T>(type: Type<T>, params?: Record<string, unknown>): Promise<T>;
    create<T>(type: string, params?: Record<string, unknown>): Promise<T>;


    bind<T>(type: Typing.Typed<T>): IBinding<T>;
    bind<T>(type: Type<T>): IBinding<T>;
    bind<T = unknown>(type: string): IBinding<T>;
    bind<T extends Typing.Class>(type: T): IBinding<T> & IClassBinding<T>;
    bind<T extends ArrayLike<unknown>>(type: Type<T>): IBinding<T> & IArrayBinding<T>;
    bind<T extends ArrayLike<unknown>>(type: Typing.Typed<T>): IBinding<T> & IArrayBinding<T>;
    bind<T extends ArrayLike<unknown>>(type: string): IBinding<T> & IArrayBinding<T>;
    bind<T extends Record<string, unknown>>(type: Type<T>): IBinding<T> & IRecordBinding<T>;
    bind<T extends Record<string, unknown>>(type: Typing.Typed<T>): IBinding<T> & IRecordBinding<T>;
    bind<T extends Record<string, unknown>>(type: string): IBinding<T> & IRecordBinding<T>;
} 
export namespace IDependencyManager {
    export const Type = Typing.type<IDependencyManager>("@saggitarius/di::IDependencyManager");
}
