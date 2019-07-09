import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback
} from "react";
import produce from "immer";

const context = {
  state: {},
  subscribers: {}
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
let uniqueId = 0;

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
  let nextState = context.state;
  Object.keys(state).forEach(key => {
    if (!(key in context.state)) {
      if (nextState === context.state) {
        nextState = {
          ...context.state
        };
      }
      nextState[key] = state[key];
    }
  });
  setState(nextState);
}

export function setState(nextState, notify = false, modifier) {
  if (nextState !== context.state) {
    context.state = nextState;
    // notify change
    if (notify) {
      for (const key in context.subscribers) {
        if (!context.subscribers.hasOwnProperty(key)) continue;
        context.subscribers[key](context.state, modifier);
      }
    }
  }
}

export function reinitialize(newContext = {}) {
  Object.assign(context, newContext);
}

export function subscribe(subscriber) {
  if (!subscriber.__id) {
    subscriber.__id = ++uniqueId;
  }
  context.subscribers[subscriber.__id] = subscriber;

  return () => {
    delete context.subscribers[subscriber.__id];
  };
}

export function unsubscribeAll() {
  context.subscribers = {};
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

function executeAction(action, ...args) {
  if (!context.executionContext) {
    // create new execution context
    const executionContext = (context.executionContext = {
      action: executeAction,
      effect: executeEffect
    });
    try {
      let result = undefined;
      const nextState = produce(context.state, draft => {
        executionContext.state = draft;
        result = action(executionContext, ...args);
      });
      setState(nextState, true, action);
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
