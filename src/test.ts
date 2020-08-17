import { bootstrap } from "./bootstrap";
import { IDependencyManager, Dependency } from "./api";
import { Definition } from "./definition";


type Constructor<T> = new (...args: unknown[]) => T;
type Type<T> = { Type: Type<T> } | Constructor<T> | string;
type Dep<T> = Constructor<T> | Type<T> | { data: null };

interface A {
    xxx: number;
}
namespace A {
    export const Type: Type<A> = undefined;
}

class B implements A {
    public xxx: number;
}
class C extends B {

}

interface Index {
    
}

let a: Dep<A> = B;
let b: Dep<B> = C;

function fn<R extends A, P extends Constructor<R> = Constructor<R>, T extends Dep<P> = Dep<P>>(v: T): P {
    return undefined;
}


// fn(B);
// fn(C)



const dm = bootstrap();
class Foo {
    public constructor(public name: string) {}
}
class Boo {
    public constructor(public foo: Foo) {}
}

dm.bind("foo").toClass(Foo).withArgument(0, Definition.makeValue("tester"));
dm.bind("boo").toClass(Boo).withArgument(0, "foo");

(async () => {
    const newDm = await dm.get(IDependencyManager);
    // console.dir(newDm);
    console.log(await newDm.get("boo"));
})();
