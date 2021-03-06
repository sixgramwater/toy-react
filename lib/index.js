function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object'
        ? child
        : createTextElement(child)  
      )
    }
  }
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  }
}


function commitRoot() {
  deletions.forEach(commitWork)
  // add nodes to the DOM
  commitWork(wipRoot.child);
  // save reference to "last fiber tree we committed to DOM" after commit
  currentRoot = wipRoot;
  wipRoot = null;
}

// 
function commitWork(fiber) {
  if(!fiber) {
    return;
  }
  // a fiber may not have DOM because of function component
  let domParentFiber = fiber.parent;
  while(!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  } 
  const domParent = domParentFiber.dom;
  if(fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
    domParent.appendChild(fiber.dom);
  } else if (
    fiber.effectTag === 'UPDATE' && fiber.dom !== null
  ) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } 
  // when removing a fiber, we also need to keep going unill we find a child with DOM node
  else if(fiber.effectTag === 'DELETION') {
    // domParent.removeChild(fiber.dom);
    commitDeletion(fiber, domParent);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  // keep going untill we find a child with DOM node
  if(fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(element, container) {
  // set next unit of work to the root of the fiber tree
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  }
  deletions = [];
  nextUnitOfWork = wipRoot;

}

function createDom(fiber) {
  const dom = fiber.type === 'TEXT_ELEMENT'
    ? document.createTextNode("")
    : document.createElement(fiber.type)
  const isProperty = key => key !== 'children';
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = fiber.props[name]
    })

  return dom;
}

// One special kind of prop that we need to update are event listeners, 
// so if the prop name starts with the ???on??? prefix we???ll handle them differently.
const isEvent = key => key.startsWith("on")
const isProperty = key =>
  key !== "children" && !isEvent(key)
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next); 

function updateDom(dom, prevProps, nextProps) {
  // remove old or changed event listener
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      !(key in nextProps) || 
      isNew(prevProps, nextProps)(key)
    )
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2) // onClick -> onclick -> click
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )

    })
  // remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })
  // set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty) 
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // add event lisnter
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}

// the type of unit of work: fiber
let nextUnitOfWork = null;
// root of work in progress tree
let wipRoot = null;
// In terms of updating and deleting nodes, 
// we need to compare the elements we recieved on the render function to the last fiber we committed to the DOM
// So we need to save reference to that "last fiber tree we committed to DOM" after we finish the commit
let currentRoot = null;
// we need to keep track of the nodes we want to remove
let deletions = null;

function workloop(deadline) {
  let shouldYield = false;
  while(nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )

    shouldYield = deadline.timeRemaining() < 1
  }
  // commit only when whole UI is ready
  if(!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workloop)
}

requestIdleCallback(workloop);

function performUnitOfWork(fiber) {
  // TODO 1: add element to DOM
  // TODO 2: create fibers for the element's children
  // TODO 3: select the next unit of work

  // step1: create a new Node and append it to the DOM
  // if(!fiber.dom) {
  //   fiber.dom = createDom(fiber);
  // }
  const isFunctionComponent = 
    fiber.type instanceof Function
  if(isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // [improvement] users may see an incomplete UI because browsers could interupt out work before render the whole tree;
  // so we shouldn't directly mutate dom in previous fiber tree
  // if(fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom); 
  // }

  // step2: for each child we create a new fiber
  // const elements = fiber.props.children;
  // reconcileChildren(fiber, elements);


  // step3: finally we search for next unit of work: 1. child 2. sibling 3. uncle(parent.sibling)...
  if(fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while(nextFiber) {
    if(nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}


let wipFiber = null;
let hookIndex = null; 

function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  // Function components are differents in two ways:
  // 1. the fiber from a function component doesn???t have a DOM node
  // 2. and the children come from running the function instead of getting them directly from the props
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
  if(!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

// wipFiber -> old fiber
function reconcileChildren(wipFiber, elements) {
  // Here we reconcile the old fibers with the new elements
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while(index < elements.length ||
    oldFiber != null
  ) {
    // compare oldFiber and element: 
    // element is the thing we want to render to DOM; oldFiber is what we rendered last time
    // compare strategy: 1. if old fiber and element has the same type, we can keep the DOM node and just updates it with new props;
    // 2. if the type is different and there is a new element, we create a new DOM node
    // 3. if the type is different and there is a old fiber, we remove the old node
    const element = elements[index];
    let newFiber = null;

    const sameType = 
      oldFiber &&
      element &&
      element.type === oldFiber.type

    if(sameType) {
      // create newfiber keeping the DOM node from the old fiber and the props from the element
      newFiber = {
        type: oldFiber.type,
        dom: oldFiber.dom,
        props: element.props,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    
    if(element && !sameType) {
      // to add the new node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    if(oldFiber && !sameType) {
      // to remove the old fiber's node, we dont't need to create a new fiber
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if(oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if(index === 0) {
      wipFiber.child = newFiber;
    } else if(element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

function useState(initial) {
  // ?????????????????????????????????hook
  // hookIndex??????????????????function component?????????????????????useState????????????????????????????????????
  const oldHook = 
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    hook.state = action(hook.state);
  })

  // setState?????????????????????????????????????????????????????????action
  const setState = action => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    }
    // ????????????workloop?????????
    nextUnitOfWork = wipRoot;
  }
  // ??????????????????, ??????hookIndex++
  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state];
}

const Didact = {
  createElement,
  render,
  useState,
}

// const element = Didact.createElement(
//   "div",
//   { id: 'foo' },
//   Didact.createElement("a", null, "bar"),
//   Didact.createElement("b")
// )

// /** @jsx Didact.createElement */
// const element = (
//   <div id="foo">
//     <a>bar</a>
//     <b />
//   </div>
// )

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}
const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)

