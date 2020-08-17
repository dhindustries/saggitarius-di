import { Future } from "@saggitarius/future";
import { Typing } from "@saggitarius/typing";
import { Definition } from "./definition";

import { 
    Context, 
    Reference,
    Dependency,
    IBinding,
    IClassBinding,
    IArrayBinding,
    IRecordBinding,
    ArrayDependencies,
    RecordDependencies,
    IDependencyProvider,
    IDefinitionResolver,
    IObjectFactory,
    IObjectProvider,
    IDependencyManager, 
} from "./api";


export type InstanceRegistry = WeakMap<Definition, Future<unknown>>;
export namespace InstanceRegistry {
    export const Type = Typing.type<InstanceRegistry>("@saggitarius/di/lib::InstanceRegistry");
}

export type DefinitionRegistry = Map<Type, Definition>;
export namespace DefinitionRegistry {
    export const Type = Typing.type<DefinitionRegistry>("@saggitarius/di/lib::DefinitionRegistry");
}

export type DefinitionResolvers = Array<IDefinitionResolver>;
export namespace DefinitionResolvers {
    export const Type = Typing.type<DefinitionResolvers>("@saggitarius/di/lib::DefinitionResolvers");
}

interface DiContext extends Context {
    instance?: Future<unknown>;
    registry?: Record<symbol, Future<unknown>>;
}


function renderDependency(dep: Dependency | undefined): string {
    if (typeof(dep) === "undefined") {
        return "<unknown>";
    }
    if (Definition.isArray(dep)) {
        const elems = (dep.elements || [])
            .map((elem) => renderDependency(elem))
            .join(", ");
        return `Array<${elems}>`;
    }
    if (Definition.isRecord(dep)) {
        const elems = Object.entries(dep.elements || {})
            .map(([key, elem]) => `[${key}]: ${renderDependency(elem)}`)
            .join(", ");
        return `Record<${elems}>`;
    }
    if (Definition.isType(dep)) {
        return `Type<${Typing.nameOf(dep.type)}>`;
    }
    if (Definition.isReference(dep)) {
        return `Reference<${Typing.nameOf(dep.target)}>`;
    }
    if (Definition.isValue(dep)) {
        return `Value<${typeof(dep.value)}>`;
    }
    return Typing.nameOf(Typing.type(dep));
}

@Typing.register("@saggitarius/di/lib::DependencyProvider")
export class DependencyProvider implements IDependencyProvider {
    
    public provider: IObjectProvider;
    public factory: IObjectFactory;

    public constructor(
        private defResolver: IDefinitionResolver,
    ) {}

    public async get<T, P extends T = T>(ctx: DiContext, dep: Dependency<P> | undefined): Promise<T | Array<T> | Record<string, T> | undefined> {
        try {
            if (typeof(dep) === "undefined") {
                return undefined;
            }
            const def = await this.getDefinition(ctx, dep);
            const hash = this.hashOf(ctx, def);
            if (ctx.registry && hash && ctx.registry[hash]) {
                return ctx.registry[hash];
            }

            return await this.getDependency(ctx, def)
        } catch (err) {
            throw err;
        }
    }

    private hashOf(ctx: DiContext, dep: Dependency): symbol | undefined {
        if (Definition.isDefinition(dep)) {
            if (Definition.isType(dep)) {
                return Typing.hashOf(dep.type);
            }
            return undefined;
        }
        return Typing.hashOf(Typing.type(dep));
    }

    private forkContext(ctx: DiContext, dep: Definition): DiContext {
        const stack = ctx.stack || [];
        const registry = ctx.registry || {};
        const shared = this.isShared(dep);
        if (stack.includes(dep)) {
            throw new Error("Cyclic dependency");
        }
        return {
            shared,
            stack: [...stack, dep],
            registry: {...registry},
        };
    }
    
    private isShared(dep: Definition): boolean {
        return dep.kind === Definition.Kind.Type
            && (typeof(dep.shared) === "undefined" || dep.shared);
    }

    private getDefinition<T>(ctx: DiContext, dep: Dependency<T>): Promise<Definition<T>> {
        return this.defResolver.resolve(ctx, Definition.isDefinition(dep) ? dep : Typing.type(dep));
    }

    public getDependency<T>(ctx: DiContext, dep: Definition<T>): Promise<T | Array<T> | Record<string, T>> {
        ctx = this.forkContext(ctx, dep);
        switch (dep.kind) {
            case Definition.Kind.Value:
                return this.getValue(ctx, dep);
            case Definition.Kind.Array:
                return this.getArray(ctx, dep);
            case Definition.Kind.Record:
                return this.getRecord(ctx, dep);
            case Definition.Kind.Type:
                return this.getType(ctx, dep);
        }
        throw new Error("Invalid definition");
    }

    private getValue<T, P extends T = T>(ctx: DiContext, dep: Definition.Value<P>): Promise<T> {
        return dep.value instanceof Promise ? dep.value : Promise.resolve(dep.value);
    }

    private getArray<T, P extends T = T>(ctx: DiContext, dep: Definition.Array<P>): Promise<Array<T>> {
        const elems = [];
        return Promise.all(
            (dep.elements || []).map(async (def, index) => {
                elems[index] = await this.get(ctx, def);
            })
        ).then(() => elems);
    }

    private getRecord<T, P extends T = T>(ctx: DiContext, dep: Definition.Record<P>): Promise<Record<string, T>> {
        const elems = {};
        return Promise.all(
            Object.keys(dep.elements || {})
                .map(async (key) => {
                    elems[key] = await this.get(ctx, dep.elements[key]);
                })
        ).then(() => elems);
    }

    private getType<T, P extends T = T>(ctx: DiContext, dep: Definition.Type<P>):  Promise<T> {
        return ctx.shared
            ? this.provider.get(ctx, dep)
            : this.factory.create(ctx, dep);
    }
}

const ResolvedSymbol = Symbol();

@Typing.register("@saggitarius/di/lib::DefinitionResolver")
export class DefinitionResolver implements IDefinitionResolver {
    public constructor(
        private registry: DefinitionRegistry,
        private resolvers: DefinitionResolvers = []
    ) {}

    public async resolve<T>(ctx: DiContext, type: Definition<T> | Type<T> | string): Promise<Definition.Provision<T>> {
        let def = this.getDefinition(ctx, type);
        const tags = [];
        while (def.kind === Definition.Kind.Reference) {
            tags.push(def);
            def = this.getDefinition(ctx, def.target);
            if (def[ResolvedSymbol]) {
                break;
            }
        }
        if (!def[ResolvedSymbol]) {
            const resolved = {...def};
            for (const resolver of this.resolvers) {
                const data = await resolver.resolve(ctx, resolved);
                Object.assign(resolved, data);
            }
            Reflect.defineProperty(def, ResolvedSymbol, {
                enumerable: false,
                configurable: false,
                writable: false,
                value: resolved,
            });
        }
        for (const tag of tags) {
            Reflect.defineProperty(tag, ResolvedSymbol, {
                enumerable: false,
                configurable: false,
                writable: false,
                value: def[ResolvedSymbol],
            });
        }
        return def[ResolvedSymbol];
    }

    private getDefinition<T>(ctx: DiContext, type: Definition<T> | Type<T> | string): Definition<T> {
        if (typeof(type) === "string") {
            type = Typing.type(type);
        }
        if (Typing.isType(type)) {
            let def = this.registry.get(type) as Definition<T>;
            if (!def) {
                def = Definition.makeType<T>(type);
                this.registry.set(type, def);
            }
            return def;
        }
        return type;
    }
}

@Typing.register("@saggitarius/di/lib::ObjectFactory")
export class ObjectFactory implements IObjectFactory {

    public constructor(
        private depsProvider: IDependencyProvider
    ) {}

    public async create<T>(ctx: DiContext, def: Definition.Type<T>): Promise<T> {
        try {
            const factoryPromise = this.getFactory(ctx, def);
            const argsPromise = this.getArgs(ctx, def);
    
            const factory = await factoryPromise;
            const args = await argsPromise;
            const instance = await factory(...args);
            Typing.store(instance, def.type);
    
            if (ctx.instance) {
                ctx.instance.set(instance);
            }
    
            const props = await this.getProps(ctx, def);
            Object.assign(instance, props);
    
            return instance;
        } catch (err) {
            throw err;
        }
    }

    private async getFactory<T>(ctx: DiContext, def: Definition.Type<T>): Promise<AsyncFactory<T>> {
        if (!def.factory) {
            throw new Error("Factory is not defined");
        }
        return def.factory;
    }

    private async getArgs<T>(ctx: DiContext, def: Definition.Type<T>): Promise<Array<unknown>> {
        if (def.args) {
            return this.depsProvider.get(ctx, Definition.makeArray(def.args));
        }
        return [];
    }

    private async getProps<T>(ctx: DiContext, def: Definition.Type<T>): Promise<Record<string, unknown>> {
        if (def.props) {
            return this.depsProvider.get(ctx, Definition.makeRecord(def.props));
        }
        return {};
    }
}

@Typing.register("@saggitarius/di/lib::ObjectProvider")
export class ObjectProvider implements IObjectProvider {
    public constructor(
        private factory: IObjectFactory,
        private registry: InstanceRegistry,
    ) {}

    public async get<T>(ctx: DiContext, def: Definition.Type<T>): Promise<T> {
        const hash = Typing.hashOf(def.type);
        if (ctx.registry && ctx.registry[hash]) {
            let result = await ctx.registry[hash].get();
            return result;
        } 
        const instance = this.registry.get(def) as Future<T> | undefined;
        if (!instance) {
            ctx.instance = ctx.instance || new Future<T>();
            ctx.registry = ctx.registry || {}
            this.registry.set(def, ctx.instance);
            ctx.registry[hash] = ctx.instance;
            return this.factory.create<T>(ctx, def)
        }
        return instance;
    }
}

class BaseBining {
    protected def: Definition;

    public constructor(
        private defRegistry: DefinitionRegistry,
        private type: Type,
    ) {
        this.def = defRegistry.get(type) as Definition;
        if (!this.def) {
            this.def = Definition.makeType(type);
            defRegistry.set(type, this.def);
        }
    }

    protected definition<T>(ref?: Dependency<T>): Definition<T> | Type<T> {
        if (ref) {
            if (Definition.isDefinition(ref)) {
                return ref as Definition<T>;
            }
            return Typing.type(ref);
        }
        return undefined;
    }

    protected tagType<T>(tag: Reference<T>) {
        const tagType = Typing.type(tag);
        let tagDef = this.defRegistry.get(tagType);
        if (typeof(tagDef) === "undefined") {
            tagDef = Definition.makeArray([]);
            this.defRegistry.set(tagType, tagDef);
        }
        if (Definition.isArray(tagDef)) {
            tagDef.elements = tagDef.elements || [];
            tagDef.elements.push(this.def);
        }
        return this;
    }
}

class ArrayBinding<TArgs extends ArrayLike<unknown> = ArrayLike<unknown>> extends BaseBining implements IArrayBinding<TArgs> {
    protected def: Definition.Array<TArgs>;
    
    public withElement<K extends keyof TArgs>(index: K, value: Reference<TArgs[K]>): ArrayBinding<TArgs> {
        const elems = this.elements();
        elems[index] = this.definition(value) || elems[index];
        return this;
    }

    public withElements(args: ArrayDependencies<TArgs>): ArrayBinding<TArgs> {
        const elems = this.elements();
        for (let index = 0; index < +args.length; index++) {
            elems[index] = this.definition(args[index]) || elems[index];
        }
        return this;
    }

    private elements(): Record<keyof TArgs, Definition | Type> {
        if (!this.def.elements) {
            this.def.elements = [];
        }
        return (this.def.elements as unknown) as Record<keyof TArgs, Definition | Type>;
    }
}

class RecordBinding<T extends Record<string, unknown>> extends BaseBining implements IRecordBinding<T> {
    protected def: Definition.Record<T>;
    
    public withField<K extends keyof T>(key: K, value: Reference<T[K]>): RecordBinding<T> {
        const fields = this.fields();
        fields[key] = this.definition(value) || fields[key];
        return this;
    }

    public withFields(props: RecordDependencies<T>): RecordBinding<T> {
        const fields = this.fields();
        for (const key in props) {
            fields[key] = this.definition(props[key]) || fields[key];
        }
        return this;
    }

    private fields(): Record<keyof T, Definition | Type> {
        if (!this.def.elements) {
            this.def.elements = {};
        }
        return this.def.elements as Record<keyof T, Definition | Type>;
    }
}

class TypeBinding<
    T extends Typing.Class, 
    TArgs extends unknown[] = ConstructorParameters<T>,
    TInst extends unknown = InstanceType<T>,
> 
    extends BaseBining 
    implements IClassBinding<T, TArgs, TInst> 
{
    protected def: Definition.Type<T>;
    
    public shared(shared: boolean): IClassBinding<T, TArgs, TInst> {
        this.def.shared = shared;
        return this;
    }

    public tag<V extends T[]>(tag: Reference<V>): IClassBinding<T, TArgs, TInst> {
        this.tagType(tag);
        return this;
    }

    public withArgument<K extends keyof TArgs>(index: K, value: Reference<TArgs[K]>): IClassBinding<T, TArgs, TInst> {
        const args = this.args();
        args[index] = this.definition(value) || args[index];
        return this;
    }

    public withProperty<K extends keyof TInst>(key: K, value: Reference<TInst[K]>): IClassBinding<T, TArgs, TInst> {
        const props = this.props();
        props[key] = this.definition(value) || props[key];
        return this;
    }

    public withArguments(value: ArrayDependencies<TArgs>): IClassBinding<T, TArgs, TInst> {
        const args = this.args();
        for (let index = 0; index < +value.length; ++index) {
            args[index] = this.definition(value[index]) || args[index];
        }
        return this;
    }

    public withProperties(value: RecordDependencies<TInst>): IClassBinding<T, TArgs, TInst> {
        const props = this.props();
        for (const key in value) {
            props[key] = this.definition((value as Record<string, Dependency>)[key]) || props[key];
        }
        return this;
    }

    private args(): Record<keyof TArgs, Definition | Type> {
        if (!this.def.args) {
            this.def.args = [];
        }
        return (this.def.args as unknown) as Record<keyof TArgs, Definition | Type>;
    }

    private props(): Record<keyof TInst, Definition | Type> {
        if (!this.def.props) {
            this.def.props = {};
        }
        return this.def.props as Record<keyof TInst, Definition | Type>;
    }
}


function mixin(cls): ClassDecorator {
    return (target) => {
        for (const key of Reflect.ownKeys(cls.prototype)) {
            const field: Function = cls.prototype[key];
            if (typeof(field) === "function" && key !== "constructor") {
                Reflect.defineProperty(target.prototype, key, {
                    value: field,
                });
            }
        }
        return target
    };
}

abstract class GenericBinding extends BaseBining implements IBinding, IClassBinding, IRecordBinding, IArrayBinding {

    abstract toClass<P extends new (...args: unknown[]) => unknown>(ctor: P): IClassBinding<P, ConstructorParameters<P>, InstanceType<P>>;
    abstract toArray<P extends ArrayLike<Dependency<unknown>>>(arr?: P): IArrayBinding<P>;
    abstract toRecord<P extends Record<string, Dependency<unknown>>>(rec?: P): IRecordBinding<P>;
    abstract toType<P = unknown>(type: Typing.Reference<P>): IBinding<unknown>;
    abstract toValue(val: unknown): IBinding<unknown>;
    abstract toFactory(fn: (...args: unknown[]) => unknown): IBinding<unknown>;

    shared(shared: boolean): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    tag<V extends (new (...args: unknown[]) => unknown)[]>(tag: Typing.Reference<V>): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    withArgument<K extends number | "length" | "toString" | "toLocaleString" | "pop" | "push" | "concat" | "join" | "reverse" | "shift" | "slice" | "sort" | "splice" | "unshift" | "indexOf" | "lastIndexOf" | "every" | "some" | "forEach" | "map" | "filter" | "reduce" | "reduceRight" | "find" | "findIndex" | "fill" | "copyWithin" | "entries" | "keys" | "values" | "includes" | "flatMap" | "flat">(index: K, value: Dependency<unknown[][K]>): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    withProperty<K extends never>(key: K, value: Dependency<unknown>): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    withArguments(args: ArrayDependencies<unknown[]>): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    withProperties(props: RecordDependencies<unknown>): IClassBinding<new (...args: unknown[]) => unknown, unknown[], unknown> {
        throw new Error("Method not implemented.");
    }
    withField<K extends string>(key: K, value: Typing.Reference<unknown>): IRecordBinding<Record<string, unknown>> {
        throw new Error("Method not implemented.");
    }
    withFields(props: RecordDependencies<Record<string, unknown>>): IRecordBinding<Record<string, unknown>> {
        throw new Error("Method not implemented.");
    }
    withElement<K extends number | "length">(index: K, value: Dependency<ArrayLike<unknown>[K]>): IArrayBinding<ArrayLike<unknown>> {
        throw new Error("Method not implemented.");
    }
    withElements(args: ArrayDependencies<ArrayLike<unknown>>): IArrayBinding<ArrayLike<unknown>> {
        throw new Error("Method not implemented.");
    }
}

@mixin(TypeBinding)
@mixin(RecordBinding)
@mixin(ArrayBinding)
@Typing.register("@saggitarius/di/lib::Binding")
class Binding extends GenericBinding implements
    IBinding,
    IClassBinding,
    IRecordBinding,
    IArrayBinding
{

    public toClass<T extends new (...args: unknown[]) => unknown, TArgs extends unknown[] = ConstructorParameters<T>, TInst = InstanceType<T>>(ctor: T): IClassBinding<T, TArgs, TInst> {
        Object.assign(this.def, {
            kind: Definition.Kind.Type,
            factory: async (...args: TArgs) => new ctor(...args),
        });
        return this as IClassBinding<T, TArgs, TInst>;
    }

    public toArray<T extends ArrayLike<Dependency>>(arr?: T): IArrayBinding<T> {
        const elems = [] as Array<Dependency>;
        if (arr) {
            for (let index = 0; index < +arr.length; ++index) {
                elems[index] = this.definition(arr[index]);
            }
        }
        Object.assign(this.def, {
            kind: Definition.Kind.Array,
            elements: elems,
        });
        return this as IArrayBinding<T>;
    }

    public toRecord<T extends Record<string, Dependency>>(rec?: T): IRecordBinding<T> {
        const elems = {} as Record<string, Dependency>;
        if (rec) {
            for (const key in rec) {
                elems[key] = this.definition(rec[key]);
            }
        }
        Object.assign(this.def, {
            kind: Definition.Kind.Record,
            elements: elems,
        });
        return this as IRecordBinding<T>;
    }

    public toType(type: Reference): IBinding<unknown> {
        Object.assign(this.def, {
            kind: Definition.Kind.Reference,
            target: Typing.type(type),
        });
        return this;
    }

    public toValue(val: unknown): IBinding<unknown> {
        Object.assign(this.def, {
            kind: Definition.Kind.Value,
            value: val,
        })
        return this;
    }

    public toFactory(fn: (...args: unknown[]) => unknown): IBinding<unknown> {
        Object.assign(this.def, {
            kind: Definition.Kind.Type,
            factory: async (...args: unknown[]) => fn(...args),
        });
        return this;
    }
}

@Typing.register("@saggitarius/di/lib::DependencyManager")
export class DependencyManager implements IDependencyManager {
    public constructor(
        private depsProvider: IDependencyProvider,
        private defRegistry: DefinitionRegistry,
    ) {}

    public bind(type: Reference): IBinding & IClassBinding & IArrayBinding & IRecordBinding {
        return new Binding(this.defRegistry, Typing.type(type));
    }

    public get<T>(type: Reference): Promise<T> {
        type = Typing.type(type);
        const ctx = {
            stack: [],
            shared: true,
        };
        ctx.shared = true;
        return this.depsProvider.get<T>(ctx, type);
    }

    public async create<T>(type: Reference, parameters: Record<string, unknown>): Promise<T> {
        type = Typing.type(type);
        const ctx = {
            stack: [],
            shared: false,
            parameters,
        };
        return this.depsProvider.get<T>(ctx, type);
    }
}
