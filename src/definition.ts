/// <reference path="global.d.ts" />
import "@saggitarius/typing";
import { Dependency } from "./api"; 

export namespace Definition {

    export enum Kind {
        Value = "value",
        Type = "type",
        Array = "array",
        Record = "record",
        Reference = "reference",
    }
    export interface Value<T = unknown> {
        kind: Kind.Value;
        value: T;
    }

    export interface Array<T = unknown> {
        kind: Kind.Array;
        elements?: globalThis.Array<Dependency<T> | undefined>;
    }

    export interface Record<T= unknown> {
        kind: Kind.Record;
        elements?: globalThis.Record<string, Dependency<T> | undefined>;
    }
    
    export interface Type<T = unknown> {
        kind: Kind.Type;
        type: globalThis.Type<T>;
        shared?: boolean;
        factory?: AsyncFactory<T>;
        args?: globalThis.Array<Dependency | undefined>;
        props?: globalThis.Record<string, Dependency | undefined>;
    }

    export interface Reference<T = unknown> {
        kind: Kind.Reference;
        target: globalThis.Type<T>;
    }

    export type Provision<T = unknown> = Value<T> | Array<T> | Record<T> | Type<T>;

    export function makeValue<T>(value: T): Value<T> {
        return {kind: Kind.Value, value};
    }

    export function makeType<T>(type: globalThis.Type<T>): Type<T> {
        return {kind: Kind.Type, type};
    }

    export function makeReference<T>(target: globalThis.Type<T>): Reference<T> {
        return {kind: Kind.Reference, target};
    }

    export function makeArray<T>(elements: globalThis.Array<Dependency<T> | undefined>): Array<T> {
        return {kind: Kind.Array, elements};
    }

    export function makeRecord<T>(elements: globalThis.Record<string, Dependency<T> | undefined>): Record<T> {
        return {kind: Kind.Record, elements};
    }

    export function isDefinition(v: unknown): v is Definition<unknown> {
        return typeof(v) === "object" && Object.values(Kind).includes(v["kind"]);
    }

    export function isValue(v: unknown): v is Value<unknown> {
        return typeof(v) === "object" && v["kind"] === Kind.Value;
    }
    
    export function isArray(v: unknown): v is Array<unknown> {
        return typeof(v) === "object" && v["kind"] === Kind.Array;
    }

    export function isRecord(v: unknown): v is Record<unknown> {
        return typeof(v) === "object" && v["kind"] === Kind.Record;
    }

    export function isType(v: unknown): v is Type<unknown> {
        return typeof(v) === "object" && v["kind"] === Kind.Type;
    }

    export function isReference(v: unknown): v is Reference<unknown> {
        return typeof(v) === "object" && v["kind"] === Kind.Reference;
    }
}

export type Definition<T = unknown> = Definition.Value<T> 
    | Definition.Array<T> | Definition.Record<T> 
    | Definition.Type<T> | Definition.Reference<T>; 

