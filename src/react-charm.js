import {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  memo,
  createElement
} from "react";
import produce from "immer";

const context = {
  state: {},
  subscribers: new Set(),
  watchers: new Set(),
  prevState: undefined
};
let callbackCache = new WeakMap();
let cachedSelectors = {};
const stateProxy = new Proxy(
  {},
  {
    get(target, name) {
      return context.state[name];
    },
    ownKeys: function() {
      return Object.keys(context.state);
    },
    getOwnPropertyDescriptor: function() {
      return { enumerable: true, configurable: true };
    }
  }
);
let setStateScopes = 0;
let shouldNotify = false;

export function useStates(...selectors) {
  const isUnmountRef = useRef(false);
  const onUnmountRef = useRef();
  const selectorsRef = useRef();
  const lastErrorRef = useRef();
  const currentStatesRef = useRef();
  const [, forceRerender] = useState();

  if (lastErrorRef.current) {
    const error = lastErrorRef.current;
    lastErrorRef.current = undefined;
    throw error;
  }

  selectorsRef.current = selectors;
  const getStates = useCallback(() => {
    return selectorsRef.current.length
      ? selectorsRef.current.map((selector, index) => {
          try {
            return typeof selector === "function"
              ? selector.__type === "prop"
                ? selector()
                : selector(context.state)
              : Array.isArray(selector)
              ? selector.reduce((prev, prop) => prev[prop], context.state)
              : context.state[selector];
          } catch (ex) {
            lastErrorRef.current = ex;
            return currentStatesRef.current
              ? currentStatesRef.current[index]
              : undefined;
          }
        })
      : [];
  }, []);
  const checkForUpdate = useCallback(() => {
    if (isUnmountRef.current || !selectorsRef.current.length) return;
    const nextStates = getStates();
    if (
      currentStatesRef.current.every(
        (item, index) => nextStates[index] === item
      )
    ) {
      return;
    }
    currentStatesRef.current = nextStates;
    forceRerender({});
  }, [getStates]);

  useLayoutEffect(
    () => () => {
      isUnmountRef.current = true;
      onUnmountRef.current && onUnmountRef.current();
    },
    []
  );

  useEffect(() => {
    const unsubscribe = subscribe(checkForUpdate);
    checkForUpdate();
    onUnmountRef.current = unsubscribe;
  }, [checkForUpdate]);

  currentStatesRef.current = getStates();

  return currentStatesRef.current;
}

export function dispatch(action, ...args) {
  if (context.executionContext) {
    throw new Error("dispatch must be called outside action execution");
  }
  return executeAction(action, ...args);
}

export function getState(selectors) {
  if (selectors) {
    if (typeof selectors === "function") return selectors(context.state);

    return Object.entries(selectors).reduce((result, [key, selector]) => {
      result[key] = getSelector(selector, key)(context.state);
      return result;
    }, {});
  }
  return context.state;
}

export function initState(state = {}) {
  setState(draft => {
    Object.keys(state).forEach(key => {
      if (key in context.state) return;
      draft[key] = state[key];
    });
  });
}

export function setState(nextState, notify = true, modifier) {
  try {
    setStateScopes++;
    if (!context.prevState) {
      context.prevState = context.state;
    }
    if (typeof nextState === "function") {
      // we use same mutation context for all mutator
      if (context.mutationContext) {
        nextState = nextState(context.mutationContext);
      } else {
        nextState = produce(context.state, draft => {
          context.mutationContext = draft;
          nextState(context.mutationContext);
          callWatchers();
        });
      }
    }
    if (nextState !== context.state) {
      context.state = nextState;
      // notify change
      if (notify) {
        shouldNotify = true;
      }

      callWatchers();
    }
  } finally {
    setStateScopes--;
    if (!setStateScopes) {
      delete context.mutationContext;
      const tempPrevState = context.prevState;
      delete context.prevState;
      if (shouldNotify) {
        shouldNotify = false;
        for (const subscriber of context.subscribers) {
          subscriber(context.state, modifier || setState, tempPrevState);
        }
      }
    }
  }
}

export function reset() {
  Object.values(cachedSelectors).forEach(selector => {
    delete selector.__prevValue;
  });
  for (const watcher of context.watchers) {
    delete watcher.__selectors;
  }
  context.state = {};
  delete context.prevState;
  context.watchers.clear();
  context.subscribers.clear();
  callbackCache = new WeakMap();
  cachedSelectors = {};
}

export function subscribe(subscriber) {
  context.subscribers.add(subscriber);

  return () => {
    context.subscribers.delete(subscriber);
  };
}

export function unsubscribeAll() {
  context.subscribers.clear();
}

export function getCallback(callback) {
  let cachedCallback = callbackCache.get(callback);

  if (!cachedCallback) {
    cachedCallback = (...args) => executeAction(callback, ...args);
    callbackCache.set(callback, cachedCallback);
  }

  return cachedCallback;
}

export function useActions(...actions) {
  return actions.map(getCallback);
}

export function withStates(stateMap) {
  const entries = Object.entries(stateMap);
  return comp => {
    const memoizedComp = memo(comp);
    return props => {
      const stateValues = useStates(
        ...entries.map(([key, selector]) =>
          typeof selector === "function"
            ? state => selector(state, props)
            : getSelector(selector, key)
        )
      );
      const nextProps = {};
      entries.forEach((entry, index) => {
        nextProps[entry[0]] = stateValues[index];
      });

      Object.assign(nextProps, props);

      return createElement(memoizedComp, nextProps);
    };
  };
}

export function withActions(actionMap) {
  const entries = Object.entries(actionMap);
  return comp => {
    // create memoized component
    const memoizedComp = memo(comp);
    // return wrapped component
    return props => {
      const callbacks = useMemo(
        () =>
          entries.map(entry =>
            getCallback((context, ...args) => {
              context.props = props;
              entry[1](context, ...args);
            })
          ),
        [props]
      );
      const nextProps = {};
      entries.forEach((entry, index) => {
        nextProps[entry[0]] = callbacks[index];
      });

      Object.assign(nextProps, props);

      return createElement(memoizedComp, nextProps);
    };
  };
}

export function compose(...functions) {
  if (functions.length === 0) {
    return arg => arg;
  }

  if (functions.length === 1) {
    return functions[0];
  }

  return functions.reduce((a, b) => (...args) => a(b(...args)));
}

/**
 * unlikely subscribe function, stateMutator will be called when any action dispatched
 * on(action, stateMutator)
 * on([action1, action2], stateMutator)
 * on([
 *  [action1, stateMutator1],
 *  [action2, stateMutator2]
 * ])
 */
export function on(...args) {
  if (context.executionContext) {
    throw new Error(
      "Cannot register state mutator inside action calling context"
    );
  }

  const pairs = [];
  /**
   * on([action1, action2], stateMutator)
   * on(
   *  [action1, stateMutator1],
   *  [action2, stateMutator2]
   * )
   */
  if (Array.isArray(args[0])) {
    /**
     * on([action1, action2], stateMutator)
     */
    if (typeof args[1] === "function") {
      pairs.push(...args[0].map(action => [action, args[1]]));
    } else {
      /**
       * on(
       *  [action1, stateMutator1],
       *  [action2, stateMutator2]
       * )
       */
      pairs.push(...args[0]);
    }
  } else {
    pairs.push(args);
  }

  pairs.forEach(([action, stateMutator]) => {
    if (!action.__subscribers) {
      action.__subscribers = new Set();
    }
    action.__subscribers.add(stateMutator);
  });

  return () => {
    pairs.forEach(([action, stateMutator]) =>
      action.__subscribers.delete(stateMutator)
    );
  };
}

export function watch(selector, watcher) {
  context.watchers.add(watcher);
  if (!watcher.__selectors) {
    watcher.__selectors = new Set();
  }
  if (Array.isArray(selector)) {
    selector.forEach(item => watcher.__selectors.add(item));
  } else {
    watcher.__selectors.add(selector);
  }
}

function executeAction(action, ...args) {
  if (Array.isArray(action)) {
    return executeAction(...action.flat(10), ...args);
  }

  if (!context.executionContext) {
    // create new execution context
    const executionContext = (context.executionContext = {
      type: action,
      action: executeAction,
      effect: executeEffect
    });
    try {
      let result = undefined;
      setState(
        draft => {
          executionContext.state = draft;
          result =
            // action can be any thing
            typeof action === "function"
              ? action(executionContext, ...args)
              : undefined;

          if (action.__subscribers) {
            for (const subscriber of action.__subscribers) {
              subscriber(executionContext);
            }
          }
        },
        true,
        action
      );
      return result;
    } finally {
      delete context.executionContext;
    }
  }

  return action(context.executionContext, ...args);
}

export const store = {
  getState,
  dispatch,
  subscribe
};

function executeEffect(effect, ...args) {
  return effect(
    {
      state: stateProxy,
      effect: executeEffect,
      action: executeAction
    },
    ...args
  );
}

executeEffect.async = async function(
  promiseFactory,
  { stateProp, singleton, onSuccess, onFailure, args = [] } = {},
  ...extraArgs
) {
  try {
    // dont execute twice
    if (singleton && stateProp && context.state[stateProp].status === "loading")
      return;

    if (stateProp) {
      setState(draft => {
        draft[stateProp] = {
          status: "loading",
          loading: true
        };
      });
    }

    const payload = await promiseFactory(...args, ...extraArgs);

    onSuccess && executeAction(onSuccess, payload);

    if (stateProp) {
      setState(draft => {
        draft[stateProp] = {
          status: "success",
          success: true,
          payload
        };
      });
    }
  } catch (error) {
    onFailure && executeAction(onFailure, error);

    if (stateProp) {
      setState(draft => {
        draft[stateProp] = {
          status: "failure",
          failure: true,
          error
        };
      });
    }
  }
};

function getSelector(selector, defaultProp) {
  if (typeof selector === "function") return selector;
  if (selector === true) return getSelector(defaultProp);
  if (selector in cachedSelectors) return cachedSelectors[selector];
  return (cachedSelectors[selector] = state => state[selector]);
}

function callWatchers() {
  if (!context.watchers.size) return;
  if (context.callingWatchers) return;
  context.callingWatchers = true;
  try {
    setState(draft => {
      for (const watcher of context.watchers) {
        let hasChange = false;
        for (const selector of watcher.__selectors) {
          const currentValue = selector(draft);
          if (selector.__prevValue !== currentValue) {
            hasChange = true;
            selector.__prevValue = currentValue;
          }
        }

        if (hasChange) {
          executeAction(watcher);
        }
      }
    });
  } finally {
    context.callingWatchers = false;
  }
}
