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
  subscribers: new Set()
};
const callbackCache = new WeakMap();
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

export function getState() {
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
  if (typeof nextState === "function") {
    nextState = produce(context.state, nextState);
  }
  if (nextState !== context.state) {
    const prevState = context.state;
    context.state = nextState;
    // notify change
    if (notify) {
      for (const subscriber of context.subscribers) {
        subscriber(context.state, modifier || setState, prevState);
      }
    }
  }
}

export function reset(newContext = {}) {
  Object.assign(context, newContext);
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
            : selector === true
            ? key
            : selector
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

export default function compose(...functions) {
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

function executeAction(action, ...args) {
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
          result = action(executionContext, ...args);

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
