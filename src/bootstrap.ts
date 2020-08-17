import * as api from "./api";
import * as lib from "./lib";

export function bootstrap(): api.IDependencyManager {

    const defRegistry = new Map();
    const objRegistry = new WeakMap();
    const defResolver = new lib.DefinitionResolver(defRegistry, []);
    const depsProvider = new lib.DependencyProvider(defResolver);
    const objFactory = new lib.ObjectFactory(depsProvider);
    const objProvider = new lib.ObjectProvider(objFactory, objRegistry);
    const depsManager: api.IDependencyManager = new lib.DependencyManager(depsProvider, defRegistry);
    
    depsProvider.factory = objFactory;
    depsProvider.provider = objProvider;

    depsManager.bind(api.IDefinitionResolver).toType(lib.DefinitionResolver);
    depsManager.bind(api.IDependencyProvider).toType(lib.DependencyProvider);
    depsManager.bind(api.IObjectFactory).toType(lib.ObjectFactory);
    depsManager.bind(api.IObjectProvider).toType(lib.ObjectProvider);
    depsManager.bind(api.IDependencyManager).toType(lib.DependencyManager);
    depsManager.bind(api.IDefinitionResolver).toType(lib.DefinitionResolver);

    depsManager.bind(lib.DefinitionRegistry)
        .toFactory(() => new Map(defRegistry.entries()));

    depsManager.bind(lib.InstanceRegistry)
        .toClass(WeakMap);

    depsManager.bind(lib.DefinitionResolvers)
        .toArray();

    const binding = depsManager.bind(lib.DefinitionResolver);
    binding.withArgument(0, lib.DefinitionRegistry);
    
    depsManager.bind(lib.DefinitionResolver)
        .toClass(lib.DefinitionResolver)
        .withArguments([lib.DefinitionRegistry, lib.DefinitionResolvers]);

    depsManager.bind(lib.DependencyProvider)
        .toClass(lib.DependencyProvider)
        .withArguments([api.IDefinitionResolver])
        .withProperty("provider", api.IObjectProvider)
        .withProperty("factory", api.IObjectFactory);

    depsManager.bind(lib.ObjectFactory)
        .toClass(lib.ObjectFactory)
        .withArguments([api.IDependencyProvider, lib.InstanceRegistry]);

    depsManager.bind(lib.ObjectProvider)
        .toClass(lib.ObjectProvider)
        .withArguments([api.IObjectFactory, lib.InstanceRegistry]);

    depsManager.bind(lib.DependencyManager)
        .toClass(lib.DependencyManager)
        .withArguments([api.IDependencyProvider, lib.DefinitionRegistry]);
    
    return depsManager;
}

