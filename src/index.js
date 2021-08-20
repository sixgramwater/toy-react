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

function render(element, container) {
  const dom = element.type === 'TEXT_ELEMENT'
    ? document.createTextNode("")
    : document.createElement(element.type) 

  // assign element props to node
  const isProperty = key => key !== 'children';
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name];
    })

  // recursively render each child
  element.props.children.foreach(child=>
    render(child, dom)
  )
  container.appendChild(dom);
}

const Didact = {
  createElement,
  render
}

// const element = Didact.createElement(
//   "div",
//   { id: 'foo' },
//   Didact.createElement("a", null, "bar"),
//   Didact.createElement("b")
// )

/** @jsx Didact.createElement */
const element = (
  <div style="background: salmon">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from Didact</h2>
  </div>
);
const container = document.getElementById("root");
Didact.render(element, container);