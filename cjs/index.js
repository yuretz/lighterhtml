'use strict';
const WeakMap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('@ungap/weakmap'));
const tta = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('@ungap/template-tag-arguments'));
const {Wire, wireType, isArray} = require('./shared.js');
const Tagger = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('./tagger.js'));

const wm = new WeakMap;

let current = null;

// can be used with any useRef hook
// returns an `html` and `svg` function
const hook = useRef => ({
  html: createHook(useRef, html),
  svg: createHook(useRef, svg)
});
exports.hook = hook;

// generic content render
function render(node, callback) {
  const content = update.call(this, node, callback);
  if (content !== null)
    appendClean(node, content);
  return node;
}
exports.render = render

// keyed render via render(node, () => html`...`)
// non keyed renders in the wild via html`...`
const html = outer('html');
exports.html = html;
const svg = outer('svg');
exports.svg = svg;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function appendClean(node, fragment) {
  node.textContent = '';
  node.appendChild(fragment);
}

function asNode(result) {
  return result.nodeType === wireType ? result.valueOf(true) : result;
}

function createHook(useRef, view) {
  return function () {
    const ref = useRef(null);
    if (ref.current === null)
      ref.current = content.bind(ref);
    return ref.current.apply(null, arguments);
  };
  function content() {
    const args = [];
    const {length} = arguments;
    for (let i = 0; i < length; i++)
      args[i] = arguments[i];
    const content = update(this, () => view.apply(null, args));
    if (content)
      this.content = content;
    return this.content;
  }
}

function outer(type) {
  return function () {
    const args = tta.apply(null, arguments);
    return current ?
      wired(type, args) :
      new Tagger(type).apply(null, args);
  };
}

function wired(type, args) {
  const {i, length, stack} = current;
  const stacked = i < length;
  current.i++;
  if (stacked) {
    const {kind, tagger, template, wire} = stack[i];
    if (kind === type && template === args[0]) {
      tagger.apply(null, args);
      return wire;
    }
  }
  const tagger = new Tagger(type);
  const info = {
    kind: type,
    tagger,
    template: args[0],
    wire: wireContent(tagger.apply(null, args))
  };
  if (stacked)
    stack[i] = info;
  else
    current.length = stack.push(info);
  current.update = true;
  return info.wire;
}

function set(node) {
  const info = {
    i: 0, length: 0,
    stack: [],
    update: false
  };
  wm.set(node, info);
  return info;
}

function update(reference, callback) {
  const prev = current;
  current = wm.get(reference) || set(reference);
  current.i = 0;
  const result = callback.call(this);
  const {i, length, stack} = current;
  if (i < length) {
    current.length = i;
    stack.splice(i);
  }
  let ret = null;
  if (current.update) {
    current.update = false;
    ret = asNode(result);
  }
  current = prev;
  return ret;
}

function wireContent(node) {
  const childNodes = node.childNodes;
  const {length} = childNodes;
  return length === 1 ?
    childNodes[0] :
    (length ? new Wire(childNodes) : node);
}
